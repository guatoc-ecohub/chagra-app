import { spawnSync } from 'node:child_process';
import nodeConsole from 'node:console';
import { resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

export const TEMPORARY_EXCEPTION = Object.freeze({
  advisory: 'GHSA-fc5q-39xc-vjpf',
  expires: '2026-12-17',
  reason: 'ReDoS en picomatch (el aviso cubre <=4.0.7); al 2026-11-17 no hay versión corregida y llega por vite, vitest y tinyglobby, herramientas de build que no viajan en el bundle.',
});

const SEVERITY_RANK = Object.freeze({ info: 0, low: 1, moderate: 2, high: 3, critical: 4 });
const RANK_SEVERITY = Object.freeze(['none', 'low', 'moderate', 'high', 'critical']);

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function rankOf(severity) {
  return SEVERITY_RANK[severity] ?? -1;
}

function hasHighOrCritical(counts) {
  return Number(counts?.high) > 0 || Number(counts?.critical) > 0;
}

function isTargetAdvisory(advisory) {
  if (typeof advisory.url !== 'string') return false;
  return new RegExp(`(?:^|/)${TEMPORARY_EXCEPTION.advisory}(?:$|[?#])`, 'i').test(advisory.url);
}

function validateDate(value) {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new Error(`Fecha inválida: ${value}`);
  }
  return value;
}

/** Evaluate npm's v7+ audit JSON while removing only the named advisory. */
export function evaluateAuditReport(report, asOf = new Date().toISOString().slice(0, 10)) {
  validateDate(asOf);

  if (!isRecord(report) || report.error || !isRecord(report.vulnerabilities) || !isRecord(report.metadata?.vulnerabilities)) {
    return {
      ok: false,
      message: 'No se pudo interpretar el informe de npm audit; el gate falla cerrado.',
      ignored: [],
      blockers: [],
    };
  }

  const packages = new Map(Object.entries(report.vulnerabilities));
  const directRanks = new Map();
  const references = new Map();
  const targetPackages = new Set();
  const ignored = new Set();
  const expired = new Set();
  const unknownHighPackages = new Set();

  for (const [name, vulnerability] of packages) {
    if (!isRecord(vulnerability) || !Array.isArray(vulnerability.via)) {
      unknownHighPackages.add(name);
      continue;
    }

    let directRank = 0;
    const packageReferences = [];
    let sawAdvisory = false;
    let unknownVia = false;

    for (const via of vulnerability.via) {
      if (typeof via === 'string') {
        packageReferences.push(via);
        continue;
      }
      if (!isRecord(via)) {
        unknownVia = true;
        continue;
      }

      sawAdvisory = true;
      const severity = via.severity ?? vulnerability.severity;
      const rank = rankOf(severity);
      if (rank < 0) {
        unknownVia = true;
        continue;
      }

      if (isTargetAdvisory(via)) {
        targetPackages.add(name);
        if (asOf <= TEMPORARY_EXCEPTION.expires && rank >= SEVERITY_RANK.high) {
          ignored.add(name);
          continue;
        }
        if (asOf > TEMPORARY_EXCEPTION.expires && rank >= SEVERITY_RANK.high) {
          expired.add(name);
        }
      }
      directRank = Math.max(directRank, rank);
    }

    directRanks.set(name, directRank);
    references.set(name, packageReferences);
    if (unknownVia || (!sawAdvisory && packageReferences.length === 0 && rankOf(vulnerability.severity) >= SEVERITY_RANK.high)) {
      unknownHighPackages.add(name);
    }
  }

  // npm represents transitive vulnerabilities as package-name strings in `via`.
  // Recompute severities through that graph after removing the one allowed source.
  const effectiveRanks = new Map([...packages.keys()].map((name) => [name, directRanks.get(name) ?? 0]));
  const targetReachable = new Set(targetPackages);
  for (let pass = 0; pass <= packages.size; pass += 1) {
    let changed = false;
    for (const [name, vulnerability] of packages) {
      let rank = directRanks.get(name) ?? 0;
      let reachesTarget = targetReachable.has(name);
      for (const dependency of references.get(name) ?? []) {
        if (effectiveRanks.has(dependency)) rank = Math.max(rank, effectiveRanks.get(dependency));
        if (targetReachable.has(dependency)) reachesTarget = true;
        if (!packages.has(dependency) && rankOf(vulnerability?.severity) >= SEVERITY_RANK.high) {
          // Unknown links cannot be used to explain away a high/critical finding.
          rank = Math.max(rank, rankOf(vulnerability.severity));
        }
      }
      if (rank > (effectiveRanks.get(name) ?? 0)) {
        effectiveRanks.set(name, rank);
        changed = true;
      }
      if (reachesTarget && !targetReachable.has(name)) {
        targetReachable.add(name);
        changed = true;
      }
    }
    if (!changed) break;
  }

  const blockers = [];
  for (const [name, vulnerability] of packages) {
    const originalRank = rankOf(vulnerability?.severity);
    const effectiveRank = effectiveRanks.get(name) ?? 0;
    if (effectiveRank >= SEVERITY_RANK.high) {
      const reason = expired.has(name)
        ? `excepción vencida: ${TEMPORARY_EXCEPTION.advisory} después del ${TEMPORARY_EXCEPTION.expires}`
        : 'aviso alto o crítico';
      blockers.push({ name, severity: RANK_SEVERITY[effectiveRank], reason });
    } else if (originalRank >= SEVERITY_RANK.high && !targetReachable.has(name)) {
      unknownHighPackages.add(name);
    }
  }

  for (const name of unknownHighPackages) {
    blockers.push({ name, severity: packages.get(name)?.severity ?? 'desconocida', reason: 'estructura de auditoría no reconocida' });
  }

  if (hasHighOrCritical(report.metadata.vulnerabilities) && packages.size === 0) {
    blockers.push({ name: 'informe npm audit', severity: 'desconocida', reason: 'conteos sin detalle de vulnerabilidades' });
  }
  if (hasHighOrCritical(report.metadata.vulnerabilities) && ![...packages.values()].some((vulnerability) => rankOf(vulnerability?.severity) >= SEVERITY_RANK.high)) {
    blockers.push({ name: 'informe npm audit', severity: 'desconocida', reason: 'conteos incompatibles con el detalle de vulnerabilidades' });
  }

  const ignoredMessage = ignored.size > 0
    ? `Excepción temporal activa: ignorado ${TEMPORARY_EXCEPTION.advisory} en ${[...ignored].join(', ')}; ${TEMPORARY_EXCEPTION.reason} Vence el ${TEMPORARY_EXCEPTION.expires}.`
    : '';
  const blockerMessage = blockers.length > 0
    ? `Gate bloqueado: ${blockers.map(({ name, severity, reason }) => `${name} (${severity}: ${reason})`).join('; ')}.`
    : 'Auditoría aprobada: ningún otro aviso alto o crítico.';

  return {
    ok: blockers.length === 0,
    message: [ignoredMessage, blockerMessage].filter(Boolean).join('\n'),
    ignored: [...ignored],
    blockers,
  };
}

function runAudit() {
  const result = spawnSync('npm', ['audit', '--json'], { encoding: 'utf8' });
  if (result.error || result.signal || result.status === null || result.status > 1) {
    nodeConsole.error('No se pudo completar npm audit; el gate falla cerrado.');
    process.exitCode = 1;
    return;
  }

  let report;
  try {
    report = JSON.parse(result.stdout);
  } catch {
    nodeConsole.error('npm audit no devolvió JSON legible; el gate falla cerrado.');
    process.exitCode = 1;
    return;
  }

  const evaluation = evaluateAuditReport(report);
  nodeConsole.log(evaluation.message);
  process.exitCode = evaluation.ok ? 0 : 1;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  runAudit();
}

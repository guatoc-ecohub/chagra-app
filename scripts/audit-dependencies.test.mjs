import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluateAuditReport, TEMPORARY_EXCEPTION } from './audit-dependencies.mjs';

const TARGET_URL = `https://github.com/advisories/${TEMPORARY_EXCEPTION.advisory}`;

function report(extra = {}) {
  return {
    auditReportVersion: 2,
    metadata: { vulnerabilities: { info: 0, low: 0, moderate: 0, high: 4, critical: 0, total: 4 } },
    vulnerabilities: {
      picomatch: {
        severity: 'high',
        via: [{ source: 1247710, name: 'picomatch', title: 'ReDoS', url: TARGET_URL, severity: 'high', range: '<=4.0.7' }],
      },
      tinyglobby: { severity: 'high', via: ['picomatch'] },
      vite: { severity: 'high', via: ['picomatch', 'tinyglobby'] },
      vitest: { severity: 'high', via: ['picomatch', 'tinyglobby'] },
      ...extra,
    },
  };
}

test('permite el único GHSA mientras la excepción está vigente e informa su vencimiento', () => {
  const result = evaluateAuditReport(report(), '2026-11-17');

  assert.equal(result.ok, true);
  assert.deepEqual(result.ignored, ['picomatch']);
  assert.match(result.message, /GHSA-fc5q-39xc-vjpf/);
  assert.match(result.message, /2026-12-17/);
  assert.match(result.message, /no hay versión corregida/);
  assert.equal(result.blockers.length, 0);
});

test('bloquea un aviso alto distinto junto con la excepción activa', () => {
  const result = evaluateAuditReport(report({
    unrelated: {
      severity: 'high',
      via: [{ source: 999, name: 'unrelated', title: 'Otro aviso', url: 'https://github.com/advisories/GHSA-aaaa-bbbb-cccc', severity: 'high', range: '<1.0.0' }],
    },
  }), '2026-11-17');

  assert.equal(result.ok, false);
  assert.match(result.message, /unrelated \(high: aviso alto o crítico\)/);
});

test('bloquea el mismo GHSA después de la fecha de vencimiento', () => {
  const result = evaluateAuditReport(report(), '2026-12-18');

  assert.equal(result.ok, false);
  assert.match(result.message, /GHSA-fc5q-39xc-vjpf/);
  assert.match(result.message, /excepción vencida/);
});

test('falla cerrado cuando el detalle de npm audit no se puede interpretar', () => {
  const result = evaluateAuditReport({ metadata: { vulnerabilities: { high: 1, critical: 0 } } }, '2026-11-17');

  assert.equal(result.ok, false);
  assert.match(result.message, /falla cerrado/);
});

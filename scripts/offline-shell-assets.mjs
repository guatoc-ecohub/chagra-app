// The authenticated home, its chrome, labor form and conversation form the shell,
// plus the main screens a farmer opens from home without signal (STEV-37:
// tasks, my farm, weather, reports, log). Every screen also imports usage and
// pilot telemetry and the task list the retriever on demand; their dynamic
// facades would 504 offline. Follow static dependencies; optional routes remain
// cache-on-use.
export function offlineShellAssets(bundle) {
  const roots = /\/src\/(?:main\.jsx|appRuntime\.jsx|visual\/agente\/(?:AngelitaAvisoGlobal|BurbujaAngelita)\.jsx|services\/(?:usageTelemetryService|pilotTelemetryService|ragRetriever)\.js|components\/(?:clima\/ClimaBoletinScreen\.jsx|(?:TaskLogScreen|TaskScreen|AssetsDashboard|InformesScreen|WorkerHistory|MaintenanceScreen|TopBar|AgentFab|IosInstallBanner|AndroidInstallBanner|UpdateAvailableBanner|CriticalAlertBanner|CompaiFotosOverlay|ChagraAgentAvatar(?:Angelita|ChivitoPunk|Guacamaya|Jaguar|Luciernaga|OsoBaston|Zariguya)?)\.jsx|AgentScreen\/AgentScreen\.jsx|dashboard\/(?:HomeIlustradoA|HomeCampesinoB|DashboardLive)\.jsx))$/;
  const visited = new Set();
  const visit = name => {
    if (visited.has(name)) return;
    const chunk = bundle[name];
    if (!chunk || chunk.type !== 'chunk') return;
    visited.add(name);
    for (const css of chunk.viteMetadata?.importedCss || []) visited.add(css);
    for (const dependency of chunk.imports) visit(dependency);
  };
  for (const chunk of Object.values(bundle)) {
    if (chunk.type !== 'chunk') continue;
    // Rolldown can emit an empty re-export facade for a dynamic entry.
    // It must be cached as well as the chunk containing the module's code.
    const modules = [chunk.facadeModuleId, ...Object.keys(chunk.modules)].filter(Boolean);
    if (modules.some(id => roots.test(id.replaceAll('\\', '/')))) visit(chunk.fileName);
  }
  for (const name of Object.keys(bundle)) if (name.startsWith('home-frames/')) visited.add(name);
  return [...visited].sort().map(name => '/' + name);
}

// Read the graph in writeBundle, not generateBundle: vite:css-post deletes
// CSS-only chunks (and rewires their importers) inside its own generateBundle,
// so an earlier snapshot lists .js files that are never written to dist/.
export function offlineShellAssetsPlugin(onAssets) {
  return {
    name: 'chagra-offline-shell-assets',
    apply: 'build',
    writeBundle(_options, bundle) { onAssets(offlineShellAssets(bundle)); },
  };
}

// Lists every precache URL that does not exist under outputDir.
export function missingOfflineShellAssets(urls, outputDir, exists) {
  return urls.filter(url => !exists(outputDir + url));
}

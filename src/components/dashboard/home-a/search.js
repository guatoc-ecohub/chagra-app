const normalized = value => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es').trim();

export function searchHomeTools(tools, query) {
  const term = normalized(query);
  if (!term) return [];
  const exact = tools.filter(tool => normalized(tool.title) === term || tool.searchTerms?.some(alias => normalized(alias) === term));
  const words = term.split(/\s+/);
  const matches = exact.length ? exact : tools.filter(tool => words.every(word => normalized(`${tool.title} ${tool.description} ${tool.keywords || ''} ${(tool.searchTerms || []).join(' ')}`).includes(word)));
  return [...new Map(matches.map(tool => [tool.view, tool])).values()];
}

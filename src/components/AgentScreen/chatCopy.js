// Presentation only: the shared outlook and the weather screen stay unchanged.
export function chatOutlookCopy(text) {
  if (typeof text !== 'string') return '';
  const forms = { Espera: 'Espere', Prioriza: 'Priorice', Revisa: 'Revise', vigila: 'vigile' };
  return text.replace(/\b(Espera|Prioriza|Revisa|vigila)\b/g, word => forms[word]);
}

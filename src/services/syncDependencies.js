// Only transactions that declare dependencies are reordered. Legacy order stays intact.
export function orderDependentTransactions(transactions) {
  const result = transactions.filter(tx => !tx._dependsOn?.length);
  const waiting = transactions.filter(tx => tx._dependsOn?.length);
  const emitted = new Set(result.map(tx => tx.id));
  const ids = new Set(transactions.map(tx => tx.id));
  while (waiting.length) {
    const index = waiting.findIndex(tx => tx._dependsOn.every(id => !ids.has(id) || emitted.has(id)));
    if (index < 0) break; // Cycles stay pending; they cannot safely be sent.
    const [tx] = waiting.splice(index, 1);
    result.push(tx);
    emitted.add(tx.id);
  }
  return result;
}

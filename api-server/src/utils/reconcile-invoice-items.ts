export type InvoiceItemValues = {
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
};

// Compare occurrences, not a set: two intentionally identical lines remain
// two lines. Numeric database strings and numbers represent the same value.
export function itemContentKey(item: InvoiceItemValues): string {
  const values = [item.quantity, item.unit_price, item.total].map(Number);
  if (values.some(value => !Number.isFinite(value))) throw new Error('Invalid invoice item amount');
  return JSON.stringify([String(item.description), ...values]);
}

export function reconcileInvoiceItems(db: any, invoiceId: number, incoming: InvoiceItemValues[]) {
  return db.transaction(() => {
    const local = db.prepare('SELECT id,description,quantity,unit_price,total FROM invoice_items WHERE invoice_id=? ORDER BY id').all(invoiceId) as Array<InvoiceItemValues & {id: number}>;
    const unused = new Map(local.map(row => [row.id, row]));
    const matches = incoming.map(row => {
      const key = itemContentKey(row);
      const match = [...unused.values()].find(candidate => itemContentKey(candidate) === key);
      if (match) unused.delete(match.id);
      return {row, id: match?.id};
    });
    let inserted = 0;
    const update = db.prepare('UPDATE invoice_items SET description=?,quantity=?,unit_price=?,total=? WHERE id=? AND invoice_id=?');
    const insert = db.prepare('INSERT INTO invoice_items(invoice_id,description,quantity,unit_price,total) VALUES (?,?,?,?,?)');
    for (const match of matches) {
      if (match.id !== undefined) continue;
      const reusable = unused.values().next().value as (InvoiceItemValues & {id:number}) | undefined;
      const {row} = match;
      if (reusable) {
        unused.delete(reusable.id);
        update.run(row.description,row.quantity,row.unit_price,row.total,reusable.id,invoiceId);
      } else {
        insert.run(invoiceId,row.description,row.quantity,row.unit_price,row.total);
        inserted++;
      }
    }
    const remove = db.prepare('DELETE FROM invoice_items WHERE id=? AND invoice_id=?');
    for (const id of unused.keys()) remove.run(id,invoiceId);
    return {inserted};
  }).immediate();
}

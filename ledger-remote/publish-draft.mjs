const failure=(status,message)=>Object.assign(Error(message),{status});
export async function publishDraft(client,draft){
 const invoice=draft.kind==='invoice',table=invoice?'invoices':'receipts',numberColumn=invoice?'invoice_number':'receipt_number';
 const rows=(await client.query(`SELECT id,sync_id,${numberColumn} AS number FROM ${table} WHERE sync_id=$1 OR ${numberColumn}=$2 FOR UPDATE`,[draft.syncId,draft.number])).rows;
 if(rows.length){if(rows.length!==1||String(rows[0].sync_id)!==draft.syncId||rows[0].number!==draft.number)throw failure(409,'Web identity or number conflict');return Number(rows[0].id);}
 if(invoice){
  const row=(await client.query(`INSERT INTO invoices(invoice_number,client_id,issue_date,due_date,status,subtotal,tax_rate,tax_amount,total,notes,shipment_ref,bill_of_lading,package_count,shipment_weight,port_of_entry,importer_exporter_name,advance_payment,created_by,sync_id,created_source) VALUES($1,$2,$3,$4,'draft',$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,'web') RETURNING id`,[draft.number,draft.clientId,draft.date,draft.dueDate||null,draft.subtotal,draft.taxRate,draft.taxAmount,draft.remaining,draft.notes,draft.shipmentRef||null,draft.billOfLading||null,draft.packageCount,draft.shipmentWeight,draft.portOfEntry||null,draft.importerExporterName||null,draft.advancePayment,draft.salesManId??draft.createdBy,draft.syncId])).rows[0];
  for(const i of draft.items)await client.query('INSERT INTO invoice_items(invoice_id,description,quantity,unit_price,total) VALUES($1,$2,$3,$4,$5)',[row.id,i.description,i.quantity,i.unitPrice,i.total]);
  return Number(row.id);
 }
 if(draft.invoiceId){
  const i=(await client.query(`SELECT id,invoice_number,status,GREATEST(0,COALESCE(subtotal,0)+COALESCE(tax_amount,0)-COALESCE(advance_payment,0)-COALESCE((SELECT SUM(amount) FROM receipts WHERE invoice_id=invoices.id AND status='issued' AND deleted_at IS NULL),0)) AS remaining FROM invoices WHERE id=$1 AND client_id=$2 AND deleted_at IS NULL FOR UPDATE`,[draft.invoiceId,draft.clientId])).rows[0];
  if(!i||!['issued','paid'].includes(i.status))throw failure(400,'Invoice not available for this client');
  if(Number(draft.amount)>Number(i.remaining))throw failure(409,'Receipt exceeds current outstanding balance');
  draft.invoiceNumber=i.invoice_number;
 }
 const row=(await client.query(`INSERT INTO receipts(receipt_number,client_id,invoice_id,amount,payment_method,status,notes,receipt_date,created_by,sync_id,created_source) VALUES($1,$2,$3,$4,$5,'draft',$6,$7,$8,$9,'web') RETURNING id`,[draft.number,draft.clientId,draft.invoiceId,draft.amount,draft.paymentMethod,draft.notes,draft.date,draft.createdBy,draft.syncId])).rows[0];return Number(row.id);
}

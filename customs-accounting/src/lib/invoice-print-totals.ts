type InvoicePrintAmounts = {
  subtotal?: number | string | null;
  taxAmount?: number | string | null;
  advancePayment?: number | string | null;
};

/** Invoice print net total; receipts do not change the face amount of the invoice. */
export function getInvoicePrintNetTotal(invoice: InvoicePrintAmounts): number {
  const amount = (value: number | string | null | undefined): number => {
    const number = Number(value ?? 0);
    return Number.isFinite(number) ? number : 0;
  };
  const net = amount(invoice.subtotal) + amount(invoice.taxAmount) - amount(invoice.advancePayment);
  return Math.round((net + Number.EPSILON) * 100) / 100;
}

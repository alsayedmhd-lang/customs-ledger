export function invoiceQueryId(search: string, hash: string): number {
  const hashQuery = hash.includes("?") ? hash.slice(hash.indexOf("?") + 1) : "";
  const value = new URLSearchParams(hashQuery).get("invoice") ?? new URLSearchParams(search).get("invoice");
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : 0;
}

export function invoiceReceiptAmount(invoice: { subtotal?: unknown; taxAmount?: unknown; total?: unknown; advancePayment?: unknown }): number {
  const gross = Number(invoice.subtotal ?? 0) + Number(invoice.taxAmount ?? 0);
  const amount = gross > 0 ? gross - Number(invoice.advancePayment ?? 0) : Number(invoice.total ?? 0);
  return Number.isFinite(amount) ? Math.max(0, Math.round(amount * 100) / 100) : 0;
}

export async function lookupReceiptPath(invoiceId: number, baseUrl: string, token: string | null, request: typeof fetch = fetch): Promise<string> {
  if (!Number.isSafeInteger(invoiceId) || invoiceId <= 0) throw new Error("Invalid invoice id");
  const response = await request(`${baseUrl}/api/receipts/by-invoice/${invoiceId}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  if (!response.ok) throw new Error(`Receipt lookup failed with status ${response.status}`);
  const receipt = await response.json();
  if (receipt === null) return `/receipts/new?invoice=${invoiceId}`;
  const id = Number(receipt?.id);
  if (!Number.isSafeInteger(id) || id <= 0) throw new Error("Invalid receipt response");
  return `/receipts/${id}/edit`;
}

export type PendingInvoiceAttachment = {
  key: string;
  filePath: string;
  fileName: string;
  size: number;
  extension: string;
  category: string;
  selectedBase: string;
  storedName: string;
  savedBase?: string;
  savedFile?: { ok: boolean; relativePath?: string; storedName?: string; fileHash?: string; error?: string };
  error?: string;
};
export type AttachmentSaveContext = { invoiceId: number; declarationNumber: string; declarationBaseNumber: string };
export function attachmentDeclarationBase(value: string): string {
  return value.replace(/^\s*\(\d+\)\s*/, "").replace(/[^a-zA-Z0-9]/g, "").slice(0, 14);
}

// File copy and metadata registration are retryable independently. Never creates an invoice.
export async function persistPendingInvoiceAttachments(
  entries: PendingInvoiceAttachment[],
  context: AttachmentSaveContext,
  dependencies: {
    saveFile: (input: { sourcePath: string; declarationBaseNumber: string; storedName: string }) => Promise<NonNullable<PendingInvoiceAttachment["savedFile"]>>;
    registerFile: (body: Record<string, unknown>) => Promise<void>;
  },
  change: (key: string, entry: PendingInvoiceAttachment | null) => void,
): Promise<boolean> {
  if (!Number.isSafeInteger(context.invoiceId) || context.invoiceId <= 0 || !/^[a-zA-Z0-9]{14}$/.test(context.declarationBaseNumber)) {
    throw new Error("Invalid saved invoice or declaration number");
  }
  let complete = true;
  for (const original of entries) {
    let entry = { ...original, error: undefined };
    try {
      if (!entry.savedFile || entry.savedBase !== context.declarationBaseNumber) {
        const saved = await dependencies.saveFile({ sourcePath: entry.filePath, declarationBaseNumber: context.declarationBaseNumber, storedName: entry.storedName });
        if (!saved.ok || !saved.relativePath || !saved.fileHash) throw new Error(saved.error || "Unable to save attachment");
        entry = { ...entry, savedFile: saved, savedBase: context.declarationBaseNumber };
        change(entry.key, entry);
      }
      const saved = entry.savedFile!;
      await dependencies.registerFile({
        ...context, fileName: entry.fileName, storedName: saved.storedName || entry.storedName,
        relativePath: saved.relativePath, fileHash: saved.fileHash, mimeType: entry.extension,
        fileSize: entry.size, category: entry.category,
      });
      change(entry.key, null);
    } catch (error) {
      complete = false;
      change(entry.key, { ...entry, error: error instanceof Error ? error.message : String(error) });
    }
  }
  return complete;
}

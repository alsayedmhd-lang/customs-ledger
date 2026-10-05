export const settingsAccessGroups = [
  { id: "company", ar: "بيانات الشركة", en: "Company", parts: [
    ["name", "اسم الشركة", "Company name"], ["identity", "الترجمة والوصف", "Subtitle and tagline"],
    ["contact", "معلومات التواصل", "Contact information"], ["legal", "السجل والضريبة", "Registration and tax"]] },
  { id: "branding", ar: "الشعارات والتوقيعات", en: "Branding and signatures", parts: [
    ["logo", "الشعار وحجمه", "Logo and size"], ["stamp", "الختم", "Stamp"],
    ["watermark", "العلامة المائية", "Watermark"], ["accountant", "توقيع المحاسب", "Accountant signature"],
    ["receiver", "توقيع المستلم", "Receiver signature"]] },
  { id: "print", ar: "أدوات الطباعة", en: "Print tools", parts: [
    ["invoice", "طباعة الفاتورة", "Invoice printing"], ["receipt", "طباعة سند القبض", "Receipt printing"],
    ["statement", "طباعة كشف الحساب", "Statement printing"], ["customerLedger", "طباعة ملخص العميل", "Customer summary printing"],
    ["footer", "نص التذييل", "Footer text"], ["printOptions", "إظهار الختم والعلامة المائية", "Stamp and watermark visibility"]] },
  { id: "backup", ar: "النسخ الاحتياطي", en: "Backup", parts: [] },
  { id: "update", ar: "تحديث البرنامج", en: "Software update", parts: [] },
  { id: "preview", ar: "المعاينة", en: "Preview", parts: [] },
  { id: "display", ar: "المظهر", en: "Appearance", parts: [] },
] as const;
export type SettingsAccess = { version: 1; tabs: Record<string, boolean>; edit: Record<string, boolean> };
export function parseSettingsAccess(value: unknown): SettingsAccess | null {
  if (value == null || value === "") return null;
  const data = typeof value === "string" ? JSON.parse(value) : value;
  if (!data || typeof data !== "object") throw new Error("Invalid settings access policy");
  const p = data as SettingsAccess;
  if (p.version !== 1 || !p.tabs || !p.edit) throw new Error("Invalid settings access policy");
  const tabs: Record<string, boolean> = {}, edit: Record<string, boolean> = {};
  for (const g of settingsAccessGroups) {
    if (typeof p.tabs[g.id] !== "boolean") throw new Error("Invalid settings tab permission");
    tabs[g.id] = p.tabs[g.id];
    for (const [id] of g.parts) {
      if (typeof p.edit[id] !== "boolean") throw new Error("Invalid settings field permission");
      edit[id] = p.edit[id];
    }
  }
  return { version: 1, tabs, edit };
}
export function defaultSettingsAccess(): SettingsAccess {
  return { version: 1, tabs: Object.fromEntries(settingsAccessGroups.map(g => [g.id, true])),
    edit: Object.fromEntries(settingsAccessGroups.flatMap(g => g.parts.map(([id]) => [id, true]))) };
}
export function settingsFieldAccess(key: string): [string, string] | null {
  if (["nameAr", "nameEn"].includes(key)) return ["company", "name"];
  if (["subtitleAr", "subtitleEn", "taglineAr", "taglineEn"].includes(key)) return ["company", "identity"];
  if (["email", "phone", "address", "poBox", "website"].includes(key)) return ["company", "contact"];
  if (["crNumber", "taxNumber"].includes(key)) return ["company", "legal"];
  if (["logoBase64", "logoSize", "logoHeight"].includes(key)) return ["branding", "logo"];
  if (key === "stampBase64") return ["branding", "stamp"];
  if (key === "watermarkBase64") return ["branding", "watermark"];
  if (["accountantSignatureBase64", "showAccountantSignature"].includes(key)) return ["branding", "accountant"];
  if (["receiverSignatureBase64", "showReceiverSignature"].includes(key)) return ["branding", "receiver"];
  if (key === "footerText") return ["print", "footer"];
  if (key === "showWatermark" || key.startsWith("showStampOn")) return ["print", "printOptions"];
  for (const prefix of ["invoice", "receipt", "statement", "customerLedger"]) {
    if (key.startsWith(prefix)) return ["print", prefix];
  }
  return null;
}
export function canChangeSettingsField(policy: SettingsAccess | null, key: string): boolean {
  const group = settingsFieldAccess(key);
  return !policy || !group || (policy.tabs[group[0]] === true && policy.edit[group[1]] === true);
}

import { useEffect, useState } from "react";
import { Download, Upload, Eye, EyeOff, ShieldCheck, FilePlus2 } from "lucide-react";
import { PasswordInput } from "./ui/password-input";

type Kind = "request" | "response";
type Transfer = { format: "ledger-device-pairing"; version: 3; kind: Kind; payload: unknown };
export default function DevicePairingPanel({ isAR, pairingEnabled }: { isAR: boolean; pairingEnabled: boolean }) {
  const api = window.electronAPI;
  const tr = (ar: string, en: string) => isAR ? ar : en;
  const [outgoing, setOutgoing] = useState<Transfer | null>(null);
  const [pending, setPending] = useState<Transfer | null>(null);
  const [fingerprint, setFingerprint] = useState("");
  const [name, setName] = useState("");
  const [showFile, setShowFile] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [failed, setFailed] = useState(false);
  const [devices, setDevices] = useState<Array<{ deviceId: string; name: string | null; trustedAt: string; revokedAt: string | null }>>([]);
  const refresh = async () => {
    if (!api?.listTrustedLedgerDevices) throw Error(tr("يتطلب تطبيق Ledger المكتبي", "Ledger Desktop is required"));
    setDevices((await api.listTrustedLedgerDevices()).filter(d => !d.revokedAt));
  };
  useEffect(() => {
    let mounted = true;
    void api?.listTrustedLedgerDevices?.().then(v => { if (mounted) setDevices(v.filter(d => !d.revokedAt)); }).catch(e => { if (mounted) { setFailed(true); setStatus(String(e)); } });
    return () => { mounted = false; };
  }, [api]);
  const run = async (action: () => Promise<string>) => {
    setBusy(true); setFailed(false); setStatus("");
    try { setStatus(await action()); } catch (e) { setFailed(true); setStatus(tr("تعذر إتمام الخطوة. استخدم الملف الصحيح ضمن مهلة الطلب؛ عند انتهاء المهلة ابدأ بطلب جديد. ", "Step failed. Use the correct file within the request lifetime; restart if expired. ") + (e instanceof Error ? e.message : String(e))); } finally { setBusy(false); }
  };
  const invoke = async (action: "create-simple" | "approve-request" | "approve-response", payload?: unknown, fp?: string, deviceName?: string) => {
    if (!api?.mutualDevicePairing) throw Error(tr("ثبّت التحديث على الجهازين أولًا", "Install the update on both devices first"));
    return api.mutualDevicePairing(action, payload, fp, deviceName);
  };
  const output = (kind: Kind, payload: unknown) => { setOutgoing({ format: "ledger-device-pairing", version: 3, kind, payload }); setShowFile(false); };
  const load = () => void run(async () => {
    if (!api?.importDevicePairingFile) throw Error("File import unavailable");
    const file = await api.importDevicePairingFile(); if (!file) return tr("تم إلغاء الاستيراد", "Import canceled");
    if (file.version !== 3 || !["request", "response"].includes(file.kind)) throw Error(tr("هذا ملف من التسلسل السابق. حدّث الجهازين وأنشئ طلبًا جديدًا.", "Legacy pairing file. Update both devices and create a new request."));
    setPending(file as Transfer); setOutgoing(null); setFingerprint(""); setName("");
    return tr("تم التعرف على الملف تلقائيًا. قارن بصمة الجهاز الآخر من شاشة هويته ثم اعتمده أدناه.", "File recognized automatically. Compare the other device fingerprint from its identity screen and approve below.");
  });
  const save = (kind: Kind) => void run(async () => {
    if (!api?.exportDevicePairingFile || outgoing?.kind !== kind) throw Error("No file to export");
    const result = await api.exportDevicePairingFile(outgoing);
    return result.canceled ? tr("تم إلغاء التصدير", "Export canceled") : tr("تم تصدير الملف؛ انقله للجهاز الآخر.", "File exported; transfer it to the other device.");
  });
  const cls = "inline-flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed";
  const labels: Record<Kind, string> = { request: tr("الطلب", "Request"), response: tr("الرد", "Response") };
  const exportButton = (kind: Kind) => <button type="button" className={cls} disabled={busy || !pairingEnabled || outgoing?.kind !== kind} onClick={() => save(kind)}><Download className="h-4 w-4" />{tr("تصدير ", "Export ")}{labels[kind]}</button>;
  const rows = [
    { text: tr("١. الجهاز الأول: أنشئ الطلب الموقّع وصدّره للجهاز الثاني.", "1. First device: create and export the signed request to the second device."), buttons: <><button type="button" className={cls} disabled={busy || !pairingEnabled} onClick={() => void run(async () => { const result = await invoke("create-simple"); output("request", result); setPending(null); setFingerprint(""); setName(""); return tr("الطلب جاهز للتصدير.", "Request ready to export."); })}><FilePlus2 className="h-4 w-4" />{tr("إنشاء طلب", "Create request")}</button>{exportButton("request")}</> },
    { text: tr("٢. الجهاز الثاني: حمّل الطلب وقارن البصمة واعتمد، ثم صدّر الرد للأول. على الأول حمّل الرد وقارن البصمة واعتمد لإكمال توثيق الجهازين.", "2. Second device: import the request, compare the fingerprint and approve, then export the response. First device: import that response, compare the fingerprint and approve to complete mutual trust."), buttons: <><button type="button" className={cls} disabled={busy || !pairingEnabled} onClick={load}><Upload className="h-4 w-4" />{tr("تحميل ملف الطرف الآخر", "Import other device file")}</button>{exportButton("response")}</> },
  ];
  return <div className="space-y-3 border-t pt-4">
    <h3 className="flex items-center gap-2 font-semibold"><ShieldCheck className="h-4 w-4" />{tr("توثيق الجهازين في خطوتين", "Pair both devices in two steps")}</h3>
    <ol className="space-y-2 rounded-lg border bg-muted/20 p-3">{rows.map((row, i) => <li key={i} className="flex min-w-0 flex-wrap items-center justify-between gap-2 border-b pb-2 last:border-0 last:pb-0"><p className="min-w-0 flex-1 text-[13px] leading-5">{row.text}</p><div className="flex flex-wrap gap-2">{row.buttons}</div></li>)}</ol>
    <p className="text-xs text-muted-foreground">{tr("حدّث الجهازين. أكمل التسلسل خلال خمس دقائق من إنشاء الطلب وأبقِ البرنامج مفتوحًا. لا يلزم تكرار الخطوات بالعكس. الملفات لا تحتوي على المفتاح الخاص.", "Update both devices. Complete within five minutes of creating the request and keep Ledger open. No reverse sequence is needed. Files contain no private key.")}</p>
    {!pairingEnabled && <p className="text-xs text-muted-foreground">{tr("يتطلب الربط اتصالًا بقاعدة Online أو السيرفر الداخلي.", "Pairing requires an Online or Internal Server connection.")}</p>}
    {pending && <div className="grid gap-3 rounded-lg border p-3 sm:grid-cols-2">
      <label className="space-y-1 text-xs"><span>{tr("بصمة الجهاز الآخر — انقلها من شاشة هويته بعد المقارنة", "Other device fingerprint — compare and copy from its identity screen")}</span><PasswordInput isAR={isAR} autoComplete="off" value={fingerprint} onChange={e => setFingerprint(e.target.value)} /></label>
      <label className="space-y-1 text-xs"><span>{tr("اسم الجهاز (اختياري)", "Device name (optional)")}</span><input className="w-full rounded border bg-background p-2" maxLength={100} value={name} onChange={e => setName(e.target.value)} /></label>
      <button type="button" className={cls} disabled={busy || !pairingEnabled || !fingerprint.trim()} onClick={() => void run(async () => {
        const isRequest = pending.kind === "request";
        const result = await invoke(isRequest ? "approve-request" : "approve-response", pending.payload, fingerprint.trim(), name.trim() || undefined);
        if (isRequest) output("response", result); else setOutgoing(null); setPending(null); setFingerprint(""); setName(""); await refresh();
        return isRequest ? tr("تم اعتماد الجهاز الأول. صدّر الرد وأعده إليه لإكمال توثيق الجهازين.", "First device trusted. Export the response and return it to complete mutual pairing.") : tr("اكتمل التوثيق المتبادل للجهازين.", "Mutual device pairing is complete.");
      })}><ShieldCheck className="h-4 w-4" />{tr("اعتماد بعد مقارنة البصمة", "Approve after comparing fingerprint")}</button>
    </div>}
    {outgoing && <div className="rounded-lg border p-3"><div className="flex items-center justify-between text-sm"><span>{labels[outgoing.kind]}</span><button type="button" className={cls} aria-expanded={showFile} aria-label={tr("إظهار أو إخفاء محتوى الملف", "Toggle file contents")} onClick={() => setShowFile(v => !v)}>{showFile ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></div>{showFile && <pre dir="ltr" className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-all text-xs">{JSON.stringify(outgoing, null, 2)}</pre>}</div>}
    {status && <p role={failed ? "alert" : "status"} className={`text-xs ${failed ? "text-destructive" : "text-muted-foreground"}`}>{status}</p>}
    <div className="space-y-2 rounded-lg border p-3"><div className="flex items-center justify-between"><h4 className="text-sm font-semibold">{tr("الأجهزة الموثوقة", "Trusted devices")}</h4><button type="button" className="text-xs underline" disabled={busy} onClick={() => void run(async () => { await refresh(); return tr("تم تحديث القائمة", "List refreshed"); })}>{tr("تحديث", "Refresh")}</button></div>{!devices.length && <p className="text-xs text-muted-foreground">{tr("لا توجد أجهزة معتمدة.", "No trusted devices.")}</p>}<div className="grid gap-2 sm:grid-cols-2">{devices.map(d => <div key={d.deviceId} className="rounded border p-2 text-xs"><p className="font-semibold">{d.name || tr("جهاز Ledger", "Ledger device")}</p><p dir="ltr" className="break-all">{d.deviceId}</p><p>{new Date(d.trustedAt).toLocaleString(isAR ? "ar-QA" : "en-GB")}</p></div>)}</div></div>
  </div>;
}

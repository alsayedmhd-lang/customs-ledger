import { useEffect, useState } from "react";
import { Download, Upload, Eye, EyeOff, ShieldCheck, FilePlus2 } from "lucide-react";

type TransferKind = "request" | "response" | "proof";
type Transfer = { format: "ledger-device-pairing"; version: 1; kind: TransferKind; payload: unknown };

export default function DevicePairingPanel({ isAR, pairingEnabled }: { isAR: boolean; pairingEnabled: boolean }) {
  const api = window.electronAPI;
  const tr = (ar: string, en: string) => isAR ? ar : en;
  const [outgoing, setOutgoing] = useState<Transfer | null>(null);
  const [response, setResponse] = useState<unknown>(null);
  const [proof, setProof] = useState<unknown>(null);
  const [fingerprint, setFingerprint] = useState("");
  const [name, setName] = useState("");
  const [showFingerprint, setShowFingerprint] = useState(false);
  const [showFile, setShowFile] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [failed, setFailed] = useState(false);
  const [trustedDevices, setTrustedDevices] = useState<Array<{
    deviceId: string; name: string | null; trustedAt: string; revokedAt: string | null;
  }>>([]);

  const refresh = async () => {
    if (!api?.listTrustedLedgerDevices) throw Error(tr("هذه الميزة متاحة في تطبيق Ledger المكتبي", "Ledger Desktop is required"));
    setTrustedDevices((await api.listTrustedLedgerDevices()).filter(d => !d.revokedAt));
  };
  useEffect(() => {
    let mounted = true;
    void api?.listTrustedLedgerDevices?.().then(devices => {
      if (mounted) setTrustedDevices(devices.filter(d => !d.revokedAt));
    }).catch(e => { if (mounted) { setFailed(true); setStatus(String(e)); } });
    return () => { mounted = false; };
  }, [api]);

  const run = async (action: () => Promise<string>) => {
    setBusy(true); setStatus(""); setFailed(false);
    try { setStatus(await action()); }
    catch (e) {
      setFailed(true);
      const message = e instanceof Error ? e.message : String(e);
      setStatus(isAR ? `تعذر إتمام العملية. تحقق من نوع الملف وصلاحيته وأعد إنشاء الطلب عند انتهاء المهلة. (${message})` : message);
    } finally { setBusy(false); }
  };
  const transfer = (kind: TransferKind, payload: unknown): Transfer => ({ format: "ledger-device-pairing", version: 1, kind, payload });
  const kindLabel = (kind: TransferKind) => kind === "request" ? tr("طلب التوثيق", "Pairing request") : kind === "response" ? tr("رد التوثيق", "Pairing response") : tr("إثبات الجهاز", "Device proof");
  const buttonClass = "inline-flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50";

  const importStep = (expectedKind: TransferKind) => void run(async () => {
          if (!api?.importDevicePairingFile) throw Error(tr("واجهة استيراد الملفات غير متاحة", "File import unavailable"));
          const file = await api.importDevicePairingFile();
          if (!file) return tr("تم إلغاء الاستيراد", "Import canceled");
          if (file.kind !== expectedKind) throw Error(tr("نوع الملف لا يطابق هذه الخطوة", "File type does not match this step"));
          if (file.kind === "request") {
            if (!api.receiveDevicePairingRequest) throw Error("Bridge unavailable");
            const value = await api.receiveDevicePairingRequest(file.payload);
            setResponse(value); setProof(null); setFingerprint("");
            setOutgoing(transfer("response", value));
          } else if (file.kind === "response") {
            if (!api.signDevicePairingResponse) throw Error("Bridge unavailable");
            const value = await api.signDevicePairingResponse(file.payload);
            setOutgoing(transfer("proof", value)); setResponse(null); setProof(null);
          } else {
            if (!response) throw Error(tr("استورد الطلب على هذا الجهاز أولًا. عند إعادة تشغيل البرنامج، ابدأ بطلب جديد.", "Import the request on this device first. After restarting Ledger, begin with a new request."));
            setProof(file.payload); setOutgoing(null);
          }
          setShowFile(false);
          return file.kind === "proof" ? tr("تم استيراد الإثبات. قارن البصمة ثم اعتمد الجهاز.", "Proof imported. Compare the fingerprint and approve the device.") : tr("تم الاستيراد وتجهيز الملف التالي للتصدير.", "Imported. The next file is ready to export.");
  });
  const exportStep = (expectedKind: TransferKind) => void run(async () => {
          if (!api?.exportDevicePairingFile || !outgoing || outgoing.kind !== expectedKind) throw Error(tr("لا يوجد ملف للتصدير", "No file to export"));
          const result = await api.exportDevicePairingFile(outgoing);
          return result.canceled ? tr("تم إلغاء التصدير", "Export canceled") : tr("تم تصدير الملف", "File exported");
  });

  return (
    <div className="space-y-3 border-t pt-4">
      <h3 className="flex items-center gap-2 font-semibold"><ShieldCheck className="h-4 w-4" />{tr("توثيق الأجهزة بالملفات", "Pair devices using files")}</h3>
      <ol className="space-y-2 rounded-lg border border-border bg-muted/20 p-3">
        <li className="flex min-w-0 flex-wrap items-center justify-between gap-2 border-b border-border/50 pb-2 last:border-0 last:pb-0"><p className="min-w-0 flex-1 text-[13px] leading-5">{tr("١. على الجهاز الأول: أنشئ الطلب ثم صدّره وانقله للجهاز الثاني.", "1. First device: create and export the request, then transfer it to the second device.")}</p><div className="flex shrink-0 flex-wrap gap-2"><button type="button" disabled={busy || !pairingEnabled} className={buttonClass} onClick={() => void run(async () => {
          if (!api?.createDevicePairingRequest) throw Error(tr("واجهة التطبيق غير متاحة", "Bridge unavailable"));
          const payload = await api.createDevicePairingRequest();
          setOutgoing(transfer("request", payload)); setResponse(null); setProof(null); setFingerprint(""); setShowFile(false);
          return tr("تم إنشاء الطلب. صدّر الملف وانقله للجهاز الآخر.", "Request created. Export the file and transfer it to the other device.");
        })}><FilePlus2 className="h-4 w-4" />{tr("إنشاء طلب", "Create request")}</button><button type="button" disabled={busy || !pairingEnabled || outgoing?.kind !== "request"} className={buttonClass} onClick={() => exportStep("request") }><Download className="h-4 w-4" />{tr("تصدير الطلب", "Export request")}</button></div></li>
        <li className="flex min-w-0 flex-wrap items-center justify-between gap-2 border-b border-border/50 pb-2 last:border-0 last:pb-0"><p className="min-w-0 flex-1 text-[13px] leading-5">{tr("٢. على الجهاز الثاني: حمّل الطلب ثم صدّر الرد للجهاز الأول.", "2. Second device: import the request and export the response to the first device.")}</p><div className="flex shrink-0 flex-wrap gap-2"><button type="button" disabled={busy || !pairingEnabled} className={buttonClass} onClick={() => importStep("request") }><Upload className="h-4 w-4" />{tr("تحميل الطلب", "Import request")}</button><button type="button" disabled={busy || !pairingEnabled || outgoing?.kind !== "response"} className={buttonClass} onClick={() => exportStep("response") }><Download className="h-4 w-4" />{tr("تصدير الرد", "Export response")}</button></div></li>
        <li className="flex min-w-0 flex-wrap items-center justify-between gap-2 border-b border-border/50 pb-2 last:border-0 last:pb-0"><p className="min-w-0 flex-1 text-[13px] leading-5">{tr("٣. على الجهاز الأول: حمّل الرد ثم صدّر الإثبات للجهاز الثاني.", "3. First device: import the response and export the proof to the second device.")}</p><div className="flex shrink-0 flex-wrap gap-2"><button type="button" disabled={busy || !pairingEnabled} className={buttonClass} onClick={() => importStep("response") }><Upload className="h-4 w-4" />{tr("تحميل الرد", "Import response")}</button><button type="button" disabled={busy || !pairingEnabled || outgoing?.kind !== "proof"} className={buttonClass} onClick={() => exportStep("proof") }><Download className="h-4 w-4" />{tr("تصدير الإثبات", "Export proof")}</button></div></li>
        <li className="flex min-w-0 flex-wrap items-center justify-between gap-2 border-b border-border/50 pb-2 last:border-0 last:pb-0"><p className="min-w-0 flex-1 text-[13px] leading-5">{tr("٤. على الجهاز الثاني: حمّل الإثبات، ثم قارن البصمة واعتمد الجهاز من الحقول أدناه.", "4. Second device: import the proof, then compare the fingerprint and approve using the fields below.")}</p><div className="flex shrink-0 flex-wrap gap-2"><button type="button" disabled={busy || !pairingEnabled || !response} className={buttonClass} onClick={() => importStep("proof") }><Upload className="h-4 w-4" />{tr("تحميل الإثبات", "Import proof")}</button></div></li>
      </ol>
      <p className="text-xs text-muted-foreground">{tr("الملفات صالحة لمدة خمس دقائق ولا تحتوي على المفتاح الخاص. كرر الخطوات بالعكس لتوثيق الجهازين بصورة متبادلة. أبقِ البرنامج مفتوحًا أثناء العملية.", "Files are valid for five minutes and contain no private key. Repeat in reverse for mutual trust. Keep Ledger open throughout pairing.")}</p>
      {!pairingEnabled && <p className="text-sm text-muted-foreground">{tr("يتطلب الربط اتصالًا بقاعدة Online أو السيرفر الداخلي.", "Pairing requires an Online or Internal Server connection.")}</p>}

      {outgoing && <div className="rounded-lg border p-3">
        <div className="flex items-center justify-between gap-2 text-sm"><span>{kindLabel(outgoing.kind)}</span>
          <button type="button" className={buttonClass} aria-expanded={showFile} aria-label={showFile ? tr("إخفاء محتوى الملف", "Hide file contents") : tr("إظهار محتوى الملف", "Show file contents")} onClick={() => setShowFile(v => !v)}>{showFile ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>
        </div>
        {showFile && <pre dir="ltr" className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-all text-xs">{JSON.stringify(outgoing, null, 2)}</pre>}
      </div>}
      {response != null && <div className="grid gap-3 rounded-lg border p-3 sm:grid-cols-2">
        <label className="space-y-1 text-xs"><span>{tr("بصمة الجهاز الآخر — انقلها من شاشة هويته بعد المقارنة", "Other device fingerprint — compare and copy from its identity screen")}</span>
          <span className="relative block"><input dir="ltr" type={showFingerprint ? "text" : "password"} autoComplete="off" value={fingerprint} onChange={e => setFingerprint(e.target.value)} className="w-full rounded border bg-background p-2 pe-10 text-xs" />
            <button type="button" className="absolute end-2 top-2" aria-pressed={showFingerprint} aria-label={showFingerprint ? tr("إخفاء البصمة", "Hide fingerprint") : tr("إظهار البصمة", "Show fingerprint")} onClick={() => setShowFingerprint(v => !v)}>{showFingerprint ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>
          </span>
        </label>
        <label className="space-y-1 text-xs"><span>{tr("اسم الجهاز (اختياري)", "Device name (optional)")}</span><input maxLength={100} value={name} onChange={e => setName(e.target.value)} className="w-full rounded border bg-background p-2 text-sm" /></label>
        <button type="button" disabled={busy || !proof || !fingerprint.trim() || !pairingEnabled} className={buttonClass} onClick={() => void run(async () => {
          if (!api?.completeDevicePairing) throw Error("Bridge unavailable");
          await api.completeDevicePairing(response, proof, fingerprint.trim(), name.trim() || undefined);
          setResponse(null); setProof(null); setFingerprint(""); setName(""); setOutgoing(null);
          await refresh();
          return tr("تم اعتماد الجهاز. كرر الخطوات بالعكس لاعتماد الجهاز الثاني.", "Device approved. Repeat in reverse to approve the other device.");
        })}><ShieldCheck className="h-4 w-4" />{tr("اعتماد الجهاز بعد مقارنة البصمة", "Approve after comparing fingerprint")}</button>
      </div>}
      {status && <p role={failed ? "alert" : "status"} className={`text-xs ${failed ? "text-destructive" : "text-muted-foreground"}`}>{status}</p>}
      <div className="space-y-2 rounded-lg border p-3">
        <div className="flex items-center justify-between"><h4 className="text-sm font-semibold">{tr("الأجهزة الموثوقة", "Trusted devices")}</h4><button type="button" disabled={busy} className="text-xs underline" onClick={() => void run(async () => { await refresh(); return tr("تم تحديث القائمة", "List refreshed"); })}>{tr("تحديث", "Refresh")}</button></div>
        {trustedDevices.length === 0 && <p className="text-xs text-muted-foreground">{tr("لا توجد أجهزة معتمدة.", "No trusted devices.")}</p>}
        <div className="grid gap-2 sm:grid-cols-2">{trustedDevices.map(device => <div key={device.deviceId} className="rounded border p-2 text-xs"><p className="font-semibold">{device.name || tr("جهاز Ledger", "Ledger device")}</p><p dir="ltr" className="break-all">{device.deviceId}</p><p>{new Date(device.trustedAt).toLocaleString(isAR ? "ar-QA" : "en-GB")}</p></div>)}</div>
      </div>
    </div>
  );
}

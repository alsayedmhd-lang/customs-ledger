import { useEffect, useState } from "react";
export default function DevicePeerAddresses({ isAR }: { isAR: boolean }) {
  const [items, setItems] = useState<Array<{ deviceId: string; name: string | null; address: string }>>([]);
  const [message, setMessage] = useState("");
  const refresh = async () => setItems(await window.electronAPI?.listPeerEndpoints?.() || []);
  useEffect(() => { void refresh().catch(() => undefined); }, []);
  return <div className="space-y-3 rounded-lg border p-3">
    <p className="text-sm font-semibold">{isAR ? "عناوين الأجهزة الموثوقة (LAN)" : "Trusted device LAN addresses"}</p>
    <p className="text-xs text-muted-foreground">{isAR ? "أدخل IP والمنفذ لكل جهاز بعد اعتماد الربط المتبادل، مثل 192.168.1.20:3000" : "After mutual pairing, enter each device's IP and port, e.g. 192.168.1.20:3000"}</p>
    {items.map(item => <div key={item.deviceId} className="flex flex-wrap gap-2 items-center">
      <span className="text-xs break-all">{item.name || item.deviceId}</span>
      <input dir="ltr" className="rounded border bg-background p-2 text-xs" value={item.address} placeholder="192.168.1.20:3000"
        onChange={e => setItems(rows => rows.map(row => row.deviceId === item.deviceId ? { ...row, address: e.target.value } : row))}/>
      <button type="button" className="rounded border p-2 text-xs" onClick={() => void (async () => {
        try { await window.electronAPI?.setPeerEndpoint?.(item.deviceId, item.address); setMessage(isAR ? "تم الحفظ" : "Saved"); await refresh(); }
        catch(e) { setMessage(String(e)); }
      })()}>{isAR ? "حفظ العنوان" : "Save address"}</button>
    </div>)}
    <button type="button" className="text-xs underline" onClick={() => void refresh()}>{isAR ? "تحديث القائمة" : "Refresh"}</button>
    {message && <p role="status" className="text-xs">{message}</p>}
  </div>;
}

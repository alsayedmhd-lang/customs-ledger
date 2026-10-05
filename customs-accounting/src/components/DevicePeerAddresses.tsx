import { useEffect, useState } from "react";

type Channel = "lan" | "netbird";
type Peer = { deviceId: string; name: string | null; address: string };
type PeerAPI = {
  listPeerEndpoints: (channel?: Channel) => Promise<Peer[]>;
  setPeerEndpoint: (deviceId: string, address: string, channel?: Channel) => Promise<unknown>;
  testPeerEndpoint?: (deviceId: string, address: string, channel?: Channel) => Promise<{ ok: boolean; error: string | null }>;
};

function PeerAddressCard({ isAR, channel }: { isAR: boolean; channel: Channel }) {
  const [items, setItems] = useState<Peer[]>([]);
  const [messages, setMessages] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const vpn = channel === "netbird";
  const api = () => {
    const value = window.electronAPI as unknown as PeerAPI | undefined;
    if (!value?.listPeerEndpoints || !value.setPeerEndpoint) {
      throw new Error(isAR ? "هذه الخاصية متاحة داخل برنامج Ledger المكتبي." : "This feature requires the Ledger desktop app.");
    }
    return value;
  };
  const refresh = async () => {
    setError("");
    try { setItems(await api().listPeerEndpoints(channel)); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  };
  useEffect(() => { void refresh(); }, [channel]);

  const perform = async (item: Peer, action: "save" | "test") => {
    setBusy(item.deviceId);
    setMessages(rows => ({ ...rows, [item.deviceId]: "" }));
    try {
      if (action === "save") {
        await api().setPeerEndpoint(item.deviceId, item.address, channel);
        setMessages(rows => ({ ...rows, [item.deviceId]: isAR ? "تم حفظ العنوان" : "Address saved" }));
      } else {
        const test = api().testPeerEndpoint;
        if (!test) throw new Error(isAR ? "شغّل النسخة الجديدة لاختبار الاتصال." : "Restart with the updated app to test connections.");
        const result = await test(item.deviceId, item.address, channel);
        const message = result.ok
          ? (isAR ? "المنفذ متاح. يُتحقق من هوية الجهاز عند جلب المرفق." : "Port reachable. Device identity is verified when fetching an attachment.")
          : (isAR ? `تعذر الوصول إلى المنفذ: ${result.error}` : `Port unavailable: ${result.error}`);
        setMessages(rows => ({ ...rows, [item.deviceId]: message }));
      }
    } catch (e) {
      setMessages(rows => ({ ...rows, [item.deviceId]: e instanceof Error ? e.message : String(e) }));
    } finally { setBusy(null); }
  };

  return <div className="min-w-0 space-y-3 rounded-lg border p-4">
    <p className="text-sm font-semibold">{vpn
      ? (isAR ? "اتصال الأجهزة عبر الإنترنت (Web)" : "Device connection via Internet (Web)")
      : (isAR ? "اتصال الأجهزة عبر الشبكة المحلية (LAN)" : "Device connection via local network (LAN)")}</p>
    <p className="text-xs text-muted-foreground">{vpn
      ? (isAR ? "أدخل عنوان VPN للجهاز الآخر ومنفذ Ledger. يُحفظ مستقلاً عن عنوان الشبكة المحلية." : "Enter the other device's VPN IP and Ledger port. Saved separately from its LAN address.")
      : (isAR ? "أدخل عنوان الجهاز الآخر ومنفذ Ledger داخل الشبكة المحلية بعد اعتماد الربط المتبادل." : "After mutual pairing, enter the other device's local IP and Ledger port.")}</p>
    {!error && !items.length && <p className="text-xs text-muted-foreground">{isAR ? "لا توجد أجهزة موثوقة. اعتمد الربط المتبادل أولاً." : "No trusted devices. Complete mutual pairing first."}</p>}
    {items.map(item => <div key={item.deviceId} className="space-y-2 rounded border p-3">
      <p className="break-all text-xs font-medium">{item.name || item.deviceId}</p>
      <input dir="ltr" aria-label={`${vpn ? "Web" : "LAN"}: ${item.name || item.deviceId}`}
        className="w-full rounded border bg-background p-2 text-sm" value={item.address}
        placeholder={vpn ? "100.112.250.198:3000" : "192.168.1.20:3000"}
        disabled={busy !== null}
        onChange={e => {
          setItems(rows => rows.map(row => row.deviceId === item.deviceId ? { ...row, address: e.target.value } : row));
          setMessages(rows => ({ ...rows, [item.deviceId]: "" }));
        }} />
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={busy !== null} className="rounded border px-3 py-2 text-xs disabled:opacity-50"
          onClick={() => void perform(item, "save")}>{isAR ? "حفظ العنوان" : "Save address"}</button>
        <button type="button" disabled={busy !== null || !item.address.trim()} className="rounded border px-3 py-2 text-xs disabled:opacity-50"
          onClick={() => void perform(item, "test")}>{busy === item.deviceId ? (isAR ? "جارٍ التنفيذ…" : "Working…") : (isAR ? "اختبار الاتصال" : "Test connection")}</button>
      </div>
      {messages[item.deviceId] && <p role="status" className="break-words text-xs">{messages[item.deviceId]}</p>}
    </div>)}
    <button type="button" disabled={busy !== null} className="text-xs underline disabled:opacity-50" onClick={() => void refresh()}>{isAR ? "تحديث القائمة" : "Refresh list"}</button>
    {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
  </div>;
}

export default function DevicePeerAddresses({ isAR }: { isAR: boolean }) {
  return <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
    <PeerAddressCard isAR={isAR} channel="lan" />
    <PeerAddressCard isAR={isAR} channel="netbird" />
  </div>;
}

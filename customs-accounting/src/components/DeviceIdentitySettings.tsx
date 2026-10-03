import DevicePairingPanel from "./DevicePairingPanel";
import DevicePeerAddresses from "./DevicePeerAddresses";
import { useEffect, useState } from "react";
import { Copy, Eye, EyeOff, Fingerprint, RefreshCw } from "lucide-react";

type DeviceIdentityInfo = {
  deviceId: string;
  publicKey: string;
  fingerprint: string;
  createdAt: string;
};

export default function DeviceIdentitySettings({
  isAR,
  pairingEnabled = false,
}: {
  isAR: boolean;
  pairingEnabled?: boolean;
}) {
  const [identity, setIdentity] = useState<DeviceIdentityInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showDeviceId, setShowDeviceId] = useState(false);
  const [showFingerprint, setShowFingerprint] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function loadIdentity() {
      try {
        const getIdentity = window.electronAPI?.getDeviceIdentity;

        if (!getIdentity) {
          throw new Error(
            isAR
              ? "هوية الجهاز متاحة داخل تطبيق Ledger فقط"
              : "Device identity is available only in Ledger Desktop"
          );
        }

        const result = await getIdentity();

        if (mounted) setIdentity(result);
      } catch (err) {
        if (mounted) {
          setError(
            err instanceof Error
              ? err.message
              : isAR
                ? "تعذر قراءة هوية الجهاز"
                : "Unable to read device identity"
          );
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    void loadIdentity();

    return () => {
      mounted = false;
    };
  }, [isAR]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <RefreshCw className="h-4 w-4 animate-spin" />
        {isAR ? "جارٍ قراءة هوية الجهاز..." : "Loading device identity..."}
      </div>
    );
  }

  if (error || !identity) {
    return (
      <p role="alert" className="text-sm text-destructive">
        {error || (isAR ? "هوية الجهاز غير متاحة" : "Device identity unavailable")}
      </p>
    );
  }

  return (
    <section className="space-y-5 rounded-xl border border-border p-5">
      <div className="flex items-center gap-2">
        <Fingerprint className="h-5 w-5 text-primary" />
        <h3 className="font-semibold">
          {isAR ? "هوية هذا الجهاز" : "This Device Identity"}
        </h3>
      </div>

      <div className="grid gap-2 md:grid-cols-2">
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">
          {isAR ? "رقم الجهاز المستقل" : "Independent Device ID"}
        </p>
        <div className="flex items-center gap-2">
          <code dir="ltr" className="min-w-0 flex-1 break-all rounded-lg bg-muted px-3 py-2 text-sm">
            {showDeviceId ? identity.deviceId : "•••• •••• •••• ••••"}
          </code>
          <button type="button" aria-pressed={showDeviceId}
            aria-label={showDeviceId ? (isAR ? "إخفاء رقم الجهاز" : "Hide device ID") : (isAR ? "إظهار رقم الجهاز" : "Show device ID")}
            title={showDeviceId ? (isAR ? "إخفاء رقم الجهاز" : "Hide device ID") : (isAR ? "إظهار رقم الجهاز" : "Show device ID")}
            onClick={() => setShowDeviceId(value => !value)}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border hover:bg-muted">
            {showDeviceId ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">
          {isAR ? "البصمة الأمنية للجهاز" : "Device Security Fingerprint"}
        </p>

        <div className="flex flex-wrap items-center gap-3">
          <code dir="ltr" className="min-w-0 flex-1 break-all rounded-lg bg-muted px-3 py-2 text-xs">
            {showFingerprint ? identity.fingerprint : "••••-••••-••••-••••"}
          </code>

          <button type="button" aria-pressed={showFingerprint}
            aria-label={showFingerprint ? (isAR ? "إخفاء بصمة هذا الجهاز" : "Hide this device fingerprint") : (isAR ? "إظهار بصمة هذا الجهاز" : "Show this device fingerprint")}
            title={showFingerprint ? (isAR ? "إخفاء بصمة هذا الجهاز" : "Hide this device fingerprint") : (isAR ? "إظهار بصمة هذا الجهاز" : "Show this device fingerprint")}
            onClick={() => setShowFingerprint(value => !value)}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border hover:bg-muted">
            {showFingerprint ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
          <button
            type="button"
            onClick={() => void navigator.clipboard.writeText(identity.fingerprint)}
            className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm hover:bg-muted"
          >
            <Copy className="h-4 w-4" />
            {isAR ? "نسخ البصمة" : "Copy Fingerprint"}
          </button>
        </div>
      </div>
      </div>

      <p className="text-xs text-muted-foreground">
        {isAR
          ? "هذه الهوية مستقلة عن الترخيص وقاعدة البيانات. لا تتم مشاركة المفتاح الخاص."
          : "This identity is independent of licensing and databases. The private key is never shared."}
      </p>
      <DevicePairingPanel isAR={isAR} pairingEnabled={pairingEnabled} />
      <DevicePeerAddresses isAR={isAR} />
    </section>
  );
}
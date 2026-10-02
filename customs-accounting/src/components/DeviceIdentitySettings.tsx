import { useEffect, useState } from "react";
import { Copy, Fingerprint, RefreshCw } from "lucide-react";

type DeviceIdentityInfo = {
  deviceId: string;
  publicKey: string;
  fingerprint: string;
  createdAt: string;
};

export default function DeviceIdentitySettings({
  isAR,
}: {
  isAR: boolean;
}) {
  const [identity, setIdentity] = useState<DeviceIdentityInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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

      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">
          {isAR ? "رقم الجهاز المستقل" : "Independent Device ID"}
        </p>
        <code dir="ltr" className="block break-all rounded-lg bg-muted p-3 text-sm">
          {identity.deviceId}
        </code>
      </div>

      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">
          {isAR ? "البصمة الأمنية للجهاز" : "Device Security Fingerprint"}
        </p>

        <div className="flex flex-wrap items-center gap-3">
          <code dir="ltr" className="min-w-0 flex-1 break-all rounded-lg bg-muted p-3 text-xs">
            {identity.fingerprint}
          </code>

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

      <p className="text-xs text-muted-foreground">
        {isAR
          ? "هذه الهوية مستقلة عن الترخيص وقاعدة البيانات. لا تتم مشاركة المفتاح الخاص."
          : "This identity is independent of licensing and databases. The private key is never shared."}
      </p>
    </section>
  );
}
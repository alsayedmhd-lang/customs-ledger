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
      {/* pairing-ui-placeholder: presentation only; no pairing actions yet */}
      <div className="space-y-4 border-t border-border pt-5">
        <div>
          <h3 className="font-semibold">
            {isAR ? "ربط جهاز جديد" : "Pair a New Device"}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {isAR
              ? "سيتم ربط الأجهزة بعد التحقق المتبادل من البصمة الأمنية وموافقة المستخدم."
              : "Devices will be paired after mutual fingerprint verification and user approval."}
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            disabled
            className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm opacity-60"
          >
            {isAR ? "إنشاء طلب ربط" : "Create Pairing Request"}
          </button>

          <button
            type="button"
            disabled
            className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm opacity-60"
          >
            {isAR ? "استقبال طلب ربط" : "Receive Pairing Request"}
          </button>
        </div>

        <div className="rounded-lg border border-dashed border-border p-4">
          <h4 className="text-sm font-medium">
            {isAR ? "الأجهزة الموثوقة" : "Trusted Devices"}
          </h4>
          <p className="mt-2 text-sm text-muted-foreground">
            {isAR
              ? "سيظهر هنا سجل الأجهزة المرتبطة بعد تفعيل الربط الآمن."
              : "Paired devices will appear here once secure pairing is enabled."}
          </p>
        </div>

        <p className="text-xs text-muted-foreground">
          {isAR
            ? "الربط غير مفعّل حاليًا. لا يتم إرسال أي بيانات أو مرفقات."
            : "Pairing is not enabled yet. No data or attachments are transmitted."}
        </p>
      </div>
    </section>
  );
}
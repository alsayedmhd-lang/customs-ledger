import Barcode from "react-barcode";
import { useCompanySettings, type CompanySettings } from "@/lib/company-settings-context";

type DocumentKind = "invoice" | "receipt" | "statement";

type SettingsOverride = {
  settings?: CompanySettings;
  logoSrc?: string;
  stampSrc?: string;
  watermarkSrc?: string;
};

function usePrintSettings(override?: SettingsOverride) {
  const ctx = useCompanySettings();

  return {
    settings: override?.settings ?? ctx.settings,
    logoSrc: override?.logoSrc ?? ctx.logoSrc,
    stampSrc: override?.stampSrc ?? ctx.stampSrc,
    watermarkSrc: override?.watermarkSrc ?? ctx.watermarkSrc,
  };
}

export function PrintWatermark({
  kind,
  override,
}: {
  kind: DocumentKind;
  override?: SettingsOverride;
}) {
  const { settings, watermarkSrc } = usePrintSettings(override);
  if (!settings.showWatermark) return null;

  const imageClass = kind === "receipt" ? "w-44 object-contain mb-1" : "w-72 object-contain mb-3";
  const arClass = kind === "receipt" ? "text-3xl" : "text-5xl";
  const enClass = kind === "receipt" ? "text-xl mt-1" : "text-3xl mt-2";

  return (
    <div
      className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none select-none"
      style={{ opacity: kind === "invoice" ? 0.07 : 0.06, zIndex: 0 }}
      aria-hidden="true"
    >
      <img src={watermarkSrc} alt="" className={imageClass} />
      <div className="text-center leading-tight text-blue-800">
        <div className={`${arClass} font-black`}>{settings.nameAr}</div>
        <div className={`${enClass} font-black`}>{settings.nameEn.split(" ").slice(0, 3).join(" ")}</div>
        {kind !== "receipt" && <div className="text-2xl font-bold">{settings.subtitleEn}</div>}
      </div>
    </div>
  );
}

export function ReceiptPrintHeader({
  receiptNumber,
  override,
}: {
  receiptNumber: string;
  override?: SettingsOverride;
}) {
  const { settings, logoSrc } = usePrintSettings(override);

  return (
    <div className="border-b-4 border-double border-gray-800 pb-1 pt-1 px-5 relative z-10">
      <div className="flex items-center justify-between">
        <div className="text-right">
          <div className="text-sm font-black text-gray-900 leading-tight">{settings.nameAr}</div>
          <div className="text-xs font-bold text-gray-700">{settings.subtitleAr}</div>
          <div className="text-[10px] text-gray-500">{settings.taglineAr}</div>
          <div className="text-[10px] text-gray-500 mt-0.5">{settings.email}</div>
        </div>

        <div className="flex flex-col items-center gap-0.5">
          <img src={logoSrc} alt={settings.nameAr} className="h-10 w-auto object-contain" />
          <div className="text-center">
            <div className="font-black text-gray-900 text-base leading-tight">سند قبض</div>
            <div className="text-gray-400 text-[10px] font-normal">RECEIPT VOUCHER</div>
          </div>
        </div>

        <div className="text-left" dir="ltr">
          <div className="text-sm font-black text-gray-900 leading-tight uppercase">{settings.nameEn}</div>
          <div className="text-xs font-bold text-gray-700">{settings.subtitleEn}</div>
          <div className="text-[10px] text-gray-500">{settings.taglineEn}</div>
          <div className="text-[10px] text-gray-500">
            Tel: {settings.phone} · {settings.address}
          </div>
          {(settings.crNumber || settings.taxNumber) && (
            <div className="text-[10px] text-gray-500">
              {settings.crNumber ? `CR: ${settings.crNumber}` : ""}
              {settings.crNumber && settings.taxNumber ? " · " : ""}
              {settings.taxNumber ? `Tax: ${settings.taxNumber}` : ""}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between mt-1 pt-1 border-t border-gray-200">
        <div className="text-right">
          <span className="text-xs font-bold text-gray-500">رقم السند / No: </span>
          <span className="font-mono text-blue-800 font-bold text-sm">{receiptNumber}</span>
        </div>

        <Barcode value={receiptNumber} format="CODE128" width={1.1} height={22} fontSize={7} margin={0} displayValue={false} />
      </div>
    </div>
  );
}

export function StatementPrintHeader({
  statementRef,
  dateText,
  override,
}: {
  statementRef: string;
  dateText: string;
  override?: SettingsOverride;
}) {
  const { settings, logoSrc } = usePrintSettings(override);

  return (
    <>
      <div className="border-b-4 border-double border-gray-800 pb-3 pt-4 px-6 relative z-10">
        <div className="flex items-start justify-between flex-row-reverse">
          <div className="text-left" dir="ltr">
            <div className="text-2xl font-black text-gray-900 leading-tight uppercase">{settings.nameEn}</div>
            <div className="text-lg font-bold text-gray-700">{settings.subtitleEn}</div>
            <div className="text-xs text-gray-500 mt-1">{settings.email}</div>
            <div className="text-xs text-gray-500">
              Tel: {settings.phone} · {settings.poBox} {settings.address}
            </div>
            {(settings.crNumber || settings.taxNumber) && (
              <div className="text-xs text-gray-500">
                {settings.crNumber ? `CR: ${settings.crNumber}` : ""}
                {settings.crNumber && settings.taxNumber ? " · " : ""}
                {settings.taxNumber ? `Tax: ${settings.taxNumber}` : ""}
              </div>
            )}
          </div>

          <div className="flex flex-col items-center justify-center">
            <img src={logoSrc} alt={settings.nameAr} className="h-24 w-auto object-contain" />
          </div>

          <div className="text-right">
            <div className="text-2xl font-black text-gray-900 leading-tight">{settings.nameAr}</div>
            <div className="text-lg font-bold text-gray-700">{settings.subtitleAr}</div>
            <div className="text-xs text-gray-500 mt-1">{settings.nameEn}</div>
            <div className="text-xs text-gray-500">{settings.taglineAr}</div>
          </div>
        </div>
      </div>

      <div className="border-b border-gray-400 px-6 py-2 bg-gray-50 relative z-10">
        <div className="flex items-center justify-between text-sm">
          <div className="font-bold text-gray-800" dir="ltr">
            Date : <span className="font-mono">{dateText}</span>
          </div>
          <div className="text-center font-bold text-gray-800 text-lg">
            كشف ملخص الحساب
            <span className="mx-2 text-gray-400 text-sm">|</span>
            <span className="text-sm font-normal text-gray-600">ACCOUNT SUMMARY</span>
          </div>
          <div className="font-bold text-gray-800 text-left" dir="ltr">
            Ref : <span className="font-mono text-blue-800">{statementRef}</span>
          </div>
        </div>

        <div className="flex justify-center py-1">
          <Barcode value={statementRef} format="CODE128" width={1.4} height={40} fontSize={11} margin={0} displayValue />
        </div>
      </div>
    </>
  );
}

export function PrintSignaturesStamp({
  kind,
  showStamp = true,
  showSignatures = true,
  receiverSignature,
  receiverName,
  override,
}: {
  kind: Exclude<DocumentKind, "statement">;
  showStamp?: boolean;
  showSignatures?: boolean;
  receiverSignature?: string | null;
  receiverName?: string | null;
  override?: SettingsOverride;
}) {
  const { settings, stampSrc } = usePrintSettings(override);
  const stampEnabled = kind === "invoice" ? settings.showStampOnInvoices : settings.showStampOnReceipts;
  const stampHeight = kind === "invoice" ? "130px" : "110px";
  const sigHeight = kind === "invoice" ? "h-20" : "h-14";

  return (
    <div className={`relative grid grid-cols-2 ${kind === "invoice" ? "gap-4 px-6 pb-2 pt-3" : "gap-8 px-10 pb-3 pt-4"} border-t border-gray-300 mt-2`} style={{ zIndex: 3 }}>
      <div className="text-center">
        <div className="h-12 flex items-end justify-center">
          <div className="w-full border-b-2 border-gray-400" />
        </div>
        <p className="text-xs text-gray-500 mt-1 font-bold">توقيع المستلم</p>
        <p className="text-xs text-gray-400">{kind === "invoice" ? "Received By" : "Receiver Signature"}</p>
      </div>

      <div className="text-center">
        <div className="h-12 flex items-end justify-center">
          <div className="w-full border-b-2 border-gray-400" />
        </div>
        <p className="text-xs text-gray-500 mt-1 font-bold">توقيع المحاسب</p>
        <p className="text-xs text-gray-400">{kind === "invoice" ? "Accountant" : "Accountant Signature"}</p>
      </div>

      {showSignatures && settings.showReceiverSignature && receiverSignature && (
        <>
          <img
            src={receiverSignature}
            alt="Receiver Signature"
            className={`absolute bottom-10 right-[12%] ${sigHeight} w-auto object-contain pointer-events-none`}
            style={{ zIndex: 3, opacity: 0.9, mixBlendMode: "multiply" }}
          />
          {receiverName && (
            <span className="absolute text-xs font-semibold text-gray-700" style={{ bottom: 38, right: "calc(12% - 70px)", width: 120, textAlign: "center" }}>
              {receiverName}
            </span>
          )}
        </>
      )}

      {showSignatures && settings.showAccountantSignature && settings.accountantSignatureBase64 && (
        <img
          src={settings.accountantSignatureBase64}
          alt="Accountant Signature"
          className={`absolute bottom-10 left-[12%] ${sigHeight} w-auto object-contain pointer-events-none`}
          style={{ zIndex: 3, opacity: 0.9, mixBlendMode: "multiply", filter: kind === "invoice" ? "brightness(1.4) contrast(1.2)" : undefined }}
        />
      )}

      {stampEnabled && showStamp && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ zIndex: 2 }}>
          <img src={stampSrc} alt="stamp" className="w-auto object-contain" style={{ height: stampHeight, maxWidth: kind === "invoice" ? 200 : 170, opacity: 0.92 }} />
        </div>
      )}
    </div>
  );
}

export function StatementStamp({
  showStamp = true,
  override,
}: {
  showStamp?: boolean;
  override?: SettingsOverride;
}) {
  const { settings, stampSrc } = usePrintSettings(override);
  if (!settings.showStampOnStatements || !showStamp) return null;

  return (
    <div className="absolute inset-0 flex items-end justify-center pointer-events-none" style={{ zIndex: 2, paddingBottom: 30 }}>
      <img src={stampSrc} alt="stamp" className="w-auto object-contain" style={{ height: 125, maxWidth: 210, opacity: 0.92 }} />
    </div>
  );
}

export function PrintDocumentFooter({
  kind,
  reference,
  count,
  override,
}: {
  kind: DocumentKind;
  reference: string;
  count?: number;
  override?: SettingsOverride;
}) {
  const { settings } = usePrintSettings(override);
  const dateText = new Date().toLocaleDateString("ar-EG-u-nu-latn", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const refLabel = kind === "invoice" ? "رقم الفاتورة" : kind === "receipt" ? "رقم السند" : "المرجع";

  return (
    <div className="border-t-4 border-double border-gray-700 px-6 py-3 bg-gray-50 relative z-10">
      <div className="flex items-center justify-between text-xs text-gray-600">
        <span>✉ {settings.email}</span>
        <span className="font-bold text-gray-800">
          {settings.nameAr} · {kind === "invoice" ? `${settings.nameEn.split(" ").slice(0, 3).join(" ")} C.C` : settings.nameEn}
        </span>
        <span>
          {settings.poBox} {settings.address} · ☎ {settings.phone}
        </span>
      </div>

      {settings.footerText && <div className="text-center text-xs text-gray-500 mt-1">{settings.footerText}</div>}

      <div className="text-center text-xs text-gray-400 mt-1">
        طبعت في: {dateText}
        {" — "}{refLabel}: {reference}
        {kind === "statement" && typeof count === "number" ? ` — عدد الحركات: ${count}` : ""}
      </div>
    </div>
  );
}


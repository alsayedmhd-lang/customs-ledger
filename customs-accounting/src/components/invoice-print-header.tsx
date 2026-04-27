import Barcode from "react-barcode";

type Props = {
  company: any;
  logoSrc: string;
  isAR?: boolean;
  invoiceNumber?: string;
  statusText?: string;
};

export default function InvoicePrintHeader({
  company,
  logoSrc,
  isAR = true,
  invoiceNumber = "INV-PREVIEW",
  statusText = "صادرة",
}: Props) {
  return (
    <>
      {/* LETTERHEAD */}
      <div className="border-b-4 border-double border-gray-800 pb-3 pt-4 px-6">
        <div className="relative flex items-start justify-between gap-4">
          <div className="text-right flex-1 min-w-0">
            <div className="text-2xl font-black text-gray-900 leading-tight break-words">
              {company.nameAr}
            </div>
            <div className="text-lg font-bold text-gray-700">{company.subtitleAr}</div>
            <div className="text-xs text-gray-500">{company.taglineAr}</div>
          </div>

          <div className="absolute left-1/2 -top-8 -translate-x-1/2 pointer-events-none">
            <img
              src={logoSrc}
              alt={company.nameAr}
              className="h-30 w-auto object-contain opacity-95"
            />
          </div>

          <div className="text-left flex-1 min-w-0">
            <div className="text-xl font-black text-gray-900 leading-tight break-words">
              {company.nameEn}
            </div>
            <div className="text-lg font-bold text-gray-700">{company.subtitleEn}</div>
            <div className="text-xs text-gray-500">{company.taglineEn}</div>
          </div>
        </div>
      </div>

      {/* INVOICE META */}
      <div className="flex items-stretch border-b-2 border-gray-700 bg-gray-50" dir="ltr">
        <div
          className="flex flex-col justify-center px-6 py-2.5"
          style={{ width: "40%", borderRight: "1px solid #d1d5db" }}
        >
          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">
            Invoice No
          </div>

          <div className="font-mono font-black text-blue-800 text-xl leading-none">
            {invoiceNumber}
          </div>

          <div className="mt-1.5">
            <Barcode
              value={invoiceNumber}
              format="CODE128"
              width={1.2}
              height={28}
              fontSize={0}
              margin={0}
              displayValue={false}
            />
            <div className="text-center text-[9px] font-mono text-gray-500">
              {invoiceNumber}
            </div>
          </div>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center px-6 py-2.5">
          <div
            className="font-black text-gray-900 leading-tight"
            dir={isAR ? "rtl" : "ltr"}
            style={{ fontSize: `${company.invoiceTitleFontSize || 30}px` }}
          >
            {company.invoiceCreditTitleAr || "فاتورة نقدًا / على الحساب"}
          </div>

          <div className="mt-1 flex items-center gap-2.5 text-sm text-gray-500 font-semibold">
            <span>{company.invoiceCreditTitleEn || "Cash / Credit Invoice"}</span>
            <span className="w-1 h-1 rounded-full bg-gray-400 inline-block" />
            <span dir="rtl">{statusText}</span>
          </div>
        </div>
      </div>
    </>
  );
}
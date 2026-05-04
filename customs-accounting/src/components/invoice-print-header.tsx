import Barcode from "react-barcode";
import { PrintTitleBlock } from "@/components/print-document-parts";

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
      <div className="border-b border-gray-800 pb-1 pt-1.5 px-4" dir="ltr">
        <div className="grid grid-cols-3 items-start gap-2">
          <div className="text-left min-w-0 space-y-0">
            <div className="text-xl font-black text-gray-900 leading-tight break-words uppercase">{company.nameEn}</div>
            <div className="text-sm font-bold text-gray-700">{company.subtitleEn}</div>
            <div className="text-[10px] text-gray-500">{company.taglineEn}</div>
            <div className="text-[10px] text-gray-500">
              Tel: {company.phone} · {company.poBox} {company.address}
            </div>
            {(company.crNumber || company.taxNumber) && (
              <div className="text-[10px] text-gray-500">
                {company.crNumber ? `CR: ${company.crNumber}` : ""}
                {company.crNumber && company.taxNumber ? " · " : ""}
                {company.taxNumber ? `Tax: ${company.taxNumber}` : ""}
              </div>
            )}
          </div>

          <div className="flex justify-center items-start -mt-8">
            <img
              src={logoSrc}
              alt={company.nameAr}
              style={{ height: `${company.logoSize || 45}px` }}
              className="w-auto object-contain opacity-95"
            />
          </div>

          <div className="text-right min-w-0 space-y-0" dir="rtl">
            <div className="text-xl font-black text-gray-900 leading-tight break-words">{company.nameAr}</div>
            <div className="text-sm font-bold text-gray-700">{company.subtitleAr}</div>
            <div className="text-[10px] text-gray-500">{company.taglineAr}</div>
            <div className="text-[10px] text-gray-500">
              {company.address} · {company.poBox} · {company.phone}
            </div>
            {(company.crNumber || company.taxNumber) && (
              <div className="text-[10px] text-gray-500">
                {company.crNumber ? `س.ت: ${company.crNumber}` : ""}
                {company.crNumber && company.taxNumber ? " · " : ""}
                {company.taxNumber ? `ضريبي: ${company.taxNumber}` : ""}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-stretch border-b-2 border-gray-700 bg-gray-50" dir="ltr">
        <div className="flex flex-col justify-center px-6 py-2.5" style={{ width: "40%", borderRight: "1px solid #d1d5db" }}>
          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Invoice No</div>
          <div className="font-mono font-black text-blue-800 text-xl leading-none">{invoiceNumber}</div>
          <div className="mt-1.5">
            <Barcode value={invoiceNumber} format="CODE128" width={1.2} height={28} fontSize={0} margin={0} displayValue={false} />
            <div className="text-center text-[9px] font-mono text-gray-500">{invoiceNumber}</div>
          </div>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center px-6 py-2.5">
          <PrintTitleBlock
            visible={company.invoiceTitleVisible ?? true}
            align={company.invoiceTitleAlign || "center"}
            bold={company.invoiceTitleBold ?? true}
            titleAr={company.invoiceCreditTitleAr || "فاتورة نقداً / على الحساب"}
            titleEn={company.invoiceCreditTitleEn || "Cash / Credit Invoice"}
            titleFontSize={company.invoiceTitleFontSize || 30}
            subtitleAr={company.invoiceSubtitleAr || ""}
            subtitleEn={company.invoiceSubtitleEn || ""}
            subtitleFontSize={company.invoiceSubtitleFontSize || 12}
          />
          <div className="mt-1 flex items-center gap-2.5 text-sm text-gray-500 font-semibold">
            <span dir="rtl">{statusText}</span>
          </div>
        </div>
      </div>
    </>
  );
}

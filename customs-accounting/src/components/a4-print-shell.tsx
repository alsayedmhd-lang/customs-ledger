import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";

type A4PrintShellProps = {
  children: ReactNode;
  controls?: ReactNode;
  dir?: "ltr" | "rtl";
  className?: string;
  pageClassName?: string;
  pageStyle?: CSSProperties;
};

const pageClassName =
  "print-page max-w-[210mm] mx-auto print:max-w-none print:w-full print:mx-0 bg-white shadow-lg print:shadow-none border border-gray-200 print:border-none relative overflow-hidden";

const pageStyle: CSSProperties = {
  fontFamily: "'Cairo', 'Arial', sans-serif",
};

export function A4PrintShell({
  children,
  controls,
  dir = "rtl",
  className,
  pageClassName: customPageClassName,
  pageStyle: customPageStyle,
}: A4PrintShellProps) {
  return (
    <div className={cn("bg-gray-100 print:bg-white", className)} dir={dir}>
      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 10mm 10mm 10mm 15mm; }

          body {
            margin: 0;
            background: white !important;
          }

          .print-page {
            width: 170mm !important;
            max-width: 170mm !important;
            margin: 12mm auto 0 auto !important;

            height: auto !important;
            min-height: auto !important;

            display: block !important;
            overflow: visible !important;
          }

          .print-content {
            height: auto !important;
            min-height: auto !important;
            display: block !important;
          }

          .print-footer {
            position: relative !important;
            margin-top: -1mm !important;
            page-break-inside: avoid;
          }
        }
      `}</style>

      {controls}

      <div className={cn(pageClassName, customPageClassName)} style={{ ...pageStyle, ...customPageStyle }}>
        {children}
      </div>
    </div>
  );
}

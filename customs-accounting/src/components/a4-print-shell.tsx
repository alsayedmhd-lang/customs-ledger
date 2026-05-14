import type { CSSProperties, ReactNode } from "react";
import { PrintStyles } from "@/components/print-styles";
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
      <PrintStyles />

      {controls}

      <div className={cn(pageClassName, customPageClassName)} style={{ ...pageStyle, ...customPageStyle }}>
        {children}
      </div>
    </div>
  );
}

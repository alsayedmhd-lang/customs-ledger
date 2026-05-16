import type { ReactNode } from "react";

type PrintPreviewShellProps = {
  title: string;
  fileName?: string;
  dir?: "rtl" | "ltr";
  children: ReactNode;
  onPrint?: () => void;
};

export function PrintPreviewShell({
  title,
  fileName,
  dir = "rtl",
  children,
  onPrint,
}: PrintPreviewShellProps) {
  const handlePrint = () => {
    if (fileName) {
      document.title = fileName;
    }

    if (onPrint) {
      onPrint();
      return;
    }

  };

      return;
    }

  };

  return (
    <div dir={dir}>
      <style>{`
        @media print {
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      <div className="no-print flex items-center justify-between gap-3 border-b bg-white px-4 py-3 shadow-sm">
        <h1 className="text-sm font-semibold text-gray-900">{title}</h1>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handlePrint}
            className="rounded-md bg-blue-700 px-3 py-2 text-sm font-medium text-white hover:bg-blue-800"
          >
            Print
          </button>
          <button
            type="button"
            className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
          </button>
          <button
            type="button"
            className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
          </button>
        </div>
      </div>

      {children}
    </div>
  );
}


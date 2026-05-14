type PrintStylesProps = {
  children?: never;
};

export function PrintStyles(_: PrintStylesProps) {
  return (
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
  );
}

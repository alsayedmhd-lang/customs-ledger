type PrintStylesProps = {
  children?: never;
};

export function PrintStyles(_: PrintStylesProps) {
  return (
    <style>{`
      @media print {
        @page { size: A4 portrait; margin: 4mm; }

        html,
        body {
          margin: 0 !important;
          padding: 0 !important;
          background: white !important;
        }

        .print-page {
          width: 185mm !important;
          max-width: none !important;
          margin: 0 auto !important;
          padding-bottom: 0 !important;
          box-sizing: border-box !important;

          height: auto !important;
          min-height: 0 !important;

          display: block !important;
          overflow: visible !important;
        }

        .print-content {
          flex: 1 1 auto !important;
          min-height: 0 !important;
          display: flex !important;
          flex-direction: column !important;
        }

        .print-footer {
          position: relative !important;
          margin-top: 0 !important;
          page-break-inside: avoid;
        }
      }

      @media print and (min-resolution: 300dpi) {
        @page { size: A4 portrait; margin: 6mm; }

        html body .print-page {
          width: 185mm !important;
          min-height: 0 !important;
        }
      }
    `}</style>
  );
}

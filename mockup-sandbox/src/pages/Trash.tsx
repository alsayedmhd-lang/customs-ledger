import { useState } from "react";

type Props = {
  lang: "ar" | "en";
};

type Tab = "invoices" | "receipts";

type TrashItem = {
  id: string;
  client: string;
  total: string;
};

export default function Trash({ lang }: Props) {
  const isArabic = lang === "ar";
  const [tab, setTab] = useState<Tab>("invoices");

  const deletedInvoices: TrashItem[] = [
    {
      id: "INV-2026-0006",
      client: "VERONA READY MADE",
      total: "QR 100.00",
    },
  ];

  const deletedReceipts: TrashItem[] = [
    {
      id: "RCP-2026-0001",
      client: "Buzwair Industrial Gases Factory",
      total: "QR 1,029.00",
    },
  ];

  const currentItems =
    tab === "invoices" ? deletedInvoices : deletedReceipts;

  return (
    <div
      dir={isArabic ? "rtl" : "ltr"}
      style={{ padding: "24px", background: "white", minHeight: "100vh" }}
    >
      <h1>{isArabic ? "سلة المحذوفات" : "Trash"}</h1>

      <div style={{ marginBottom: "20px" }}>
        <button onClick={() => setTab("invoices")}>
          {isArabic ? "الفواتير" : "Invoices"}
        </button>

        <button
          onClick={() => setTab("receipts")}
          style={{ marginInlineStart: "10px" }}
        >
          {isArabic ? "سندات القبض" : "Receipts"}
        </button>
      </div>

      <table style={{ width: "100%", background: "white" }}>
        <thead>
          <tr>
            <th>{isArabic ? "الرقم" : "No."}</th>
            <th>{isArabic ? "العميل" : "Client"}</th>
            <th>{isArabic ? "الإجمالي" : "Total"}</th>
          </tr>
        </thead>
        <tbody>
          {currentItems.map((item) => (
            <tr key={item.id}>
              <td>{item.id}</td>
              <td>{item.client}</td>
              <td>{item.total}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

import React, { useState } from "react";

type Props = {
  lang: "ar" | "en";
};

type Tab = "invoices" | "receipts";

type TrashItem = {
  id: string;
  client: string;
  dateAr: string;
  dateEn: string;
  total: string;
  statusAr: string;
  statusEn: string;
  deletedAtAr: string;
  deletedAtEn: string;
};

export default function Trash({ lang }: Props) {
  const isArabic = lang === "ar";
  const [tab, setTab] = useState<Tab>("invoices");

  const deletedInvoices: TrashItem[] = [
    {
      id: "INV-2026-0006",
      client: "VERONA READY MADE",
      dateAr: "3 أبريل 2026",
      dateEn: "Apr 3, 2026",
      total: "QR 100.00",
      statusAr: "مسودة",
      statusEn: "Draft",
      deletedAtAr: "الآن",
      deletedAtEn: "Just now",
    },
  ];

  const deletedReceipts: TrashItem[] = [
    {
      id: "RCP-2026-0001",
      client: "Buzwair Industrial Gases Factory",
      dateAr: "20 مارس 2026",
      dateEn: "Mar 20, 2026",
      total: "QR 1,029.00",
      statusAr: "مقبوض",
      statusEn: "Received",
      deletedAtAr: "منذ ساعة",
      deletedAtEn: "1 hour ago",
    },
  ];

  const currentItems = tab === "invoices" ? deletedInvoices : deletedReceipts;

  return (
    <div
      dir={isArabic ? "rtl" : "ltr"}
      style={{
        padding: "24px",
        fontFamily: "system-ui, sans-serif",
        background: "#f3f4f6",
        minHeight: "100vh",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "16px",
          marginBottom: "24px",
          flexWrap: "wrap",
        }}
      >
        <div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              marginBottom: "8px",
            }}
          >
            <div
              style={{
                width: "42px",
                height: "42px",
                borderRadius: "14px",
                background: "#fee2e2",
                color: "#ef4444",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "20px",
                flexShrink: 0,
              }}
            >
              🗑️
            </div>

            <h1
              style={{
                margin: 0,
                fontSize: "32px",
                color: "#111827",
                lineHeight: 1.2,
              }}
            >
              {isArabic ? "سلة المحذوفات" : "Trash"}
            </h1>
          </div>

          <p style={{ margin: 0, color: "#6b7280" }}>
            {isArabic
              ? `${currentItems.length} عنصر محذوف`
              : `${currentItems.length} deleted item${
                  currentItems.length === 1 ? "" : "s"
                }`}
          </p>
        </div>

        <button type="button" style={emptyTrashButtonStyle}>
          {isArabic ? "إفراغ السلة" : "Empty Trash"}
        </button>
      </div>

      <div
        style={{
          display: "flex",
          gap: "24px",
          borderBottom: "2px solid #dbe3ef",
          marginBottom: "24px",
          flexWrap: "wrap",
        }}
      >
        <TabButton
          active={tab === "invoices"}
          onClick={() => setTab("invoices")}
          title={isArabic ? "الفواتير" : "Invoices"}
          count={deletedInvoices.length}
        />

        <TabButton
          active={tab === "receipts"}
          onClick={() => setTab("receipts")}
          title={isArabic ? "سندات القبض" : "Receipts"}
          count={deletedReceipts.length}
        />
      </div>

      {currentItems.length === 0 ? (
        <div style={emptyStateCardStyle}>
          <div
            style={{
              fontSize: "64px",
              opacity: 0.15,
              marginBottom: "16px",
            }}
          >
            📄
          </div>

          <p style={{ color: "#6b7280", fontSize: "18px", margin: 0 }}>
            {isArabic
              ? tab === "invoices"
                ? "لا توجد فواتير محذوفة"
                : "لا توجد سندات قبض محذوفة"
              : tab === "invoices"
                ? "No deleted invoices"
                : "No deleted receipts"}
          </p>
        </div>
      ) : (
        <div style={tableCardStyle}>
          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                minWidth: "980px",
              }}
            >
              <thead>
                <tr
                  style={{
                    color: "#6b7280",
                    fontSize: "14px",
                    background: "#f8fafc",
                  }}
                >
                  <th style={thStyle}>
                    {tab === "invoices"
                      ? isArabic
                        ? "رقم الفاتورة"
                        : "Invoice No."
                      : isArabic
                        ? "رقم السند"
                        : "Receipt No."}
                  </th>
                  <th style={thStyle}>{isArabic ? "العميل" : "Client"}</th>
                  <th style={thStyle}>{isArabic ? "التاريخ" : "Date"}</th>
                  <th style={thStyle}>{isArabic ? "الإجمالي" : "Total"}</th>
                  <th style={thStyle}>{isArabic ? "الحالة" : "Status"}</th>
                  <th style={thStyle}>{isArabic ? "وقت الحذف" : "Deleted At"}</th>
                  <th style={thStyle}>{isArabic ? "الإجراءات" : "Actions"}</th>
                </tr>
              </thead>

              <tbody>
                {currentItems.map((item) => (
                  <tr key={item.id} style={{ borderTop: "1px solid #e5e7eb" }}>
                    <td style={tdStyle}>
                      <span style={{ color: "#2563eb", fontWeight: 700 }}>
                        {item.id}
                      </span>
                    </td>

                    <td style={tdStyle}>{item.client}</td>

                    <td style={tdStyle}>
                      {isArabic ? item.dateAr : item.dateEn}
                    </td>

                    <td style={tdStyle}>
                      <strong>{item.total}</strong>
                    </td>

                    <td style={tdStyle}>
                      <span style={statusBadgeStyle}>
                        {isArabic ? item.statusAr : item.statusEn}
                      </span>
                    </td>

                    <td style={tdStyle}>
                      {isArabic ? item.deletedAtAr : item.deletedAtEn}
                    </td>

                    <td style={tdStyle}>
                      <div
                        style={{
                          display: "flex",
                          gap: "8px",
                          flexWrap: "wrap",
                        }}
                      >
                        <button type="button" style={restoreButtonStyle}>
                          {isArabic ? "استعادة" : "Restore"}
                        </button>

                        <button type="button" style={deleteButtonStyle}>
                          {isArabic ? "حذف نهائي" : "Delete Permanently"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function TabButton({
  title,
  active,
  count,
  onClick,
}: {
  title: string;
  active: boolean;
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        border: "none",
        background: "transparent",
        borderBottom: active ? "3px solid #2563eb" : "3px solid transparent",
        color: active ? "#2563eb" : "#64748b",
        padding: "10px 0",
        cursor: "pointer",
        fontWeight: 700,
        display: "flex",
        alignItems: "center",
        gap: "8px",
      }}
    >
      <span>{title}</span>
      <span
        style={{
          minWidth: "22px",
          height: "22px",
          borderRadius: "999px",
          background: active ? "#ef4444" : "#e2e8f0",
          color: active ? "#ffffff" : "#475569",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "12px",
          fontWeight: 700,
          padding: "0 6px",
          boxSizing: "border-box",
        }}
      >
        {count}
      </span>
    </button>
  );
}

const thStyle: React.CSSProperties = {
  textAlign: "start",
  padding: "16px 14px",
  fontWeight: 700,
  whiteSpace: "nowrap",
};

const tdStyle: React.CSSProperties = {
  textAlign: "start",
  padding: "16px 14px",
  color: "#111827",
  verticalAlign: "middle",
};

const tableCardStyle: React.CSSProperties = {
  background: "#ffffff",
  borderRadius: "22px",
  padding: "0",
  overflow: "hidden",
  boxShadow: "0 4px 14px rgba(0,0,0,0.06)",
};

const emptyStateCardStyle: React.CSSProperties = {
  background: "#ffffff",
  borderRadius: "22px",
  padding: "80px 24px",
  minHeight: "350px",
  boxShadow: "0 4px 14px rgba(0,0,0,0.06)",
  textAlign: "center",
};

const emptyTrashButtonStyle: React.CSSProperties = {
  border: "none",
  background: "#ef4444",
  color: "#ffffff",
  borderRadius: "14px",
  padding: "12px 16px",
  cursor: "pointer",
  fontWeight: 700,
};

const statusBadgeStyle: React.CSSProperties = {
  display: "inline-block",
  padding: "6px 12px",
  borderRadius: "999px",
  fontSize: "13px",
  fontWeight: 600,
  background: "#e5e7eb",
  color: "#475569",
};

const restoreButtonStyle: React.CSSProperties = {
  border: "1px solid #86efac",
  background: "#f0fdf4",
  color: "#16a34a",
  borderRadius: "10px",
  padding: "8px 12px",
  cursor: "pointer",
  fontWeight: 600,
};

const deleteButtonStyle: React.CSSProperties = {
  border: "1px solid #fecaca",
  background: "#fff1f2",
  color: "#dc2626",
  borderRadius: "10px",
  padding: "8px 12px",
  cursor: "pointer",
  fontWeight: 600,
};

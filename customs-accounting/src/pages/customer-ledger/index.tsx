import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";

type Client = {
  id: number;
  name?: string;
  nameAr?: string;
  nameEn?: string;
};

type LedgerRow = {
  id: string;
  entryDate: string;
  entryType: "invoice" | "receipt" | "advance" | string;
  debit?: number | string;
  credit?: number | string;
  balanceImpact?: number | string;
};

function formatMoney(value: number) {
  return Number(value || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default function CustomerLedgerPage() {
  const [data, setData] = useState<LedgerRow[]>([]);
  const [openingBalance, setOpeningBalance] = useState(0);
  const [clients, setClients] = useState<Client[]>([]);
  const [clientId, setClientId] = useState<number | "">("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const [, navigate] = useLocation();

  const token =
    localStorage.getItem("token") ||
    sessionStorage.getItem("auth_token") ||
    localStorage.getItem("auth_token");

  useEffect(() => {
    fetch("http://127.0.0.1:3000/api/clients", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((res) => setClients(Array.isArray(res) ? res : []))
      .catch(console.error);
  }, [token]);

  const selectedClient = useMemo(
    () => clients.find((c) => c.id === clientId),
    [clients, clientId]
  );

  const totalDebit = useMemo(
    () => data.reduce((sum, row) => sum + Number(row.debit || 0), 0),
    [data]
  );

  const totalCredit = useMemo(
    () => data.reduce((sum, row) => sum + Number(row.credit || 0), 0),
    [data]
  );

  const finalBalance = useMemo(
    () => openingBalance + totalDebit - totalCredit,
    [openingBalance, totalDebit, totalCredit]
  );

  const loadLedger = async () => {
    if (!clientId) return;

    setIsLoading(true);

    try {
      const res = await fetch(
        `http://127.0.0.1:3000/api/customer-ledger/${clientId}?from=${fromDate}&to=${toDate}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      const json = await res.json();

      setData(Array.isArray(json) ? json : json.rows ?? []);
      setOpeningBalance(Number(json.openingBalance ?? 0));
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const openPrintPage = () => {
    if (!clientId) return;

    navigate(
      `/customer-ledger/print?clientId=${clientId}&from=${fromDate}&to=${toDate}`
    );
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto" dir="rtl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="text-right">
          <h1 className="text-3xl font-bold text-gray-900">
            ملخص العميل المالي
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            كشف مختصر لحركات العميل والرصيد
          </p>
        </div>

        <button
          type="button"
          onClick={openPrintPage}
          disabled={!clientId}
          className="px-5 py-2 rounded-xl bg-primary text-white shadow hover:bg-primary/90 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          الطباعة
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white border rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b bg-gray-50 flex items-center justify-between">
          <div>
            <div className="font-semibold text-gray-900">البحث والتصفية</div>
            <div className="text-xs text-gray-500 mt-1">
              اختر العميل والفترة ثم اضغط بحث
            </div>
          </div>

          <div className="text-sm text-gray-500">
            {data.length} حركة
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-5 items-end">
          <div>
            <label className="text-sm font-medium text-gray-700">العميل</label>
            <select
              className="w-full border rounded-xl px-3 py-2 mt-1 bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              value={clientId}
              onChange={(e) => {
                setClientId(e.target.value ? Number(e.target.value) : "");
                setData([]);
                setOpeningBalance(0);
              }}
            >
              <option value="">اختر العميل</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nameAr || c.nameEn || c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700">
              من تاريخ
            </label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-full border rounded-xl px-3 py-2 mt-1 bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700">
              إلى تاريخ
            </label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="w-full border rounded-xl px-3 py-2 mt-1 bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          <button
            type="button"
            onClick={loadLedger}
            disabled={!clientId || isLoading}
            className="h-[42px] rounded-xl bg-primary text-white shadow hover:bg-primary/90 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? "جاري البحث..." : "بحث"}
          </button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white border rounded-2xl p-4 shadow-sm">
          <div className="text-sm text-gray-500">العميل</div>
          <div className="font-bold text-gray-900 mt-1">
            {selectedClient
              ? selectedClient.nameAr || selectedClient.nameEn || selectedClient.name
              : "—"}
          </div>
        </div>

        <div className="bg-white border rounded-2xl p-4 shadow-sm">
          <div className="text-sm text-gray-500">إجمالي المدين</div>
          <div className="font-bold text-gray-900 mt-1">
            QR {formatMoney(totalDebit)}
          </div>
        </div>

        <div className="bg-white border rounded-2xl p-4 shadow-sm">
          <div className="text-sm text-gray-500">إجمالي الدائن</div>
          <div className="font-bold text-green-700 mt-1">
            QR {formatMoney(totalCredit)}
          </div>
        </div>

        <div className="bg-white border rounded-2xl p-4 shadow-sm">
          <div className="text-sm text-gray-500">الرصيد</div>
          <div
            className={`font-bold mt-1 ${
              finalBalance > 0
                ? "text-red-700"
                : finalBalance < 0
                ? "text-green-700"
                : "text-gray-900"
            }`}
          >
            QR {formatMoney(finalBalance)}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border rounded-2xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b text-gray-600">
              <th className="p-3 text-right">التاريخ</th>
              <th className="p-3 text-right">النوع</th>
              <th className="p-3 text-right">مدين</th>
              <th className="p-3 text-right">دائن</th>
              <th className="p-3 text-right">الرصيد</th>
            </tr>
          </thead>

          <tbody>
            {(() => {
              let balance = openingBalance;

              return (
                <>
                  <tr className="border-b bg-gray-50">
                    <td className="p-3 text-gray-400">—</td>
                    <td className="p-3 font-semibold">رصيد سابق</td>
                    <td className="p-3">QR 0.00</td>
                    <td className="p-3">QR 0.00</td>
                    <td className="p-3 font-bold text-blue-700">
                      QR {formatMoney(openingBalance)}
                    </td>
                  </tr>

                  {data.map((row) => {
                    balance += Number(row.balanceImpact ?? 0);

                    return (
                      <tr key={row.id} className="border-b hover:bg-gray-50">
                        <td className="p-3">{row.entryDate}</td>

                        <td className="p-3">
                          {row.entryType === "invoice"
                            ? "فاتورة"
                            : row.entryType === "receipt"
                            ? "سند قبض"
                            : row.entryType === "advance"
                            ? "دفعة مقدمة"
                            : row.entryType}
                        </td>

                        <td className="p-3 font-medium">
                          QR {formatMoney(Number(row.debit || 0))}
                        </td>

                        <td className="p-3 font-medium text-green-700">
                          QR {formatMoney(Number(row.credit || 0))}
                        </td>

                        <td className="p-3 font-bold">
                          QR {formatMoney(balance)}
                        </td>
                      </tr>
                    );
                  })}

                  {data.length === 0 && (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-gray-500">
                        اختر العميل ثم اضغط بحث لعرض الحركات
                      </td>
                    </tr>
                  )}
                </>
              );
            })()}
          </tbody>
        </table>
      </div>
    </div>
  );
}
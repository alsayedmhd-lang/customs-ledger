import { useEffect, useState } from "react";

export default function CustomerLedgerPage() {
  const [data, setData] = useState<any[]>([]);
  const [openingBalance, setOpeningBalance] = useState(0);
  const [clients, setClients] = useState<any[]>([]);
  const [clientId, setClientId] = useState<number | "">("");

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
  }, []);

  const loadLedger = () => {
    if (!clientId) return;

    const from = (document.getElementById("fromDate") as HTMLInputElement)?.value;
    const to = (document.getElementById("toDate") as HTMLInputElement)?.value;

    fetch(
      `http://127.0.0.1:3000/api/customer-ledger/${clientId}?from=${from}&to=${to}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    )
      .then((res) => res.json())
      .then((res) => {
        setData(Array.isArray(res) ? res : res.rows ?? []);
        setOpeningBalance(res.openingBalance ?? 0);
      })
      .catch(console.error);
  };

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">ملخص العميل المالي</h1>

      <div className="grid grid-cols-4 gap-3 bg-white border rounded-xl p-4 items-end">
        <div>
          <label className="text-sm font-medium">العميل</label>
          <select
            className="w-full border rounded-lg p-2 mt-1"
            value={clientId}
            onChange={(e) =>
              setClientId(e.target.value ? Number(e.target.value) : "")
            }
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
          <label className="text-sm font-medium">من تاريخ</label>
          <input id="fromDate" type="date" className="w-full border rounded-lg p-2 mt-1" />
        </div>

        <div>
          <label className="text-sm font-medium">إلى تاريخ</label>
          <input id="toDate" type="date" className="w-full border rounded-lg p-2 mt-1" />
        </div>

        <div className="flex items-end">
          <button
              onClick={loadLedger}
               className="w-full bg-purple-600 text-white rounded-lg h-[42px]"
            >
            بحث
          </button>
        </div>
      </div>

      <table className="w-full border bg-white">
        <thead>
          <tr className="bg-gray-100">
            <th className="p-2 border">التاريخ</th>
            <th className="p-2 border">النوع</th>
            <th className="p-2 border">مدين</th>
            <th className="p-2 border">دائن</th>
            <th className="p-2 border">الرصيد</th>
          </tr>
        </thead>

        <tbody>
          {(() => {
            let balance = openingBalance;

            return (
              <>
                <tr className="bg-gray-50">
                  <td className="p-2 border text-gray-400">—</td>
                  <td className="p-2 border font-semibold">رصيد سابق</td>
                  <td className="p-2 border">0</td>
                  <td className="p-2 border">0</td>
                  <td className="p-2 border font-bold text-blue-600">
                    {openingBalance}
                  </td>
                </tr>

                {data.map((row) => {
                  balance += Number(row.balanceImpact ?? 0);

                  return (
                    <tr key={row.id}>
                      <td className="p-2 border">{row.entryDate}</td>

                      <td className="p-2 border">
                        {row.entryType === "invoice"
                          ? "فاتورة"
                          : row.entryType === "receipt"
                          ? "سند قبض"
                          : row.entryType === "advance"
                          ? "دفعة مقدمة"
                          : row.entryType}
                      </td>
                      <td className="p-2 border">{row.debit}</td>
                      <td className="p-2 border">{row.credit}</td>
                      <td className="p-2 border font-bold">{balance}</td>
                    </tr>
                  );
                })}
              </>
            );
          })()}
        </tbody>
      </table>
      </div>
    );
  }
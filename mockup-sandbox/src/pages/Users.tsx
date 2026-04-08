type Props = {
  lang: "ar" | "en";
};

export default function Users({ lang }: Props) {
  const isArabic = lang === "ar";

  const users = [
    {
      username: "admin",
      displayNameAr: "المدير",
      displayNameEn: "Administrator",
      roleAr: "مدير",
      roleEn: "Admin",
      statusAr: "نشط",
      statusEn: "Active",
      email: "admin@aroundworld.qa",
    },
    {
      username: "accountant",
      displayNameAr: "محاسب",
      displayNameEn: "Accountant",
      roleAr: "محاسب",
      roleEn: "Accountant",
      statusAr: "نشط",
      statusEn: "Active",
      email: "accountant@aroundworld.qa",
    },
    {
      username: "staff01",
      displayNameAr: "موظف",
      displayNameEn: "Staff User",
      roleAr: "موظف",
      roleEn: "Staff",
      statusAr: "غير نشط",
      statusEn: "Inactive",
      email: "staff01@aroundworld.qa",
    },
  ];

  return (
    <div
      dir={isArabic ? "rtl" : "ltr"}
      style={{
        padding: "24px",
        fontFamily: "system-ui",
        background: "#f3f4f6",
        minHeight: "100vh",
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
          <h1 style={{ margin: 0, fontSize: "42px", color: "#111827" }}>
            {isArabic ? "المستخدمون" : "Users"}
          </h1>
          <p style={{ marginTop: "8px", color: "#6b7280" }}>
            {isArabic
              ? "إدارة مستخدمي النظام والصلاحيات"
              : "Manage system users and permissions"}
          </p>
        </div>

        <button
          style={{
            border: "none",
            background: "#2563eb",
            color: "white",
            borderRadius: "14px",
            padding: "14px 18px",
            cursor: "pointer",
            fontSize: "16px",
            fontWeight: 600,
            boxShadow: "0 8px 18px rgba(37,99,235,0.25)",
          }}
        >
          {isArabic ? "+ مستخدم جديد" : "+ New User"}
        </button>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "16px",
          marginBottom: "24px",
        }}
      >
        <StatCard
          title={isArabic ? "إجمالي المستخدمين" : "Total Users"}
          value="3"
          color="#dbeafe"
        />
        <StatCard
          title={isArabic ? "المستخدمون النشطون" : "Active Users"}
          value="2"
          color="#dcfce7"
        />
        <StatCard
          title={isArabic ? "المديرون" : "Administrators"}
          value="1"
          color="#ede9fe"
        />
      </div>

      <div
        style={{
          background: "white",
          borderRadius: "22px",
          padding: "20px",
          boxShadow: "0 4px 14px rgba(0,0,0,0.06)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: isArabic ? "flex-start" : "flex-end",
            marginBottom: "18px",
          }}
        >
          <input
            placeholder={
              isArabic
                ? "بحث باسم المستخدم أو الاسم أو البريد..."
                : "Search by username, name, or email..."
            }
            style={{
              width: "100%",
              maxWidth: "360px",
              padding: "12px 14px",
              borderRadius: "12px",
              border: "1px solid #d1d5db",
              outline: "none",
              fontSize: "14px",
              background: "#f9fafb",
            }}
          />
        </div>

        <div style={{ overflowX: "auto" }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              minWidth: "950px",
            }}
          >
            <thead>
              <tr style={{ color: "#6b7280", fontSize: "14px" }}>
                <th style={thStyle}>{isArabic ? "اسم المستخدم" : "Username"}</th>
                <th style={thStyle}>{isArabic ? "الاسم" : "Name"}</th>
                <th style={thStyle}>{isArabic ? "البريد الإلكتروني" : "Email"}</th>
                <th style={thStyle}>{isArabic ? "الدور" : "Role"}</th>
                <th style={thStyle}>{isArabic ? "الحالة" : "Status"}</th>
                <th style={thStyle}>{isArabic ? "الإجراءات" : "Actions"}</th>
              </tr>
            </thead>

            <tbody>
              {users.map((user) => {
                const isActive =
                  (isArabic ? user.statusAr : user.statusEn) ===
                  (isArabic ? "نشط" : "Active");

                return (
                  <tr key={user.username} style={{ borderTop: "1px solid #e5e7eb" }}>
                    <td style={tdStyle}>
                      <span style={{ color: "#2563eb", fontWeight: 600 }}>
                        {user.username}
                      </span>
                    </td>

                    <td style={tdStyle}>
                      {isArabic ? user.displayNameAr : user.displayNameEn}
                    </td>

                    <td style={tdStyle}>{user.email}</td>

                    <td style={tdStyle}>
                      <span
                        style={{
                          display: "inline-block",
                          padding: "6px 12px",
                          borderRadius: "999px",
                          fontSize: "13px",
                          fontWeight: 600,
                          background:
                            (isArabic ? user.roleAr : user.roleEn) ===
                            (isArabic ? "مدير" : "Admin")
                              ? "#ede9fe"
                              : "#eff6ff",
                          color:
                            (isArabic ? user.roleAr : user.roleEn) ===
                            (isArabic ? "مدير" : "Admin")
                              ? "#7c3aed"
                              : "#1d4ed8",
                        }}
                      >
                        {isArabic ? user.roleAr : user.roleEn}
                      </span>
                    </td>

                    <td style={tdStyle}>
                      <span
                        style={{
                          display: "inline-block",
                          padding: "6px 12px",
                          borderRadius: "999px",
                          fontSize: "13px",
                          fontWeight: 600,
                          background: isActive ? "#dcfce7" : "#fee2e2",
                          color: isActive ? "#15803d" : "#dc2626",
                        }}
                      >
                        {isArabic ? user.statusAr : user.statusEn}
                      </span>
                    </td>

                    <td style={tdStyle}>
                      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                        <button style={iconButtonStyle}>
                          {isArabic ? "عرض" : "View"}
                        </button>
                        <button style={iconButtonStyle}>
                          {isArabic ? "تعديل" : "Edit"}
                        </button>
                        <button style={deleteButtonStyle}>
                          {isArabic ? "حذف" : "Delete"}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  color,
}: {
  title: string;
  value: string;
  color: string;
}) {
  return (
    <div
      style={{
        background: "white",
        borderRadius: "20px",
        padding: "20px",
        boxShadow: "0 4px 14px rgba(0,0,0,0.06)",
        border: `1px solid ${color}`,
      }}
    >
      <div style={{ color: "#6b7280", marginBottom: "10px" }}>{title}</div>
      <div style={{ fontSize: "30px", fontWeight: 700, color: "#111827" }}>
        {value}
      </div>
    </div>
  );
}

const thStyle: React.CSSProperties = {
  textAlign: "start",
  padding: "14px 12px",
  background: "#f8fafc",
  fontWeight: 700,
};

const tdStyle: React.CSSProperties = {
  padding: "16px 12px",
  textAlign: "start",
  color: "#111827",
};

const iconButtonStyle: React.CSSProperties = {
  border: "1px solid #d1d5db",
  background: "#f8fafc",
  color: "#334155",
  borderRadius: "10px",
  padding: "8px 12px",
  cursor: "pointer",
};

const deleteButtonStyle: React.CSSProperties = {
  border: "1px solid #fecaca",
  background: "#fff1f2",
  color: "#dc2626",
  borderRadius: "10px",
  padding: "8px 12px",
  cursor: "pointer",
};

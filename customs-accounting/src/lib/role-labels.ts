export const ROLE_LABELS_EN = {
  admin: "Admin",
  manager: "Manager",
  supervisor: "Supervisor",
  accountant: "Accountant",
  client: "Client",
  user: "User",
};

export const ROLE_LABELS_AR = {
  admin: "مدير",
  manager: "مدير",
  supervisor: "مشرف",
  accountant: "محاسب",
  client: "عميل",
  user: "مستخدم",
};

export function getRoleLabel(role?: string, isAR?: boolean) {
  const normalized = String(role || "user").toLowerCase();

  if (isAR) {
    return ROLE_LABELS_AR[normalized as keyof typeof ROLE_LABELS_AR] || "مستخدم";
  }

  return ROLE_LABELS_EN[normalized as keyof typeof ROLE_LABELS_EN] || "User";
}

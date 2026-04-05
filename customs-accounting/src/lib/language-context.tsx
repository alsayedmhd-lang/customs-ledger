import { createContext, useContext, useState, useEffect } from "react";

export type Lang = "ar" | "en";

const STORAGE_KEY = "app_language";

export const translations = {
  ar: {
    // Nav
    dashboard: "لوحة التحكم",
    clients: "العملاء",
    invoices: "الفواتير",
    receipts: "سندات القبض",
    statements: "كشوفات الحساب",
    templates: "نماذج البنود",
    users: "المستخدمون",
    trash: "سلة المحذوفات",
    accounting: "الحسابات",
    logout: "تسجيل الخروج",
    // Header
    settings: "الإعدادات",
    language: "اللغة",
    arabic: "العربية",
    english: "الإنجليزية",
    theme: "المظهر",
    lightMode: "فاتح",
    darkMode: "داكن",
    systemMode: "مع النظام",
    // General
    save: "حفظ",
    cancel: "إلغاء",
    delete: "حذف",
    edit: "تعديل",
    add: "إضافة",
    search: "بحث",
    close: "إغلاق",
    confirm: "تأكيد",
    restore: "استعادة",
    actions: "الإجراءات",
    loading: "جارٍ التحميل...",
    noData: "لا توجد بيانات",
    // Users page
    userManagement: "إدارة المستخدمين",
    userManagementDesc: "إضافة وتعديل وحذف حسابات المستخدمين",
    addUser: "إضافة مستخدم",
    userName: "المستخدم",
    username: "اسم المستخدم",
    role: "الدور",
    status: "الحالة",
    admin: "مدير",
    user: "مستخدم",
    active: "نشط",
    suspended: "موقوف",
    changePassword: "تغيير كلمة السر",
    permissions: "الصلاحيات",
    permissionsDesc: "تحديد ما يمكن للمستخدم فعله في النظام",
    canEditInvoices: "تعديل الفواتير",
    canDeleteInvoices: "حذف الفواتير",
    canEditReceipts: "تعديل السندات",
    canDeleteReceipts: "حذف السندات",
    canEditClients: "تعديل العملاء",
    canDeleteClients: "حذف العملاء",
    canManageTemplates: "إدارة النماذج",
    canViewStatements: "كشوفات الحساب",
    canViewAccounting: "صفحة الحسابات",
    // Invoice
    invoiceNumber: "رقم الفاتورة",
    client: "العميل",
    date: "التاريخ",
    total: "الإجمالي",
    tax: "الضريبة",
    subtotal: "المجموع قبل الضريبة",
    advancePayment: "دفعة مقدمة",
    notes: "ملاحظات",
    newInvoice: "فاتورة جديدة",
    createInvoice: "إنشاء الفاتورة",
    editInvoice: "تعديل الفاتورة",
    printInvoice: "طباعة الفاتورة",
    // Status
    draft: "مسودة",
    issued: "مُصدرة",
    paid: "مدفوعة",
    cancelled: "ملغاة",
    // Receipt
    receiptNumber: "رقم السند",
    amount: "المبلغ",
    paymentMethod: "طريقة الدفع",
    cash: "نقد",
    transfer: "تحويل",
    check: "شيك",
    newReceipt: "سند جديد",
    // Clients
    clientName: "اسم العميل",
    email: "البريد الإلكتروني",
    phone: "الهاتف",
    address: "العنوان",
    newClient: "عميل جديد",
    addClient: "إضافة عميل",
    // Trash
    trashTitle: "سلة المحذوفات",
    trashEmpty: "السلة فارغة",
    permanentDelete: "حذف نهائي",
    emptyTrash: "إفراغ السلة",
    deletedAt: "وقت الحذف",
    noDeletedInvoices: "لا توجد فواتير محذوفة",
    noDeletedReceipts: "لا توجد سندات محذوفة",
    invoiceWord: "الفاتورة",
    receiptWord: "سند القبض",
    restoredTitle: "تمت الاستعادة",
    restoredInvoiceDesc: "تمت استعادة الفاتورة بنجاح",
    restoredReceiptDesc: "تمت استعادة سند القبض بنجاح",
    permanentDeletedTitle: "تم الحذف النهائي",
    permanentDeletedInvoiceDesc: "تم حذف الفاتورة نهائياً",
    permanentDeletedReceiptDesc: "تم حذف السند نهائياً",
    emptiedTrashTitle: "تم إفراغ السلة",
    emptiedTrashDesc: "تم حذف جميع العناصر نهائياً",
    errorTitle: "خطأ",
    timeDays: "يوم",
    timeHours: "ساعة",
    timeJustNow: "منذ قليل",
    timeAgo: "منذ",
    // Confirmations
    confirmDeleteTitle: "تأكيد الحذف النهائي",
    confirmDeleteDesc: "هذا الإجراء لا يمكن التراجع عنه.",
    confirmEmptyTrash: "إفراغ السلة نهائياً",
    // Settings Panel
    settingsTitle: "الإعدادات",
    interfaceLanguage: "لغة الواجهة",
    interfaceTheme: "مظهر الواجهة",
    adminOnly: "هذه الصفحة للمديرين فقط",
    fullName: "الاسم الكامل",
    loginUsername: "اسم المستخدم (للدخول)",
    password: "كلمة السر",
    newPassword: "كلمة السر الجديدة",
    currentPassword: "كلمة السر الحالية",
    confirmPassword: "تأكيد كلمة السر",
    passwordMismatch: "كلمتا السر غير متطابقتين",
    // Pages
    invoicesDesc: "إدارة فواتير التخليص الجمركي",
    createInvoiceBtn: "إنشاء فاتورة",
    searchInvoicePlaceholder: "بحث برقم الفاتورة أو العميل أو رقم البيان أو البوليصة...",
    issuedDate: "صدرت",
    dueDate: "الاستحقاق",
    print: "طباعة",
    noInvoices: "لا توجد فواتير.",
    loadingInvoices: "جارٍ تحميل الفواتير...",
    receiptsDesc: "إدارة سندات القبض والمدفوعات",
    newReceiptBtn: "سند قبض جديد",
    searchReceiptPlaceholder: "بحث برقم السند، اسم العميل، أو رقم الفاتورة...",
    totalCollected: "إجمالي المبالغ المقبوضة",
    receiptCount: "عدد السندات",
    independentPayment: "دفعة مستقلة",
    noReceipts: "لا توجد سندات قبض",
    noReceiptsDesc: "ابدأ بإنشاء سند قبض جديد",
    deleteReceiptTitle: "حذف سند القبض",
    deleteReceiptDesc: "هل أنت متأكد من حذف هذا السند؟ لا يمكن التراجع عن هذا الإجراء.",
    invoiceRef: "الفاتورة",
    clientsDesc: "إدارة قاعدة بيانات العملاء",
    contactInfo: "بيانات التواصل",
    taxId: "الرقم الضريبي",
    addedOn: "أضيف",
    noClients: "لا يوجد عملاء.",
    addClientTitle: "إضافة عميل جديد",
    clientCompanyName: "الشركة / الاسم",
    clientCompanyPlaceholder: "اسم الشركة أو العميل",
    saving: "جارٍ الحفظ...",
    saveClient: "حفظ العميل",
    deleteClientConfirm: "هل أنت متأكد من حذف هذا العميل؟ لا يمكن التراجع عن هذا الإجراء.",
    deleting: "جارٍ الحذف...",
    searchClientPlaceholder: "بحث عن عميل...",
    dashboardDesc: "نظرة عامة على أنشطة التخليص الجمركي",
    totalRevenue: "إجمالي الإيرادات",
    outstanding: "مستحقات",
    totalClients: "إجمالي العملاء",
    totalInvoices: "إجمالي الفواتير",
    recentInvoices: "آخر الفواتير",
    viewAll: "عرض الكل",
    monthlyRevenue: "الإيرادات الشهرية",
    invoiceCount: "عدد الفواتير",
    interfaceCurrency: "عملة العرض",
    currencyAR: "ر.ق — ريال قطري",
    currencyEN: "QR — Qatari Riyal",
    currencyAuto: "تلقائي مع اللغة",
    // Templates page
    templatesDesc: "خدمات محفوظة لتسريع إنشاء الفواتير",
    addTemplate: "إضافة نموذج",
    noTemplates: "لا توجد نماذج. أضف أول نموذج خدمة.",
    templateDeleted: "تم حذف النموذج",
    editTemplate: "تعديل النموذج",
    newTemplate: "نموذج جديد",
    templateSaved: "تم حفظ النموذج",
    templateUpdated: "تم تحديث النموذج",
    serviceDescription: "وصف الخدمة",
    serviceDescPlaceholder: "رسوم التخليص الجمركي...",
    defaultUnitPriceLabel: "سعر الوحدة الافتراضي",
    saveTemplate: "حفظ النموذج",
    confirmDeleteTemplate: "هل تريد حذف هذا النموذج؟",
    descriptionRequired: "الوصف مطلوب",
    priceMustBePositive: "يجب أن يكون >= 0",
    // Statements page
    statementsDesc: "ملخص أرصدة جميع العملاء",
    allClientsStatement: "كشف عام بجميع العملاء",
    lastInvoiceCol: "آخر فاتورة",
    totalInvoicedCol: "إجمالي الفواتير",
    collectedCol: "المحصّل",
    outstandingBalance: "الرصيد المستحق",
    statementCol: "كشف الحساب",
    noClientsStatements: "لا يوجد عملاء بعد. أضف عملاءك من صفحة العملاء.",
    settledLabel: "مسدّد",
    outstandingLabel: "مستحق",
    grandTotal: "الإجمالي الكلي",
    viewStatement: "عرض الكشف",
    totalCollectedLabel: "إجمالي المحصّل",
    totalOutstandingLabel: "إجمالي المستحق",
  },
  en: {
    // Nav
    dashboard: "Dashboard",
    clients: "Clients",
    invoices: "Invoices",
    receipts: "Receipts",
    statements: "Account Statements",
    templates: "Item Templates",
    users: "Users",
    trash: "Trash",
    accounting: "Accounts",
    logout: "Sign Out",
    // Header
    settings: "Settings",
    language: "Language",
    arabic: "Arabic",
    english: "English",
    theme: "Theme",
    lightMode: "Light",
    darkMode: "Dark",
    systemMode: "System",
    // General
    save: "Save",
    cancel: "Cancel",
    delete: "Delete",
    edit: "Edit",
    add: "Add",
    search: "Search",
    close: "Close",
    confirm: "Confirm",
    restore: "Restore",
    actions: "Actions",
    loading: "Loading...",
    noData: "No data found",
    // Users page
    userManagement: "User Management",
    userManagementDesc: "Add, edit, and remove user accounts",
    addUser: "Add User",
    userName: "User",
    username: "Username",
    role: "Role",
    status: "Status",
    admin: "Admin",
    user: "User",
    active: "Active",
    suspended: "Suspended",
    changePassword: "Change Password",
    permissions: "Permissions",
    permissionsDesc: "Define what this user can do in the system",
    canEditInvoices: "Edit Invoices",
    canDeleteInvoices: "Delete Invoices",
    canEditReceipts: "Edit Receipts",
    canDeleteReceipts: "Delete Receipts",
    canEditClients: "Edit Clients",
    canDeleteClients: "Delete Clients",
    canManageTemplates: "Manage Templates",
    canViewStatements: "Account Statements",
    canViewAccounting: "Accounting Page",
    // Invoice
    invoiceNumber: "Invoice No.",
    client: "Client",
    date: "Date",
    total: "Total",
    tax: "Tax",
    subtotal: "Subtotal",
    advancePayment: "Advance Payment",
    notes: "Notes",
    newInvoice: "New Invoice",
    createInvoice: "Create Invoice",
    editInvoice: "Edit Invoice",
    printInvoice: "Print Invoice",
    // Status
    draft: "Draft",
    issued: "Issued",
    paid: "Paid",
    cancelled: "Cancelled",
    // Receipt
    receiptNumber: "Receipt No.",
    amount: "Amount",
    paymentMethod: "Payment Method",
    cash: "Cash",
    transfer: "Transfer",
    check: "Check",
    newReceipt: "New Receipt",
    // Clients
    clientName: "Client Name",
    email: "Email",
    phone: "Phone",
    address: "Address",
    newClient: "New Client",
    addClient: "Add Client",
    // Trash
    trashTitle: "Trash",
    trashEmpty: "Trash is empty",
    permanentDelete: "Delete Permanently",
    emptyTrash: "Empty Trash",
    deletedAt: "Deleted At",
    noDeletedInvoices: "No deleted invoices",
    noDeletedReceipts: "No deleted receipts",
    invoiceWord: "invoice",
    receiptWord: "receipt",
    restoredTitle: "Restored",
    restoredInvoiceDesc: "Invoice restored successfully",
    restoredReceiptDesc: "Receipt restored successfully",
    permanentDeletedTitle: "Permanently Deleted",
    permanentDeletedInvoiceDesc: "Invoice permanently deleted",
    permanentDeletedReceiptDesc: "Receipt permanently deleted",
    emptiedTrashTitle: "Trash Emptied",
    emptiedTrashDesc: "All items permanently deleted",
    errorTitle: "Error",
    timeDays: "days",
    timeHours: "hours",
    timeJustNow: "Just now",
    timeAgo: "ago",
    // Confirmations
    confirmDeleteTitle: "Confirm Permanent Deletion",
    confirmDeleteDesc: "This action cannot be undone.",
    confirmEmptyTrash: "Empty Trash Permanently",
    // Settings Panel
    settingsTitle: "Settings",
    interfaceLanguage: "Interface Language",
    interfaceTheme: "Interface Theme",
    adminOnly: "This page is for admins only",
    fullName: "Full Name",
    loginUsername: "Username (for login)",
    password: "Password",
    newPassword: "New Password",
    currentPassword: "Current Password",
    confirmPassword: "Confirm Password",
    passwordMismatch: "Passwords do not match",
    // Pages
    invoicesDesc: "Manage customs clearance invoices",
    createInvoiceBtn: "Create Invoice",
    searchInvoicePlaceholder: "Search by invoice number, client, shipment ref or bill of lading...",
    issuedDate: "Issued",
    dueDate: "Due",
    print: "Print",
    noInvoices: "No invoices found.",
    loadingInvoices: "Loading invoices...",
    receiptsDesc: "Manage receipts and payments",
    newReceiptBtn: "New Receipt",
    searchReceiptPlaceholder: "Search by receipt number, client name, or invoice...",
    totalCollected: "Total Amount Collected",
    receiptCount: "Receipt Count",
    independentPayment: "Independent Payment",
    noReceipts: "No receipts found",
    noReceiptsDesc: "Start by creating a new receipt",
    deleteReceiptTitle: "Delete Receipt",
    deleteReceiptDesc: "Are you sure you want to delete this receipt? This action cannot be undone.",
    invoiceRef: "Invoice",
    clientsDesc: "Manage client database",
    contactInfo: "Contact Info",
    taxId: "Tax ID",
    addedOn: "Added",
    noClients: "No clients found.",
    addClientTitle: "Add New Client",
    clientCompanyName: "Company / Name",
    clientCompanyPlaceholder: "Company or client name",
    saving: "Saving...",
    saveClient: "Save Client",
    deleteClientConfirm: "Are you sure you want to delete this client? This action cannot be undone.",
    deleting: "Deleting...",
    searchClientPlaceholder: "Search for a client...",
    dashboardDesc: "Overview of customs clearance activities",
    totalRevenue: "Total Revenue",
    outstanding: "Outstanding",
    totalClients: "Total Clients",
    totalInvoices: "Total Invoices",
    recentInvoices: "Recent Invoices",
    viewAll: "View All",
    monthlyRevenue: "Monthly Revenue",
    invoiceCount: "Invoice Count",
    interfaceCurrency: "Display Currency",
    currencyAR: "ر.ق — Qatari Riyal (AR)",
    currencyEN: "QR — Qatari Riyal (EN)",
    currencyAuto: "Auto with language",
    // Templates page
    templatesDesc: "Saved services to speed up invoice creation",
    addTemplate: "Add Template",
    noTemplates: "No templates found. Add your first service template.",
    templateDeleted: "Template deleted",
    editTemplate: "Edit Template",
    newTemplate: "New Template",
    templateSaved: "Template saved",
    templateUpdated: "Template updated",
    serviceDescription: "Service Description",
    serviceDescPlaceholder: "Customs clearance fees...",
    defaultUnitPriceLabel: "Default Unit Price",
    saveTemplate: "Save Template",
    confirmDeleteTemplate: "Delete this template?",
    descriptionRequired: "Description is required",
    priceMustBePositive: "Must be >= 0",
    // Statements page
    statementsDesc: "Summary of all client balances",
    allClientsStatement: "All Clients Statement",
    lastInvoiceCol: "Last Invoice",
    totalInvoicedCol: "Total Invoiced",
    collectedCol: "Collected",
    outstandingBalance: "Outstanding Balance",
    statementCol: "Statement",
    noClientsStatements: "No clients yet. Add clients from the Clients page.",
    settledLabel: "Settled",
    outstandingLabel: "Outstanding",
    grandTotal: "Grand Total",
    viewStatement: "View Statement",
    totalCollectedLabel: "Total Collected",
    totalOutstandingLabel: "Total Outstanding",
  },
};

const CURRENCY_KEY = "currency_symbol";
const CURRENCY_MANUAL_KEY = "currency_manual";

const DEFAULT_CURRENCY: Record<Lang, string> = {
  ar: "ر.ق",
  en: "QR",
};

type TranslationKeys = keyof typeof translations.ar;

interface LanguageContextType {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: TranslationKeys) => string;
  isRTL: boolean;
  currencySymbol: string;
  setCurrencySymbol: (symbol: string, manual?: boolean) => void;
}

const LanguageContext = createContext<LanguageContextType | null>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    return (localStorage.getItem(STORAGE_KEY) as Lang) ?? "ar";
  });

  const [currencySymbol, setCurrencyState] = useState<string>(() => {
    return localStorage.getItem(CURRENCY_KEY) ?? DEFAULT_CURRENCY[(localStorage.getItem(STORAGE_KEY) as Lang) ?? "ar"];
  });

  useEffect(() => {
    document.documentElement.setAttribute("dir", lang === "ar" ? "rtl" : "ltr");
    document.documentElement.setAttribute("lang", lang);
    localStorage.setItem(STORAGE_KEY, lang);
    // Auto-sync currency when language changes (unless manually overridden)
    if (!localStorage.getItem(CURRENCY_MANUAL_KEY)) {
      const auto = DEFAULT_CURRENCY[lang];
      setCurrencyState(auto);
      localStorage.setItem(CURRENCY_KEY, auto);
    }
  }, [lang]);

  function setLang(l: Lang) {
    setLangState(l);
  }

  function setCurrencySymbol(symbol: string, manual = true) {
    setCurrencyState(symbol);
    localStorage.setItem(CURRENCY_KEY, symbol);
    if (manual) {
      localStorage.setItem(CURRENCY_MANUAL_KEY, "true");
    } else {
      localStorage.removeItem(CURRENCY_MANUAL_KEY);
    }
  }

  function t(key: TranslationKeys): string {
    return translations[lang][key] ?? translations.ar[key] ?? key;
  }

  return (
    <LanguageContext.Provider value={{ lang, setLang, t, isRTL: lang === "ar", currencySymbol, setCurrencySymbol }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used inside LanguageProvider");
  return ctx;
}

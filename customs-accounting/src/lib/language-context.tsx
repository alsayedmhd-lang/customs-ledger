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
    customerLedger: "ملخص العميل المالي",
    statements: "كشوفات الحساب",
    statement:"كشف الحساب",
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
    savedRowsSuccess: "تم حفظ",
    cancel: "إلغاء",
    delete: "حذف",
    edit: "تعديل",
    add: "إضافة",
    search: "بحث",
    close: "إغلاق",
    confirm: "تأكيد",
    restore: "استعادة",
    actions: "الإجراءات",
    copy: "نسخ",
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
    shipmentRef: "رقم البيان",
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
    clientData: "بيانات العميل",
    nameRequired: "الاسم مطلوب",
    invalidEmail: "بريد إلكتروني غير صحيح",
    email: "البريد الإلكتروني",
    phone: "الهاتف",
    address: "العنوان",
    newClient: "عميل جديد",
    addClient: "إضافة عميل",
    backToClients: "العودة إلى العملاء",
    financialSummary: "ملخص مالي",
    taxNumber: "الرقم الضريبي",
    noEmail: "لا يوجد بريد إلكتروني",
    noPhone: "لا يوجد هاتف",
    noAddress: "لا يوجد عنوان",
    loadingClient: "جارٍ تحميل بيانات العميل...",
    clientNotFound: "العميل غير موجود",
    searchInvoiceDeclarationBl: "بحث برقم الفاتورة أو البيان أو البوليصة",
    editClient: "تعديل بيانات العميل",
    addClientError: "خطأ في إضافة العميل",
    editClientError: "خطأ في تعديل بيانات العميل",
    deleteClientError: "خطأ في حذف العميل",
    clientAdded: "تم إضافة العميل بنجاح",
    clientDeleted: "تم حذف العميل بنجاح",
    clientRestored: "تم استعادة العميل بنجاح",
    clientSaved: "تم حفظ بيانات العميل بنجاح",
    clientUpdated: "تم تحديث بيانات العميل بنجاح",
    error: "خطأ",
    saveChanges: "حفظ التغييرات",
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
    confirmDeleteTitle: "تأكيد الحذف ",
    confirmDeleteDesc: "سيتم نقل الفاتورة إلى سلة المحذوفات.",
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
    searchInvoicePlaceholder:
      "بحث برقم الفاتورة أو العميل أو رقم البيان أو البوليصة...",
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
    deleteReceiptDesc: "سيتم نقل سند القبض إلى سلة المحذوفات.",
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
    deleteClientConfirm:
      "هل أنت متأكد من حذف هذا العميل؟ لا يمكن التراجع عن هذا الإجراء.",
    deleting: "جارٍ الحذف...",
    searchClientPlaceholder: "بحث عن عميل...",
    dashboardDesc: "نظرة عامة على أنشطة الشركة",
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
    // accountant page
    accountingDetailedTable: "جدول الحسابات التفصيلي",
    showing: "يُعرض",
    payments: "المدفوعات",
    unpaidTransportation: "نقليات غير مسددة",
    unpaidLabor: "عمال غير مسددة",
    unpaidOtherExpenses: "مصاريف غير مسددة",
    netIncome: "صافي الدخل",
    showAmounts: "إظهار الأرقام",
    hideAmounts: "إخفاء الأرقام",
    saveAllChanges: "حفظ جميع التغييرات",
    searchAndFilters: "البحث والتصفية",
    clearAll: "مسح الكل",
    quickSearch: "بحث سريع",
    searchInvoiceOrClient: "رقم الفاتورة أو اسم العميل...",
    allClients: "جميع العملاء",
    dateRange: "نطاق التاريخ",
    driver: "السائق",
    allDrivers: "جميع السائقين",
    unloadLocation: "مكان التنزيل",
    allLocations: "جميع المواقع",
    invoiceAmount: "مبلغ الفاتورة",
    transportation: "النقليات",
    driverName: "اسم السائق",
    labor: "العمال",
    otherExpenses: "مصاريف أخرى",
    income: "الدخل",
    myPayments: "مدفوعاتي",
    transportationGroup: "مجموعة النقليات",
    laborGroup: "مجموعة العمال",
    otherExpensesGroup: "مجموعة أخرى",
    markTransportationPaid: "تسديد النقليات",
    markLaborPaid: "تسديد العمال",
    markOtherExpensesPaid: "تسديد المصاريف",
    Location: "الموقع",
    saveFailed: "فشل الحفظ",
    tryAgain: "حاول مرة أخرى",
    noPermission: "ليس لديك صلاحية",
    noAccountingPermission:
      "لا تملك صلاحية الوصول إلى صفحة الحسابات. تواصل مع المدير.",
  },
  en: {
    // Nav
    dashboard: "Dashboard",
    clients: "Clients",
    invoices: "Invoices",
    receipts: "Receipts",
    customerLedger: "Customer Financial Summary",
    statements: "Account Statements",
    statement:"Account Statement",
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
    savedRowsSuccess: "Saved",
    cancel: "Cancel",
    delete: "Delete",
    edit: "Edit",
    add: "Add",
    search: "Search",
    close: "Close",
    confirm: "Confirm",
    restore: "Restore",
    actions: "Actions",
    copy: "Copy",
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
    shipmentRef: "Declaration No.",
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
    clientData: "Client Data",
    nameRequired: "Name is required",
    invalidEmail: "Invalid email address",
    email: "Email",
    phone: "Phone",
    address: "Address",
    newClient: "New Client",
    addClient: "Add Client",
    backToClients: "Back to Clients",
    financialSummary: "Financial Summary",
    taxNumber: "Tax Number",
    noEmail: "No Email",
    noPhone: "No Phone",
    noAddress: "No Address",
    loadingClient: "Loading client data...",
    clientNotFound: "Client not found",
    searchInvoiceDeclarationBl: "Search invoice, declaration, or B/L",
    clientUpdated: "Client updated successfully",
    error: "Error",
    saveChanges: "Save Changes",
    editClient: "Edit Client Data",
    clientAdded: "Client added successfully",
    clientDeleted: "Client deleted successfully",
    clientRestored: "Client restored successfully",
    clientSaved: "Client data saved successfully",
    addClientError: "Error adding client",
    editClientError: "Error editing client",
    deleteClientError: "Error deleting client",
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
    searchInvoicePlaceholder:
      "Search by invoice number, client, shipment ref or bill of lading...",
    issuedDate: "Issued",
    dueDate: "Due",
    print: "Print",
    noInvoices: "No invoices found.",
    loadingInvoices: "Loading invoices...",
    receiptsDesc: "Manage receipts and payments",
    newReceiptBtn: "New Receipt",
    searchReceiptPlaceholder:
      "Search by receipt number, client name, or invoice...",
    totalCollected: "Total Amount Collected",
    receiptCount: "Receipt Count",
    independentPayment: "Independent Payment",
    noReceipts: "No receipts found",
    noReceiptsDesc: "Start by creating a new receipt",
    deleteReceiptTitle: "Delete Receipt",
    deleteReceiptDesc:
      "Are you sure you want to delete this receipt? This action cannot be undone.",
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
    deleteClientConfirm:
      "Are you sure you want to delete this client? This action cannot be undone.",
    deleting: "Deleting...",
    searchClientPlaceholder: "Search for a client...",
    dashboardDesc: "Overview of company activities",
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
    // accountant page
    accountingDetailedTable: "Detailed Accounting Table",
    showing: "Showing",
    payments: "Payments",
    unpaidTransportation: "Unpaid Transportation",
    unpaidLabor: "Unpaid Labor",
    unpaidOtherExpenses: "Unpaid Expenses",
    netIncome: "Net Income",
    showAmounts: "Show Amounts",
    hideAmounts: "Hide Amounts",
    saveAllChanges: "Save All Changes",
    searchAndFilters: "Search & Filters",
    clearAll: "Clear All",
    quickSearch: "Quick Search",
    searchInvoiceOrClient: "Invoice number or client name...",
    allClients: "All Clients",
    dateRange: "Date Range",
    driver: "Driver",
    allDrivers: "All Drivers",
    unloadLocation: "Unload Location",
    allLocations: "All Locations",
    invoiceAmount: "Invoice Amount",
    transportation: "Transportation",
    driverName: "Driver Name",
    labor: "Labor",
    otherExpenses: "Other Expenses",
    income: "Income",
    myPayments: "My Payments",
    transportationGroup: "Transportation Group",
    laborGroup: "Labor Group",
    otherExpensesGroup: "Other Expenses Group",
    markTransportationPaid: "Mark Transportation Paid",
    markLaborPaid: "Mark Labor Paid",
    markOtherExpensesPaid: "Mark Other Expenses Paid",
    Location: "Location",
    saveFailed: "Save failed",
    tryAgain: "Please try again",
    noPermission: "Access denied",
    noAccountingPermission:
      "You do not have permission to access the Accounting page. Please contact your administrator.",
  },
};

const CURRENCY_KEY = "currency_symbol";
const CURRENCY_MANUAL_KEY = "currency_manual";

const DEFAULT_CURRENCY: Record<Lang, string> = {
  ar: "ر.ق",
  en: "QR",
};

type TranslationKeys = keyof typeof translations.ar;

export type CurrencyDisplayMode = "ar" | "en" | "symbol";

export interface CurrencyOption {
  code: string;
  arabic: string;
  english: string;
  symbol?: string;
}

export const CURRENCIES: CurrencyOption[] = [
  { code: "QAR", arabic: "ريال قطري", english: "QR", symbol: "ر.ق" },
  { code: "SAR", arabic: "ريال سعودي", english: "SAR", symbol: "ر.س" },
  { code: "AED", arabic: "درهم إماراتي", english: "AED", symbol: "د.إ" },
  { code: "KWD", arabic: "دينار كويتي", english: "KWD", symbol: "د.ك" },
  { code: "OMR", arabic: "ريال عماني", english: "OMR", symbol: "ر.ع" },
  { code: "BHD", arabic: "دينار بحريني", english: "BHD", symbol: "د.ب" },
  { code: "JOD", arabic: "دينار أردني", english: "JOD", symbol: "د.أ" },
  { code: "EGP", arabic: "جنيه مصري", english: "EGP", symbol: "ج.م" },
  { code: "USD", arabic: "دولار أمريكي", english: "USD", symbol: "$" },
  { code: "EUR", arabic: "يورو", english: "EUR", symbol: "€" },
  { code: "GBP", arabic: "جنيه إسترليني", english: "GBP", symbol: "£" },
  { code: "TRY", arabic: "ليرة تركية", english: "TRY", symbol: "₺" },
  { code: "CHF", arabic: "فرنك سويسري", english: "CHF" },
  { code: "JPY", arabic: "ين ياباني", english: "JPY", symbol: "¥" },
  { code: "CNY", arabic: "يوان صيني", english: "CNY", symbol: "¥" },
  { code: "CAD", arabic: "دولار كندي", english: "CAD", symbol: "C$" },
  { code: "AUD", arabic: "دولار أسترالي", english: "AUD", symbol: "A$" },
  { code: "INR", arabic: "روبية هنديّة", english: "INR", symbol: "₹" },
  { code: "ZAR", arabic: "راند جنوبي", english: "ZAR", symbol: "R" },
  { code: "RUB", arabic: "روبل روسي", english: "RUB", symbol: "₽" },
];

interface LanguageContextType {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: TranslationKeys) => string;
  isRTL: boolean;

  currencySymbol: string;
  setCurrencySymbol: (symbol: string, manual?: boolean) => void;

  currencyCode: string;
  setCurrencyCode: (code: string) => void;

  currencyDisplayMode: "ar" | "en" | "symbol";
  setCurrencyDisplayMode: (mode: "ar" | "en" | "symbol") => void;
}

const LanguageContext = createContext<LanguageContextType | null>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    return (localStorage.getItem(STORAGE_KEY) as Lang) ?? "ar";
  });

const [currencyCode, setCurrencyCodeState] = useState<string>(() => {
  return localStorage.getItem("currency_code") ?? "QAR";
  });

  const [currencyDisplayMode, setCurrencyDisplayModeState] =
    useState<CurrencyDisplayMode>(() => {
      const saved = localStorage.getItem("currency_display_mode");
      return saved === "ar" || saved === "en" || saved === "symbol"
        ? saved
        : "symbol";
    });

  const getCurrencySymbol = (
    code: string,
    mode: CurrencyDisplayMode
  ): string => {
    const currency = CURRENCIES.find((item) => item.code === code) ?? CURRENCIES[0];

    if (mode === "ar") {
      return currency.arabic;
    }

    if (mode === "en") {
      return currency.english;
    }

    return currency.symbol ?? currency.english;
  };

  const [currencySymbol, setCurrencyState] = useState<string>(() =>
    getCurrencySymbol(
      localStorage.getItem("currency_code") ?? "QAR",
      (() => {
        const saved = localStorage.getItem("currency_display_mode");
        return saved === "ar" || saved === "en" || saved === "symbol"
          ? saved
          : "symbol";
      })()
    )
  );

  useEffect(() => {
    document.documentElement.setAttribute("dir", lang === "ar" ? "rtl" : "ltr");
    document.documentElement.setAttribute("lang", lang);
    localStorage.setItem(STORAGE_KEY, lang);

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

  function setCurrencyCode(code: string) {
    setCurrencyCodeState(code);
    localStorage.setItem("currency_code", code);

    const displaySymbol = getCurrencySymbol(code, currencyDisplayMode);
    setCurrencyState(displaySymbol);
    localStorage.setItem(CURRENCY_KEY, displaySymbol);
  }

  function setCurrencyDisplayMode(mode: CurrencyDisplayMode) {
    setCurrencyDisplayModeState(mode);
    localStorage.setItem("currency_display_mode", mode);

    const displaySymbol = getCurrencySymbol(currencyCode, mode);
    setCurrencyState(displaySymbol);
    localStorage.setItem(CURRENCY_KEY, displaySymbol);
  }

  function t(key: TranslationKeys): string {
    return translations[lang][key] ?? translations.ar[key] ?? key;
  }

  return (
    <LanguageContext.Provider
      value={{
        lang,
        setLang,
        t,
        isRTL: lang === "ar",
        currencySymbol,
        setCurrencySymbol,
        currencyCode,
        setCurrencyCode,
        currencyDisplayMode,
        setCurrencyDisplayMode,
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used inside LanguageProvider");
  return ctx;
}

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  display_name TEXT NOT NULL,
  display_name_ar TEXT,
  display_name_en TEXT,
  role TEXT DEFAULT 'user',
  is_active INTEGER DEFAULT 1,
  pending_approval INTEGER DEFAULT 0,
  permissions TEXT DEFAULT '{"canEditInvoices":true,"canDeleteInvoices":true,"canEditReceipts":true,"canDeleteReceipts":true,"canEditClients":true,"canDeleteClients":true,"canManageTemplates":true,"canViewStatements":true,"canViewAccounting":true,"canCustomizePrintContact":false}',
  email TEXT,
  phone TEXT,
  whatsapp_api_key TEXT,
  two_factor_email INTEGER DEFAULT 0,
  two_factor_whatsapp INTEGER DEFAULT 0,
  created_at INTEGER
);

CREATE TABLE IF NOT EXISTS clients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  address TEXT,
  tax_id TEXT,
  notes TEXT,
  created_at INTEGER,
  updated_at INTEGER
);

CREATE TABLE IF NOT EXISTS company_settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name_ar TEXT NOT NULL DEFAULT 'اسم الشركة للتخليص الجمركي',
  name_en TEXT NOT NULL DEFAULT 'Company Name Customs Clearance',
  subtitle_ar TEXT DEFAULT 'للتخليص الجمركي',
  subtitle_en TEXT DEFAULT 'Customs Clearance',
  tagline_ar TEXT DEFAULT 'خدمات التخليص الجمركي والشحن',
  tagline_en TEXT DEFAULT 'Customs Clearance & Shipping Services',
  email TEXT DEFAULT 'your email',
  phone TEXT DEFAULT 'your phone',
  address TEXT DEFAULT 'your address',
  po_box TEXT DEFAULT 'your P.O. Box',
  website TEXT,
  cr_number TEXT,
  tax_number TEXT,
  logo_base64 TEXT,
  stamp_base64 TEXT,
  watermark_base64 TEXT,
  show_watermark INTEGER DEFAULT 1,
  show_stamp_on_invoices INTEGER DEFAULT 1,
  show_stamp_on_receipts INTEGER DEFAULT 1,
  show_stamp_on_statements INTEGER DEFAULT 1,
  footer_text TEXT,
  invoice_cash_title_ar TEXT,
  invoice_cash_title_en TEXT,
  invoice_credit_title_ar TEXT,
  invoice_credit_title_en TEXT,
  invoice_title_font_size INTEGER DEFAULT 25,
  accountant_signature_base64 TEXT,
  receiver_signature_base64 TEXT,
  show_accountant_signature INTEGER DEFAULT 1,
  show_receiver_signature INTEGER DEFAULT 1,
  updated_at INTEGER
);

CREATE TABLE IF NOT EXISTS invoices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_number TEXT NOT NULL,
  client_id INTEGER NOT NULL,
  issue_date TEXT NOT NULL,
  due_date TEXT,
  status TEXT DEFAULT 'draft',
  subtotal REAL DEFAULT 0,
  tax_rate REAL DEFAULT 0,
  tax_amount REAL DEFAULT 0,
  total REAL DEFAULT 0,
  notes TEXT,
  shipment_ref TEXT,
  bill_of_lading TEXT,
  package_count INTEGER,
  shipment_weight REAL,
  port_of_entry TEXT,
  importer_exporter_name TEXT,
  advance_payment REAL DEFAULT 0,
  created_by INTEGER,
  deleted_at INTEGER,
  created_at INTEGER,
  updated_at INTEGER
);

CREATE TABLE IF NOT EXISTS invoice_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_id INTEGER NOT NULL,
  description TEXT NOT NULL,
  quantity REAL NOT NULL,
  unit_price REAL NOT NULL,
  total REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS invoice_item_templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  description TEXT NOT NULL,
  default_unit_price REAL DEFAULT 0,
  created_at INTEGER
);

CREATE TABLE IF NOT EXISTS invoice_accounting (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_id INTEGER NOT NULL,
  payments REAL DEFAULT 0,
  transportation REAL DEFAULT 0,
  labor REAL DEFAULT 0,
  other_expenses REAL DEFAULT 0,
  driver_name TEXT,
  unload_location TEXT,
  transportation_paid INTEGER DEFAULT 0,
  labor_paid INTEGER DEFAULT 0,
  other_expenses_paid INTEGER DEFAULT 0,
  updated_at INTEGER
);

CREATE TABLE IF NOT EXISTS receipts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  receipt_number TEXT NOT NULL,
  client_id INTEGER NOT NULL,
  invoice_id INTEGER,
  amount REAL NOT NULL,
  payment_method TEXT DEFAULT 'cash',
  notes TEXT,
  receipt_date TEXT NOT NULL,
  deleted_at INTEGER,
  created_at INTEGER
);
CREATE TABLE IF NOT EXISTS otp_codes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  code TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  used_at INTEGER,
  created_at INTEGER
);
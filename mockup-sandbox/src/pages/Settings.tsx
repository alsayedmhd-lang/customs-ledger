import { useMemo, useState, type ReactNode } from "react";

type Props = {
  lang: "ar" | "en";
};

type Section =
  | "display"
  | "preview"
  | "identity"
  | "contact"
  | "legal"
  | "branding"
  | "print";

type TranslationMap = {
  pageTitle: string;
  pageSubtitle: string;
  admin: string;
  administrator: string;
  saveChanges: string;
  display: string;
  preview: string;
  identity: string;
  contact: string;
  legal: string;
  branding: string;
  print: string;
  globalNotice: string;
  companyNameArabic: string;
  companyNameEnglish: string;
  subtitleArabic: string;
  subtitleEnglish: string;
  taglineArabic: string;
  taglineEnglish: string;
  email: string;
  phone: string;
  address: string;
  poBox: string;
  website: string;
  crNumber: string;
  vatNumber: string;
  interfaceTheme: string;
  primaryColor: string;
  sidebarColor: string;
  appBackground: string;
  borderRadius: string;
  displayDensity: string;
  extraOptions: string;
  invoicePreview: string;
  livePreview: string;
  legalInformation: string;
  contactInformation: string;
  companyIdentity: string;
  brandingHeader: string;
  printSettings: string;
  printHeader: string;
  footerText: string;
  light: string;
  dark: string;
  system: string;
  none: string;
  color: string;
  image: string;
  sharp: string;
  normal: string;
  rounded: string;
  compact: string;
  comfortable: string;
  glassSidebar: string;
  glassSidebarHint: string;
  animations: string;
  animationsHint: string;
  showLogo: string;
  showStamp: string;
  showWatermark: string;
  a4Portrait: string;
  a4Landscape: string;
  thermal: string;
  upload: string;
  companyLogo: string;
  companyStamp: string;
  watermark: string;
  max2mb: string;
  transparentMax2mb: string;
  transparentFallback: string;
};

export default function Settings({ lang }: Props) {
  const isArabic = lang === "ar";
  const [activeSection, setActiveSection] = useState<Section>("identity");

  const t: TranslationMap = useMemo(
    () => ({
      pageTitle: isArabic ? "إعدادات البرنامج" : "App Settings",
      pageSubtitle: isArabic
        ? "تحكم كامل في هوية الشركة وإعدادات الطباعة"
        : "Full control over company identity and print settings",
      admin: isArabic ? "المدير" : "Admin",
      administrator: isArabic ? "مدير" : "Administrator",
      saveChanges: isArabic ? "حفظ التغييرات" : "Save Changes",
      display: isArabic ? "المظهر" : "Display",
      preview: isArabic ? "المعاينة" : "Preview",
      identity: isArabic ? "هوية الشركة" : "Identity",
      contact: isArabic ? "التواصل" : "Contact",
      legal: isArabic ? "القانونية" : "Legal",
      branding: isArabic ? "العلامة التجارية" : "Branding",
      print: isArabic ? "الطباعة" : "Print",
      globalNotice: isArabic
        ? "جميع التغييرات يتم تطبيقها فورًا في كامل البرنامج وصفحات الطباعة عند الحفظ — لا حاجة لإعادة التشغيل."
        : "All changes are applied instantly across the entire app and print pages upon saving — no restart needed.",
      companyNameArabic: isArabic ? "اسم الشركة (عربي)" : "Company Name (Arabic)",
      companyNameEnglish: isArabic
        ? "اسم الشركة (إنجليزي)"
        : "Company Name (English)",
      subtitleArabic: isArabic ? "الترجمة الثانوية (عربي)" : "Subtitle (Arabic)",
      subtitleEnglish: isArabic
        ? "الترجمة الثانوية (إنجليزي)"
        : "Subtitle (English)",
      taglineArabic: isArabic ? "الوصف (عربي)" : "Tagline (Arabic)",
      taglineEnglish: isArabic ? "الوصف (إنجليزي)" : "Tagline (English)",
      email: isArabic ? "البريد الإلكتروني" : "Email",
      phone: isArabic ? "الهاتف" : "Phone",
      address: isArabic ? "العنوان" : "Address",
      poBox: isArabic ? "صندوق البريد" : "P.O Box",
      website: isArabic ? "الموقع الإلكتروني" : "Website",
      crNumber: isArabic ? "رقم السجل التجاري" : "Commercial Registration No.",
      vatNumber: isArabic ? "الرقم الضريبي / VAT" : "Tax / VAT Number",
      interfaceTheme: isArabic ? "نسق الواجهة" : "Interface Theme",
      primaryColor: isArabic ? "اللون الأساسي" : "Primary Color",
      sidebarColor: isArabic ? "لون الشريط الجانبي" : "Sidebar Color",
      appBackground: isArabic ? "خلفية التطبيق" : "App Background",
      borderRadius: isArabic ? "استدارة الحواف" : "Border Radius",
      displayDensity: isArabic ? "كثافة العرض" : "Display Density",
      extraOptions: isArabic ? "خيارات إضافية" : "Extra Options",
      invoicePreview: isArabic ? "معاينة رأس الفاتورة" : "Invoice Header Preview",
      livePreview: isArabic
        ? "هذه معاينة مباشرة تعكس البيانات الموجودة في الأقسام الأخرى."
        : "This is a live preview reflecting the data in the other sections.",
      legalInformation: isArabic ? "المعلومات القانونية" : "Legal Information",
      contactInformation: isArabic ? "معلومات التواصل" : "Contact Information",
      companyIdentity: isArabic ? "هوية الشركة" : "Company Identity",
      brandingHeader: isArabic
        ? "الشعار والختم والعلامة المائية"
        : "Logo, Stamp & Watermark",
      printSettings: isArabic ? "إعدادات الطباعة" : "Print Settings",
      printHeader: isArabic ? "ترويسة الطباعة" : "Print Header",
      footerText: isArabic ? "نص التذييل" : "Footer Text",
      light: isArabic ? "فاتح" : "Light",
      dark: isArabic ? "داكن" : "Dark",
      system: isArabic ? "النظام" : "System",
      none: isArabic ? "بدون" : "None",
      color: isArabic ? "لون" : "Color",
      image: isArabic ? "صورة" : "Image",
      sharp: isArabic ? "حاد" : "Sharp",
      normal: isArabic ? "عادي" : "Normal",
      rounded: isArabic ? "دائري" : "Rounded",
      compact: isArabic ? "مضغوط" : "Compact",
      comfortable: isArabic ? "مريح" : "Comfortable",
      glassSidebar: isArabic ? "تأثير زجاجي للشريط الجانبي" : "Glass Sidebar Effect",
      glassSidebarHint: isArabic
        ? "إضافة تأثير ضبابي خفيف للشريط الجانبي"
        : "Frosted glass blur effect on the sidebar",
      animations: isArabic ? "الحركات" : "Animations",
      animationsHint: isArabic
        ? "تفعيل أو تعطيل الانتقالات والحركات"
        : "Enable or disable UI transitions and motion effects",
      showLogo: isArabic ? "إظهار الشعار" : "Show Logo",
      showStamp: isArabic ? "إظهار الختم" : "Show Stamp",
      showWatermark: isArabic ? "إظهار العلامة المائية" : "Show Watermark",
      a4Portrait: isArabic ? "A4 رأسي" : "A4 Portrait",
      a4Landscape: isArabic ? "A4 أفقي" : "A4 Landscape",
      thermal: isArabic ? "حراري" : "Thermal",
      upload: isArabic ? "رفع" : "Upload",
      companyLogo: isArabic ? "شعار الشركة" : "Company Logo",
      companyStamp: isArabic ? "ختم الشركة" : "Company Stamp",
      watermark: isArabic ? "العلامة المائية" : "Watermark",
      max2mb: isArabic ? "PNG/JPG - الحد الأقصى 2MB" : "PNG/JPG - Max 2 MB",
      transparentMax2mb: isArabic
        ? "PNG شفاف - الحد الأقصى 2MB"
        : "Transparent PNG - Max 2 MB",
      transparentFallback: isArabic
        ? "خلفية طباعة شفافة - يتم الرجوع للشعار عند عدم التوفر"
        : "Transparent print background - Falls back to logo",
    }),
    [isArabic]
  );

  return (
    <div
      dir={isArabic ? "rtl" : "ltr"}
      style={{
        minHeight: "100%",
        padding: "20px 8px",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: isArabic ? "row-reverse" : "row",
          gap: "18px",
          alignItems: "flex-start",
          flexWrap: "wrap",
        }}
      >
        <div style={{ width: "290px", minWidth: "290px" }}>
          <SidebarColumn
            isArabic={isArabic}
            activeSection={activeSection}
            setActiveSection={setActiveSection}
            t={t}
          />
        </div>

        <div style={{ flex: 1, minWidth: "340px" }}>
          <div
            style={{
              marginBottom: "16px",
              textAlign: isArabic ? "right" : "left",
            }}
          >
            <h1
              style={{
                margin: 0,
                color: "#0f172a",
                fontSize: "42px",
                lineHeight: 1.08,
                fontWeight: 900,
                letterSpacing: "-0.02em",
              }}
            >
              {t.pageTitle}
            </h1>

            <div
              style={{
                marginTop: "8px",
                color: "#64748b",
                fontSize: "14px",
              }}
            >
              {t.pageSubtitle}
            </div>
          </div>

          <ContentArea
            isArabic={isArabic}
            activeSection={activeSection}
            t={t}
          />

          <NoticeBar text={t.globalNotice} isArabic={isArabic} />
        </div>
      </div>
    </div>
  );
}

function SidebarColumn({
  isArabic,
  activeSection,
  setActiveSection,
  t,
}: {
  isArabic: boolean;
  activeSection: Section;
  setActiveSection: (value: Section) => void;
  t: TranslationMap;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
      <SurfaceCard>
        <div
          style={{
            display: "flex",
            flexDirection: isArabic ? "row-reverse" : "row",
            alignItems: "center",
            gap: "12px",
          }}
        >
          <div
            style={{
              width: "40px",
              height: "40px",
              borderRadius: "999px",
              background: "linear-gradient(180deg, #5ca7ff 0%, #2563eb 100%)",
              color: "white",
              fontWeight: 900,
              fontSize: "16px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 10px 20px rgba(37,99,235,0.25)",
              flexShrink: 0,
            }}
          >
            {isArabic ? "ا" : "I"}
          </div>

          <div style={{ textAlign: isArabic ? "right" : "left" }}>
            <div
              style={{
                fontSize: "15px",
                fontWeight: 800,
                color: "#0f172a",
                marginBottom: "4px",
              }}
            >
              {t.admin}
            </div>
            <div
              style={{
                fontSize: "13px",
                color: "#64748b",
              }}
            >
              {t.administrator}
            </div>
          </div>
        </div>
      </SurfaceCard>

      <SurfaceCard>
        <NavButton
          title={t.display}
          icon="◔"
          active={activeSection === "display"}
          isArabic={isArabic}
          onClick={() => setActiveSection("display")}
        />
        <NavButton
          title={t.preview}
          icon="◉"
          active={activeSection === "preview"}
          isArabic={isArabic}
          onClick={() => setActiveSection("preview")}
        />
        <NavButton
          title={t.identity}
          icon="⌂"
          active={activeSection === "identity"}
          isArabic={isArabic}
          onClick={() => setActiveSection("identity")}
        />
        <NavButton
          title={t.contact}
          icon="⌕"
          active={activeSection === "contact"}
          isArabic={isArabic}
          onClick={() => setActiveSection("contact")}
        />
        <NavButton
          title={t.legal}
          icon="#"
          active={activeSection === "legal"}
          isArabic={isArabic}
          onClick={() => setActiveSection("legal")}
        />
        <NavButton
          title={t.branding}
          icon="▣"
          active={activeSection === "branding"}
          isArabic={isArabic}
          onClick={() => setActiveSection("branding")}
        />
        <NavButton
          title={t.print}
          icon="▤"
          active={activeSection === "print"}
          isArabic={isArabic}
          onClick={() => setActiveSection("print")}
        />
      </SurfaceCard>

      <button
        style={{
          border: "none",
          borderRadius: "16px",
          background: "linear-gradient(180deg, #3b82f6 0%, #2563eb 100%)",
          color: "white",
          padding: "14px 18px",
          fontSize: "15px",
          fontWeight: 800,
          cursor: "pointer",
          boxShadow: "0 12px 24px rgba(37,99,235,0.22)",
        }}
      >
        ⌾ {t.saveChanges}
      </button>
    </div>
  );
}

function NavButton({
  title,
  icon,
  active,
  isArabic,
  onClick,
}: {
  title: string;
  icon: string;
  active: boolean;
  isArabic: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        width: "100%",
        minHeight: "50px",
        marginBottom: "8px",
        borderRadius: "14px",
        border: active ? "2px solid #111827" : "1px solid transparent",
        background: active ? "#eef3ff" : "transparent",
        color: active ? "#2563eb" : "#475569",
        padding: "12px 14px",
        cursor: "pointer",
        display: "flex",
        flexDirection: isArabic ? "row-reverse" : "row",
        alignItems: "center",
        justifyContent: "space-between",
        fontWeight: active ? 800 : 600,
        transition: "all 0.15s ease",
      }}
    >
      <span>{title}</span>
      <span
        style={{
          width: "22px",
          textAlign: "center",
          color: active ? "#2563eb" : "#8b5cf6",
          opacity: active ? 1 : 0.9,
        }}
      >
        {icon}
      </span>
    </button>
  );
}

function ContentArea({
  isArabic,
  activeSection,
  t,
}: {
  isArabic: boolean;
  activeSection: Section;
  t: TranslationMap;
}) {
  switch (activeSection) {
    case "display":
      return <DisplaySection isArabic={isArabic} t={t} />;
    case "preview":
      return <PreviewSection isArabic={isArabic} t={t} />;
    case "identity":
      return <IdentitySection isArabic={isArabic} t={t} />;
    case "contact":
      return <ContactSection isArabic={isArabic} t={t} />;
    case "legal":
      return <LegalSection isArabic={isArabic} t={t} />;
    case "branding":
      return <BrandingSection isArabic={isArabic} t={t} />;
    case "print":
      return <PrintSection isArabic={isArabic} t={t} />;
    default:
      return <IdentitySection isArabic={isArabic} t={t} />;
  }
}

function SurfaceCard({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        background: "#ffffff",
        borderRadius: "22px",
        padding: "12px",
        border: "1px solid #e5e7eb",
        boxShadow: "0 2px 12px rgba(15, 23, 42, 0.06)",
      }}
    >
      {children}
    </div>
  );
}

function SectionCard({
  title,
  tint,
  isArabic,
  children,
}: {
  title: string;
  tint: string;
  isArabic: boolean;
  children: ReactNode;
}) {
  return (
    <div
      style={{
        background: "#ffffff",
        borderRadius: "22px",
        overflow: "hidden",
        border: "1px solid #e5e7eb",
        boxShadow: "0 2px 12px rgba(15, 23, 42, 0.06)",
        marginBottom: "16px",
      }}
    >
      <div
        style={{
          background: tint,
          borderBottom: "1px solid #e5e7eb",
          padding: "14px 18px",
          textAlign: isArabic ? "right" : "left",
          fontSize: "18px",
          fontWeight: 800,
          color: "#0f172a",
        }}
      >
        {title}
      </div>

      <div style={{ padding: "18px" }}>{children}</div>
    </div>
  );
}

function FieldsGrid({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
        gap: "16px",
      }}
    >
      {children}
    </div>
  );
}

function ReadField({
  label,
  value,
  isArabic,
}: {
  label: string;
  value: string;
  isArabic: boolean;
}) {
  return (
    <div>
      <div
        style={{
          marginBottom: "8px",
          color: "#64748b",
          fontSize: "13px",
          fontWeight: 700,
          textTransform: "uppercase",
          textAlign: isArabic ? "right" : "left",
        }}
      >
        {label}
      </div>

      <input
        value={value}
        readOnly
        style={{
          width: "100%",
          height: "46px",
          borderRadius: "14px",
          border: "1px solid #cbd5e1",
          background: "#f8fafc",
          padding: "0 14px",
          boxSizing: "border-box",
          fontSize: "14px",
          color: "#0f172a",
          textAlign: isArabic ? "right" : "left",
          direction: isArabic ? "rtl" : "ltr",
          outline: "none",
        }}
      />
    </div>
  );
}

function NoticeBar({
  text,
  isArabic,
}: {
  text: string;
  isArabic: boolean;
}) {
  return (
    <div
      style={{
        marginTop: "8px",
        border: "1px solid #a8c3ff",
        background: "#eef4ff",
        color: "#2563eb",
        borderRadius: "18px",
        padding: "16px 18px",
        fontSize: "14px",
        textAlign: isArabic ? "right" : "left",
        boxShadow: "0 2px 10px rgba(37,99,235,0.06)",
      }}
    >
      ⓘ {text}
    </div>
  );
}

function SubNotice({
  text,
  isArabic,
}: {
  text: string;
  isArabic: boolean;
}) {
  return (
    <div
      style={{
        marginTop: "14px",
        border: "1px solid #bfd3ff",
        background: "#f3f7ff",
        color: "#2563eb",
        borderRadius: "14px",
        padding: "12px 14px",
        fontSize: "14px",
        textAlign: isArabic ? "right" : "left",
      }}
    >
      ⓘ {text}
    </div>
  );
}

function OptionTiles({
  options,
  activeIndex,
}: {
  options: string[];
  activeIndex: number;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))`,
        gap: "12px",
      }}
    >
      {options.map((option, index) => {
        const active = index === activeIndex;

        return (
          <div
            key={option}
            style={{
              minHeight: "78px",
              borderRadius: "14px",
              border: active ? "2px solid #4f7cff" : "1px solid #cbd5e1",
              background: active ? "#eef3ff" : "#f8fafc",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: active ? "#2563eb" : "#64748b",
              fontWeight: 700,
              textAlign: "center",
              padding: "0 8px",
            }}
          >
            {option}
          </div>
        );
      })}
    </div>
  );
}

function ColorDots({
  colors,
}: {
  colors: [string, string][];
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
        gap: "14px",
      }}
    >
      {colors.map(([name, color], index) => (
        <div
          key={name}
          style={{
            border: index === 0 ? "2px solid #4f7cff" : "1px solid transparent",
            borderRadius: "14px",
            padding: "12px 8px",
            textAlign: "center",
            background: "#fff",
          }}
        >
          <div
            style={{
              width: "28px",
              height: "28px",
              borderRadius: "50%",
              margin: "0 auto 8px auto",
              background: color,
              boxShadow: "0 3px 10px rgba(0,0,0,0.12)",
            }}
          />
          <div
            style={{
              fontSize: "12px",
              color: "#334155",
              fontWeight: 700,
            }}
          >
            {name}
          </div>
        </div>
      ))}
    </div>
  );
}

function ColorBlocks({
  blocks,
}: {
  blocks: [string, string][];
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
        gap: "12px",
      }}
    >
      {blocks.map(([name, color], index) => (
        <div
          key={name}
          style={{
            border: index === 0 ? "2px solid #4f7cff" : "1px solid transparent",
            borderRadius: "14px",
            padding: "10px",
            background: "#fff",
          }}
        >
          <div
            style={{
              height: "28px",
              borderRadius: "8px",
              background: color,
              marginBottom: "8px",
            }}
          />
          <div
            style={{
              fontSize: "12px",
              textAlign: "center",
              color: "#334155",
              fontWeight: 700,
            }}
          >
            {name}
          </div>
        </div>
      ))}
    </div>
  );
}

function ToggleRow({
  title,
  subtitle,
  enabled,
  isArabic,
}: {
  title: string;
  subtitle: string;
  enabled: boolean;
  isArabic: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: isArabic ? "row-reverse" : "row",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "12px 0",
        borderBottom: "1px solid #eef2f7",
      }}
    >
      <div style={{ textAlign: isArabic ? "right" : "left" }}>
        <div
          style={{
            fontWeight: 700,
            color: "#0f172a",
            marginBottom: "4px",
          }}
        >
          {title}
        </div>
        <div style={{ fontSize: "13px", color: "#64748b" }}>{subtitle}</div>
      </div>

      <div
        style={{
          width: "42px",
          height: "24px",
          borderRadius: "999px",
          background: enabled ? "#2563eb" : "#d1d5db",
          position: "relative",
          flexShrink: 0,
        }}
      >
        <div
          style={{
            position: "absolute",
            top: "3px",
            left: enabled ? "21px" : "3px",
            width: "18px",
            height: "18px",
            borderRadius: "50%",
            background: "#fff",
          }}
        />
      </div>
    </div>
  );
}

function UploadPanel({
  title,
  button,
  note,
  icon,
  accent,
  purple,
}: {
  title: string;
  button: string;
  note: string;
  icon: string;
  accent: string;
  purple?: boolean;
}) {
  return (
    <div>
      <div
        style={{
          marginBottom: "8px",
          color: "#64748b",
          fontSize: "13px",
          fontWeight: 700,
          textTransform: "uppercase",
        }}
      >
        {title}
      </div>

      <div
        style={{
          borderRadius: "18px",
          border: `2px dashed ${accent}`,
          background: purple ? "#fcf7ff" : "#fbfdff",
          minHeight: "215px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "18px",
          boxSizing: "border-box",
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: "42px", marginBottom: "14px" }}>{icon}</div>

        <button
          style={{
            border: "none",
            borderRadius: "12px",
            background: purple ? "#9333ea" : "#2563eb",
            color: "white",
            padding: "10px 18px",
            fontWeight: 800,
            cursor: "pointer",
            marginBottom: "12px",
          }}
        >
          ⤴ {button}
        </button>

        <div
          style={{
            color: "#64748b",
            fontSize: "13px",
            lineHeight: 1.5,
          }}
        >
          {note}
        </div>
      </div>
    </div>
  );
}

function DisplaySection({
  isArabic,
  t,
}: {
  isArabic: boolean;
  t: TranslationMap;
}) {
  return (
    <>
      <SectionCard title={t.interfaceTheme} tint="#f7f2e8" isArabic={isArabic}>
        <OptionTiles
          options={[t.light, t.dark, t.system]}
          activeIndex={2}
        />
      </SectionCard>

      <SectionCard title={t.primaryColor} tint="#f7eef8" isArabic={isArabic}>
        <ColorDots
          colors={[
            ["Blue", "#3b82f6"],
            ["Emerald", "#10b981"],
            ["Violet", "#8b5cf6"],
            ["Rose", "#f43f5e"],
            ["Amber", "#f59e0b"],
            ["Cyan", "#06b6d4"],
            ["Teal", "#14b8a6"],
          ]}
        />
      </SectionCard>

      <SectionCard title={t.sidebarColor} tint="#f8fafc" isArabic={isArabic}>
        <ColorBlocks
          blocks={[
            ["Navy", "#0b1f4d"],
            ["Deep Blue", "#153a7d"],
            ["Deep Green", "#0f5132"],
            ["Deep Purple", "#321c75"],
            ["Deep Rose", "#5f1230"],
            ["Deep Teal", "#134e4a"],
            ["Charcoal", "#1f2937"],
            ["Dark Brown", "#3b240b"],
          ]}
        />
      </SectionCard>

      <SectionCard title={t.appBackground} tint="#f3f2ff" isArabic={isArabic}>
        <OptionTiles options={[t.none, t.color, t.image]} activeIndex={0} />
      </SectionCard>

      <SectionCard title={t.borderRadius} tint="#f8fafc" isArabic={isArabic}>
        <OptionTiles options={[t.sharp, t.normal, t.rounded]} activeIndex={1} />
      </SectionCard>

      <SectionCard title={t.displayDensity} tint="#eef9f8" isArabic={isArabic}>
        <OptionTiles
          options={[t.compact, t.normal, t.comfortable]}
          activeIndex={1}
        />
      </SectionCard>

      <SectionCard title={t.extraOptions} tint="#f8fafc" isArabic={isArabic}>
        <ToggleRow
          title={t.glassSidebar}
          subtitle={t.glassSidebarHint}
          enabled={false}
          isArabic={isArabic}
        />
        <ToggleRow
          title={t.animations}
          subtitle={t.animationsHint}
          enabled={true}
          isArabic={isArabic}
        />
      </SectionCard>
    </>
  );
}

function PreviewSection({
  isArabic,
  t,
}: {
  isArabic: boolean;
  t: TranslationMap;
}) {
  return (
    <SectionCard title={t.invoicePreview} tint="#f3f1fb" isArabic={isArabic}>
      <div
        style={{
          background: "#fff",
          border: "1px solid #e5e7eb",
          borderRadius: "18px",
          padding: "18px",
          boxShadow: "inset 0 -3px 0 #64748b",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 120px 1fr",
            gap: "16px",
            alignItems: "center",
          }}
        >
          <div style={{ textAlign: isArabic ? "right" : "left" }}>
            <div
              style={{
                fontSize: "18px",
                fontWeight: 800,
                color: "#0f172a",
              }}
            >
              {isArabic ? "حول العالم" : "Around The World"}
            </div>
            <div style={{ color: "#475569", fontWeight: 700 }}>
              {isArabic ? "للتخليص الجمركي" : "Customs Clearance"}
            </div>
            <div
              style={{
                color: "#64748b",
                fontSize: "13px",
                marginTop: "4px",
              }}
            >
              {isArabic
                ? "خدمات التخليص الجمركي والشحن"
                : "Customs Clearance & Shipping Services"}
            </div>
          </div>

          <div
            style={{
              width: "90px",
              height: "70px",
              margin: "0 auto",
              borderRadius: "12px",
              background:
                "linear-gradient(135deg, rgba(59,130,246,.08), rgba(99,102,241,.14))",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "34px",
            }}
          >
            🧾
          </div>

          <div style={{ textAlign: isArabic ? "left" : "right" }}>
            <div
              style={{
                fontSize: "18px",
                fontWeight: 800,
                color: "#0f172a",
              }}
            >
              {isArabic ? "Around The World" : "حول العالم"}
            </div>
            <div style={{ color: "#475569", fontWeight: 700 }}>
              {isArabic ? "Customs Clearance" : "للتخليص الجمركي"}
            </div>
            <div
              style={{
                color: "#64748b",
                fontSize: "13px",
                marginTop: "4px",
              }}
            >
              atwcc1246@email.com
            </div>
            <div style={{ color: "#64748b", fontSize: "13px" }}>
              Tel: 55251595 . P.O BOX 8180
            </div>
          </div>
        </div>
      </div>

      <SubNotice text={t.livePreview} isArabic={isArabic} />
    </SectionCard>
  );
}

function IdentitySection({
  isArabic,
  t,
}: {
  isArabic: boolean;
  t: TranslationMap;
}) {
  return (
    <SectionCard title={t.companyIdentity} tint="#f2f5fb" isArabic={isArabic}>
      <FieldsGrid>
        <ReadField
          isArabic={isArabic}
          label={t.companyNameArabic}
          value="حول العالم للتخليص الجمركي"
        />
        <ReadField
          isArabic={isArabic}
          label={t.companyNameEnglish}
          value="Around The World Customs Clearance"
        />
        <ReadField
          isArabic={isArabic}
          label={t.subtitleArabic}
          value="التخليص الجمركي"
        />
        <ReadField
          isArabic={isArabic}
          label={t.subtitleEnglish}
          value="Customs Clearance"
        />
        <ReadField
          isArabic={isArabic}
          label={t.taglineArabic}
          value="خدمات التخليص الجمركي والشحن"
        />
        <ReadField
          isArabic={isArabic}
          label={t.taglineEnglish}
          value="Customs Clearance & Shipping Services"
        />
      </FieldsGrid>
    </SectionCard>
  );
}

function ContactSection({
  isArabic,
  t,
}: {
  isArabic: boolean;
  t: TranslationMap;
}) {
  return (
    <SectionCard title={t.contactInformation} tint="#eef8f1" isArabic={isArabic}>
      <FieldsGrid>
        <ReadField
          isArabic={isArabic}
          label={t.email}
          value="atwcc1246@gmail.com"
        />
        <ReadField
          isArabic={isArabic}
          label={t.phone}
          value="55251595"
        />
        <ReadField
          isArabic={isArabic}
          label={t.address}
          value="Doha, Qatar"
        />
        <ReadField
          isArabic={isArabic}
          label={t.poBox}
          value="P.O BOX 8180"
        />
        <ReadField
          isArabic={isArabic}
          label={t.website}
          value="www.company.com"
        />
      </FieldsGrid>
    </SectionCard>
  );
}

function LegalSection({
  isArabic,
  t,
}: {
  isArabic: boolean;
  t: TranslationMap;
}) {
  return (
    <SectionCard title={t.legalInformation} tint="#faf6eb" isArabic={isArabic}>
      <FieldsGrid>
        <ReadField
          isArabic={isArabic}
          label={t.crNumber}
          value="12345678"
        />
        <ReadField
          isArabic={isArabic}
          label={t.vatNumber}
          value="VAT-123456"
        />
      </FieldsGrid>
    </SectionCard>
  );
}

function BrandingSection({
  isArabic,
  t,
}: {
  isArabic: boolean;
  t: TranslationMap;
}) {
  return (
    <SectionCard title={t.brandingHeader} tint="#f8f1fb" isArabic={isArabic}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
          gap: "18px",
        }}
      >
        <UploadPanel
          title={t.companyLogo}
          button={t.upload}
          note={t.max2mb}
          icon="🖼️"
          accent="#cbd5e1"
        />
        <UploadPanel
          title={t.companyStamp}
          button={t.upload}
          note={t.transparentMax2mb}
          icon="⭕"
          accent="#cbd5e1"
        />
        <UploadPanel
          title={t.watermark}
          button={t.upload}
          note={t.transparentFallback}
          icon="🌫️"
          accent="#d8b4fe"
          purple
        />
      </div>
    </SectionCard>
  );
}

function PrintSection({
  isArabic,
  t,
}: {
  isArabic: boolean;
  t: TranslationMap;
}) {
  return (
    <>
      <SectionCard title={t.printSettings} tint="#f3f6fb" isArabic={isArabic}>
        <OptionTiles
          options={[t.a4Portrait, t.a4Landscape, t.thermal]}
          activeIndex={0}
        />

        <div style={{ height: "16px" }} />

        <OptionTiles
          options={[t.showLogo, t.showStamp, t.showWatermark]}
          activeIndex={2}
        />
      </SectionCard>

      <SectionCard title={t.printHeader} tint="#f8fafc" isArabic={isArabic}>
        <ReadField
          isArabic={isArabic}
          label={t.footerText}
          value={
            isArabic
              ? "هذا المستند صادر من نظام حول العالم للتخليص الجمركي"
              : "This document was generated by Around The World Customs Clearance"
          }
        />
      </SectionCard>
    </>
  );
}

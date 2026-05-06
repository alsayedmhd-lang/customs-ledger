import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type PrimaryColor =
  | "blue"
  | "emerald"
  | "violet"
  | "rose"
  | "amber"
  | "cyan"
  | "teal"
  | "white"
  | "offWhite"
  | "lightCyan"
  | "paleBlue"
  | "lightGreen"
  | "lightBeige"
  | "lightGray"
  | "cream";
export type BorderRadius  = "sharp" | "normal" | "rounded";
export type Density       = "compact" | "normal" | "comfortable";
export type SidebarColor =
  | "navy"
  | "green"
  | "purple"
  | "rose"
  | "blue"
  | "charcoal"
  | "teal"
  | "brown"
  | "white"
  | "offWhite"
  | "lightCyan"
  | "paleBlue"
  | "lightGreen"
  | "lightBeige"
  | "lightGray"
  | "cream";
export type BgType        = "none" | "color" | "image";

type ColorPreset = {
  light: string;
  dark: string;
  hex: string;
  labelAr: string;
  labelEn: string;
  foreground?: string;
  border?: string;
};

type SidebarPreset = {
  from: string;
  to: string;
  labelAr: string;
  labelEn: string;
  foreground?: string;
  mutedForeground?: string;
  hoverBg?: string;
  activeBg?: string;
  activeFg?: string;
  border?: string;
};

export interface DisplaySettings {
  primaryColor: PrimaryColor;
  borderRadius: BorderRadius;
  density:      Density;
  animations:   boolean;
  sidebarGlass: boolean;
  sidebarColor: SidebarColor;
  bgType:       BgType;
  bgColor:      string;
  bgImage:      string;
  bgOpacity:    number;
}

const DEFAULT: DisplaySettings = {
  primaryColor: "blue",
  borderRadius: "normal",
  density:      "normal",
  animations:   true,
  sidebarGlass: false,
  sidebarColor: "navy",
  bgType:       "none",
  bgColor:      "#e8f0fe",
  bgImage:      "",
  bgOpacity:    15,
};

export const COLOR_PRESETS: Record<PrimaryColor, ColorPreset> = {
  blue:    { light: "221 83% 53%", dark: "221 78% 65%", hex: "#3b6fdb", labelAr: "أزرق",   labelEn: "Blue"    },
  emerald: { light: "152 60% 40%", dark: "152 55% 55%", hex: "#2a9d6e", labelAr: "زمردي",  labelEn: "Emerald" },
  violet:  { light: "263 70% 50%", dark: "263 65% 65%", hex: "#7c3aed", labelAr: "بنفسجي", labelEn: "Violet"  },
  rose:    { light: "346 77% 49%", dark: "346 72% 62%", hex: "#e11d48", labelAr: "وردي",   labelEn: "Rose"    },
  amber:   { light: "38 96% 46%",  dark: "38 90% 58%",  hex: "#d97706", labelAr: "عنبري",  labelEn: "Amber"   },
  cyan:    { light: "186 100% 35%",dark: "186 85% 48%", hex: "#0891b2", labelAr: "سماوي",  labelEn: "Cyan"    },
  teal:    { light: "170 64% 40%", dark: "170 55% 52%", hex: "#0d9488", labelAr: "زيتوني", labelEn: "Teal"    },
  white:      { light: "0 0% 100%",    dark: "0 0% 96%",    hex: "#ffffff", labelAr: "أبيض", labelEn: "White", foreground: "222 47% 11%", border: "214 31% 82%" },
  offWhite:   { light: "210 20% 98%",  dark: "210 18% 94%", hex: "#f8fafc", labelAr: "أبيض رمادي", labelEn: "Gray White", foreground: "222 47% 11%", border: "214 31% 82%" },
  lightCyan:  { light: "190 100% 92%", dark: "190 86% 86%", hex: "#cffafe", labelAr: "سماوي فاتح", labelEn: "Light Cyan", foreground: "222 47% 11%", border: "190 65% 72%" },
  paleBlue:   { light: "214 100% 94%", dark: "214 92% 88%", hex: "#dbeafe", labelAr: "أزرق فاتح جدًا", labelEn: "Pale Blue", foreground: "222 47% 11%", border: "214 72% 76%" },
  lightGreen: { light: "140 55% 92%",  dark: "140 48% 86%", hex: "#dcfce7", labelAr: "أخضر فاتح", labelEn: "Light Green", foreground: "222 47% 11%", border: "140 42% 70%" },
  lightBeige: { light: "42 70% 92%",   dark: "42 62% 86%",  hex: "#f5edd8", labelAr: "بيج فاتح", labelEn: "Light Beige", foreground: "222 47% 11%", border: "42 42% 72%" },
  lightGray:  { light: "220 14% 94%",  dark: "220 12% 88%", hex: "#e5e7eb", labelAr: "رمادي فاتح", labelEn: "Light Gray", foreground: "222 47% 11%", border: "220 13% 75%" },
  cream:      { light: "48 100% 94%",  dark: "48 88% 88%",  hex: "#fef3c7", labelAr: "كريمي", labelEn: "Cream", foreground: "222 47% 11%", border: "45 64% 72%" },
};

export const SIDEBAR_COLOR_PRESETS: Record<SidebarColor, SidebarPreset> = {
  navy:     { from: "#0f172a", to: "#1e293b", labelAr: "كحلي (افتراضي)", labelEn: "Navy (Default)"  },
  blue:     { from: "#0c1a40", to: "#1a3a6e", labelAr: "أزرق غامق",      labelEn: "Deep Blue"       },
  green:    { from: "#052e16", to: "#134e4a", labelAr: "أخضر غامق",      labelEn: "Deep Green"      },
  purple:   { from: "#1e0a40", to: "#2d1b69", labelAr: "بنفسجي غامق",    labelEn: "Deep Purple"     },
  rose:     { from: "#2d0a1e", to: "#4a0d25", labelAr: "وردي غامق",      labelEn: "Deep Rose"       },
  teal:     { from: "#042f2e", to: "#0f4040", labelAr: "فيروزي غامق",    labelEn: "Deep Teal"       },
  charcoal: { from: "#111111", to: "#1e1e1e", labelAr: "فحمي",            labelEn: "Charcoal"        },
  brown:    { from: "#1c1001", to: "#2f1f07", labelAr: "بني داكن",        labelEn: "Dark Brown"      },
  white:      { from: "#ffffff", to: "#f8fafc", labelAr: "أبيض", labelEn: "White", foreground: "#0f172a", mutedForeground: "rgba(15,23,42,0.62)", hoverBg: "rgba(15,23,42,0.06)", activeBg: "#0f172a", activeFg: "#ffffff", border: "rgba(15,23,42,0.12)" },
  offWhite:   { from: "#f8fafc", to: "#eef2f7", labelAr: "أبيض رمادي", labelEn: "Gray White", foreground: "#0f172a", mutedForeground: "rgba(15,23,42,0.62)", hoverBg: "rgba(15,23,42,0.06)", activeBg: "#111827", activeFg: "#ffffff", border: "rgba(15,23,42,0.12)" },
  lightCyan:  { from: "#ecfeff", to: "#cffafe", labelAr: "سماوي فاتح", labelEn: "Light Cyan", foreground: "#083344", mutedForeground: "rgba(8,51,68,0.65)", hoverBg: "rgba(8,51,68,0.08)", activeBg: "#155e75", activeFg: "#ffffff", border: "rgba(8,51,68,0.16)" },
  paleBlue:   { from: "#eff6ff", to: "#dbeafe", labelAr: "أزرق فاتح جدًا", labelEn: "Pale Blue", foreground: "#172554", mutedForeground: "rgba(23,37,84,0.65)", hoverBg: "rgba(23,37,84,0.08)", activeBg: "#1e3a8a", activeFg: "#ffffff", border: "rgba(23,37,84,0.16)" },
  lightGreen: { from: "#f0fdf4", to: "#dcfce7", labelAr: "أخضر فاتح", labelEn: "Light Green", foreground: "#052e16", mutedForeground: "rgba(5,46,22,0.65)", hoverBg: "rgba(5,46,22,0.08)", activeBg: "#166534", activeFg: "#ffffff", border: "rgba(5,46,22,0.16)" },
  lightBeige: { from: "#fffaf0", to: "#f5edd8", labelAr: "بيج فاتح", labelEn: "Light Beige", foreground: "#3f2f12", mutedForeground: "rgba(63,47,18,0.66)", hoverBg: "rgba(63,47,18,0.08)", activeBg: "#6b4f1d", activeFg: "#ffffff", border: "rgba(63,47,18,0.18)" },
  lightGray:  { from: "#f3f4f6", to: "#e5e7eb", labelAr: "رمادي فاتح", labelEn: "Light Gray", foreground: "#111827", mutedForeground: "rgba(17,24,39,0.64)", hoverBg: "rgba(17,24,39,0.08)", activeBg: "#374151", activeFg: "#ffffff", border: "rgba(17,24,39,0.16)" },
  cream:      { from: "#fffbea", to: "#fef3c7", labelAr: "كريمي", labelEn: "Cream", foreground: "#422006", mutedForeground: "rgba(66,32,6,0.66)", hoverBg: "rgba(66,32,6,0.08)", activeBg: "#92400e", activeFg: "#ffffff", border: "rgba(66,32,6,0.18)" },
};

const RADIUS: Record<BorderRadius, string> = {
  sharp:   "0.25rem",
  normal:  "0.75rem",
  rounded: "1.5rem",
};

const FONT_SIZE: Record<Density, string> = {
  compact:     "12.5px",
  normal:      "14px",
  comfortable: "15.5px",
};

function applyPrimaryColor(color: PrimaryColor) {
  const root   = document.documentElement;
  const isDark = root.classList.contains("dark");
  const preset = COLOR_PRESETS[color] ?? COLOR_PRESETS.blue;
  const primary = isDark ? preset.dark : preset.light;
  root.style.setProperty("--primary", primary);
  root.style.setProperty("--primary-foreground", preset.foreground ?? "210 40% 98%");
  root.style.setProperty("--primary-border", preset.border ?? primary);
  root.style.setProperty("--ring", primary);
}

function applySettings(s: DisplaySettings) {
  const root = document.documentElement;

  applyPrimaryColor(s.primaryColor);
  root.style.setProperty("--radius", RADIUS[s.borderRadius]);
  root.style.fontSize = FONT_SIZE[s.density];

  root.classList.toggle("no-animations", !s.animations);
  root.classList.toggle("sidebar-glass",  s.sidebarGlass);

  // Sidebar color via CSS variables (fallback to navy if stored value is missing/invalid)
  const sb = SIDEBAR_COLOR_PRESETS[s.sidebarColor] ?? SIDEBAR_COLOR_PRESETS["navy"];
  root.style.setProperty("--sb-from", sb.from);
  root.style.setProperty("--sb-to",   sb.to);
  root.style.setProperty("--sb-foreground", sb.foreground ?? "#ffffff");
  root.style.setProperty("--sb-muted-foreground", sb.mutedForeground ?? "rgba(255,255,255,0.5)");
  root.style.setProperty("--sb-hover-bg", sb.hoverBg ?? "rgba(255,255,255,0.1)");
  root.style.setProperty("--sb-active-bg", sb.activeBg ?? "#ffffff");
  root.style.setProperty("--sb-active-fg", sb.activeFg ?? "#0f172a");
  root.style.setProperty("--sb-border", sb.border ?? "rgba(255,255,255,0.1)");
}

interface DisplayCtx {
  display: DisplaySettings;
  update:  (patch: Partial<DisplaySettings>) => void;
}

const Ctx = createContext<DisplayCtx>({ display: DEFAULT, update: () => {} });

export function DisplaySettingsProvider({ children }: { children: ReactNode }) {
  const [display, setDisplay] = useState<DisplaySettings>(() => {
    try {
      const raw = localStorage.getItem("display_settings");
      return raw ? { ...DEFAULT, ...JSON.parse(raw) } : DEFAULT;
    } catch { return DEFAULT; }
  });

  useEffect(() => {
    applySettings(display);
    const obs = new MutationObserver(() => applyPrimaryColor(display.primaryColor));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, [display]);

  const update = (patch: Partial<DisplaySettings>) =>
    setDisplay(prev => {
      const next = { ...prev, ...patch };
      localStorage.setItem("display_settings", JSON.stringify(next));
      return next;
    });

  return <Ctx.Provider value={{ display, update }}>{children}</Ctx.Provider>;
}

export function useDisplaySettings() { return useContext(Ctx); }

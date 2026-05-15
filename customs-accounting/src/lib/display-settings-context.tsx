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
  blue:    { light: "221 83% 40%", dark: "221 70% 62%", hex: "#1d4ed8", labelAr: "أزرق غامق",   labelEn: "Deep Blue"    },
  emerald: { light: "160 84% 30%", dark: "158 52% 52%", hex: "#047857", labelAr: "زمردي غامق",  labelEn: "Deep Emerald" },
  violet:  { light: "262 83% 48%", dark: "262 68% 66%", hex: "#6d28d9", labelAr: "بنفسجي غامق", labelEn: "Deep Violet"  },
  rose:    { light: "346 77% 37%", dark: "346 70% 62%", hex: "#be123c", labelAr: "وردي غامق",   labelEn: "Deep Rose"    },
  amber:   { light: "32 95% 32%",  dark: "36 82% 58%",  hex: "#92400e", labelAr: "عنبري غامق",  labelEn: "Deep Amber"   },
  cyan:    { light: "192 82% 31%", dark: "190 70% 50%", hex: "#0e7490", labelAr: "سماوي غامق",  labelEn: "Deep Cyan"    },
  teal:    { light: "175 84% 27%", dark: "172 58% 48%", hex: "#0f766e", labelAr: "فيروزي غامق", labelEn: "Deep Teal"    },
  white:      { light: "215 20% 38%", dark: "215 18% 62%", hex: "#475569", labelAr: "كحلي رمادي", labelEn: "Slate", border: "215 18% 34%" },
  offWhite:   { light: "25 8% 44%",   dark: "25 10% 62%",  hex: "#78716c", labelAr: "رمادي دافئ", labelEn: "Warm Gray", border: "215 18% 34%" },
  lightCyan:  { light: "192 70% 30%", dark: "190 62% 52%", hex: "#155e75", labelAr: "سماوي غامق", labelEn: "Dark Cyan", border: "192 58% 26%" },
  paleBlue:   { light: "224 64% 33%", dark: "221 62% 60%", hex: "#1e3a8a", labelAr: "كحلي", labelEn: "Navy Blue", border: "224 58% 28%" },
  lightGreen: { light: "142 72% 29%", dark: "142 48% 52%", hex: "#166534", labelAr: "أخضر غامق", labelEn: "Forest Green", border: "142 58% 25%" },
  lightBeige: { light: "42 62% 35%",  dark: "42 46% 58%",  hex: "#92712a", labelAr: "بيج غامق", labelEn: "Deep Beige", border: "42 48% 30%" },
  lightGray:  { light: "220 9% 36%",  dark: "220 10% 60%", hex: "#4b5563", labelAr: "رمادي هادئ", labelEn: "Calm Gray", border: "220 9% 31%" },
  cream:      { light: "32 81% 29%",  dark: "35 58% 56%",  hex: "#854d0e", labelAr: "كريمي غامق", labelEn: "Deep Cream", border: "32 62% 25%" },
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
  white:      { from: "#475569", to: "#334155", labelAr: "كحلي رمادي", labelEn: "Slate", foreground: "#ffffff", mutedForeground: "rgba(255,255,255,0.68)", hoverBg: "rgba(255,255,255,0.10)", activeBg: "#ffffff", activeFg: "#0f172a", border: "rgba(15,23,42,0.12)" },
  offWhite:   { from: "#78716c", to: "#57534e", labelAr: "رمادي دافئ", labelEn: "Warm Gray", foreground: "#ffffff", mutedForeground: "rgba(255,255,255,0.68)", hoverBg: "rgba(255,255,255,0.10)", activeBg: "#ffffff", activeFg: "#0f172a", border: "rgba(15,23,42,0.12)" },
  lightCyan:  { from: "#155e75", to: "#164e63", labelAr: "سماوي غامق", labelEn: "Dark Cyan", foreground: "#ffffff", mutedForeground: "rgba(255,255,255,0.68)", hoverBg: "rgba(255,255,255,0.10)", activeBg: "#ffffff", activeFg: "#0f172a", border: "rgba(8,51,68,0.16)" },
  paleBlue:   { from: "#1e3a8a", to: "#172554", labelAr: "كحلي", labelEn: "Navy Blue", foreground: "#ffffff", mutedForeground: "rgba(255,255,255,0.68)", hoverBg: "rgba(255,255,255,0.10)", activeBg: "#ffffff", activeFg: "#0f172a", border: "rgba(23,37,84,0.16)" },
  lightGreen: { from: "#166534", to: "#14532d", labelAr: "أخضر غامق", labelEn: "Forest Green", foreground: "#ffffff", mutedForeground: "rgba(255,255,255,0.68)", hoverBg: "rgba(255,255,255,0.10)", activeBg: "#ffffff", activeFg: "#0f172a", border: "rgba(5,46,22,0.16)" },
  lightBeige: { from: "#92712a", to: "#6b4f1d", labelAr: "بيج غامق", labelEn: "Deep Beige", foreground: "#ffffff", mutedForeground: "rgba(255,255,255,0.68)", hoverBg: "rgba(255,255,255,0.10)", activeBg: "#ffffff", activeFg: "#0f172a", border: "rgba(63,47,18,0.18)" },
  lightGray:  { from: "#4b5563", to: "#374151", labelAr: "رمادي هادئ", labelEn: "Calm Gray", foreground: "#ffffff", mutedForeground: "rgba(255,255,255,0.68)", hoverBg: "rgba(255,255,255,0.10)", activeBg: "#ffffff", activeFg: "#0f172a", border: "rgba(17,24,39,0.16)" },
  cream:      { from: "#854d0e", to: "#713f12", labelAr: "كريمي غامق", labelEn: "Deep Cream", foreground: "#ffffff", mutedForeground: "rgba(255,255,255,0.68)", hoverBg: "rgba(255,255,255,0.10)", activeBg: "#ffffff", activeFg: "#0f172a", border: "rgba(66,32,6,0.18)" },
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

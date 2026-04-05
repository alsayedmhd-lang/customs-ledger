import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type PrimaryColor = "blue" | "emerald" | "violet" | "rose" | "amber" | "cyan" | "teal";
export type BorderRadius  = "sharp" | "normal" | "rounded";
export type Density       = "compact" | "normal" | "comfortable";
export type SidebarColor  = "navy" | "green" | "purple" | "rose" | "blue" | "charcoal" | "teal" | "brown";
export type BgType        = "none" | "color" | "image";

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

export const COLOR_PRESETS: Record<PrimaryColor, { light: string; dark: string; hex: string; labelAr: string; labelEn: string }> = {
  blue:    { light: "221 83% 53%", dark: "221 78% 65%", hex: "#3b6fdb", labelAr: "أزرق",   labelEn: "Blue"    },
  emerald: { light: "152 60% 40%", dark: "152 55% 55%", hex: "#2a9d6e", labelAr: "زمردي",  labelEn: "Emerald" },
  violet:  { light: "263 70% 50%", dark: "263 65% 65%", hex: "#7c3aed", labelAr: "بنفسجي", labelEn: "Violet"  },
  rose:    { light: "346 77% 49%", dark: "346 72% 62%", hex: "#e11d48", labelAr: "وردي",   labelEn: "Rose"    },
  amber:   { light: "38 96% 46%",  dark: "38 90% 58%",  hex: "#d97706", labelAr: "عنبري",  labelEn: "Amber"   },
  cyan:    { light: "186 100% 35%",dark: "186 85% 48%", hex: "#0891b2", labelAr: "سماوي",  labelEn: "Cyan"    },
  teal:    { light: "170 64% 40%", dark: "170 55% 52%", hex: "#0d9488", labelAr: "زيتوني", labelEn: "Teal"    },
};

export const SIDEBAR_COLOR_PRESETS: Record<SidebarColor, { from: string; to: string; labelAr: string; labelEn: string }> = {
  navy:     { from: "#0f172a", to: "#1e293b", labelAr: "كحلي (افتراضي)", labelEn: "Navy (Default)"  },
  blue:     { from: "#0c1a40", to: "#1a3a6e", labelAr: "أزرق غامق",      labelEn: "Deep Blue"       },
  green:    { from: "#052e16", to: "#134e4a", labelAr: "أخضر غامق",      labelEn: "Deep Green"      },
  purple:   { from: "#1e0a40", to: "#2d1b69", labelAr: "بنفسجي غامق",    labelEn: "Deep Purple"     },
  rose:     { from: "#2d0a1e", to: "#4a0d25", labelAr: "وردي غامق",      labelEn: "Deep Rose"       },
  teal:     { from: "#042f2e", to: "#0f4040", labelAr: "فيروزي غامق",    labelEn: "Deep Teal"       },
  charcoal: { from: "#111111", to: "#1e1e1e", labelAr: "فحمي",            labelEn: "Charcoal"        },
  brown:    { from: "#1c1001", to: "#2f1f07", labelAr: "بني داكن",        labelEn: "Dark Brown"      },
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
  const preset = COLOR_PRESETS[color];
  root.style.setProperty("--primary", isDark ? preset.dark : preset.light);
  root.style.setProperty("--ring",    isDark ? preset.dark : preset.light);
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

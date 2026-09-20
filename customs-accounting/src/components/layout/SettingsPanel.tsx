import { X, Sun, Moon, Monitor, Coins } from "lucide-react";
import {
  CURRENCIES,
  useLanguage,
} from "@/lib/language-context";
import { cn } from "@/lib/utils";
import packageJson from "../../../../package.json";

interface SettingsPanelProps {
  onClose: () => void;
}

const APP_VERSION = `v${packageJson.version}`;

export default function SettingsPanel({ onClose }: SettingsPanelProps) {
  const {
  lang,
  t,
  isRTL,
  currencySymbol,
  currencyCode,
  setCurrencyCode,
  currencyDisplayMode,
  setCurrencyDisplayMode,
} = useLanguage();

  function toggleTheme(mode: "light" | "dark" | "system") {
    if (mode === "dark") {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else if (mode === "light") {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    } else {
      localStorage.removeItem("theme");
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      document.documentElement.classList.toggle("dark", prefersDark);
    }
  }

  const storedTheme = localStorage.getItem("theme");
  const currentTheme = storedTheme === "dark" ? "dark" : storedTheme === "light" ? "light" : "system";
  const isManualCurrency = !!localStorage.getItem("currency_manual");
  const selectedCurrency =
  CURRENCIES.find((currency) => currency.code === currencyCode) ??
  CURRENCIES[0];

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40" onClick={onClose} />

      {/* Panel */}
      <div
        className={cn(
          "fixed top-16 z-50 w-80 bg-card border border-border rounded-2xl shadow-2xl overflow-hidden",
          isRTL ? "left-4" : "right-4"
        )}
        dir={isRTL ? "rtl" : "ltr"}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-muted/30">
          <h3 className="font-bold text-foreground">{t("settingsTitle")}</h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-6 max-h-[80vh] overflow-y-auto">

          {/* Theme Section */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              <Sun className="w-4 h-4" />
              {t("interfaceTheme")}
            </div>
            <div className="grid grid-cols-3 gap-2">
              {(["light", "dark", "system"] as const).map((mode) => {
                const Icon = mode === "light" ? Sun : mode === "dark" ? Moon : Monitor;
                const label = mode === "light" ? t("lightMode") : mode === "dark" ? t("darkMode") : t("systemMode");
                return (
                  <button
                    key={mode}
                    onClick={() => toggleTheme(mode)}
                    className={cn(
                      "flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl text-xs font-medium border-2 transition-all",
                      currentTheme === mode
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground"
                    )}
                  >
                    <Icon className="w-4 h-4" />
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Currency Section */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              <Coins className="w-4 h-4" />
              {t("interfaceCurrency")}
            </div>

            {/* Currency Selection */}
            <select
              value={currencyCode}
              onChange={(e) => setCurrencyCode(e.target.value)}
              className="w-full h-10 rounded-xl border-2 border-border bg-background px-3 text-sm font-medium outline-none focus:border-primary"
            >
              {CURRENCIES.map((currency) => (
                <option key={currency.code} value={currency.code}>
                  {lang === "ar" ? currency.arabic : currency.english} ({currency.code})
                </option>
              ))}
            </select>

            {/* Currency Display Mode */}
            <div className="space-y-2">
              <button
                onClick={() => setCurrencyDisplayMode("ar")}
                className={cn(
                  "w-full flex items-center justify-center px-4 py-2.5 rounded-xl text-sm font-medium border-2 transition-all",
                  currencyDisplayMode === "ar"
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground"
                )}
              >
                {selectedCurrency.arabic}
              </button>

              <button
                onClick={() => setCurrencyDisplayMode("en")}
                className={cn(
                  "w-full flex items-center justify-center px-4 py-2.5 rounded-xl text-sm font-medium border-2 transition-all",
                  currencyDisplayMode === "en"
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground"
                )}
              >
                {selectedCurrency.english}
              </button>

              <button
                onClick={() => setCurrencyDisplayMode("symbol")}
                className={cn(
                  "w-full flex items-center justify-center px-4 py-2.5 rounded-xl text-sm font-medium border-2 transition-all",
                  currencyDisplayMode === "symbol"
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground"
                )}
              >
                {selectedCurrency.symbol ?? selectedCurrency.english}
              </button>
            </div>
            </div>
          </div>
        {/* Version footer */}
        <div className="px-5 py-3 border-t border-border bg-muted/20 text-xs text-muted-foreground text-center">
          {APP_VERSION}
        </div>
      </div>
    </>
  );
}

import { useId, useRef, useState } from "react";
import { Check, Pipette, Plus, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { contrastText, toneColor, validHex, type ColorTone } from "@/lib/color-tools";

type Swatch = { id: string; hex: string; ar: string; en: string };
type Props = {
  isAR: boolean; label: string; palette: Swatch[]; selectedId?: string;
  baseHex: string; tone: ColorTone; customHex?: string;
  onPreset: (id: string) => void; onCustom: (hex: string) => void;
  onTone: (tone: ColorTone) => void; onReset: () => void;
};
const tones: { id: ColorTone; ar: string; en: string }[] = [
  { id: "original", ar: "أصلي", en: "Original" },
  { id: "dark", ar: "غامق", en: "Dark" },
  { id: "light", ar: "فاتح", en: "Light" },
  { id: "calm", ar: "هادئ", en: "Muted" },
];
export default function ColorStudio({ isAR, label, palette, selectedId, baseHex, tone, customHex, onPreset, onCustom, onTone, onReset }: Props) {
  const id = useId();
  const picker = useRef<HTMLInputElement>(null);
  const [hexDraft, setHexDraft] = useState<string | null>(null);
  const isCustom = validHex(customHex);
  const effective = toneColor(baseHex, tone);
  const selected = palette.find(option => option.id === selectedId);
  const colorName = isCustom ? (isAR ? "لون مخصص" : "Custom color") : selected ? (isAR ? selected.ar : selected.en) : (isAR ? "اللون الحالي" : "Current color");
  const toneName = tones.find(option => option.id === tone) || tones[0];
  const tr = (ar: string, en: string) => isAR ? ar : en;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/60 bg-muted/20 px-3 py-2.5">
        <div className="flex items-center gap-2.5 min-w-0">
          <span aria-hidden="true" className="h-8 w-8 shrink-0 rounded-lg border border-black/10 dark:border-white/20" style={{ background: effective }} />
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-foreground">{colorName} <span className="font-normal text-muted-foreground">· {isAR ? toneName.ar : toneName.en}</span></p>
            <span dir="ltr" className="font-mono text-[11px] text-muted-foreground">{effective.toUpperCase()}</span>
          </div>
        </div>
        <button type="button" onClick={() => { setHexDraft(null); onReset(); }} className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
          <RotateCcw className="h-3.5 w-3.5" />{tr("إلغاء التخصيص", "Reset adjustments")}
        </button>
      </div>
      <div role="group" aria-label={label} className="flex flex-wrap items-center gap-2.5">
        {palette.map(option => {
          const chosen = !isCustom && option.id === selectedId;
          const hex = option.hex;
          return <button type="button" key={option.id} title={isAR ? option.ar : option.en}
            aria-label={isAR ? option.ar : option.en} aria-pressed={chosen}
            onClick={() => { setHexDraft(null); onPreset(option.id); }}
            className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2", chosen ? "ring-2 ring-primary ring-offset-2 ring-offset-background border-transparent" : "border-black/10 dark:border-white/20 hover:ring-2 hover:ring-border")}
            style={{ background: hex, color: contrastText(hex) }}>
            {chosen && <Check aria-hidden="true" className="h-4 w-4" />}
          </button>;
        })}
        <span aria-hidden="true" className="mx-1 h-7 border-s border-border" />
        <button type="button" title={tr("إضافة لون مخصص", "Add a custom color")}
          aria-label={tr("إضافة لون مخصص", "Add a custom color")} aria-pressed={isCustom}
          onClick={() => picker.current?.click()}
          className={cn("flex h-10 w-10 items-center justify-center rounded-lg border border-dashed border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary", isCustom ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : "bg-muted/20 text-muted-foreground hover:border-primary")}
          style={isCustom ? { background: toneColor(customHex!, tone), color: contrastText(toneColor(customHex!, tone)) } : undefined}>
          {isCustom ? <Check aria-hidden="true" className="h-4 w-4" /> : <Plus aria-hidden="true" className="h-4 w-4" />}
        </button>
        <label className="relative flex h-10 w-10 cursor-pointer items-center justify-center overflow-hidden rounded-lg border border-border bg-[conic-gradient(red,yellow,lime,cyan,blue,magenta,red)]" title={tr("جميع الألوان", "Full color picker")}>
          <Pipette aria-hidden="true" className="pointer-events-none h-4 w-4 rounded bg-white/90 p-0.5 text-black" />
          <input ref={picker} type="color" value={validHex(baseHex) ? baseHex : "#1d4ed8"}
            aria-label={tr("اختيار من جميع الألوان", "Choose any color")}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            onChange={event => { setHexDraft(null); onCustom(event.target.value); }} />
        </label>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_140px]">
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">{tr("صفة اللون", "Color style")}</p>
          <div role="group" aria-label={tr("صفة اللون", "Color style")} className="flex flex-wrap gap-1.5">
            {tones.map(option => <button type="button" key={option.id} aria-pressed={tone === option.id}
              onClick={() => onTone(option.id)}
              className={cn("rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary", tone === option.id ? "border-primary bg-primary/10 text-primary" : "border-border bg-background text-muted-foreground hover:bg-muted")}>
              {isAR ? option.ar : option.en}
            </button>)}
          </div>
        </div>
        <div className="space-y-1.5">
          <label htmlFor={id} className="text-xs font-medium text-muted-foreground">{tr("كود لون مخصص", "Custom HEX color")}</label>
          <input id={id} dir="ltr" spellCheck={false} maxLength={7} placeholder="#RRGGBB"
            value={hexDraft ?? (isCustom ? customHex : "")}
            aria-invalid={hexDraft !== null && hexDraft !== "" && !validHex(hexDraft)}
            onChange={event => {
              const value = event.target.value; setHexDraft(value);
              if (validHex(value)) onCustom(value.toLowerCase());
            }}
            onBlur={() => setHexDraft(null)}
            className="h-8 w-full rounded-lg border border-border bg-background px-2 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-primary/20" />
        </div>
      </div>
    </div>
  );
}

/** Desktop measurements shared by Settings and Developer. Document previews are excluded. */
export default function CompactSettingsStyle() {
  return <style>{`
    [data-settings-shell] { width: 100%; min-width: 0; max-width: 100%; container-type: inline-size; }
    [data-settings-shell] [data-settings-controls] { min-width: 0; max-width: 100%; }
    [data-settings-shell] [data-settings-controls] :is(.grid, .flex, .grid > *, .flex > *):not([data-settings-preview], [data-settings-preview] *) { min-width: 0; }
    [data-settings-shell] [data-settings-controls] :is(input, select, textarea):not([data-settings-preview] *) { max-width: 100%; }
    [data-settings-shell] [data-settings-controls] :is(p, label, code, h2, h3, h4):not([data-settings-preview], [data-settings-preview] *) { overflow-wrap: anywhere; }
    [data-settings-shell] nav { flex-wrap: wrap; white-space: normal; overflow: visible; }
    @container (max-width: 900px) {
      [data-settings-shell] [data-settings-controls] .grid:not([data-settings-preview], [data-settings-preview] *) { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      [data-settings-shell] [data-settings-controls] .grid:has(> [data-settings-fold]),
      [data-settings-shell] [data-settings-controls] .grid:has(> .shadow-sm) { grid-template-columns: minmax(0, 1fr); }
    }
    @container (max-width: 560px) {
      [data-settings-shell] [data-settings-controls] .grid:not([data-settings-preview], [data-settings-preview] *) { grid-template-columns: minmax(0, 1fr); }
    }
    [data-settings-shell] [data-settings-field] { display: grid; grid-template-columns: minmax(100px, 30%) minmax(0, 1fr); align-items: center; gap: 8px; }
    [data-settings-shell] [data-settings-field] > :is(label, div) { min-width: 0; margin: 0; }
    [data-settings-shell] [data-settings-field] > label { line-height: 18px; }
    [data-settings-shell] [data-settings-toggle-row] { border-radius: 0; padding-block: 6px; background: transparent; }
    [data-settings-shell] [data-settings-toggle-row] > div { flex: 1; }
    [data-settings-shell] [data-settings-toggle-row] > button { flex-shrink: 0; }
    [data-settings-shell] [data-settings-toggle-row] > div > div:last-child { margin-top: 2px; }
    [data-settings-shell] [data-settings-controls] .shadow-sm:not([data-settings-preview], [data-settings-preview] *) { box-shadow: none; border-radius: 6px; }
    [data-settings-shell] [data-settings-controls] section > div:first-child:not([data-settings-preview], [data-settings-preview] *) { padding-block: 8px; border-radius: 6px; }
    [data-settings-shell] [data-settings-controls] :is(.space-y-3, .space-y-4):has(> [data-settings-toggle-row]) > [data-settings-toggle-row] { margin-block: 0; }
    @container (max-width: 480px) {
      [data-settings-shell] [data-settings-field] { grid-template-columns: minmax(0, 1fr); gap: 4px; }
    }
    [data-settings-shell] [data-settings-fold] { display: block; min-width: 0; border: 1px solid hsl(var(--border)); border-radius: 6px; background: hsl(var(--card)); padding: 0; box-shadow: none; }
    [data-settings-shell] [data-settings-fold][hidden] { display: none; }
    [data-settings-shell] [data-settings-fold] > summary { padding: 8px 12px; min-height: 34px; list-style: none; font-size: 13px; line-height: 18px; }
    [data-settings-shell] [data-settings-fold] > summary::-webkit-details-marker { display: none; }
    [data-settings-shell] [data-settings-fold] > summary > h2 { font-size: 15px; line-height: 20px; }
    [data-settings-shell] [data-settings-fold][open] > summary { border-bottom: 1px solid hsl(var(--border)); }
    [data-settings-shell] [data-settings-fold][open] > summary > span:last-child[aria-hidden] { transform: rotate(180deg); }
    [data-settings-shell] [data-settings-fold] > :not(summary) { margin: 0; padding: 10px 12px; }
    [data-settings-shell] [data-settings-appearance] .grid:has(> button) { grid-template-columns: repeat(auto-fit, minmax(110px, 1fr)); gap: 8px; }
    [data-settings-shell] [data-settings-appearance] .grid > button { flex-direction: row; flex-wrap: wrap; align-items: center; justify-content: center; padding: 6px 8px; border-radius: 6px; gap: 6px; }
    [data-settings-shell] [data-settings-appearance] .grid > button > span.w-8 { width: 20px; height: 20px; }
    [data-compact-settings] { font-size: 13px; line-height: 18px; }
    [data-compact-settings] h1 { font-size: 18px; line-height: 24px; }
    [data-compact-settings] > div > div > div > h1 { font-size: 18px; }
    [data-compact-settings] nav button,
    [data-compact-settings] > div button:not([role="switch"]):not([role="checkbox"]):not([role="radio"]):not([data-settings-preview] *) {
      height: auto; min-height: 32px; padding: 5px 10px; font-size: 13px; line-height: 20px;
    }
    [data-compact-settings] [data-settings-preview] { font-size: 16px; }
    [data-compact-settings] [data-settings-controls] :is(label, p, span, code, input, select, textarea, summary, .text-sm, .text-base):not([data-settings-preview], [data-settings-preview] *) {
      font-size: 13px; line-height: 18px;
    }
    [data-compact-settings] [data-settings-controls] :is(.text-xs, .text-\\[11px\\]):not([data-settings-preview], [data-settings-preview] *) {
      font-size: 12px; line-height: 18px;
    }
    [data-compact-settings] [data-settings-controls] :is(h2, h3, h4, .text-lg, .text-xl, .text-2xl):not([data-settings-preview], [data-settings-preview] *) {
      font-size: 16px; line-height: 22px;
    }
    [data-compact-settings] [data-settings-controls] :is(input, select):not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="file"]):not([type="color"]):not([data-settings-preview] *) {
      height: 34px; min-height: 34px; padding-top: 5px; padding-bottom: 5px; font-size: 13px; line-height: 18px;
    }
    [data-compact-settings] [data-settings-controls] textarea:not([data-settings-preview] *) {
      font-size: 13px; line-height: 18px; padding: 8px 10px;
    }
    [data-compact-settings] [data-settings-controls] button:not([role="switch"]):not([role="checkbox"]):not([role="radio"]):not([data-settings-preview] *) {
      height: auto; min-height: 32px; padding-top: 5px; padding-bottom: 5px; font-size: 13px; line-height: 20px;
    }
    [data-compact-settings] [data-settings-controls] :is([class~="p-4"], [class~="p-5"], [class~="p-6"], [class~="p-8"]):not([data-settings-preview], [data-settings-preview] *) { padding: 12px; }
    [data-compact-settings] [data-settings-controls] [class~="px-4"]:not([data-settings-preview], [data-settings-preview] *) { padding-inline: 12px; }
    [data-compact-settings] [data-settings-controls] [class~="pb-4"]:not([data-settings-preview], [data-settings-preview] *) { padding-bottom: 12px; }
    [data-compact-settings] [data-settings-controls] [class~="pt-0"]:not([data-settings-preview], [data-settings-preview] *) { padding-top: 0; }
    [data-compact-settings] [data-settings-controls] .grid:not([data-settings-preview], [data-settings-preview] *) { gap: 10px; }
    [data-compact-settings] [data-settings-controls] :is(.gap-3, .gap-4, .gap-5, .gap-6):not([data-settings-preview], [data-settings-preview] *) { gap: 10px; }
    [data-compact-settings] [data-settings-controls] .grid:has(> .shadow-sm):not([data-settings-preview], [data-settings-preview] *) { gap: 12px; }
    [data-compact-settings] [data-settings-controls] :is(.space-y-2, .space-y-3, .space-y-4, .space-y-5, .space-y-6, .space-y-8):not([data-settings-preview], [data-settings-preview] *) > :not([hidden]) { margin-block: 0; }
    [data-compact-settings] [data-settings-controls] :is(.space-y-4, .space-y-5):not([data-settings-preview], [data-settings-preview] *) > :not([hidden]) ~ :not([hidden]) { margin-block-start: 12px; margin-block-end: 0; }
    [data-compact-settings] [data-settings-controls] :is(.space-y-6, .space-y-8):not([data-settings-preview], [data-settings-preview] *) > :not([hidden]) ~ :not([hidden]) { margin-block-start: 16px; margin-block-end: 0; }
    [data-compact-settings] [data-settings-controls] .space-y-3:not([data-settings-preview], [data-settings-preview] *) > :not([hidden]) ~ :not([hidden]) { margin-block-start: 10px; margin-block-end: 0; }
    [data-compact-settings] [data-settings-controls] .space-y-2:not([data-settings-preview], [data-settings-preview] *) > :not([hidden]) ~ :not([hidden]) { margin-block-start: 8px; margin-block-end: 0; }
    [data-compact-settings] [data-settings-controls] .min-h-10:not([data-settings-preview], [data-settings-preview] *) { min-height: 34px; }
    [data-compact-settings] [data-settings-controls] .relative > button[aria-pressed] {
      min-height: 30px; height: 30px; width: 30px; padding: 5px;
    }
  `}</style>;
}

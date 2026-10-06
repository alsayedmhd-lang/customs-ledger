export type ColorTone = "original" | "dark" | "light" | "calm" | "petrol" | "olive";
export function validHex(value: unknown): value is string {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value);
}
export function hexToHsl(hex: string): [number, number, number] {
  const value = validHex(hex) ? hex : "#1d4ed8";
  const [r,g,b] = [1,3,5].map(i => parseInt(value.slice(i,i+2),16)/255);
  const max = Math.max(r,g,b), min = Math.min(r,g,b), delta = max-min;
  const l = (max+min)/2;
  let h = 0, s = 0;
  if (delta) {
    s = delta/(1-Math.abs(2*l-1));
    h = max === r ? ((g-b)/delta)%6 : max === g ? (b-r)/delta+2 : (r-g)/delta+4;
    h = (h*60+360)%360;
  }
  return [h,s*100,l*100];
}
export function hslToHex(h: number, s: number, l: number): string {
  s /= 100; l /= 100;
  const a = s*Math.min(l,1-l);
  const channel = (n: number) => {
    const k = (n+h/30)%12;
    return Math.round(255*(l-a*Math.max(-1,Math.min(k-3,9-k,1)))).toString(16).padStart(2,"0");
  };
  return `#${channel(0)}${channel(8)}${channel(4)}`;
}
export function toneColor(base: string, tone: ColorTone = "original"): string {
  const safe = validHex(base) ? base.toLowerCase() : "#1d4ed8";
  if (tone === "original") return safe;
  let [h,s,l] = hexToHsl(safe);
  if (tone === "dark") l = Math.min(l,28);
  if (tone === "light") { l = 82; s = Math.min(s,65); }
  if (tone === "calm") { s = Math.min(s,30); l = 52; }
  if (tone === "petrol") {
    const hueDistance = ((h - 195 + 540) % 360) - 180;
    h = (195 + hueDistance * 0.08 + 360) % 360;
    s = Math.max(35, Math.min(70, 30 + s * 0.4));
    l = Math.max(20, Math.min(45, 12 + l * 0.55));
  }
  if (tone === "olive") {
    const hueDistance = ((h - 78 + 540) % 360) - 180;
    h = (78 + hueDistance * 0.07 + 360) % 360;
    s = Math.max(25, Math.min(55, 20 + s * 0.35));
    l = Math.max(22, Math.min(48, 14 + l * 0.55));
  }
  return hslToHex(h,s,l);
}
export function hslCss(hex: string): string {
  const [h,s,l] = hexToHsl(hex);
  return `${h.toFixed(2)} ${s.toFixed(2)}% ${l.toFixed(2)}%`;
}
export function contrastText(hex: string): "#ffffff" | "#000000" {
  const values = [1,3,5].map(i => parseInt(hex.slice(i,i+2),16)/255)
    .map(v => v <= 0.04045 ? v/12.92 : ((v+0.055)/1.055)**2.4);
  const luminance = values[0]*0.2126+values[1]*0.7152+values[2]*0.0722;
  return (luminance+0.05)/0.05 >= 1.05/(luminance+0.05) ? "#000000" : "#ffffff";
}

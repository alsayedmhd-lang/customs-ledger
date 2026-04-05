import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Formats a number with standard digits and decimal places */
export function formatNumber(value: number | string | null | undefined, decimals = 0): string {
  if (value == null || value === "") return "0";
  const n = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(n)) return "0";
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(n);
}

/** Returns the current active currency symbol from localStorage */
export function getActiveCurrencySymbol(): string {
  return localStorage.getItem("currency_symbol") ?? "ر.ق";
}

/** Formats currency with standard digits and the active currency symbol */
export function formatCurrency(amount: number | string | null | undefined, symbol?: string): string {
  const sym = symbol ?? getActiveCurrencySymbol();
  if (amount == null || amount === "") return `0.00 ${sym}`;
  const n = typeof amount === "string" ? parseFloat(amount) : amount;
  if (isNaN(n)) return `0.00 ${sym}`;
  return (
    new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(n) + " " + sym
  );
}

/** Formats a date string in Arabic locale (readable Arabic month names, standard digits) */
export function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return "—";
  try {
    return new Intl.DateTimeFormat("ar-EG-u-nu-latn", {
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(new Date(dateString));
  } catch {
    return dateString;
  }
}

/** No-op: kept for compatibility, just returns the value as a string */
export function arabicNums(value: string | number): string {
  return String(value);
}

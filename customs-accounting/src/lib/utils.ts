import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export type DisplayLanguage = "ar" | "en";

const DISPLAY_LOCALES: Record<DisplayLanguage, string> = {
  ar: "ar-EG-u-nu-latn",
  en: "en-US-u-nu-latn",
};

function displayLocale(language: DisplayLanguage) {
  return DISPLAY_LOCALES[language];
}

/**
 * Keeps YYYY-MM-DD values in their stored calendar day.
 * new Date("YYYY-MM-DD") is UTC and can otherwise display the previous day.
 */
function parseDisplayDate(value: string | Date): Date {
  if (value instanceof Date) return value;

  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (dateOnly) {
    return new Date(
      Number(dateOnly[1]),
      Number(dateOnly[2]) - 1,
      Number(dateOnly[3]),
    );
  }

  return new Date(value);
}

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatNumber(
  value: number | string | null | undefined,
  decimals = 0,
  language: DisplayLanguage,
): string {
  if (value == null || value === "") return "0";

  const n = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(n)) return "0";

  return new Intl.NumberFormat(displayLocale(language), {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(n);
}

export function getActiveCurrencySymbol(): string {
  return localStorage.getItem("currency_symbol") ?? "ر.ق";
}

export function formatCurrency(
  amount: number | string | null | undefined,
  symbol: string | undefined,
  language: DisplayLanguage,
): string {
  const sym = symbol ?? getActiveCurrencySymbol();

  if (amount == null || amount === "") {
    return `${formatNumber(0, 2, language)} ${sym}`;
  }

  const n = typeof amount === "string" ? parseFloat(amount) : amount;
  if (isNaN(n)) return `${formatNumber(0, 2, language)} ${sym}`;

  return `${formatNumber(n, 2, language)} ${sym}`;
}

export function formatDate(
  dateString: string | null | undefined,
  lang: "ar" | "en",
): string {
  if (!dateString) return "—";

  try {
    return new Intl.DateTimeFormat(
      lang === "ar" ? "ar-EG-u-nu-latn" : "en-US",
      {
        year: "numeric",
        month: "short",
        day: "numeric",
      },
    ).format(new Date(dateString));
  } catch {
    return dateString;
  }
}

export function formatDateTime(
  value: string | number | null | undefined,
  language: DisplayLanguage,
): string {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  return new Intl.DateTimeFormat(displayLocale(language), {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

/** Formats identifiers while preserving leading zeroes, e.g. 0001. */
export function formatDigits(value: string | number, language: DisplayLanguage): string {
  const formatter = new Intl.NumberFormat(displayLocale(language), {
    useGrouping: false,
  });

  return String(value).replace(/\d/g, (digit) => formatter.format(Number(digit)));
}

/** Keep old call sites meaningful; prefer formatNumber or formatDigits in new code. */
export function arabicNums(value: string | number, language: DisplayLanguage): string {
  return formatDigits(value, language);
}
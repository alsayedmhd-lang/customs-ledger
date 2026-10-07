function localDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function describeDatePeriod(from: string, to: string, lang: string, now = new Date()): string {
  const ar = lang === "ar";
  const today = localDate(now);
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 6, 1);
  const lastDay = new Date(sixMonthsAgo.getFullYear(), sixMonthsAgo.getMonth() + 1, 0).getDate();
  sixMonthsAgo.setDate(Math.min(now.getDate(), lastDay));
  if (to === today && from === localDate(sixMonthsAgo)) {
    return ar ? "خلال آخر 6 أشهر" : "over the last 6 months";
  }
  if (to === today && from === localDate(new Date(now.getFullYear(), now.getMonth(), 1))) {
    return ar ? "من أول الشهر إلى اليوم" : "from the start of the month to today";
  }
  const display = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) ? value.split("-").reverse().join("/") : value;
  if (from && to) return ar ? `من ${display(from)} إلى ${display(to)}` : `from ${display(from)} to ${display(to)}`;
  if (from) return ar ? `من ${display(from)}` : `from ${display(from)}`;
  if (to) return ar ? `حتى ${display(to)}` : `through ${display(to)}`;
  return ar ? "لكامل الفترة" : "for all dates";
}

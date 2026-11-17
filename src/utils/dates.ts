import type { DateValue } from "../types/domain";

export const UNKNOWN_DATE: DateValue = { precision: "unknown", value: null };
export function isCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return (
    year > 0 && month >= 1 && month <= 12 && day >= 1 && day <= days[month - 1]
  );
}
export function dateBounds(date: DateValue): [string, string] | null {
  if (date.precision === "unknown") return null;
  if (date.precision === "year")
    return [`${date.value}-01-01`, `${date.value}-12-31`];
  if (date.precision === "month")
    return [`${date.value}-01`, `${date.value}-31`];
  return [date.value, date.value];
}
/** Compare date-only air dates using the browser's local calendar day. */
export function localToday() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

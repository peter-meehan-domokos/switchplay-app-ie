/** Date-only arithmetic; never silently replaces invalid input with today. */
export function parseDateOfBirth(value: unknown): string {
  if (typeof value !== "string" || value.length !== 10 || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error("INVALID_DATE_OF_BIRTH");
  const [year, month, day] = value.split("-").map(Number);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > days[month - 1]) throw new Error("INVALID_DATE_OF_BIRTH");
  return value;
}
export function dublinToday(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Dublin", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const part = (name: string) => parts.find(p => p.type === name)!.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}
export function ageOn(dateOfBirth: string, today = dublinToday()): number {
  parseDateOfBirth(dateOfBirth); parseDateOfBirth(today);
  if (dateOfBirth > today) throw new Error("FUTURE_DATE_OF_BIRTH");
  const year = Number(today.slice(0, 4));
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const birthday = dateOfBirth.slice(5) === "02-29" && !leap ? "03-01" : dateOfBirth.slice(5);
  return year - Number(dateOfBirth.slice(0, 4)) - Number(today.slice(5) < birthday);
}

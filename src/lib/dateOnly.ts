const isoDateOnlyRegex = /^\d{4}-\d{2}-\d{2}$/;

export function formatLocalDateOnly(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function getTodayDateOnly() {
  return formatLocalDateOnly(new Date());
}

export function isIsoDateOnlyString(value: unknown): value is string {
  if (typeof value !== "string") {
    return false;
  }

  const normalizedDateString = value.trim();

  if (!isoDateOnlyRegex.test(normalizedDateString)) {
    return false;
  }

  const [yearRaw, monthRaw, dayRaw] = normalizedDateString.split("-");
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);
  const candidateDate = new Date(Date.UTC(year, month - 1, day));

  return (
    candidateDate.getUTCFullYear() === year &&
    candidateDate.getUTCMonth() === month - 1 &&
    candidateDate.getUTCDate() === day
  );
}

export function resolveDateOnly(value: unknown, fallback = getTodayDateOnly()) {
  return isIsoDateOnlyString(value) ? value.trim() : fallback;
}

export function addDaysToDateOnly(value: unknown, amount: number, fallback = getTodayDateOnly()) {
  const dateOnly = resolveDateOnly(value, fallback);
  const [year, month, day] = dateOnly.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + amount));

  return date.toISOString().slice(0, 10);
}

export function dateOnlyToUtcDate(value: unknown, fallback = getTodayDateOnly()) {
  const dateOnly = resolveDateOnly(value, fallback);
  const [year, month, day] = dateOnly.split("-").map(Number);

  return new Date(Date.UTC(year, month - 1, day));
}

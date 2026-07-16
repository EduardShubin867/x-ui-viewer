const pad = (value: number) => String(value).padStart(2, "0");

export const PERIOD_LABELS: Record<string, string> = {
  "5": "5 минут",
  "15": "15 минут",
  "60": "1 час",
  "360": "6 часов",
  "1440": "24 часа",
};

export function toLocalDateTimeInput(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function localDateTimeInputToIso(value: string): string | null {
  const date = new Date(value);
  return value && !Number.isNaN(date.getTime()) ? date.toISOString() : null;
}

export function formatUtcOffset(date = new Date()): string {
  const totalMinutes = -date.getTimezoneOffset();
  const sign = totalMinutes >= 0 ? "+" : "−";
  const absolute = Math.abs(totalMinutes);
  const hours = Math.floor(absolute / 60);
  const minutes = absolute % 60;
  return `UTC${sign}${hours}${minutes ? `:${pad(minutes)}` : ""}`;
}

export function formatRangeSummary(from: string, to: string): string {
  const start = new Date(from);
  const end = new Date(to);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()))
    return "Точный период";
  const sameDay =
    start.toLocaleDateString("ru-RU") === end.toLocaleDateString("ru-RU");
  const time = (date: Date) =>
    date.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
  if (sameDay)
    return `${start.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" })}, ${time(start)}–${time(end)}`;
  return `${start.toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })} – ${end.toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}`;
}

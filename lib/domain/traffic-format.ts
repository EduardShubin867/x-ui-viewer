export function formatBytes(value: string | bigint | number): string {
  const bytes = Number(value);
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 Б";
  const units = ["Б", "КБ", "МБ", "ГБ", "ТБ"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** index).toLocaleString("ru-RU", { maximumFractionDigits: index ? 1 : 0 })} ${units[index]}`;
}

export function formatBitrate(bytesPerSecond: string | bigint | number): string {
  const bits = Number(bytesPerSecond) * 8;
  if (!Number.isFinite(bits) || bits <= 0) return "0 бит/с";
  if (bits >= 1_000_000_000) return `${(bits / 1_000_000_000).toLocaleString("ru-RU", { maximumFractionDigits: 1 })} Гбит/с`;
  if (bits >= 1_000_000) return `${(bits / 1_000_000).toLocaleString("ru-RU", { maximumFractionDigits: 1 })} Мбит/с`;
  if (bits >= 1_000) return `${(bits / 1_000).toLocaleString("ru-RU", { maximumFractionDigits: 1 })} Кбит/с`;
  return `${Math.round(bits)} бит/с`;
}

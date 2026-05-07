export function normalizeString(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLowerCase();
}

export function toNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  const normalized = String(value ?? '')
    .replace(/[^0-9.-]/g, '')
    .trim();
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : fallback;
}

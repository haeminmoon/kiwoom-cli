/**
 * Kiwoom value normalization.
 *
 * The REST API returns numbers as strings: integers are often zero-padded to a
 * fixed width ("000000019471143"), and price/percent fields carry a leading
 * sign that encodes direction ("+0.39", "-350000"). These helpers turn those
 * wire values into something readable without losing the sign.
 */

// Kiwoom occasionally double-signs delta fields, e.g. "--3405260" (negative
// delta) or "++100"; treat a leading run of signs as one effective sign where
// any '-' makes it negative.
const NUMERIC_RE = /^([+-]*)0*(\d+)(\.\d+)?$/;

/**
 * Strip zero-padding while preserving sign and decimals.
 * "000000019471143" -> "19471143", "-00000001485445" -> "-1485445",
 * "+0.39" -> "+0.39", "--3405260" -> "-3405260", "000000000000000" -> "0".
 * Non-numeric strings (codes, dates-as-text, "KRX") are returned unchanged.
 */
export function unpad(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  const str = String(value).trim();
  const m = str.match(NUMERIC_RE);
  if (!m) return str;
  const sign = m[1].includes('-') ? '-' : m[1].includes('+') ? '+' : '';
  const intPart = m[2].replace(/^0+(?=\d)/, '');
  return `${sign}${intPart}${m[3] ?? ''}`;
}

/** Parse a Kiwoom numeric string into a JS number (sign + padding aware). */
export function toNumber(value: string | number | null | undefined): number {
  if (value === null || value === undefined || value === '') return NaN;
  const cleaned = unpad(value).replace(/^\+/, '');
  // Guard sign-only/empty results so "+" doesn't coerce to 0.
  if (cleaned === '' || cleaned === '-' || cleaned === '+') return NaN;
  const n = Number(cleaned);
  return Number.isNaN(n) ? NaN : n;
}

/** Group an integer/decimal string with thousands separators, keeping sign. */
export function withCommas(value: string): string {
  const m = value.match(/^([+-]?)(\d+)(\.\d+)?$/);
  if (!m) return value;
  const grouped = m[2].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${m[1]}${grouped}${m[3] ?? ''}`;
}

/** Format a (possibly zero-padded) won amount as "19,471,143". */
export function won(value: string | number | null | undefined): string {
  return withCommas(unpad(value));
}

/**
 * Format a market price. Kiwoom prefixes quote/chart prices with a direction
 * sign (e.g. "-353750" = price 353,750, trading below prior close); that sign
 * is NOT part of the value, so it is dropped and the magnitude is grouped.
 */
export function price(value: string | number | null | undefined): string {
  return withCommas(unpad(value).replace(/^[+-]/, ''));
}

/**
 * Format a Kiwoom date/time stamp for display.
 * "20260622135400" -> "2026-06-22 13:54:00"
 * "20260622"       -> "2026-06-22"
 * "135400"         -> "13:54:00"
 */
export function formatStamp(value: string | null | undefined): string {
  if (!value) return '';
  const s = String(value).trim();
  if (/^\d{14}$/.test(s)) {
    return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)} ${s.slice(8, 10)}:${s.slice(10, 12)}:${s.slice(12, 14)}`;
  }
  if (/^\d{8}$/.test(s)) {
    return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
  }
  if (/^\d{6}$/.test(s)) {
    return `${s.slice(0, 2)}:${s.slice(2, 4)}:${s.slice(4, 6)}`;
  }
  return s;
}

/**
 * Apply a set of formatters to selected keys of an object (shallow).
 * Used by table commands to pretty-print known numeric fields.
 */
export function formatFields<T extends Record<string, unknown>>(
  row: T,
  formatters: Partial<Record<keyof T | string, (v: string) => string>>,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...row };
  for (const [key, fn] of Object.entries(formatters)) {
    if (fn && out[key] !== undefined && out[key] !== null) {
      out[key] = fn(String(out[key]));
    }
  }
  return out;
}

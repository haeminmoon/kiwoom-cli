import { ActionableError } from '../output/error';

/** Parse an integer strictly, throwing on failure. */
export function parseIntStrict(value: string, name: string): number {
  const n = parseInt(value, 10);
  if (Number.isNaN(n)) {
    throw new Error(`Invalid ${name}: "${value}" is not a valid integer`);
  }
  return n;
}

/** Parse a float strictly, throwing on failure. */
export function parseFloatStrict(value: string, name: string): number {
  const n = parseFloat(value);
  if (Number.isNaN(n)) {
    throw new Error(`Invalid ${name}: "${value}" is not a valid number`);
  }
  return n;
}

/**
 * Normalize a Korean stock code to the 6-digit form the API expects.
 * Accepts "005930", "A005930" (response form), or "005930_AL" style suffixes.
 */
export function normalizeStockCode(code: string): string {
  const trimmed = code.trim().toUpperCase();
  const stripped = trimmed.replace(/^A(?=\d)/, '');
  const base = stripped.split('_')[0];
  if (!/^\d{6}$/.test(base)) {
    throw new ActionableError(
      `Invalid stock code "${code}". Expected a 6-digit code like 005930 (삼성전자).`,
    );
  }
  return base;
}

/**
 * Parse a Kiwoom expiry stamp ("YYYYMMDDHHmmss", Korea Standard Time) into
 * epoch milliseconds.
 */
export function parseKiwoomExpiry(expiresDt: string): number {
  const m = expiresDt.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/);
  if (!m) return NaN;
  const [, y, mo, d, h, mi, s] = m;
  // KST is UTC+9, no DST.
  return Date.parse(`${y}-${mo}-${d}T${h}:${mi}:${s}+09:00`);
}

/** True if the token is expired or will expire within `bufferMs`. */
export function isTokenExpired(expiresDt: string, bufferMs = 0): boolean {
  const expiry = parseKiwoomExpiry(expiresDt);
  if (Number.isNaN(expiry)) return true;
  return Date.now() + bufferMs >= expiry;
}

/** Today's date in KST as "YYYYMMDD". */
export function todayKst(): string {
  const now = new Date(Date.now() + 9 * 3600 * 1000);
  return now.toISOString().slice(0, 10).replace(/-/g, '');
}

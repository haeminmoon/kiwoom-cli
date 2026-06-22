import {
  parseIntStrict,
  parseFloatStrict,
  normalizeStockCode,
  parseKiwoomExpiry,
  isTokenExpired,
  todayKst,
} from '../../utils/helpers';
import { ActionableError } from '../../output/error';

describe('parseIntStrict', () => {
  it('parses integers', () => {
    expect(parseIntStrict('42', 'count')).toBe(42);
  });
  it('throws on garbage', () => {
    expect(() => parseIntStrict('abc', 'count')).toThrow(/Invalid count/);
  });
});

describe('parseFloatStrict', () => {
  it('parses floats', () => {
    expect(parseFloatStrict('3.14', 'price')).toBeCloseTo(3.14);
  });
  it('throws on garbage', () => {
    expect(() => parseFloatStrict('xyz', 'price')).toThrow(/Invalid price/);
  });
});

describe('normalizeStockCode', () => {
  it('accepts a plain 6-digit code', () => {
    expect(normalizeStockCode('005930')).toBe('005930');
  });
  it('strips the A prefix from response-form codes', () => {
    expect(normalizeStockCode('A001060')).toBe('001060');
  });
  it('strips suffixes', () => {
    expect(normalizeStockCode('005930_AL')).toBe('005930');
  });
  it('rejects invalid codes', () => {
    expect(() => normalizeStockCode('12345')).toThrow(ActionableError);
    expect(() => normalizeStockCode('hello')).toThrow(/Invalid stock code/);
  });
});

describe('parseKiwoomExpiry', () => {
  it('parses a KST stamp to epoch ms', () => {
    // 2026-06-23 13:53:31 KST === 2026-06-23 04:53:31 UTC
    const ms = parseKiwoomExpiry('20260623135331');
    expect(new Date(ms).toISOString()).toBe('2026-06-23T04:53:31.000Z');
  });
  it('returns NaN for malformed input', () => {
    expect(parseKiwoomExpiry('nope')).toBeNaN();
  });
});

describe('isTokenExpired', () => {
  it('is false for a far-future stamp', () => {
    expect(isTokenExpired('20991231235959')).toBe(false);
  });
  it('is true for a past stamp', () => {
    expect(isTokenExpired('20000101000000')).toBe(true);
  });
  it('honors the buffer', () => {
    const soon = new Date(Date.now() + 30_000 + 9 * 3600 * 1000);
    const stamp = soon
      .toISOString()
      .slice(0, 19)
      .replace(/[-:T]/g, '');
    expect(isTokenExpired(stamp, 60_000)).toBe(true);
    expect(isTokenExpired(stamp, 1_000)).toBe(false);
  });
  it('treats malformed stamps as expired', () => {
    expect(isTokenExpired('garbage')).toBe(true);
  });
});

describe('todayKst', () => {
  it('returns an 8-digit date', () => {
    expect(todayKst()).toMatch(/^\d{8}$/);
  });
});

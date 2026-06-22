import {
  unpad,
  toNumber,
  withCommas,
  won,
  price,
  formatStamp,
  formatFields,
} from '../../utils/format';

describe('unpad', () => {
  it('strips zero padding', () => {
    expect(unpad('000000019471143')).toBe('19471143');
    expect(unpad('000000009173000')).toBe('9173000');
  });

  it('keeps a single zero for all-zero input', () => {
    expect(unpad('000000000000000')).toBe('0');
    expect(unpad('0')).toBe('0');
  });

  it('preserves sign', () => {
    expect(unpad('-00000001485445')).toBe('-1485445');
    expect(unpad('+0.39')).toBe('+0.39');
    expect(unpad('-350000')).toBe('-350000');
  });

  it('preserves decimals', () => {
    expect(unpad('00123.4500')).toBe('123.4500');
  });

  it('collapses Kiwoom double signs', () => {
    expect(unpad('--3405260')).toBe('-3405260');
    expect(unpad('--14284')).toBe('-14284');
    expect(unpad('++100')).toBe('+100');
  });

  it('returns non-numeric strings unchanged', () => {
    expect(unpad('A001060')).toBe('A001060');
    expect(unpad('KRX')).toBe('KRX');
    expect(unpad('삼성전자')).toBe('삼성전자');
  });

  it('handles null/undefined/empty', () => {
    expect(unpad(null)).toBe('');
    expect(unpad(undefined)).toBe('');
    expect(unpad('')).toBe('');
  });

  it('accepts numbers', () => {
    expect(unpad(42)).toBe('42');
  });
});

describe('toNumber', () => {
  it('parses padded and signed values', () => {
    expect(toNumber('000000019471143')).toBe(19471143);
    expect(toNumber('-00000001485445')).toBe(-1485445);
    expect(toNumber('+0.39')).toBeCloseTo(0.39);
  });

  it('returns NaN for non-numeric/empty', () => {
    expect(toNumber('')).toBeNaN();
    expect(toNumber('KRX')).toBeNaN();
    expect(toNumber(null)).toBeNaN();
  });

  it('returns NaN for sign-only values (not 0)', () => {
    expect(toNumber('+')).toBeNaN();
    expect(toNumber('-')).toBeNaN();
  });

  it('handles double-signed deltas', () => {
    expect(toNumber('--3405260')).toBe(-3405260);
  });
});

describe('withCommas', () => {
  it('groups thousands', () => {
    expect(withCommas('19471143')).toBe('19,471,143');
    expect(withCommas('-1485445')).toBe('-1,485,445');
    expect(withCommas('123')).toBe('123');
  });

  it('keeps decimals out of grouping', () => {
    expect(withCommas('1234.5678')).toBe('1,234.5678');
  });
});

describe('won', () => {
  it('unpads then groups', () => {
    expect(won('000000019471143')).toBe('19,471,143');
    expect(won('-00000001485445')).toBe('-1,485,445');
  });
});

describe('price', () => {
  it('drops the direction sign and groups the magnitude', () => {
    expect(price('-353750')).toBe('353,750');
    expect(price('+363000')).toBe('363,000');
    expect(price('354000')).toBe('354,000');
    expect(price('000000025750')).toBe('25,750');
  });
});

describe('formatStamp', () => {
  it('formats datetime', () => {
    expect(formatStamp('20260622135400')).toBe('2026-06-22 13:54:00');
  });
  it('formats date', () => {
    expect(formatStamp('20260622')).toBe('2026-06-22');
  });
  it('formats time', () => {
    expect(formatStamp('135400')).toBe('13:54:00');
  });
  it('passes through unknown shapes', () => {
    expect(formatStamp('abc')).toBe('abc');
    expect(formatStamp('')).toBe('');
  });
});

describe('formatFields', () => {
  it('applies formatters to named keys only', () => {
    const row = { stk_nm: '삼성전자', cur_prc: '-350000', qty: '000000060' };
    const out = formatFields(row, {
      cur_prc: (v) => unpad(v),
      qty: (v) => won(v),
    });
    expect(out.stk_nm).toBe('삼성전자');
    expect(out.cur_prc).toBe('-350000');
    expect(out.qty).toBe('60');
  });

  it('ignores missing keys', () => {
    const out = formatFields({ a: '1' }, { b: (v) => v });
    expect(out).toEqual({ a: '1' });
  });
});

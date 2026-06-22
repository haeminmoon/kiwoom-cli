import { _internal } from '../../commands/order';
import { ActionableError } from '../../output/error';

const { resolveExchange, resolveOrderType } = _internal;

describe('resolveExchange', () => {
  it('defaults to KRX', () => {
    expect(resolveExchange(undefined)).toBe('KRX');
  });
  it('uppercases and accepts NXT/SOR', () => {
    expect(resolveExchange('nxt')).toBe('NXT');
    expect(resolveExchange('sor')).toBe('SOR');
  });
  it('rejects unknown exchanges', () => {
    expect(() => resolveExchange('foo')).toThrow(ActionableError);
  });
});

describe('resolveOrderType', () => {
  it('defaults to market when no type and no price', () => {
    expect(resolveOrderType(undefined, undefined)).toEqual({ trde_tp: '3', ord_uv: '' });
  });

  it('defaults to limit when a price is given', () => {
    expect(resolveOrderType(undefined, '70000')).toEqual({ trde_tp: '0', ord_uv: '70000' });
  });

  it('honors an explicit market type and forces empty price', () => {
    expect(resolveOrderType('3', undefined)).toEqual({ trde_tp: '3', ord_uv: '' });
  });

  it('rejects a market order that carries a price', () => {
    expect(() => resolveOrderType('3', '70000')).toThrow(/must not specify a price/);
  });

  it('rejects a limit order without a price', () => {
    expect(() => resolveOrderType('0', undefined)).toThrow(/requires --price/);
  });

  it('rejects an unknown order type', () => {
    expect(() => resolveOrderType('999', '1000')).toThrow(/Invalid order type/);
  });

  it('accepts a conditional limit type with a price', () => {
    expect(resolveOrderType('5', '70000')).toEqual({ trde_tp: '5', ord_uv: '70000' });
  });
});

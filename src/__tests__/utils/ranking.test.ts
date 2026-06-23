import { extractNetTrade, buildNetTradeResult, NETTRADE_FIELDS } from '../../utils/ranking';
import { unpad, won } from '../../utils/format';

// Synthetic ka90009 `frgnr_orgn_trde_upper` rows: each row carries 4 parallel rankings.
const rows: Record<string, string>[] = [
  {
    for_netprps_stk_cd: '005930', for_netprps_stk_nm: '삼성전자', for_netprps_amt: '0000010000', for_netprps_qty: '0000000100',
    orgn_netprps_stk_cd: '000660', orgn_netprps_stk_nm: 'SK하이닉스', orgn_netprps_amt: '0000020000', orgn_netprps_qty: '0000000200',
    for_netslmt_stk_cd: '035720', for_netslmt_stk_nm: '카카오', for_netslmt_amt: '0000005000', for_netslmt_qty: '0000000050',
    orgn_netslmt_stk_cd: '035420', orgn_netslmt_stk_nm: 'NAVER', orgn_netslmt_amt: '0000006000', orgn_netslmt_qty: '0000000060',
  },
  {
    for_netprps_stk_cd: '011070', for_netprps_stk_nm: 'LG이노텍', for_netprps_amt: '0000007000', for_netprps_qty: '0000000066',
    orgn_netprps_stk_cd: '009150', orgn_netprps_stk_nm: '삼성전기', orgn_netprps_amt: '0000011000', orgn_netprps_qty: '0000000050',
    for_netslmt_stk_cd: '', for_netslmt_stk_nm: '', for_netslmt_amt: '', for_netslmt_qty: '',
    orgn_netslmt_stk_cd: '', orgn_netslmt_stk_nm: '', orgn_netslmt_amt: '', orgn_netslmt_qty: '',
  },
  // empty trailing row (fewer real entries than requested N) — must be filtered out
  {
    for_netprps_stk_cd: '', for_netprps_stk_nm: '', for_netprps_amt: '', for_netprps_qty: '',
    orgn_netprps_stk_cd: '', orgn_netprps_stk_nm: '', orgn_netprps_amt: '', orgn_netprps_qty: '',
  },
];

describe('extractNetTrade (ka90009 column groups)', () => {
  it('maps foreign net-buy columns with 1-based rank', () => {
    const out = extractNetTrade(rows, NETTRADE_FIELDS.foreign.buy, 10);
    expect(out).toHaveLength(2); // empty-code row dropped
    expect(out[0]).toMatchObject({ rank: 1, code: '005930', name: '삼성전자' });
    expect(out[1]).toMatchObject({ rank: 2, code: '011070', name: 'LG이노텍' });
    expect(out[0]['금액']).toBe(won(unpad('0000010000')));
    expect(out[0]['수량']).toBe(won(unpad('0000000100')));
  });

  it('maps institution net-buy columns independently of foreign', () => {
    const out = extractNetTrade(rows, NETTRADE_FIELDS.institution.buy, 10);
    expect(out[0]).toMatchObject({ rank: 1, code: '000660', name: 'SK하이닉스' });
    expect(out[1]).toMatchObject({ rank: 2, code: '009150', name: '삼성전기' });
  });

  it('maps the net-sell side from the *_netslmt_* columns', () => {
    const sells = extractNetTrade(rows, NETTRADE_FIELDS.foreign.sell, 10);
    expect(sells).toHaveLength(1); // only the first row has a sell entry
    expect(sells[0]).toMatchObject({ rank: 1, code: '035720', name: '카카오' });
  });

  it('respects the top-N slice before filtering', () => {
    expect(extractNetTrade(rows, NETTRADE_FIELDS.foreign.buy, 1)).toHaveLength(1);
  });
});

describe('buildNetTradeResult', () => {
  it('returns a list per requested investor', () => {
    const res = buildNetTradeResult(rows, ['foreign', 'institution'], 'buy', 10);
    expect(Object.keys(res).sort()).toEqual(['foreign', 'institution']);
    expect(res.foreign[0]).toMatchObject({ code: '005930' });
    expect(res.institution[0]).toMatchObject({ code: '000660' });
  });

  it('returns only the requested investor when narrowed', () => {
    const res = buildNetTradeResult(rows, ['institution'], 'buy', 10);
    expect(Object.keys(res)).toEqual(['institution']);
  });
});

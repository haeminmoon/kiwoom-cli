import { ENDPOINTS, PATHS, EndpointDef } from '../../client/endpoints';

describe('ENDPOINTS registry', () => {
  const entries = Object.entries(ENDPOINTS) as [string, EndpointDef][];

  it('has a unique api-id per endpoint', () => {
    const ids = entries.map(([, e]) => e.apiId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('routes every endpoint to a known category path', () => {
    const known = new Set(Object.values(PATHS));
    for (const [name, e] of entries) {
      expect(known.has(e.path as never)).toBe(true);
    }
  });

  it('keeps the doubled weekly-chart list key verbatim', () => {
    expect(ENDPOINTS.weeklyChart.listKey).toBe('stk_stk_pole_chart_qry');
  });

  it('flags exactly the order TRs as writes', () => {
    const writes = entries.filter(([, e]) => e.isWrite).map(([n]) => n).sort();
    expect(writes).toEqual(
      ['buy', 'cancel', 'creditBuy', 'creditCancel', 'creditModify', 'creditSell', 'modify', 'sell'].sort(),
    );
  });

  it('routes order writes to the order/credit-order paths', () => {
    expect(ENDPOINTS.buy.path).toBe(PATHS.ordr);
    expect(ENDPOINTS.creditBuy.path).toBe(PATHS.crdordr);
  });

  it('declares a listKey for paginated list TRs', () => {
    expect(ENDPOINTS.dailyChart.listKey).toBe('stk_dt_pole_chart_qry');
    expect(ENDPOINTS.balance.listKey).toBe('acnt_evlt_remn_indv_tot');
  });
});

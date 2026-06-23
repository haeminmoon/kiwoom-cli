import { unpad, won } from './format';

export type Investor = 'foreign' | 'institution';
export type NetSide = 'buy' | 'sell';

/**
 * ka90009 (외국인기관매매상위) returns ONE list (`frgnr_orgn_trde_upper`) where each
 * row holds four parallel rankings side-by-side. These are the column-name prefixes
 * for each (investor, side) pair; the full fields are `<prefix>_stk_cd/_stk_nm/_amt/_qty`.
 */
export const NETTRADE_FIELDS: Record<Investor, Record<NetSide, string>> = {
  foreign: { buy: 'for_netprps', sell: 'for_netslmt' },
  institution: { buy: 'orgn_netprps', sell: 'orgn_netslmt' },
};

/** Pull the top-N rows for one (investor, side) column group out of the ka90009 list. */
export function extractNetTrade(
  rows: Record<string, string>[],
  prefix: string,
  n: number,
): Record<string, unknown>[] {
  return rows
    .slice(0, n)
    .map((r, i) => ({
      rank: i + 1,
      code: r[`${prefix}_stk_cd`],
      name: r[`${prefix}_stk_nm`],
      금액: won(unpad(r[`${prefix}_amt`] ?? '')),
      수량: won(unpad(r[`${prefix}_qty`] ?? '')),
    }))
    .filter((x) => x.code);
}

/** Build the per-investor net-trade ranking object from a raw ka90009 list. */
export function buildNetTradeResult(
  rows: Record<string, string>[],
  investors: Investor[],
  side: NetSide,
  n: number,
): Record<string, Record<string, unknown>[]> {
  const result: Record<string, Record<string, unknown>[]> = {};
  for (const inv of investors) result[inv] = extractNetTrade(rows, NETTRADE_FIELDS[inv][side], n);
  return result;
}

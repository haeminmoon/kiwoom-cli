import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { clientOrThrow, mcpJson, withErrorHandling, tool } from '../helpers';
import { ENDPOINTS, EndpointDef } from '../../client/endpoints';
import { buildNetTradeResult, type Investor } from '../../utils/ranking';

export function registerRankingTools(server: McpServer): void {
  tool(
    server,
    'get_ranking',
    {
      description:
        'Get a market ranking list: gainers/losers (fluctuation), today volume, trade value (amount), volume surge, or previous-day volume.',
      inputSchema: {
        kind: z
          .enum(['fluctuation', 'volume', 'amount', 'surge', 'prev-volume'])
          .describe('Ranking type'),
        market: z.enum(['000', '001', '101']).optional().describe('000=all, 001=KOSPI, 101=KOSDAQ'),
        sort: z.string().optional().describe('Sort code (meaning varies per kind; default 1)'),
        exchange: z.enum(['1', '2', '3']).optional().describe('1=KRX, 2=NXT, 3=unified (default 3)'),
      },
    },
    async ({ kind, market, sort, exchange }) =>
      withErrorHandling(async () => {
        const mrkt_tp = market ?? '000';
        const stex_tp = exchange ?? '3';
        let def: EndpointDef;
        let body: Record<string, unknown>;
        switch (kind) {
          case 'fluctuation':
            def = ENDPOINTS.rankFluctuation;
            body = {
              mrkt_tp,
              sort_tp: sort ?? '1',
              trde_qty_cnd: '0000',
              stk_cnd: '0',
              crd_cnd: '0',
              updown_incls: '1',
              pric_cnd: '0',
              trde_prica_cnd: '0',
              stex_tp,
            };
            break;
          case 'volume':
            def = ENDPOINTS.rankVolume;
            body = {
              mrkt_tp,
              sort_tp: sort ?? '1',
              mang_stk_incls: '0',
              crd_tp: '0',
              trde_qty_tp: '0',
              pric_tp: '0',
              trde_prica_tp: '0',
              mrkt_open_tp: '0',
              stex_tp,
            };
            break;
          case 'amount':
            def = ENDPOINTS.rankTradeAmount;
            body = { mrkt_tp, mang_stk_incls: '1', stex_tp };
            break;
          case 'surge':
            def = ENDPOINTS.rankVolumeSurge;
            body = {
              mrkt_tp,
              sort_tp: sort ?? '1',
              tm_tp: '2',
              trde_qty_tp: '5',
              tm: '',
              stk_cnd: '0',
              pric_tp: '0',
              stex_tp,
            };
            break;
          default: // prev-volume
            def = ENDPOINTS.rankPrevVolume;
            body = { mrkt_tp, qry_tp: '1', rank_strt: '0', rank_end: '100', stex_tp };
        }
        const { data } = await clientOrThrow().callEndpoint(def, body);
        return mcpJson(data);
      }),
  );

  tool(
    server,
    'get_net_buy_ranking',
    {
      description:
        'Get the foreign/institution net-buy (수급) ranking (ka90009): top stocks by foreign and/or institutional net buying or selling. One call returns parallel rankings for both investor types.',
      inputSchema: {
        by: z
          .enum(['foreign', 'institution', 'both'])
          .optional()
          .describe('Investor type: foreign=외국인, institution=기관, both (default both)'),
        side: z.enum(['buy', 'sell']).optional().describe('buy=순매수 (default), sell=순매도'),
        market: z.enum(['000', '001', '101']).optional().describe('000=all, 001=KOSPI, 101=KOSDAQ'),
        exchange: z.enum(['1', '2', '3']).optional().describe('1=KRX (default), 2=NXT, 3=unified'),
        count: z.number().int().min(1).max(50).optional().describe('Top N (default 10)'),
        rankBy: z.enum(['1', '2']).optional().describe('Rank by 1=amount 금액 (default), 2=quantity 수량'),
        date: z.string().optional().describe('Query date YYYYMMDD (default: latest)'),
      },
    },
    async ({ by, side, market, exchange, count, rankBy, date }) =>
      withErrorHandling(async () => {
        const investors: Investor[] = by === 'foreign' ? ['foreign'] : by === 'institution' ? ['institution'] : ['foreign', 'institution'];
        const netSide = side === 'sell' ? 'sell' : 'buy';
        const { data } = await clientOrThrow().callEndpoint(ENDPOINTS.rankForeignInst, {
          mrkt_tp: market ?? '000',
          amt_qty_tp: rankBy === '2' ? '2' : '1',
          qry_dt_tp: date ? '1' : '0',
          date: date ?? '',
          stex_tp: exchange ?? '1',
        });
        const rows: Record<string, string>[] = Array.isArray(data?.[ENDPOINTS.rankForeignInst.listKey!])
          ? (data[ENDPOINTS.rankForeignInst.listKey!] as Record<string, string>[])
          : [];
        return mcpJson({
          side: netSide,
          rankBy: rankBy === '2' ? 'quantity' : 'amount',
          ...buildNetTradeResult(rows, investors, netSide, count ?? 10),
        });
      }),
  );

  tool(
    server,
    'get_sector',
    {
      description:
        'Get sector/industry data: index price, constituent stock prices, all sector indices, or daily index history.',
      inputSchema: {
        kind: z.enum(['price', 'stocks', 'all', 'daily']).describe('Sector query type'),
        market: z.enum(['0', '1', '2']).optional().describe('0=KOSPI, 1=KOSDAQ, 2=KOSPI200'),
        code: z.string().optional().describe('Industry code inds_cd (default 001=종합KOSPI)'),
      },
    },
    async ({ kind, market, code }) =>
      withErrorHandling(async () => {
        const mrkt_tp = market ?? '0';
        const inds_cd = code ?? '001';
        let def: EndpointDef;
        let body: Record<string, unknown>;
        switch (kind) {
          case 'stocks':
            def = ENDPOINTS.sectorStocks;
            body = { mrkt_tp, inds_cd, stex_tp: '1' };
            break;
          case 'all':
            def = ENDPOINTS.sectorAllIndex;
            body = { inds_cd };
            break;
          case 'daily':
            def = ENDPOINTS.sectorDaily;
            body = { mrkt_tp, inds_cd };
            break;
          default: // price
            def = ENDPOINTS.sectorPrice;
            body = { mrkt_tp, inds_cd };
        }
        const { data } = await clientOrThrow().callEndpoint(def, body);
        return mcpJson(data);
      }),
  );
}

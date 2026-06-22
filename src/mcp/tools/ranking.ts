import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { clientOrThrow, mcpJson, withErrorHandling, tool } from '../helpers';
import { ENDPOINTS, EndpointDef } from '../../client/endpoints';

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

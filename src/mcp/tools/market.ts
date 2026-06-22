import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { clientOrThrow, mcpJson, withErrorHandling, tool } from '../helpers';
import { ENDPOINTS } from '../../client/endpoints';
import { normalizeStockCode, todayKst } from '../../utils/helpers';
import { parseOrderbook } from '../../utils/orderbook';

export function registerMarketTools(server: McpServer): void {
  tool(
    server,
    'get_stock_info',
    {
      description:
        'Get Kiwoom stock fundamentals + current price for a Korean stock (name, price, change, PER/EPS/ROE/PBR/BPS, OHLC, limits). ka10001.',
      inputSchema: { code: z.string().describe('6-digit stock code, e.g. 005930 (삼성전자)') },
    },
    async ({ code }) =>
      withErrorHandling(async () => {
        const client = clientOrThrow();
        const { data } = await client.callEndpoint(ENDPOINTS.stockInfo, {
          stk_cd: normalizeStockCode(code),
        });
        return mcpJson(data);
      }),
  );

  tool(
    server,
    'get_price',
    {
      description: 'Get a rich current-price snapshot incl. top-of-book for a stock. ka10007.',
      inputSchema: { code: z.string().describe('6-digit stock code') },
    },
    async ({ code }) =>
      withErrorHandling(async () => {
        const client = clientOrThrow();
        const { data } = await client.callEndpoint(ENDPOINTS.priceTableInfo, {
          stk_cd: normalizeStockCode(code),
        });
        return mcpJson(data);
      }),
  );

  tool(
    server,
    'get_orderbook',
    {
      description: 'Get the 10-level bid/ask order book for a stock, parsed into ordered levels. ka10004.',
      inputSchema: { code: z.string().describe('6-digit stock code') },
    },
    async ({ code }) =>
      withErrorHandling(async () => {
        const client = clientOrThrow();
        const stk = normalizeStockCode(code);
        const { data } = await client.callEndpoint(ENDPOINTS.orderbook, { stk_cd: stk });
        return mcpJson({ code: stk, ...parseOrderbook(data) });
      }),
  );

  tool(
    server,
    'get_daily_price',
    {
      description: 'Get daily price history ending at a base date. ka10086.',
      inputSchema: {
        code: z.string().describe('6-digit stock code'),
        date: z.string().optional().describe('Base date YYYYMMDD (default today)'),
      },
    },
    async ({ code, date }) =>
      withErrorHandling(async () => {
        const client = clientOrThrow();
        const { data } = await client.callEndpoint(ENDPOINTS.dailyPrice, {
          stk_cd: normalizeStockCode(code),
          qry_dt: date ?? todayKst(),
          indc_tp: '0',
        });
        return mcpJson(data);
      }),
  );

  tool(
    server,
    'get_recent_trades',
    {
      description: 'Get recent tick-by-tick executions for a stock. ka10003.',
      inputSchema: { code: z.string().describe('6-digit stock code') },
    },
    async ({ code }) =>
      withErrorHandling(async () => {
        const client = clientOrThrow();
        const { data } = await client.callEndpoint(ENDPOINTS.stockTrades, {
          stk_cd: normalizeStockCode(code),
        });
        return mcpJson(data);
      }),
  );

  tool(
    server,
    'search_stocks',
    {
      description:
        'Search the master stock list by name keyword or code prefix. Returns matching code/name/market. ka10099.',
      inputSchema: {
        keyword: z.string().describe('Name substring or code prefix to match'),
        market: z.enum(['0', '10']).optional().describe('0=KOSPI (default), 10=KOSDAQ'),
        limit: z.number().min(1).max(200).optional().describe('Max rows (default 30)'),
      },
    },
    async ({ keyword, market, limit }) =>
      withErrorHandling(async () => {
        const client = clientOrThrow();
        const { data } = await client.callEndpoint(
          ENDPOINTS.stockList,
          { mrkt_tp: market ?? '0' },
          { paginate: true },
        );
        const rows: Array<Record<string, any>> = Array.isArray(data.list) ? data.list : [];
        const kw = keyword.toLowerCase();
        const matches = rows
          .filter(
            (r) =>
              String(r.name ?? '').toLowerCase().includes(kw) ||
              String(r.code ?? '').startsWith(keyword),
          )
          .slice(0, limit ?? 30)
          .map((r) => ({ code: r.code, name: r.name, market: r.marketName, sector: r.upName }));
        return mcpJson(matches);
      }),
  );
}

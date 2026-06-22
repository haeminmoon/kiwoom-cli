import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { clientOrThrow, mcpJson, withErrorHandling, tool } from '../helpers';
import { ENDPOINTS } from '../../client/endpoints';
import { normalizeStockCode, todayKst } from '../../utils/helpers';

export function registerAccountTools(server: McpServer): void {
  tool(
    server,
    'get_balance',
    {
      description:
        'Get account evaluation balance: totals (purchase/eval/PnL/profit-rate) and per-holding detail. kt00018.',
      inputSchema: {
        exchange: z.enum(['KRX', 'NXT', '%']).optional().describe('Exchange filter (default KRX)'),
      },
    },
    async ({ exchange }) =>
      withErrorHandling(async () => {
        const client = clientOrThrow();
        const { data } = await client.callEndpoint(ENDPOINTS.balance, {
          qry_tp: '1',
          dmst_stex_tp: exchange ?? 'KRX',
        });
        return mcpJson(data);
      }),
  );

  tool(
    server,
    'get_deposit',
    {
      description: 'Get cash deposit detail: cash, orderable/withdrawable, D+2 settlement. kt00001.',
    },
    async () =>
      withErrorHandling(async () => {
        const client = clientOrThrow();
        const { data } = await client.callEndpoint(ENDPOINTS.deposit, { qry_tp: '3' });
        return mcpJson(data);
      }),
  );

  tool(
    server,
    'get_open_orders',
    {
      description: 'Get open / unfilled orders (optionally for one stock). ka10075.',
      inputSchema: { code: z.string().optional().describe('6-digit stock code to filter') },
    },
    async ({ code }) =>
      withErrorHandling(async () => {
        const client = clientOrThrow();
        const body = code
          ? { all_stk_tp: '0', trde_tp: '0', stk_cd: normalizeStockCode(code), stex_tp: '0' }
          : { all_stk_tp: '1', trde_tp: '0', stk_cd: '', stex_tp: '0' };
        const { data } = await client.callEndpoint(ENDPOINTS.openOrders, body);
        return mcpJson(data);
      }),
  );

  tool(
    server,
    'get_executions',
    {
      description: 'Get filled executions (optionally for one stock). ka10076.',
      inputSchema: { code: z.string().optional().describe('6-digit stock code to filter') },
    },
    async ({ code }) =>
      withErrorHandling(async () => {
        const client = clientOrThrow();
        const { data } = await client.callEndpoint(ENDPOINTS.executions, {
          stk_cd: code ? normalizeStockCode(code) : '',
          qry_tp: code ? '1' : '0',
          sell_tp: '0',
          ord_no: '',
          stex_tp: '0',
        });
        return mcpJson(data);
      }),
  );

  tool(
    server,
    'get_realized_pnl',
    {
      description: 'Get realized profit/loss for a stock over a date (or period, max 3 months). ka10072 / ka10073.',
      inputSchema: {
        code: z.string().describe('6-digit stock code'),
        start: z.string().optional().describe('Start date YYYYMMDD (default today)'),
        end: z.string().optional().describe('End date YYYYMMDD; if set, queries the period'),
      },
    },
    async ({ code, start, end }) =>
      withErrorHandling(async () => {
        const client = clientOrThrow();
        const stk = normalizeStockCode(code);
        const { data } = end
          ? await client.callEndpoint(ENDPOINTS.realizedPlByPeriod, {
              stk_cd: stk,
              strt_dt: start ?? end,
              end_dt: end,
            })
          : await client.callEndpoint(ENDPOINTS.realizedPlByDate, {
              stk_cd: stk,
              strt_dt: start ?? todayKst(),
            });
        return mcpJson(data);
      }),
  );
}

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { clientOrThrow, mcpJson, withErrorHandling, tool } from '../helpers';
import { ENDPOINTS, EndpointDef } from '../../client/endpoints';
import { normalizeStockCode, todayKst } from '../../utils/helpers';

const PERIOD_EP: Record<string, EndpointDef> = {
  day: ENDPOINTS.dailyChart,
  week: ENDPOINTS.weeklyChart,
  month: ENDPOINTS.monthlyChart,
  year: ENDPOINTS.yearlyChart,
};

export function registerChartTools(server: McpServer): void {
  tool(
    server,
    'get_chart',
    {
      description:
        'Get OHLC chart data for a stock. Period charts (day/week/month/year) end at base date; tick/minute use an aggregation scope. Returns latest-first; use count to cap rows.',
      inputSchema: {
        code: z.string().describe('6-digit stock code'),
        timeframe: z
          .enum(['tick', 'minute', 'day', 'week', 'month', 'year'])
          .describe('Chart timeframe'),
        scope: z
          .string()
          .optional()
          .describe('Tick units (1/3/5/10/30) or minute interval (1/3/5/10/15/30/45/60); default 1'),
        date: z.string().optional().describe('Base date YYYYMMDD for period charts (default today)'),
        adjusted: z.boolean().optional().describe('Adjust for splits/rights (default true)'),
        count: z.number().min(1).max(900).optional().describe('Max rows to return (default 50)'),
      },
    },
    async ({ code, timeframe, scope, date, adjusted, count }) =>
      withErrorHandling(async () => {
        const client = clientOrThrow();
        const stk = normalizeStockCode(code);
        const upd = adjusted === false ? '0' : '1';

        let def: EndpointDef;
        let body: Record<string, unknown>;
        if (timeframe === 'tick') {
          def = ENDPOINTS.tickChart;
          body = { stk_cd: stk, tic_scope: scope ?? '1', upd_stkpc_tp: upd };
        } else if (timeframe === 'minute') {
          def = ENDPOINTS.minuteChart;
          body = { stk_cd: stk, tic_scope: scope ?? '1', upd_stkpc_tp: upd };
        } else {
          def = PERIOD_EP[timeframe];
          body = { stk_cd: stk, base_dt: date ?? todayKst(), upd_stkpc_tp: upd };
        }

        const { data } = await client.callEndpoint(def, body);
        const rows: unknown[] = Array.isArray(data[def.listKey!]) ? data[def.listKey!] : [];
        return mcpJson({
          code: stk,
          timeframe,
          rows: rows.slice(0, count ?? 50),
        });
      }),
  );
}

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { clientOrThrow, mcpJson, withErrorHandling, tool } from '../helpers';
import { ENDPOINTS, EndpointDef } from '../../client/endpoints';
import { normalizeStockCode, todayKst } from '../../utils/helpers';
import { CHART_PER_PAGE_CAP, ChartType } from '../../config/constants';

const PERIOD_EP: Record<string, EndpointDef> = {
  day: ENDPOINTS.dailyChart,
  week: ENDPOINTS.weeklyChart,
  month: ENDPOINTS.monthlyChart,
  year: ENDPOINTS.yearlyChart,
};

const DEFAULT_COUNT = 50;
const MAX_COUNT = 100000;

export function registerChartTools(server: McpServer): void {
  tool(
    server,
    'get_chart',
    {
      description:
        'Get OHLC chart data for a stock. Period charts (day/week/month/year) end at base date; tick/minute use an aggregation scope. Returns latest-first; use count to cap rows. ' +
        'Per-request caps: tick/minute 900, day 600, week 300, month 240, year 30. When count exceeds the cap the tool auto-paginates (cont-yn/next-key) and returns up to count rows.',
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
        count: z
          .number()
          .min(1)
          .max(MAX_COUNT)
          .optional()
          .describe(
            'Max rows to return (default 50). Exceeding the per-request cap (tick/min 900, day 600, week 300, month 240, year 30) auto-paginates.',
          ),
      },
    },
    async ({ code, timeframe, scope, date, adjusted, count }) =>
      withErrorHandling(async () => {
        const client = clientOrThrow();
        const stk = normalizeStockCode(code);
        const upd = adjusted === false ? '0' : '1';
        const want = count ?? DEFAULT_COUNT;

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

        const cap = CHART_PER_PAGE_CAP[timeframe as ChartType];
        const paginate = want > cap;
        const maxPages = paginate ? Math.max(1, Math.ceil(want / cap)) : 1;

        const { data } = await client.callEndpoint(def, body, { paginate, maxPages });
        const rows: unknown[] = Array.isArray(data[def.listKey!]) ? data[def.listKey!] : [];
        return mcpJson({
          code: stk,
          timeframe,
          rows: rows.slice(0, want),
        });
      }),
  );
}

import { Command } from 'commander';
import { createClient } from './_helpers';
import { ENDPOINTS, EndpointDef } from '../client/endpoints';
import { output, getOutputFormat, OutputFormat } from '../output/formatter';
import { handleError } from '../output/error';
import { normalizeStockCode, todayKst, parseIntStrict } from '../utils/helpers';
import { unpad, won, formatStamp, formatFields } from '../utils/format';
import { CHART_PER_PAGE_CAP, CHART_MAX_COUNT, ChartType } from '../config/constants';
import { ActionableError } from '../output/error';

/** Per-row formatters shared by every chart TR (fields overlap across types). */
const CHART_ROW_FORMATTERS: Record<string, (v: string) => string> = {
  cntr_tm: formatStamp,
  dt: formatStamp,
  open_pric: unpad,
  high_pric: unpad,
  low_pric: unpad,
  cur_prc: unpad,
  trde_qty: won,
  acc_trde_qty: won,
  trde_prica: won,
  pred_pre: unpad,
  trde_tern_rt: unpad,
};

/**
 * Per-request row cap for each chart TR (rows returned by a single API call).
 * Kiwoom returns at most this many candles per page; larger `--count` values are
 * served by paging on the `cont-yn` / `next-key` headers (see runIntraday/runPeriod).
 * Sourced from the shared constants registry.
 */
export const PER_PAGE_CAP = CHART_PER_PAGE_CAP;

/**
 * Parse + validate the `--count` flag locally so a bad value fails clearly here
 * instead of leaking a raw server 400. Must be a positive integer; clamps to
 * CHART_MAX_COUNT to bound auto-pagination.
 */
function parseCount(raw: string): number {
  const n = parseIntStrict(raw, 'count');
  if (n < 1) {
    throw new ActionableError(`--count must be a positive integer (got ${n}).`);
  }
  return Math.min(n, CHART_MAX_COUNT);
}

/**
 * Render a chart payload: raw JSON, or a formatted table of the first `count`
 * candles under the endpoint's listKey. The list is always sliced to `count` so
 * the output never exceeds the requested number, whether one page or many pages
 * (auto-pagination) were fetched.
 */
function emitChart(data: Record<string, any>, ep: EndpointDef, fmt: OutputFormat, count: number): void {
  const all: Record<string, unknown>[] = Array.isArray(data[ep.listKey!]) ? data[ep.listKey!] : [];
  const sliced = all.slice(0, count);
  if (fmt === 'json') {
    output({ ...data, [ep.listKey!]: sliced }, 'json');
    return;
  }
  if (sliced.length === 0) {
    console.log('No data');
    return;
  }
  output(
    sliced.map((row) => formatFields(row, CHART_ROW_FORMATTERS)),
    'table',
  );
}

export function registerChartCommands(program: Command): void {
  const chart = program
    .command('chart')
    .description(
      'OHLC charts — tick / minute / daily / weekly / monthly / yearly. ' +
        'Per-request caps: tick/min 900, day 600, week 300, month 240, year 30. ' +
        '--count beyond the cap auto-paginates via cont-yn/next-key.',
    );

  /**
   * Decide whether to auto-paginate: explicitly requested via `--paginate`, or
   * implied because `--count` exceeds the per-page cap for this chart type.
   * Returns the max pages needed so we never over-fetch.
   */
  function planFetch(type: ChartType, count: number, paginate: boolean): { paginate: boolean; maxPages: number } {
    const cap = PER_PAGE_CAP[type];
    const active = paginate || count > cap;
    // Pages needed to reach `count` rows, capped only by data availability.
    const maxPages = active ? Math.max(1, Math.ceil(count / cap)) : 1;
    return { paginate: active, maxPages };
  }

  /** Intraday family (tick, min): body keyed on tic_scope. */
  async function runIntraday(
    ep: EndpointDef,
    type: ChartType,
    code: string,
    ticScope: string,
    options: any,
  ): Promise<void> {
    const client = createClient();
    const stk = normalizeStockCode(code);
    const count = parseCount(options.count);
    const plan = planFetch(type, count, !!options.paginate);
    const { data } = await client.callEndpoint(
      ep,
      { stk_cd: stk, tic_scope: ticScope, upd_stkpc_tp: options.raw ? '0' : '1' },
      { paginate: plan.paginate, maxPages: plan.maxPages },
    );
    emitChart(data, ep, getOutputFormat(options), count);
  }

  /** Period family (day, week, month, year): body keyed on base_dt. */
  async function runPeriod(
    ep: EndpointDef,
    type: ChartType,
    code: string,
    baseDt: string,
    options: any,
  ): Promise<void> {
    const client = createClient();
    const stk = normalizeStockCode(code);
    const count = parseCount(options.count);
    const plan = planFetch(type, count, !!options.paginate);
    const { data } = await client.callEndpoint(
      ep,
      { stk_cd: stk, base_dt: baseDt, upd_stkpc_tp: options.raw ? '0' : '1' },
      { paginate: plan.paginate, maxPages: plan.maxPages },
    );
    emitChart(data, ep, getOutputFormat(options), count);
  }

  // chart tick <code>
  chart
    .command('tick <code>')
    .description(`Tick chart (ka10079) — up to ${PER_PAGE_CAP.tick} candles/request, auto-paginates beyond that`)
    .option('-s, --scope <n>', 'Ticks per candle (1/3/5/10/30)', '1')
    .option('-n, --count <n>', 'Number of candles (auto-paginates when > 900)', '50')
    .option('-p, --paginate', 'Force fetching multiple pages (cont-yn/next-key)')
    .option('--raw', 'Unadjusted (수정주가 미반영) prices')
    .option('-o, --output <format>', 'Output format (table/json)', 'table')
    .action(async (code: string, options) => {
      try {
        await runIntraday(ENDPOINTS.tickChart, 'tick', code, options.scope, options);
      } catch (err) {
        handleError(err);
      }
    });

  // chart min <code>
  chart
    .command('min <code>')
    .alias('minute')
    .description(`Minute chart (ka10080) — up to ${PER_PAGE_CAP.minute} candles/request, auto-paginates beyond that`)
    .option('-i, --interval <n>', 'Minutes per candle (1/3/5/10/15/30/45/60)', '1')
    .option('-n, --count <n>', 'Number of candles (auto-paginates when > 900)', '50')
    .option('-p, --paginate', 'Force fetching multiple pages (cont-yn/next-key)')
    .option('--raw', 'Unadjusted (수정주가 미반영) prices')
    .option('-o, --output <format>', 'Output format (table/json)', 'table')
    .action(async (code: string, options) => {
      try {
        await runIntraday(ENDPOINTS.minuteChart, 'minute', code, options.interval, options);
      } catch (err) {
        handleError(err);
      }
    });

  // chart day <code>
  chart
    .command('day <code>')
    .alias('daily')
    .description(`Daily chart (ka10081) — up to ${PER_PAGE_CAP.day} candles/request, auto-paginates beyond that`)
    .option('-d, --date <yyyymmdd>', 'Base date (most recent candle)', todayKst())
    .option('-n, --count <n>', 'Number of candles (auto-paginates when > 600)', '50')
    .option('-p, --paginate', 'Force fetching multiple pages (cont-yn/next-key)')
    .option('--raw', 'Unadjusted (수정주가 미반영) prices')
    .option('-o, --output <format>', 'Output format (table/json)', 'table')
    .action(async (code: string, options) => {
      try {
        await runPeriod(ENDPOINTS.dailyChart, 'day', code, options.date, options);
      } catch (err) {
        handleError(err);
      }
    });

  // chart week <code>
  chart
    .command('week <code>')
    .description(`Weekly chart (ka10082) — up to ${PER_PAGE_CAP.week} candles/request, auto-paginates beyond that`)
    .option('-d, --date <yyyymmdd>', 'Base date (most recent candle)', todayKst())
    .option('-n, --count <n>', 'Number of candles (auto-paginates when > 300)', '50')
    .option('-p, --paginate', 'Force fetching multiple pages (cont-yn/next-key)')
    .option('--raw', 'Unadjusted (수정주가 미반영) prices')
    .option('-o, --output <format>', 'Output format (table/json)', 'table')
    .action(async (code: string, options) => {
      try {
        await runPeriod(ENDPOINTS.weeklyChart, 'week', code, options.date, options);
      } catch (err) {
        handleError(err);
      }
    });

  // chart month <code>
  chart
    .command('month <code>')
    .description(`Monthly chart (ka10083) — up to ${PER_PAGE_CAP.month} candles/request, auto-paginates beyond that`)
    .option('-d, --date <yyyymmdd>', 'Base date (most recent candle)', todayKst())
    .option('-n, --count <n>', 'Number of candles (auto-paginates when > 240)', '50')
    .option('-p, --paginate', 'Force fetching multiple pages (cont-yn/next-key)')
    .option('--raw', 'Unadjusted (수정주가 미반영) prices')
    .option('-o, --output <format>', 'Output format (table/json)', 'table')
    .action(async (code: string, options) => {
      try {
        await runPeriod(ENDPOINTS.monthlyChart, 'month', code, options.date, options);
      } catch (err) {
        handleError(err);
      }
    });

  // chart year <code>
  chart
    .command('year <code>')
    .description(`Yearly chart (ka10094) — up to ${PER_PAGE_CAP.year} candles/request, auto-paginates beyond that`)
    .option('-d, --date <yyyymmdd>', 'Base date (most recent candle)', todayKst())
    .option('-n, --count <n>', 'Number of candles (auto-paginates when > 30)', '50')
    .option('-p, --paginate', 'Force fetching multiple pages (cont-yn/next-key)')
    .option('--raw', 'Unadjusted (수정주가 미반영) prices')
    .option('-o, --output <format>', 'Output format (table/json)', 'table')
    .action(async (code: string, options) => {
      try {
        await runPeriod(ENDPOINTS.yearlyChart, 'year', code, options.date, options);
      } catch (err) {
        handleError(err);
      }
    });
}

import { Command } from 'commander';
import { createClient } from './_helpers';
import { ENDPOINTS, EndpointDef } from '../client/endpoints';
import { output, getOutputFormat, OutputFormat } from '../output/formatter';
import { handleError } from '../output/error';
import { normalizeStockCode, todayKst, parseIntStrict } from '../utils/helpers';
import { unpad, won, formatStamp, formatFields } from '../utils/format';

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
 * Render a chart payload: raw JSON, or a formatted table of the first `count`
 * candles under the endpoint's listKey. Charts return one page that already
 * holds plenty of rows, so we never paginate — `--count` just caps the display.
 */
function emitChart(data: Record<string, any>, ep: EndpointDef, fmt: OutputFormat, count: number): void {
  if (fmt === 'json') {
    output(data, 'json');
    return;
  }
  const all: Record<string, unknown>[] = Array.isArray(data[ep.listKey!]) ? data[ep.listKey!] : [];
  if (all.length === 0) {
    console.log('No data');
    return;
  }
  output(
    all.slice(0, count).map((row) => formatFields(row, CHART_ROW_FORMATTERS)),
    'table',
  );
}

export function registerChartCommands(program: Command): void {
  const chart = program
    .command('chart')
    .description('OHLC charts — tick / minute / daily / weekly / monthly / yearly');

  /** Intraday family (tick, min): body keyed on tic_scope. */
  async function runIntraday(ep: EndpointDef, code: string, ticScope: string, options: any): Promise<void> {
    const client = createClient();
    const stk = normalizeStockCode(code);
    const { data } = await client.callEndpoint(ep, {
      stk_cd: stk,
      tic_scope: ticScope,
      upd_stkpc_tp: options.raw ? '0' : '1',
    });
    emitChart(data, ep, getOutputFormat(options), parseIntStrict(options.count, 'count'));
  }

  /** Period family (day, week, month, year): body keyed on base_dt. */
  async function runPeriod(ep: EndpointDef, code: string, baseDt: string, options: any): Promise<void> {
    const client = createClient();
    const stk = normalizeStockCode(code);
    const { data } = await client.callEndpoint(ep, {
      stk_cd: stk,
      base_dt: baseDt,
      upd_stkpc_tp: options.raw ? '0' : '1',
    });
    emitChart(data, ep, getOutputFormat(options), parseIntStrict(options.count, 'count'));
  }

  // chart tick <code>
  chart
    .command('tick <code>')
    .description('Tick chart (ka10079)')
    .option('-s, --scope <n>', 'Ticks per candle (1/3/5/10/30)', '1')
    .option('-n, --count <n>', 'Number of candles to display', '50')
    .option('--raw', 'Unadjusted (수정주가 미반영) prices')
    .option('-o, --output <format>', 'Output format (table/json)', 'table')
    .action(async (code: string, options) => {
      try {
        await runIntraday(ENDPOINTS.tickChart, code, options.scope, options);
      } catch (err) {
        handleError(err);
      }
    });

  // chart min <code>
  chart
    .command('min <code>')
    .alias('minute')
    .description('Minute chart (ka10080)')
    .option('-i, --interval <n>', 'Minutes per candle (1/3/5/10/15/30/45/60)', '1')
    .option('-n, --count <n>', 'Number of candles to display', '50')
    .option('--raw', 'Unadjusted (수정주가 미반영) prices')
    .option('-o, --output <format>', 'Output format (table/json)', 'table')
    .action(async (code: string, options) => {
      try {
        await runIntraday(ENDPOINTS.minuteChart, code, options.interval, options);
      } catch (err) {
        handleError(err);
      }
    });

  // chart day <code>
  chart
    .command('day <code>')
    .alias('daily')
    .description('Daily chart (ka10081)')
    .option('-d, --date <yyyymmdd>', 'Base date (most recent candle)', todayKst())
    .option('-n, --count <n>', 'Number of candles to display', '50')
    .option('--raw', 'Unadjusted (수정주가 미반영) prices')
    .option('-o, --output <format>', 'Output format (table/json)', 'table')
    .action(async (code: string, options) => {
      try {
        await runPeriod(ENDPOINTS.dailyChart, code, options.date, options);
      } catch (err) {
        handleError(err);
      }
    });

  // chart week <code>
  chart
    .command('week <code>')
    .description('Weekly chart (ka10082)')
    .option('-d, --date <yyyymmdd>', 'Base date (most recent candle)', todayKst())
    .option('-n, --count <n>', 'Number of candles to display', '50')
    .option('--raw', 'Unadjusted (수정주가 미반영) prices')
    .option('-o, --output <format>', 'Output format (table/json)', 'table')
    .action(async (code: string, options) => {
      try {
        await runPeriod(ENDPOINTS.weeklyChart, code, options.date, options);
      } catch (err) {
        handleError(err);
      }
    });

  // chart month <code>
  chart
    .command('month <code>')
    .description('Monthly chart (ka10083)')
    .option('-d, --date <yyyymmdd>', 'Base date (most recent candle)', todayKst())
    .option('-n, --count <n>', 'Number of candles to display', '50')
    .option('--raw', 'Unadjusted (수정주가 미반영) prices')
    .option('-o, --output <format>', 'Output format (table/json)', 'table')
    .action(async (code: string, options) => {
      try {
        await runPeriod(ENDPOINTS.monthlyChart, code, options.date, options);
      } catch (err) {
        handleError(err);
      }
    });

  // chart year <code>
  chart
    .command('year <code>')
    .description('Yearly chart (ka10094)')
    .option('-d, --date <yyyymmdd>', 'Base date (most recent candle)', todayKst())
    .option('-n, --count <n>', 'Number of candles to display', '50')
    .option('--raw', 'Unadjusted (수정주가 미반영) prices')
    .option('-o, --output <format>', 'Output format (table/json)', 'table')
    .action(async (code: string, options) => {
      try {
        await runPeriod(ENDPOINTS.yearlyChart, code, options.date, options);
      } catch (err) {
        handleError(err);
      }
    });
}

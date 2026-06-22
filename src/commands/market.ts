import { Command } from 'commander';
import { createClient } from './_helpers';
import { ENDPOINTS } from '../client/endpoints';
import { output, getOutputFormat, OutputFormat } from '../output/formatter';
import { handleError } from '../output/error';
import { normalizeStockCode, todayKst } from '../utils/helpers';
import { unpad, won, price, formatStamp, formatFields, toNumber } from '../utils/format';
import { parseOrderbook, renderOrderbook } from '../utils/orderbook';

export function registerMarketCommands(program: Command): void {
  const market = program.command('market').description('Market data — prices, quotes, order book, trades');

  // market price <code>
  market
    .command('price <code>')
    .description('Current price snapshot (ka10007)')
    .option('-o, --output <format>', 'Output format (table/json)', 'table')
    .action(async (code: string, options) => {
      try {
        const client = createClient();
        const stk = normalizeStockCode(code);
        const { data } = await client.callEndpoint(ENDPOINTS.priceTableInfo, { stk_cd: stk });
        const fmt = getOutputFormat(options);
        if (fmt === 'json') {
          output(data, 'json');
          return;
        }
        const chg =
          Math.abs(toNumber(data.cur_prc)) - Math.abs(toNumber(data.pred_close_pric));
        output(
          {
            name: data.stk_nm,
            code: data.stk_cd,
            price: price(data.cur_prc),
            change: Number.isNaN(chg) ? '' : `${chg > 0 ? '+' : ''}${chg}`,
            changeRate: `${unpad(data.flu_rt)}%`,
            open: price(data.open_pric),
            high: price(data.high_pric),
            low: price(data.low_pric),
            volume: won(data.trde_qty),
            bestAsk: price(data.sel_1bid),
            bestBid: price(data.buy_1bid),
            prevClose: price(data.pred_close_pric),
          },
          'table',
        );
      } catch (err) {
        handleError(err);
      }
    });

  // market orderbook <code>
  market
    .command('orderbook <code>')
    .alias('book')
    .description('10-level bid/ask order book (ka10004)')
    .option('-o, --output <format>', 'Output format (table/json)', 'table')
    .action(async (code: string, options) => {
      try {
        const client = createClient();
        const stk = normalizeStockCode(code);
        const { data } = await client.callEndpoint(ENDPOINTS.orderbook, { stk_cd: stk });
        if (getOutputFormat(options) === 'json') {
          output(data, 'json');
          return;
        }
        console.log(renderOrderbook(parseOrderbook(data), stk));
      } catch (err) {
        handleError(err);
      }
    });

  // market after-hours <code>
  market
    .command('after-hours <code>')
    .description('After-hours single-price quotes (ka10087)')
    .option('-o, --output <format>', 'Output format (table/json)', 'table')
    .action(async (code: string, options) => {
      try {
        const client = createClient();
        const stk = normalizeStockCode(code);
        const { data } = await client.callEndpoint(ENDPOINTS.afterHoursOrderbook, { stk_cd: stk });
        const fmt = getOutputFormat(options);
        if (fmt === 'json') {
          output(data, 'json');
          return;
        }
        output(
          {
            price: unpad(data.ovt_sigpric_cur_prc),
            change: unpad(data.ovt_sigpric_pred_pre),
            changeRate: `${unpad(data.ovt_sigpric_flu_rt)}%`,
            volume: won(data.ovt_sigpric_acc_trde_qty),
            askTotal: won(data.ovt_sigpric_sel_bid_tot_req),
            bidTotal: won(data.ovt_sigpric_buy_bid_tot_req),
            baseTime: formatStamp(data.bid_req_base_tm),
          },
          'table',
        );
      } catch (err) {
        handleError(err);
      }
    });

  // market daily <code>
  market
    .command('daily <code>')
    .description('Daily price history (ka10086)')
    .option('-d, --date <yyyymmdd>', 'Base date (most recent day)', todayKst())
    .option('-t, --type <0|1>', 'Display type: 0=quantity, 1=amount', '0')
    .option('-o, --output <format>', 'Output format (table/json)', 'table')
    .action(async (code: string, options) => {
      try {
        const client = createClient();
        const stk = normalizeStockCode(code);
        const { data } = await client.callEndpoint(ENDPOINTS.dailyPrice, {
          stk_cd: stk,
          qry_dt: options.date,
          indc_tp: options.type,
        });
        emitList(data, ENDPOINTS.dailyPrice.listKey!, getOutputFormat(options), (row) =>
          formatFields(row, {
            date: formatStamp,
            open_pric: unpad,
            high_pric: unpad,
            low_pric: unpad,
            close_pric: unpad,
            flu_rt: unpad,
            trde_qty: won,
          }),
        );
      } catch (err) {
        handleError(err);
      }
    });

  // market trades <code>
  market
    .command('trades <code>')
    .description('Recent tick-by-tick executions (ka10003)')
    .option('-o, --output <format>', 'Output format (table/json)', 'table')
    .action(async (code: string, options) => {
      try {
        const client = createClient();
        const stk = normalizeStockCode(code);
        const { data } = await client.callEndpoint(ENDPOINTS.stockTrades, { stk_cd: stk });
        emitList(data, ENDPOINTS.stockTrades.listKey!, getOutputFormat(options), (row) =>
          formatFields(row, {
            tm: formatStamp,
            cur_prc: unpad,
            pred_pre: unpad,
            pre_rt: unpad,
            cntr_trde_qty: unpad,
            acc_trde_qty: won,
          }),
        );
      } catch (err) {
        handleError(err);
      }
    });

  // market strength <code>
  market
    .command('strength <code>')
    .description('Trade strength (체결강도) time series (ka10046 / ka10047)')
    .option('--daily', 'Daily series instead of intraday')
    .option('-o, --output <format>', 'Output format (table/json)', 'table')
    .action(async (code: string, options) => {
      try {
        const client = createClient();
        const stk = normalizeStockCode(code);
        const ep = options.daily ? ENDPOINTS.strengthByDay : ENDPOINTS.strengthByTime;
        const { data } = await client.callEndpoint(ep, { stk_cd: stk });
        emitList(data, ep.listKey!, getOutputFormat(options), (row) =>
          formatFields(row, {
            cntr_tm: formatStamp,
            dt: formatStamp,
            cur_prc: unpad,
            flu_rt: unpad,
            cntr_str: unpad,
          }),
        );
      } catch (err) {
        handleError(err);
      }
    });

  // market inst-foreign <code>
  market
    .command('inst-foreign <code>')
    .description('Per-stock institution/foreigner trading trend (ka10045)')
    .option('-s, --start <yyyymmdd>', 'Start date')
    .option('-e, --end <yyyymmdd>', 'End date', todayKst())
    .option('-o, --output <format>', 'Output format (table/json)', 'table')
    .action(async (code: string, options) => {
      try {
        const client = createClient();
        const stk = normalizeStockCode(code);
        const { data } = await client.callEndpoint(ENDPOINTS.instForeignTrend, {
          stk_cd: stk,
          strt_dt: options.start ?? options.end,
          end_dt: options.end,
          orgn_prsm_unp_tp: '0',
          for_prsm_unp_tp: '0',
        });
        emitList(data, ENDPOINTS.instForeignTrend.listKey!, getOutputFormat(options), (row) =>
          formatFields(row, {
            dt: formatStamp,
            close_pric: unpad,
            flu_rt: unpad,
            orgn_daly_nettrde_qty: unpad,
            for_daly_nettrde_qty: unpad,
          }),
        );
      } catch (err) {
        handleError(err);
      }
    });
}

/** Shared helper: emit a list payload as JSON (raw) or a formatted table. */
export function emitList(
  data: Record<string, any>,
  listKey: string,
  fmt: OutputFormat,
  rowFormatter?: (row: Record<string, unknown>) => Record<string, unknown>,
): void {
  if (fmt === 'json') {
    output(data, 'json');
    return;
  }
  const rows: Record<string, unknown>[] = Array.isArray(data[listKey]) ? data[listKey] : [];
  if (rows.length === 0) {
    console.log('No data');
    return;
  }
  output(rowFormatter ? rows.map(rowFormatter) : rows, 'table');
}

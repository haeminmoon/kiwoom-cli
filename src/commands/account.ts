import { Command } from 'commander';
import { createClient } from './_helpers';
import { ENDPOINTS } from '../client/endpoints';
import { output, getOutputFormat } from '../output/formatter';
import { handleError } from '../output/error';
import { normalizeStockCode, todayKst } from '../utils/helpers';
import { unpad, won, formatStamp, formatFields } from '../utils/format';

/** Format a value as "<n>%" using unpad to strip padding/sign artifacts. */
const pct = (v: unknown) => `${unpad(v as string)}%`;
import { ACCOUNT_EXCHANGE_TYPES } from '../config/constants';
import { emitList } from './market';

export function registerAccountCommands(program: Command): void {
  const account = program
    .command('account')
    .alias('acct')
    .description('Account — balance, deposit, orders, executions, P/L');

  const exchangeHint = `Exchange filter (${ACCOUNT_EXCHANGE_TYPES.join('/')})`;

  // account balance
  account
    .command('balance')
    .description('Account evaluation balance with holdings (kt00018)')
    .option('-x, --exchange <KRX|NXT|%>', exchangeHint, 'KRX')
    .option('-o, --output <format>', 'Output format (table/json)', 'table')
    .action(async (options) => {
      try {
        const client = createClient();
        const { data } = await client.callEndpoint(ENDPOINTS.balance, {
          qry_tp: '1',
          dmst_stex_tp: options.exchange || 'KRX',
        });
        const fmt = getOutputFormat(options);
        if (fmt === 'json') {
          output(data, 'json');
          return;
        }
        output(
          {
            totalPurchase: won(data.tot_pur_amt),
            totalEval: won(data.tot_evlt_amt),
            evalPnl: won(data.tot_evlt_pl),
            profitRate: `${unpad(data.tot_prft_rt)}%`,
            estDepositAsset: won(data.prsm_dpst_aset_amt),
          },
          'table',
        );
        emitList(data, ENDPOINTS.balance.listKey!, 'table', (row: any) => ({
          code: row.stk_cd,
          name: row.stk_nm,
          qty: won(row.rmnd_qty),
          avgPrice: won(row.pur_pric),
          curPrice: won(row.cur_prc),
          evalAmt: won(row.evlt_amt),
          pnl: won(row.evltv_prft),
          pnlRate: pct(row.prft_rt),
          weight: pct(row.poss_rt),
        }));
      } catch (err) {
        handleError(err);
      }
    });

  // account deposit
  account
    .command('deposit')
    .description('Deposit detail — cash, orderable, withdrawable (kt00001)')
    .option('-o, --output <format>', 'Output format (table/json)', 'table')
    .action(async (options) => {
      try {
        const client = createClient();
        const { data } = await client.callEndpoint(ENDPOINTS.deposit, { qry_tp: '3' });
        const fmt = getOutputFormat(options);
        if (fmt === 'json') {
          output(data, 'json');
          return;
        }
        output(
          {
            cash: won(data.entr),
            orderable: won(data.ord_alow_amt),
            withdrawable: won(data.pymn_alow_amt),
            d2Deposit: won(data.d2_entra),
            substitute: won(data.repl_amt),
          },
          'table',
        );
      } catch (err) {
        handleError(err);
      }
    });

  // account eval
  account
    .command('eval')
    .description('Account evaluation status with holdings (kt00004)')
    .option('-x, --exchange <KRX|NXT|%>', exchangeHint, 'KRX')
    .option('-o, --output <format>', 'Output format (table/json)', 'table')
    .action(async (options) => {
      try {
        const client = createClient();
        const { data } = await client.callEndpoint(ENDPOINTS.evalStatus, {
          qry_tp: '0',
          dmst_stex_tp: options.exchange || 'KRX',
        });
        const fmt = getOutputFormat(options);
        if (fmt === 'json') {
          output(data, 'json');
          return;
        }
        output(
          {
            accountName: data.acnt_nm,
            branch: data.brch_nm,
            deposit: won(data.entr),
            totalEstimate: won(data.tot_est_amt),
            assetEval: won(data.aset_evlt_amt),
            totalPurchase: won(data.tot_pur_amt),
          },
          'table',
        );
        emitList(data, ENDPOINTS.evalStatus.listKey!, 'table', (row: any) => ({
          code: row.stk_cd,
          name: row.stk_nm,
          qty: won(row.rmnd_qty),
          avgPrice: won(row.avg_prc),
          curPrice: won(row.cur_prc),
          evalAmt: won(row.evlt_amt),
          pnl: won(row.pl_amt),
          pnlRate: pct(row.pl_rt),
        }));
      } catch (err) {
        handleError(err);
      }
    });

  // account settled
  account
    .command('settled')
    .description('Settled (executed) balance (kt00005)')
    .option('-x, --exchange <KRX|NXT|%>', exchangeHint, 'KRX')
    .option('-o, --output <format>', 'Output format (table/json)', 'table')
    .action(async (options) => {
      try {
        const client = createClient();
        const { data } = await client.callEndpoint(ENDPOINTS.settledBalance, {
          dmst_stex_tp: options.exchange || 'KRX',
        });
        emitList(data, 'stk_cntr_remn', getOutputFormat(options), (row: any) => ({
          code: row.stk_cd,
          name: row.stk_nm,
          qty: won(row.cur_qty),
          avgPrice: won(row.buy_uv),
          curPrice: won(row.cur_prc),
          evalAmt: won(row.evlt_amt),
          pnl: won(row.evltv_prft),
          pnlRate: pct(row.pl_rt),
        }));
      } catch (err) {
        handleError(err);
      }
    });

  // account open-orders
  account
    .command('open-orders')
    .description('Unfilled (open) orders (ka10075)')
    .option('-c, --code <code>', 'Filter by stock code')
    .option('-o, --output <format>', 'Output format (table/json)', 'table')
    .action(async (options) => {
      try {
        const client = createClient();
        const body = options.code
          ? {
              all_stk_tp: '0',
              trde_tp: '0',
              stk_cd: normalizeStockCode(options.code),
              stex_tp: '0',
            }
          : { all_stk_tp: '1', trde_tp: '0', stk_cd: '', stex_tp: '0' };
        const { data } = await client.callEndpoint(ENDPOINTS.openOrders, body);
        emitList(data, 'oso', getOutputFormat(options), (row) =>
          formatFields(row, {
            stk_nm: (v) => v,
            ord_no: (v) => v,
            ord_qty: won,
            ord_pric: won,
            oso_qty: won,
            cur_prc: unpad,
            tm: formatStamp,
          }),
        );
      } catch (err) {
        handleError(err);
      }
    });

  // account executions
  account
    .command('executions')
    .description('Filled executions (ka10076)')
    .option('-c, --code <code>', 'Filter by stock code')
    .option('-o, --output <format>', 'Output format (table/json)', 'table')
    .action(async (options) => {
      try {
        const client = createClient();
        const { data } = await client.callEndpoint(ENDPOINTS.executions, {
          stk_cd: options.code ? normalizeStockCode(options.code) : '',
          qry_tp: options.code ? '1' : '0',
          sell_tp: '0',
          ord_no: '',
          stex_tp: '0',
        });
        emitList(data, 'cntr', getOutputFormat(options), (row) =>
          formatFields(row, {
            stk_nm: (v) => v,
            ord_no: (v) => v,
            cntr_qty: won,
            cntr_uv: won,
            ord_uv: won,
            cnfm_tm: formatStamp,
          }),
        );
      } catch (err) {
        handleError(err);
      }
    });

  // account order-detail
  account
    .command('order-detail')
    .description('Detailed order/execution history (kt00007)')
    .option('-d, --date <yyyymmdd>', 'Order date', '')
    .option('-c, --code <code>', 'Filter by stock code')
    .option('-o, --output <format>', 'Output format (table/json)', 'table')
    .action(async (options) => {
      try {
        const client = createClient();
        const { data } = await client.callEndpoint(ENDPOINTS.orderDetail, {
          ord_dt: options.date || '',
          qry_tp: '1',
          stk_bond_tp: '0',
          sell_tp: '0',
          stk_cd: options.code ? normalizeStockCode(options.code) : '',
          fr_ord_no: '',
          dmst_stex_tp: '%',
        });
        emitList(data, 'acnt_ord_cntr_prps_dtl', getOutputFormat(options));
      } catch (err) {
        handleError(err);
      }
    });

  // account pnl <code>
  account
    .command('pnl <code>')
    .description('Realized profit/loss by date or period (ka10072 / ka10073)')
    .option('-s, --start <yyyymmdd>', 'Start date')
    .option('-e, --end <yyyymmdd>', 'End date (enables period query, max 3 months)')
    .option('-o, --output <format>', 'Output format (table/json)', 'table')
    .action(async (code: string, options) => {
      try {
        const client = createClient();
        const stk = normalizeStockCode(code);
        const ep = options.end ? ENDPOINTS.realizedPlByPeriod : ENDPOINTS.realizedPlByDate;
        const body = options.end
          ? { stk_cd: stk, strt_dt: options.start || options.end, end_dt: options.end }
          : { stk_cd: stk, strt_dt: options.start || todayKst() };
        const { data } = await client.callEndpoint(ep, body);
        emitList(data, ep.listKey!, getOutputFormat(options), (row) =>
          formatFields(row, {
            dt: formatStamp,
            stk_nm: (v) => v,
            cntr_qty: won,
            buy_uv: won,
            cntr_pric: won,
            tdy_sel_pl: won,
            pl_rt: unpad,
          }),
        );
      } catch (err) {
        handleError(err);
      }
    });

  // account journal
  account
    .command('journal')
    .description("Today's trading journal with totals (ka10170)")
    .option('-d, --date <yyyymmdd>', 'Base date', '')
    .option('-o, --output <format>', 'Output format (table/json)', 'table')
    .action(async (options) => {
      try {
        const client = createClient();
        const { data } = await client.callEndpoint(ENDPOINTS.tradeJournal, {
          base_dt: options.date || '',
          ottks_tp: '1',
          ch_crd_tp: '0',
        });
        const fmt = getOutputFormat(options);
        if (fmt === 'json') {
          output(data, 'json');
          return;
        }
        output(
          {
            totalSell: won(data.tot_sell_amt),
            totalBuy: won(data.tot_buy_amt),
            commissionTax: won(data.tot_cmsn_tax),
            pnl: won(data.tot_pl_amt),
            profitRate: `${unpad(data.tot_prft_rt)}%`,
          },
          'table',
        );
        emitList(data, 'tdy_trde_diary', 'table');
      } catch (err) {
        handleError(err);
      }
    });

  // account returns
  account
    .command('returns')
    .description('Daily account return detail over a period (kt00016)')
    .option('-s, --start <yyyymmdd>', 'Start date (defaults to first of this month)')
    .option('-e, --end <yyyymmdd>', 'End date', todayKst())
    .option('-o, --output <format>', 'Output format (table/json)', 'table')
    .action(async (options) => {
      try {
        const client = createClient();
        const { data } = await client.callEndpoint(ENDPOINTS.dailyReturn, {
          fr_dt: options.start || `${todayKst().slice(0, 6)}01`,
          to_dt: options.end || todayKst(),
        });
        const fmt = getOutputFormat(options);
        if (fmt === 'json') {
          output(data, 'json');
          return;
        }
        output(
          {
            investBase: won(data.invt_bsamt),
            evalProfit: won(data.evltv_prft),
            profitRate: `${unpad(data.prft_rt)}%`,
            turnoverRate: `${unpad(data.tern_rt)}%`,
            totalFrom: won(data.tot_amt_fr),
            totalTo: won(data.tot_amt_to),
          },
          'table',
        );
      } catch (err) {
        handleError(err);
      }
    });
}

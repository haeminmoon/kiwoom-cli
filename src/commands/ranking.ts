import { Command } from 'commander';
import { createClient } from './_helpers';
import { ENDPOINTS } from '../client/endpoints';
import { getOutputFormat } from '../output/formatter';
import { handleError } from '../output/error';
import { unpad, won, formatFields } from '../utils/format';
import { emitList } from './market';

/** Shared row formatter for ranking tables (signed prices/rates unpadded, quantities/amounts comma-grouped). */
function formatRankRow(row: Record<string, unknown>): Record<string, unknown> {
  return formatFields(row, {
    stk_cd: (v) => v,
    stk_nm: (v) => v,
    cur_prc: unpad,
    flu_rt: unpad,
    pred_pre: unpad,
    trde_qty: won,
    now_trde_qty: won,
    trde_prica: won,
    trde_amt: won,
    sdnin_rt: unpad,
  });
}

export function registerRankingCommands(program: Command): void {
  const ranking = program
    .command('ranking')
    .alias('rank')
    .description('Ranking lists — gainers, volume, value');

  // ranking fluctuation
  ranking
    .command('fluctuation')
    .alias('gainers')
    .description('Price change rate ranking (ka10027)')
    .option('-m, --market <000|001|101>', 'Market: 000=all, 001=KOSPI, 101=KOSDAQ', '000')
    .option('-x, --exchange <1|2|3>', 'Exchange: 1=KRX, 2=NXT, 3=unified', '3')
    .option('-s, --sort <1-5>', 'Sort: 1=상승률, 2=상승폭, 3=하락률, 4=하락폭, 5=보합', '1')
    .option('-o, --output <format>', 'Output format (table/json)', 'table')
    .action(async (options) => {
      try {
        const client = createClient();
        const { data } = await client.callEndpoint(ENDPOINTS.rankFluctuation, {
          mrkt_tp: options.market,
          sort_tp: options.sort || '1',
          trde_qty_cnd: '0000',
          stk_cnd: '0',
          crd_cnd: '0',
          updown_incls: '1',
          pric_cnd: '0',
          trde_prica_cnd: '0',
          stex_tp: options.exchange,
        });
        emitList(data, ENDPOINTS.rankFluctuation.listKey!, getOutputFormat(options), formatRankRow);
      } catch (err) {
        handleError(err);
      }
    });

  // ranking volume
  ranking
    .command('volume')
    .description('Today volume ranking (ka10030)')
    .option('-m, --market <000|001|101>', 'Market: 000=all, 001=KOSPI, 101=KOSDAQ', '000')
    .option('-x, --exchange <1|2|3>', 'Exchange: 1=KRX, 2=NXT, 3=unified', '3')
    .option('-s, --sort <1-3>', 'Sort: 1=거래량, 2=거래회전율, 3=거래대금', '1')
    .option('-o, --output <format>', 'Output format (table/json)', 'table')
    .action(async (options) => {
      try {
        const client = createClient();
        const { data } = await client.callEndpoint(ENDPOINTS.rankVolume, {
          mrkt_tp: options.market,
          sort_tp: options.sort || '1',
          mang_stk_incls: '0',
          crd_tp: '0',
          trde_qty_tp: '0',
          pric_tp: '0',
          trde_prica_tp: '0',
          mrkt_open_tp: '0',
          stex_tp: options.exchange,
        });
        emitList(data, ENDPOINTS.rankVolume.listKey!, getOutputFormat(options), formatRankRow);
      } catch (err) {
        handleError(err);
      }
    });

  // ranking amount
  ranking
    .command('amount')
    .alias('value')
    .description('Trade value (거래대금) ranking (ka10032)')
    .option('-m, --market <000|001|101>', 'Market: 000=all, 001=KOSPI, 101=KOSDAQ', '000')
    .option('-x, --exchange <1|2|3>', 'Exchange: 1=KRX, 2=NXT, 3=unified', '3')
    .option('-o, --output <format>', 'Output format (table/json)', 'table')
    .action(async (options) => {
      try {
        const client = createClient();
        const { data } = await client.callEndpoint(ENDPOINTS.rankTradeAmount, {
          mrkt_tp: options.market,
          mang_stk_incls: '1',
          stex_tp: options.exchange,
        });
        emitList(data, ENDPOINTS.rankTradeAmount.listKey!, getOutputFormat(options), formatRankRow);
      } catch (err) {
        handleError(err);
      }
    });

  // ranking surge
  ranking
    .command('surge')
    .description('Volume surge (거래량급증) ranking (ka10023)')
    .option('-m, --market <000|001|101>', 'Market: 000=all, 001=KOSPI, 101=KOSDAQ', '000')
    .option('-x, --exchange <1|2|3>', 'Exchange: 1=KRX, 2=NXT, 3=unified', '3')
    .option('-s, --sort <1-4>', 'Sort type', '1')
    .option('-o, --output <format>', 'Output format (table/json)', 'table')
    .action(async (options) => {
      try {
        const client = createClient();
        const { data } = await client.callEndpoint(ENDPOINTS.rankVolumeSurge, {
          mrkt_tp: options.market,
          sort_tp: options.sort || '1',
          tm_tp: '2',
          trde_qty_tp: '5',
          tm: '',
          stk_cnd: '0',
          pric_tp: '0',
          stex_tp: options.exchange,
        });
        emitList(data, ENDPOINTS.rankVolumeSurge.listKey!, getOutputFormat(options), formatRankRow);
      } catch (err) {
        handleError(err);
      }
    });

  // ranking prev-volume
  ranking
    .command('prev-volume')
    .description('Previous-day volume ranking (ka10031)')
    .option('-m, --market <000|001|101>', 'Market: 000=all, 001=KOSPI, 101=KOSDAQ', '000')
    .option('-x, --exchange <1|2|3>', 'Exchange: 1=KRX, 2=NXT, 3=unified', '3')
    .option('--query <1|2>', 'Query type', '1')
    .option('--from <n>', 'Rank start', '0')
    .option('--to <n>', 'Rank end', '100')
    .option('-o, --output <format>', 'Output format (table/json)', 'table')
    .action(async (options) => {
      try {
        const client = createClient();
        const { data } = await client.callEndpoint(ENDPOINTS.rankPrevVolume, {
          mrkt_tp: options.market,
          qry_tp: options.query || '1',
          rank_strt: options.from || '0',
          rank_end: options.to || '100',
          stex_tp: options.exchange,
        });
        emitList(data, ENDPOINTS.rankPrevVolume.listKey!, getOutputFormat(options), formatRankRow);
      } catch (err) {
        handleError(err);
      }
    });
}

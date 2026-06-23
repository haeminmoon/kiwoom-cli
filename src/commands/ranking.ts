import { Command } from 'commander';
import { createClient } from './_helpers';
import { ENDPOINTS } from '../client/endpoints';
import { getOutputFormat, output } from '../output/formatter';
import { handleError } from '../output/error';
import { unpad, won, formatFields } from '../utils/format';
import { NETTRADE_FIELDS, extractNetTrade, type Investor } from '../utils/ranking';
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

  // ranking net-buy (수급: 외국인/기관 순매수·순매도 상위, ka90009)
  ranking
    .command('net-buy')
    .alias('supply')
    .description('Foreign/institution net-buy 수급 ranking (ka90009)')
    .option('-b, --by <foreign|institution|both>', 'Investor: foreign=외국인, institution=기관, both', 'both')
    .option('--side <buy|sell>', 'buy=순매수, sell=순매도', 'buy')
    .option('-m, --market <000|001|101>', 'Market: 000=all, 001=KOSPI, 101=KOSDAQ', '000')
    .option('-x, --exchange <1|2|3>', 'Exchange: 1=KRX, 2=NXT, 3=unified', '1')
    .option('-n, --count <n>', 'Top N (1-50)', '10')
    .option('-q, --rank-by <1|2>', 'Rank by 1=amount(금액), 2=quantity(수량)', '1')
    .option('-d, --date <YYYYMMDD>', 'Query date (default: latest)')
    .option('-o, --output <format>', 'Output format (table/json)', 'table')
    .action(async (options) => {
      try {
        const side: 'buy' | 'sell' = options.side === 'sell' ? 'sell' : 'buy';
        const by = ['foreign', 'institution', 'both'].includes(options.by) ? options.by : 'both';
        const investors: Investor[] = by === 'both' ? ['foreign', 'institution'] : [by];
        const n = Math.min(Math.max(parseInt(String(options.count), 10) || 10, 1), 50);
        const client = createClient();
        const { data } = await client.callEndpoint(ENDPOINTS.rankForeignInst, {
          mrkt_tp: options.market,
          amt_qty_tp: options.rankBy === '2' ? '2' : '1',
          qry_dt_tp: options.date ? '1' : '0',
          date: options.date || '',
          stex_tp: options.exchange,
        });
        const rows: Record<string, string>[] = Array.isArray(data?.[ENDPOINTS.rankForeignInst.listKey!])
          ? data[ENDPOINTS.rankForeignInst.listKey!]
          : [];
        const fmt = getOutputFormat(options);
        const sideKo = side === 'buy' ? '순매수' : '순매도';
        const labelKo: Record<string, string> = { foreign: '외국인', institution: '기관' };

        if (fmt === 'json') {
          const result: Record<string, unknown> = {
            side,
            rankBy: options.rankBy === '2' ? 'quantity' : 'amount',
          };
          for (const inv of investors) {
            result[inv] = extractNetTrade(rows, NETTRADE_FIELDS[inv][side], n);
          }
          output(result, 'json');
          return;
        }

        for (const inv of investors) {
          const list = extractNetTrade(rows, NETTRADE_FIELDS[inv][side], n);
          console.log(`\n${labelKo[inv]} ${sideKo} TOP${n} (${options.rankBy === '2' ? '수량' : '금액'} 기준)`);
          output(list, 'table');
        }
      } catch (err) {
        handleError(err);
      }
    });
}

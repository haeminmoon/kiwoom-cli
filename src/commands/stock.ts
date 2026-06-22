import { Command } from 'commander';
import { createClient } from './_helpers';
import { ENDPOINTS } from '../client/endpoints';
import { output, getOutputFormat } from '../output/formatter';
import { handleError } from '../output/error';
import { normalizeStockCode, todayKst, parseIntStrict } from '../utils/helpers';
import { unpad, won, price, formatStamp, formatFields } from '../utils/format';
import { emitList } from './market';

export function registerStockCommands(program: Command): void {
  const stock = program.command('stock').description('Stock information — fundamentals, search, members');

  // stock info <code>
  stock
    .command('info <code>')
    .description('Stock fundamentals snapshot (ka10001)')
    .option('-o, --output <format>', 'Output format (table/json)', 'table')
    .action(async (code: string, options) => {
      try {
        const client = createClient();
        const stk = normalizeStockCode(code);
        const { data } = await client.callEndpoint(ENDPOINTS.stockInfo, { stk_cd: stk });
        const fmt = getOutputFormat(options);
        if (fmt === 'json') {
          output(data, 'json');
          return;
        }
        output(
          {
            name: data.stk_nm,
            code: data.stk_cd,
            price: price(data.cur_prc),
            change: unpad(data.pred_pre),
            changeRate: `${unpad(data.flu_rt)}%`,
            open: price(data.open_pric),
            high: price(data.high_pric),
            low: price(data.low_pric),
            upperLimit: price(data.upl_pric),
            lowerLimit: price(data.lst_pric),
            volume: won(data.trde_qty),
            per: data.per,
            eps: data.eps,
            roe: data.roe,
            pbr: data.pbr,
            bps: data.bps,
            marketCap: won(data.mac),
            foreignRate: `${unpad(data.for_exh_rt)}%`,
            high52w: price(data['250hgst']),
            low52w: price(data['250lwst']),
          },
          'table',
        );
      } catch (err) {
        handleError(err);
      }
    });

  // stock search <keyword>
  stock
    .command('search <keyword>')
    .description('Search the stock list by name or code (ka10099)')
    .option('-m, --market <0|10>', 'Market: 0=KOSPI, 10=KOSDAQ', '0')
    .option('-n, --limit <n>', 'Maximum rows to return', '30')
    .option('-o, --output <format>', 'Output format (table/json)', 'table')
    .action(async (keyword: string, options) => {
      try {
        const client = createClient();
        const { data } = await client.callEndpoint(
          ENDPOINTS.stockList,
          { mrkt_tp: options.market },
          { paginate: true },
        );
        const fmt = getOutputFormat(options);
        const limit = parseIntStrict(options.limit, 'limit');
        const needle = keyword.toLowerCase();
        const list: Record<string, any>[] = Array.isArray(data[ENDPOINTS.stockList.listKey!])
          ? data[ENDPOINTS.stockList.listKey!]
          : [];
        const filtered = list
          .filter(
            (item) =>
              String(item.name ?? '').toLowerCase().includes(needle) ||
              String(item.code ?? '').startsWith(keyword),
          )
          .slice(0, limit);
        if (filtered.length === 0) {
          console.log('No matches');
          return;
        }
        if (fmt === 'json') {
          output(filtered, 'json');
          return;
        }
        const rows = filtered.map((item) => ({
          code: item.code,
          name: item.name,
          market: item.marketName,
          sector: item.upName,
          lastPrice: unpad(item.lastPrice),
        }));
        output(rows, 'table');
      } catch (err) {
        handleError(err);
      }
    });

  // stock resolve <code>
  stock
    .command('resolve <code>')
    .description('Resolve a single stock\'s listing metadata (ka10100)')
    .option('-o, --output <format>', 'Output format (table/json)', 'table')
    .action(async (code: string, options) => {
      try {
        const client = createClient();
        const stk = normalizeStockCode(code);
        const { data } = await client.callEndpoint(ENDPOINTS.stockInfoSingle, { stk_cd: stk });
        const fmt = getOutputFormat(options);
        if (fmt === 'json') {
          output(data, 'json');
          return;
        }
        output(
          {
            code: data.code,
            name: data.name,
            market: data.marketName,
            sector: data.upName,
            sizeTier: data.upSizeName,
            listedShares: won(data.listCount),
            lastPrice: unpad(data.lastPrice),
            state: data.state,
            nxtEnable: data.nxtEnable,
          },
          'table',
        );
      } catch (err) {
        handleError(err);
      }
    });

  // stock members <code>
  stock
    .command('members <code>')
    .description('Top 5 buy/sell trading members (ka10002)')
    .option('-o, --output <format>', 'Output format (table/json)', 'table')
    .action(async (code: string, options) => {
      try {
        const client = createClient();
        const stk = normalizeStockCode(code);
        const { data } = await client.callEndpoint(ENDPOINTS.tradingMembers, { stk_cd: stk });
        const fmt = getOutputFormat(options);
        if (fmt === 'json') {
          output(data, 'json');
          return;
        }
        const rows = [];
        for (let i = 1; i <= 5; i++) {
          rows.push({
            rank: i,
            sellMember: data['sel_trde_ori_nm_' + i],
            sellQty: unpad(data['sel_trde_qty_' + i]),
            buyMember: data['buy_trde_ori_nm_' + i],
            buyQty: unpad(data['buy_trde_qty_' + i]),
          });
        }
        output(rows, 'table');
      } catch (err) {
        handleError(err);
      }
    });

  // stock credit-trend <code>
  stock
    .command('credit-trend <code>')
    .description('Credit trading trend (신용매매동향) (ka10013)')
    .option('-d, --date <yyyymmdd>', 'Base date', todayKst())
    .option('-t, --type <1|2>', 'Query type: 1=융자, 2=대주', '1')
    .option('-o, --output <format>', 'Output format (table/json)', 'table')
    .action(async (code: string, options) => {
      try {
        const client = createClient();
        const stk = normalizeStockCode(code);
        const { data } = await client.callEndpoint(ENDPOINTS.creditTrend, {
          stk_cd: stk,
          dt: options.date ?? todayKst(),
          qry_tp: options.type ?? '1',
        });
        emitList(data, ENDPOINTS.creditTrend.listKey!, getOutputFormat(options), (row) =>
          formatFields(row, {
            dt: formatStamp,
            cur_prc: unpad,
            trde_qty: won,
            new: won,
            rpya: won,
            remn: won,
          }),
        );
      } catch (err) {
        handleError(err);
      }
    });
}

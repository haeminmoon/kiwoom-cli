import { Command } from 'commander';
import { createClient } from './_helpers';
import { ENDPOINTS } from '../client/endpoints';
import { output, getOutputFormat } from '../output/formatter';
import { handleError } from '../output/error';
import { unpad, won, formatStamp, formatFields } from '../utils/format';
import { emitList } from './market';

export function registerSectorCommands(program: Command): void {
  const sector = program
    .command('sector')
    .alias('industry')
    .description('Sector / industry indices');

  const withSharedOptions = (cmd: Command): Command =>
    cmd
      .option('-m, --market <0|1|2>', 'Market: 0=KOSPI, 1=KOSDAQ, 2=KOSPI200', '0')
      .option('-c, --code <inds_cd>', 'Industry code (001=종합KOSPI, 101=종합KOSDAQ)', '001')
      .option('-o, --output <format>', 'Output format (table/json)', 'table');

  // sector price
  withSharedOptions(sector.command('price').description('Sector index snapshot (ka20001)')).action(
    async (options) => {
      try {
        const client = createClient();
        const { data } = await client.callEndpoint(ENDPOINTS.sectorPrice, {
          mrkt_tp: options.market || '0',
          inds_cd: options.code || '001',
        });
        const fmt = getOutputFormat(options);
        if (fmt === 'json') {
          output(data, 'json');
          return;
        }
        output(
          {
            price: unpad(data.cur_prc),
            change: unpad(data.pred_pre),
            changeRate: `${unpad(data.flu_rt)}%`,
            open: unpad(data.open_pric),
            high: unpad(data.high_pric),
            low: unpad(data.low_pric),
            volume: won(data.trde_qty),
            rising: data.rising,
            falling: data.fall,
          },
          'table',
        );
        emitList(data, ENDPOINTS.sectorPrice.listKey!, 'table', (row) =>
          formatFields(row, {
            tm_n: formatStamp,
            cur_prc_n: unpad,
            trde_qty_n: won,
          }),
        );
      } catch (err) {
        handleError(err);
      }
    },
  );

  // sector stocks
  withSharedOptions(
    sector.command('stocks').description('Stock prices within a sector (ka20002)'),
  ).action(async (options) => {
    try {
      const client = createClient();
      const { data } = await client.callEndpoint(ENDPOINTS.sectorStocks, {
        mrkt_tp: options.market || '0',
        inds_cd: options.code || '001',
        stex_tp: '1',
      });
      emitList(data, ENDPOINTS.sectorStocks.listKey!, getOutputFormat(options), (row) =>
        formatFields(row, {
          stk_cd: (v) => v,
          stk_nm: (v) => v,
          cur_prc: unpad,
          flu_rt: unpad,
          now_trde_qty: won,
          open_pric: unpad,
          high_pric: unpad,
          low_pric: unpad,
        }),
      );
    } catch (err) {
      handleError(err);
    }
  });

  // sector all
  withSharedOptions(
    sector.command('all').description('All sector indices (ka20003)'),
  ).action(async (options) => {
    try {
      const client = createClient();
      const { data } = await client.callEndpoint(ENDPOINTS.sectorAllIndex, {
        inds_cd: options.code || '001',
      });
      emitList(data, ENDPOINTS.sectorAllIndex.listKey!, getOutputFormat(options), (row) =>
        formatFields(row, {
          stk_cd: (v) => v,
          stk_nm: (v) => v,
          cur_prc: unpad,
          flu_rt: unpad,
          trde_qty: won,
          trde_prica: won,
        }),
      );
    } catch (err) {
      handleError(err);
    }
  });

  // sector daily
  withSharedOptions(
    sector.command('daily').description('Sector index daily history (ka20009)'),
  ).action(async (options) => {
    try {
      const client = createClient();
      const { data } = await client.callEndpoint(ENDPOINTS.sectorDaily, {
        mrkt_tp: options.market || '0',
        inds_cd: options.code || '001',
      });
      const fmt = getOutputFormat(options);
      if (fmt === 'json') {
        output(data, 'json');
        return;
      }
      output(
        {
          price: unpad(data.cur_prc),
          changeRate: `${unpad(data.flu_rt)}%`,
          open: unpad(data.open_pric),
          high: unpad(data.high_pric),
          low: unpad(data.low_pric),
        },
        'table',
      );
      emitList(data, ENDPOINTS.sectorDaily.listKey!, 'table', (row) =>
        formatFields(row, {
          dt_n: formatStamp,
          cur_prc_n: unpad,
          flu_rt_n: unpad,
          acc_trde_qty_n: won,
        }),
      );
    } catch (err) {
      handleError(err);
    }
  });

  // sector codes
  withSharedOptions(
    sector.command('codes').description('Valid industry codes per market (ka10101)'),
  ).action(async (options) => {
    try {
      const client = createClient();
      const { data } = await client.callEndpoint(
        ENDPOINTS.sectorCodeList,
        { mrkt_tp: options.market || '0' },
        { paginate: true },
      );
      emitList(data, ENDPOINTS.sectorCodeList.listKey!, getOutputFormat(options), (row) =>
        formatFields(row, {
          marketCode: (v) => v,
          code: (v) => v,
          name: (v) => v,
          group: (v) => v,
        }),
      );
    } catch (err) {
      handleError(err);
    }
  });
}

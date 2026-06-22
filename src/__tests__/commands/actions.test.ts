import { Command } from 'commander';
import * as helpers from '../../commands/_helpers';
import { registerStockCommands } from '../../commands/stock';
import { registerMarketCommands } from '../../commands/market';
import { registerChartCommands } from '../../commands/chart';
import { registerAccountCommands } from '../../commands/account';
import { registerRankingCommands } from '../../commands/ranking';
import { registerSectorCommands } from '../../commands/sector';

jest.mock('../../commands/_helpers');
const mockedCreate = helpers.createClient as jest.Mock;

const RESPONSES: Record<string, any> = {
  ka10007: {
    stk_nm: '삼성전자',
    stk_cd: '005930',
    cur_prc: '-353750',
    pred_close_pric: '354000',
    flu_rt: '-0.07',
    open_pric: '-343000',
    high_pric: '+363000',
    low_pric: '-342000',
    trde_qty: '19856854',
    sel_1bid: '354000',
    buy_1bid: '-353500',
  },
  ka10001: {
    stk_nm: '삼성전자',
    stk_cd: '005930',
    cur_prc: '-353500',
    pred_pre: '-500',
    flu_rt: '-0.14',
    open_pric: '-343000',
    high_pric: '+363000',
    low_pric: '-342000',
    upl_pric: '+460000',
    lst_pric: '-248000',
    trde_qty: '19856852',
    per: '53.86',
    eps: '6564',
    roe: '10.9',
    pbr: '5.53',
    bps: '63976',
    mac: '20666595',
    for_exh_rt: '+47.56',
    '250hgst': '+374500',
    '250lwst': '-56900',
  },
  kt00018: {
    tot_pur_amt: '000000010637180',
    tot_evlt_amt: '000000009219000',
    tot_evlt_pl: '-00000001439556',
    tot_prft_rt: '-13.53',
    prsm_dpst_aset_amt: '000000028670337',
    acnt_evlt_remn_indv_tot: [
      {
        stk_cd: 'A001060',
        stk_nm: 'JW중외제약',
        rmnd_qty: '000000000000060',
        pur_pric: '000000000031216',
        cur_prc: '000000025750',
        evlt_amt: '000000001545000',
        evltv_prft: '-00000000331599',
        prft_rt: '-17.70',
        poss_rt: '17.61',
      },
    ],
  },
  ka10081: {
    stk_cd: '005930',
    stk_dt_pole_chart_qry: [
      {
        cur_prc: '353500',
        trde_qty: '19860223',
        trde_prica: '7013216',
        dt: '20260622',
        open_pric: '343000',
        high_pric: '363000',
        low_pric: '342000',
        pred_pre: '-500',
        pred_pre_sig: '5',
        trde_tern_rt: '+0.34',
      },
    ],
  },
  ka10030: {
    tdy_trde_qty_upper: [
      { stk_cd: '005930', stk_nm: '삼성전자', cur_prc: '-353500', flu_rt: '-0.14', trde_qty: '36845354' },
    ],
  },
  ka20003: {
    all_inds_idex: [
      { stk_cd: '001', stk_nm: '종합(KOSPI)', cur_prc: '+9103.86', flu_rt: '+0.57', trde_qty: '312410', trde_prica: '33208895' },
    ],
  },
};

function makeProgram(): Command {
  const program = new Command();
  program.exitOverride();
  registerStockCommands(program);
  registerMarketCommands(program);
  registerChartCommands(program);
  registerAccountCommands(program);
  registerRankingCommands(program);
  registerSectorCommands(program);
  return program;
}

let logSpy: jest.SpyInstance;
let tableSpy: jest.SpyInstance;

beforeEach(() => {
  mockedCreate.mockReturnValue({
    callEndpoint: jest.fn((def: any) =>
      Promise.resolve({ data: RESPONSES[def.apiId] ?? {}, contYn: false, nextKey: '' }),
    ),
  });
  logSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
  tableSpy = jest.spyOn(console, 'table').mockImplementation(() => undefined);
});

afterEach(() => {
  logSpy.mockRestore();
  tableSpy.mockRestore();
});

async function run(args: string[]) {
  await makeProgram().parseAsync(['node', 'kiwoom-cli', ...args]);
}

function logged(): string {
  return logSpy.mock.calls.flat().join('\n');
}

describe('read command actions', () => {
  it('market price renders a derived change and formatted price', async () => {
    await run(['market', 'price', '005930']);
    const out = logged();
    expect(out).toContain('삼성전자');
    expect(out).toContain('-250'); // 353750 - 354000
  });

  it('stock info renders fundamentals', async () => {
    await run(['stock', 'info', '005930']);
    const out = logged();
    expect(out).toContain('삼성전자');
    expect(out).toContain('53.86'); // per
  });

  it('account balance prints totals and a holdings table', async () => {
    await run(['account', 'balance']);
    expect(logged()).toContain('9,219,000'); // totalEval, won-formatted
    expect(tableSpy).toHaveBeenCalled();
    const rows = tableSpy.mock.calls[0][0];
    expect(rows[0]).toMatchObject({ code: 'A001060', name: 'JW중외제약', weight: '17.61%' });
  });

  it('chart day caps and formats rows', async () => {
    await run(['chart', 'day', '005930', '-n', '5']);
    expect(tableSpy).toHaveBeenCalled();
    const rows = tableSpy.mock.calls[0][0];
    expect(rows[0].trde_qty).toBe('19,860,223');
    expect(rows[0].dt).toBe('2026-06-22');
  });

  it('ranking volume renders a table', async () => {
    await run(['ranking', 'volume']);
    expect(tableSpy).toHaveBeenCalled();
  });

  it('sector all renders a table', async () => {
    await run(['sector', 'all']);
    expect(tableSpy).toHaveBeenCalled();
  });

  it('supports json output', async () => {
    await run(['stock', 'info', '005930', '-o', 'json']);
    const out = logged();
    expect(out).toContain('"stk_nm": "삼성전자"');
  });
});

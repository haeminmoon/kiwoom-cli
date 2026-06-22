import { registerMarketTools } from '../../mcp/tools/market';
import { registerChartTools } from '../../mcp/tools/chart';
import { registerAccountTools } from '../../mcp/tools/account';
import { registerOrderTools } from '../../mcp/tools/order';
import { registerRankingTools } from '../../mcp/tools/ranking';
import { clientOrThrow } from '../../mcp/helpers';

jest.mock('../../mcp/helpers', () => {
  const actual = jest.requireActual('../../mcp/helpers');
  return { ...actual, clientOrThrow: jest.fn() };
});

const mockedClient = clientOrThrow as jest.Mock;

interface Captured {
  config: any;
  handler: (args: any) => Promise<any>;
}

function makeServer() {
  const tools: Record<string, Captured> = {};
  const server = {
    registerTool: (name: string, config: any, handler: any) => {
      tools[name] = { config, handler };
    },
  };
  return { server: server as any, tools };
}

beforeEach(() => mockedClient.mockReset());

describe('tool registration', () => {
  it('registers the full tool surface', () => {
    const { server, tools } = makeServer();
    registerMarketTools(server);
    registerChartTools(server);
    registerAccountTools(server);
    registerOrderTools(server);
    registerRankingTools(server);

    const names = Object.keys(tools);
    for (const expected of [
      'get_stock_info',
      'get_price',
      'get_orderbook',
      'get_daily_price',
      'get_recent_trades',
      'search_stocks',
      'get_chart',
      'get_balance',
      'get_deposit',
      'get_open_orders',
      'get_executions',
      'get_realized_pnl',
      'place_order',
      'modify_order',
      'cancel_order',
      'get_ranking',
      'get_sector',
    ]) {
      expect(names).toContain(expected);
    }
  });

  it('gives every tool a description', () => {
    const { server, tools } = makeServer();
    registerMarketTools(server);
    for (const t of Object.values(tools)) {
      expect(typeof t.config.description).toBe('string');
      expect(t.config.description.length).toBeGreaterThan(0);
    }
  });
});

describe('place_order safety', () => {
  function orderTools() {
    const { server, tools } = makeServer();
    registerOrderTools(server);
    return tools;
  }

  it('returns a preview and never calls the client without confirm=true', async () => {
    const tools = orderTools();
    const res = await tools['place_order'].handler({
      side: 'buy',
      code: '005930',
      qty: '1',
      price: '70000',
    });
    expect(res.content[0].text).toContain('PREVIEW ONLY');
    expect(mockedClient).not.toHaveBeenCalled();
  });

  it('rejects a market order that includes a price', async () => {
    const tools = orderTools();
    const res = await tools['place_order'].handler({
      side: 'buy',
      code: '005930',
      qty: '1',
      price: '70000',
      type: '3',
    });
    expect(res.isError).toBe(true);
    expect(res.content[0].text).toMatch(/must not include a price/);
    expect(mockedClient).not.toHaveBeenCalled();
  });

  it('submits when confirm=true', async () => {
    const callEndpoint = jest
      .fn()
      .mockResolvedValue({ data: { ord_no: '0000139', return_msg: 'ok' }, contYn: false, nextKey: '' });
    mockedClient.mockReturnValue({ callEndpoint });

    const tools = orderTools();
    const res = await tools['place_order'].handler({
      side: 'buy',
      code: '005930',
      qty: '1',
      price: '70000',
      confirm: true,
    });
    expect(callEndpoint).toHaveBeenCalledTimes(1);
    const [, body] = callEndpoint.mock.calls[0];
    expect(body).toMatchObject({ stk_cd: '005930', ord_qty: '1', ord_uv: '70000', trde_tp: '0' });
    const parsed = JSON.parse(res.content[0].text);
    expect(parsed.submitted).toBe(true);
    expect(parsed.result.ord_no).toBe('0000139');
  });

  it('cancel_order previews without confirm', async () => {
    const tools = orderTools();
    const res = await tools['cancel_order'].handler({ orderNo: '1', code: '005930' });
    expect(res.content[0].text).toContain('PREVIEW ONLY');
    expect(mockedClient).not.toHaveBeenCalled();
  });
});

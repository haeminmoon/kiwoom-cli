import { Command } from 'commander';
import { registerConfigCommands } from '../../commands/config';
import { registerAuthCommands } from '../../commands/auth';
import { registerStockCommands } from '../../commands/stock';
import { registerMarketCommands } from '../../commands/market';
import { registerChartCommands } from '../../commands/chart';
import { registerAccountCommands } from '../../commands/account';
import { registerOrderCommands } from '../../commands/order';
import { registerRankingCommands } from '../../commands/ranking';
import { registerSectorCommands } from '../../commands/sector';

function build(): Command {
  const program = new Command();
  registerConfigCommands(program);
  registerAuthCommands(program);
  registerStockCommands(program);
  registerMarketCommands(program);
  registerChartCommands(program);
  registerAccountCommands(program);
  registerOrderCommands(program);
  registerRankingCommands(program);
  registerSectorCommands(program);
  return program;
}

function sub(program: Command, group: string): string[] {
  const g = program.commands.find((c) => c.name() === group);
  if (!g) throw new Error(`group ${group} not registered`);
  return g.commands.map((c) => c.name());
}

describe('command registration', () => {
  const program = build();

  it('registers all top-level groups', () => {
    const groups = program.commands.map((c) => c.name());
    for (const g of [
      'config',
      'auth',
      'stock',
      'market',
      'chart',
      'account',
      'order',
      'ranking',
      'sector',
    ]) {
      expect(groups).toContain(g);
    }
  });

  it('wires the market subcommands', () => {
    expect(sub(program, 'market')).toEqual(
      expect.arrayContaining(['price', 'orderbook', 'after-hours', 'daily', 'trades', 'strength']),
    );
  });

  it('wires the chart timeframes', () => {
    expect(sub(program, 'chart')).toEqual(
      expect.arrayContaining(['tick', 'min', 'day', 'week', 'month', 'year']),
    );
  });

  it('wires the account subcommands', () => {
    expect(sub(program, 'account')).toEqual(
      expect.arrayContaining(['balance', 'deposit', 'open-orders', 'executions', 'pnl', 'returns']),
    );
  });

  it('wires the order subcommands', () => {
    expect(sub(program, 'order')).toEqual(
      expect.arrayContaining(['buy', 'sell', 'modify', 'cancel']),
    );
  });

  it('wires the stock subcommands', () => {
    expect(sub(program, 'stock')).toEqual(
      expect.arrayContaining(['info', 'search', 'resolve', 'members', 'credit-trend']),
    );
  });

  it('wires the ranking + sector subcommands', () => {
    expect(sub(program, 'ranking')).toEqual(
      expect.arrayContaining(['fluctuation', 'volume', 'amount', 'surge', 'prev-volume']),
    );
    expect(sub(program, 'sector')).toEqual(
      expect.arrayContaining(['price', 'stocks', 'all', 'daily', 'codes']),
    );
  });
});

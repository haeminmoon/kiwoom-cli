import { Command } from 'commander';
import { registerConfigCommands } from './commands/config';
import { registerAuthCommands } from './commands/auth';
import { registerStockCommands } from './commands/stock';
import { registerMarketCommands } from './commands/market';
import { registerChartCommands } from './commands/chart';
import { registerAccountCommands } from './commands/account';
import { registerOrderCommands } from './commands/order';
import { registerRankingCommands } from './commands/ranking';
import { registerSectorCommands } from './commands/sector';

const program = new Command();

program
  .name('kiwoom-cli')
  .description('CLI for Kiwoom Securities (키움증권) — quotes, charts, account, and orders')
  .version('0.1.0');

program.exitOverride((err) => {
  if (err.code === 'commander.helpDisplayed' || err.code === 'commander.version') {
    process.exit(0);
  }
  process.exit(1);
});

registerConfigCommands(program);
registerAuthCommands(program);
registerStockCommands(program);
registerMarketCommands(program);
registerChartCommands(program);
registerAccountCommands(program);
registerOrderCommands(program);
registerRankingCommands(program);
registerSectorCommands(program);

program.parseAsync(process.argv).catch(() => {
  // Command actions handle their own errors via handleError().
  process.exit(1);
});

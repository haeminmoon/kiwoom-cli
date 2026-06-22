import { Command } from 'commander';
import * as readline from 'readline';
import { CliConfig, saveConfig, getEffectiveConfig, maskSecret } from '../config/store';
import { ENV_ALIASES, Environment } from '../config/constants';
import { KiwoomClient } from '../client/api-client';
import { output, getOutputFormat } from '../output/formatter';
import { handleError } from '../output/error';

/** Read a line from stdin, optionally masking the echoed characters. */
export function prompt(question: string, hidden = false): Promise<string> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    if (hidden) {
      process.stdout.write(question);
      const stdin = process.stdin;
      const wasRaw = stdin.isRaw;
      if (stdin.isTTY) stdin.setRawMode(true);
      let input = '';
      const onData = (char: Buffer) => {
        const c = char.toString();
        const code = char[0];
        if (c === '\n' || c === '\r') {
          stdin.removeListener('data', onData);
          if (stdin.isTTY) stdin.setRawMode(wasRaw ?? false);
          process.stdout.write('\n');
          rl.close();
          resolve(input);
        } else if (code === 3) {
          // Ctrl-C
          process.exit(0);
        } else if (code === 127 || code === 8) {
          // Backspace / DEL
          if (input.length > 0) {
            input = input.slice(0, -1);
            process.stdout.write('\b \b');
          }
        } else {
          input += c;
          process.stdout.write('*');
        }
      };
      stdin.on('data', onData);
    } else {
      rl.question(question, (answer) => {
        rl.close();
        resolve(answer.trim());
      });
    }
  });
}

async function verifyAndCacheToken(env: Environment, appkey: string, secretkey: string): Promise<void> {
  try {
    const client = new KiwoomClient({ env, appkey, secretkey });
    await client.authenticate();
    console.log('Access token issued and cached.');
  } catch (err) {
    console.error(
      `\nKeys saved, but token issuance failed: ${err instanceof Error ? err.message : String(err)}`,
    );
    console.error('Double-check the app key / secret key and environment.');
  }
}

export function registerConfigCommands(program: Command): void {
  const configCmd = program.command('config').description('Manage CLI configuration (keys, environment)');

  configCmd
    .command('init')
    .description('Interactive setup wizard')
    .action(async () => {
      try {
        console.log('Kiwoom CLI Setup\n');
        const envInput = await prompt('Environment (real/mock) [real]: ');
        const env = ENV_ALIASES[envInput.toLowerCase()] ?? 'real';
        const appkey = await prompt('App key: ');
        if (!appkey) {
          console.error('App key is required.');
          process.exit(1);
        }
        const secretkey = await prompt('Secret key: ', true);
        if (!secretkey) {
          console.error('Secret key is required.');
          process.exit(1);
        }
        saveConfig({ env, appkey, secretkey });
        console.log('\nConfiguration saved to ~/.kiwoom-cli/config.json');
        if (env === 'real') {
          console.log('NOTE: "real" places live orders with real money. Use "mock" to practice.');
        }
        await verifyAndCacheToken(env, appkey, secretkey);
      } catch (err) {
        handleError(err);
      }
    });

  configCmd
    .command('set')
    .description('Set configuration values')
    .option('--env <environment>', 'Environment (real/mock)')
    .option('--appkey <key>', 'Kiwoom app key')
    .option('--secretkey <key>', 'Kiwoom secret key')
    .action(async (options) => {
      try {
        const updates: Partial<CliConfig> = {};
        if (options.env) {
          const resolved = ENV_ALIASES[options.env.toLowerCase()];
          if (!resolved) {
            console.error(`Unknown environment: ${options.env}. Use: real, mock`);
            process.exit(1);
          }
          updates.env = resolved;
        }
        if (options.appkey) updates.appkey = options.appkey;
        if (options.secretkey) updates.secretkey = options.secretkey;
        if (Object.keys(updates).length === 0) {
          console.log('No values to set. Use --env, --appkey, or --secretkey');
          return;
        }
        saveConfig(updates);
        console.log('Configuration updated.');
        const cfg = getEffectiveConfig();
        if ((updates.appkey || updates.secretkey) && cfg.appkey && cfg.secretkey) {
          await verifyAndCacheToken(cfg.env, cfg.appkey, cfg.secretkey);
        }
      } catch (err) {
        handleError(err);
      }
    });

  configCmd
    .command('get <key>')
    .description('Get a configuration value (env, appkey, secretkey)')
    .action((key: string) => {
      try {
        const config = getEffectiveConfig();
        const value = (config as unknown as Record<string, unknown>)[key];
        if (value === undefined) {
          console.log(`Key "${key}" not found. Available: env, appkey, secretkey`);
        } else if (key === 'secretkey' || key === 'appkey') {
          console.log(maskSecret(value as string));
        } else {
          console.log(String(value));
        }
      } catch (err) {
        handleError(err);
      }
    });

  configCmd
    .command('list')
    .description('Show all configuration')
    .option('-o, --output <format>', 'Output format (table/json)', 'table')
    .action((options) => {
      try {
        const config = getEffectiveConfig();
        output(
          {
            env: config.env,
            appkey: maskSecret(config.appkey),
            secretkey: maskSecret(config.secretkey),
          },
          getOutputFormat(options),
        );
      } catch (err) {
        handleError(err);
      }
    });
}

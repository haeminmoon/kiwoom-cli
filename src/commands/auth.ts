import { Command } from 'commander';
import { createClient } from './_helpers';
import { getEffectiveConfig, getCachedToken, clearCachedToken, maskSecret } from '../config/store';
import { output, getOutputFormat } from '../output/formatter';
import { handleError, ActionableError } from '../output/error';
import { formatStamp } from '../utils/format';
import { isTokenExpired } from '../utils/helpers';

export function registerAuthCommands(program: Command): void {
  const authCmd = program.command('auth').description('Access-token management (OAuth2)');

  authCmd
    .command('token')
    .description('Issue (or reuse) an access token and cache it')
    .option('--force', 'Force a fresh token even if a valid one is cached')
    .option('-o, --output <format>', 'Output format (table/json)', 'table')
    .action(async (options) => {
      try {
        const cfg = getEffectiveConfig();
        const client = createClient();
        if (options.force) clearCachedToken(cfg.env);
        await client.authenticate();
        const cached = getCachedToken(cfg.env);
        output(
          {
            env: cfg.env,
            token: maskSecret(cached?.token),
            expiresAt: formatStamp(cached?.expiresDt),
            valid: cached ? !isTokenExpired(cached.expiresDt) : false,
          },
          getOutputFormat(options),
        );
      } catch (err) {
        handleError(err);
      }
    });

  authCmd
    .command('status')
    .description('Show the cached token status')
    .option('-o, --output <format>', 'Output format (table/json)', 'table')
    .action((options) => {
      try {
        const cfg = getEffectiveConfig();
        const cached = getCachedToken(cfg.env);
        if (!cached) {
          output({ env: cfg.env, cached: false }, getOutputFormat(options));
          return;
        }
        output(
          {
            env: cfg.env,
            cached: true,
            token: maskSecret(cached.token),
            expiresAt: formatStamp(cached.expiresDt),
            valid: !isTokenExpired(cached.expiresDt),
          },
          getOutputFormat(options),
        );
      } catch (err) {
        handleError(err);
      }
    });

  authCmd
    .command('revoke')
    .description('Revoke the cached access token')
    .action(async () => {
      try {
        const cfg = getEffectiveConfig();
        const cached = getCachedToken(cfg.env);
        if (!cached) {
          throw new ActionableError('No cached token to revoke.', 'kiwoom-cli auth token');
        }
        const client = createClient();
        await client.revokeToken(cached.token);
        console.log('Token revoked and cache cleared.');
      } catch (err) {
        handleError(err);
      }
    });
}

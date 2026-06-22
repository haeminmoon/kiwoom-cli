import { KiwoomClient } from '../client/api-client';
import { getEffectiveConfig } from '../config/store';
import { ActionableError } from '../output/error';

/**
 * Build a client from the effective config. Every Kiwoom call needs a token, so
 * app key + secret key are always required (there is no anonymous endpoint).
 */
export function createClient(): KiwoomClient {
  const config = getEffectiveConfig();
  if (!config.appkey || !config.secretkey) {
    throw new ActionableError(
      'App key / secret key are not configured.',
      'kiwoom-cli config init',
    );
  }
  return new KiwoomClient({
    env: config.env,
    appkey: config.appkey,
    secretkey: config.secretkey,
  });
}

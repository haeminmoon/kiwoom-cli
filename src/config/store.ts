import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  CONFIG_DIR_NAME,
  CONFIG_FILE_NAME,
  TOKEN_FILE_NAME,
  ENV_VARS,
  ENV_ALIASES,
  Environment,
} from './constants';

export interface CliConfig {
  env: Environment;
  appkey?: string;
  secretkey?: string;
}

export interface CachedToken {
  token: string;
  /** Kiwoom expiry stamp, "YYYYMMDDHHmmss" in KST. */
  expiresDt: string;
  /** First 6 chars of the appkey the token was issued for (cache-invalidation guard). */
  appkeyHint: string;
}

/** token.json holds one cached token per environment. */
type TokenCache = Partial<Record<Environment, CachedToken>>;

const DEFAULT_CONFIG: CliConfig = { env: 'real' };

function getConfigDir(): string {
  return path.join(os.homedir(), CONFIG_DIR_NAME);
}

function getConfigPath(): string {
  return path.join(getConfigDir(), CONFIG_FILE_NAME);
}

function getTokenPath(): string {
  return path.join(getConfigDir(), TOKEN_FILE_NAME);
}

function ensureConfigDir(): void {
  const dir = getConfigDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { mode: 0o700, recursive: true });
  } else {
    // Tighten perms even if the dir pre-existed with looser permissions.
    try {
      fs.chmodSync(dir, 0o700);
    } catch {
      /* best effort */
    }
  }
}

/**
 * Write a secrets file with 0600 perms. `writeFileSync`'s mode only applies when
 * the file is newly created, so chmod afterward to tighten a pre-existing file
 * that may have looser permissions.
 */
function writeSecure(filePath: string, data: string): void {
  fs.writeFileSync(filePath, data, { mode: 0o600 });
  try {
    fs.chmodSync(filePath, 0o600);
  } catch {
    /* best effort */
  }
}

// ─── Config ───────────────────────────────────────────────────────────────

export function loadConfig(): CliConfig {
  try {
    const raw = fs.readFileSync(getConfigPath(), 'utf-8');
    return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

export function saveConfig(partial: Partial<CliConfig>): void {
  ensureConfigDir();
  const current = loadConfig();
  const merged = { ...current, ...partial };
  writeSecure(getConfigPath(), JSON.stringify(merged, null, 2));
}

/**
 * Resolve the effective config: config file first, environment variables as a
 * fallback for any unset secret.
 */
export function getEffectiveConfig(): CliConfig {
  const disk = loadConfig();
  const envVal = process.env[ENV_VARS.env];
  const env: Environment =
    envVal && ENV_ALIASES[envVal.toLowerCase()]
      ? ENV_ALIASES[envVal.toLowerCase()]
      : disk.env;
  return {
    env,
    appkey: disk.appkey ?? process.env[ENV_VARS.appkey],
    secretkey: disk.secretkey ?? process.env[ENV_VARS.secretkey],
  };
}

export function maskSecret(value: string | undefined): string {
  if (!value) return '(not set)';
  if (value.length <= 10) return '****';
  return value.slice(0, 6) + '...' + value.slice(-4);
}

// ─── Token cache ────────────────────────────────────────────────────────────

function loadTokenCache(): TokenCache {
  try {
    return JSON.parse(fs.readFileSync(getTokenPath(), 'utf-8'));
  } catch {
    return {};
  }
}

export function getCachedToken(env: Environment): CachedToken | undefined {
  return loadTokenCache()[env];
}

export function saveCachedToken(env: Environment, token: CachedToken): void {
  ensureConfigDir();
  const cache = loadTokenCache();
  cache[env] = token;
  writeSecure(getTokenPath(), JSON.stringify(cache, null, 2));
}

export function clearCachedToken(env?: Environment): void {
  if (!env) {
    try {
      fs.rmSync(getTokenPath());
    } catch {
      /* nothing to clear */
    }
    return;
  }
  const cache = loadTokenCache();
  delete cache[env];
  try {
    ensureConfigDir();
    writeSecure(getTokenPath(), JSON.stringify(cache, null, 2));
  } catch {
    /* ignore */
  }
}

/** Expose paths for diagnostics/tests. */
export const _paths = { getConfigDir, getConfigPath, getTokenPath };

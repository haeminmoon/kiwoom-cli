// Redirect homedir to an isolated temp directory for the whole suite.
let mockTmp: string;
jest.mock('os', () => {
  const actual = jest.requireActual('os');
  return { ...actual, homedir: () => mockTmp };
});

import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';

mockTmp = fs.mkdtempSync(path.join(os.tmpdir(), 'kiwoom-store-'));

import {
  loadConfig,
  saveConfig,
  getEffectiveConfig,
  maskSecret,
  getCachedToken,
  saveCachedToken,
  clearCachedToken,
  _paths,
} from '../../config/store';

const ENV_KEYS = ['KIWOOM_APPKEY', 'KIWOOM_SECRETKEY', 'KIWOOM_ENV'];

function wipe() {
  try {
    fs.rmSync(_paths.getConfigDir(), { recursive: true, force: true });
  } catch {
    /* ignore */
  }
  for (const k of ENV_KEYS) delete process.env[k];
}

beforeEach(wipe);
afterAll(wipe);

describe('config load/save', () => {
  it('defaults to real env when no file exists', () => {
    expect(loadConfig()).toEqual({ env: 'real' });
  });

  it('persists and merges config', () => {
    saveConfig({ appkey: 'AAA', secretkey: 'BBB' });
    saveConfig({ env: 'mock' });
    expect(loadConfig()).toEqual({ env: 'mock', appkey: 'AAA', secretkey: 'BBB' });
  });

  it('writes the config file with 0600 perms', () => {
    saveConfig({ appkey: 'AAA' });
    const mode = fs.statSync(_paths.getConfigPath()).mode & 0o777;
    expect(mode).toBe(0o600);
  });

  it('tightens perms on a pre-existing world-readable config file', () => {
    fs.mkdirSync(_paths.getConfigDir(), { recursive: true });
    fs.writeFileSync(_paths.getConfigPath(), '{}');
    fs.chmodSync(_paths.getConfigPath(), 0o644);
    saveConfig({ appkey: 'AAA' });
    expect(fs.statSync(_paths.getConfigPath()).mode & 0o777).toBe(0o600);
  });
});

describe('getEffectiveConfig', () => {
  it('falls back to env vars when config is unset', () => {
    process.env.KIWOOM_APPKEY = 'ENVKEY';
    process.env.KIWOOM_SECRETKEY = 'ENVSECRET';
    process.env.KIWOOM_ENV = 'mock';
    const cfg = getEffectiveConfig();
    expect(cfg.appkey).toBe('ENVKEY');
    expect(cfg.secretkey).toBe('ENVSECRET');
    expect(cfg.env).toBe('mock');
  });

  it('prefers config file over env vars', () => {
    saveConfig({ appkey: 'DISKKEY' });
    process.env.KIWOOM_APPKEY = 'ENVKEY';
    expect(getEffectiveConfig().appkey).toBe('DISKKEY');
  });

  it('resolves env aliases (paper -> mock)', () => {
    process.env.KIWOOM_ENV = 'paper';
    expect(getEffectiveConfig().env).toBe('mock');
  });

  it('ignores unknown env aliases', () => {
    process.env.KIWOOM_ENV = 'nonsense';
    expect(getEffectiveConfig().env).toBe('real');
  });
});

describe('maskSecret', () => {
  it('masks long secrets', () => {
    expect(maskSecret('ABCDEFghijklmnopQRSTU')).toBe('ABCDEF...RSTU');
  });
  it('handles short/missing secrets', () => {
    expect(maskSecret('short')).toBe('****');
    expect(maskSecret(undefined)).toBe('(not set)');
  });
});

describe('token cache', () => {
  const tok = { token: 'TKN', expiresDt: '20991231235959', appkeyHint: '3CZRL6' };

  it('round-trips a token per environment', () => {
    saveCachedToken('real', tok);
    expect(getCachedToken('real')).toEqual(tok);
    expect(getCachedToken('mock')).toBeUndefined();
  });

  it('clears a single environment', () => {
    saveCachedToken('real', tok);
    saveCachedToken('mock', { ...tok, token: 'MOCKTKN' });
    clearCachedToken('real');
    expect(getCachedToken('real')).toBeUndefined();
    expect(getCachedToken('mock')?.token).toBe('MOCKTKN');
  });

  it('clears the whole cache', () => {
    saveCachedToken('real', tok);
    clearCachedToken();
    expect(getCachedToken('real')).toBeUndefined();
  });

  it('writes the token file with 0600 perms', () => {
    saveCachedToken('real', tok);
    const mode = fs.statSync(_paths.getTokenPath()).mode & 0o777;
    expect(mode).toBe(0o600);
  });
});

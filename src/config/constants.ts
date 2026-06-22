export type Environment = 'real' | 'mock';

/** API host per environment. */
export const BASE_URLS: Record<Environment, string> = {
  real: 'https://api.kiwoom.com',
  mock: 'https://mockapi.kiwoom.com',
};

/** Accepted aliases for the environment, including Korean labels. */
export const ENV_ALIASES: Record<string, Environment> = {
  real: 'real',
  prod: 'real',
  production: 'real',
  live: 'real',
  실전: 'real',
  실전투자: 'real',
  mock: 'mock',
  test: 'mock',
  paper: 'mock',
  demo: 'mock',
  모의: 'mock',
  모의투자: 'mock',
};

/** OAuth2 endpoints (relative to the environment base URL). */
export const TOKEN_PATH = '/oauth2/token';
export const REVOKE_PATH = '/oauth2/revoke';

/** Config + token-cache storage. */
export const CONFIG_DIR_NAME = '.kiwoom-cli';
export const CONFIG_FILE_NAME = 'config.json';
export const TOKEN_FILE_NAME = 'token.json';

/** Environment variables used as a fallback when the config file is unset. */
export const ENV_VARS = {
  appkey: 'KIWOOM_APPKEY',
  secretkey: 'KIWOOM_SECRETKEY',
  env: 'KIWOOM_ENV',
} as const;

/** Re-issue a cached token if it expires within this many milliseconds. */
export const TOKEN_REFRESH_BUFFER_MS = 60_000;

/** HTTP request timeout. */
export const REQUEST_TIMEOUT_MS = 30_000;

/**
 * `return_code` values that signal "no matching data" rather than a real error.
 * The API returns 20 ([2000] 관련자료가없습니다) for empty result sets; callers
 * should receive the (empty) payload, not an exception.
 */
export const SOFT_EMPTY_RETURN_CODES = new Set<number>([20]);

/** Exchange routing for ORDER TRs (dmst_stex_tp): best-execution SOR allowed. */
export const ORDER_EXCHANGE_TYPES = ['KRX', 'NXT', 'SOR'] as const;
export type OrderExchangeType = (typeof ORDER_EXCHANGE_TYPES)[number];

/** Exchange filter for ACCOUNT query TRs (dmst_stex_tp): % = all exchanges. */
export const ACCOUNT_EXCHANGE_TYPES = ['KRX', 'NXT', '%'] as const;
export type AccountExchangeType = (typeof ACCOUNT_EXCHANGE_TYPES)[number];

/**
 * trde_tp (매매구분 / order-type) codes for buy/sell orders, from the Kiwoom
 * spec. NOTE: 7 = 최우선지정가 (the assignment's "8" is wrong). Market types
 * (3/13/23) must be sent with an empty ord_uv.
 */
export const ORDER_TYPES: Record<string, string> = {
  '0': '보통(지정가/limit)',
  '3': '시장가(market)',
  '5': '조건부지정가',
  '6': '최유리지정가',
  '7': '최우선지정가',
  '10': '보통(IOC)',
  '13': '시장가(IOC)',
  '16': '최유리(IOC)',
  '20': '보통(FOK)',
  '23': '시장가(FOK)',
  '26': '최유리(FOK)',
  '28': '스톱지정가(stop-limit)',
  '29': '중간가',
  '30': '중간가(IOC)',
  '31': '중간가(FOK)',
  '61': '장시작전시간외',
  '62': '시간외단일가',
  '81': '장마감후시간외',
};

/** trde_tp codes that are market-style (price must be empty). */
export const MARKET_ORDER_TYPES = new Set(['3', '13', '23']);

/**
 * Maximum candles a single chart TR returns (one page). Larger `--count` /
 * `count` values are satisfied by paging on the response `cont-yn` / `next-key`
 * headers (handled by KiwoomClient.requestAll). Verified against the official
 * spec: tick/minute 900, day 600, week 300, month 240, year 30.
 */
export const CHART_PER_PAGE_CAP = {
  tick: 900,
  minute: 900,
  day: 600,
  week: 300,
  month: 240,
  year: 30,
} as const;

export type ChartType = keyof typeof CHART_PER_PAGE_CAP;

/**
 * Upper bound on the candle count a single command/tool invocation may request,
 * so a typo can't trigger an unbounded paginate loop. Counts above this are
 * clamped (CLI) or rejected by the schema (MCP).
 */
export const CHART_MAX_COUNT = 100000;

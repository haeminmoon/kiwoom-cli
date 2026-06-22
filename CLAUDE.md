# Kiwoom CLI

CLI & MCP server for the Kiwoom Securities (키움증권) REST API — Korean stock quotes, charts, account, and orders.

## Project Overview

- **Name**: `@2oolkit/kiwoom-cli`
- **Language**: TypeScript (CommonJS)
- **CLI Framework**: Commander.js
- **MCP Framework**: @modelcontextprotocol/sdk
- **Node**: >= 20
- **Build**: tsup (two entry points: `index.ts` → CLI, `mcp.ts` → MCP server)

## Safety

The API keys in use are **real-trading** credentials. Read/조회 TRs are safe to call live; **order TRs (kt10000/kt10001/kt10002/kt10003 and credit kt10006–kt10009) execute real trades** and must never be exercised live in tests — verify them through unit tests on body construction only. CLI order commands keep a confirmation prompt; MCP order tools require `confirm: true`.

## Architecture

```
src/
├── index.ts                       # CLI entry (Commander.js)
├── mcp.ts                         # MCP server entry (stdio)
├── client/
│   ├── api-client.ts              # KiwoomClient — token mgmt + generic TR request + pagination
│   └── endpoints.ts               # ENDPOINTS registry (apiId/path/listKey/isWrite) — source of truth
├── commands/                      # CLI command groups
│   ├── _helpers.ts                # createClient()
│   ├── config.ts                  # config init/set/get/list (+ prompt helper)
│   ├── auth.ts                    # auth token/status/revoke
│   ├── stock.ts                   # info, search, resolve, members, credit-trend
│   ├── market.ts                  # price, orderbook, after-hours, daily, trades, strength, inst-foreign (+ emitList)
│   ├── chart.ts                   # tick, min, day, week, month, year
│   ├── account.ts                 # balance, deposit, eval, settled, open-orders, executions, order-detail, pnl, journal, returns
│   ├── order.ts                   # buy, sell, modify, cancel (cash & credit) with confirmation guards
│   ├── ranking.ts                 # fluctuation, volume, amount, surge, prev-volume
│   └── sector.ts                  # price, stocks, all, daily, codes
├── config/
│   ├── store.ts                   # ~/.kiwoom-cli config.json + token.json cache
│   └── constants.ts               # BASE_URLS, env aliases, exchange enums, ORDER_TYPES, SOFT_EMPTY_RETURN_CODES
├── output/
│   ├── formatter.ts               # output(data, json|table)
│   └── error.ts                   # ActionableError, KiwoomApiError, handleError()
├── mcp/
│   ├── helpers.ts                 # mcpText/mcpJson/mcpError, clientOrThrow, tool() wrapper, withErrorHandling
│   └── tools/                     # market, chart, account, order, ranking (Zod schemas)
└── utils/
    ├── format.ts                  # unpad, toNumber, won, price, formatStamp, formatFields
    ├── helpers.ts                 # normalizeStockCode, parseKiwoomExpiry, isTokenExpired, todayKst
    └── orderbook.ts               # parseOrderbook/renderOrderbook (ka10004 irregular field naming)
```

## Kiwoom REST API reference

- **Real**: `https://api.kiwoom.com`  •  **Mock**: `https://mockapi.kiwoom.com` (KRX only; rejects real keys)
- **Token**: `POST /oauth2/token` `{grant_type:"client_credentials", appkey, secretkey}` → `{token, token_type:"Bearer", expires_dt, return_code:0}`. Revoke: `POST /oauth2/revoke`.
- **Every TR**: `POST /api/dostk/<category>` with headers `authorization: Bearer <token>`, `api-id: <TR>`, `cont-yn`, `next-key`, `Content-Type: application/json;charset=UTF-8`.
- **Success** = `return_code: 0`. `return_code: 20` = no data (treated as empty, not error). Pagination via response headers `cont-yn`/`next-key`.
- **Categories** (`/api/dostk/...`): `stkinfo`, `mrkcond`, `chart`, `acnt`, `ordr`, `crdordr`, `rkinfo`, `sect`.

### Data quirks

- Numbers are zero-padded strings; `unpad()` strips padding, `won()` groups, `price()` drops the **direction sign** and groups the magnitude.
- Quote/chart prices carry a `+`/`-` sign that means *up/down vs prior close*, not a negative value. `toNumber()` is sign- and double-sign aware (`--3405260` → `-3405260`).
- Exchange routing differs by context: **orders** use `KRX`/`NXT`/`SOR`; **account queries** use `KRX`/`NXT`/`%`.
- `trde_tp` order types: `0`=limit, `3`=market, `5`=conditional, `6`=best, **`7`=top-priority**, `10/13/16`=IOC, `20/23/26`=FOK, `28`=stop-limit, etc. Market types (`3/13/23`) require an empty `ord_uv`.
- Weekly chart list key is the doubled `stk_stk_pole_chart_qry` (verified live, not a typo).

### Chart API limits & pagination

Each chart TR returns at most one page of candles. To pull more, continue with the response
`cont-yn: Y` / `next-key` headers (handled generically by `KiwoomClient.requestAll`, default
`maxPages: 100`). **Per-request caps** (`CHART_PER_PAGE_CAP` in `config/constants.ts`):

| TR | Timeframe | Per-request max | listKey |
|---|---|---|---|
| ka10079 | tick | 900 | `stk_tic_chart_qry` |
| ka10080 | minute | 900 | `stk_min_pole_chart_qry` |
| ka10081 | day | 600 | `stk_dt_pole_chart_qry` |
| ka10082 | week | 300 | `stk_stk_pole_chart_qry` |
| ka10083 | month | 240 | `stk_mth_pole_chart_qry` |
| ka10094 | year | 30 | `stk_yr_pole_chart_qry` |

- CLI `chart <type>` and MCP `get_chart` auto-paginate when `--count`/`count` exceeds the cap
  (or when CLI `-p/--paginate` is set). They pass `{ paginate: true, maxPages: ceil(count/cap) }`
  to `callEndpoint`, then slice the concatenated list to the requested count so output never
  exceeds it. `--count` is clamped to `CHART_MAX_COUNT` (100,000) and must be a positive integer.
- Pagination repeats the **same request body** with `cont-yn: Y` + the prior `next-key`; the API
  walks backward in time from `base_dt` (period) / latest (tick·minute).

## Configuration

- Config: `~/.kiwoom-cli/config.json` (0600). Token cache: `~/.kiwoom-cli/token.json` (0600, per environment).
- Env vars (fallback): `KIWOOM_APPKEY`, `KIWOOM_SECRETKEY`, `KIWOOM_ENV`.

```ts
interface CliConfig { env: 'real' | 'mock'; appkey?: string; secretkey?: string; }
```

## Patterns

- **Single source of truth**: `ENDPOINTS` registry. Commands/MCP call `client.callEndpoint(ENDPOINTS.x, body, { paginate })`.
- **Dual interface**: same `KiwoomClient` drives CLI (Commander) and MCP (Zod).
- **Token transparency**: `KiwoomClient` issues + caches a token on first call, reuses across invocations until ~60s before expiry, and retries once on 401.
- **All commands** support `-o, --output <table|json>`.
- **MCP order tools** preview unless `confirm: true`.
- MCP tools register through the `tool()` wrapper (erases the SDK's deep zod generic to avoid TS2589).

## Commands

```bash
npm run build      # tsup → dist/index.js, dist/mcp.js
npm run dev        # ts-node src/index.ts
npm run lint       # tsc --noEmit (heap-bumped; MCP/zod types are large)
npm test           # jest
```

## Bin Entries

- `kiwoom-cli` → `dist/index.js`
- `kiwoom-mcp` → `dist/mcp.js`

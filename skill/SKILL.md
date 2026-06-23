---
name: kiwoom
description: >-
  Trade and research Korean stocks through the Kiwoom Securities (키움증권) REST API via CLI or MCP server.
  Use when the user wants to: look up Korean stock prices, fundamentals, or order books (KOSPI/KOSDAQ);
  pull tick/minute/daily/weekly/monthly/yearly charts; check their Kiwoom account balance, deposits,
  holdings, open orders, executions, or realized P&L; view market rankings (gainers, volume, value) or
  sector indices; or place, modify, and cancel stock orders (cash or credit). Supports both real-money
  trading (api.kiwoom.com) and the mock simulation server (mockapi.kiwoom.com).
  Also available as an MCP server (kiwoom-mcp) for Claude, Cursor, and other AI agents.
license: MIT
compatibility: >-
  Requires Node.js >= 20. Works on macOS, Linux, and Windows. Network access to api.kiwoom.com required.
metadata:
  author: 2oolkit
  version: "0.1.0"
  exchange: kiwoom
  openclaw:
    emoji: "📈"
    homepage: "https://openapi.kiwoom.com"
    primaryEnv: "KIWOOM_APPKEY"
    requires:
      bins: ["kiwoom-cli", "kiwoom-mcp"]
      env: ["KIWOOM_APPKEY", "KIWOOM_SECRETKEY"]
    install:
      - id: "kiwoom-cli-npm"
        kind: "npm"
        package: "@2oolkit/kiwoom-cli"
        bins: ["kiwoom-cli", "kiwoom-mcp"]
        label: "Install kiwoom-cli & kiwoom-mcp via npm"
  clawdbot:
    emoji: "📈"
    homepage: "https://openapi.kiwoom.com"
    primaryEnv: "KIWOOM_APPKEY"
    requires:
      bins: ["kiwoom-cli", "kiwoom-mcp"]
      env: ["KIWOOM_APPKEY", "KIWOOM_SECRETKEY"]
    install:
      - id: "kiwoom-cli-npm"
        kind: "npm"
        package: "@2oolkit/kiwoom-cli"
        bins: ["kiwoom-cli"]
        label: "Install kiwoom-cli via npm"
---

# Kiwoom

Research and trade Korean stocks (KOSPI/KOSDAQ) through the [Kiwoom Securities](https://openapi.kiwoom.com) REST API — prices, charts, account, and orders — via CLI or MCP server.

**Available interfaces:**
- **CLI** (`kiwoom-cli`) — terminal queries, scripting, automation
- **MCP Server** (`kiwoom-mcp`) — AI agents via Model Context Protocol (Claude, Cursor, Windsurf)

> ⚠️ **Real money.** On the `real` environment, `order` commands place live trades. Use `mock` to practice. The MCP order tools never execute without `confirm: true`.

## Getting Started

```bash
npm install -g @2oolkit/kiwoom-cli
kiwoom-cli --version
```

### First-time setup

```bash
kiwoom-cli config init
```

| Field | Description |
|-------|-------------|
| **Environment** | `real` (api.kiwoom.com) or `mock` (mockapi.kiwoom.com) |
| **App key** | Kiwoom REST app key |
| **Secret key** | Kiwoom REST secret key (input masked) |

Config is saved to `~/.kiwoom-cli/config.json` (`0600`); the OAuth2 token is issued and cached automatically.

**Alternative — environment variables:**
```bash
export KIWOOM_APPKEY=<key>
export KIWOOM_SECRETKEY=<secret>
export KIWOOM_ENV=real    # or mock
```

### Verify
```bash
kiwoom-cli config list
kiwoom-cli auth token
kiwoom-cli stock info 005930
```

## Output Format

**Always use `-o json` when parsing output programmatically.** Table format is for humans.

```bash
kiwoom-cli account balance -o json | jq '.acnt_evlt_remn_indv_tot[].stk_nm'
```

## Stock codes

Korean stock codes are 6 digits: `005930` (삼성전자), `000660` (SK하이닉스), `069500` (KODEX 200). Find a code:

```bash
kiwoom-cli stock search 삼성 -o json
```

## Command Reference

### Stock info & lookup
| Command | Description |
|---------|-------------|
| `kiwoom-cli stock info <code>` | Fundamentals + price (PER/EPS/ROE/PBR/BPS, OHLC) |
| `kiwoom-cli stock search <keyword> [-m 0\|10]` | Find code/name (0=KOSPI, 10=KOSDAQ) |
| `kiwoom-cli stock resolve <code>` | Listing metadata |
| `kiwoom-cli stock members <code>` | Top-5 buy/sell brokers |
| `kiwoom-cli stock credit-trend <code>` | Margin trading trend |

### Market data
| Command | Description |
|---------|-------------|
| `kiwoom-cli market price <code>` | Current price snapshot |
| `kiwoom-cli market orderbook <code>` | 10-level bid/ask book |
| `kiwoom-cli market after-hours <code>` | After-hours single price |
| `kiwoom-cli market daily <code>` | Daily price history |
| `kiwoom-cli market trades <code>` | Recent executions |
| `kiwoom-cli market strength <code> [--daily]` | Trade strength (체결강도) |
| `kiwoom-cli market inst-foreign <code> -s <date> -e <date>` | Institution/foreigner trend |

### Charts
| Command | Description | Per-request max |
|---------|-------------|-----------------|
| `kiwoom-cli chart tick <code> [-s 1\|3\|5\|10\|30]` | Tick chart | 900 |
| `kiwoom-cli chart min <code> [-i 1\|3\|5\|10\|15\|30\|45\|60]` | Minute chart | 900 |
| `kiwoom-cli chart day <code> [-d YYYYMMDD]` | Daily | 600 |
| `kiwoom-cli chart week <code>` | Weekly | 300 |
| `kiwoom-cli chart month <code>` | Monthly | 240 |
| `kiwoom-cli chart year <code>` | Yearly | 30 |

All charts: `-n <count>` (candles, default 50), `--raw` (unadjusted prices), `-p/--paginate`
(force multi-page). A single request returns up to the per-request max above; a larger
`-n/--count` **auto-paginates** via the API's `cont-yn`/`next-key` headers and returns ~that many
bars (clamped to 100,000). e.g. `chart day 005930 -n 2000` pulls ~2000 daily bars over multiple
pages.

### Account
| Command | Description |
|---------|-------------|
| `kiwoom-cli account balance` | Eval balance + holdings + P&L |
| `kiwoom-cli account deposit` | Cash / orderable / withdrawable |
| `kiwoom-cli account eval` | Eval status + holdings |
| `kiwoom-cli account settled` | Settled balance |
| `kiwoom-cli account open-orders [-c code]` | Unfilled orders |
| `kiwoom-cli account executions [-c code]` | Filled executions |
| `kiwoom-cli account order-detail [-d date] [-c code]` | Order/execution history |
| `kiwoom-cli account pnl <code> [-s date] [-e date]` | Realized P&L (≤3 months) |
| `kiwoom-cli account journal` | Today's trade journal |
| `kiwoom-cli account returns [-s date] [-e date]` | Daily account return |

### Rankings & sectors
| Command | Description |
|---------|-------------|
| `kiwoom-cli ranking fluctuation [-s 1..5]` | Top gainers/losers |
| `kiwoom-cli ranking volume\|amount\|surge\|prev-volume` | Volume / value / surge / prior-day |
| `kiwoom-cli ranking net-buy [-b foreign\|institution\|both] [--side buy\|sell]` | 수급: foreign/institution net-buy top (ka90009) |
| `kiwoom-cli sector price\|stocks\|all\|daily [-m 0\|1\|2] [-c code]` | Sector indices |
| `kiwoom-cli sector codes` | List sector (업종) codes |

Ranking flags: `-m 000=all/001=KOSPI/101=KOSDAQ`, `-x 1=KRX/2=NXT/3=unified`.

### Orders — ⚠ real money on `real`
| Command | Description |
|---------|-------------|
| `kiwoom-cli order buy <code> <qty> [-p price]` | Buy (market if no `-p`) |
| `kiwoom-cli order sell <code> <qty> [-p price]` | Sell |
| `kiwoom-cli order modify <orderNo> <code> <qty> <price>` | Modify resting order |
| `kiwoom-cli order cancel <orderNo> <code> [-q qty]` | Cancel (qty 0 = all) |

Order flags: `-t/--type <trde_tp>` (0=limit, 3=market, 5=conditional, 7=top-priority, 10/13=IOC, 20/23=FOK, 28=stop-limit), `-x/--exchange KRX|NXT|SOR`, `--credit`, `-y/--yes` (skip confirm).

### Auth & config
| Command | Description |
|---------|-------------|
| `kiwoom-cli auth token [--force]` | Issue/refresh + cache token |
| `kiwoom-cli auth status` | Cached token + expiry |
| `kiwoom-cli auth revoke` | Revoke cached token |
| `kiwoom-cli config init\|set\|get\|list` | Manage keys + environment |

## Common Workflows

### Check a stock and place a limit buy
```bash
kiwoom-cli stock info 005930 -o json
kiwoom-cli market orderbook 005930
kiwoom-cli order buy 005930 1 -p 70000      # prompts for confirmation
```

### Account health check
```bash
kiwoom-cli account balance -o json
kiwoom-cli account deposit -o json
kiwoom-cli account open-orders -o json
```

### Find today's movers
```bash
kiwoom-cli ranking fluctuation -s 1 -o json    # top gainers
kiwoom-cli ranking volume -o json              # volume leaders
```

## Error Handling

Errors go to stderr with recovery hints:
```
Error: App key / secret key are not configured.

Try: kiwoom-cli config init
```

| Error | Recovery |
|-------|----------|
| App/secret key not configured | `kiwoom-cli config init` |
| Token expired / invalid | `kiwoom-cli auth token --force` |
| Invalid stock code | Use a 6-digit code; `kiwoom-cli stock search <name>` |

## Safety Rules

1. **Use `mock` first** — `kiwoom-cli config set --env mock`.
2. On `real`, every order moves real money; the CLI confirms before sending unless `-y`.
3. Keys are stored locally `0600` and masked in output.
4. For AI agents via MCP, order tools require `confirm: true`.

## Tips for AI Agents

- **Always use `-o json`** — table output cannot be reliably parsed.
- Quote/chart prices carry a direction sign (`-353750` = 353,750 down vs prior close); use the magnitude.
- Resolve a name to a code with `kiwoom-cli stock search <name> -o json` before ordering.
- An empty result is normal (`No data` / `return_code: 20`), not an error.

## Detailed References

- **[references/market-data.md](references/market-data.md)** — prices, order book, charts, rankings, sectors
- **[references/account.md](references/account.md)** — balance, deposits, orders, executions, P&L, config
- **[references/trading.md](references/trading.md)** — order types, exchanges, credit orders, confirmation

## MCP Server

```bash
# Claude Code
claude mcp add kiwoom -- kiwoom-mcp

# Claude Desktop / Cursor / Windsurf
{
  "mcpServers": {
    "kiwoom": {
      "command": "kiwoom-mcp",
      "env": {
        "KIWOOM_APPKEY": "your-app-key",
        "KIWOOM_SECRETKEY": "your-secret-key",
        "KIWOOM_ENV": "real"
      }
    }
  }
}
```

18 tools: `get_stock_info`, `get_price`, `get_orderbook`, `get_daily_price`, `get_recent_trades`, `search_stocks`, `get_chart`, `get_balance`, `get_deposit`, `get_open_orders`, `get_executions`, `get_realized_pnl`, `get_ranking`, `get_net_buy_ranking`, `get_sector`, `place_order`, `modify_order`, `cancel_order`. Order tools return a preview unless `confirm: true`.

## Resources

- **Kiwoom Open API**: https://openapi.kiwoom.com
- **npm**: https://www.npmjs.com/package/@2oolkit/kiwoom-cli
- **GitHub**: https://github.com/haeminmoon/kiwoom-cli

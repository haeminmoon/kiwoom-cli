# Account Reference

All account commands require configured keys and accept `-o, --output <table|json>`.
Holdings prices in account TRs are **unsigned** (unlike quote TRs).

## Balance & holdings

```bash
kiwoom-cli account balance            # kt00018 — totals + per-holding detail
kiwoom-cli account balance -o json    # raw payload
```
Table view prints account totals (purchase, eval, eval P&L, profit rate, estimated deposit asset)
followed by a holdings table (`code, name, qty, avgPrice, curPrice, evalAmt, pnl, pnlRate, weight`).

Exchange filter `-x KRX|NXT|%` (`%` = all exchanges). Default `KRX`.

```bash
kiwoom-cli account eval               # kt00004 — eval status + holdings
kiwoom-cli account settled            # kt00005 — settled (executed) balance
```

## Cash

```bash
kiwoom-cli account deposit            # kt00001 — cash, orderable, withdrawable, D+2 deposit, substitute
kiwoom-cli account returns -s 20260101 -e 20260622   # kt00016 — period return / yield
```

## Orders & executions

```bash
kiwoom-cli account open-orders            # ka10075 — unfilled orders (all)
kiwoom-cli account open-orders -c 005930  # filtered to one stock
kiwoom-cli account executions             # ka10076 — filled executions
kiwoom-cli account order-detail -d 20260622   # kt00007 — order/execution history
```

After placing an order, confirm it with `account open-orders` (current, real-time) — the
order-status TRs (`kt00007`/`kt00009`) are current-day-scoped and may return no data.

## Realized P&L

```bash
kiwoom-cli account pnl 005930 -s 20260622                 # ka10072 — single date
kiwoom-cli account pnl 005930 -s 20260401 -e 20260622     # ka10073 — period (≤3 months)
kiwoom-cli account journal                                # ka10170 — today's trade journal + totals
```
The period query (`-e` given) enforces a maximum 3-month window.

## Configuration & token

```bash
kiwoom-cli config init                                    # interactive
kiwoom-cli config set --env real --appkey K --secretkey S
kiwoom-cli config set --env mock                          # switch to simulation
kiwoom-cli config list

kiwoom-cli auth token            # issue/reuse + cache token
kiwoom-cli auth token --force    # force a fresh token
kiwoom-cli auth status           # cached token + expiry
kiwoom-cli auth revoke           # revoke + clear cache
```

Files (mode `0600`):
- `~/.kiwoom-cli/config.json` — `{ env, appkey, secretkey }`
- `~/.kiwoom-cli/token.json` — cached token per environment

Environment variables (fallback for anything unset): `KIWOOM_APPKEY`, `KIWOOM_SECRETKEY`, `KIWOOM_ENV`.

## Security

- App key / secret key are stored locally with `0600` permissions and masked in CLI output.
- The token is issued from the keys, cached, and refreshed ~60s before expiry; it auto-reissues on a 401.
- Never commit the config or token files.

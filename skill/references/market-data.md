# Market Data Reference

All market-data commands accept `-o, --output <table|json>`. Use `json` for parsing.

## Current price & quotes

```bash
kiwoom-cli market price 005930        # ka10007 — name, price, change, OHLC, top-of-book
kiwoom-cli stock info 005930          # ka10001 — fundamentals + price (PER/EPS/ROE/PBR/BPS)
kiwoom-cli market orderbook 005930    # ka10004 — 10-level bid/ask ladder
kiwoom-cli market after-hours 005930  # ka10087 — after-hours single price
```

### Reading prices
Quote/chart price fields carry a **direction sign** relative to the previous close:
`-353750` means the price is **353,750**, trading *below* the prior close. The CLI displays the
magnitude (`353,750`) and reports `change` / `changeRate` separately. In JSON the raw signed string
is preserved — strip a leading `+`/`-` to get the value.

`pred_pre_sig` / `pre_sig` codes: `1`=상한, `2`=상승, `3`=보합, `4`=하한, `5`=하락.

## Order book (`market orderbook`)

10 levels each side. JSON `-o json` returns the raw ka10004 payload with the irregular field
naming (level 1 = `sel_fpr_*` / `buy_fpr_*`, levels 2–10 = `sel_Nth_pre_*` / `buy_Nth_pre_*`).
The table view renders an aligned ladder (asks top, bids bottom) plus total ask/bid quantities.

## Trades & strength

```bash
kiwoom-cli market trades 005930              # ka10003 — recent tick executions
kiwoom-cli market strength 005930            # ka10046 — intraday 체결강도 series
kiwoom-cli market strength 005930 --daily    # ka10047 — daily 체결강도 series
kiwoom-cli market daily 005930 -d 20260622   # ka10086 — daily price history (+investor flows)
kiwoom-cli market inst-foreign 005930 -s 20260601 -e 20260622   # ka10045
```

## Charts

| Timeframe | Command | TR | Scope option |
|---|---|---|---|
| Tick | `chart tick <code> -s <n>` | ka10079 | ticks 1/3/5/10/30 |
| Minute | `chart min <code> -i <n>` | ka10080 | minutes 1/3/5/10/15/30/45/60 |
| Daily | `chart day <code> -d <YYYYMMDD>` | ka10081 | base date |
| Weekly | `chart week <code>` | ka10082 | base date |
| Monthly | `chart month <code>` | ka10083 | base date |
| Yearly | `chart year <code>` | ka10094 | base date |

Common: `-n <count>` caps displayed rows (default 50); `--raw` returns unadjusted prices
(`upd_stkpc_tp=0`). Charts are returned latest-first. Item time fields: `cntr_tm`
(tick/minute, YYYYMMDDHHMMSS) or `dt` (period, YYYYMMDD).

```bash
kiwoom-cli chart min 005930 -i 5 -n 30 -o json
kiwoom-cli chart day 005930 -n 60
```

## Rankings

```bash
kiwoom-cli ranking fluctuation -s 1   # ka10027 — 1=상승률,2=상승폭,3=하락률,4=하락폭,5=보합
kiwoom-cli ranking volume -s 1        # ka10030 — 1=거래량,2=거래회전율,3=거래대금
kiwoom-cli ranking amount             # ka10032 — top trade value
kiwoom-cli ranking surge -s 1         # ka10023 — volume surge
kiwoom-cli ranking prev-volume        # ka10031 — prior-day volume
```
Flags: `-m 000=all/001=KOSPI/101=KOSDAQ`, `-x 1=KRX/2=NXT/3=unified`.

## Sectors / industry

```bash
kiwoom-cli sector codes               # ka10101 — list valid industry codes (inds_cd)
kiwoom-cli sector all                 # ka20003 — every sector index
kiwoom-cli sector price -m 0 -c 001   # ka20001 — one index (001=종합 KOSPI)
kiwoom-cli sector stocks -c 001       # ka20002 — constituents
kiwoom-cli sector daily -c 001        # ka20009 — daily index history
```
`-m 0=KOSPI/1=KOSDAQ/2=KOSPI200`. Common codes: `001`=종합(KOSPI), `101`=종합(KOSDAQ).

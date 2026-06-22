# Trading Reference

> ⚠️ On the `real` environment these commands place **live orders with real money**.
> Switch to the simulation server first: `kiwoom-cli config set --env mock`.
> Every CLI order prompts for confirmation unless you pass `-y/--yes`.

## Place orders

```bash
# Limit buy 1 share of 005930 at 70,000 KRW
kiwoom-cli order buy 005930 1 -p 70000

# Market sell 1 share (omit -p for a market order)
kiwoom-cli order sell 005930 1

# Explicit order type
kiwoom-cli order buy 005930 1 -p 70000 -t 0      # 0 = limit
kiwoom-cli order buy 005930 1 -t 3               # 3 = market
```

### Order type codes (`-t` / `trde_tp`)

| Code | Meaning | | Code | Meaning |
|---|---|---|---|---|
| `0` | 보통 (limit) | | `20` | 보통 FOK |
| `3` | 시장가 (market) | | `23` | 시장가 FOK |
| `5` | 조건부지정가 | | `26` | 최유리 FOK |
| `6` | 최유리지정가 | | `28` | 스톱지정가 (stop-limit) |
| `7` | 최우선지정가 | | `29` | 중간가 |
| `10` | 보통 IOC | | `30` | 중간가 IOC |
| `13` | 시장가 IOC | | `31` | 중간가 FOK |
| `16` | 최유리 IOC | | `61/62/81` | pre/after/post off-hours |

- Market types (`3`, `13`, `23`) must **not** include `-p`; the price is sent empty.
- Limit-style types require `-p`.
- If `-t` is omitted: a `-p` implies limit (`0`), no `-p` implies market (`3`).

## Modify & cancel

```bash
# Modify a resting order to new qty/price
kiwoom-cli order modify 0000139 005930 1 71000

# Cancel all remaining of an order
kiwoom-cli order cancel 0000139 005930

# Cancel a partial quantity
kiwoom-cli order cancel 0000139 005930 -q 1
```
The `<orderNo>` is the order number returned when the order was placed (or from
`kiwoom-cli account open-orders`). The exchange (`-x`) must match the original order.

## Exchange routing (`-x` / `dmst_stex_tp`)

| Value | Meaning |
|---|---|
| `KRX` | Korea Exchange (default) |
| `NXT` | Nextrade ATS |
| `SOR` | Smart Order Routing (best execution across KRX + NXT) |

## Credit (margin) orders

Add `--credit` to route to the credit order TRs (`/api/dostk/crdordr`):

```bash
kiwoom-cli order buy 005930 1 -p 70000 --credit
kiwoom-cli order sell 005930 1 -p 72000 --credit --credit-deal 33 --loan-date 20260102
```
- `--credit-deal` (신용거래구분): `33`=융자, `99`=융자합 (sell only).
- `--loan-date` (대출일, YYYYMMDD): required when repaying a specific loan tranche.

## Confirmation flow

Each order prints a summary, e.g.:
```
BUY 005930  qty 1  @ 70000  type 0(보통(지정가/limit))  [KRX]  on REAL  ⚠ REAL MONEY
Proceed? (y/N):
```
Answer `y` to submit, anything else to abort. Pass `-y/--yes` to skip the prompt in scripts.

## MCP order tools

`place_order`, `modify_order`, `cancel_order` accept the same parameters plus a **`confirm`**
boolean. Without `confirm: true` they return a preview and submit nothing — so an AI agent
cannot place a live order by accident.

```jsonc
// place_order args
{ "side": "buy", "code": "005930", "qty": "1", "price": "70000", "confirm": false }  // preview
{ "side": "buy", "code": "005930", "qty": "1", "price": "70000", "confirm": true }   // submits
```

## After ordering

Confirm fills with the real-time open-orders / executions TRs:
```bash
kiwoom-cli account open-orders
kiwoom-cli account executions
```

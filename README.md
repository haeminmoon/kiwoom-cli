# kiwoom-cli

> **키움증권 REST API**를 위한 CLI & MCP 서버 — 터미널이나 AI 에이전트에서 국내 주식 시세 조회, 차트, 계좌 조회, 주문까지.

[![npm](https://img.shields.io/npm/v/@2oolkit/kiwoom-cli.svg)](https://www.npmjs.com/package/@2oolkit/kiwoom-cli)

`kiwoom-cli`는 키움증권 공식 REST API(`api.kiwoom.com`)를 깔끔한 Commander.js CLI **와** Model Context Protocol(MCP) 서버로 감싼 도구입니다. 같은 기능을 셸에서도, Claude / Cursor 같은 MCP 클라이언트에서도 쓸 수 있습니다.

- **인증 자동 처리** — OAuth2 액세스 토큰을 발급·캐시하고 만료 전에 알아서 갱신합니다.
- **모든 조회** — 종목 기본정보, 현재가, 10단계 호가, 틱~년봉 차트, 일별주가, 체결강도, 계좌 잔고, 예수금, 미체결, 체결내역, 실현손익, 순위, 업종지수.
- **주문** — 매수 / 매도 / 정정 / 취소 (현금·신용), 확인 절차 내장. MCP에서는 명시적 `confirm` 플래그 필요.
- **실전 또는 모의** — 실전(`api.kiwoom.com`)과 모의투자(`mockapi.kiwoom.com`) 전환 가능.

> ⚠️ **실제 자금 주의.** `real` 환경에서 `order` 명령은 실제 계좌에 실거래를 냅니다. 먼저 `mock`에서 연습하세요. 주문 도구는 명시적 확인 없이는 절대 실행되지 않습니다.

## 설치

```bash
npm install -g @2oolkit/kiwoom-cli
```

Node.js 20 이상 필요.

## 빠른 시작

```bash
# 1. 키움 앱키 + 시크릿키 설정 (대화형)
kiwoom-cli config init

# 2. 토큰 발급 확인
kiwoom-cli auth token

# 3. 조회
kiwoom-cli stock info 005930          # 삼성전자 기본정보
kiwoom-cli market price 005930        # 현재가
kiwoom-cli market orderbook 005930    # 10단계 호가
kiwoom-cli chart day 005930 -n 20     # 최근 일봉 20개
kiwoom-cli account balance            # 보유종목 + 손익
```

앱키 / 시크릿키는 [키움 Open API 포털](https://openapi.kiwoom.com/)에서 발급받습니다.

## 설정

설정은 `~/.kiwoom-cli/config.json`(권한 `0600`)에, 캐시된 토큰은 `~/.kiwoom-cli/token.json`(권한 `0600`)에 저장됩니다.

```bash
kiwoom-cli config set --env real --appkey <키> --secretkey <시크릿>
kiwoom-cli config set --env mock          # 모의투자 서버로 전환
kiwoom-cli config list
```

환경변수는 설정 파일에 없는 값만 보완합니다(설정 파일이 우선):

| 변수 | 의미 |
|---|---|
| `KIWOOM_APPKEY` | 앱키 |
| `KIWOOM_SECRETKEY` | 시크릿키 |
| `KIWOOM_ENV` | `real` 또는 `mock` |

```bash
KIWOOM_APPKEY=... KIWOOM_SECRETKEY=... KIWOOM_ENV=real kiwoom-cli market price 005930
```

모든 명령은 `-o, --output <table|json>`을 지원합니다(기본값 `table`). 스크립트로 파싱할 땐 `json`을 쓰세요:

```bash
kiwoom-cli account balance -o json | jq '.acnt_evlt_remn_indv_tot[].stk_nm'
```

## 명령어

### `auth` — 액세스 토큰
```
kiwoom-cli auth token [--force]      토큰 발급/재사용 + 캐시
kiwoom-cli auth status               캐시된 토큰 + 만료시각 표시
kiwoom-cli auth revoke               캐시된 토큰 폐기
```

### `stock` — 종목 정보 & 검색
```
kiwoom-cli stock info <코드>         기본정보 + 현재가 (ka10001)
kiwoom-cli stock search <키워드>     종목 코드/이름 검색 (ka10099); -m 0=코스피/10=코스닥
kiwoom-cli stock resolve <코드>      상장정보 (ka10100)
kiwoom-cli stock members <코드>      상위 5개 매수/매도 거래원 (ka10002)
kiwoom-cli stock credit-trend <코드> 신용매매동향 (ka10013)
```

### `market` — 시세, 호가, 체결
```
kiwoom-cli market price <코드>          현재가 스냅샷 (ka10007)
kiwoom-cli market orderbook <코드>      10단계 호가 (ka10004)
kiwoom-cli market after-hours <코드>    시간외 단일가 (ka10087)
kiwoom-cli market daily <코드>          일별주가 (ka10086)
kiwoom-cli market trades <코드>         최근 체결 (ka10003)
kiwoom-cli market strength <코드>       체결강도 (ka10046/47); --daily
kiwoom-cli market inst-foreign <코드>   기관/외국인 매매추이 (ka10045)
```

### `chart` — OHLC
```
kiwoom-cli chart tick  <코드> [-s 1|3|5|10|30]            틱차트 (ka10079)
kiwoom-cli chart min   <코드> [-i 1|3|5|10|15|30|45|60]   분봉 (ka10080)
kiwoom-cli chart day   <코드> [-d YYYYMMDD]               일봉 (ka10081)
kiwoom-cli chart week  <코드>                             주봉 (ka10082)
kiwoom-cli chart month <코드>                             월봉 (ka10083)
kiwoom-cli chart year  <코드>                             년봉 (ka10094)
```
모두 `-n, --count <n>`(봉 개수, 기본 50), `--raw`(수정주가 미적용), `-p, --paginate`(강제 다중 페이지) 지원.

**1회 요청당 최대 봉 개수 (per-request cap)** — 그 이상은 `cont-yn`/`next-key` 헤더로 **자동 페이지네이션**:

| 차트 | 1회 최대 | `--count` 한도 |
|---|---|---|
| tick / min | 900 | 100,000 (자동 분할) |
| day | 600 | 100,000 (자동 분할) |
| week | 300 | 100,000 (자동 분할) |
| month | 240 | 100,000 (자동 분할) |
| year | 30 | 100,000 (자동 분할) |

`--count`가 1회 최대를 넘으면 자동으로 여러 페이지를 받아 합칩니다(시간순 정렬·중복 제거는 API 순서를 그대로 유지). `-p/--paginate`로 강제할 수도 있습니다. `--count`는 양의 정수여야 하며 100,000으로 클램프됩니다.

```bash
kiwoom-cli chart day 005930 -n 600              # 한 페이지(최대) — 일봉 600개
kiwoom-cli chart day 005930 -n 2000 -o json     # 자동 페이지네이션 — 일봉 ~2000개
kiwoom-cli chart min 005930 -i 1 -n 2000 -o json # 1분봉 ~2000개 (여러 페이지)
```

### `account` — 계좌
```
kiwoom-cli account balance              평가잔고 + 보유종목 (kt00018)
kiwoom-cli account deposit              예수금/주문가능/출금가능 (kt00001)
kiwoom-cli account eval                 평가현황 + 보유종목 (kt00004)
kiwoom-cli account settled              체결잔고 (kt00005)
kiwoom-cli account open-orders [-c 코드] 미체결 주문 (ka10075)
kiwoom-cli account executions [-c 코드]  체결 내역 (ka10076)
kiwoom-cli account order-detail          주문체결 상세내역 (kt00007)
kiwoom-cli account pnl <코드> [-s -e]    실현손익 (ka10072/73, 최대 3개월)
kiwoom-cli account journal               당일매매일지 (ka10170)
kiwoom-cli account returns [-s -e]       일별계좌수익률 (kt00016)
```

### `ranking` & `sector` — 순위 & 업종
```
kiwoom-cli ranking fluctuation [-s 1..5]  전일대비 등락률 순위 (ka10027)
kiwoom-cli ranking volume                 당일 거래량 상위 (ka10030)
kiwoom-cli ranking amount                 거래대금 상위 (ka10032)
kiwoom-cli ranking surge                  거래량 급증 (ka10023)
kiwoom-cli ranking prev-volume            전일 거래량 상위 (ka10031)
kiwoom-cli ranking net-buy [옵션]         수급: 외국인·기관 순매수 상위 (ka90009)

kiwoom-cli sector price [-m -c]   업종 현재가 (ka20001)
kiwoom-cli sector stocks          업종 구성종목 (ka20002)
kiwoom-cli sector all             전업종 지수 (ka20003)
kiwoom-cli sector daily           업종 일별지수 (ka20009)
kiwoom-cli sector codes           업종 코드 목록 (ka10101)
```
순위: `-m 000=전체/001=코스피/101=코스닥`, `-x 1=KRX/2=NXT/3=통합`.

수급(`net-buy`, alias `supply`)은 한 번의 ka90009 호출로 외국인·기관 매매상위를 함께 반환합니다:
`-b foreign|institution|both`(기본 both), `--side buy|sell`(기본 buy=순매수), `-n <1-50>`(기본 10), `-q 1=금액/2=수량`(기본 1), `-d YYYYMMDD`(기본 최신). 예: `kiwoom-cli ranking net-buy -b both -n 10`.

### `order` — ⚠ `real`에서는 실제 자금
```
kiwoom-cli order buy  <코드> <수량> [-p 가격] [-t 유형] [-x KRX|NXT|SOR] [--credit] [-y]
kiwoom-cli order sell <코드> <수량> [-p 가격] [-t 유형] [-x ...] [--credit] [-y]
kiwoom-cli order modify <주문번호> <코드> <수량> <가격> [-x ...] [--credit] [-y]
kiwoom-cli order cancel <주문번호> <코드> [-q 수량] [-x ...] [--credit] [-y]
```
- `-p/--price`를 생략하면 **시장가**, 지정하면 **지정가** 주문.
- `-t/--type`으로 주문유형(`trde_tp`) 지정: `0`=지정가, `3`=시장가, `5`=조건부지정가, `6`=최유리, `7`=최우선, `10/13/16`=IOC, `20/23/26`=FOK, `28`=스톱지정가, …
- 스톱지정가(`28`)는 `--cond-price <트리거가>` 필요.
- 각 명령은 요약을 출력하고 **확인을 묻습니다**. `-y/--yes`로 건너뛸 수 있습니다.

```bash
kiwoom-cli order buy  005930 1 -p 70000     # 지정가 매수 1주 @ 70,000
kiwoom-cli order sell 005930 1              # 시장가 매도 1주
kiwoom-cli order cancel 0000139 005930      # 잔량 전부 취소
```

## MCP 서버

모든 조회 도구와 (가드 적용된) 주문 도구를 MCP 클라이언트에 노출합니다.

```jsonc
// Claude Desktop / Cursor mcp 설정
{
  "mcpServers": {
    "kiwoom": {
      "command": "kiwoom-mcp",
      "env": {
        "KIWOOM_APPKEY": "발급받은-앱키",
        "KIWOOM_SECRETKEY": "발급받은-시크릿키",
        "KIWOOM_ENV": "real"
      }
    }
  }
}
```

도구: `get_stock_info`, `get_price`, `get_orderbook`, `get_daily_price`, `get_recent_trades`, `search_stocks`, `get_chart`, `get_balance`, `get_deposit`, `get_open_orders`, `get_executions`, `get_realized_pnl`, `get_ranking`, `get_net_buy_ranking`, `get_sector`, `place_order`, `modify_order`, `cancel_order`.

주문 도구는 **`confirm: true`를 넘기지 않으면 미리보기만 반환하고 아무것도 실행하지 않습니다** — 에이전트가 실수로 실주문을 낼 수 없습니다.

## 데이터에 관한 참고

- 숫자는 0으로 채워진 문자열로 옵니다. CLI가 패딩을 제거하고 천 단위로 끊어 표시합니다.
- 시세/차트 가격에는 **방향 부호**가 붙습니다(`-353750` = 가격 353,750, 전일 종가 *대비 하락*). CLI는 절대값을 표시하고 등락은 별도로 보여줍니다.
- 페이지네이션(`cont-yn`/`next-key`)은 필요한 곳에서 자동 처리됩니다.
- 데이터 없음 응답(`return_code: 20`)은 오류가 아닌 빈 결과로 처리합니다.

## 개발

```bash
npm install
npm run build        # tsup → dist/index.js (CLI) + dist/mcp.js (MCP)
npm test             # jest
npm run lint         # tsc --noEmit
```

## 라이선스

MIT

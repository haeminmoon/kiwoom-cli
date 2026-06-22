/**
 * Registry of every Kiwoom TR this CLI exposes — the single source of truth for
 * api-id, route, response list key, and whether the call places/modifies orders.
 *
 * All specs were live-verified against https://api.kiwoom.com (read TRs) or
 * taken from the official spec + typed community wrappers (order TRs, which are
 * never called live for safety).
 */

export const PATHS = {
  stkinfo: '/api/dostk/stkinfo',
  mrkcond: '/api/dostk/mrkcond',
  chart: '/api/dostk/chart',
  acnt: '/api/dostk/acnt',
  ordr: '/api/dostk/ordr',
  crdordr: '/api/dostk/crdordr',
  rkinfo: '/api/dostk/rkinfo',
  sect: '/api/dostk/sect',
} as const;

export interface EndpointDef {
  /** api-id header value, e.g. "ka10001". */
  apiId: string;
  /** Category route. */
  path: string;
  /** Korean TR name. */
  korean: string;
  /** Array field in the response payload, if the TR returns a list. */
  listKey?: string;
  /** True for order place/modify/cancel TRs (real-money writes). */
  isWrite?: boolean;
}

export const ENDPOINTS = {
  // ── Stock info (종목정보) ──────────────────────────────────────────────────
  stockInfo: { apiId: 'ka10001', path: PATHS.stkinfo, korean: '주식기본정보요청' },
  tradingMembers: { apiId: 'ka10002', path: PATHS.stkinfo, korean: '주식거래원요청' },
  stockTrades: { apiId: 'ka10003', path: PATHS.stkinfo, korean: '체결정보요청', listKey: 'cntr_infr' },
  watchlist: { apiId: 'ka10095', path: PATHS.stkinfo, korean: '관심종목정보요청', listKey: 'atn_stk_infr' },
  stockList: { apiId: 'ka10099', path: PATHS.stkinfo, korean: '종목정보 리스트', listKey: 'list' },
  stockInfoSingle: { apiId: 'ka10100', path: PATHS.stkinfo, korean: '종목정보 조회' },
  sectorCodeList: { apiId: 'ka10101', path: PATHS.stkinfo, korean: '업종코드 리스트', listKey: 'list' },
  creditTrend: { apiId: 'ka10013', path: PATHS.stkinfo, korean: '신용매매동향요청', listKey: 'crd_trde_trend' },

  // ── Market quote (시세) ────────────────────────────────────────────────────
  orderbook: { apiId: 'ka10004', path: PATHS.mrkcond, korean: '주식호가요청' },
  quoteSnapshot: { apiId: 'ka10006', path: PATHS.mrkcond, korean: '주식시분요청' },
  priceTableInfo: { apiId: 'ka10007', path: PATHS.mrkcond, korean: '시세표성정보요청' },
  dailyPrice: { apiId: 'ka10086', path: PATHS.mrkcond, korean: '일별주가요청', listKey: 'daly_stkpc' },
  instTradedStocks: { apiId: 'ka10044', path: PATHS.mrkcond, korean: '일별기관매매종목요청', listKey: 'daly_orgn_trde_stk' },
  instForeignTrend: { apiId: 'ka10045', path: PATHS.mrkcond, korean: '종목별기관매매추이요청', listKey: 'stk_orgn_trde_trnsn' },
  strengthByTime: { apiId: 'ka10046', path: PATHS.mrkcond, korean: '체결강도시간별요청', listKey: 'cntr_str_tm' },
  strengthByDay: { apiId: 'ka10047', path: PATHS.mrkcond, korean: '체결강도일별요청', listKey: 'cntr_str_daly' },
  afterHoursOrderbook: { apiId: 'ka10087', path: PATHS.mrkcond, korean: '시간외단일가요청' },

  // ── Chart (차트) ───────────────────────────────────────────────────────────
  tickChart: { apiId: 'ka10079', path: PATHS.chart, korean: '주식틱차트조회', listKey: 'stk_tic_chart_qry' },
  minuteChart: { apiId: 'ka10080', path: PATHS.chart, korean: '주식분봉차트조회', listKey: 'stk_min_pole_chart_qry' },
  dailyChart: { apiId: 'ka10081', path: PATHS.chart, korean: '주식일봉차트조회', listKey: 'stk_dt_pole_chart_qry' },
  // NOTE: weekly list key is the doubled "stk_stk_..." — verified live, not a typo.
  weeklyChart: { apiId: 'ka10082', path: PATHS.chart, korean: '주식주봉차트조회', listKey: 'stk_stk_pole_chart_qry' },
  monthlyChart: { apiId: 'ka10083', path: PATHS.chart, korean: '주식월봉차트조회', listKey: 'stk_mth_pole_chart_qry' },
  yearlyChart: { apiId: 'ka10094', path: PATHS.chart, korean: '주식년봉차트조회', listKey: 'stk_yr_pole_chart_qry' },

  // ── Account (계좌) ─────────────────────────────────────────────────────────
  balance: { apiId: 'kt00018', path: PATHS.acnt, korean: '계좌평가잔고내역요청', listKey: 'acnt_evlt_remn_indv_tot' },
  deposit: { apiId: 'kt00001', path: PATHS.acnt, korean: '예수금상세현황요청', listKey: 'stk_entr_prst' },
  evalStatus: { apiId: 'kt00004', path: PATHS.acnt, korean: '계좌평가현황요청', listKey: 'stk_acnt_evlt_prst' },
  settledBalance: { apiId: 'kt00005', path: PATHS.acnt, korean: '체결잔고요청', listKey: 'stk_cntr_remn' },
  orderDetail: { apiId: 'kt00007', path: PATHS.acnt, korean: '계좌별주문체결내역상세요청', listKey: 'acnt_ord_cntr_prps_dtl' },
  orderStatus: { apiId: 'kt00009', path: PATHS.acnt, korean: '계좌별주문체결현황요청', listKey: 'acnt_ord_cntr_prst' },
  openOrders: { apiId: 'ka10075', path: PATHS.acnt, korean: '미체결요청', listKey: 'oso' },
  executions: { apiId: 'ka10076', path: PATHS.acnt, korean: '체결요청', listKey: 'cntr' },
  realizedPlByDate: { apiId: 'ka10072', path: PATHS.acnt, korean: '일자별종목별실현손익요청_일자', listKey: 'dt_stk_div_rlzt_pl' },
  realizedPlByPeriod: { apiId: 'ka10073', path: PATHS.acnt, korean: '일자별종목별실현손익요청_기간', listKey: 'dt_stk_rlzt_pl' },
  tradeJournal: { apiId: 'ka10170', path: PATHS.acnt, korean: '당일매매일지요청', listKey: 'tdy_trde_diary' },
  dailyReturn: { apiId: 'kt00016', path: PATHS.acnt, korean: '일별계좌수익률상세현황요청' },

  // ── Order (주문) — WRITE, real money ──────────────────────────────────────
  buy: { apiId: 'kt10000', path: PATHS.ordr, korean: '주식 매수주문', isWrite: true },
  sell: { apiId: 'kt10001', path: PATHS.ordr, korean: '주식 매도주문', isWrite: true },
  modify: { apiId: 'kt10002', path: PATHS.ordr, korean: '주식 정정주문', isWrite: true },
  cancel: { apiId: 'kt10003', path: PATHS.ordr, korean: '주식 취소주문', isWrite: true },
  creditBuy: { apiId: 'kt10006', path: PATHS.crdordr, korean: '신용 매수주문', isWrite: true },
  creditSell: { apiId: 'kt10007', path: PATHS.crdordr, korean: '신용 매도주문', isWrite: true },
  creditModify: { apiId: 'kt10008', path: PATHS.crdordr, korean: '신용 정정주문', isWrite: true },
  creditCancel: { apiId: 'kt10009', path: PATHS.crdordr, korean: '신용 취소주문', isWrite: true },

  // ── Ranking (순위정보) ─────────────────────────────────────────────────────
  rankFluctuation: { apiId: 'ka10027', path: PATHS.rkinfo, korean: '전일대비등락률순위요청', listKey: 'pred_pre_flu_rt_upper' },
  rankVolume: { apiId: 'ka10030', path: PATHS.rkinfo, korean: '당일거래량상위요청', listKey: 'tdy_trde_qty_upper' },
  rankTradeAmount: { apiId: 'ka10032', path: PATHS.rkinfo, korean: '거래대금상위요청', listKey: 'trde_prica_upper' },
  rankVolumeSurge: { apiId: 'ka10023', path: PATHS.rkinfo, korean: '거래량급증요청', listKey: 'trde_qty_sdnin' },
  rankPrevVolume: { apiId: 'ka10031', path: PATHS.rkinfo, korean: '전일거래량상위요청', listKey: 'pred_trde_qty_upper' },

  // ── Sector / industry (업종) ───────────────────────────────────────────────
  sectorPrice: { apiId: 'ka20001', path: PATHS.sect, korean: '업종현재가요청', listKey: 'inds_cur_prc_tm' },
  sectorStocks: { apiId: 'ka20002', path: PATHS.sect, korean: '업종별주가요청', listKey: 'inds_stkpc' },
  sectorAllIndex: { apiId: 'ka20003', path: PATHS.sect, korean: '전업종지수요청', listKey: 'all_inds_idex' },
  sectorDaily: { apiId: 'ka20009', path: PATHS.sect, korean: '업종현재가 일별요청', listKey: 'inds_cur_prc_daly_rept' },
} satisfies Record<string, EndpointDef>;

export type EndpointKey = keyof typeof ENDPOINTS;

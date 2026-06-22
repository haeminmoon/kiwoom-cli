import { KiwoomClient } from '../../client/api-client';
import { KiwoomApiError, ActionableError } from '../../output/error';
import * as store from '../../config/store';

jest.mock('../../config/store', () => ({
  getCachedToken: jest.fn(),
  saveCachedToken: jest.fn(),
  clearCachedToken: jest.fn(),
}));

const mockedStore = store as jest.Mocked<typeof store>;

interface MockResp {
  ok?: boolean;
  status?: number;
  body: Record<string, any>;
  headers?: Record<string, string>;
}

function mockResponse({ ok = true, status = 200, body, headers = {} }: MockResp) {
  return {
    ok,
    status,
    json: async () => body,
    headers: { get: (k: string) => headers[k.toLowerCase()] ?? null },
  } as unknown as Response;
}

const fetchMock = jest.fn();
global.fetch = fetchMock as unknown as typeof fetch;

beforeEach(() => {
  fetchMock.mockReset();
  mockedStore.getCachedToken.mockReset();
  mockedStore.saveCachedToken.mockReset();
  mockedStore.clearCachedToken.mockReset();
});

function client() {
  return new KiwoomClient({ env: 'real', appkey: '3CZRL6abc', secretkey: 'sec' });
}

describe('issueToken', () => {
  it('returns token + expiry on success', async () => {
    fetchMock.mockResolvedValueOnce(
      mockResponse({ body: { return_code: 0, token: 'TKN', expires_dt: '20991231235959' } }),
    );
    const out = await client().issueToken();
    expect(out).toEqual({ token: 'TKN', expiresDt: '20991231235959' });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.kiwoom.com/oauth2/token');
    expect(JSON.parse(init.body).grant_type).toBe('client_credentials');
  });

  it('throws KiwoomApiError on failure', async () => {
    fetchMock.mockResolvedValueOnce(
      mockResponse({ body: { return_code: 2, return_msg: '입력 값 오류입니다' } }),
    );
    await expect(client().issueToken()).rejects.toThrow(KiwoomApiError);
  });

  it('requires keys', async () => {
    const c = new KiwoomClient({ env: 'real' });
    await expect(c.issueToken()).rejects.toThrow(ActionableError);
  });
});

describe('token caching via request', () => {
  it('reuses a valid cached token without issuing', async () => {
    mockedStore.getCachedToken.mockReturnValue({
      token: 'CACHED',
      expiresDt: '20991231235959',
      appkeyHint: '3CZRL6',
    });
    fetchMock.mockResolvedValueOnce(mockResponse({ body: { return_code: 0, stk_nm: '삼성전자' } }));

    const c = client();
    await c.request('ka10001', '/api/dostk/stkinfo', { stk_cd: '005930' });

    expect(fetchMock).toHaveBeenCalledTimes(1); // no token issuance
    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers.authorization).toBe('Bearer CACHED');
    expect(init.headers['api-id']).toBe('ka10001');
  });

  it('issues + caches a token when none is cached', async () => {
    mockedStore.getCachedToken.mockReturnValue(undefined);
    fetchMock
      .mockResolvedValueOnce(
        mockResponse({ body: { return_code: 0, token: 'NEW', expires_dt: '20991231235959' } }),
      )
      .mockResolvedValueOnce(mockResponse({ body: { return_code: 0 } }));

    await client().request('ka10001', '/api/dostk/stkinfo', {});

    expect(mockedStore.saveCachedToken).toHaveBeenCalledWith('real', {
      token: 'NEW',
      expiresDt: '20991231235959',
      appkeyHint: '3CZRL6',
    });
  });

  it('re-issues when the cached token belongs to a different appkey', async () => {
    mockedStore.getCachedToken.mockReturnValue({
      token: 'OLD',
      expiresDt: '20991231235959',
      appkeyHint: 'OTHER1',
    });
    fetchMock
      .mockResolvedValueOnce(
        mockResponse({ body: { return_code: 0, token: 'NEW', expires_dt: '20991231235959' } }),
      )
      .mockResolvedValueOnce(mockResponse({ body: { return_code: 0 } }));

    await client().request('ka10001', '/api/dostk/stkinfo', {});
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('uses an explicit token override and never caches', async () => {
    fetchMock.mockResolvedValueOnce(mockResponse({ body: { return_code: 0 } }));
    const c = new KiwoomClient({ env: 'real', token: 'OVERRIDE' });
    await c.request('ka10001', '/api/dostk/stkinfo', {});
    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers.authorization).toBe('Bearer OVERRIDE');
    expect(mockedStore.saveCachedToken).not.toHaveBeenCalled();
  });
});

describe('request', () => {
  beforeEach(() => {
    mockedStore.getCachedToken.mockReturnValue({
      token: 'CACHED',
      expiresDt: '20991231235959',
      appkeyHint: '3CZRL6',
    });
  });

  it('returns data + pagination headers', async () => {
    fetchMock.mockResolvedValueOnce(
      mockResponse({
        body: { return_code: 0, stk_dt_pole_chart_qry: [{ dt: '20260622' }] },
        headers: { 'cont-yn': 'Y', 'next-key': 'CURSOR1' },
      }),
    );
    const out = await client().request('ka10081', '/api/dostk/chart', {});
    expect(out.contYn).toBe(true);
    expect(out.nextKey).toBe('CURSOR1');
    expect(out.data.stk_dt_pole_chart_qry).toHaveLength(1);
  });

  it('throws on non-zero return_code', async () => {
    fetchMock.mockResolvedValueOnce(
      mockResponse({ body: { return_code: 900, return_msg: '장종료' } }),
    );
    await expect(client().request('ka10001', '/api/dostk/stkinfo', {})).rejects.toThrow(
      /장종료/,
    );
  });

  it('treats return_code 20 (no data) as a soft-empty success', async () => {
    fetchMock.mockResolvedValueOnce(
      mockResponse({
        body: { return_code: 20, return_msg: '관련자료가없습니다', acnt_ord_cntr_prst: [] },
      }),
    );
    const out = await client().request('kt00009', '/api/dostk/acnt', {});
    expect(out.data.return_code).toBe(20);
    expect(out.data.acnt_ord_cntr_prst).toEqual([]);
  });

  it('retries once on HTTP 401', async () => {
    fetchMock
      .mockResolvedValueOnce(mockResponse({ ok: false, status: 401, body: {} }))
      .mockResolvedValueOnce(
        mockResponse({ body: { return_code: 0, token: 'NEW', expires_dt: '20991231235959' } }),
      )
      .mockResolvedValueOnce(mockResponse({ body: { return_code: 0, ok: 1 } }));

    const out = await client().request('ka10001', '/api/dostk/stkinfo', {});
    expect(mockedStore.clearCachedToken).toHaveBeenCalledWith('real');
    expect(out.data.return_code).toBe(0);
  });
});

describe('requestAll', () => {
  beforeEach(() => {
    mockedStore.getCachedToken.mockReturnValue({
      token: 'CACHED',
      expiresDt: '20991231235959',
      appkeyHint: '3CZRL6',
    });
  });

  it('concatenates pages until cont-yn is N', async () => {
    fetchMock
      .mockResolvedValueOnce(
        mockResponse({
          body: { return_code: 0, rows: [{ i: 1 }, { i: 2 }] },
          headers: { 'cont-yn': 'Y', 'next-key': 'K1' },
        }),
      )
      .mockResolvedValueOnce(
        mockResponse({
          body: { return_code: 0, rows: [{ i: 3 }] },
          headers: { 'cont-yn': 'N', 'next-key': '' },
        }),
      );

    const out = await client().requestAll<{ rows: { i: number }[] }>(
      'ka10081',
      '/api/dostk/chart',
      {},
      'rows',
    );
    expect(out.rows.map((r) => r.i)).toEqual([1, 2, 3]);
  });

  it('respects the maxPages cap', async () => {
    fetchMock.mockResolvedValue(
      mockResponse({
        body: { return_code: 0, rows: [{ i: 1 }] },
        headers: { 'cont-yn': 'Y', 'next-key': 'K' },
      }),
    );
    const out = await client().requestAll<{ rows: unknown[] }>(
      'ka10081',
      '/api/dostk/chart',
      {},
      'rows',
      3,
    );
    expect(out.rows).toHaveLength(3);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});

describe('callEndpoint', () => {
  beforeEach(() => {
    mockedStore.getCachedToken.mockReturnValue({
      token: 'CACHED',
      expiresDt: '20991231235959',
      appkeyHint: '3CZRL6',
    });
  });

  it('routes a single-page endpoint', async () => {
    fetchMock.mockResolvedValueOnce(
      mockResponse({ body: { return_code: 0, stk_nm: '삼성전자' } }),
    );
    const out = await client().callEndpoint(
      { apiId: 'ka10001', path: '/api/dostk/stkinfo', korean: '주식기본정보요청' },
      { stk_cd: '005930' },
    );
    expect(out.data.stk_nm).toBe('삼성전자');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.kiwoom.com/api/dostk/stkinfo');
    expect(init.headers['api-id']).toBe('ka10001');
  });

  it('paginates when paginate=true and a listKey is present', async () => {
    fetchMock
      .mockResolvedValueOnce(
        mockResponse({
          body: { return_code: 0, rows: [{ i: 1 }] },
          headers: { 'cont-yn': 'Y', 'next-key': 'K1' },
        }),
      )
      .mockResolvedValueOnce(
        mockResponse({ body: { return_code: 0, rows: [{ i: 2 }] }, headers: { 'cont-yn': 'N' } }),
      );
    const out = await client().callEndpoint<{ rows: { i: number }[] }>(
      { apiId: 'ka10081', path: '/api/dostk/chart', korean: 'x', listKey: 'rows' },
      {},
      { paginate: true },
    );
    expect(out.data.rows.map((r) => r.i)).toEqual([1, 2]);
  });
});

describe('revokeToken', () => {
  it('clears cache on success', async () => {
    fetchMock.mockResolvedValueOnce(
      mockResponse({ body: { return_code: 0, return_msg: 'ok' } }),
    );
    await client().revokeToken('TKN');
    expect(mockedStore.clearCachedToken).toHaveBeenCalledWith('real');
  });

  it('throws when no token available', async () => {
    mockedStore.getCachedToken.mockReturnValue(undefined);
    await expect(client().revokeToken()).rejects.toThrow(ActionableError);
  });
});

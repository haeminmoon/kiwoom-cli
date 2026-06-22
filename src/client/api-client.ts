import {
  BASE_URLS,
  TOKEN_PATH,
  REVOKE_PATH,
  TOKEN_REFRESH_BUFFER_MS,
  REQUEST_TIMEOUT_MS,
  SOFT_EMPTY_RETURN_CODES,
  Environment,
} from '../config/constants';
import {
  getCachedToken,
  saveCachedToken,
  clearCachedToken,
} from '../config/store';
import { isTokenExpired } from '../utils/helpers';
import { KiwoomApiError, ActionableError } from '../output/error';
import { EndpointDef } from './endpoints';

/** Result of a TR request, with pagination metadata from the response headers. */
export interface TrResponse<T = Record<string, any>> {
  data: T;
  /** True when more pages are available (response header `cont-yn` === 'Y'). */
  contYn: boolean;
  /** Cursor to pass back as `next-key` to fetch the next page. */
  nextKey: string;
}

export interface RequestOptions {
  /** Pass 'Y' (with nextKey) to continue a paginated query. */
  contYn?: string;
  nextKey?: string;
  /** Override the api-id header (defaults to the one in the registry call). */
  apiId?: string;
}

export interface ClientOptions {
  env: Environment;
  appkey?: string;
  secretkey?: string;
  /** Explicit token; bypasses issuance/caching when provided. */
  token?: string;
}

function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  return fetch(url, { ...init, signal: controller.signal }).finally(() =>
    clearTimeout(timeoutId),
  );
}

/**
 * Kiwoom Securities REST API client.
 *
 * Handles OAuth2 token issuance + caching and routes every TR through a single
 * POST with the api-id header. Tokens are cached per environment on disk so
 * separate CLI invocations reuse them until expiry.
 */
export class KiwoomClient {
  private env: Environment;
  private baseUrl: string;
  private appkey?: string;
  private secretkey?: string;
  private tokenOverride?: string;
  private memoToken?: string;

  constructor(opts: ClientOptions) {
    this.env = opts.env;
    this.baseUrl = BASE_URLS[opts.env];
    if (!this.baseUrl) {
      throw new Error(`Invalid environment: ${opts.env}. Use: real, mock`);
    }
    this.appkey = opts.appkey;
    this.secretkey = opts.secretkey;
    this.tokenOverride = opts.token;
  }

  getEnv(): Environment {
    return this.env;
  }

  /** Ensure a valid token exists (issuing + caching as needed) and return it. */
  async authenticate(): Promise<string> {
    return this.getToken();
  }

  // ─── OAuth2 ───────────────────────────────────────────────────────────────

  /** Issue a fresh access token from the app key + secret key. */
  async issueToken(): Promise<{ token: string; expiresDt: string }> {
    if (!this.appkey || !this.secretkey) {
      throw new ActionableError(
        'App key and secret key are required to issue a token.',
        'kiwoom-cli config init',
      );
    }
    const res = await fetchWithTimeout(`${this.baseUrl}${TOKEN_PATH}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json;charset=UTF-8' },
      body: JSON.stringify({
        grant_type: 'client_credentials',
        appkey: this.appkey,
        secretkey: this.secretkey,
      }),
    });
    const body = (await res.json().catch(() => ({}))) as Record<string, any>;
    if (!res.ok || body.return_code !== 0 || !body.token) {
      throw new KiwoomApiError(
        body.return_code ?? res.status,
        body.return_msg ?? `Token request failed (HTTP ${res.status})`,
      );
    }
    return { token: body.token, expiresDt: body.expires_dt };
  }

  /** Revoke an access token (defaults to the cached/override token). */
  async revokeToken(token?: string): Promise<Record<string, any>> {
    if (!this.appkey || !this.secretkey) {
      throw new ActionableError(
        'App key and secret key are required to revoke a token.',
        'kiwoom-cli config init',
      );
    }
    const target = token ?? this.tokenOverride ?? getCachedToken(this.env)?.token;
    if (!target) {
      throw new ActionableError('No token to revoke.');
    }
    const res = await fetchWithTimeout(`${this.baseUrl}${REVOKE_PATH}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json;charset=UTF-8' },
      body: JSON.stringify({
        appkey: this.appkey,
        secretkey: this.secretkey,
        token: target,
      }),
    });
    const body = (await res.json().catch(() => ({}))) as Record<string, any>;
    if (!res.ok || body.return_code !== 0) {
      throw new KiwoomApiError(
        body.return_code ?? res.status,
        body.return_msg ?? `Token revoke failed (HTTP ${res.status})`,
      );
    }
    clearCachedToken(this.env);
    return body;
  }

  /**
   * Return a valid token, reusing the cache when possible and issuing+caching a
   * new one when missing or near expiry.
   */
  private async getToken(): Promise<string> {
    if (this.tokenOverride) return this.tokenOverride;
    if (this.memoToken) return this.memoToken;

    const cached = getCachedToken(this.env);
    const hint = this.appkey?.slice(0, 6);
    if (
      cached &&
      cached.appkeyHint === hint &&
      !isTokenExpired(cached.expiresDt, TOKEN_REFRESH_BUFFER_MS)
    ) {
      this.memoToken = cached.token;
      return cached.token;
    }

    const { token, expiresDt } = await this.issueToken();
    this.memoToken = token;
    if (hint) {
      saveCachedToken(this.env, { token, expiresDt, appkeyHint: hint });
    }
    return token;
  }

  // ─── Generic TR request ──────────────────────────────────────────────────

  /**
   * Execute a TR. `apiId` is sent in the api-id header; `path` is the category
   * route (e.g. /api/dostk/stkinfo). Returns the parsed body plus pagination.
   */
  async request<T = Record<string, any>>(
    apiId: string,
    path: string,
    body: Record<string, unknown> = {},
    options: RequestOptions = {},
  ): Promise<TrResponse<T>> {
    const send = async (token: string): Promise<Response> =>
      fetchWithTimeout(`${this.baseUrl}${path}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json;charset=UTF-8',
          authorization: `Bearer ${token}`,
          'api-id': options.apiId ?? apiId,
          'cont-yn': options.contYn ?? 'N',
          'next-key': options.nextKey ?? '',
        },
        body: JSON.stringify(body),
      });

    let res = await send(await this.getToken());

    // Token might have been revoked/expired server-side: clear and retry once.
    if (res.status === 401 && !this.tokenOverride) {
      clearCachedToken(this.env);
      this.memoToken = undefined;
      res = await send(await this.getToken());
    }

    const payload = (await res.json().catch(() => ({}))) as Record<string, any>;
    if (!res.ok) {
      throw new KiwoomApiError(
        payload.return_code ?? res.status,
        payload.return_msg ?? `Request failed (HTTP ${res.status})`,
        apiId,
      );
    }
    if (
      typeof payload.return_code === 'number' &&
      payload.return_code !== 0 &&
      !SOFT_EMPTY_RETURN_CODES.has(payload.return_code)
    ) {
      throw new KiwoomApiError(payload.return_code, payload.return_msg ?? 'Error', apiId);
    }

    return {
      data: payload as T,
      contYn: res.headers.get('cont-yn') === 'Y',
      nextKey: res.headers.get('next-key') ?? '',
    };
  }

  /**
   * Execute an endpoint from the registry. When `paginate` is set and the
   * endpoint declares a listKey, all pages are fetched and concatenated.
   */
  async callEndpoint<T = Record<string, any>>(
    def: EndpointDef,
    body: Record<string, unknown> = {},
    opts: { paginate?: boolean; contYn?: string; nextKey?: string } = {},
  ): Promise<TrResponse<T>> {
    if (opts.paginate && def.listKey) {
      const data = await this.requestAll<T>(def.apiId, def.path, body, def.listKey);
      return { data, contYn: false, nextKey: '' };
    }
    return this.request<T>(def.apiId, def.path, body, {
      contYn: opts.contYn,
      nextKey: opts.nextKey,
    });
  }

  /**
   * Fetch all pages of a TR, concatenating the array under `listKey`.
   * Caps at `maxPages` to avoid runaway loops.
   */
  async requestAll<T = Record<string, any>>(
    apiId: string,
    path: string,
    body: Record<string, unknown>,
    listKey: string,
    maxPages = 20,
  ): Promise<T> {
    let page = await this.request<Record<string, any>>(apiId, path, body);
    const acc = Array.isArray(page.data[listKey]) ? [...page.data[listKey]] : [];
    let pages = 1;
    while (page.contYn && page.nextKey && pages < maxPages) {
      page = await this.request<Record<string, any>>(apiId, path, body, {
        contYn: 'Y',
        nextKey: page.nextKey,
      });
      if (Array.isArray(page.data[listKey])) acc.push(...page.data[listKey]);
      pages += 1;
    }
    return { ...page.data, [listKey]: acc } as T;
  }
}

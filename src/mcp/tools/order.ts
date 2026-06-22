import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { clientOrThrow, mcpJson, mcpText, withErrorHandling, currentEnv, tool } from '../helpers';
import { ENDPOINTS, EndpointDef } from '../../client/endpoints';
import { ORDER_TYPES, MARKET_ORDER_TYPES, ORDER_EXCHANGE_TYPES } from '../../config/constants';
import { normalizeStockCode } from '../../utils/helpers';

function resolveType(type: string | undefined, price: string | undefined) {
  const trde_tp = type ?? (price ? '0' : '3');
  if (!ORDER_TYPES[trde_tp]) {
    throw new Error(`Invalid order type ${trde_tp}. Known: ${Object.keys(ORDER_TYPES).join(', ')}`);
  }
  if (MARKET_ORDER_TYPES.has(trde_tp)) {
    if (price) throw new Error('Market orders must not include a price.');
    return { trde_tp, ord_uv: '' };
  }
  if (!price) throw new Error(`Order type ${trde_tp} requires a price.`);
  return { trde_tp, ord_uv: price };
}

export function registerOrderTools(server: McpServer): void {
  tool(
    server,
    'place_order',
    {
      description:
        'Place a buy or sell order. SAFETY: nothing is sent unless confirm=true; otherwise a preview is returned. On the "real" environment this trades REAL money. kt10000/kt10001 (or credit kt10006/kt10007).',
      inputSchema: {
        side: z.enum(['buy', 'sell']).describe('buy or sell'),
        code: z.string().describe('6-digit stock code'),
        qty: z.string().describe('Order quantity'),
        price: z.string().optional().describe('Limit price (won); omit for a market order'),
        type: z.string().optional().describe('Order type code trde_tp (default 0=limit / 3=market)'),
        condPrice: z.string().optional().describe('Trigger price for stop/conditional types (e.g. 28)'),
        exchange: z.enum(['KRX', 'NXT', 'SOR']).optional().describe('Exchange routing (default KRX)'),
        credit: z.boolean().optional().describe('Use a credit (margin) order'),
        creditDeal: z.enum(['33', '99']).optional().describe('Credit deal type (sell): 33=융자, 99=융자합'),
        loanDate: z.string().optional().describe('Credit loan date YYYYMMDD (some credit sells)'),
        confirm: z.boolean().optional().describe('Must be true to actually submit'),
      },
    },
    async ({ side, code, qty, price, type, condPrice, exchange, credit, creditDeal, loanDate, confirm }) =>
      withErrorHandling(async () => {
        const stk = normalizeStockCode(code);
        const { trde_tp, ord_uv } = resolveType(type, price);
        if (trde_tp === '28' && !condPrice) {
          throw new Error('Stop-limit orders (type 28) require condPrice.');
        }
        const ex = exchange ?? 'KRX';
        if (!ORDER_EXCHANGE_TYPES.includes(ex)) throw new Error(`Invalid exchange ${ex}`);
        const def: EndpointDef = credit
          ? side === 'buy'
            ? ENDPOINTS.creditBuy
            : ENDPOINTS.creditSell
          : side === 'buy'
            ? ENDPOINTS.buy
            : ENDPOINTS.sell;
        const body: Record<string, unknown> = {
          dmst_stex_tp: ex,
          stk_cd: stk,
          ord_qty: qty,
          ord_uv,
          trde_tp,
          cond_uv: condPrice ?? '',
        };
        if (credit && side === 'sell') {
          body.crd_deal_tp = creditDeal ?? '33';
          if (loanDate) body.crd_loan_dt = loanDate;
        }

        const preview = {
          willSubmit: confirm === true,
          env: currentEnv(),
          apiId: def.apiId,
          side,
          credit: Boolean(credit),
          stock: stk,
          qty,
          price: MARKET_ORDER_TYPES.has(trde_tp) ? 'MARKET' : ord_uv,
          orderType: `${trde_tp} (${ORDER_TYPES[trde_tp]})`,
          exchange: ex,
        };
        if (confirm !== true) {
          return mcpText(
            `PREVIEW ONLY — set confirm=true to submit.\n${JSON.stringify(preview, null, 2)}`,
          );
        }
        const { data } = await clientOrThrow().callEndpoint(def, body);
        return mcpJson({ submitted: true, ...preview, result: data });
      }),
  );

  tool(
    server,
    'modify_order',
    {
      description: 'Modify a resting order (new qty/price). Nothing is sent unless confirm=true. kt10002/kt10008.',
      inputSchema: {
        orderNo: z.string().describe('Original order number'),
        code: z.string().describe('6-digit stock code'),
        qty: z.string().describe('New quantity'),
        price: z.string().describe('New price'),
        condPrice: z.string().optional().describe('New trigger price for conditional/stop orders'),
        exchange: z.enum(['KRX', 'NXT', 'SOR']).optional().describe('Exchange (default KRX)'),
        credit: z.boolean().optional(),
        confirm: z.boolean().optional().describe('Must be true to actually submit'),
      },
    },
    async ({ orderNo, code, qty, price, condPrice, exchange, credit, confirm }) =>
      withErrorHandling(async () => {
        const stk = normalizeStockCode(code);
        const ex = exchange ?? 'KRX';
        const def = credit ? ENDPOINTS.creditModify : ENDPOINTS.modify;
        const body = {
          dmst_stex_tp: ex,
          orig_ord_no: orderNo,
          stk_cd: stk,
          mdfy_qty: qty,
          mdfy_uv: price,
          mdfy_cond_uv: condPrice ?? '',
        };
        const preview = { willSubmit: confirm === true, env: currentEnv(), apiId: def.apiId, orderNo, stock: stk, qty, price, exchange: ex };
        if (confirm !== true) {
          return mcpText(`PREVIEW ONLY — set confirm=true to submit.\n${JSON.stringify(preview, null, 2)}`);
        }
        const { data } = await clientOrThrow().callEndpoint(def, body);
        return mcpJson({ submitted: true, ...preview, result: data });
      }),
  );

  tool(
    server,
    'cancel_order',
    {
      description: 'Cancel a resting order (qty 0 = all). Nothing is sent unless confirm=true. kt10003/kt10009.',
      inputSchema: {
        orderNo: z.string().describe('Original order number'),
        code: z.string().describe('6-digit stock code'),
        qty: z.string().optional().describe('Quantity to cancel; 0 = all remaining (default 0)'),
        exchange: z.enum(['KRX', 'NXT', 'SOR']).optional().describe('Exchange (default KRX)'),
        credit: z.boolean().optional(),
        confirm: z.boolean().optional().describe('Must be true to actually submit'),
      },
    },
    async ({ orderNo, code, qty, exchange, credit, confirm }) =>
      withErrorHandling(async () => {
        const stk = normalizeStockCode(code);
        const ex = exchange ?? 'KRX';
        const def = credit ? ENDPOINTS.creditCancel : ENDPOINTS.cancel;
        const body = { dmst_stex_tp: ex, orig_ord_no: orderNo, stk_cd: stk, cncl_qty: qty ?? '0' };
        const preview = { willSubmit: confirm === true, env: currentEnv(), apiId: def.apiId, orderNo, stock: stk, qty: qty ?? '0 (all)', exchange: ex };
        if (confirm !== true) {
          return mcpText(`PREVIEW ONLY — set confirm=true to submit.\n${JSON.stringify(preview, null, 2)}`);
        }
        const { data } = await clientOrThrow().callEndpoint(def, body);
        return mcpJson({ submitted: true, ...preview, result: data });
      }),
  );
}

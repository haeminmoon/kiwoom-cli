import { Command } from 'commander';
import { createClient } from './_helpers';
import { prompt } from './config';
import { ENDPOINTS, EndpointDef } from '../client/endpoints';
import {
  ORDER_TYPES,
  MARKET_ORDER_TYPES,
  ORDER_EXCHANGE_TYPES,
  OrderExchangeType,
} from '../config/constants';
import { getEffectiveConfig } from '../config/store';
import { output, getOutputFormat } from '../output/formatter';
import { handleError, ActionableError } from '../output/error';
import { normalizeStockCode, parseIntStrict } from '../utils/helpers';

function resolveExchange(value: string | undefined): OrderExchangeType {
  const ex = (value ?? 'KRX').toUpperCase();
  if (!ORDER_EXCHANGE_TYPES.includes(ex as OrderExchangeType)) {
    throw new ActionableError(
      `Invalid exchange "${value}". Use one of: ${ORDER_EXCHANGE_TYPES.join(', ')}`,
    );
  }
  return ex as OrderExchangeType;
}

/**
 * Resolve trde_tp + ord_uv from --type/--price:
 *  - explicit --type wins;
 *  - else a --price implies limit (0), no price implies market (3).
 * Market types must carry an empty ord_uv; limit types require a price.
 */
function resolveOrderType(
  typeOpt: string | undefined,
  priceOpt: string | undefined,
): { trde_tp: string; ord_uv: string } {
  let trde_tp = typeOpt ?? (priceOpt ? '0' : '3');
  if (!ORDER_TYPES[trde_tp]) {
    throw new ActionableError(
      `Invalid order type "${trde_tp}". Known types: ${Object.entries(ORDER_TYPES)
        .map(([k, v]) => `${k}=${v}`)
        .join(', ')}`,
    );
  }
  const isMarket = MARKET_ORDER_TYPES.has(trde_tp);
  if (isMarket) {
    if (priceOpt) {
      throw new ActionableError('Market orders must not specify a price (--price).');
    }
    return { trde_tp, ord_uv: '' };
  }
  if (!priceOpt) {
    throw new ActionableError(
      `Order type ${trde_tp} (${ORDER_TYPES[trde_tp]}) requires --price.`,
    );
  }
  return { trde_tp, ord_uv: priceOpt };
}

async function confirm(summary: string, skip: boolean): Promise<boolean> {
  console.log(summary);
  if (skip) return true;
  const answer = await prompt('Proceed? (y/N): ');
  return /^y(es)?$/i.test(answer.trim());
}

async function submit(
  def: EndpointDef,
  body: Record<string, unknown>,
  outputFmt: { output?: string },
): Promise<void> {
  const client = createClient();
  const { data } = await client.callEndpoint(def, body);
  output(
    {
      orderNo: data.ord_no,
      exchange: data.dmst_stex_tp,
      message: data.return_msg,
    },
    getOutputFormat(outputFmt),
  );
}

export function registerOrderCommands(program: Command): void {
  const order = program
    .command('order')
    .description('Place / modify / cancel orders (REAL money on the "real" environment)');

  // order buy <code> <qty>
  order
    .command('buy <code> <qty>')
    .description('Place a buy order')
    .option('-p, --price <won>', 'Limit price; omit for a market order')
    .option('-t, --type <code>', 'Order type code (trde_tp); default 0=limit / 3=market')
    .option('--cond-price <won>', 'Trigger price for conditional/stop types (e.g. type 28)')
    .option('-x, --exchange <KRX|NXT|SOR>', 'Exchange routing', 'KRX')
    .option('--credit', 'Use a credit (margin) order')
    .option('-y, --yes', 'Skip the confirmation prompt')
    .option('-o, --output <format>', 'Output format (table/json)', 'table')
    .action((code, qty, options) => placeOrder('buy', code, qty, options).catch(handleError));

  // order sell <code> <qty>
  order
    .command('sell <code> <qty>')
    .description('Place a sell order')
    .option('-p, --price <won>', 'Limit price; omit for a market order')
    .option('-t, --type <code>', 'Order type code (trde_tp); default 0=limit / 3=market')
    .option('--cond-price <won>', 'Trigger price for conditional/stop types (e.g. type 28)')
    .option('-x, --exchange <KRX|NXT|SOR>', 'Exchange routing', 'KRX')
    .option('--credit', 'Use a credit (margin) order')
    .option('--credit-deal <code>', 'Credit deal type (신용거래구분): 33=융자, 99=융자합', '33')
    .option('--loan-date <yyyymmdd>', 'Credit loan date (required for some credit sells)')
    .option('-y, --yes', 'Skip the confirmation prompt')
    .option('-o, --output <format>', 'Output format (table/json)', 'table')
    .action((code, qty, options) => placeOrder('sell', code, qty, options).catch(handleError));

  // order modify <orderNo> <code> <qty> <price>
  order
    .command('modify <orderNo> <code> <qty> <price>')
    .description('Modify a resting order (new qty + price)')
    .option('--cond-price <won>', 'New trigger price for conditional/stop orders')
    .option('-x, --exchange <KRX|NXT|SOR>', 'Exchange routing (must match original)', 'KRX')
    .option('--credit', 'Modify a credit order')
    .option('-y, --yes', 'Skip the confirmation prompt')
    .option('-o, --output <format>', 'Output format (table/json)', 'table')
    .action(async (orderNo, code, qty, price, options) => {
      try {
        const stk = normalizeStockCode(code);
        parseIntStrict(qty, 'qty');
        parseIntStrict(price, 'price');
        const exchange = resolveExchange(options.exchange);
        const def = options.credit ? ENDPOINTS.creditModify : ENDPOINTS.modify;
        const body = {
          dmst_stex_tp: exchange,
          orig_ord_no: orderNo,
          stk_cd: stk,
          mdfy_qty: qty,
          mdfy_uv: price,
          mdfy_cond_uv: options.condPrice ?? '',
        };
        const ok = await confirm(
          `\nMODIFY ${options.credit ? '(credit) ' : ''}order ${orderNo} ${stk} → qty ${qty} @ ${price} [${exchange}] on ${getEffectiveConfig().env.toUpperCase()}`,
          options.yes,
        );
        if (!ok) {
          console.log('Cancelled.');
          return;
        }
        await submit(def, body, options);
      } catch (err) {
        handleError(err);
      }
    });

  // order cancel <orderNo> <code>
  order
    .command('cancel <orderNo> <code>')
    .description('Cancel a resting order')
    .option('-q, --qty <qty>', 'Quantity to cancel; 0 = all remaining', '0')
    .option('-x, --exchange <KRX|NXT|SOR>', 'Exchange routing (must match original)', 'KRX')
    .option('--credit', 'Cancel a credit order')
    .option('-y, --yes', 'Skip the confirmation prompt')
    .option('-o, --output <format>', 'Output format (table/json)', 'table')
    .action(async (orderNo, code, options) => {
      try {
        const stk = normalizeStockCode(code);
        parseIntStrict(options.qty, 'qty'); // '0' = all remaining
        const exchange = resolveExchange(options.exchange);
        const def = options.credit ? ENDPOINTS.creditCancel : ENDPOINTS.cancel;
        const body = {
          dmst_stex_tp: exchange,
          orig_ord_no: orderNo,
          stk_cd: stk,
          cncl_qty: options.qty,
        };
        const qtyLabel = options.qty === '0' ? 'ALL remaining' : options.qty;
        const ok = await confirm(
          `\nCANCEL ${options.credit ? '(credit) ' : ''}order ${orderNo} ${stk} → ${qtyLabel} [${exchange}] on ${getEffectiveConfig().env.toUpperCase()}`,
          options.yes,
        );
        if (!ok) {
          console.log('Cancelled.');
          return;
        }
        await submit(def, body, options);
      } catch (err) {
        handleError(err);
      }
    });
}

async function placeOrder(
  side: 'buy' | 'sell',
  code: string,
  qty: string,
  options: Record<string, any>,
): Promise<void> {
  const stk = normalizeStockCode(code);
  parseIntStrict(qty, 'qty');
  const exchange = resolveExchange(options.exchange);
  const { trde_tp, ord_uv } = resolveOrderType(options.type, options.price);

  const credit = Boolean(options.credit);
  const def = credit
    ? side === 'buy'
      ? ENDPOINTS.creditBuy
      : ENDPOINTS.creditSell
    : side === 'buy'
      ? ENDPOINTS.buy
      : ENDPOINTS.sell;

  const cond_uv = options.condPrice ?? '';
  // Stop-limit (type 28) requires a trigger price; cond_uv is otherwise optional.
  if (trde_tp === '28' && !cond_uv) {
    throw new ActionableError('Stop-limit orders (type 28) require --cond-price <trigger>.');
  }
  const body: Record<string, unknown> = {
    dmst_stex_tp: exchange,
    stk_cd: stk,
    ord_qty: qty,
    ord_uv,
    trde_tp,
    cond_uv,
  };
  if (credit && side === 'sell') {
    body.crd_deal_tp = options.creditDeal ?? '33';
    if (options.loanDate) body.crd_loan_dt = options.loanDate;
  }

  const priceLabel = MARKET_ORDER_TYPES.has(trde_tp) ? 'MARKET' : `@ ${ord_uv}`;
  const env = getEffectiveConfig().env;
  const summary =
    `\n${side.toUpperCase()} ${credit ? '(credit) ' : ''}${stk}  qty ${qty}  ${priceLabel}` +
    `  type ${trde_tp}(${ORDER_TYPES[trde_tp]})  [${exchange}]  on ${env.toUpperCase()}` +
    (env === 'real' ? '  ⚠ REAL MONEY' : '');

  const ok = await confirm(summary, options.yes);
  if (!ok) {
    console.log('Cancelled.');
    return;
  }
  await submit(def, body, options);
}

// Exposed for unit testing the body-construction logic without network calls.
export const _internal = { resolveExchange, resolveOrderType };

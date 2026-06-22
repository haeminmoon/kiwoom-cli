import { unpad, formatStamp } from './format';

export interface BookLevel {
  level: number;
  price: string;
  qty: string;
}

export interface ParsedBook {
  baseTime: string;
  asks: BookLevel[]; // highest ask first (level 10 → 1)
  bids: BookLevel[]; // best bid first (level 1 → 10)
  totalAskQty: string;
  totalBidQty: string;
}

/**
 * Parse a ka10004 (주식호가요청) payload into ordered bid/ask levels.
 *
 * The field naming is irregular: level-1 quotes use the `*_fpr_*` (최우선)
 * keys, while levels 2–10 use `*_{N}th_pre_*`.
 */
export function parseOrderbook(d: Record<string, any>): ParsedBook {
  const asks: BookLevel[] = [];
  for (let n = 10; n >= 2; n--) {
    asks.push({
      level: n,
      price: unpad(d[`sel_${n}th_pre_bid`]),
      qty: unpad(d[`sel_${n}th_pre_req`]),
    });
  }
  asks.push({ level: 1, price: unpad(d.sel_fpr_bid), qty: unpad(d.sel_fpr_req) });

  const bids: BookLevel[] = [];
  bids.push({ level: 1, price: unpad(d.buy_fpr_bid), qty: unpad(d.buy_fpr_req) });
  for (let n = 2; n <= 10; n++) {
    bids.push({
      level: n,
      price: unpad(d[`buy_${n}th_pre_bid`]),
      qty: unpad(d[`buy_${n}th_pre_req`]),
    });
  }

  return {
    baseTime: formatStamp(d.bid_req_base_tm),
    asks,
    bids,
    totalAskQty: unpad(d.tot_sel_req),
    totalBidQty: unpad(d.tot_buy_req),
  };
}

/** Render a parsed book as a compact two-sided ladder for the terminal. */
export function renderOrderbook(book: ParsedBook, title: string): string {
  const lines: string[] = [];
  lines.push(`\n  Order Book: ${title}   (${book.baseTime})\n`);
  lines.push('  ── Asks ──');
  for (const a of book.asks) {
    lines.push(`  ${a.price.padStart(12)}  ${a.qty.padStart(12)}`);
  }
  lines.push('  ─────────');
  for (const b of book.bids) {
    lines.push(`  ${b.price.padStart(12)}  ${b.qty.padStart(12)}`);
  }
  lines.push('  ── Bids ──');
  lines.push(`\n  Total ask qty: ${book.totalAskQty}   Total bid qty: ${book.totalBidQty}\n`);
  return lines.join('\n');
}

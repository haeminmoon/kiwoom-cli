import { parseOrderbook, renderOrderbook } from '../../utils/orderbook';

// A trimmed ka10004-shaped payload with the irregular fpr/Nth naming.
const payload: Record<string, any> = {
  bid_req_base_tm: '135358',
  sel_fpr_bid: '-348500',
  sel_fpr_req: '9849',
  sel_2th_pre_bid: '-350500',
  sel_2th_pre_req: '18773',
  sel_10th_pre_bid: '+354500',
  sel_10th_pre_req: '10002',
  buy_fpr_bid: '-348000',
  buy_fpr_req: '15662',
  buy_2th_pre_bid: '-347500',
  buy_2th_pre_req: '19074',
  buy_10th_pre_bid: '-343500',
  buy_10th_pre_req: '24031',
  tot_sel_req: '97613',
  tot_buy_req: '396067',
};

describe('parseOrderbook', () => {
  const book = parseOrderbook(payload);

  it('orders asks from level 10 down to level 1', () => {
    expect(book.asks[0].level).toBe(10);
    expect(book.asks[book.asks.length - 1].level).toBe(1);
    expect(book.asks).toHaveLength(10);
  });

  it('orders bids from level 1 down to level 10', () => {
    expect(book.bids[0].level).toBe(1);
    expect(book.bids[book.bids.length - 1].level).toBe(10);
    expect(book.bids).toHaveLength(10);
  });

  it('maps the level-1 fpr fields and unpads signs', () => {
    expect(book.asks[9]).toEqual({ level: 1, price: '-348500', qty: '9849' });
    expect(book.bids[0]).toEqual({ level: 1, price: '-348000', qty: '15662' });
  });

  it('maps Nth_pre fields', () => {
    expect(book.bids[1]).toEqual({ level: 2, price: '-347500', qty: '19074' });
    expect(book.asks[0]).toEqual({ level: 10, price: '+354500', qty: '10002' });
  });

  it('exposes totals and base time', () => {
    expect(book.totalAskQty).toBe('97613');
    expect(book.totalBidQty).toBe('396067');
    expect(book.baseTime).toBe('13:53:58');
  });

  it('tolerates missing levels (empty strings)', () => {
    const sparse = parseOrderbook({ sel_fpr_bid: '-1', sel_fpr_req: '2' });
    expect(sparse.bids[0]).toEqual({ level: 1, price: '', qty: '' });
  });
});

describe('renderOrderbook', () => {
  it('renders a two-sided ladder with the title and totals', () => {
    const text = renderOrderbook(parseOrderbook(payload), '005930');
    expect(text).toContain('Order Book: 005930');
    expect(text).toContain('Asks');
    expect(text).toContain('Bids');
    expect(text).toContain('Total ask qty: 97613');
  });
});

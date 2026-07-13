import type { Exchange } from '../interfaces.js';
import { createPaperExchange } from '../paper/paper-exchange.js';
import { runExchangeContract } from './shared-contract.js';

runExchangeContract('paper', () => {
  const ex = createPaperExchange({
    balances: { IDR: 1_000_000_000, BTC: 0 },
    feeRate: 0.001,
  });
  ex.updatePrice('BTC/IDR', 100_000_000, 0);
  return ex as Exchange;
});

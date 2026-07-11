import type { Candle, Ticker, OrderBook, Trade } from '@trading/core';

export interface DatasetMetadata {
  exchange: string;
  pair: string;
  interval: string;
  timezone: string;
  source: string;
  start: number;
  end: number;
  candleCount: number;
  checksum: string;
  includes: {
    candles: boolean;
    ticker: boolean;
    orderbook: boolean;
    trades: boolean;
  };
}

export interface Dataset {
  metadata(): Promise<DatasetMetadata>;
  candles(): AsyncIterable<Candle>;
  ticker?(timestamp: number): Promise<Ticker>;
  orderbook?(timestamp: number): Promise<OrderBook | null>;
  trades?(timestamp: number): Promise<Trade[]>;
}

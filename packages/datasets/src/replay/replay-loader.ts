import type { Candle } from '@trading/core';
import type { Dataset } from '../interfaces.js';

export class ReplayLoader {
  private source: Dataset;
  private buffer: Candle[] = [];
  private loaded = false;
  private position = 0;

  constructor(source: Dataset) {
    this.source = source;
  }

  private async ensureLoaded(): Promise<void> {
    if (this.loaded) return;
    for await (const candle of this.source.candles()) {
      this.buffer.push(candle);
    }
    this.loaded = true;
  }

  async metadata() {
    return this.source.metadata();
  }

  async next(): Promise<Candle | null> {
    await this.ensureLoaded();
    if (this.position >= this.buffer.length) return null;
    return this.buffer[this.position++];
  }

  async peek(): Promise<Candle | null> {
    await this.ensureLoaded();
    if (this.position >= this.buffer.length) return null;
    return this.buffer[this.position];
  }

  async seek(timestamp: number): Promise<boolean> {
    await this.ensureLoaded();
    for (let i = this.position; i < this.buffer.length; i++) {
      if (this.buffer[i].timestamp >= timestamp) {
        this.position = i;
        return true;
      }
    }
    return false;
  }

  async skip(n: number): Promise<number> {
    await this.ensureLoaded();
    const skipped = Math.min(n, this.buffer.length - this.position);
    this.position += skipped;
    return skipped;
  }

  async rewind(): Promise<void> {
    this.position = 0;
  }

  get index(): number {
    return this.position;
  }

  get total(): number {
    return this.buffer.length;
  }

  get exhausted(): boolean {
    return this.position >= this.buffer.length;
  }

  async all(): Promise<Candle[]> {
    await this.ensureLoaded();
    return [...this.buffer];
  }
}

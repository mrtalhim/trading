import { describe, expect, it } from 'vitest';
import { ClockSync } from '../indodax/clock.js';

describe('ClockSync', () => {
  it('computes positive skew as serverTime - localNow and shifts now()', async () => {
    const localNow = () => 1_000_000;
    const sync = new ClockSync(async () => 1_005_000, localNow);
    const skew = await sync.sync();
    expect(skew).toBe(5_000);
    expect(sync.skewMs()).toBe(5_000);
    expect(sync.now()).toBe(1_000_000 + 5_000);
  });

  it('handles negative skew (local clock ahead)', async () => {
    const sync = new ClockSync(
      async () => 995_000,
      () => 1_000_000,
    );
    await sync.sync();
    expect(sync.skewMs()).toBe(-5_000);
    expect(sync.now()).toBe(995_000);
  });

  it('keeps the previous skew when a sync fails, without crashing', async () => {
    const sync = new ClockSync(
      async () => {
        throw new Error('boom');
      },
      () => 1_000_000,
    );
    await sync.sync();
    expect(sync.skewMs()).toBe(0);
    expect(sync.now()).toBe(1_000_000);
  });

  it('updates skew on a later successful sync', async () => {
    let serverTime = 1_005_000;
    const sync = new ClockSync(
      async () => serverTime,
      () => 1_000_000,
    );
    await sync.sync();
    serverTime = 1_010_000;
    await sync.sync();
    expect(sync.skewMs()).toBe(10_000);
  });
});

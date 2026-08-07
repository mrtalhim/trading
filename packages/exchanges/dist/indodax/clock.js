export class ClockSync {
    fetchServerTime;
    localNow;
    skew = 0;
    constructor(fetchServerTime, localNow = Date.now) {
        this.fetchServerTime = fetchServerTime;
        this.localNow = localNow;
    }
    async sync() {
        try {
            const serverTime = await this.fetchServerTime();
            this.skew = serverTime - this.localNow();
        }
        catch {
            // keep the previous skew; a failed sync must not halt the agent
        }
        return this.skew;
    }
    skewMs() {
        return this.skew;
    }
    now() {
        return this.localNow() + this.skew;
    }
}
//# sourceMappingURL=clock.js.map
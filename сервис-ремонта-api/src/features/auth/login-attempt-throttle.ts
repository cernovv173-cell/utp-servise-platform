import { createHash } from "node:crypto";

const FAILURE_WINDOW_MS = 15 * 60 * 1_000;
const MAX_TRACKED_IDENTIFIERS = 10_000;
const SLOWDOWN_AFTER_FAILURES = 4;
const INITIAL_DELAY_MS = 250;
const MAX_DELAY_MS = 5_000;

type FailureState = {
  readonly failures: number;
  readonly lastFailureAt: number;
};

export class LoginAttemptThrottle {
  private readonly failures = new Map<string, FailureState>();

  constructor(private readonly now: () => number = Date.now) {}

  delayBeforeAttempt(identifier: string): number {
    const key = this.key(identifier);
    const timestamp = this.now();
    const state = this.failures.get(key);
    if (!state) return 0;

    if (timestamp - state.lastFailureAt >= FAILURE_WINDOW_MS) {
      this.failures.delete(key);
      return 0;
    }

    this.failures.delete(key);
    this.failures.set(key, state);
    return this.delayFor(state.failures);
  }

  recordFailure(identifier: string): void {
    const key = this.key(identifier);
    const timestamp = this.now();
    const state = this.failures.get(key);
    const nextState: FailureState =
      !state || timestamp - state.lastFailureAt >= FAILURE_WINDOW_MS
        ? { failures: 1, lastFailureAt: timestamp }
        : { failures: state.failures + 1, lastFailureAt: timestamp };

    this.failures.delete(key);
    if (this.failures.size >= MAX_TRACKED_IDENTIFIERS) {
      for (const [trackedKey, trackedState] of this.failures) {
        if (timestamp - trackedState.lastFailureAt >= FAILURE_WINDOW_MS) {
          this.failures.delete(trackedKey);
        }
        if (this.failures.size < MAX_TRACKED_IDENTIFIERS) break;
      }
      if (this.failures.size >= MAX_TRACKED_IDENTIFIERS) {
        const oldestKey = this.failures.keys().next().value;
        if (oldestKey) this.failures.delete(oldestKey);
      }
    }
    this.failures.set(key, nextState);
  }

  clear(identifier: string): void {
    this.failures.delete(this.key(identifier));
  }

  private delayFor(failures: number): number {
    if (failures < SLOWDOWN_AFTER_FAILURES) return 0;

    const exponent = Math.min(failures - SLOWDOWN_AFTER_FAILURES, 5);
    return Math.min(INITIAL_DELAY_MS * 2 ** exponent, MAX_DELAY_MS);
  }

  private key(identifier: string): string {
    return createHash("sha256")
      .update(`login-attempt:v1:${identifier.trim().toLowerCase()}`)
      .digest("hex");
  }
}

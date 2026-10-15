import { describe, expect, it } from "vitest";

import {
  createDailyChallengeBoard,
  getDailyChallengeDayKey,
  hasDailyChallengeLine,
  isDailyChallengeMatch,
} from "./daily-challenge";

describe("daily match-three challenge", () => {
  it("uses the Moscow calendar date for its daily reset", () => {
    expect(getDailyChallengeDayKey(new Date("2026-10-15T20:30:00.000Z"))).toBe("2026-10-15");
    expect(getDailyChallengeDayKey(new Date("2026-10-15T21:30:00.000Z"))).toBe("2026-10-16");
  });

  it("creates a reproducible board with no free starting match and a valid solution", () => {
    const board = createDailyChallengeBoard("2026-10-15");

    expect(createDailyChallengeBoard("2026-10-15")).toEqual(board);
    expect(hasDailyChallengeLine(board)).toBe(false);
    expect(isDailyChallengeMatch(board, { row: 0, column: 1 }, { row: 1, column: 1 })).toBe(true);
  });

  it("rejects invalid or non-adjacent swaps", () => {
    const board = createDailyChallengeBoard("2026-10-15");

    expect(isDailyChallengeMatch(board, { row: 0, column: 0 }, { row: 2, column: 0 })).toBe(false);
    expect(isDailyChallengeMatch(board, { row: -1, column: 0 }, { row: 0, column: 0 })).toBe(false);
  });
});

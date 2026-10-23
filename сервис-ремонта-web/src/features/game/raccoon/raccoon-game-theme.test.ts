import { describe, expect, it } from "vitest";

import { getRaccoonChapter, getRaccoonMascot, raccoonChapters } from "./raccoon-game-theme";

describe("raccoon campaign theme", () => {
  it("defines all five 20-level chapters", () => {
    expect(raccoonChapters).toHaveLength(5);
    expect([1, 20, 21, 40, 41, 60, 61, 80, 81, 100].map(getRaccoonChapter)).toEqual([
      raccoonChapters[0],
      raccoonChapters[0],
      raccoonChapters[1],
      raccoonChapters[1],
      raccoonChapters[2],
      raccoonChapters[2],
      raccoonChapters[3],
      raccoonChapters[3],
      raccoonChapters[4],
      raccoonChapters[4],
    ]);
  });

  it("keeps the mascot outfit changes at the requested level boundaries", () => {
    expect([1, 30, 31, 70, 71, 100].map((level) => getRaccoonMascot(level).outfit)).toEqual([
      "Классический костюм инженера",
      "Классический костюм инженера",
      "Защитные очки и пояс с инструментами",
      "Защитные очки и пояс с инструментами",
      "Шлем и светящиеся детали",
      "Шлем и светящиеся детали",
    ]);
  });
});

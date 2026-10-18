import { randomInt } from "node:crypto";

export const selectRandomWinners = <T>(
  entries: readonly T[],
  count: number,
  chooseIndex: (maxExclusive: number) => number = randomInt,
): T[] => {
  if (!Number.isInteger(count) || count < 0) {
    throw new RangeError("Winner count must be a non-negative integer.");
  }
  if (count > entries.length) {
    throw new RangeError("Winner count cannot exceed the number of entries.");
  }

  const shuffled = [...entries];
  for (let index = 0; index < count; index += 1) {
    const selectedIndex = index + chooseIndex(shuffled.length - index);
    [shuffled[index], shuffled[selectedIndex]] = [
      shuffled[selectedIndex]!,
      shuffled[index]!,
    ];
  }
  return shuffled.slice(0, count);
};

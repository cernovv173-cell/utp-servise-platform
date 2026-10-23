import { PARTS, type PartCounts } from "./match-three.js";

export const createEmptyPartCounts = (): PartCounts =>
  Object.fromEntries(
    [...PARTS, "gold", "crate", "circuit"].map((part) => [part, 0]),
  );

export const sumPartCounts = (counts: PartCounts): number =>
  Object.values(counts).reduce((sum, count) => sum + (count ?? 0), 0);

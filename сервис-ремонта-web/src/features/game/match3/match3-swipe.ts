import type { Match3Position } from "./game-api";

export const getMatch3SwipeMove = (
  from: Match3Position,
  to: Match3Position,
  deltaX: number,
  deltaY: number,
  minimumDistance = 24,
) => {
  if (
    !Number.isFinite(deltaX) ||
    !Number.isFinite(deltaY) ||
    Math.hypot(deltaX, deltaY) < minimumDistance ||
    Math.abs(from.row - to.row) + Math.abs(from.column - to.column) !== 1
  ) {
    return null;
  }

  return { from, to };
};

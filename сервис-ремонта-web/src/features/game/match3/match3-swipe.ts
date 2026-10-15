import type { Match3Position } from "./game-api";

export const getMatch3SwipeMove = (
  from: Match3Position,
  deltaX: number,
  deltaY: number,
  minimumDistance = 24,
) => {
  const horizontalDistance = Math.abs(deltaX);
  const verticalDistance = Math.abs(deltaY);
  const isHorizontal = horizontalDistance >= verticalDistance * 1.25;
  const isVertical = verticalDistance >= horizontalDistance * 1.25;

  if (
    !Number.isFinite(deltaX) ||
    !Number.isFinite(deltaY) ||
    Math.hypot(deltaX, deltaY) < minimumDistance ||
    (!isHorizontal && !isVertical)
  ) {
    return null;
  }

  const to = isHorizontal
    ? { row: from.row, column: from.column + Math.sign(deltaX) }
    : { row: from.row + Math.sign(deltaY), column: from.column };

  return { from, to };
};

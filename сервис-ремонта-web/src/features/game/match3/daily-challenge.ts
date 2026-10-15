import type { Match3Board, Match3Position, Match3Tile } from "./game-api";

const tileKinds: NonNullable<Match3Tile["kind"]>[] = [
  "case",
  "motherboard",
  "processor",
  "cooling",
  "gpu",
  "ssd",
  "ram",
  "power",
];

const getSeed = (dayKey: string) =>
  Array.from(dayKey).reduce((seed, character) => (seed * 31 + character.charCodeAt(0)) >>> 0, 7);

export const getDailyChallengeDayKey = (date = new Date()) => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Moscow",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${value.year}-${value.month}-${value.day}`;
};

export const createDailyChallengeBoard = (dayKey: string): Match3Board => {
  const seed = getSeed(dayKey);
  const board = Array.from({ length: 8 }, (_, row) =>
    Array.from({ length: 8 }, (_, column): Match3Tile => ({
      kind: tileKinds[(seed + row + column) % tileKinds.length]!,
      frozen: false,
      junk: false,
      anomalyTurns: null,
    })),
  );
  const matchKind = board[0]![0]!.kind;
  board[0]![2] = { ...board[0]![2]!, kind: matchKind };
  board[1]![1] = { ...board[1]![1]!, kind: matchKind };
  return board;
};

export const hasDailyChallengeLine = (board: Match3Board) => {
  for (const line of board) {
    for (let index = 0; index <= line.length - 3; index += 1) {
      const kind = line[index]!.kind;
      if (kind && kind === line[index + 1]!.kind && kind === line[index + 2]!.kind) return true;
    }
  }

  for (let column = 0; column < (board[0]?.length ?? 0); column += 1) {
    for (let row = 0; row <= board.length - 3; row += 1) {
      const kind = board[row]![column]!.kind;
      if (
        kind &&
        kind === board[row + 1]![column]!.kind &&
        kind === board[row + 2]![column]!.kind
      ) {
        return true;
      }
    }
  }

  return false;
};

export const isDailyChallengeMatch = (
  sourceBoard: Match3Board,
  from: Match3Position,
  to: Match3Position,
) => {
  const adjacent = Math.abs(from.row - to.row) + Math.abs(from.column - to.column) === 1;
  const isInside = ({ row, column }: Match3Position) =>
    Number.isInteger(row) &&
    Number.isInteger(column) &&
    row >= 0 &&
    row < sourceBoard.length &&
    column >= 0 &&
    column < (sourceBoard[row]?.length ?? 0);
  if (!adjacent || !isInside(from) || !isInside(to)) return false;

  const board = sourceBoard.map((line) => line.map((tile) => ({ ...tile })));
  const first = board[from.row]![from.column]!;
  const second = board[to.row]![to.column]!;
  if (first.frozen || first.junk || second.frozen || second.junk || !first.kind || !second.kind) {
    return false;
  }

  board[from.row]![from.column] = second;
  board[to.row]![to.column] = first;
  return hasDailyChallengeLine(board);
};

const dailyCompletionKey = (userId: string) => `match3:daily-challenge-completion:v1:${userId}`;

export const isDailyChallengeComplete = (userId: string, dayKey: string) => {
  if (!userId) return false;
  try {
    return (
      typeof window !== "undefined" &&
      window.localStorage.getItem(dailyCompletionKey(userId)) === dayKey
    );
  } catch {
    return false;
  }
};

export const saveDailyChallengeCompletion = (userId: string, dayKey: string) => {
  if (!userId) return;
  try {
    window.localStorage.setItem(dailyCompletionKey(userId), dayKey);
  } catch {
    // The challenge remains complete for the current visit if browser storage is unavailable.
  }
};

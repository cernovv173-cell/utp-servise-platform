import type { Prisma } from "../../../generated/prisma/client.js";
import { HttpError } from "../../../lib/http/http-error.js";
import {
  getMatch3Chapter,
  getMatch3Part,
  getMatch3TargetPart,
} from "./match3-content.js";
import { isMatch3Board } from "./match3-engine.js";

export type Match3LevelRecord = {
  id: string;
  number: number;
  title: string;
  targetPart: string;
  targetCount: number;
  moveLimit: number;
  isActive: boolean;
};

export type Match3SessionRecord = {
  id: string;
  levelId: string;
  board: Prisma.JsonValue;
  targetCollected: number;
  movesUsed: number;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  completedAt: Date | null;
  level: Match3LevelRecord;
};

export const serializeMatch3Level = (level: Match3LevelRecord) => {
  const targetPart = getMatch3TargetPart(level.number);
  const part = getMatch3Part(targetPart);
  return {
    id: level.id,
    number: level.number,
    title: `Этап ${level.number} — ${part.name}`,
    targetPart,
    targetPartName: part.name,
    targetPartIcon: part.icon,
    targetCount: level.targetCount,
    moveLimit: level.moveLimit,
    chapter: getMatch3Chapter(level.number),
  };
};

export const serializeMatch3Session = (session: Match3SessionRecord) => {
  if (!isMatch3Board(session.board)) {
    throw new HttpError(
      500,
      "GAME_SESSION_INVALID",
      "Не удалось загрузить игровое поле.",
    );
  }
  return {
    id: session.id,
    board: session.board,
    targetCollected: session.targetCollected,
    movesUsed: session.movesUsed,
    status: session.status,
    completedAt: session.completedAt,
    level: serializeMatch3Level(session.level),
  };
};

import { apiRequest } from "@/lib/api";

import type { RaccoonCosmeticId } from "./raccoon-cosmetics";

export type Match3PartKey =
  "processor" | "ram" | "ssd" | "cooling" | "gpu" | "motherboard" | "power" | "case";

export type Match3Tile = {
  kind: Match3PartKey | null;
  frozen: boolean;
  junk: boolean;
  anomalyTurns: number | null;
};

export type Match3Position = { row: number; column: number };
export type Match3Board = Match3Tile[][];

export type Match3Chapter = {
  number: number;
  firstLevel: number;
  lastLevel: number;
  title: string;
  setting: string;
  description: string;
};

export type Match3Level = {
  id: string;
  number: number;
  title: string;
  targetPart: Match3PartKey;
  targetPartName: string;
  targetPartIcon: string;
  targetCount: number;
  moveLimit: number;
  chapter: Match3Chapter;
  isCompleted: boolean;
  isUnlocked: boolean;
  pointsAwarded: number;
};

export type Match3Session = {
  id: string;
  board: Match3Board;
  targetCollected: number;
  movesUsed: number;
  status: "ACTIVE" | "COMPLETE" | "FAILED";
  completedAt: string | null;
  level: Omit<Match3Level, "isCompleted" | "isUnlocked" | "pointsAwarded">;
};

export type Match3Progress = {
  levels: Match3Level[];
  completedCount: number;
  currentLevel: number | null;
  totalGamePoints: number;
  maximumGamePoints: number;
  activeSession: Match3Session | null;
};

export type Match3MoveResponse = {
  accepted: boolean;
  targetMatched?: number;
  obstaclesCleared?: number;
  obstaclesUnlocked?: number;
  pointsAwarded?: number;
  gameComplete?: boolean;
  session: Match3Session;
};

export type Match3CosmeticPreference = {
  selectedCosmeticId: RaccoonCosmeticId | null;
};

export const getMatch3Progress = (token: string, signal?: AbortSignal) =>
  apiRequest<Match3Progress>("/game/match3/progress", token, { signal });

export const getMatch3CosmeticPreference = (token: string, signal?: AbortSignal) =>
  apiRequest<Match3CosmeticPreference>("/game/match3/cosmetic", token, { signal });

export const initializeMatch3CosmeticPreference = (
  token: string,
  cosmeticId: RaccoonCosmeticId,
  signal?: AbortSignal,
) =>
  apiRequest<Match3CosmeticPreference>("/game/match3/cosmetic/initialize", token, {
    method: "POST",
    body: JSON.stringify({ cosmeticId }),
    signal,
  });

export const updateMatch3CosmeticPreference = (token: string, cosmeticId: RaccoonCosmeticId) =>
  apiRequest<Match3CosmeticPreference>("/game/match3/cosmetic", token, {
    method: "PUT",
    body: JSON.stringify({ cosmeticId }),
  });

export const startMatch3Level = (token: string) =>
  apiRequest<{ session: Match3Session }>("/game/match3/start", token, { method: "POST" });

export const makeMatch3Move = (
  token: string,
  input: { sessionId: string; from: Match3Position; to: Match3Position },
) =>
  apiRequest<Match3MoveResponse>("/game/match3/move", token, {
    method: "POST",
    body: JSON.stringify(input),
  });

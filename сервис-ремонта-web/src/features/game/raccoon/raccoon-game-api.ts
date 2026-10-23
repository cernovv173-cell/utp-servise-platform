import { apiRequest } from "@/lib/api";

export type RaccoonPart = "cpu" | "gpu" | "ram" | "ssd" | "board" | "fan" | "gold";
export type RaccoonObjective = RaccoonPart | "crate" | "circuit";
export type RaccoonBooster = "hammer" | "rocket" | "bomb";
export type RaccoonPosition = { row: number; column: number };
export type RaccoonBoard = (RaccoonPart | null)[][];
export type RaccoonCounts = Partial<Record<RaccoonObjective, number>>;
export type RaccoonObstacle = {
  kind: "crate" | "circuit";
  position: RaccoonPosition;
};

export type RaccoonSession = {
  id: string;
  level: number;
  status: "ACTIVE" | "COMPLETE" | "FAILED";
  board: RaccoonBoard;
  goals: RaccoonCounts;
  collected: RaccoonCounts;
  movesLeft: number;
  movesTotal: number;
  score: number;
  stars: number;
  obstacles: RaccoonObstacle[];
  conveyorRow: number | null;
  conveyorTurn: number;
  boosters: Record<RaccoonBooster, number>;
  electricShift: number;
  magnetCharges: number;
};

export type RaccoonProgress = {
  levels: {
    number: number;
    title: string;
    isCompleted: boolean;
    isUnlocked: boolean;
    pointsAwarded: number;
  }[];
  completedCount: number;
  currentLevel: number | null;
  totalGamePoints: number;
  pendingGamePoints: number;
  maximumGamePoints: number;
  pointsPerLevel: number;
  activeSession: RaccoonSession | null;
};

export const getRaccoonProgress = (token: string, signal?: AbortSignal) =>
  apiRequest<RaccoonProgress>("/game/raccoon/progress", token, { signal });

export const startRaccoonSession = (token: string, level?: number) =>
  apiRequest<{ session: RaccoonSession }>("/game/raccoon/start", token, {
    method: "POST",
    body: JSON.stringify(level ? { level } : {}),
  });

export const restartRaccoonSession = (token: string, sessionId: string) =>
  apiRequest<{ session: RaccoonSession }>("/game/raccoon/restart", token, {
    method: "POST",
    body: JSON.stringify({ sessionId }),
  });

export const moveRaccoonTile = (
  token: string,
  input: { sessionId: string; from: RaccoonPosition; to: RaccoonPosition },
) =>
  apiRequest<{ accepted: boolean; pointsAwarded?: number; session: RaccoonSession }>(
    "/game/raccoon/move",
    token,
    { method: "POST", body: JSON.stringify(input) },
  );

export const applyRaccoonBooster = (
  token: string,
  input: { sessionId: string; booster: RaccoonBooster; target: RaccoonPosition },
) =>
  apiRequest<{ accepted: boolean; pointsAwarded?: number; session: RaccoonSession }>(
    "/game/raccoon/booster",
    token,
    { method: "POST", body: JSON.stringify(input) },
  );

export const activateRaccoonMagnet = (token: string, sessionId: string) =>
  apiRequest<{ accepted: boolean; session: RaccoonSession }>("/game/raccoon/magnet", token, {
    method: "POST",
    body: JSON.stringify({ sessionId }),
  });

export const getRaccoonHint = (token: string, sessionId: string) =>
  apiRequest<{
    hint: { from: RaccoonPosition; to: RaccoonPosition } | null;
  }>("/game/raccoon/hint", token, {
    method: "POST",
    body: JSON.stringify({ sessionId }),
  });

export const claimRaccoonGameRewards = (token: string) =>
  apiRequest<{ claimedLevels: number; claimedPoints: number }>(
    "/game/match3/rewards/claim",
    token,
    { method: "POST" },
  );

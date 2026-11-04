import { randomBytes } from "node:crypto";

import type { DatabaseClient } from "../../lib/database/database.js";
import { hashSessionToken } from "./auth.middleware.js";

const SESSION_LIFETIME_MS = 14 * 24 * 60 * 60 * 1_000;

export const buildSession = (userId: string) => {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_LIFETIME_MS);
  return {
    accessToken: token,
    expiresAt,
    record: {
      tokenHash: hashSessionToken(token),
      userId,
      expiresAt,
    },
  };
};

export const createSession = async (
  database: DatabaseClient,
  userId: string,
) => {
  const session = buildSession(userId);
  await database.session.create({ data: session.record });
  return { accessToken: session.accessToken, expiresAt: session.expiresAt };
};

export const isUniqueViolation = (error: unknown): boolean =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  error.code === "P2002";

import { randomBytes } from "node:crypto";

import type { DatabaseClient } from "../../lib/database/database.js";
import { hashSessionToken } from "./auth.middleware.js";

const SESSION_LIFETIME_MS = 14 * 24 * 60 * 60 * 1_000;

export const createSession = async (
  database: DatabaseClient,
  userId: string,
) => {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_LIFETIME_MS);
  await database.session.create({
    data: { tokenHash: hashSessionToken(token), userId, expiresAt },
  });
  return { accessToken: token, expiresAt };
};

export const isUniqueViolation = (error: unknown): boolean =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  error.code === "P2002";

import express from "express";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { once } from "node:events";
import test from "node:test";

import { createPasswordResetRouter } from "../src/features/auth/password-reset.routes.js";
import {
  hashPassword,
  verifyPassword,
} from "../src/features/auth/passwords.js";
import type { DatabaseClient } from "../src/lib/database/database.js";
import { errorHandler } from "../src/lib/http/error-handler.js";

test("password reset emails a one-time token, changes the password and revokes sessions", async (t) => {
  const user = {
    id: "f8d491f0-1639-4ab9-a70f-90f0a88f0001",
    email: "customer@example.test",
    active: true,
    passwordHash: await hashPassword("Old-password-123"),
    mustChangePassword: true,
  };
  const resetTokens = new Map<
    string,
    {
      id: string;
      userId: string;
      tokenHash: string;
      expiresAt: Date;
    }
  >();
  let sentMessage:
    { to: string; resetUrl: string; messageId: string } | undefined;
  let deletedSessionsFor: string | undefined;
  let nextId = 0;
  const client = {
    user: {
      findUnique: async ({ where }: { where: { email: string } }) =>
        where.email === user.email ? user : null,
      update: async ({ data }: { data: Partial<typeof user> }) => {
        Object.assign(user, data);
        return user;
      },
    },
    passwordResetToken: {
      deleteMany: async ({
        where,
      }: {
        where: { userId?: string; tokenHash?: string; id?: string };
      }) => {
        let count = 0;
        for (const [key, token] of resetTokens) {
          if (
            (where.userId === undefined || token.userId === where.userId) &&
            (where.tokenHash === undefined ||
              token.tokenHash === where.tokenHash) &&
            (where.id === undefined || token.id === where.id)
          ) {
            resetTokens.delete(key);
            count += 1;
          }
        }
        return { count };
      },
      create: async ({
        data,
      }: {
        data: { userId: string; tokenHash: string; expiresAt: Date };
      }) => {
        const token = { ...data, id: `reset-${++nextId}` };
        resetTokens.set(token.tokenHash, token);
        return token;
      },
      findFirst: async ({
        where,
      }: {
        where: { tokenHash: string; expiresAt: { gt: Date } };
      }) => {
        const candidate = resetTokens.get(where.tokenHash);
        return candidate && candidate.expiresAt > where.expiresAt.gt
          ? candidate
          : null;
      },
    },
    session: {
      deleteMany: async ({ where }: { where: { userId: string } }) => {
        deletedSessionsFor = where.userId;
        return { count: 2 };
      },
    },
    $transaction: async <T>(work: (transaction: unknown) => Promise<T>) =>
      work(client),
  };
  const app = express();
  app.use(express.json());
  app.use(
    "/api",
    createPasswordResetRouter(client as unknown as DatabaseClient, {
      webAppOrigins: "https://service.example.test",
      sendEmail: async (message) => {
        sentMessage = message;
      },
    }),
  );
  app.use(errorHandler);
  const server = app.listen(0);
  await once(server, "listening");
  t.after(() => server.close());
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const baseUrl = `http://127.0.0.1:${address.port}/api/auth/password-reset`;

  const missingAccount = await fetch(`${baseUrl}/request`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "unknown@example.test" }),
  });
  assert.equal(missingAccount.status, 202);
  assert.deepEqual(await missingAccount.json(), {
    message:
      "Если аккаунт с таким адресом существует, мы отправили письмо с инструкциями.",
  });
  assert.equal(sentMessage, undefined);

  const requested = await fetch(`${baseUrl}/request`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "https://service.example.test",
    },
    body: JSON.stringify({ email: user.email }),
  });
  assert.equal(requested.status, 202);
  assert.equal(
    requested.headers.get("content-type")?.includes("application/json"),
    true,
  );
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.ok(sentMessage);
  assert.equal(sentMessage.to, user.email);
  assert.equal(sentMessage.messageId.includes("password-reset-"), true);
  const resetUrl = new URL(sentMessage.resetUrl);
  assert.equal(resetUrl.origin, "https://service.example.test");
  assert.equal(resetUrl.pathname, "/reset-password");
  const token = new URLSearchParams(resetUrl.hash.slice(1)).get("token");
  assert.ok(token);
  assert.equal(resetTokens.size, 1);
  const tokenHash = createHash("sha256").update(token).digest("hex");
  assert.equal(resetTokens.has(tokenHash), true);
  assert.equal(resetTokens.has(token), false);

  const tooShort = await fetch(`${baseUrl}/confirm`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ token, newPassword: "short7" }),
  });
  assert.equal(tooShort.status, 400);

  const confirmed = await fetch(`${baseUrl}/confirm`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ token, newPassword: "New-password-8" }),
  });
  assert.equal(confirmed.status, 200);
  assert.equal(await verifyPassword("New-password-8", user.passwordHash), true);
  assert.equal(user.mustChangePassword, false);
  assert.equal(deletedSessionsFor, user.id);
  assert.equal(resetTokens.size, 0);

  const reused = await fetch(`${baseUrl}/confirm`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ token, newPassword: "Another-password-8" }),
  });
  assert.equal(reused.status, 400);
  assert.equal(await verifyPassword("New-password-8", user.passwordHash), true);
});

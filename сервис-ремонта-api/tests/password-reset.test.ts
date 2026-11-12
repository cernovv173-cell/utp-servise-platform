import express from "express";
import assert from "node:assert/strict";
import { createHash, createHmac } from "node:crypto";
import { once } from "node:events";
import test from "node:test";

import { createPasswordResetRouter } from "../src/features/auth/password-reset.routes.js";
import {
  hashPassword,
  verifyPassword,
} from "../src/features/auth/passwords.js";
import type { DatabaseClient } from "../src/lib/database/database.js";
import { errorHandler } from "../src/lib/http/error-handler.js";

test("password reset sends a one-time code to email and linked MAX", async (t) => {
  const user = {
    id: "f8d491f0-1639-4ab9-a70f-90f0a88f0001",
    email: "customer@example.test" as string | null,
    login: "a2b3c4d5",
    active: true,
    maxUserId: "123456789",
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
      failedAttempts: number;
    }
  >();
  let sentMessage:
    | { to: string; resetCode: string; resetUrl: string; messageId: string }
    | undefined;
  const maxMessages: { userId: string; text: string }[] = [];
  const codeSecret = "test-password-reset-code-secret-32-bytes";
  let deletedSessionsFor: string | undefined;
  let nextId = 0;
  const client = {
    user: {
      findFirst: async ({
        where,
      }: {
        where: { OR: { email?: string; login?: string }[] };
      }) =>
        where.OR.some(
          (item) =>
            (item.email !== undefined && item.email === user.email) ||
            (item.login !== undefined && item.login === user.login),
        )
          ? user
          : null,
      update: async ({ data }: { data: Partial<typeof user> }) => {
        Object.assign(user, data);
        return user;
      },
    },
    passwordResetToken: {
      deleteMany: async ({
        where,
      }: {
        where: {
          userId?: string;
          tokenHash?: string;
          id?: string;
          expiresAt?: { gt: Date };
          failedAttempts?: { lt: number };
        };
      }) => {
        let count = 0;
        for (const [key, token] of resetTokens) {
          if (
            (where.userId === undefined || token.userId === where.userId) &&
            (where.tokenHash === undefined ||
              token.tokenHash === where.tokenHash) &&
            (where.id === undefined || token.id === where.id) &&
            (where.expiresAt === undefined ||
              token.expiresAt > where.expiresAt.gt) &&
            (where.failedAttempts === undefined ||
              token.failedAttempts < where.failedAttempts.lt)
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
        data: {
          userId: string;
          tokenHash: string;
          expiresAt: Date;
          failedAttempts: number;
        };
      }) => {
        const token = { ...data, id: `reset-${++nextId}` };
        resetTokens.set(token.tokenHash, token);
        return token;
      },
      findFirst: async ({
        where,
      }: {
        where: {
          tokenHash?: string;
          userId?: string;
          expiresAt: { gt: Date };
        };
      }) => {
        const candidate = [...resetTokens.values()].find(
          (token) =>
            (where.tokenHash === undefined ||
              token.tokenHash === where.tokenHash) &&
            (where.userId === undefined || token.userId === where.userId),
        );
        return candidate && candidate.expiresAt > where.expiresAt.gt
          ? candidate
          : null;
      },
      updateMany: async ({
        where,
        data,
      }: {
        where: {
          id: string;
          expiresAt: { gt: Date };
          failedAttempts: { lt: number };
        };
        data: { failedAttempts: { increment: number } };
      }) => {
        const token = [...resetTokens.values()].find(
          (candidate) => candidate.id === where.id,
        );
        if (
          !token ||
          token.expiresAt <= where.expiresAt.gt ||
          token.failedAttempts >= where.failedAttempts.lt
        ) {
          return { count: 0 };
        }
        token.failedAttempts += data.failedAttempts.increment;
        return { count: 1 };
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
      codeSecret,
      sendEmail: async (message) => {
        sentMessage = message;
      },
      sendMaxMessage: async (userId, text) => {
        maxMessages.push({ userId, text });
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
      "Если аккаунт с такой почтой или логином существует, мы отправили инструкции по восстановлению.",
  });
  assert.equal(sentMessage, undefined);

  for (let index = 1; index < 5; index += 1) {
    const unknown = await fetch(`${baseUrl}/request`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: `unknown-${index}@example.test` }),
    });
    assert.equal(unknown.status, 202);
  }

  const legacyEmailRequest = await fetch(`${baseUrl}/request`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: user.email }),
  });
  assert.equal(legacyEmailRequest.status, 202);
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.ok(sentMessage);

  const requested = await fetch(`${baseUrl}/request`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "https://service.example.test",
    },
    body: JSON.stringify({ identifier: user.login.toUpperCase() }),
  });
  assert.equal(requested.status, 202);
  assert.equal(
    requested.headers.get("content-type")?.includes("application/json"),
    true,
  );
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.ok(sentMessage);
  assert.equal(sentMessage.to, user.email);
  assert.match(sentMessage.resetCode, /^\d{6}$/);
  assert.equal(sentMessage.messageId.includes("password-reset-"), true);
  const resetUrl = new URL(sentMessage.resetUrl);
  assert.equal(resetUrl.origin, "https://service.example.test");
  assert.equal(resetUrl.pathname, "/reset-password");
  assert.equal(resetUrl.hash, "");
  assert.equal(maxMessages.length, 2);
  assert.equal(maxMessages[1]?.userId, user.maxUserId);
  assert.ok(maxMessages[1]?.text.includes(sentMessage.resetCode));
  assert.ok(maxMessages[1]?.text.includes(sentMessage.resetUrl));
  assert.equal(resetTokens.size, 1);
  const tokenHash = createHmac("sha256", codeSecret)
    .update(`password-reset-code:v1:${user.id}:${sentMessage.resetCode}`)
    .digest("hex");
  assert.equal(resetTokens.has(tokenHash), true);
  assert.equal(resetTokens.has(sentMessage.resetCode), false);

  const tooShort = await fetch(`${baseUrl}/confirm`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      identifier: user.login,
      code: sentMessage.resetCode,
      newPassword: "short7",
    }),
  });
  assert.equal(tooShort.status, 400);

  const wrongCode = sentMessage.resetCode === "000000" ? "000001" : "000000";
  const wrongCodeResponse = await fetch(`${baseUrl}/confirm`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      email: user.email,
      code: wrongCode,
      newPassword: "New-password-8",
    }),
  });
  assert.equal(wrongCodeResponse.status, 400);
  assert.equal([...resetTokens.values()][0]?.failedAttempts, 1);

  const confirmed = await fetch(`${baseUrl}/confirm`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      identifier: user.login,
      code: sentMessage.resetCode,
      newPassword: "New-password-8",
    }),
  });
  assert.equal(confirmed.status, 200);
  assert.equal(await verifyPassword("New-password-8", user.passwordHash), true);
  assert.equal(user.mustChangePassword, false);
  assert.equal(deletedSessionsFor, user.id);
  assert.equal(resetTokens.size, 0);

  const reused = await fetch(`${baseUrl}/confirm`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      identifier: user.login,
      code: sentMessage.resetCode,
      newPassword: "Another-password-8",
    }),
  });
  assert.equal(reused.status, 400);
  assert.equal(await verifyPassword("New-password-8", user.passwordHash), true);

  const legacyToken = "A".repeat(43);
  const legacyTokenHash = createHash("sha256")
    .update(legacyToken)
    .digest("hex");
  resetTokens.set(legacyTokenHash, {
    id: "legacy-reset",
    userId: user.id,
    tokenHash: legacyTokenHash,
    expiresAt: new Date(Date.now() + 60_000),
    failedAttempts: 0,
  });
  const legacyConfirm = await fetch(`${baseUrl}/confirm`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      token: legacyToken,
      newPassword: "Legacy-password-9",
    }),
  });
  assert.equal(legacyConfirm.status, 200);

  user.email = null;
  const maxOnlyRequest = await fetch(`${baseUrl}/request`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ identifier: user.login }),
  });
  assert.equal(maxOnlyRequest.status, 202);
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(maxMessages.length, 3);
  const maxOnlyCode = maxMessages[2]?.text.match(/\b\d{6}\b/u)?.[0];
  assert.ok(maxOnlyCode);
  const maxOnlyConfirmed = await fetch(`${baseUrl}/confirm`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      identifier: user.login,
      code: maxOnlyCode,
      newPassword: "Max-recovered-Password-10",
    }),
  });
  assert.equal(maxOnlyConfirmed.status, 200);
  assert.equal(
    await verifyPassword("Max-recovered-Password-10", user.passwordHash),
    true,
  );
  user.email = "customer@example.test";

  for (let index = 0; index < 3; index += 1) {
    const followUp = await fetch(`${baseUrl}/request`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ identifier: user.login }),
    });
    assert.equal(followUp.status, 202);
  }
  assert.ok(sentMessage);
  const finalCode = sentMessage.resetCode;
  const limited = await fetch(`${baseUrl}/request`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ identifier: user.login }),
  });
  assert.equal(limited.status, 429);
  assert.ok(Number(limited.headers.get("retry-after")) > 0);

  const incorrectCode = finalCode === "000000" ? "000001" : "000000";
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const rejected = await fetch(`${baseUrl}/confirm`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        identifier: user.login,
        code: incorrectCode,
        newPassword: "Locked-password-8",
      }),
    });
    assert.equal(rejected.status, 400);
  }
  assert.equal([...resetTokens.values()][0]?.failedAttempts, 5);
  const lockedCode = await fetch(`${baseUrl}/confirm`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      identifier: user.login,
      code: finalCode,
      newPassword: "Locked-password-8",
    }),
  });
  assert.equal(lockedCode.status, 400);
});

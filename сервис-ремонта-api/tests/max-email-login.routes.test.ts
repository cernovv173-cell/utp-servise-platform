import express from "express";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { once } from "node:events";
import test from "node:test";

import { hashSessionToken } from "../src/features/auth/auth.middleware.js";
import { createMaxEmailLoginRouter } from "../src/features/auth/max-email-login.routes.js";
import {
  hashPassword,
  verifyPassword,
} from "../src/features/auth/passwords.js";
import type { DatabaseClient } from "../src/lib/database/database.js";
import { errorHandler } from "../src/lib/http/error-handler.js";

test("MAX customer verifies a backup email and sets its password", async (t) => {
  const sessionToken = "M".repeat(48);
  const codeSecret = "test-max-email-login-code-secret-32-bytes";
  const user = {
    id: "11111111-1111-4111-8111-111111111111",
    email: null as string | null,
    displayName: "MAX customer",
    phoneNumber: "+79990000000",
    gender: null,
    birthDate: null,
    telegramChatId: null,
    maxUserId: "max-user-111",
    avatarObjectId: null,
    role: "CUSTOMER" as const,
    salaryRatePercent: 75,
    active: true,
    mustChangePassword: false,
    passwordHash: await hashPassword("random-initial-password"),
  };
  let challenge: {
    id: string;
    userId: string;
    email: string;
    codeHash: string;
    expiresAt: Date;
    failedAttempts: number;
    requestCount: number;
    requestWindowStartedAt: Date;
    requestedAt: Date;
  } | null = null;
  const reservedEmail = "taken@example.test";
  let sentEmail: { to: string; code: string; messageId: string } | undefined;

  const database = {
    session: {
      findUnique: async ({ where }: { where: { tokenHash: string } }) =>
        where.tokenHash === hashSessionToken(sessionToken)
          ? { expiresAt: new Date(Date.now() + 60_000), user }
          : null,
    },
    user: {
      findUnique: async ({
        where,
      }: {
        where: { id?: string; email?: string };
      }) => {
        if (where.id === user.id) return user;
        if (where.email === reservedEmail) return { id: "another-account" };
        return where.email && where.email === user.email ? user : null;
      },
      updateMany: async ({ data }: { data: Record<string, unknown> }) => {
        Object.assign(user, data);
        return { count: 1 };
      },
    },
    maxEmailLoginVerification: {
      findUnique: async () => challenge,
      create: async ({
        data,
      }: {
        data: Omit<NonNullable<typeof challenge>, "id">;
      }) => {
        challenge = { ...data, id: "challenge-1" };
        return challenge;
      },
      update: async ({ data }: { data: Record<string, unknown> }) => {
        const requestCount = data.requestCount as
          { increment: number } | number | undefined;
        Object.assign(challenge!, data);
        if (requestCount && typeof requestCount === "object") {
          challenge!.requestCount += requestCount.increment;
        }
        return challenge;
      },
      updateMany: async ({
        data,
      }: {
        data: { failedAttempts: { increment: number } };
      }) => {
        if (!challenge) return { count: 0 };
        challenge.failedAttempts += data.failedAttempts.increment;
        return { count: 1 };
      },
      deleteMany: async () => {
        challenge = null;
        return { count: 1 };
      },
    },
    passwordResetToken: { deleteMany: async () => ({ count: 0 }) },
    $executeRaw: async () => 1,
    $transaction: async <T>(work: (transaction: unknown) => Promise<T>) =>
      work(database),
  };

  const app = express();
  app.use(express.json());
  app.use(
    "/api",
    createMaxEmailLoginRouter(database as unknown as DatabaseClient, {
      codeSecret,
      sendEmail: async (message) => {
        sentEmail = message;
      },
    }),
  );
  app.use(errorHandler);
  const server = app.listen(0);
  await once(server, "listening");
  t.after(() => server.close());
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const baseUrl = `http://127.0.0.1:${address.port}/api/auth/profile/email-login`;
  const headers = {
    authorization: `Bearer ${sessionToken}`,
    "content-type": "application/json",
  };

  const requested = await fetch(`${baseUrl}/request`, {
    method: "POST",
    headers,
    body: JSON.stringify({ email: " MAX.Customer@Example.test " }),
  });
  assert.equal(requested.status, 202);
  assert.ok(sentEmail);
  assert.equal(sentEmail.to, "max.customer@example.test");
  assert.match(sentEmail.code, /^\d{6}$/);
  assert.equal(user.email, null, "an unverified address is not attached");
  assert.ok(challenge);
  assert.equal(challenge.email, sentEmail.to);
  assert.equal(
    challenge.codeHash,
    createHmac("sha256", codeSecret)
      .update(
        `max-email-login-verification:v1:${user.id}:${sentEmail.to}:${sentEmail.code}`,
      )
      .digest("hex"),
  );
  assert.notEqual(challenge.codeHash, sentEmail.code);

  const emailConflict = await fetch(`${baseUrl}/request`, {
    method: "POST",
    headers,
    body: JSON.stringify({ email: reservedEmail }),
  });
  assert.equal(emailConflict.status, 409);
  assert.equal((await emailConflict.json()).error.code, "EMAIL_IN_USE");
  assert.equal(sentEmail.to, "max.customer@example.test");

  const wrongCode = sentEmail.code === "000000" ? "000001" : "000000";
  const rejected = await fetch(`${baseUrl}/confirm`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      email: sentEmail.to,
      code: wrongCode,
      newPassword: "Backup-password-8",
    }),
  });
  assert.equal(rejected.status, 400);
  assert.equal(challenge.failedAttempts, 1);
  assert.equal(user.email, null);

  const confirmed = await fetch(`${baseUrl}/confirm`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      email: sentEmail.to,
      code: sentEmail.code,
      newPassword: "Backup-password-8",
    }),
  });
  assert.equal(confirmed.status, 200);
  const response = await confirmed.json();
  assert.equal(response.user.email, sentEmail.to);
  assert.equal(response.user.maxLinked, true);
  assert.equal(user.email, sentEmail.to);
  assert.equal(user.maxUserId, "max-user-111");
  assert.equal(user.mustChangePassword, false);
  assert.equal(
    await verifyPassword("Backup-password-8", user.passwordHash),
    true,
  );
  assert.equal(challenge, null);
});

test("email backup is restricted to customers who are currently linked to MAX", async (t) => {
  const sessionToken = "N".repeat(48);
  const user = {
    id: "22222222-2222-4222-8222-222222222222",
    email: null,
    displayName: "Unlinked customer",
    phoneNumber: "+79990000001",
    gender: null,
    birthDate: null,
    telegramChatId: null,
    maxUserId: null,
    avatarObjectId: null,
    role: "CUSTOMER" as const,
    salaryRatePercent: 75,
    active: true,
    mustChangePassword: false,
  };
  const database = {
    session: {
      findUnique: async () => ({
        expiresAt: new Date(Date.now() + 60_000),
        user,
      }),
    },
  };
  let emailSent = false;
  const app = express();
  app.use(express.json());
  app.use(
    "/api",
    createMaxEmailLoginRouter(database as unknown as DatabaseClient, {
      sendEmail: async () => {
        emailSent = true;
      },
    }),
  );
  app.use(errorHandler);
  const server = app.listen(0);
  await once(server, "listening");
  t.after(() => server.close());
  const address = server.address();
  assert.ok(address && typeof address !== "string");

  const response = await fetch(
    `http://127.0.0.1:${address.port}/api/auth/profile/email-login/request`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${sessionToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ email: "backup@example.test" }),
    },
  );
  assert.equal(response.status, 403);
  assert.equal((await response.json()).error.code, "MAX_ACCOUNT_REQUIRED");
  assert.equal(emailSent, false);
});

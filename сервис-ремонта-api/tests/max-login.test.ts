import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { test } from "node:test";

import {
  MAX_LOGIN_TTL_MILLISECONDS,
  hashMaxLoginToken,
  pollMaxLogin,
  startMaxLogin,
} from "../src/features/max/max-login.service.js";
import {
  extractMaxContactPhone,
  normalizeMaxPhone,
} from "../src/features/max/max-phone.js";
import {
  handleMaxBotStarted,
  handleMaxContact,
} from "../src/features/max/max-webhook.service.js";
import type { DatabaseClient } from "../src/lib/database/database.js";
import { mockMaxApiRequests } from "./helpers/mock-max-api.js";

const botToken = "test-token-only-not-a-live-credential";

const testUser = {
  id: "11111111-1111-4111-8111-111111111111",
  email: null,
  displayName: "Иван",
  phoneNumber: "+79990000000",
  gender: null,
  birthDate: null,
  telegramChatId: null,
  maxUserId: null,
  avatarObjectId: null,
  role: "CUSTOMER",
  salaryRatePercent: 75,
  active: true,
  mustChangePassword: false,
};

const withEnvironment = async (run: () => Promise<void>): Promise<void> => {
  const previous = {
    token: process.env.MAX_BOT_TOKEN,
    secret: process.env.MAX_WEBHOOK_SIGNING_SECRET,
    webhookUrl: process.env.MAX_WEBHOOK_URL,
  };
  process.env.MAX_BOT_TOKEN = botToken;
  process.env.MAX_WEBHOOK_SIGNING_SECRET = "test-webhook-secret";
  process.env.MAX_WEBHOOK_URL = "https://api.example.test/api/max/webhook";
  try {
    await run();
  } finally {
    if (previous.token === undefined) delete process.env.MAX_BOT_TOKEN;
    else process.env.MAX_BOT_TOKEN = previous.token;
    if (previous.secret === undefined) {
      delete process.env.MAX_WEBHOOK_SIGNING_SECRET;
    } else {
      process.env.MAX_WEBHOOK_SIGNING_SECRET = previous.secret;
    }
    if (previous.webhookUrl === undefined) delete process.env.MAX_WEBHOOK_URL;
    else process.env.MAX_WEBHOOK_URL = previous.webhookUrl;
  }
};

test("MAX phone normalization accepts common Russian formats", () => {
  assert.deepEqual(normalizeMaxPhone("8 (999) 000-00-00"), {
    phone: "+79990000000",
    nationalDigits: "9990000000",
  });
  assert.deepEqual(normalizeMaxPhone("+7 999 000-00-00"), {
    phone: "+79990000000",
    nationalDigits: "9990000000",
  });
  assert.deepEqual(normalizeMaxPhone("9990000000"), {
    phone: "+79990000000",
    nationalDigits: "9990000000",
  });
  assert.equal(normalizeMaxPhone("123"), null);
  assert.deepEqual(
    extractMaxContactPhone(
      "BEGIN:VCARD\r\nVERSION:3.0\r\nTEL;TYPE=cell:79990000000\r\nFN:Иван\r\nEND:VCARD\r\n",
    ),
    { phone: "+79990000000", nationalDigits: "9990000000" },
  );
});

test("MAX login creates a one-time session and expires the poll request", async () => {
  await withEnvironment(async () => {
    const maxApiMock = mockMaxApiRequests(() => ({
      body: { username: "service_bot" },
    }));
    const rows = new Map<string, Record<string, unknown>>();
    const sessions: Record<string, unknown>[] = [];
    const database = {
      maxLoginRequest: {
        deleteMany: async () => ({ count: 0 }),
        updateMany: async ({
          where,
          data,
        }: {
          where: { id?: string; status?: unknown };
          data: Record<string, unknown>;
        }) => {
          const row = [...rows.values()].find(
            (candidate) => !where.id || candidate.id === where.id,
          );
          if (!row) return { count: 0 };
          const expectedStatus = where.status;
          if (
            typeof expectedStatus === "string" &&
            row.status !== expectedStatus
          ) {
            return { count: 0 };
          }
          if (
            typeof expectedStatus === "object" &&
            expectedStatus !== null &&
            "in" in expectedStatus &&
            !(expectedStatus as { in: unknown[] }).in.includes(row.status)
          ) {
            return { count: 0 };
          }
          Object.assign(row, data);
          return { count: 1 };
        },
        create: async ({ data }: { data: Record<string, unknown> }) => {
          const row = {
            id: "22222222-2222-4222-8222-222222222222",
            status: "PENDING",
            userId: null,
            maxUserId: null,
            maxDisplayName: null,
            referralCode: null,
            accountCreated: false,
            referralApplied: false,
            failureCode: null,
            failureMessage: null,
            confirmedAt: null,
            consumedAt: null,
            ...data,
          };
          rows.set(String(data.pollTokenHash), row);
          return row;
        },
        findUnique: async ({ where }: { where: { pollTokenHash?: string } }) =>
          where.pollTokenHash ? (rows.get(where.pollTokenHash) ?? null) : null,
      },
      session: {
        create: async ({ data }: { data: Record<string, unknown> }) => {
          sessions.push(data);
          return data;
        },
      },
      user: {
        findUnique: async () => testUser,
      },
      $transaction: async (operation: unknown) =>
        typeof operation === "function"
          ? (operation as (transaction: unknown) => Promise<unknown>)(database)
          : Promise.all(operation as Promise<unknown>[]),
    };

    const started = await startMaxLogin(database as unknown as DatabaseClient);
    assert.equal(
      started.url.startsWith("https://max.ru/service_bot?start="),
      true,
    );
    const row = rows.get(hashMaxLoginToken(started.pollToken));
    assert.ok(row);
    assert.equal(row.status, "PENDING");
    assert.equal(row.referralCode, null);

    row.status = "CONFIRMED";
    row.userId = testUser.id;
    const first = await pollMaxLogin(
      database as unknown as DatabaseClient,
      started.pollToken,
    );
    assert.equal(first.status, "completed");
    if (first.status !== "completed") return;
    assert.equal(first.user.id, testUser.id);
    assert.equal(first.accessToken.length > 30, true);
    assert.equal(sessions.length, 1);

    await assert.rejects(
      pollMaxLogin(database as unknown as DatabaseClient, started.pollToken),
      (error: unknown) =>
        error instanceof Error &&
        "code" in error &&
        error.code === "MAX_LOGIN_ALREADY_COMPLETED",
    );
    maxApiMock.restore();
  });
});

test("admin activation MAX links are bound to the selected customer", async () => {
  await withEnvironment(async () => {
    const maxApiMock = mockMaxApiRequests(() => ({
      body: { username: "service_bot" },
    }));
    const targetUserId = "44444444-4444-4444-8444-444444444444";
    let createdRequest: Record<string, unknown> | undefined;
    const database = {
      maxLoginRequest: {
        deleteMany: async () => ({ count: 0 }),
        updateMany: async () => ({ count: 0 }),
        create: async ({ data }: { data: Record<string, unknown> }) => {
          createdRequest = data;
          return data;
        },
      },
      $transaction: async (operations: Promise<unknown>[]) =>
        Promise.all(operations),
    };

    try {
      const started = await startMaxLogin(
        database as unknown as DatabaseClient,
        undefined,
        targetUserId,
      );

      assert.equal(createdRequest?.userId, targetUserId);
      assert.equal(
        createdRequest?.tokenHash,
        hashMaxLoginToken(decodeURIComponent(started.url.split("?start=")[1]!)),
      );
      assert.equal(
        started.url.startsWith("https://max.ru/service_bot?start="),
        true,
      );
    } finally {
      maxApiMock.restore();
    }
  });
});

test("bot_started confirms an already linked customer without a phone request", async () => {
  await withEnvironment(async () => {
    const maxApiMock = mockMaxApiRequests(() => ({ body: { message: {} } }));
    const request = {
      id: "33333333-3333-4333-8333-333333333333",
      tokenHash: hashMaxLoginToken("start-token"),
      status: "PENDING",
      userId: null as string | null,
      maxUserId: null as string | null,
      expiresAt: new Date(Date.now() + 60_000),
    };
    const database = {
      maxLoginRequest: {
        findUnique: async ({ where }: { where: { tokenHash: string } }) =>
          where.tokenHash === request.tokenHash ? request : null,
        updateMany: async ({ data }: { data: Record<string, unknown> }) => {
          Object.assign(request, data);
          return { count: 1 };
        },
      },
      user: {
        findUnique: async ({ where }: { where: { maxUserId?: string } }) =>
          where.maxUserId
            ? { id: testUser.id, role: "CUSTOMER", active: true }
            : testUser,
      },
      $transaction: async (operation: unknown) =>
        typeof operation === "function"
          ? (operation as (transaction: unknown) => Promise<unknown>)(database)
          : Promise.all(operation as Promise<unknown>[]),
    };

    await handleMaxBotStarted(database as unknown as DatabaseClient, {
      payload: "start-token",
      user: { id: "987654321", name: "Иван" },
    });

    assert.equal(request.status, "CONFIRMED");
    assert.equal(request.userId, testUser.id);
    assert.equal(request.maxUserId, "987654321");
    assert.equal(maxApiMock.requests.length, 1);
    assert.equal(maxApiMock.requests[0]?.method, "POST");
    maxApiMock.restore();
  });
});

test("a verified contact links an existing customer by phone", async () => {
  await withEnvironment(async () => {
    const maxApiMock = mockMaxApiRequests(() => ({ body: { message: {} } }));
    const vcfInfo = [
      "BEGIN:VCARD",
      "VERSION:3.0",
      "TEL;TYPE=cell:79990000000",
      "FN:Иван",
      "END:VCARD",
      "",
    ].join("\r\n");
    const hash = createHmac("sha256", botToken).update(vcfInfo).digest("hex");
    const request = {
      id: "44444444-4444-4444-8444-444444444444",
      status: "AWAITING_CONTACT",
      userId: null as string | null,
      maxUserId: "987654321",
      maxDisplayName: "Иван",
      referralCode: null,
      expiresAt: new Date(Date.now() + 60_000),
      createdAt: new Date(),
    };
    const updatedUsers: Record<string, unknown>[] = [];
    const database = {
      maxLoginRequest: {
        findFirst: async () => request,
        updateMany: async ({ data }: { data: Record<string, unknown> }) => {
          Object.assign(request, data);
          return { count: 1 };
        },
        update: async ({ data }: { data: Record<string, unknown> }) => {
          Object.assign(request, data);
          return request;
        },
      },
      user: {
        findUnique: async () => null,
        update: async ({ data }: { data: Record<string, unknown> }) => {
          updatedUsers.push(data);
          return { id: testUser.id };
        },
      },
      $queryRaw: async () => [
        {
          id: testUser.id,
          active: true,
          maxUserId: null,
          phoneNumber: null,
        },
      ],
      $transaction: async (operation: unknown) =>
        typeof operation === "function"
          ? (operation as (transaction: unknown) => Promise<unknown>)(database)
          : Promise.all(operation as Promise<unknown>[]),
    };

    await handleMaxContact(database as unknown as DatabaseClient, {
      user: { id: "987654321", name: "Иван" },
      vcfInfo,
      hash,
    });

    assert.equal(request.status, "CONFIRMED");
    assert.equal(request.userId, testUser.id);
    assert.deepEqual(updatedUsers, [
      { maxUserId: "987654321", phoneNumber: "+79990000000" },
    ]);
    assert.equal(maxApiMock.requests.length, 1);
    maxApiMock.restore();
  });
});

test("a newly registered MAX customer receives the welcome message", async () => {
  await withEnvironment(async () => {
    const maxApiMock = mockMaxApiRequests(() => ({ body: { message: {} } }));
    const vcfInfo = [
      "BEGIN:VCARD",
      "VERSION:3.0",
      "TEL;TYPE=cell:79990000000",
      "FN:Иван",
      "END:VCARD",
      "",
    ].join("\r\n");
    const hash = createHmac("sha256", botToken).update(vcfInfo).digest("hex");
    const request = {
      id: "55555555-5555-4555-8555-555555555555",
      status: "AWAITING_CONTACT",
      userId: null as string | null,
      maxUserId: "987654321",
      maxDisplayName: "Иван",
      referralCode: null,
      expiresAt: new Date(Date.now() + 60_000),
      createdAt: new Date(),
    };
    const createdUser = {
      ...testUser,
      id: "66666666-6666-4666-8666-666666666666",
      displayName: "Иван",
      phoneNumber: "+79990000000",
      maxUserId: "987654321",
    };
    const database = {
      maxLoginRequest: {
        findFirst: async () => request,
        updateMany: async ({ data }: { data: Record<string, unknown> }) => {
          Object.assign(request, data);
          return { count: 1 };
        },
        update: async ({ data }: { data: Record<string, unknown> }) => {
          Object.assign(request, data);
          return request;
        },
      },
      user: {
        findUnique: async () => null,
        create: async () => createdUser,
      },
      customerReferralCode: {},
      customerReferral: {},
      $queryRaw: async () => [],
      $transaction: async (operation: unknown) =>
        typeof operation === "function"
          ? (operation as (transaction: unknown) => Promise<unknown>)(database)
          : Promise.all(operation as Promise<unknown>[]),
    };

    await handleMaxContact(database as unknown as DatabaseClient, {
      user: { id: "987654321", name: "Иван" },
      vcfInfo,
      hash,
    });

    assert.equal(request.accountCreated, true);
    assert.equal(request.userId, createdUser.id);
    assert.equal(maxApiMock.requests.length, 1);
    assert.match(maxApiMock.requests[0]!.body, /Спасибо что выбрали нас!/u);
    maxApiMock.restore();
  });
});

test("MAX login request lifetime is ten minutes", () => {
  assert.equal(MAX_LOGIN_TTL_MILLISECONDS, 10 * 60 * 1_000);
});

import { createHash, randomBytes } from "node:crypto";

import type { Prisma } from "../../generated/prisma/client.js";
import type { DatabaseClient } from "../../lib/database/database.js";
import { HttpError } from "../../lib/http/http-error.js";
import { publicUser } from "../auth/auth.middleware.js";
import { buildSession } from "../auth/session.js";
import { getMaxBotProfile } from "./max-bot.js";

export const MAX_LOGIN_TTL_MILLISECONDS = 10 * 60 * 1_000;
const EXPIRED_REQUEST_RETENTION_MILLISECONDS = 24 * 60 * 60 * 1_000;

export const MAX_LOGIN_EXPIRED_MESSAGE =
  "Ссылка для входа устарела. Вернитесь на сайт или в приложение и попробуйте снова.";

export type MaxLoginPollResult =
  | {
      readonly status: "pending" | "awaiting_contact";
      readonly expiresAt: string;
    }
  | { readonly status: "failed" | "expired"; readonly message: string }
  | {
      readonly status: "completed";
      readonly accessToken: string;
      readonly expiresAt: string;
      readonly accountCreated: boolean;
      readonly referralApplied: boolean;
      readonly user: ReturnType<typeof publicUser>;
    };

export const hashMaxLoginToken = (value: string): string =>
  createHash("sha256").update(value).digest("hex");

const maxLoginUnavailable = () =>
  new HttpError(
    503,
    "MAX_UNAVAILABLE",
    "Вход через МАКС временно недоступен. Попробуйте позже или войдите по почте.",
  );

export const startMaxLogin = async (
  database: DatabaseClient,
  referralCode?: string,
  targetUserId?: string,
  expectedRole:
    "CUSTOMER" | "TECHNICIAN" | "ADMIN" | "PROCUREMENT" = "CUSTOMER",
): Promise<{
  readonly url: string;
  readonly pollToken: string;
  readonly expiresAt: string;
}> => {
  let bot: Awaited<ReturnType<typeof getMaxBotProfile>>;
  try {
    bot = await getMaxBotProfile();
  } catch {
    throw maxLoginUnavailable();
  }

  const token = randomBytes(32).toString("base64url");
  const pollToken = randomBytes(32).toString("base64url");
  const now = new Date();
  const expiresAt = new Date(now.getTime() + MAX_LOGIN_TTL_MILLISECONDS);

  await database.$transaction([
    database.maxLoginRequest.deleteMany({
      where: {
        createdAt: {
          lt: new Date(now.getTime() - EXPIRED_REQUEST_RETENTION_MILLISECONDS),
        },
      },
    }),
    database.maxLoginRequest.updateMany({
      where: {
        status: { in: ["PENDING", "AWAITING_CONTACT", "CONFIRMED"] },
        expiresAt: { lte: now },
      },
      data: {
        status: "FAILED",
        failureCode: "MAX_LOGIN_EXPIRED",
        failureMessage: MAX_LOGIN_EXPIRED_MESSAGE,
      },
    }),
    database.maxLoginRequest.create({
      data: {
        tokenHash: hashMaxLoginToken(token),
        pollTokenHash: hashMaxLoginToken(pollToken),
        referralCode: referralCode ?? null,
        expectedRole,
        ...(targetUserId ? { userId: targetUserId } : {}),
        expiresAt,
      },
    }),
  ]);

  return {
    url: `https://max.ru/${bot.username}?start=${encodeURIComponent(token)}`,
    pollToken,
    expiresAt: expiresAt.toISOString(),
  };
};

export const failMaxLogin = async (
  database: DatabaseClient | Prisma.TransactionClient,
  requestId: string,
  code: string,
  message: string,
  fromStatuses: readonly ("PENDING" | "AWAITING_CONTACT" | "CONFIRMED")[] = [
    "PENDING",
    "AWAITING_CONTACT",
    "CONFIRMED",
  ],
): Promise<void> => {
  await database.maxLoginRequest.updateMany({
    where: { id: requestId, status: { in: [...fromStatuses] } },
    data: {
      status: "FAILED",
      failureCode: code.slice(0, 64),
      failureMessage: message.slice(0, 500),
    },
  });
};

export const claimMaxLoginRequest = async (
  transaction: Prisma.TransactionClient,
  requestId: string,
  data: {
    readonly maxUserId: string;
    readonly maxDisplayName: string;
    readonly userId?: string;
    readonly accountCreated?: boolean;
    readonly referralApplied?: boolean;
  },
): Promise<boolean> => {
  const now = new Date();
  const claimed = await transaction.maxLoginRequest.updateMany({
    where: {
      id: requestId,
      status: { in: ["PENDING", "AWAITING_CONTACT"] },
      expiresAt: { gt: now },
    },
    data: {
      status: "CONFIRMED",
      maxUserId: data.maxUserId,
      maxDisplayName: data.maxDisplayName,
      confirmedAt: now,
      ...(data.userId ? { userId: data.userId } : {}),
      ...(data.accountCreated === undefined
        ? {}
        : { accountCreated: data.accountCreated }),
      ...(data.referralApplied === undefined
        ? {}
        : { referralApplied: data.referralApplied }),
    },
  });
  return claimed.count === 1;
};

export const pollMaxLogin = async (
  database: DatabaseClient,
  pollToken: string,
): Promise<MaxLoginPollResult> => {
  const request = await database.maxLoginRequest.findUnique({
    where: { pollTokenHash: hashMaxLoginToken(pollToken) },
  });
  if (!request) {
    throw new HttpError(
      404,
      "MAX_LOGIN_NOT_FOUND",
      "Запрос на вход не найден. Вернитесь на страницу входа и попробуйте снова.",
    );
  }
  if (request.status === "COMPLETED") {
    throw new HttpError(
      410,
      "MAX_LOGIN_ALREADY_COMPLETED",
      "Этот вход уже завершён. Вернитесь на страницу входа и попробуйте снова.",
    );
  }
  if (request.status === "FAILED") {
    return {
      status: "failed",
      message:
        request.failureMessage ?? "Не удалось выполнить вход через МАКС.",
    };
  }

  const now = new Date();
  if (request.expiresAt <= now) {
    await failMaxLogin(
      database,
      request.id,
      "MAX_LOGIN_EXPIRED",
      MAX_LOGIN_EXPIRED_MESSAGE,
      ["PENDING", "AWAITING_CONTACT", "CONFIRMED"],
    );
    return { status: "expired", message: MAX_LOGIN_EXPIRED_MESSAGE };
  }

  if (request.status !== "CONFIRMED" || !request.userId) {
    return {
      status:
        request.status === "AWAITING_CONTACT" ? "awaiting_contact" : "pending",
      expiresAt: request.expiresAt.toISOString(),
    };
  }

  const completed = await database.$transaction(async (transaction) => {
    await transaction.$queryRaw<Array<{ id: string }>>`
      SELECT "id" FROM "users" WHERE "id" = ${request.userId}::uuid FOR UPDATE
    `;
    const user = await transaction.user.findUnique({
      where: { id: request.userId! },
    });
    if (
      !user ||
      !user.active ||
      user.terminatedAt ||
      user.role !== request.expectedRole
    ) {
      const message =
        "Аккаунт недоступен для входа через МАКС. Обратитесь к администратору сервиса.";
      await failMaxLogin(
        transaction,
        request.id,
        "MAX_ACCOUNT_UNAVAILABLE",
        message,
      );
      return { unavailableMessage: message } as const;
    }

    const claimed = await transaction.maxLoginRequest.updateMany({
      where: {
        id: request.id,
        status: "CONFIRMED",
        consumedAt: null,
        expiresAt: { gt: now },
      },
      data: { status: "COMPLETED", consumedAt: now },
    });
    if (claimed.count !== 1) return null;

    const session = buildSession(request.userId!);
    await transaction.session.create({ data: session.record });
    return { session, user };
  });

  if (completed && "unavailableMessage" in completed) {
    return {
      status: "failed",
      message:
        completed.unavailableMessage ??
        "Аккаунт недоступен для входа через МАКС. Обратитесь к администратору сервиса.",
    };
  }

  if (!completed) {
    throw new HttpError(
      410,
      "MAX_LOGIN_ALREADY_COMPLETED",
      "Этот вход уже завершён. Вернитесь на страницу входа и попробуйте снова.",
    );
  }

  return {
    status: "completed",
    accessToken: completed.session.accessToken,
    expiresAt: completed.session.expiresAt.toISOString(),
    accountCreated: request.accountCreated,
    referralApplied: request.referralApplied,
    user: publicUser(completed.user),
  };
};

export type MaxPhoneCustomer = {
  readonly id: string;
  readonly active: boolean;
  readonly maxUserId: string | null;
  readonly phoneNumber: string | null;
};

export const findCustomersByNationalPhone = async (
  database: DatabaseClient | Prisma.TransactionClient,
  nationalDigits: string,
): Promise<MaxPhoneCustomer[]> =>
  database.$queryRaw<MaxPhoneCustomer[]>`
    SELECT "id", "active", "max_user_id" AS "maxUserId",
           "phone_number" AS "phoneNumber"
    FROM "users"
    WHERE "role" = 'CUSTOMER'
      AND "phone_number" IS NOT NULL
      AND length(regexp_replace("phone_number", '[^0-9]', '', 'g')) BETWEEN 10 AND 15
      AND RIGHT(regexp_replace("phone_number", '[^0-9]', '', 'g'), 10) = ${nationalDigits}
    LIMIT 10
  `;

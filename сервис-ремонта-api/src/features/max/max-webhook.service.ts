import { randomBytes } from "node:crypto";

import type { DatabaseClient } from "../../lib/database/database.js";
import { HttpError } from "../../lib/http/http-error.js";
import { hashPassword } from "../auth/passwords.js";
import { isUniqueViolation } from "../auth/session.js";
import { createCustomerWithReferral } from "../referrals/customer-registration.js";
import {
  isMaxContactHashValid,
  sendMaxContactRequest,
  sendMaxMessage,
} from "./max-bot.js";
import {
  MAX_LOGIN_EXPIRED_MESSAGE,
  claimMaxLoginRequest,
  failMaxLogin,
  findCustomersByNationalPhone,
  hashMaxLoginToken,
} from "./max-login.service.js";
import {
  maxDisplayName as buildMaxDisplayName,
  extractMaxContactPhone,
} from "./max-phone.js";

export type MaxWebhookUser = {
  readonly id: string;
  readonly name?: string | undefined;
  readonly firstName?: string | undefined;
  readonly lastName?: string | undefined;
  readonly username?: string | undefined;
};

const sendQuietly = async (userId: string, text: string): Promise<void> => {
  await sendMaxMessage(userId, text).catch(() => undefined);
};

const isReferralCodeInvalid = (error: unknown): boolean =>
  error instanceof HttpError && error.code === "REFERRAL_CODE_INVALID";

const failAndNotify = async (
  database: DatabaseClient,
  requestId: string,
  maxUserId: string,
  code: string,
  message: string,
): Promise<void> => {
  await failMaxLogin(database, requestId, code, message, [
    "PENDING",
    "AWAITING_CONTACT",
  ]);
  await sendQuietly(maxUserId, message);
};

export const handleMaxBotStarted = async (
  database: DatabaseClient,
  input: { readonly payload: string | null; readonly user: MaxWebhookUser },
): Promise<void> => {
  const maxUserId = input.user.id;
  const displayName = buildMaxDisplayName(
    input.user.name,
    input.user.firstName,
    input.user.lastName,
    input.user.username,
  );

  if (!input.payload) {
    const linked = await database.user.findUnique({
      where: { maxUserId },
      select: { id: true },
    });
    await sendQuietly(
      maxUserId,
      linked
        ? "МАКС уже подключён к аккаунту UTP Servise. Чтобы войти на сайт, нажмите «Войти через МАКС» на странице входа."
        : "Это бот сервиса UTP Servise. Чтобы войти или зарегистрироваться, откройте сайт и нажмите «Войти через МАКС».",
    );
    return;
  }

  const request = await database.maxLoginRequest.findUnique({
    where: { tokenHash: hashMaxLoginToken(input.payload) },
  });
  if (!request) {
    await sendQuietly(
      maxUserId,
      "Ссылка для входа не найдена или уже использована. Вернитесь на сайт и попробуйте снова.",
    );
    return;
  }
  if (request.status === "CONFIRMED" || request.status === "COMPLETED") {
    await sendQuietly(
      maxUserId,
      "Вход уже подтверждён. Вернитесь на сайт или в приложение.",
    );
    return;
  }
  if (request.status === "FAILED") {
    await sendQuietly(
      maxUserId,
      request.failureMessage ?? "Не удалось выполнить вход. Попробуйте снова.",
    );
    return;
  }
  if (request.expiresAt <= new Date()) {
    await failAndNotify(
      database,
      request.id,
      maxUserId,
      "MAX_LOGIN_EXPIRED",
      MAX_LOGIN_EXPIRED_MESSAGE,
    );
    return;
  }

  const linkedUser = await database.user.findUnique({
    where: { maxUserId },
    select: { id: true, role: true, active: true },
  });
  if (linkedUser) {
    if (linkedUser.role !== "CUSTOMER") {
      await failAndNotify(
        database,
        request.id,
        maxUserId,
        "MAX_STAFF_ACCOUNT",
        "Вход через МАКС доступен клиентам. Сотрудники входят по почте и паролю.",
      );
      return;
    }
    if (!linkedUser.active) {
      await failAndNotify(
        database,
        request.id,
        maxUserId,
        "ACCOUNT_DISABLED",
        "Этот аккаунт отключён. Обратитесь в поддержку сервиса.",
      );
      return;
    }
    const confirmed = await database.$transaction((transaction) =>
      claimMaxLoginRequest(transaction, request.id, {
        maxUserId,
        maxDisplayName: displayName,
        userId: linkedUser.id,
      }),
    );
    await sendQuietly(
      maxUserId,
      confirmed
        ? "Готово! Вход подтверждён. Вернитесь на сайт или в приложение."
        : "Вход уже подтверждён. Вернитесь на сайт или в приложение.",
    );
    return;
  }

  const marked = await database.maxLoginRequest.updateMany({
    where: {
      id: request.id,
      status: { in: ["PENDING", "AWAITING_CONTACT"] },
      expiresAt: { gt: new Date() },
    },
    data: {
      status: "AWAITING_CONTACT",
      maxUserId,
      maxDisplayName: displayName,
    },
  });
  if (marked.count !== 1) {
    await sendQuietly(
      maxUserId,
      "Вход уже подтверждён. Вернитесь на сайт или в приложение.",
    );
    return;
  }

  await sendMaxContactRequest(
    maxUserId,
    [
      "Чтобы войти или зарегистрироваться в UTP Servise, поделитесь номером телефона.",
      "",
      "Номер нужен для входа и связи по заказу. Нажмите кнопку ниже — МАКС подтвердит, что номер принадлежит вам.",
    ].join("\n"),
  ).catch(() => undefined);
};

export const handleMaxContact = async (
  database: DatabaseClient,
  input: {
    readonly user: MaxWebhookUser;
    readonly vcfInfo: string;
    readonly hash: string;
  },
): Promise<void> => {
  const maxUserId = input.user.id;
  const displayName = buildMaxDisplayName(
    input.user.name,
    input.user.firstName,
    input.user.lastName,
    input.user.username,
  );

  const request = await database.maxLoginRequest.findFirst({
    where: {
      maxUserId,
      status: "AWAITING_CONTACT",
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });
  if (!request) {
    const linked = await database.user.findUnique({
      where: { maxUserId },
      select: { id: true },
    });
    await sendQuietly(
      maxUserId,
      linked
        ? "МАКС уже подключён к аккаунту UTP Servise."
        : "Чтобы войти, откройте сайт или приложение и нажмите «Войти через МАКС».",
    );
    return;
  }

  if (!isMaxContactHashValid(input.vcfInfo, input.hash)) {
    await sendQuietly(
      maxUserId,
      "Не удалось подтвердить номер. Нажмите «Поделиться контактом» ещё раз.",
    );
    return;
  }
  const phone = extractMaxContactPhone(input.vcfInfo);
  if (!phone) {
    await sendQuietly(
      maxUserId,
      "В контакте не найден номер телефона. Нажмите «Поделиться контактом» ещё раз.",
    );
    return;
  }

  const linkedUser = await database.user.findUnique({
    where: { maxUserId },
    select: { id: true, role: true, active: true },
  });
  if (linkedUser) {
    if (linkedUser.role !== "CUSTOMER") {
      await failAndNotify(
        database,
        request.id,
        maxUserId,
        "MAX_STAFF_ACCOUNT",
        "Вход через МАКС доступен клиентам. Сотрудники входят по почте и паролю.",
      );
      return;
    }
    if (!linkedUser.active) {
      await failAndNotify(
        database,
        request.id,
        maxUserId,
        "ACCOUNT_DISABLED",
        "Этот аккаунт отключён. Обратитесь в поддержку сервиса.",
      );
      return;
    }
    const confirmed = await database.$transaction((transaction) =>
      claimMaxLoginRequest(transaction, request.id, {
        maxUserId,
        maxDisplayName: displayName,
        userId: linkedUser.id,
      }),
    );
    await sendQuietly(
      maxUserId,
      confirmed
        ? "Готово! Вход подтверждён. Вернитесь на сайт или в приложение."
        : "Вход уже подтверждён. Вернитесь на сайт или в приложение.",
    );
    return;
  }

  const matches = await findCustomersByNationalPhone(
    database,
    phone.nationalDigits,
  );
  if (matches.length > 1) {
    await failAndNotify(
      database,
      request.id,
      maxUserId,
      "MAX_PHONE_AMBIGUOUS",
      "С этим номером связано несколько аккаунтов. Войдите по почте и привяжите МАКС в профиле или обратитесь в поддержку.",
    );
    return;
  }

  if (matches.length === 1) {
    const match = matches[0]!;
    if (!match.active) {
      await failAndNotify(
        database,
        request.id,
        maxUserId,
        "ACCOUNT_DISABLED",
        "Этот аккаунт отключён. Обратитесь в поддержку сервиса.",
      );
      return;
    }
    if (match.maxUserId && match.maxUserId !== maxUserId) {
      await failAndNotify(
        database,
        request.id,
        maxUserId,
        "MAX_ACCOUNT_CONFLICT",
        "Этот номер уже связан с другим аккаунтом МАКС. Войдите по почте и отвяжите МАКС в профиле или обратитесь в поддержку.",
      );
      return;
    }

    const confirmed = await database.$transaction(async (transaction) => {
      const claimed = await claimMaxLoginRequest(transaction, request.id, {
        maxUserId,
        maxDisplayName: displayName,
        userId: match.id,
      });
      if (!claimed) return false;
      await transaction.user.update({
        where: { id: match.id },
        data: {
          maxUserId,
          ...(match.phoneNumber ? {} : { phoneNumber: phone.phone }),
        },
      });
      return true;
    });
    await sendQuietly(
      maxUserId,
      confirmed
        ? "Готово! Аккаунт UTP Servise найден, номер подтверждён. Вернитесь на сайт или в приложение — вход уже выполнен."
        : "Вход уже подтверждён. Вернитесь на сайт или в приложение.",
    );
    return;
  }

  const passwordHash = await hashPassword(
    randomBytes(32).toString("base64url"),
  );
  const createAccount = (withReferral: boolean) =>
    database.$transaction(async (transaction) => {
      const claimed = await claimMaxLoginRequest(transaction, request.id, {
        maxUserId,
        maxDisplayName: displayName,
      });
      if (!claimed) return null;
      const created = await createCustomerWithReferral(transaction, {
        email: null,
        displayName,
        phoneNumber: phone.phone,
        passwordHash,
        maxUserId,
        ...(withReferral && request.referralCode
          ? { referralCode: request.referralCode }
          : {}),
      });
      await transaction.maxLoginRequest.update({
        where: { id: request.id },
        data: {
          userId: created.user.id,
          accountCreated: true,
          referralApplied: created.referralApplied,
        },
      });
      return created;
    });

  let created: Awaited<ReturnType<typeof createAccount>>;
  try {
    created = await createAccount(Boolean(request.referralCode));
  } catch (error) {
    if (isReferralCodeInvalid(error) && request.referralCode) {
      created = await createAccount(false);
    } else if (isUniqueViolation(error)) {
      await failAndNotify(
        database,
        request.id,
        maxUserId,
        "MAX_ACCOUNT_CONFLICT",
        "Этот МАКС уже связан с другим аккаунтом. Войдите по почте и отвяжите МАКС в профиле или обратитесь в поддержку.",
      );
      return;
    } else {
      throw error;
    }
  }

  await sendQuietly(
    maxUserId,
    created
      ? "Готово! Аккаунт UTP Servise создан, номер подтверждён. Вернитесь на сайт или в приложение — вход уже выполнен."
      : "Вход уже подтверждён. Вернитесь на сайт или в приложение.",
  );
};

export const handleMaxBotStopped = async (
  database: DatabaseClient,
  maxUserId: string,
): Promise<void> => {
  await database.$transaction([
    database.user.updateMany({
      where: { maxUserId },
      data: { maxUserId: null },
    }),
    database.maxLoginRequest.updateMany({
      where: { maxUserId, status: "AWAITING_CONTACT" },
      data: {
        status: "FAILED",
        failureCode: "MAX_BOT_STOPPED",
        failureMessage:
          "Диалог с ботом МАКС остановлен. Откройте бота и попробуйте снова.",
      },
    }),
  ]);
};

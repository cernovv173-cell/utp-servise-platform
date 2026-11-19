import { randomBytes } from "node:crypto";

import type { DatabaseClient } from "../../lib/database/database.js";
import { HttpError } from "../../lib/http/http-error.js";
import { recordProductAnalytics } from "../analytics/product-analytics.js";
import { hashPassword } from "../auth/passwords.js";
import { isUniqueViolation } from "../auth/session.js";
import { createCustomerWithReferral } from "../referrals/customer-registration.js";
import { isMaxContactHashValid } from "./max-bot.js";
import {
  claimMaxLoginRequest,
  findCustomersByNationalPhone,
} from "./max-login.service.js";
import {
  maxDisplayName as buildMaxDisplayName,
  extractMaxContactPhone,
  normalizeMaxPhone,
} from "./max-phone.js";
import { failAndNotify, sendQuietly } from "./max-webhook-helpers.js";
import type { MaxWebhookUser } from "./max-webhook.service.js";

const isReferralCodeInvalid = (error: unknown): boolean =>
  error instanceof HttpError && error.code === "REFERRAL_CODE_INVALID";

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
        ? "МАКС уже подключён к аккаунту ЕНОТ СЕРВИС."
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

  if (request.userId) {
    const target = await database.user.findUnique({
      where: { id: request.userId },
      select: {
        id: true,
        role: true,
        active: true,
        maxUserId: true,
        phoneNumber: true,
      },
    });
    const targetPhone = target?.phoneNumber
      ? normalizeMaxPhone(target.phoneNumber)
      : null;
    if (!target || target.role !== "CUSTOMER" || !target.active) {
      await failAndNotify(
        database,
        request.id,
        maxUserId,
        "MAX_ACTIVATION_ACCOUNT_INVALID",
        "Аккаунт клиента недоступен. Обратитесь в сервис.",
      );
      return;
    }
    if (!targetPhone || targetPhone.nationalDigits !== phone.nationalDigits) {
      await failAndNotify(
        database,
        request.id,
        maxUserId,
        "MAX_ACTIVATION_PHONE_MISMATCH",
        "Подтверждённый номер не совпадает с номером в заявке. Обратитесь в сервис для проверки контактов.",
      );
      return;
    }
    if (target.maxUserId && target.maxUserId !== maxUserId) {
      await failAndNotify(
        database,
        request.id,
        maxUserId,
        "MAX_ACTIVATION_ACCOUNT_CONFLICT",
        "Аккаунт клиента уже связан с другим профилем МАКС. Обратитесь в сервис.",
      );
      return;
    }

    const linkedUser = await database.user.findUnique({
      where: { maxUserId },
      select: { id: true },
    });
    if (linkedUser && linkedUser.id !== target.id) {
      await failAndNotify(
        database,
        request.id,
        maxUserId,
        "MAX_ACTIVATION_WRONG_ACCOUNT",
        "Этот профиль МАКС уже привязан к другому аккаунту ЕНОТ СЕРВИС. Войдите в нужный профиль или обратитесь в сервис.",
      );
      return;
    }

    const confirmed = await database.$transaction(async (transaction) => {
      const current = await transaction.user.findUnique({
        where: { id: target.id },
        select: { id: true, maxUserId: true, phoneNumber: true },
      });
      if (!current || (current.maxUserId && current.maxUserId !== maxUserId)) {
        return false;
      }
      const claimed = await claimMaxLoginRequest(transaction, request.id, {
        maxUserId,
        maxDisplayName: displayName,
        userId: target.id,
      });
      if (!claimed) return false;
      await transaction.user.update({
        where: { id: target.id },
        data: {
          maxUserId,
          ...(current.phoneNumber ? {} : { phoneNumber: phone.phone }),
        },
      });
      return true;
    });
    await sendQuietly(
      maxUserId,
      confirmed
        ? "Готово! МАКС подключён к аккаунту. Логин и временный пароль для первого входа передаст администратор."
        : "Подтверждение уже обработано. Проверьте сообщения бота.",
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
        ? "Готово! Аккаунт ЕНОТ СЕРВИС найден, номер подтверждён. Вернитесь на сайт или в приложение — вход уже выполнен."
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
      ? "Спасибо что выбрали нас!\n\nГотово! Аккаунт ЕНОТ СЕРВИС создан, номер подтверждён. Вернитесь на сайт или в приложение — вход уже выполнен."
      : "Вход уже подтверждён. Вернитесь на сайт или в приложение.",
  );
  if (created) {
    await recordProductAnalytics(database, "REGISTRATION", "MAX");
  }
};

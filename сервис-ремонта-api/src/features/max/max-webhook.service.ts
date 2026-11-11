import type { DatabaseClient } from "../../lib/database/database.js";
import { sendMaxContactRequest } from "./max-bot.js";
import {
  MAX_LOGIN_EXPIRED_MESSAGE,
  claimMaxLoginRequest,
  hashMaxLoginToken,
} from "./max-login.service.js";
import { maxDisplayName as buildMaxDisplayName } from "./max-phone.js";
import {
  deliverCredentialsQuietly,
  failAndNotify,
  sendQuietly,
} from "./max-webhook-helpers.js";

export { handleMaxContact } from "./max-contact-handler.js";

export type MaxWebhookUser = {
  readonly id: string;
  readonly name?: string | undefined;
  readonly firstName?: string | undefined;
  readonly lastName?: string | undefined;
  readonly username?: string | undefined;
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
        ? "МАКС уже подключён к аккаунту ЕНОТ СЕРВИС. Чтобы войти на сайт, нажмите «Войти через МАКС» на странице входа."
        : "Это бот сервиса ЕНОТ СЕРВИС. Чтобы войти или зарегистрироваться, откройте сайт и нажмите «Войти через МАКС».",
    );
    if (linked) {
      await deliverCredentialsQuietly(database, linked.id, maxUserId);
    }
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

  if (request.userId) {
    const target = await database.user.findUnique({
      where: { id: request.userId },
      select: {
        id: true,
        role: true,
        active: true,
        terminatedAt: true,
        maxUserId: true,
      },
    });
    if (
      !target ||
      target.role !== request.expectedRole ||
      target.role !== "CUSTOMER" ||
      !target.active ||
      target.terminatedAt
    ) {
      await failAndNotify(
        database,
        request.id,
        maxUserId,
        "MAX_ACTIVATION_ACCOUNT_INVALID",
        "Аккаунт клиента недоступен. Обратитесь в сервис.",
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

    const linkedTarget = await database.user.findUnique({
      where: { maxUserId },
      select: { id: true },
    });
    if (linkedTarget && linkedTarget.id !== target.id) {
      await failAndNotify(
        database,
        request.id,
        maxUserId,
        "MAX_ACTIVATION_WRONG_ACCOUNT",
        "Этот профиль МАКС уже привязан к другому аккаунту ЕНОТ СЕРВИС. Войдите в нужный профиль или обратитесь в сервис.",
      );
      return;
    }
    if (linkedTarget) {
      const confirmed = await database.$transaction((transaction) =>
        claimMaxLoginRequest(transaction, request.id, {
          maxUserId,
          maxDisplayName: displayName,
          userId: target.id,
        }),
      );
      await sendQuietly(
        maxUserId,
        confirmed
          ? "Готово! Номер подтверждён. Данные для входа отправлены в этот чат."
          : "Подтверждение уже обработано. Проверьте сообщения бота.",
      );
      if (confirmed) {
        await deliverCredentialsQuietly(database, target.id, maxUserId);
      }
      return;
    }

    const marked = await database.maxLoginRequest.updateMany({
      where: {
        id: request.id,
        userId: target.id,
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
        "Ссылка для подтверждения уже использована. Создайте новую ссылку в сервисе.",
      );
      return;
    }
    await sendMaxContactRequest(
      maxUserId,
      [
        "Чтобы получить данные для входа в ЕНОТ СЕРВИС, подтвердите номер телефона, указанный в заявке.",
        "",
        "Нажмите кнопку ниже, чтобы МАКС проверил, что этот номер принадлежит вам.",
      ].join("\n"),
    ).catch(() => undefined);
    return;
  }

  const linkedUser = await database.user.findUnique({
    where: { maxUserId },
    select: { id: true, role: true, active: true, terminatedAt: true },
  });
  if (linkedUser) {
    if (linkedUser.role !== request.expectedRole) {
      await failAndNotify(
        database,
        request.id,
        maxUserId,
        "MAX_ROLE_MISMATCH",
        "Этот MAX привязан к другому типу аккаунта. Выберите соответствующую роль на экране входа.",
      );
      return;
    }
    if (!linkedUser.active || linkedUser.terminatedAt) {
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
    if (confirmed) {
      await deliverCredentialsQuietly(database, linkedUser.id, maxUserId);
    }
    return;
  }

  if (request.expectedRole !== "CUSTOMER") {
    await failAndNotify(
      database,
      request.id,
      maxUserId,
      "MAX_STAFF_NOT_LINKED",
      "Чтобы войти как сотрудник, войдите по выданному логину и паролю и подключите МАКС в профиле.",
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
      "Чтобы войти или зарегистрироваться в ЕНОТ СЕРВИС, поделитесь номером телефона.",
      "",
      "Номер нужен для входа и связи по заказу. Нажмите кнопку ниже — МАКС подтвердит, что номер принадлежит вам.",
    ].join("\n"),
  ).catch(() => undefined);
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

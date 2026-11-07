import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";

import type { Prisma } from "../../generated/prisma/client.js";
import type { DatabaseClient } from "../../lib/database/database.js";
import { sendMaxMessage } from "./max-bot.js";

const CREDENTIAL_LIFETIME_MILLISECONDS = 30 * 24 * 60 * 60 * 1_000;
const DELIVERY_LOCK_MILLISECONDS = 30_000;

const encryptionKey = (): Buffer => {
  const secret = process.env.PASSWORD_RESET_CODE_SECRET?.trim();
  if (!secret) throw new Error("Credential encryption is not configured.");
  return createHash("sha256")
    .update("enot-service:max-credential-delivery:v1:")
    .update(secret)
    .digest();
};

const encryptPassword = (password: string): string => {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(password, "utf8"),
    cipher.final(),
  ]);
  return [iv, cipher.getAuthTag(), encrypted]
    .map((part) => part.toString("base64url"))
    .join(".");
};

const decryptPassword = (value: string): string => {
  const [ivText, tagText, encryptedText] = value.split(".");
  if (!ivText || !tagText || !encryptedText) {
    throw new Error("Credential payload is invalid.");
  }
  const decipher = createDecipheriv(
    "aes-256-gcm",
    encryptionKey(),
    Buffer.from(ivText, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(tagText, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedText, "base64url")),
    decipher.final(),
  ]).toString("utf8");
};

export const storePendingMaxCredential = async (
  transaction: Prisma.TransactionClient,
  input: {
    readonly userId: string;
    readonly login: string;
    readonly password: string;
  },
): Promise<void> => {
  await transaction.maxCredentialDelivery.create({
    data: {
      userId: input.userId,
      login: input.login,
      encryptedPassword: encryptPassword(input.password),
      expiresAt: new Date(Date.now() + CREDENTIAL_LIFETIME_MILLISECONDS),
    },
  });
};

type LockedCredential = {
  readonly id: string;
  readonly login: string;
  readonly encryptedPassword: string | null;
  readonly expiresAt: Date;
  readonly sentAt: Date | null;
  readonly lockedUntil: Date | null;
};

export type MaxCredentialDeliveryResult =
  "sent" | "pending" | "expired" | "none";

export const deliverPendingCustomerCredentials = async (
  database: DatabaseClient,
  userId: string,
  maxUserId: string | null,
): Promise<MaxCredentialDeliveryResult> => {
  if (!maxUserId) return "pending";

  const now = new Date();
  const claim = await database.$transaction(async (transaction) => {
    const [delivery] = await transaction.$queryRaw<LockedCredential[]>`
      SELECT "id", "login", "encrypted_password" AS "encryptedPassword",
             "expires_at" AS "expiresAt", "sent_at" AS "sentAt",
             "locked_until" AS "lockedUntil"
      FROM "max_credential_deliveries"
      WHERE "user_id" = ${userId}::uuid
      FOR UPDATE
    `;
    if (!delivery) return { status: "none" as const };
    if (delivery.sentAt) return { status: "sent" as const };
    if (!delivery.encryptedPassword) return { status: "none" as const };
    if (delivery.expiresAt <= now) {
      await transaction.maxCredentialDelivery.update({
        where: { id: delivery.id },
        data: { encryptedPassword: null, lockedUntil: null },
      });
      await transaction.user.updateMany({
        where: {
          id: userId,
          login: delivery.login,
          email: null,
          mustChangePassword: true,
        },
        data: { mustChangePassword: false },
      });
      return { status: "expired" as const };
    }
    if (delivery.lockedUntil && delivery.lockedUntil > now) {
      return { status: "pending" as const };
    }

    const lockedUntil = new Date(now.getTime() + DELIVERY_LOCK_MILLISECONDS);
    await transaction.maxCredentialDelivery.update({
      where: { id: delivery.id },
      data: { lockedUntil, attemptCount: { increment: 1 } },
    });
    return {
      status: "claimed" as const,
      id: delivery.id,
      login: delivery.login,
      encryptedPassword: delivery.encryptedPassword,
    };
  });

  if (claim.status !== "claimed") return claim.status;

  try {
    const password = decryptPassword(claim.encryptedPassword);
    await sendMaxMessage(
      maxUserId,
      [
        "Аккаунт ЕНОТ СЕРВИС готов.",
        `Логин: ${claim.login}`,
        `Временный пароль: ${password}`,
        "При первом входе смените временный пароль в профиле.",
      ].join("\n"),
    );
    await database.maxCredentialDelivery.updateMany({
      where: { id: claim.id, sentAt: null },
      data: {
        encryptedPassword: null,
        lockedUntil: null,
        sentAt: new Date(),
      },
    });
    return "sent";
  } catch {
    await database.maxCredentialDelivery.updateMany({
      where: { id: claim.id, sentAt: null },
      data: { lockedUntil: null },
    });
    return "pending";
  }
};

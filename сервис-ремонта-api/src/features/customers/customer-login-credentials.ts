import type { Prisma } from "../../generated/prisma/client.js";
import {
  generateAccountLogin,
  generateTemporaryPassword,
  hashPassword,
} from "../auth/passwords.js";
import { storePendingMaxCredential } from "../max/max-credential-delivery.js";

export type TemporaryCustomerCredentials = {
  readonly login: string;
  readonly temporaryPassword: string;
  readonly maxUserId: string | null;
};

export const createCustomerWithTemporaryLogin = async (
  transaction: Prisma.TransactionClient,
  input: {
    readonly displayName: string;
    readonly phoneNumber: string;
    readonly email?: string | null;
  },
): Promise<{
  readonly customer: {
    readonly id: string;
    readonly email: string | null;
    readonly displayName: string;
    readonly phoneNumber: string | null;
    readonly login: string;
    readonly active: boolean;
    readonly createdAt: Date;
    readonly maxUserId: string | null;
  };
  readonly credentials: TemporaryCustomerCredentials;
}> => {
  const login = generateAccountLogin();
  const temporaryPassword = generateTemporaryPassword();
  const customer = await transaction.user.create({
    data: {
      email: input.email ?? null,
      displayName: input.displayName,
      phoneNumber: input.phoneNumber,
      role: "CUSTOMER",
      login,
      passwordHash: await hashPassword(temporaryPassword),
      mustChangePassword: true,
    },
    select: {
      id: true,
      email: true,
      displayName: true,
      phoneNumber: true,
      login: true,
      active: true,
      createdAt: true,
      maxUserId: true,
    },
  });
  await storePendingMaxCredential(transaction, {
    userId: customer.id,
    login,
    password: temporaryPassword,
  });
  return {
    customer: { ...customer, login: customer.login ?? login },
    credentials: { login, temporaryPassword, maxUserId: customer.maxUserId },
  };
};

export const addTemporaryLoginToCustomer = async (
  transaction: Prisma.TransactionClient,
  userId: string,
): Promise<TemporaryCustomerCredentials | null> => {
  const customer = await transaction.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, login: true, maxUserId: true },
  });
  if (!customer || customer.email || customer.login) return null;

  const login = generateAccountLogin();
  const temporaryPassword = generateTemporaryPassword();
  await transaction.user.update({
    where: { id: customer.id },
    data: {
      login,
      passwordHash: await hashPassword(temporaryPassword),
      mustChangePassword: true,
    },
  });
  await storePendingMaxCredential(transaction, {
    userId: customer.id,
    login,
    password: temporaryPassword,
  });
  return { login, temporaryPassword, maxUserId: customer.maxUserId };
};

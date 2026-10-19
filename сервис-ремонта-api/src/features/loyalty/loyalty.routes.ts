import { Router } from "express";

import type { DatabaseClient } from "../../lib/database/database.js";
import {
  createRequireAuth,
  getAuthenticatedUser,
  requireRoles,
} from "../auth/auth.middleware.js";

export const createLoyaltyRouter = (database: DatabaseClient): Router => {
  const router = Router();
  const requireAuth = createRequireAuth(database);

  router.get(
    "/loyalty/me",
    requireAuth,
    requireRoles("CUSTOMER"),
    async (_request, response) => {
      const user = getAuthenticatedUser(response);
      const [transactions, balance] = await Promise.all([
        database.loyaltyTransaction.findMany({
          where: { customerId: user.id },
          orderBy: { createdAt: "desc" },
          take: 100,
          include: {
            order: { select: { serviceNumber: true } },
            craftOrder: { select: { serviceNumber: true } },
          },
        }),
        database.loyaltyTransaction.aggregate({
          where: { customerId: user.id },
          _sum: { points: true },
        }),
      ]);
      response.json({ balance: balance._sum.points ?? 0, transactions });
    },
  );

  router.get(
    "/admin/loyalty",
    requireAuth,
    requireRoles("ADMIN"),
    async (_request, response) => {
      const [balances, transactions] = await Promise.all([
        database.loyaltyTransaction.groupBy({
          by: ["customerId"],
          _sum: { points: true },
        }),
        database.loyaltyTransaction.findMany({
          include: {
            order: { select: { serviceNumber: true } },
            craftOrder: { select: { serviceNumber: true } },
          },
          orderBy: { createdAt: "desc" },
          take: 1000,
        }),
      ]);
      const customers = await database.user.findMany({
        where: {
          id: { in: balances.map(({ customerId }) => customerId) },
          role: "CUSTOMER",
        },
        select: { id: true, displayName: true, email: true },
      });
      const balanceByCustomer = new Map(
        balances.map(({ customerId, _sum }) => [customerId, _sum.points ?? 0]),
      );
      const transactionsByCustomer = new Map<string, typeof transactions>();
      for (const transaction of transactions) {
        const customerTransactions =
          transactionsByCustomer.get(transaction.customerId) ?? [];
        customerTransactions.push(transaction);
        transactionsByCustomer.set(
          transaction.customerId,
          customerTransactions,
        );
      }
      response.json({
        customers: customers
          .map((customer) => ({
            customer,
            balance: balanceByCustomer.get(customer.id) ?? 0,
            transactions: transactionsByCustomer.get(customer.id) ?? [],
          }))
          .sort((left, right) =>
            left.customer.displayName.localeCompare(
              right.customer.displayName,
              "ru",
            ),
          ),
      });
    },
  );

  return router;
};

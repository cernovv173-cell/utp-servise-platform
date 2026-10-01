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
      const transactions = await database.loyaltyTransaction.findMany({
        include: {
          customer: { select: { id: true, displayName: true, email: true } },
          order: { select: { serviceNumber: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 1000,
      });
      const byCustomer = new Map<
        string,
        {
          customer: { id: string; displayName: string; email: string };
          balance: number;
          transactions: typeof transactions;
        }
      >();
      for (const transaction of transactions) {
        const existing = byCustomer.get(transaction.customerId) ?? {
          customer: transaction.customer,
          balance: 0,
          transactions: [],
        };
        existing.balance += transaction.points;
        existing.transactions.push(transaction);
        byCustomer.set(transaction.customerId, existing);
      }
      response.json({
        customers: [...byCustomer.values()].sort((left, right) =>
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

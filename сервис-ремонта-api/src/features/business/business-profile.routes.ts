import { Router } from "express";
import { z } from "zod";

import type { DatabaseClient } from "../../lib/database/database.js";
import { validateRequest } from "../../lib/http/validate-request.js";
import {
  createRequireAuth,
  getAuthenticatedUser,
  requireRoles,
} from "../auth/auth.middleware.js";

const profileBody = z
  .object({ companyName: z.string().trim().min(2).max(160) })
  .strict();

export const createCustomerBusinessProfileRouter = (
  database: DatabaseClient,
): Router => {
  const router = Router();
  const requireAuth = createRequireAuth(database);

  router.get(
    "/customer/business-profile",
    requireAuth,
    requireRoles("CUSTOMER"),
    async (_request, response) => {
      const user = getAuthenticatedUser(response);
      const profile = await database.customerBusinessProfile.findUnique({
        where: { ownerUserId: user.id },
        select: {
          id: true,
          companyName: true,
          createdAt: true,
          updatedAt: true,
        },
      });
      response.set("Cache-Control", "no-store");
      response.json({ profile });
    },
  );

  router.put(
    "/customer/business-profile",
    requireAuth,
    requireRoles("CUSTOMER"),
    validateRequest({ body: profileBody }),
    async (_request, response) => {
      const user = getAuthenticatedUser(response);
      const { companyName } = (
        response.locals.input as { body: z.infer<typeof profileBody> }
      ).body;
      const profile = await database.customerBusinessProfile.upsert({
        where: { ownerUserId: user.id },
        create: { ownerUserId: user.id, companyName },
        update: { companyName },
        select: {
          id: true,
          companyName: true,
          createdAt: true,
          updatedAt: true,
        },
      });
      response.set("Cache-Control", "no-store");
      response.json({ profile });
    },
  );

  return router;
};

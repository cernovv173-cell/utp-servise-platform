import { Router } from "express";
import { z } from "zod";

import type { DatabaseClient } from "../../lib/database/database.js";
import { HttpError } from "../../lib/http/http-error.js";
import { validateRequest } from "../../lib/http/validate-request.js";
import {
  createRequireAuth,
  getAuthenticatedUser,
  requireRoles,
  requireStaffPermission,
} from "../auth/auth.middleware.js";

const feedbackIdParams = z.object({ feedbackId: z.string().uuid() });
const submitBody = z
  .object({
    type: z.enum(["COMPLAINT", "SUGGESTION"]),
    content: z.string().trim().min(1).max(2000),
  })
  .strict();
const statusBody = z
  .object({ status: z.enum(["NEW", "IN_PROGRESS", "RESOLVED"]) })
  .strict();

const bodyOf = <T>(response: { locals: { input?: unknown } }): T =>
  (response.locals.input as { readonly body: T }).body;
const paramsOf = <T>(response: { locals: { input?: unknown } }): T =>
  (response.locals.input as { readonly params: T }).params;

const adminFeedbackDetails = {
  customer: {
    select: { id: true, displayName: true, email: true, phoneNumber: true },
  },
};

export const createCustomerFeedbackRouter = (
  database: DatabaseClient,
): Router => {
  const router = Router();
  const requireAuth = createRequireAuth(database);

  router.post(
    "/customer/feedback",
    requireAuth,
    requireRoles("CUSTOMER"),
    validateRequest({ body: submitBody }),
    async (_request, response) => {
      const customer = getAuthenticatedUser(response);
      const { type, content } = bodyOf<z.infer<typeof submitBody>>(response);
      const feedback = await database.customerFeedback.create({
        data: { customerId: customer.id, type, content },
        select: {
          id: true,
          type: true,
          content: true,
          status: true,
          createdAt: true,
        },
      });
      response.set("Cache-Control", "no-store");
      response.status(201).json({ feedback });
    },
  );

  router.get(
    "/admin/feedback",
    requireAuth,
    requireStaffPermission("communications"),
    async (_request, response) => {
      const feedback = await database.customerFeedback.findMany({
        include: adminFeedbackDetails,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 200,
      });
      response.set("Cache-Control", "no-store");
      response.json({ feedback });
    },
  );

  router.patch(
    "/admin/feedback/:feedbackId/status",
    requireAuth,
    requireStaffPermission("communications"),
    validateRequest({ params: feedbackIdParams, body: statusBody }),
    async (_request, response) => {
      const { feedbackId } =
        paramsOf<z.infer<typeof feedbackIdParams>>(response);
      const { status } = bodyOf<z.infer<typeof statusBody>>(response);
      const updated = await database.customerFeedback.updateMany({
        where: { id: feedbackId },
        data: { status, updatedAt: new Date() },
      });
      if (updated.count !== 1)
        throw new HttpError(404, "FEEDBACK_NOT_FOUND", "Обращение не найдено.");

      const feedback = await database.customerFeedback.findUnique({
        where: { id: feedbackId },
        include: adminFeedbackDetails,
      });
      if (!feedback)
        throw new HttpError(404, "FEEDBACK_NOT_FOUND", "Обращение не найдено.");
      response.set("Cache-Control", "no-store");
      response.json({ feedback });
    },
  );

  return router;
};

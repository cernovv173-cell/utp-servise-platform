import { Router } from "express";
import { z } from "zod";

import type { DatabaseClient } from "../../lib/database/database.js";
import { validateRequest } from "../../lib/http/validate-request.js";
import { referralCodeSchema } from "../referrals/referral-code.js";
import { hasMaxBotToken, hasMaxWebhookSecret } from "./max-bot.js";
import { pollMaxLogin, startMaxLogin } from "./max-login.service.js";

const startSchema = z.object({ referralCode: referralCodeSchema }).strict();

const pollSchema = z
  .object({
    pollToken: z.string().regex(/^[A-Za-z0-9_-]{40,64}$/u),
  })
  .strict();

type Body<T> = { readonly body: T };

const bodyOf = <T>(response: { locals: { input?: unknown } }): T =>
  (response.locals.input as Body<T>).body;

export const createMaxLoginRouter = (database: DatabaseClient): Router => {
  const router = Router();

  router.get("/auth/max/config", (_request, response) => {
    response.json({
      available:
        hasMaxBotToken() &&
        hasMaxWebhookSecret() &&
        Boolean(process.env.MAX_WEBHOOK_URL?.trim()),
    });
  });

  router.post(
    "/auth/max/login",
    validateRequest({ body: startSchema }),
    async (_request, response) => {
      const input = bodyOf<z.infer<typeof startSchema>>(response);
      response.json(await startMaxLogin(database, input.referralCode));
    },
  );

  router.post(
    "/auth/max/login/poll",
    validateRequest({ body: pollSchema }),
    async (_request, response) => {
      const input = bodyOf<z.infer<typeof pollSchema>>(response);
      response.json(await pollMaxLogin(database, input.pollToken));
    },
  );

  return router;
};

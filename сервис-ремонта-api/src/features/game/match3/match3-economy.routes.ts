import { Router } from "express";
import { z } from "zod";

import type { DatabaseClient } from "../../../lib/database/database.js";
import { validateRequest } from "../../../lib/http/validate-request.js";
import {
  createRequireAuth,
  getAuthenticatedUser,
  requireRoles,
} from "../../auth/auth.middleware.js";
import { MATCH3_BOOSTER_KEYS, isMatch3BoosterKey } from "./match3-boosters.js";
import {
  claimMatch3Rewards,
  craftMatch3Booster,
  getMatch3Inventory,
} from "./match3-inventory.js";

const boosterSchema = z.object({
  boosterId: z.string().refine(isMatch3BoosterKey),
});

export const createMatch3EconomyRouter = (database: DatabaseClient): Router => {
  const router = Router();
  const customerOnly = [createRequireAuth(database), requireRoles("CUSTOMER")];

  router.post(
    "/game/match3/rewards/claim",
    ...customerOnly,
    async (_request, response) => {
      const user = getAuthenticatedUser(response);
      const reward = await database.$transaction((transaction) =>
        claimMatch3Rewards(transaction, user.id),
      );
      response.json(reward);
    },
  );

  router.post(
    "/game/match3/booster/craft",
    ...customerOnly,
    validateRequest({ body: boosterSchema }),
    async (request, response) => {
      const user = getAuthenticatedUser(response);
      const input = request.body as z.infer<typeof boosterSchema>;
      const boosterId = input.boosterId as (typeof MATCH3_BOOSTER_KEYS)[number];
      await database.$transaction((transaction) =>
        craftMatch3Booster(transaction, user.id, boosterId),
      );
      response.json({
        boosterId,
        inventory: await getMatch3Inventory(database, user.id),
      });
    },
  );

  return router;
};

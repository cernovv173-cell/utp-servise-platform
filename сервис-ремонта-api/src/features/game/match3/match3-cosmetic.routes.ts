import { Router } from "express";
import { z } from "zod";

import type { DatabaseClient } from "../../../lib/database/database.js";
import { HttpError } from "../../../lib/http/http-error.js";
import { validateRequest } from "../../../lib/http/validate-request.js";
import {
  createRequireAuth,
  getAuthenticatedUser,
  requireRoles,
} from "../../auth/auth.middleware.js";

const cosmeticIdSchema = z.enum([
  "default",
  "forest",
  "crystal",
  "processor",
  "frost",
  "first-boot",
]);
const cosmeticBodySchema = z.object({ cosmeticId: cosmeticIdSchema });
type CosmeticId = z.infer<typeof cosmeticIdSchema>;

const cosmeticUnlockLevels: Record<CosmeticId, number> = {
  default: 0,
  forest: 20,
  crystal: 40,
  processor: 60,
  frost: 80,
  "first-boot": 100,
};

const isCosmeticId = (value: string): value is CosmeticId =>
  cosmeticIdSchema.safeParse(value).success;

export const createMatch3CosmeticRouter = (
  database: DatabaseClient,
): Router => {
  const router = Router();
  const customerOnly = [createRequireAuth(database), requireRoles("CUSTOMER")];

  router.get(
    "/game/match3/cosmetic",
    ...customerOnly,
    async (_request, response) => {
      const user = getAuthenticatedUser(response);
      const preference = await database.user.findUnique({
        where: { id: user.id },
        select: { match3CosmeticId: true },
      });
      const value = preference?.match3CosmeticId;
      response.json({
        selectedCosmeticId: value && isCosmeticId(value) ? value : null,
      });
    },
  );

  router.post(
    "/game/match3/cosmetic/initialize",
    ...customerOnly,
    validateRequest({ body: cosmeticBodySchema }),
    async (request, response) => {
      const user = getAuthenticatedUser(response);
      const current = await database.user.findUnique({
        where: { id: user.id },
        select: { match3CosmeticId: true },
      });
      if (current?.match3CosmeticId && isCosmeticId(current.match3CosmeticId)) {
        response.json({ selectedCosmeticId: current.match3CosmeticId });
        return;
      }

      const input = request.body as z.infer<typeof cosmeticBodySchema>;
      const completedCount = await database.match3LevelCompletion.count({
        where: { customerId: user.id },
      });
      const initialCosmeticId =
        completedCount >= cosmeticUnlockLevels[input.cosmeticId]
          ? input.cosmeticId
          : "default";
      await database.user.updateMany({
        where: { id: user.id, match3CosmeticId: null },
        data: { match3CosmeticId: initialCosmeticId },
      });
      const saved = await database.user.findUnique({
        where: { id: user.id },
        select: { match3CosmeticId: true },
      });
      const value = saved?.match3CosmeticId;
      response.json({
        selectedCosmeticId: value && isCosmeticId(value) ? value : "default",
      });
    },
  );

  router.put(
    "/game/match3/cosmetic",
    ...customerOnly,
    validateRequest({ body: cosmeticBodySchema }),
    async (request, response) => {
      const user = getAuthenticatedUser(response);
      const input = request.body as z.infer<typeof cosmeticBodySchema>;
      const completedCount = await database.match3LevelCompletion.count({
        where: { customerId: user.id },
      });
      if (completedCount < cosmeticUnlockLevels[input.cosmeticId]) {
        throw new HttpError(
          409,
          "GAME_COSMETIC_LOCKED",
          "Сначала пройдите главу, чтобы открыть этот визор.",
        );
      }

      await database.user.update({
        where: { id: user.id },
        data: { match3CosmeticId: input.cosmeticId },
        select: { id: true },
      });
      response.json({ selectedCosmeticId: input.cosmeticId });
    },
  );

  return router;
};

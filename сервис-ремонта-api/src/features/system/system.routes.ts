import { Router } from "express";

import type { DatabaseHealth } from "../../lib/database/database.js";
import { createGetApiHealth } from "./system.handlers.js";

type CreateSystemRouterOptions = {
  readonly database?: DatabaseHealth;
};

export const createSystemRouter = ({
  database,
}: CreateSystemRouterOptions): Router => {
  const router = Router();

  router.get("/health", createGetApiHealth(database));

  return router;
};

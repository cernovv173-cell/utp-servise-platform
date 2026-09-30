import { Router } from "express";

import { createAuthRouter } from "./features/auth/auth.routes.js";
import { createOrdersRouter } from "./features/orders/orders.routes.js";
import { createSystemRouter } from "./features/system/system.routes.js";
import type { Database } from "./lib/database/database.js";
import { HttpError } from "./lib/http/http-error.js";

type CreateApiRouterOptions = {
  readonly database?: Database;
};

export const createApiRouter = ({
  database,
}: CreateApiRouterOptions): Router => {
  const router = Router();

  router.use(createSystemRouter({ database }));

  if (database) {
    router.use(createAuthRouter(database.client));
    router.use(createOrdersRouter(database.client));
  } else {
    router.use((request, _response, next) => {
      if (
        request.path.startsWith("/auth") ||
        request.path.startsWith("/orders") ||
        request.path.startsWith("/reviews") ||
        request.path.startsWith("/staff")
      ) {
        next(
          new HttpError(
            503,
            "DATABASE_NOT_CONFIGURED",
            "Сервис временно недоступен.",
          ),
        );
        return;
      }
      next();
    });
  }

  return router;
};

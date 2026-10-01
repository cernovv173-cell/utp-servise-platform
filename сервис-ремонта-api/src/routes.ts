import { Router } from "express";

import { createAuthRouter } from "./features/auth/auth.routes.js";
import { createCatalogRouter } from "./features/catalog/catalog.routes.js";
import { createChatRouter } from "./features/chat/chat.routes.js";
import { createCompanyRouter } from "./features/company/company.routes.js";
import { createMediaRouter } from "./features/media/media.routes.js";
import { createNewsRouter } from "./features/news/news.routes.js";
import { createOrdersRouter } from "./features/orders/orders.routes.js";
import { createStaffRouter } from "./features/staff/staff.routes.js";
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
  router.get("/about", async (_request, response, next) => {
    if (!database) {
      response.json({
        company: {
          name: "UTP Servise",
          description: "Ремонт компьютеров, ноутбуков, телефонов и планшетов.",
          history: "",
          services: [],
          phone: "",
          email: "",
          address: "",
          hours: "",
          socials: [],
          requisites: "",
          mediaUrls: [],
        },
      });
      return;
    }
    next();
  });

  if (database) {
    router.use(createCompanyRouter(database.client));
    router.use(createAuthRouter(database.client));
    router.use(createStaffRouter(database.client));
    router.use(createCatalogRouter(database.client));
    router.use(createChatRouter(database.client));
    router.use(createNewsRouter(database.client));
    router.use(createOrdersRouter(database.client));
    router.use(createMediaRouter(database.client));
  } else {
    router.use((request, _response, next) => {
      if (
        request.path.startsWith("/auth") ||
        request.path.startsWith("/orders") ||
        request.path.startsWith("/catalog") ||
        request.path.startsWith("/admin/chats") ||
        request.path.startsWith("/news") ||
        request.path.startsWith("/reviews") ||
        request.path.startsWith("/staff") ||
        request.path.startsWith("/media")
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

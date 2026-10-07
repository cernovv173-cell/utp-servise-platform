import { Router } from "express";

import { createAndroidAppRouter } from "./features/android-app/android-app.routes.js";
import { createAuthRouter } from "./features/auth/auth.routes.js";
import { createPasswordResetRouter } from "./features/auth/password-reset.routes.js";
import { createBannersRouter } from "./features/banners/banners.routes.js";
import { createCatalogRouter } from "./features/catalog/catalog.routes.js";
import { createChatRouter } from "./features/chat/chat.routes.js";
import { createCompanyRouter } from "./features/company/company.routes.js";
import { createCraftsRouter } from "./features/crafts/crafts.routes.js";
import { createCustomerAdminRouter } from "./features/customers/customer.routes.js";
import { createLoyaltyRouter } from "./features/loyalty/loyalty.routes.js";
import { createMediaRouter } from "./features/media/media.routes.js";
import { createNewsRouter } from "./features/news/news.routes.js";
import { createOrdersRouter } from "./features/orders/orders.routes.js";
import { createSalaryRouter } from "./features/salary/salary.routes.js";
import { createStaffRouter } from "./features/staff/staff.routes.js";
import { createSupportChatRouter } from "./features/support-chat/support-chat.routes.js";
import { createSystemRouter } from "./features/system/system.routes.js";
import type { Database } from "./lib/database/database.js";
import { HttpError } from "./lib/http/http-error.js";

type CreateApiRouterOptions = {
  readonly database?: Database;
  readonly onPasswordResetEmailFailure?: () => void;
};

export const createApiRouter = ({
  database,
  onPasswordResetEmailFailure,
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
    router.use(
      createPasswordResetRouter(database.client, {
        onDeliveryFailure: onPasswordResetEmailFailure,
      }),
    );
    router.use(createAuthRouter(database.client));
    router.use(createAndroidAppRouter(database.client));
    router.use(createStaffRouter(database.client));
    router.use(createCustomerAdminRouter(database.client));
    router.use(createSupportChatRouter(database.client));
    router.use(createCatalogRouter(database.client));
    router.use(createChatRouter(database.client));
    router.use(createNewsRouter(database.client));
    router.use(createCraftsRouter(database.client));
    router.use(createBannersRouter(database.client));
    router.use(createLoyaltyRouter(database.client));
    router.use(createOrdersRouter(database.client));
    router.use(createSalaryRouter(database.client));
    router.use(createMediaRouter(database.client));
  } else {
    router.use((request, _response, next) => {
      if (
        request.path.startsWith("/auth") ||
        request.path.startsWith("/orders") ||
        request.path.startsWith("/salary") ||
        request.path.startsWith("/catalog") ||
        request.path.startsWith("/admin/chats") ||
        request.path.startsWith("/news") ||
        request.path.startsWith("/reviews") ||
        request.path.startsWith("/staff") ||
        request.path.startsWith("/support") ||
        request.path.startsWith("/admin/support") ||
        request.path.startsWith("/admin/customers") ||
        request.path.startsWith("/media") ||
        request.path.startsWith("/craft-items") ||
        request.path.startsWith("/craft-orders") ||
        request.path.startsWith("/loyalty") ||
        request.path.startsWith("/banners") ||
        request.path.startsWith("/admin/loyalty") ||
        request.path.startsWith("/admin/android-app") ||
        request.path.startsWith("/android-app")
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

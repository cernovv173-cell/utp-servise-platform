import { Router } from "express";

import { createProductAnalyticsRouter } from "./features/analytics/product-analytics.routes.js";
import { createAndroidAppRouter } from "./features/android-app/android-app.routes.js";
import { createAuthRouter } from "./features/auth/auth.routes.js";
import { createMaxEmailLoginRouter } from "./features/auth/max-email-login.routes.js";
import { createPasswordResetRouter } from "./features/auth/password-reset.routes.js";
import { createBannersRouter } from "./features/banners/banners.routes.js";
import { createCatalogRouter } from "./features/catalog/catalog.routes.js";
import { createChatRouter } from "./features/chat/chat.routes.js";
import { createCompanyRouter } from "./features/company/company.routes.js";
import { createCraftsRouter } from "./features/crafts/crafts.routes.js";
import { createCustomerOffersRouter } from "./features/customer-offers/customer-offers.routes.js";
import { createCustomerAdminRouter } from "./features/customers/customer.routes.js";
import { createCustomerDevicesRouter } from "./features/customers/devices.routes.js";
import { createLoyaltyRouter } from "./features/loyalty/loyalty.routes.js";
import { createMaxLoginRouter } from "./features/max/max-login.routes.js";
import { createMaxRouter } from "./features/max/max.routes.js";
import { createMediaRouter } from "./features/media/media.routes.js";
import { createNewsRouter } from "./features/news/news.routes.js";
import { createOperationsRouter } from "./features/operations/operations.routes.js";
import { createOrdersRouter } from "./features/orders/orders.routes.js";
import { createRepairEstimatesRouter } from "./features/orders/repair-estimates.routes.js";
import { createProcurementRouter } from "./features/procurement/procurement.routes.js";
import { createReferralRouter } from "./features/referrals/referral.routes.js";
import { createReviewShowcaseRouter } from "./features/reviews/review-showcase.routes.js";
import { createSalaryRouter } from "./features/salary/salary.routes.js";
import { createSeasonalThemeRouter } from "./features/seasonal/seasonal-theme.routes.js";
import { createShopRouter } from "./features/shop/shop.routes.js";
import { createStaffRouter } from "./features/staff/staff.routes.js";
import { createSupportChatRouter } from "./features/support-chat/support-chat.routes.js";
import { createSystemRouter } from "./features/system/system.routes.js";
import { createTelegramRouter } from "./features/telegram/telegram.routes.js";
import type { Database } from "./lib/database/database.js";
import { HttpError } from "./lib/http/http-error.js";

type CreateApiRouterOptions = {
  readonly database?: Database;
  readonly onPasswordResetEmailFailure?: () => void;
  readonly onPasswordResetMaxFailure?: () => void;
};

export const createApiRouter = ({
  database,
  onPasswordResetEmailFailure,
  onPasswordResetMaxFailure,
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
        onMaxDeliveryFailure: onPasswordResetMaxFailure,
      }),
    );
    router.use(createAuthRouter(database.client));
    router.use(createProductAnalyticsRouter(database.client));
    router.use(createMaxEmailLoginRouter(database.client));
    router.use(createMaxLoginRouter(database.client));
    router.use(createMaxRouter(database.client));
    router.use(createTelegramRouter(database.client));
    router.use(createAndroidAppRouter(database.client));
    router.use(createStaffRouter(database.client));
    router.use(createCustomerAdminRouter(database.client));
    router.use(createCustomerDevicesRouter(database.client));
    router.use(createSupportChatRouter(database.client));
    router.use(createCatalogRouter(database.client));
    router.use(createOperationsRouter(database.client));
    router.use(createProcurementRouter(database.client));
    router.use(createChatRouter(database.client));
    router.use(createNewsRouter(database.client));
    router.use(createCraftsRouter(database.client));
    router.use(createCustomerOffersRouter(database.client));
    router.use(createBannersRouter(database.client));
    router.use(createLoyaltyRouter(database.client));
    router.use(createReferralRouter(database.client));
    router.use(createRepairEstimatesRouter(database.client));
    router.use(createOrdersRouter(database.client));
    router.use(createReviewShowcaseRouter(database.client));
    router.use(createSalaryRouter(database.client));
    router.use(createSeasonalThemeRouter(database.client));
    router.use(createShopRouter(database.client));
    router.use(createMediaRouter(database.client));
  } else {
    router.use((request, _response, next) => {
      if (
        request.path.startsWith("/auth") ||
        request.path.startsWith("/telegram") ||
        request.path.startsWith("/max") ||
        request.path.startsWith("/orders") ||
        request.path.startsWith("/salary") ||
        request.path.startsWith("/catalog") ||
        request.path.startsWith("/customer/service-prices") ||
        request.path.startsWith("/admin/operations") ||
        request.path.startsWith("/admin/chats") ||
        request.path.startsWith("/news") ||
        request.path.startsWith("/reviews") ||
        request.path.startsWith("/public/reviews") ||
        request.path.startsWith("/admin/reviews") ||
        request.path.startsWith("/staff") ||
        request.path.startsWith("/support") ||
        request.path.startsWith("/admin/support") ||
        request.path.startsWith("/admin/customers") ||
        request.path.startsWith("/customer/devices") ||
        request.path.startsWith("/media") ||
        request.path.startsWith("/craft-items") ||
        request.path.startsWith("/craft-orders") ||
        request.path.startsWith("/loyalty") ||
        request.path.startsWith("/referrals") ||
        request.path.startsWith("/banners") ||
        request.path.startsWith("/public/offers") ||
        request.path.startsWith("/offers") ||
        request.path.startsWith("/admin/offers") ||
        request.path.startsWith("/admin/loyalty") ||
        request.path.startsWith("/admin/android-app") ||
        request.path.startsWith("/android-app") ||
        request.path.startsWith("/seasonal-theme") ||
        request.path.startsWith("/shop") ||
        request.path.startsWith("/admin/shop")
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

import { Router } from "express";
import { z } from "zod";

import { Prisma } from "../../generated/prisma/client.js";
import type { DatabaseClient } from "../../lib/database/database.js";
import { validateRequest } from "../../lib/http/validate-request.js";
import { createRequireAuth, requireRoles } from "../auth/auth.middleware.js";
import {
  closureAnnouncementSchema,
  readClosureAnnouncement,
  saveClosureAnnouncement,
} from "./closure-announcement-settings.js";
import {
  readRepairOrderIntake,
  repairOrderIntakeSchema,
  saveRepairOrderIntake,
} from "./repair-order-intake.js";

const companyInfoSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    description: z.string().trim().max(4000),
    history: z.string().trim().max(4000),
    services: z.array(z.string().trim().min(2).max(160)).max(30),
    phone: z.string().trim().max(32),
    email: z.string().trim().max(320),
    address: z.string().trim().max(500),
    hours: z.string().trim().max(500),
    socials: z
      .array(
        z
          .object({
            label: z.string().trim().min(2).max(80),
            url: z.string().url().max(1000),
          })
          .strict(),
      )
      .max(20),
    requisites: z.string().trim().max(2000),
    mediaUrls: z.array(z.string().url().max(1000)).max(30),
  })
  .strict();

const defaultCompanyInfo: z.infer<typeof companyInfoSchema> = {
  name: "ЕНОТ СЕРВИС",
  description: "Ремонт компьютеров и ноутбуков.",
  history: "",
  services: ["Диагностика", "Ремонт компьютеров и ноутбуков"],
  phone: "",
  email: "",
  address: "",
  hours: "",
  socials: [],
  requisites: "",
  mediaUrls: [],
};

export const createCompanyRouter = (database: DatabaseClient): Router => {
  const router = Router();
  const requireAuth = createRequireAuth(database);

  router.get("/about", async (_request, response) => {
    const setting = await database.appSetting.findUnique({
      where: { key: "company_info" },
    });
    const parsed = companyInfoSchema.safeParse(setting?.value);
    response.json({
      company: parsed.success ? parsed.data : defaultCompanyInfo,
    });
  });

  router.get("/company/order-intake", async (_request, response) => {
    response.set("Cache-Control", "no-store");
    response.json(await readRepairOrderIntake(database));
  });

  router.get("/company/closure-announcement", async (_request, response) => {
    response.set("Cache-Control", "no-store");
    response.json(await readClosureAnnouncement(database));
  });

  router.put(
    "/admin/company/closure-announcement",
    requireAuth,
    requireRoles("ADMIN"),
    validateRequest({ body: closureAnnouncementSchema }),
    async (_request, response) => {
      const settings = (
        response.locals.input as {
          readonly body: z.infer<typeof closureAnnouncementSchema>;
        }
      ).body;
      await saveClosureAnnouncement(database, settings);
      response.set("Cache-Control", "no-store");
      response.json(settings);
    },
  );

  router.put(
    "/admin/company/order-intake",
    requireAuth,
    requireRoles("ADMIN"),
    validateRequest({ body: repairOrderIntakeSchema }),
    async (_request, response) => {
      const setting = (
        response.locals.input as {
          readonly body: z.infer<typeof repairOrderIntakeSchema>;
        }
      ).body;
      await saveRepairOrderIntake(database, setting);
      response.set("Cache-Control", "no-store");
      response.json(setting);
    },
  );

  router.put(
    "/about",
    requireAuth,
    requireRoles("ADMIN"),
    validateRequest({ body: companyInfoSchema }),
    async (_request, response) => {
      const company = (
        response.locals.input as {
          readonly body: z.infer<typeof companyInfoSchema>;
        }
      ).body;
      await database.appSetting.upsert({
        where: { key: "company_info" },
        create: {
          key: "company_info",
          value: company as Prisma.InputJsonValue,
        },
        update: { value: company as Prisma.InputJsonValue },
      });
      response.json({ company });
    },
  );

  return router;
};

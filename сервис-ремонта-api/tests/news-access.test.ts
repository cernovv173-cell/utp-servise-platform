import express from "express";
import assert from "node:assert/strict";
import { once } from "node:events";
import { test } from "node:test";

import { hashSessionToken } from "../src/features/auth/auth.middleware.js";
import { createNewsRouter } from "../src/features/news/news.routes.js";
import type { DatabaseClient } from "../src/lib/database/database.js";
import { errorHandler } from "../src/lib/http/error-handler.js";

const adminToken = "A".repeat(48);
const customerToken = "C".repeat(48);
const technicianToken = "T".repeat(48);

test("only administrators write news and customer-facing reads exclude drafts", async (t) => {
  const users = [
    {
      id: "admin-1",
      email: "admin@test.invalid",
      displayName: "Admin",
      role: "ADMIN" as const,
      active: true,
      mustChangePassword: false,
      token: adminToken,
    },
    {
      id: "customer-1",
      email: "customer@test.invalid",
      displayName: "Customer",
      role: "CUSTOMER" as const,
      active: true,
      mustChangePassword: false,
      token: customerToken,
    },
    {
      id: "tech-1",
      email: "tech@test.invalid",
      displayName: "Technician",
      role: "TECHNICIAN" as const,
      active: true,
      mustChangePassword: false,
      token: technicianToken,
    },
  ];
  const articles = [
    {
      id: "11111111-1111-4111-8111-111111111111",
      title: "Работаем в праздники",
      content: "Принимаем заявки в обычном режиме.",
      isPublished: true,
      startsAt: null,
      endsAt: null,
      isFeatured: false,
      publishedAt: new Date("2026-09-20T12:00:00.000Z"),
      createdById: "admin-1",
    },
    {
      id: "22222222-2222-4222-8222-222222222222",
      title: "Черновик новости",
      content: "Этот текст пока не опубликован.",
      isPublished: false,
      startsAt: null,
      endsAt: null,
      isFeatured: false,
      publishedAt: null,
      createdById: "admin-1",
    },
    {
      id: "44444444-4444-4444-8444-444444444444",
      title: "Будущая публикация",
      content: "Пока не должна отображаться.",
      isPublished: true,
      startsAt: new Date(Date.now() + 60_000),
      endsAt: null,
      isFeatured: true,
      publishedAt: new Date(),
      createdById: "admin-1",
    },
    {
      id: "55555555-5555-4555-8555-555555555555",
      title: "Срок истёк",
      content: "Не должна отображаться.",
      isPublished: true,
      startsAt: null,
      endsAt: new Date(Date.now() - 60_000),
      isFeatured: true,
      publishedAt: new Date(),
      createdById: "admin-1",
    },
  ];
  const client = {
    session: {
      findUnique: async ({ where }: { where: { tokenHash: string } }) => {
        const user = users.find(
          (entry) => hashSessionToken(entry.token) === where.tokenHash,
        );
        return user ? { expiresAt: new Date(Date.now() + 60_000), user } : null;
      },
    },
    newsArticle: {
      findMany: async ({ where }: { where: Record<string, unknown> }) => {
        const now = new Date();
        return articles.filter((article) => {
          if (where.isPublished === undefined) return true;
          return (
            article.isPublished &&
            (!article.startsAt || article.startsAt <= now) &&
            (!article.endsAt || article.endsAt > now)
          );
        });
      },
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const created = {
          id: "33333333-3333-4333-8333-333333333333",
          ...data,
        };
        articles.push(created as (typeof articles)[number]);
        return created;
      },
      findUnique: async ({ where }: { where: { id: string } }) => {
        const article = articles.find((entry) => entry.id === where.id);
        return article
          ? {
              id: article.id,
              isPublished: article.isPublished,
              startsAt: article.startsAt,
            }
          : null;
      },
      update: async ({
        where,
        data,
      }: {
        where: { id: string };
        data: Record<string, unknown>;
      }) => {
        const article = articles.find((entry) => entry.id === where.id);
        assert.ok(article);
        Object.assign(article, data);
        return article;
      },
    },
  };
  const app = express();
  app.use(express.json());
  app.use("/api", createNewsRouter(client as unknown as DatabaseClient));
  app.use(errorHandler);
  const server = app.listen(0);
  await once(server, "listening");
  t.after(() => server.close());
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const baseUrl = `http://127.0.0.1:${address.port}/api/news`;
  const headers = (token: string) => ({
    authorization: `Bearer ${token}`,
    "content-type": "application/json",
  });

  const customerNews = await fetch(baseUrl, {
    headers: headers(customerToken),
  });
  assert.equal(customerNews.status, 200);
  assert.deepEqual(
    (await customerNews.json()).articles.map(
      (article: { title: string }) => article.title,
    ),
    ["Работаем в праздники"],
  );

  const adminNews = await fetch(baseUrl, { headers: headers(adminToken) });
  assert.equal((await adminNews.json()).articles.length, 4);

  const createDraft = await fetch(baseUrl, {
    method: "POST",
    headers: headers(adminToken),
    body: JSON.stringify({
      title: "Режим работы",
      content: "Обновлённый график сервиса.",
    }),
  });
  assert.equal(createDraft.status, 201);
  assert.equal((await createDraft.json()).article.isPublished, false);

  const createScheduled = await fetch(baseUrl, {
    method: "POST",
    headers: headers(adminToken),
    body: JSON.stringify({
      title: "Плановая акция",
      content: "Текст акции для клиентов.",
      isPublished: true,
      startsAt: "2026-10-02T09:00:00.000Z",
      endsAt: "2026-10-05T18:00:00.000Z",
      isFeatured: true,
    }),
  });
  assert.equal(createScheduled.status, 201);
  const scheduledArticle = (await createScheduled.json()).article;
  assert.equal(scheduledArticle.isFeatured, true);
  assert.equal(
    new Date(scheduledArticle.startsAt).toISOString(),
    "2026-10-02T09:00:00.000Z",
  );

  const invalidSchedule = await fetch(baseUrl, {
    method: "POST",
    headers: headers(adminToken),
    body: JSON.stringify({
      title: "Неверный срок",
      content: "Окончание раньше начала.",
      startsAt: "2026-10-05T18:00:00.000Z",
      endsAt: "2026-10-02T09:00:00.000Z",
    }),
  });
  assert.equal(invalidSchedule.status, 400);

  const techCreate = await fetch(baseUrl, {
    method: "POST",
    headers: headers(technicianToken),
    body: JSON.stringify({
      title: "Попытка",
      content: "Недопустимая публикация.",
      isPublished: true,
    }),
  });
  assert.equal(techCreate.status, 403);

  const draftId = "22222222-2222-4222-8222-222222222222";
  const publishDraft = await fetch(`${baseUrl}/${draftId}`, {
    method: "PATCH",
    headers: headers(adminToken),
    body: JSON.stringify({ isPublished: true }),
  });
  assert.equal(publishDraft.status, 200);
  assert.equal((await publishDraft.json()).article.isPublished, true);

  const techPublish = await fetch(`${baseUrl}/${draftId}`, {
    method: "PATCH",
    headers: headers(technicianToken),
    body: JSON.stringify({ isPublished: false }),
  });
  assert.equal(techPublish.status, 403);
});

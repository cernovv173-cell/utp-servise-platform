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
      publishedAt: new Date("2026-09-20T12:00:00.000Z"),
      createdById: "admin-1",
    },
    {
      id: "22222222-2222-4222-8222-222222222222",
      title: "Черновик новости",
      content: "Этот текст пока не опубликован.",
      isPublished: false,
      publishedAt: null,
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
      findMany: async ({ where }: { where: { isPublished?: boolean } }) =>
        articles.filter(
          (article) =>
            where.isPublished === undefined ||
            article.isPublished === where.isPublished,
        ),
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
          ? { id: article.id, isPublished: article.isPublished }
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
  assert.equal((await adminNews.json()).articles.length, 2);

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

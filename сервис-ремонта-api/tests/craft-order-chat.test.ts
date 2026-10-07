import express from "express";
import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";

import { hashSessionToken } from "../src/features/auth/auth.middleware.js";
import { createCraftsRouter } from "../src/features/crafts/crafts.routes.js";
import { createMediaRouter } from "../src/features/media/media.routes.js";
import type { DatabaseClient } from "../src/lib/database/database.js";
import { errorHandler } from "../src/lib/http/error-handler.js";

test("craft-order chat is scoped to its customer and supports private photo messages", async (t) => {
  const ids = {
    admin: "11111111-1111-4111-8111-111111111111",
    customer: "22222222-2222-4222-8222-222222222222",
    other: "33333333-3333-4333-8333-333333333333",
    order: "44444444-4444-4444-8444-444444444444",
  };
  const tokens = {
    admin: "A".repeat(48),
    customer: "C".repeat(48),
    other: "O".repeat(48),
  };
  const users = [
    { id: ids.admin, displayName: "Администратор", role: "ADMIN" as const },
    { id: ids.customer, displayName: "Клиент", role: "CUSTOMER" as const },
    { id: ids.other, displayName: "Другой клиент", role: "CUSTOMER" as const },
  ];
  const byId = new Map(users.map((user) => [user.id, user]));
  const sessions = users.map((user) => ({
    ...user,
    email: `${user.id}@example.test`,
    active: true,
    mustChangePassword: false,
    token:
      tokens[
        user.role === "ADMIN"
          ? "admin"
          : user.id === ids.customer
            ? "customer"
            : "other"
      ],
    expiresAt: new Date(Date.now() + 60_000),
  }));
  const messages: Array<Record<string, any>> = [];
  const imageBytes = Buffer.from([0xff, 0xd8, 0xff]);
  const client = {
    session: {
      findUnique: async ({ where }: { where: { tokenHash: string } }) => {
        const session = sessions.find(
          ({ token }) => hashSessionToken(token) === where.tokenHash,
        );
        if (!session) return null;
        const { token: _token, ...user } = session;
        return { expiresAt: session.expiresAt, user };
      },
    },
    craftOrder: {
      findUnique: async ({ where }: { where: { id: string } }) =>
        where.id === ids.order
          ? { id: ids.order, customerId: ids.customer }
          : null,
    },
    craftOrderChatMessage: {
      findMany: async () =>
        [...messages]
          .sort(
            (left, right) =>
              right.createdAt.getTime() - left.createdAt.getTime(),
          )
          .slice(0, 100)
          .map((message) => ({
            ...message,
            sender: byId.get(message.senderId) ?? null,
          })),
      findFirst: async ({ where }: { where: { imageObjectId: string } }) => {
        const message = messages.find(
          ({ imageObjectId }) => imageObjectId === where.imageObjectId,
        );
        return message ? { craftOrder: { customerId: ids.customer } } : null;
      },
      create: async ({ data }: { data: Record<string, any> }) => {
        const message = {
          id: `message-${messages.length + 1}`,
          createdAt: new Date(),
          ...data,
        };
        messages.push(message);
        return { ...message, sender: byId.get(message.senderId) ?? null };
      },
    },
    user: {
      findMany: async () => [{ id: ids.admin }],
      findFirst: async () => null,
    },
    review: { findFirst: async () => null },
    newsArticle: { findFirst: async () => null },
    craftItem: { findFirst: async () => null },
    siteBanner: { findFirst: async () => null },
  };
  const storage = {
    upload: async () => "craft-order-photo",
    delete: async () => undefined,
    download: async () => ({ contentType: "image/jpeg", bytes: imageBytes }),
  };
  const app = express();
  app.use(express.json());
  app.use(
    "/api",
    createCraftsRouter(client as unknown as DatabaseClient, async () => true),
  );
  app.use(
    "/api",
    createMediaRouter(
      client as unknown as DatabaseClient,
      storage as never,
      async () => true,
    ),
  );
  app.use(errorHandler);
  const server = app.listen(0);
  await once(server, "listening");
  t.after(() => server.close());
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const baseUrl = `http://127.0.0.1:${address.port}/api`;
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  const initial = await fetch(`${baseUrl}/craft-orders/${ids.order}/chat`, {
    headers: auth(tokens.customer),
  });
  assert.equal(initial.status, 200);
  assert.deepEqual((await initial.json()).chat.messages, []);

  const hidden = await fetch(`${baseUrl}/craft-orders/${ids.order}/chat`, {
    headers: auth(tokens.other),
  });
  assert.equal(hidden.status, 404);

  const sent = await fetch(
    `${baseUrl}/craft-orders/${ids.order}/chat/messages`,
    {
      method: "POST",
      headers: { ...auth(tokens.customer), "Content-Type": "application/json" },
      body: JSON.stringify({ content: "Вот фотография изделия." }),
    },
  );
  assert.equal(sent.status, 201);

  const photo = await fetch(`${baseUrl}/craft-orders/${ids.order}/chat/image`, {
    method: "POST",
    headers: { ...auth(tokens.customer), "Content-Type": "image/jpeg" },
    body: imageBytes,
  });
  assert.equal(photo.status, 201);
  assert.equal(messages.at(-1)?.imageObjectId, "craft-order-photo");

  const privateImage = await fetch(`${baseUrl}/media/craft-order-photo`, {
    headers: auth(tokens.customer),
  });
  assert.equal(privateImage.status, 200);
  const deniedImage = await fetch(`${baseUrl}/media/craft-order-photo`, {
    headers: auth(tokens.other),
  });
  assert.equal(deniedImage.status, 404);

  const adminChat = await fetch(`${baseUrl}/craft-orders/${ids.order}/chat`, {
    headers: auth(tokens.admin),
  });
  assert.equal(adminChat.status, 200);
  assert.equal((await adminChat.json()).chat.messages.length, 2);
});

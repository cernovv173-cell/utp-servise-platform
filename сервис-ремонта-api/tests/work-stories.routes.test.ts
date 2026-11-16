import express from "express";
import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";

import { type MediaStorage } from "../src/features/media/media-storage.js";
import { createWorkStoriesRouter } from "../src/features/news/work-stories.routes.js";
import type { DatabaseClient } from "../src/lib/database/database.js";
import { errorHandler } from "../src/lib/http/error-handler.js";

const storyId = "33333333-3333-4333-8333-333333333333";
const imageBytes = Buffer.from([0xff, 0xd8, 0xff, 0x01]);

test("public work stories expose only published story content and photos", async (t) => {
  let visible = true;
  let listQuery: Record<string, unknown> | undefined;
  const database = {
    newsArticle: {
      findMany: async ({ where }: { where: Record<string, unknown> }) => {
        listQuery = where;
        return [
          {
            id: storyId,
            title: "Профилактика ноутбука",
            content:
              "Проблема: перегрев. Что сделали: очистили охлаждение. Результат: штатная работа.",
            imageObjectId: "story-image",
            isFeatured: false,
            publishedAt: new Date("2026-11-16T10:00:00.000Z"),
          },
        ];
      },
      findFirst: async ({ where }: { where: Record<string, any> }) => {
        assert.equal(where.id, storyId);
        assert.equal(where.kind, "WORK_STORY");
        assert.equal(where.isPublished, true);
        return visible ? { imageObjectId: "story-image" } : null;
      },
    },
  };
  const storage: MediaStorage = {
    upload: async () => "unused",
    delete: async () => undefined,
    download: async () => ({ bytes: imageBytes, contentType: "image/jpeg" }),
  };

  const app = express();
  app.use(
    "/api",
    createWorkStoriesRouter(database as unknown as DatabaseClient, storage),
  );
  app.use(errorHandler);
  const server = app.listen(0);
  await once(server, "listening");
  t.after(() => server.close());
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const baseUrl = `http://127.0.0.1:${address.port}/api`;

  const listResponse = await fetch(`${baseUrl}/public/work-stories`);
  assert.equal(listResponse.status, 200);
  const listBody = await listResponse.json();
  assert.equal(listBody.stories[0].title, "Профилактика ноутбука");
  assert.equal(listBody.stories[0].hasImage, true);
  assert.equal("imageObjectId" in listBody.stories[0], false);
  assert.equal(listQuery?.kind as string, "WORK_STORY");
  assert.equal(listQuery?.isPublished, true);

  const imageResponse = await fetch(
    `${baseUrl}/public/work-stories/${storyId}/image`,
  );
  assert.equal(imageResponse.status, 200);
  assert.match(imageResponse.headers.get("cache-control") ?? "", /public/u);
  assert.deepEqual(Buffer.from(await imageResponse.arrayBuffer()), imageBytes);

  visible = false;
  const hiddenImageResponse = await fetch(
    `${baseUrl}/public/work-stories/${storyId}/image`,
  );
  assert.equal(hiddenImageResponse.status, 404);
  assert.equal(
    (await hiddenImageResponse.json()).error.code,
    "WORK_STORY_IMAGE_NOT_FOUND",
  );
});

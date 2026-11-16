import { Router } from "express";
import { z } from "zod";

import type { DatabaseClient } from "../../lib/database/database.js";
import { HttpError } from "../../lib/http/http-error.js";
import { validateRequest } from "../../lib/http/validate-request.js";
import {
  type MediaStorage,
  projectMediaStorage,
} from "../media/media-storage.js";

const storyParams = z.object({ storyId: z.string().uuid() });

const paramsOf = <T>(response: { locals: { input?: unknown } }): T =>
  (response.locals.input as { readonly params: T }).params;

const publicStoryWhere = (now: Date) => ({
  kind: "WORK_STORY" as const,
  isPublished: true,
  AND: [
    { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
    { OR: [{ endsAt: null }, { endsAt: { gt: now } }] },
  ],
});

export const createWorkStoriesRouter = (
  database: DatabaseClient,
  storage: MediaStorage = projectMediaStorage,
): Router => {
  const router = Router();

  router.get("/public/work-stories", async (_request, response) => {
    const stories = await database.newsArticle.findMany({
      where: publicStoryWhere(new Date()),
      select: {
        id: true,
        title: true,
        content: true,
        imageObjectId: true,
        isFeatured: true,
        publishedAt: true,
      },
      orderBy: [
        { isFeatured: "desc" },
        { publishedAt: "desc" },
        { createdAt: "desc" },
      ],
      take: 24,
    });

    response.json({
      stories: stories.map(({ imageObjectId, ...story }) => ({
        ...story,
        hasImage: Boolean(imageObjectId),
      })),
    });
  });

  router.get(
    "/public/work-stories/:storyId/image",
    validateRequest({ params: storyParams }),
    async (_request, response) => {
      const { storyId } = paramsOf<z.infer<typeof storyParams>>(response);
      const story = await database.newsArticle.findFirst({
        where: { id: storyId, ...publicStoryWhere(new Date()) },
        select: { imageObjectId: true },
      });
      if (!story?.imageObjectId) {
        throw new HttpError(
          404,
          "WORK_STORY_IMAGE_NOT_FOUND",
          "Фото примера работы не найдено.",
        );
      }

      const image = await storage.download(story.imageObjectId);
      response
        .setHeader(
          "Cache-Control",
          "public, max-age=300, stale-while-revalidate=3600",
        )
        .type(image.contentType)
        .send(image.bytes);
    },
  );

  return router;
};

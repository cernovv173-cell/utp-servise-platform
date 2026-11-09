import { createFileRoute } from "@tanstack/react-router";

import { GuidesIndexPage } from "@/features/guides/guides-index-page";

import { createPageHead } from "@/lib/seo";

export const Route = createFileRoute("/guides/")({
  component: GuidesIndexPage,
  head: () =>
    createPageHead({
      title: "Памятки по ремонту и уходу за техникой — ЕНОТ СЕРВИС",
      description:
        "Чек-листы перед ремонтом: как подготовить ноутбук, когда проверять охлаждение и что взять с собой в сервисный центр. Советы ЕНОТ СЕРВИС в Пушкино.",
      path: "/guides",
    }),
});

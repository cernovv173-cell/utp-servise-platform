import { createFileRoute } from "@tanstack/react-router";

import { GuideArticlePage } from "@/features/guides/guide-article-page";

import { createPageHead } from "@/lib/seo";

export const Route = createFileRoute("/guides/prepare-laptop")({
  component: () => <GuideArticlePage slug="prepare-laptop" />,
  head: () =>
    createPageHead({
      title: "Как подготовиться к ремонту ноутбука — чек-лист",
      description:
        "Что сделать перед ремонтом ноутбука: сохранить данные, описать неисправность, взять зарядное устройство и документы. Памятка сервисного центра в Пушкино.",
      path: "/guides/prepare-laptop",
    }),
});

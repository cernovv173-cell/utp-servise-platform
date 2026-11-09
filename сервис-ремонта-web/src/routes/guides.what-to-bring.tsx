import { createFileRoute } from "@tanstack/react-router";

import { GuideArticlePage } from "@/features/guides/guide-article-page";

import { createPageHead } from "@/lib/seo";

export const Route = createFileRoute("/guides/what-to-bring")({
  component: () => <GuideArticlePage slug="what-to-bring" />,
  head: () =>
    createPageHead({
      title: "Что взять с собой, сдавая компьютер в ремонт",
      description:
        "Что взять в сервисный центр: компьютер, блок питания, периферию, описание неисправности и документы. Памятка ЕНОТ СЕРВИС в Пушкино.",
      path: "/guides/what-to-bring",
    }),
});

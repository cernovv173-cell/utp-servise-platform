import { createFileRoute } from "@tanstack/react-router";

import { GuideArticlePage } from "@/features/guides/guide-article-page";

import { createPageHead } from "@/lib/seo";

export const Route = createFileRoute("/guides/thermal-paste")({
  component: () => <GuideArticlePage slug="thermal-paste" />,
  head: () =>
    createPageHead({
      title: "Ноутбук греется и шумит — когда проверять охлаждение",
      description:
        "Пять признаков, что ноутбуку нужны чистка и замена термопасты: сильный нагрев, шум вентилятора, внезапные выключения. Советы мастера из Пушкино.",
      path: "/guides/thermal-paste",
    }),
});

import { createFileRoute } from "@tanstack/react-router";

import { GuideArticlePage } from "@/features/guides/guide-article-page";

export const Route = createFileRoute("/guides/thermal-paste")({
  component: () => <GuideArticlePage slug="thermal-paste" />,
});

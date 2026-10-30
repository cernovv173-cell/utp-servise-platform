import { createFileRoute } from "@tanstack/react-router";

import { GuideArticlePage } from "@/features/guides/guide-article-page";

export const Route = createFileRoute("/guides/what-to-bring")({
  component: () => <GuideArticlePage slug="what-to-bring" />,
});

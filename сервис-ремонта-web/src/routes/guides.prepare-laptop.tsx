import { createFileRoute } from "@tanstack/react-router";

import { GuideArticlePage } from "@/features/guides/guide-article-page";

export const Route = createFileRoute("/guides/prepare-laptop")({
  component: () => <GuideArticlePage slug="prepare-laptop" />,
});

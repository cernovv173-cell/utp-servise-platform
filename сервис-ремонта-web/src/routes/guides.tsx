import { createFileRoute } from "@tanstack/react-router";

import { GuidesIndexPage } from "@/features/guides/guides-index-page";

export const Route = createFileRoute("/guides")({ component: GuidesIndexPage });

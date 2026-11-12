import { createFileRoute } from "@tanstack/react-router";

import { CraftsWorkspace } from "@/features/crafts/crafts-workspace";

export const Route = createFileRoute("/crafts")({ component: CraftsWorkspace });

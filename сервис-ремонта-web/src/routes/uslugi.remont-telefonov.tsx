import { createFileRoute } from "@tanstack/react-router";

import { ServiceLandingPage } from "@/features/services/service-landing-page";
import { phoneRepairPage } from "@/features/services/service-pages-content";

import { createPageHead } from "@/lib/seo";

export const Route = createFileRoute("/uslugi/remont-telefonov")({
  component: () => <ServiceLandingPage page={phoneRepairPage} />,
  head: () =>
    createPageHead({
      title: phoneRepairPage.metaTitle,
      description: phoneRepairPage.metaDescription,
      path: phoneRepairPage.path,
    }),
});

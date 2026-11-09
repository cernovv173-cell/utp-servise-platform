import { createFileRoute } from "@tanstack/react-router";

import { ServiceLandingPage } from "@/features/services/service-landing-page";
import { laptopRepairPage } from "@/features/services/service-pages-content";

import { createPageHead } from "@/lib/seo";

export const Route = createFileRoute("/uslugi/remont-noutbukov")({
  component: () => <ServiceLandingPage page={laptopRepairPage} />,
  head: () =>
    createPageHead({
      title: laptopRepairPage.metaTitle,
      description: laptopRepairPage.metaDescription,
      path: laptopRepairPage.path,
    }),
});

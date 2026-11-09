import { createFileRoute } from "@tanstack/react-router";

import { ServiceLandingPage } from "@/features/services/service-landing-page";
import { dataRecoveryPage } from "@/features/services/service-pages-content";

import { createPageHead } from "@/lib/seo";

export const Route = createFileRoute("/uslugi/vosstanovlenie-dannyh")({
  component: () => <ServiceLandingPage page={dataRecoveryPage} />,
  head: () =>
    createPageHead({
      title: dataRecoveryPage.metaTitle,
      description: dataRecoveryPage.metaDescription,
      path: dataRecoveryPage.path,
    }),
});

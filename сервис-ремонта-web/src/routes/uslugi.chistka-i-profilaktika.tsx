import { createFileRoute } from "@tanstack/react-router";

import { ServiceLandingPage } from "@/features/services/service-landing-page";
import { cleaningPage } from "@/features/services/service-pages-content";

import { createPageHead } from "@/lib/seo";

export const Route = createFileRoute("/uslugi/chistka-i-profilaktika")({
  component: () => <ServiceLandingPage page={cleaningPage} />,
  head: () =>
    createPageHead({
      title: cleaningPage.metaTitle,
      description: cleaningPage.metaDescription,
      path: cleaningPage.path,
    }),
});

import { createFileRoute } from "@tanstack/react-router";

import { ServiceLandingPage } from "@/features/services/service-landing-page";
import { screenReplacementPage } from "@/features/services/service-pages-content";

import { createPageHead } from "@/lib/seo";

export const Route = createFileRoute("/uslugi/zamena-ekrana")({
  component: () => <ServiceLandingPage page={screenReplacementPage} />,
  head: () =>
    createPageHead({
      title: screenReplacementPage.metaTitle,
      description: screenReplacementPage.metaDescription,
      path: screenReplacementPage.path,
    }),
});

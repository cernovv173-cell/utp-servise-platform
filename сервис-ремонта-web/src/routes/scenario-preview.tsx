import { createFileRoute } from "@tanstack/react-router";

import { ScenarioPreviewPage } from "@/features/orders/scenario-preview-page";

const ScenarioPreviewRoute = () => {
  if (!import.meta.env.DEV) {
    return (
      <main className="grid min-h-dvh place-items-center px-6 text-center">
        <p className="max-w-md text-sm text-slate-600">
          Предпросмотр доступен только на тестовой площадке.
        </p>
      </main>
    );
  }

  return <ScenarioPreviewPage />;
};

export const Route = createFileRoute("/scenario-preview")({ component: ScenarioPreviewRoute });

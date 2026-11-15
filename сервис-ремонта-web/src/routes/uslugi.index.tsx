import { createFileRoute } from "@tanstack/react-router";

import { ServicesIndexPage } from "@/features/services/services-index-page";

import { createPageHead } from "@/lib/seo";

export const Route = createFileRoute("/uslugi/")({
  component: ServicesIndexPage,
  head: () =>
    createPageHead({
      title: "Услуги сервисного центра в Пушкино — цены и запись | ЕНОТ СЕРВИС",
      description:
        "Ремонт компьютеров и ноутбуков, чистка от пыли, замена экрана и восстановление данных в Пушкино. Цены из действующего прайса, смета до начала работ.",
      path: "/uslugi",
    }),
});

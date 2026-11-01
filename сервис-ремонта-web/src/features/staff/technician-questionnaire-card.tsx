import { Link } from "@tanstack/react-router";

import { SectionCard } from "@/components/app-shell";

export const TechnicianQuestionnaireCard = ({ technicianId }: { technicianId: string }) => (
  <SectionCard>
    <h2 className="font-semibold">Анкета мастера</h2>
    <p className="mt-2 text-sm leading-6 text-slate-500">
      Укажите ФИО, телефон, стаж и фото. Домашний адрес виден только вам и администратору.
    </p>
    <Link
      to="/staff/$technicianId"
      params={{ technicianId }}
      className="mt-4 inline-flex min-h-10 items-center rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700"
    >
      Открыть анкету
    </Link>
  </SectionCard>
);

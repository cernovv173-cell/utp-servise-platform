import { useState } from "react";

const symptomOptions: Record<string, { id: string; label: string; summary: string }[]> = {
  COMPUTER: [
    { id: "power", label: "Не включается", summary: "Не включается." },
    { id: "heat", label: "Сильно шумит или греется", summary: "Сильно шумит или перегревается." },
    { id: "screen", label: "Нет изображения", summary: "Нет изображения на экране." },
    { id: "slow", label: "Медленно работает", summary: "Работает медленно или зависает." },
  ],
  MONOBLOCK: [
    { id: "power", label: "Не включается", summary: "Не включается." },
    { id: "heat", label: "Сильно шумит или греется", summary: "Сильно шумит или перегревается." },
    { id: "screen", label: "Нет изображения", summary: "Нет изображения на экране." },
    { id: "slow", label: "Медленно работает", summary: "Работает медленно или зависает." },
  ],
  LAPTOP: [
    { id: "power", label: "Не включается", summary: "Не включается." },
    { id: "charge", label: "Не заряжается", summary: "Не заряжается или быстро разряжается." },
    {
      id: "screen",
      label: "Проблема с экраном",
      summary: "Есть проблема с изображением на экране.",
    },
    { id: "heat", label: "Греется или шумит", summary: "Сильно греется или шумит." },
  ],
};

export const RepairSymptomGuide = ({
  deviceType,
  onChoose,
}: {
  deviceType: string;
  onChoose: (summary: string) => void;
}) => {
  const [open, setOpen] = useState(false);
  const symptoms = symptomOptions[deviceType] ?? symptomOptions.COMPUTER!;

  return (
    <section className="rounded-xl border border-blue-100 bg-blue-50/70 p-3 text-sm dark:border-blue-900 dark:bg-blue-950/30">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="font-semibold text-blue-800 dark:text-blue-200"
      >
        {open ? "Скрыть подсказки" : "Не знаете, как описать поломку? Подскажем"}
      </button>
      {open && (
        <div className="mt-3 grid gap-3">
          <p className="text-xs leading-5 text-slate-600 dark:text-slate-300">
            Выберите похожий симптом — мы добавим его в описание заявки. Не разбирайте устройство и
            не проверяйте его под напряжением.
          </p>
          <div className="flex flex-wrap gap-2">
            {symptoms.map((symptom) => (
              <button
                key={symptom.id}
                type="button"
                onClick={() => onChoose(symptom.summary)}
                className="min-h-9 rounded-lg border border-blue-200 bg-white px-3 text-xs font-medium text-blue-800 hover:bg-blue-100 dark:border-blue-900 dark:bg-slate-900 dark:text-blue-200"
              >
                {symptom.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  );
};

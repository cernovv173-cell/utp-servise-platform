export const raccoonChapters = [
  {
    number: 1,
    name: "Верстак",
    range: "Уровни 1–20",
    description: "Осваиваем основы и расчищаем рабочий стол для ремонта.",
  },
  {
    number: 2,
    name: "Склад запчастей",
    range: "Уровни 21–40",
    description: "Разбираем коробки и ищем нужные детали среди запчастей.",
  },
  {
    number: 3,
    name: "Электрический щит",
    range: "Уровни 41–60",
    description: "Соединяем цепи и безопасно включаем электрический щит.",
  },
  {
    number: 4,
    name: "Система вентиляции",
    range: "Уровни 61–80",
    description: "Следим за конвейерами и ловим движущиеся детали.",
  },
  {
    number: 5,
    name: "Главный сервер",
    range: "Уровни 81–100",
    description: "Финальная глава: соберите кристаллы и запустите мастерскую.",
  },
] as const;

export const getRaccoonChapter = (level: number) => {
  const safeLevel = Math.min(100, Math.max(1, Math.floor(level)));
  return raccoonChapters[Math.floor((safeLevel - 1) / 20)] ?? raccoonChapters[0];
};

export const getRaccoonMascot = (level: number) => {
  if (level <= 30) {
    return { outfit: "Классический костюм инженера" };
  }
  if (level <= 70) {
    return { outfit: "Защитные очки и пояс с инструментами" };
  }
  return { outfit: "Шлем и светящиеся детали" };
};

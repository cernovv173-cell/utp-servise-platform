import { CircuitBoard, Cpu, Gem, Leaf, type LucideIcon, Snowflake, Zap } from "lucide-react";

export type RaccoonCosmeticId =
  "default" | "forest" | "crystal" | "processor" | "frost" | "first-boot";

export type RaccoonCosmetic = {
  id: RaccoonCosmeticId;
  name: string;
  description: string;
  unlockAt: number;
  chapterNumber: number | null;
  icon: LucideIcon;
  image: string;
};

export const raccoonCosmetics: RaccoonCosmetic[] = [
  {
    id: "default",
    name: "Фирменный визор",
    description: "Любимый визор енота для начала пути.",
    unlockAt: 0,
    chapterNumber: null,
    icon: CircuitBoard,
    image: "/images/raccoon-computer-mascot.jpg",
  },
  {
    id: "forest",
    name: "Лесной мастер",
    description: "Зелёный визор с листьями старого леса.",
    unlockAt: 20,
    chapterNumber: 1,
    icon: Leaf,
    image: "/images/game-cosmetics/forest-visor.webp",
  },
  {
    id: "crystal",
    name: "Кристальный визор",
    description: "Аметистовые линзы из кристальной чащи.",
    unlockAt: 40,
    chapterNumber: 2,
    icon: Gem,
    image: "/images/game-cosmetics/crystal-visor.webp",
  },
  {
    id: "processor",
    name: "Кобальтовый инженер",
    description: "Светящиеся дорожки и ядро процессора.",
    unlockAt: 60,
    chapterNumber: 3,
    icon: Cpu,
    image: "/images/game-cosmetics/processor-visor.webp",
  },
  {
    id: "frost",
    name: "Ледяной визор",
    description: "Прозрачные линзы, украшенные инеем.",
    unlockAt: 80,
    chapterNumber: 4,
    icon: Snowflake,
    image: "/images/game-cosmetics/frost-visor.webp",
  },
  {
    id: "first-boot",
    name: "Первый запуск",
    description: "Золотые линзы главного инженера мастерской.",
    unlockAt: 100,
    chapterNumber: 5,
    icon: Zap,
    image: "/images/game-cosmetics/first-boot-visor.webp",
  },
];

export const getUnlockedRaccoonCosmetics = (completedCount: number) =>
  raccoonCosmetics.filter((cosmetic) => completedCount >= cosmetic.unlockAt);

const selectedCosmeticStorageKey = (userId: string) => `match3:raccoon-cosmetic:v1:${userId}`;

export const readSelectedRaccoonCosmetic = (userId: string): RaccoonCosmeticId => {
  try {
    const stored = window.localStorage.getItem(selectedCosmeticStorageKey(userId));
    return raccoonCosmetics.some((cosmetic) => cosmetic.id === stored)
      ? (stored as RaccoonCosmeticId)
      : "default";
  } catch {
    return "default";
  }
};

export const saveSelectedRaccoonCosmetic = (userId: string, cosmeticId: RaccoonCosmeticId) => {
  try {
    window.localStorage.setItem(selectedCosmeticStorageKey(userId), cosmeticId);
  } catch {
    // The selected cosmetic remains active for this visit if browser storage is unavailable.
  }
};

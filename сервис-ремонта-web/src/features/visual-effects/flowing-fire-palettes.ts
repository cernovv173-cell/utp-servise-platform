import type { FlowingFirePalette } from "@/lib/api";

type PaletteColors = {
  dark: string;
  hot: string;
  label: string;
  light: string;
  mid: string;
};

export const FLOWING_FIRE_PALETTES = {
  EMBER: {
    label: "Янтарный жар",
    dark: "#7c2d12",
    hot: "#f97316",
    light: "#fff1b7",
    mid: "#fb923c",
  },
  CYAN: {
    label: "Ледяной голубой",
    dark: "#164e63",
    hot: "#06b6d4",
    light: "#cffafe",
    mid: "#67e8f9",
  },
  VIOLET: {
    label: "Фиолетовый",
    dark: "#4c1d95",
    hot: "#8b5cf6",
    light: "#ede9fe",
    mid: "#c4b5fd",
  },
  ROSE: {
    label: "Розовый",
    dark: "#881337",
    hot: "#f43f5e",
    light: "#ffe4e6",
    mid: "#fda4af",
  },
  EMERALD: {
    label: "Изумрудный",
    dark: "#065f46",
    hot: "#10b981",
    light: "#d1fae5",
    mid: "#6ee7b7",
  },
  GOLD: {
    label: "Золотой",
    dark: "#78350f",
    hot: "#f59e0b",
    light: "#fef3c7",
    mid: "#fcd34d",
  },
} satisfies Record<FlowingFirePalette, PaletteColors>;

export const FLOWING_FIRE_PALETTE_OPTIONS = (
  Object.entries(FLOWING_FIRE_PALETTES) as [FlowingFirePalette, PaletteColors][]
).map(([value, palette]) => ({ value, label: palette.label }));

export const getFlowingFirePaletteColors = (palette: FlowingFirePalette) =>
  FLOWING_FIRE_PALETTES[palette];

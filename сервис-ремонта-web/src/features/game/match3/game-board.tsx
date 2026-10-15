import { LockKeyhole, Sparkles } from "lucide-react";
import { useState } from "react";

import type { Match3PartKey, Match3Position, Match3Session, Match3Tile } from "./game-api";

const pieceStyles: Record<Match3PartKey, { icon: string; name: string; tone: string }> = {
  processor: { icon: "🧠", name: "процессор", tone: "from-cyan-300/25 to-blue-500/20" },
  ram: { icon: "🧩", name: "память", tone: "from-violet-300/25 to-purple-500/20" },
  ssd: { icon: "💽", name: "накопитель", tone: "from-emerald-300/25 to-teal-500/20" },
  cooling: { icon: "🌀", name: "кулер", tone: "from-sky-200/25 to-cyan-500/20" },
  gpu: { icon: "🎮", name: "видеокарта", tone: "from-fuchsia-300/25 to-pink-500/20" },
  motherboard: { icon: "🟩", name: "плата", tone: "from-green-300/25 to-lime-500/20" },
  power: { icon: "⚡", name: "питание", tone: "from-amber-200/25 to-orange-500/20" },
  case: { icon: "🖥️", name: "корпус", tone: "from-rose-300/25 to-red-500/20" },
};

const isBlocked = (tile: Match3Tile) => tile.frozen || tile.junk || !tile.kind;

const tileDescription = (tile: Match3Tile) => {
  if (tile.junk) return "Мусор — соберите рядом комбинацию";
  if (tile.frozen) return `${pieceStyles[tile.kind!].name}, застывшая магия`;
  if (!tile.kind) return "Пустая ячейка";
  const anomaly = tile.anomalyTurns ? `, аномалия: ${tile.anomalyTurns} хода` : "";
  return pieceStyles[tile.kind].name + anomaly;
};

export const GameBoard = ({
  session,
  disabled,
  onMove,
}: {
  session: Pick<Match3Session, "board">;
  disabled: boolean;
  onMove: (from: Match3Position, to: Match3Position) => void;
}) => {
  const [selected, setSelected] = useState<Match3Position | null>(null);

  const choose = (position: Match3Position, tile: Match3Tile) => {
    if (disabled) return;
    if (isBlocked(tile)) {
      setSelected(null);
      return;
    }
    if (!selected) {
      setSelected(position);
      return;
    }
    if (selected.row === position.row && selected.column === position.column) {
      setSelected(null);
      return;
    }
    const adjacent =
      Math.abs(selected.row - position.row) + Math.abs(selected.column - position.column) === 1;
    if (adjacent) onMove(selected, position);
    setSelected(adjacent ? null : position);
  };

  return (
    <div
      aria-label="Игровое поле 8 на 8. Выберите фишку и соседнюю ячейку, чтобы поменять их местами."
      className="mx-auto grid w-full max-w-[34rem] grid-cols-8 gap-1 rounded-2xl border border-cyan-300/15 bg-[#071022]/80 p-2 shadow-[inset_0_0_28px_rgba(27,82,153,0.16)] sm:gap-1.5 sm:p-3"
      role="group"
    >
      {session.board.map((line, row) =>
        line.map((tile, column) => {
          const position = { row, column };
          const chosen = selected?.row === row && selected.column === column;
          const style = tile.kind ? pieceStyles[tile.kind] : null;
          const accessibleLabel = `Строка ${row + 1}, столбец ${column + 1}: ${tileDescription(tile)}`;
          return (
            <button
              key={`${row}-${column}`}
              type="button"
              aria-label={accessibleLabel}
              aria-pressed={chosen}
              disabled={disabled}
              onClick={() => choose(position, tile)}
              className={`relative grid aspect-square min-w-0 place-items-center overflow-hidden rounded-lg border text-base transition duration-150 sm:rounded-xl sm:text-2xl ${style ? `bg-gradient-to-br ${style.tone}` : "bg-slate-800/70"} ${chosen ? "z-10 scale-105 border-cyan-200 shadow-[0_0_20px_rgba(82,232,255,0.5)] ring-2 ring-cyan-300" : "border-white/10 hover:border-cyan-200/50"} ${disabled ? "opacity-70" : "hover:-translate-y-0.5"}`}
            >
              {tile.junk ? (
                <span aria-hidden="true" className="text-lg sm:text-2xl">
                  🗑️
                </span>
              ) : style ? (
                <span aria-hidden="true" className="drop-shadow-[0_2px_6px_rgba(0,0,0,0.4)]">
                  {style.icon}
                </span>
              ) : null}
              {tile.frozen && (
                <span className="absolute inset-0 grid place-items-center bg-cyan-200/30 text-cyan-50">
                  <LockKeyhole className="size-3 drop-shadow sm:size-4" aria-hidden="true" />
                </span>
              )}
              {tile.anomalyTurns !== null && (
                <span className="absolute top-0 right-0 grid size-4 translate-x-1/4 -translate-y-1/4 place-items-center rounded-full bg-fuchsia-500 text-[9px] text-white sm:size-5 sm:text-[10px]">
                  <Sparkles className="size-2.5 sm:size-3" aria-hidden="true" />
                </span>
              )}
            </button>
          );
        }),
      )}
    </div>
  );
};

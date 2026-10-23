import { useRef } from "react";

import type {
  RaccoonBoard as RaccoonBoardData,
  RaccoonBooster,
  RaccoonObstacle,
  RaccoonPosition,
} from "./raccoon-game-api";
import { raccoonObjectiveNames } from "./raccoon-objectives";
import { RaccoonPartIcon } from "./raccoon-part-icon";

const tileTone = {
  cpu: "from-cyan-200 to-cyan-500 text-cyan-950",
  gpu: "from-violet-200 to-violet-500 text-violet-950",
  ram: "from-emerald-200 to-emerald-500 text-emerald-950",
  ssd: "from-sky-200 to-sky-500 text-sky-950",
  board: "from-lime-200 to-lime-500 text-lime-950",
  fan: "from-slate-200 to-slate-400 text-slate-950",
  gold: "from-amber-100 to-amber-400 text-amber-950",
} as const;

type RaccoonBoardProps = {
  board: RaccoonBoardData;
  obstacles: readonly RaccoonObstacle[];
  selected: RaccoonPosition | null;
  hint: { from: RaccoonPosition; to: RaccoonPosition } | null;
  activeBooster: RaccoonBooster | null;
  disabled?: boolean;
  onTileClick: (position: RaccoonPosition) => void;
  onSwipe: (from: RaccoonPosition, to: RaccoonPosition) => void;
};

export const RaccoonBoard = ({
  board,
  obstacles,
  selected,
  hint,
  activeBooster,
  disabled = false,
  onTileClick,
  onSwipe,
}: RaccoonBoardProps) => {
  const columns = board[0]?.length ?? 6;
  const pointerStart = useRef<{ position: RaccoonPosition; x: number; y: number } | null>(null);
  const skipClick = useRef(false);

  return (
    <div className="mx-auto w-full max-w-[34rem] rounded-[1.65rem] border border-cyan-200/70 bg-gradient-to-br from-cyan-300 via-blue-700 to-blue-950 p-2 shadow-[0_18px_44px_rgba(1,9,32,.65)] sm:p-3">
      <div
        className="grid gap-1 rounded-[1.2rem] border border-white/15 bg-[#071c42]/95 p-1.5 shadow-[inset_0_0_22px_rgba(0,7,29,.75)] sm:gap-1.5 sm:p-2"
        role="grid"
        aria-label="Игровое поле: соберите компьютерные комплектующие"
        style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
        onPointerDown={(event) => {
          if (disabled || !event.isPrimary || (event.pointerType === "mouse" && event.button !== 0))
            return;
          const tile = (event.target as HTMLElement).closest<HTMLButtonElement>(
            "[data-raccoon-tile]",
          );
          if (!tile) return;
          pointerStart.current = {
            position: { row: Number(tile.dataset.row), column: Number(tile.dataset.column) },
            x: event.clientX,
            y: event.clientY,
          };
        }}
        onPointerUp={(event) => {
          const start = pointerStart.current;
          pointerStart.current = null;
          if (!start || disabled) return;
          const deltaX = event.clientX - start.x;
          const deltaY = event.clientY - start.y;
          if (Math.max(Math.abs(deltaX), Math.abs(deltaY)) < 22) return;
          const to =
            Math.abs(deltaX) > Math.abs(deltaY)
              ? { row: start.position.row, column: start.position.column + Math.sign(deltaX) }
              : { row: start.position.row + Math.sign(deltaY), column: start.position.column };
          if (to.row < 0 || to.row >= board.length || to.column < 0 || to.column >= columns) return;
          skipClick.current = true;
          window.setTimeout(() => {
            skipClick.current = false;
          }, 350);
          onSwipe(start.position, to);
        }}
        onPointerCancel={() => {
          pointerStart.current = null;
        }}
      >
        {board.flatMap((row, rowIndex) =>
          row.map((kind, columnIndex) => {
            const position = { row: rowIndex, column: columnIndex };
            if (kind === null) {
              return (
                <span
                  key={`${rowIndex}-${columnIndex}`}
                  className="aspect-square"
                  aria-hidden="true"
                />
              );
            }
            const obstacle = obstacles.find(
              (item) => item.position.row === rowIndex && item.position.column === columnIndex,
            );
            const isSelected = selected?.row === rowIndex && selected.column === columnIndex;
            const isHinted = [hint?.from, hint?.to].some(
              (point) => point?.row === rowIndex && point.column === columnIndex,
            );
            const tileName = raccoonObjectiveNames[kind];

            return (
              <button
                key={`${rowIndex}-${columnIndex}`}
                type="button"
                role="gridcell"
                data-raccoon-tile
                data-row={rowIndex}
                data-column={columnIndex}
                aria-label={`${tileName}${obstacle ? `, ${raccoonObjectiveNames[obstacle.kind]}` : ""}${isHinted ? ", подсказанный ход" : ""}`}
                aria-pressed={isSelected}
                disabled={disabled || (Boolean(obstacle) && !activeBooster)}
                onClick={() => {
                  if (skipClick.current) {
                    skipClick.current = false;
                    return;
                  }
                  onTileClick(position);
                }}
                className={`relative grid aspect-square min-w-0 touch-none place-items-center rounded-lg bg-gradient-to-br ${tileTone[kind]} shadow-[inset_0_2px_2px_rgba(255,255,255,.7),inset_0_-4px_4px_rgba(5,20,50,.25),0_3px_1px_rgba(1,9,30,.6)] ring-1 ring-white/45 transition duration-150 hover:z-10 hover:scale-[1.04] hover:brightness-110 active:scale-95 disabled:cursor-not-allowed disabled:opacity-70 sm:rounded-xl ${isSelected ? "z-20 scale-110 shadow-[0_0_22px_rgba(255,255,255,.95)] ring-4 ring-white" : ""} ${isHinted ? "z-10 animate-pulse shadow-[0_0_18px_rgba(253,230,138,.9)] ring-4 ring-amber-100" : ""}`}
              >
                <RaccoonPartIcon
                  part={kind}
                  className="h-6 w-6 drop-shadow-[0_2px_2px_rgba(8,20,40,.35)] sm:h-9 sm:w-9"
                />
                {obstacle && (
                  <span className="absolute -top-1 -right-1 grid h-5 w-5 place-items-center rounded-full border border-white/70 bg-slate-950 text-white shadow-md sm:h-6 sm:w-6">
                    <RaccoonPartIcon part={obstacle.kind} className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  </span>
                )}
              </button>
            );
          }),
        )}
      </div>
    </div>
  );
};

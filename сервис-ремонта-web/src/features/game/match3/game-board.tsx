import { LockKeyhole, Sparkles } from "lucide-react";
import { type PointerEvent as ReactPointerEvent, useRef, useState } from "react";

import type {
  Match3Board as Match3BoardState,
  Match3Hint,
  Match3PartKey,
  Match3Position,
  Match3Session,
  Match3Tile,
} from "./game-api";
import { getMatch3SwipeMove } from "./match3-swipe";

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

type SwipePreview = {
  from: Match3Position;
  to: Match3Position;
  dx: number;
  dy: number;
  board: Match3BoardState;
};

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
  boosterSelected = false,
  onBoosterTarget,
  hint = null,
}: {
  session: Pick<Match3Session, "board">;
  disabled: boolean;
  onMove: (from: Match3Position, to: Match3Position) => void;
  boosterSelected?: boolean;
  onBoosterTarget?: (target: Match3Position) => void;
  hint?: Match3Hint | null;
}) => {
  const [selected, setSelected] = useState<Match3Position | null>(null);
  const [dragPreview, setDragPreview] = useState<{
    pointerId: number;
    from: Match3Position;
    x: number;
    y: number;
    dx: number;
    dy: number;
  } | null>(null);
  const [swipePreview, setSwipePreview] = useState<SwipePreview | null>(null);
  const visibleSwipePreview = swipePreview?.board === session.board ? swipePreview : null;
  const gesture = useRef<{
    pointerId: number;
    from: Match3Position;
    x: number;
    y: number;
  } | null>(null);
  const suppressClickUntil = useRef(0);

  const beginSwipe = (
    event: ReactPointerEvent<HTMLButtonElement>,
    position: Match3Position,
    tile: Match3Tile,
  ) => {
    if (disabled || boosterSelected || isBlocked(tile) || event.button !== 0) return;
    gesture.current = {
      pointerId: event.pointerId,
      from: position,
      x: event.clientX,
      y: event.clientY,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const moveSwipe = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const current = gesture.current;
    if (!current || current.pointerId !== event.pointerId) return;
    const dx = event.clientX - current.x;
    const dy = event.clientY - current.y;
    if (Math.hypot(dx, dy) < 4) return;
    setDragPreview({ ...current, x: event.clientX, y: event.clientY, dx, dy });
  };

  const finishSwipe = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const current = gesture.current;
    gesture.current = null;
    setDragPreview(null);
    if (!current || current.pointerId !== event.pointerId) return;

    const dx = event.clientX - current.x;
    const dy = event.clientY - current.y;
    if (Math.hypot(dx, dy) >= 24) suppressClickUntil.current = event.timeStamp + 350;
    const swipe = getMatch3SwipeMove(current.from, dx, dy);
    if (!swipe) return;

    const { to } = swipe;
    const targetTile = session.board[to.row]?.[to.column];
    const board = event.currentTarget.parentElement;
    const targetButton = board?.querySelector<HTMLButtonElement>(
      `button[data-match3-cell][data-row="${to.row}"][data-column="${to.column}"]`,
    );
    if (!targetTile || isBlocked(targetTile) || !targetButton) return;

    const sourceButton = event.currentTarget;
    setSwipePreview({
      from: swipe.from,
      to: swipe.to,
      dx: targetButton.offsetLeft - sourceButton.offsetLeft,
      dy: targetButton.offsetTop - sourceButton.offsetTop,
      board: session.board,
    });
    setSelected(null);
    onMove(swipe.from, swipe.to);
  };

  const cancelSwipe = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (gesture.current?.pointerId !== event.pointerId) return;
    gesture.current = null;
    setDragPreview(null);
  };

  const choose = (position: Match3Position, tile: Match3Tile, timeStamp: number) => {
    if (timeStamp < suppressClickUntil.current) return;
    if (disabled) return;
    if (boosterSelected && onBoosterTarget) {
      onBoosterTarget(position);
      setSelected(null);
      return;
    }
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
      aria-label={
        boosterSelected
          ? "Выберите клетку, на которую применить бустер."
          : "Игровое поле 8 на 8. Выберите фишку и соседнюю ячейку, чтобы поменять их местами."
      }
      className="mx-auto grid w-full max-w-[34rem] grid-cols-8 gap-1 rounded-2xl border border-cyan-300/15 bg-[#071022]/80 p-2 shadow-[inset_0_0_28px_rgba(27,82,153,0.16)] sm:gap-1.5 sm:p-3"
      role="group"
    >
      {session.board.map((line, row) =>
        line.map((tile, column) => {
          const position = { row, column };
          const chosen = selected?.row === row && selected.column === column;
          const style = tile.kind ? pieceStyles[tile.kind] : null;
          const isHinted =
            (hint?.from.row === row && hint.from.column === column) ||
            (hint?.to.row === row && hint.to.column === column);
          const accessibleLabel = `Строка ${row + 1}, столбец ${column + 1}: ${tileDescription(tile)}`;
          return (
            <button
              key={`${row}-${column}`}
              data-match3-cell
              data-row={row}
              data-column={column}
              type="button"
              aria-label={accessibleLabel}
              aria-pressed={chosen}
              disabled={disabled}
              onPointerDown={(event) => beginSwipe(event, position, tile)}
              onPointerMove={moveSwipe}
              onPointerUp={finishSwipe}
              onPointerCancel={cancelSwipe}
              onClick={(event) => choose(position, tile, event.timeStamp)}
              style={{
                transform:
                  dragPreview?.from.row === row && dragPreview.from.column === column
                    ? `translate(${dragPreview.dx}px, ${dragPreview.dy}px)`
                    : visibleSwipePreview?.from.row === row &&
                        visibleSwipePreview.from.column === column
                      ? `translate(${visibleSwipePreview.dx}px, ${visibleSwipePreview.dy}px)`
                      : visibleSwipePreview?.to.row === row &&
                          visibleSwipePreview.to.column === column
                        ? `translate(${-visibleSwipePreview.dx}px, ${-visibleSwipePreview.dy}px)`
                        : undefined,
                transitionDuration:
                  dragPreview?.from.row === row && dragPreview.from.column === column
                    ? "0ms"
                    : undefined,
                zIndex:
                  dragPreview?.from.row === row && dragPreview.from.column === column
                    ? 20
                    : visibleSwipePreview &&
                        ((visibleSwipePreview.from.row === row &&
                          visibleSwipePreview.from.column === column) ||
                          (visibleSwipePreview.to.row === row &&
                            visibleSwipePreview.to.column === column))
                      ? 10
                      : undefined,
              }}
              className={`relative grid aspect-square min-w-0 touch-none place-items-center overflow-hidden rounded-lg border text-base transition-transform duration-200 ease-out sm:rounded-xl sm:text-2xl ${style ? `bg-gradient-to-br ${style.tone}` : "bg-slate-800/70"} ${chosen ? "z-10 scale-105 border-cyan-200 shadow-[0_0_20px_rgba(82,232,255,0.5)] ring-2 ring-cyan-300" : isHinted ? "z-10 border-amber-200 shadow-[0_0_18px_rgba(252,211,77,0.55)] ring-2 ring-amber-300" : "border-white/10 hover:border-cyan-200/50"} ${disabled ? "opacity-70" : "hover:-translate-y-0.5"}`}
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

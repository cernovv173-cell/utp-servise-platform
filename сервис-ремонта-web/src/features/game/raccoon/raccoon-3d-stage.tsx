import { Component, type ReactNode, Suspense, lazy } from "react";

import { Raccoon3DFallback } from "./raccoon-3d-fallback";
import type {
  RaccoonBoard as RaccoonBoardData,
  RaccoonBooster,
  RaccoonObstacle,
  RaccoonPosition,
} from "./raccoon-game-api";
import { raccoonObjectiveNames } from "./raccoon-objectives";

const Raccoon3DCanvas = lazy(() =>
  import("./raccoon-3d-canvas").then(({ Raccoon3DCanvas: Canvas }) => ({ default: Canvas })),
);

export type Raccoon3DStageProps = {
  board: RaccoonBoardData;
  obstacles: readonly RaccoonObstacle[];
  level: number;
  electricShift: number;
  selected: RaccoonPosition | null;
  hint: { from: RaccoonPosition; to: RaccoonPosition } | null;
  activeBooster: RaccoonBooster | null;
  disabled?: boolean;
  celebrating?: boolean;
  onTileClick: (position: RaccoonPosition) => void;
  onSwipe: (from: RaccoonPosition, to: RaccoonPosition) => void;
};

type BoundaryProps = { children: ReactNode; fallback: ReactNode };
type BoundaryState = { failed: boolean };

class RaccoonSceneErrorBoundary extends Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { failed: false };

  static getDerivedStateFromError(): BoundaryState {
    return { failed: true };
  }

  componentDidCatch(error: Error) {
    if (import.meta.env.DEV) console.error("3D-игра переключена в облегчённый режим:", error);
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

export const Raccoon3DStage = (props: Raccoon3DStageProps) => (
  <div className="relative mx-auto h-[min(76vh,34rem)] min-h-[25rem] w-full max-w-4xl touch-none overflow-hidden rounded-[1.55rem] border border-amber-200/35 bg-[#1a120e] shadow-[0_22px_56px_rgba(0,0,0,.4)] landscape:h-[min(65dvh,31rem)] landscape:min-h-[12rem] landscape:max-w-none">
    <RaccoonSceneErrorBoundary
      fallback={
        <Raccoon3DFallback
          {...props}
          message="3D-сцена недоступна на этом устройстве. Уровень открыт в облегченном режиме."
        />
      }
    >
      <Suspense
        fallback={<Raccoon3DFallback {...props} message="Загружаем 3D-сцену мастерской…" />}
      >
        <Raccoon3DCanvas {...props} />
      </Suspense>
    </RaccoonSceneErrorBoundary>
    <div className="sr-only" role="grid" aria-label="Игровое поле 3D, выбор комплектующих">
      {props.board.map((row, rowIndex) => (
        <div key={rowIndex} role="row">
          {row.map((part, columnIndex) => {
            if (!part) return <span key={columnIndex} aria-hidden="true" />;
            const position = { row: rowIndex, column: columnIndex };
            const obstacle = props.obstacles.find(
              (item) => item.position.row === rowIndex && item.position.column === columnIndex,
            );
            const selected =
              props.selected?.row === rowIndex && props.selected.column === columnIndex;
            return (
              <button
                key={columnIndex}
                type="button"
                role="gridcell"
                aria-label={`${raccoonObjectiveNames[part]}${obstacle ? `, ${raccoonObjectiveNames[obstacle.kind]}` : ""}`}
                aria-pressed={selected}
                disabled={props.disabled || (Boolean(obstacle) && !props.activeBooster)}
                className="focus:not-sr-only"
                onClick={() => props.onTileClick(position)}
              >
                Ряд ${rowIndex + 1}, столбец ${columnIndex + 1}: {raccoonObjectiveNames[part]}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  </div>
);

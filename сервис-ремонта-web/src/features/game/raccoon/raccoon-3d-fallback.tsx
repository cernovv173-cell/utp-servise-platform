import { RaccoonBoard as RaccoonBoard2D } from "./raccoon-board";
import type {
  RaccoonBoard as RaccoonBoardData,
  RaccoonBooster,
  RaccoonObstacle,
  RaccoonPosition,
} from "./raccoon-game-api";

export type Raccoon3DFallbackProps = {
  board: RaccoonBoardData;
  obstacles: readonly RaccoonObstacle[];
  level: number;
  electricShift: number;
  selected: RaccoonPosition | null;
  hint: { from: RaccoonPosition; to: RaccoonPosition } | null;
  activeBooster: RaccoonBooster | null;
  disabled?: boolean;
  message?: string;
  onTileClick: (position: RaccoonPosition) => void;
  onSwipe: (from: RaccoonPosition, to: RaccoonPosition) => void;
};

export const Raccoon3DFallback = ({ message, ...boardProps }: Raccoon3DFallbackProps) => (
  <div className="grid gap-2">
    {message && (
      <p className="rounded-lg border border-amber-100/20 bg-[#20150f]/90 px-3 py-2 text-center text-xs font-semibold text-amber-100">
        {message}
      </p>
    )}
    <RaccoonBoard2D {...boardProps} />
  </div>
);

import { useThree } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef } from "react";
import { ExtrudeGeometry, Shape } from "three";

import {
  RACCOON_CELL_SIZE,
  getRaccoonBoardCells3D,
  getRaccoonGestureResult,
} from "./raccoon-3d-geometry";
import { RaccoonMascot3D } from "./raccoon-3d-mascot";
import {
  Raccoon3DBoardPiece,
  type Raccoon3DInteraction,
  type RaccoonDragStart,
} from "./raccoon-3d-pieces";
import { RaccoonWorkshop } from "./raccoon-3d-workshop";
import type {
  RaccoonBoard as RaccoonBoardData,
  RaccoonBooster,
  RaccoonObstacle,
  RaccoonPosition,
} from "./raccoon-game-api";

type RaccoonThreeWorldProps = {
  board: RaccoonBoardData;
  obstacles: readonly RaccoonObstacle[];
  level: number;
  electricShift: number;
  selected: RaccoonPosition | null;
  hint: { from: RaccoonPosition; to: RaccoonPosition } | null;
  activeBooster: RaccoonBooster | null;
  disabled: boolean;
  celebrating: boolean;
  onTileClick: (position: RaccoonPosition) => void;
  onSwipe: (from: RaccoonPosition, to: RaccoonPosition) => void;
};

const GearPlatform = () => {
  const geometry = useMemo(() => {
    const shape = new Shape();
    const teeth = 14;
    const rootRadius = 3.65;
    const tipRadius = 4.02;
    const points = Array.from({ length: teeth }, (_, tooth) => {
      const center = (tooth / teeth) * Math.PI * 2;
      const halfTooth = Math.PI / teeth;
      return [
        [center - halfTooth, rootRadius],
        [center - halfTooth * 0.62, tipRadius],
        [center + halfTooth * 0.62, tipRadius],
        [center + halfTooth, rootRadius],
      ] as const;
    }).flat();

    points.forEach(([angle, radius], index) => {
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      if (index === 0) shape.moveTo(x, y);
      else shape.lineTo(x, y);
    });
    shape.closePath();
    return new ExtrudeGeometry(shape, {
      depth: 0.22,
      bevelEnabled: true,
      bevelSegments: 2,
      bevelSize: 0.09,
      bevelThickness: 0.08,
      curveSegments: 4,
    });
  }, []);

  useLayoutEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <mesh
      geometry={geometry}
      position={[0, -0.12, 0]}
      rotation={[-Math.PI / 2, 0, 0]}
      castShadow
      receiveShadow
    >
      <meshStandardMaterial color="#c68137" metalness={0.78} roughness={0.28} />
    </mesh>
  );
};

const BoardTable = ({ finalBoss }: { finalBoss: boolean }) => (
  <group>
    {!finalBoss && (
      <mesh position={[0, -0.11, 0]} castShadow receiveShadow>
        <boxGeometry args={[7.7, 0.22, 7.7]} />
        <meshStandardMaterial color="#67432d" metalness={0.3} roughness={0.54} />
      </mesh>
    )}
    {finalBoss && <GearPlatform />}
  </group>
);

const BoardCells = ({ board }: { board: RaccoonBoardData }) => {
  const cells = useMemo(() => getRaccoonBoardCells3D(board), [board]);
  return (
    <group>
      {cells.map((cell) => (
        <mesh
          key={`${cell.position.row}-${cell.position.column}`}
          position={[cell.world[0], 0.035, cell.world[2]]}
          receiveShadow
        >
          <boxGeometry args={[RACCOON_CELL_SIZE, 0.16, RACCOON_CELL_SIZE]} />
          <meshStandardMaterial color="#382820" metalness={0.56} roughness={0.4} />
        </mesh>
      ))}
    </group>
  );
};

const BoardFrame = ({ finalBoss, glow }: { finalBoss: boolean; glow: string }) => (
  <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
    <torusGeometry args={[4.05, finalBoss ? 0.055 : 0.032, 8, 56]} />
    <meshStandardMaterial
      color={finalBoss ? "#f5c76b" : glow}
      emissive={glow}
      emissiveIntensity={finalBoss ? 0.8 : 0.32}
      metalness={0.78}
      roughness={0.24}
    />
  </mesh>
);

const InteractiveBoard = ({
  board,
  obstacles,
  level,
  electricShift,
  selected,
  hint,
  activeBooster,
  disabled,
  onTileClick,
  onSwipe,
}: Pick<
  RaccoonThreeWorldProps,
  | "board"
  | "obstacles"
  | "level"
  | "electricShift"
  | "selected"
  | "hint"
  | "activeBooster"
  | "disabled"
  | "onTileClick"
  | "onSwipe"
>) => {
  const gesture = useRef<RaccoonDragStart | null>(null);
  const finalBoss = level === 100;
  const chapter = Math.ceil(level / 20);
  const beginPointerGesture = (position: RaccoonPosition, x: number, y: number) => {
    if (!disabled) gesture.current = { position, x, y };
  };
  const finishPointerGesture = (x: number, y: number) => {
    const start = gesture.current;
    gesture.current = null;
    if (!start || disabled) return;
    const result = getRaccoonGestureResult(
      start.position,
      x - start.x,
      y - start.y,
      board.length,
      board[0]?.length ?? 0,
    );
    if (result.kind === "swipe") onSwipe(result.from, result.to);
    else onTileClick(result.position);
  };
  const interaction: Raccoon3DInteraction = {
    disabled,
    activeBooster,
    board,
    onPointerDown: beginPointerGesture,
    onPointerUp: finishPointerGesture,
    onTileClick,
    onSwipe,
  };
  const cells = getRaccoonBoardCells3D(board);
  const palette = chapter === 5 ? "#59e5ff" : chapter === 3 ? "#5de4f5" : "#e7b66b";

  return (
    <group>
      <BoardTable finalBoss={finalBoss} />
      <BoardCells board={board} />
      <BoardFrame finalBoss={finalBoss} glow={palette} />
      {cells.map((cell) => {
        const obstacle = obstacles.find(
          (item) =>
            item.position.row === cell.position.row &&
            item.position.column === cell.position.column,
        );
        const isSelected =
          selected?.row === cell.position.row && selected.column === cell.position.column;
        const isHinted = [hint?.from, hint?.to].some(
          (point) => point?.row === cell.position.row && point.column === cell.position.column,
        );
        return (
          <Raccoon3DBoardPiece
            key={`${cell.position.row}-${cell.position.column}`}
            part={cell.part}
            position={cell.position}
            selected={isSelected}
            hinted={isHinted}
            obstacle={obstacle}
            electricShift={electricShift}
            interaction={interaction}
          />
        );
      })}
    </group>
  );
};

export const RaccoonThreeWorld = (props: RaccoonThreeWorldProps) => {
  const { size } = useThree();
  const chapter = Math.ceil(props.level / 20);
  const compact = size.width < 680;
  const mascotPosition: [number, number, number] = compact
    ? [0, -0.08, -4.2]
    : [-4.45, -0.08, -2.25];

  return (
    <>
      <RaccoonWorkshop chapter={chapter} />
      <InteractiveBoard {...props} />
      <RaccoonMascot3D
        level={props.level}
        celebrating={props.celebrating}
        position={mascotPosition}
        scale={compact ? 0.78 : 0.9}
      />
    </>
  );
};

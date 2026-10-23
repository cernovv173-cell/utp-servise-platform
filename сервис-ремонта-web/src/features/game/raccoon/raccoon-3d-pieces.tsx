import { type ThreeEvent, useFrame } from "@react-three/fiber";
import { useRef, useState } from "react";
import type { Group } from "three";

import { RACCOON_CELL_SIZE, RACCOON_CELL_STEP, raccoonPartColors } from "./raccoon-3d-geometry";
import type {
  RaccoonBoard,
  RaccoonBooster,
  RaccoonObstacle,
  RaccoonPart,
  RaccoonPosition,
} from "./raccoon-game-api";

export type RaccoonDragStart = {
  position: RaccoonPosition;
  x: number;
  y: number;
};

export type Raccoon3DInteraction = {
  disabled: boolean;
  activeBooster: RaccoonBooster | null;
  board: RaccoonBoard;
  onPointerDown: (position: RaccoonPosition, x: number, y: number) => void;
  onPointerUp: (x: number, y: number) => void;
  onTileClick: (position: RaccoonPosition) => void;
  onSwipe: (from: RaccoonPosition, to: RaccoonPosition) => void;
};

const PartModel = ({ part }: { part: RaccoonPart }) => {
  const tint = raccoonPartColors[part];
  switch (part) {
    case "cpu":
      return (
        <group>
          <mesh castShadow>
            <boxGeometry args={[0.58, 0.14, 0.58]} />
            <meshStandardMaterial color="#233033" metalness={0.72} roughness={0.3} />
          </mesh>
          <mesh position={[0, 0.105, 0]}>
            <boxGeometry args={[0.39, 0.08, 0.39]} />
            <meshStandardMaterial
              color={tint}
              metalness={0.36}
              roughness={0.22}
              emissive="#0b6c63"
              emissiveIntensity={0.48}
            />
          </mesh>
          <mesh position={[0, 0.17, 0]}>
            <octahedronGeometry args={[0.13, 0]} />
            <meshStandardMaterial
              color="#d7fff4"
              metalness={0.25}
              roughness={0.12}
              emissive={tint}
              emissiveIntensity={0.7}
            />
          </mesh>
        </group>
      );
    case "gpu":
      return (
        <group>
          <mesh castShadow>
            <boxGeometry args={[0.76, 0.11, 0.46]} />
            <meshStandardMaterial color="#34294d" metalness={0.58} roughness={0.34} />
          </mesh>
          {[-0.19, 0.19].map((x) => (
            <group key={x} position={[x, 0.095, 0]}>
              <mesh rotation={[Math.PI / 2, 0, 0]}>
                <cylinderGeometry args={[0.115, 0.115, 0.04, 14]} />
                <meshStandardMaterial color={tint} metalness={0.42} roughness={0.27} />
              </mesh>
              <mesh position={[0, 0.045, 0]}>
                <cylinderGeometry args={[0.075, 0.075, 0.035, 8]} />
                <meshStandardMaterial color="#171321" metalness={0.2} roughness={0.4} />
              </mesh>
            </group>
          ))}
          <mesh position={[0, 0.087, 0.19]}>
            <boxGeometry args={[0.52, 0.045, 0.035]} />
            <meshStandardMaterial color="#f5c567" metalness={0.8} roughness={0.25} />
          </mesh>
        </group>
      );
    case "ram":
      return (
        <group>
          <mesh castShadow>
            <boxGeometry args={[0.78, 0.1, 0.26]} />
            <meshStandardMaterial color="#1f493e" metalness={0.58} roughness={0.34} />
          </mesh>
          {[-0.22, 0, 0.22].map((x) => (
            <mesh key={x} position={[x, 0.08, 0]}>
              <boxGeometry args={[0.13, 0.07, 0.18]} />
              <meshStandardMaterial
                color={tint}
                metalness={0.34}
                roughness={0.24}
                emissive="#17603d"
                emissiveIntensity={0.35}
              />
            </mesh>
          ))}
          {[-0.3, -0.18, -0.06, 0.06, 0.18, 0.3].map((x) => (
            <mesh key={x} position={[x, -0.075, 0.1]}>
              <boxGeometry args={[0.065, 0.035, 0.045]} />
              <meshStandardMaterial color="#e6ba61" metalness={0.82} roughness={0.25} />
            </mesh>
          ))}
        </group>
      );
    case "ssd":
      return (
        <group>
          <mesh castShadow>
            <boxGeometry args={[0.69, 0.1, 0.42]} />
            <meshStandardMaterial color="#193b53" metalness={0.66} roughness={0.3} />
          </mesh>
          <mesh position={[0, 0.082, 0]}>
            <boxGeometry args={[0.28, 0.07, 0.25]} />
            <meshStandardMaterial
              color={tint}
              metalness={0.45}
              roughness={0.22}
              emissive="#075878"
              emissiveIntensity={0.4}
            />
          </mesh>
          {[-0.22, 0.22].map((x) => (
            <mesh key={x} position={[x, 0.082, 0]}>
              <boxGeometry args={[0.06, 0.035, 0.28]} />
              <meshStandardMaterial color="#a8e9ff" metalness={0.3} roughness={0.22} />
            </mesh>
          ))}
        </group>
      );
    case "board":
      return (
        <group>
          <mesh castShadow>
            <boxGeometry args={[0.62, 0.1, 0.62]} />
            <meshStandardMaterial color="#38583b" metalness={0.5} roughness={0.39} />
          </mesh>
          <mesh position={[0, 0.09, 0]}>
            <boxGeometry args={[0.24, 0.08, 0.24]} />
            <meshStandardMaterial color="#202b29" metalness={0.64} roughness={0.24} />
          </mesh>
          {[
            [-0.2, 0.1, -0.2],
            [0.2, 0.1, -0.2],
            [-0.2, 0.1, 0.2],
            [0.2, 0.1, 0.2],
          ].map(([x, y, z]) => (
            <mesh key={`${x}-${z}`} position={[x, y, z]}>
              <boxGeometry args={[0.1, 0.085, 0.1]} />
              <meshStandardMaterial color={tint} metalness={0.38} roughness={0.3} />
            </mesh>
          ))}
        </group>
      );
    case "fan":
      return (
        <group>
          <mesh castShadow>
            <cylinderGeometry args={[0.29, 0.29, 0.13, 16]} />
            <meshStandardMaterial color="#354044" metalness={0.74} roughness={0.28} />
          </mesh>
          {[0, (Math.PI * 2) / 3, (Math.PI * 4) / 3].map((angle) => (
            <mesh
              key={angle}
              position={[Math.sin(angle) * 0.1, 0.12, Math.cos(angle) * 0.1]}
              rotation={[0, angle, 0.28]}
            >
              <boxGeometry args={[0.13, 0.045, 0.25]} />
              <meshStandardMaterial color={tint} metalness={0.55} roughness={0.31} />
            </mesh>
          ))}
          <mesh position={[0, 0.15, 0]}>
            <sphereGeometry args={[0.085, 12, 8]} />
            <meshStandardMaterial color="#f3bf66" metalness={0.7} roughness={0.2} />
          </mesh>
        </group>
      );
    case "gold":
      return (
        <group>
          <mesh castShadow>
            <octahedronGeometry args={[0.37, 0]} />
            <meshPhysicalMaterial
              color={tint}
              metalness={0.74}
              roughness={0.13}
              clearcoat={0.8}
              clearcoatRoughness={0.12}
              emissive="#b36a00"
              emissiveIntensity={0.42}
            />
          </mesh>
          <mesh position={[0, 0, 0.02]} scale={[0.38, 0.38, 0.38]}>
            <octahedronGeometry args={[0.37, 0]} />
            <meshBasicMaterial color="#fff3ad" wireframe transparent opacity={0.54} />
          </mesh>
        </group>
      );
  }
};

const Raccoon3DObstacle = ({
  obstacle,
  electricShift,
}: {
  obstacle: RaccoonObstacle;
  electricShift: number;
}) => {
  if (obstacle.kind === "crate") {
    return (
      <group position={[0, 0.31, 0]}>
        <mesh castShadow>
          <boxGeometry args={[0.62, 0.54, 0.62]} />
          <meshStandardMaterial color="#8b532d" roughness={0.84} />
        </mesh>
        {[-0.2, 0, 0.2].map((x) => (
          <mesh key={x} position={[x, 0, 0.322]}>
            <boxGeometry args={[0.055, 0.55, 0.025]} />
            <meshStandardMaterial color="#d3924f" roughness={0.69} />
          </mesh>
        ))}
        <mesh position={[0, 0.03, 0.34]}>
          <boxGeometry args={[0.23, 0.13, 0.035]} />
          <meshStandardMaterial color="#eac06f" metalness={0.18} roughness={0.5} />
        </mesh>
      </group>
    );
  }

  return (
    <group position={[0, 0.34, 0]} rotation={[0, electricShift * 0.22, 0]}>
      <mesh position={[0, 0.1, 0]}>
        <torusGeometry args={[0.25, 0.045, 8, 18]} />
        <meshStandardMaterial
          color="#66f4ff"
          emissive="#22d8ed"
          emissiveIntensity={1.8}
          metalness={0.55}
          roughness={0.2}
        />
      </mesh>
      <mesh position={[0, 0.1, 0]}>
        <sphereGeometry args={[0.14, 10, 8]} />
        <meshStandardMaterial
          color="#b7fbff"
          emissive="#27e7fa"
          emissiveIntensity={1.6}
          roughness={0.13}
        />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * 0.31, 0, 0]}>
          <cylinderGeometry args={[0.055, 0.075, 0.52, 8]} />
          <meshStandardMaterial color="#82939a" metalness={0.76} roughness={0.3} />
        </mesh>
      ))}
    </group>
  );
};

export const Raccoon3DBoardPiece = ({
  part,
  position,
  selected,
  hinted,
  obstacle,
  electricShift,
  interaction,
}: {
  part: RaccoonPart;
  position: RaccoonPosition;
  selected: boolean;
  hinted: boolean;
  obstacle?: RaccoonObstacle;
  electricShift: number;
  interaction: Raccoon3DInteraction;
}) => {
  const group = useRef<Group>(null);
  const [hovered, setHovered] = useState(false);
  const rowCount = interaction.board.length;
  const columnCount = interaction.board[0]?.length ?? 0;
  const x = (position.column - (columnCount - 1) / 2) * RACCOON_CELL_STEP;
  const z = (position.row - (rowCount - 1) / 2) * RACCOON_CELL_STEP;
  const canInteract = !interaction.disabled && (!obstacle || interaction.activeBooster !== null);

  useFrame(({ clock }, delta) => {
    if (!group.current) return;
    const time = clock.elapsedTime + position.row * 0.37 + position.column * 0.19;
    const targetScale = selected ? 1.18 : hovered && canInteract ? 1.08 : 1;
    const currentScale = group.current.scale.x;
    const nextScale = currentScale + (targetScale - currentScale) * Math.min(1, delta * 12);
    group.current.scale.setScalar(nextScale);
    if (!selected && !obstacle) {
      group.current.rotation.y += delta * (part === "fan" ? 0.5 : 0.11);
      group.current.position.y = 0.36 + Math.sin(time * 1.8) * 0.025;
    }
  });

  const onPointerDown = (event: ThreeEvent<PointerEvent>) => {
    if (!canInteract || (event.pointerType === "mouse" && event.button !== 0)) return;
    event.stopPropagation();
    interaction.onPointerDown(position, event.clientX, event.clientY);
  };

  const onPointerUp = (event: ThreeEvent<PointerEvent>) => {
    if (!canInteract) return;
    event.stopPropagation();
    interaction.onPointerUp(event.clientX, event.clientY);
  };

  return (
    <group
      ref={group}
      position={[x, 0.36, z]}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerOver={(event) => {
        event.stopPropagation();
        setHovered(true);
      }}
      onPointerOut={() => setHovered(false)}
    >
      {selected || hinted ? (
        <mesh position={[0, -0.15, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <torusGeometry args={[RACCOON_CELL_SIZE * 0.48, 0.035, 8, 24]} />
          <meshStandardMaterial
            color={hinted ? "#ffe183" : "#e9ffff"}
            emissive={hinted ? "#d69927" : "#28cadd"}
            emissiveIntensity={hinted ? 1.15 : 1.45}
            metalness={0.38}
            roughness={0.22}
          />
        </mesh>
      ) : null}
      <PartModel part={part} />
      {obstacle && <Raccoon3DObstacle obstacle={obstacle} electricShift={electricShift} />}
    </group>
  );
};

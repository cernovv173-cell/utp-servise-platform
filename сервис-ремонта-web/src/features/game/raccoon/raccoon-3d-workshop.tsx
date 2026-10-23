import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import type { Group, Mesh } from "three";

import { raccoonChapterLighting } from "./raccoon-3d-geometry";
import { Raccoon3DWorkshopModels } from "./raccoon-3d-workshop-models";

const Shelf = ({ x, color }: { x: number; color: string }) => (
  <group position={[x, 0, -4.15]}>
    <mesh position={[0, 1.05, 0]} castShadow>
      <boxGeometry args={[1.1, 2.2, 0.22]} />
      <meshStandardMaterial color="#34251e" metalness={0.32} roughness={0.68} />
    </mesh>
    {[-0.68, 0, 0.68].map((y) => (
      <mesh key={y} position={[0, y, 0.16]} castShadow>
        <boxGeometry args={[1.18, 0.1, 0.58]} />
        <meshStandardMaterial color={color} metalness={0.34} roughness={0.53} />
      </mesh>
    ))}
    {[-0.32, 0.34].map((xOffset, index) => (
      <mesh key={xOffset} position={[xOffset, -0.44 + index * 0.22, 0.19]} castShadow>
        <boxGeometry args={[0.36, 0.34, 0.3]} />
        <meshStandardMaterial color={index ? "#956037" : "#646f68"} roughness={0.76} />
      </mesh>
    ))}
  </group>
);

const Workbench = () => (
  <group>
    <mesh position={[0, -0.33, 0]} receiveShadow castShadow>
      <boxGeometry args={[11, 0.38, 9]} />
      <meshStandardMaterial color="#70462c" metalness={0.12} roughness={0.72} />
    </mesh>
    {[-3.5, -2.35, -1.18, 0, 1.18, 2.35, 3.5].map((x) => (
      <mesh key={x} position={[x, -0.128, 0]}>
        <boxGeometry args={[0.025, 0.012, 8.7]} />
        <meshStandardMaterial color="#a56c42" roughness={0.77} />
      </mesh>
    ))}
    {[-4.8, 4.8].flatMap((x) =>
      [-3.7, 3.7].map((z) => (
        <mesh key={`${x}-${z}`} position={[x, -1.15, z]} castShadow>
          <boxGeometry args={[0.28, 1.7, 0.28]} />
          <meshStandardMaterial color="#3e2920" metalness={0.2} roughness={0.68} />
        </mesh>
      )),
    )}
    <mesh position={[0, -1.95, 0]}>
      <boxGeometry args={[11.3, 0.18, 9.3]} />
      <meshStandardMaterial color="#30221b" metalness={0.26} roughness={0.64} />
    </mesh>
  </group>
);

const ChapterOneProps = ({ glow }: { glow: string }) => (
  <group>
    <Shelf x={-4.05} color="#70482f" />
    <Shelf x={4.05} color="#70482f" />
    <mesh position={[0, 3.35, -4.55]} castShadow>
      <boxGeometry args={[1.25, 0.11, 0.12]} />
      <meshStandardMaterial
        color="#e6aa61"
        metalness={0.65}
        roughness={0.31}
        emissive={glow}
        emissiveIntensity={0.28}
      />
    </mesh>
    <mesh position={[0, 3.17, -4.55]}>
      <sphereGeometry args={[0.11, 12, 8]} />
      <meshBasicMaterial color={glow} />
    </mesh>
  </group>
);

const ChapterTwoProps = ({ accent }: { accent: string }) => (
  <group>
    {[-4.25, 4.25].map((x) => (
      <group key={x} position={[x, 0.1, -4]}>
        {[0.4, 1.35, 2.3].map((y) => (
          <mesh key={y} position={[0, y, 0]} castShadow>
            <boxGeometry args={[1.2, 0.09, 0.9]} />
            <meshStandardMaterial color={accent} metalness={0.72} roughness={0.34} />
          </mesh>
        ))}
        {[-0.5, 0.5].map((z) => (
          <mesh key={z} position={[0, 1.35, z]} castShadow>
            <boxGeometry args={[0.98, 0.68, 0.72]} />
            <meshStandardMaterial color="#a66a3d" roughness={0.83} />
          </mesh>
        ))}
      </group>
    ))}
  </group>
);

const ChapterThreeProps = ({ glow }: { glow: string }) => (
  <group position={[3.55, 1.4, -4.2]}>
    <mesh castShadow>
      <boxGeometry args={[1.55, 2.5, 0.35]} />
      <meshStandardMaterial color="#263943" metalness={0.7} roughness={0.32} />
    </mesh>
    <mesh position={[0, 0, 0.19]}>
      <boxGeometry args={[1.28, 2.19, 0.08]} />
      <meshStandardMaterial color="#112129" metalness={0.35} roughness={0.42} />
    </mesh>
    {[-0.37, 0, 0.37].map((x) => (
      <mesh key={x} position={[x, 0.5, 0.27]}>
        <boxGeometry args={[0.13, 0.45, 0.08]} />
        <meshStandardMaterial color={glow} emissive={glow} emissiveIntensity={0.75} />
      </mesh>
    ))}
    {[-0.62, 0.62].map((x) => (
      <mesh key={x} position={[x, -0.2, 0.24]}>
        <cylinderGeometry args={[0.04, 0.04, 0.7, 8]} />
        <meshStandardMaterial color="#e49a49" metalness={0.75} roughness={0.3} />
      </mesh>
    ))}
    <mesh position={[0, 1.35, 0.24]}>
      <sphereGeometry args={[0.09, 12, 8]} />
      <meshStandardMaterial color="#fff4c8" emissive={glow} emissiveIntensity={2} />
    </mesh>
  </group>
);

const ConveyorRoller = ({ index, glow }: { index: number; glow: string }) => {
  const roller = useRef<Mesh>(null);
  useFrame((_, delta) => {
    if (roller.current) roller.current.rotation.x += delta * 2.2;
  });

  return (
    <mesh ref={roller} position={[-0.9 + index * 0.3, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
      <cylinderGeometry args={[0.11, 0.11, 0.22, 10]} />
      <meshStandardMaterial
        color={index % 2 ? "#a7b3a9" : glow}
        metalness={0.68}
        roughness={0.32}
      />
    </mesh>
  );
};

const ChapterFourProps = ({ glow }: { glow: string }) => (
  <group position={[3.2, 1.2, -3.65]}>
    <mesh position={[0, 0.1, 0]}>
      <boxGeometry args={[2.35, 0.25, 1.4]} />
      <meshStandardMaterial color="#33443d" metalness={0.56} roughness={0.42} />
    </mesh>
    {Array.from({ length: 7 }, (_, index) => (
      <ConveyorRoller key={index} index={index} glow={glow} />
    ))}
    {[-0.68, 0.68].map((z) => (
      <mesh key={z} position={[0, 0.29, z]}>
        <boxGeometry args={[2.45, 0.14, 0.11]} />
        <meshStandardMaterial color="#d29b50" metalness={0.55} roughness={0.34} />
      </mesh>
    ))}
    <mesh position={[-0.5, 1.06, -0.15]} rotation={[0.45, 0, 0.08]}>
      <boxGeometry args={[0.55, 0.4, 0.43]} />
      <meshStandardMaterial color="#8c5834" roughness={0.82} />
    </mesh>
  </group>
);

const ServerRack = ({ x, glow }: { x: number; glow: string }) => (
  <group position={[x, 1.15, -4.05]}>
    <mesh castShadow>
      <boxGeometry args={[1.15, 2.3, 0.72]} />
      <meshStandardMaterial color="#273449" metalness={0.82} roughness={0.31} />
    </mesh>
    {[-0.76, -0.25, 0.25, 0.76].map((y) => (
      <group key={y} position={[0, y, 0.38]}>
        <mesh>
          <boxGeometry args={[0.88, 0.36, 0.06]} />
          <meshStandardMaterial color="#111827" metalness={0.65} roughness={0.34} />
        </mesh>
        {[-0.27, 0, 0.27].map((lightX) => (
          <mesh key={lightX} position={[lightX, 0, 0.045]}>
            <sphereGeometry args={[0.035, 8, 6]} />
            <meshStandardMaterial color={glow} emissive={glow} emissiveIntensity={1.5} />
          </mesh>
        ))}
      </group>
    ))}
  </group>
);

const ChapterFiveProps = ({ glow }: { glow: string }) => (
  <group>
    <ServerRack x={-4.1} glow={glow} />
    <ServerRack x={4.1} glow={glow} />
    <mesh position={[0, 3.15, -4.45]}>
      <torusGeometry args={[0.52, 0.045, 8, 28]} />
      <meshStandardMaterial
        color={glow}
        emissive={glow}
        emissiveIntensity={1.7}
        metalness={0.45}
        roughness={0.2}
      />
    </mesh>
    <mesh position={[0, 3.15, -4.45]}>
      <icosahedronGeometry args={[0.28, 1]} />
      <meshStandardMaterial
        color="#f8c96b"
        metalness={0.7}
        roughness={0.16}
        emissive="#a35212"
        emissiveIntensity={0.8}
      />
    </mesh>
  </group>
);

const AmbientGears = ({ glow }: { glow: string }) => {
  const gear = useRef<Group>(null);
  useFrame((_, delta) => {
    if (gear.current) gear.current.rotation.z += delta * 0.16;
  });

  return (
    <group ref={gear} position={[0, 3.45, -4.48]}>
      <mesh>
        <torusGeometry args={[1.05, 0.045, 8, 32]} />
        <meshStandardMaterial
          color={glow}
          emissive={glow}
          emissiveIntensity={0.62}
          metalness={0.7}
          roughness={0.27}
        />
      </mesh>
      {Array.from({ length: 8 }, (_, index) => {
        const angle = (index / 8) * Math.PI * 2;
        return (
          <mesh
            key={index}
            position={[Math.cos(angle) * 1.08, Math.sin(angle) * 1.08, 0]}
            rotation={[0, 0, angle]}
          >
            <boxGeometry args={[0.24, 0.14, 0.08]} />
            <meshStandardMaterial color="#b57742" metalness={0.72} roughness={0.3} />
          </mesh>
        );
      })}
    </group>
  );
};

export const RaccoonWorkshop = ({ chapter }: { chapter: number }) => {
  const palette = raccoonChapterLighting(chapter);
  return (
    <group>
      <mesh position={[0, -2.1, -1]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[40, 40]} />
        <meshStandardMaterial color={palette.floor} roughness={0.94} />
      </mesh>
      <mesh position={[0, 2.35, -4.85]} receiveShadow>
        <boxGeometry args={[24, 9, 0.34]} />
        <meshStandardMaterial color={palette.wall} roughness={0.86} />
      </mesh>
      <mesh position={[0, 6.78, -4.72]} rotation={[0, 0, 0.02]}>
        <boxGeometry args={[14, 0.13, 0.18]} />
        <meshStandardMaterial
          color={palette.glow}
          emissive={palette.glow}
          emissiveIntensity={0.9}
        />
      </mesh>
      <Workbench />
      <Raccoon3DWorkshopModels />
      {chapter === 1 && <ChapterOneProps glow={palette.glow} />}
      {chapter === 2 && <ChapterTwoProps accent={palette.accent} />}
      {chapter === 3 && <ChapterThreeProps glow={palette.glow} />}
      {chapter === 4 && <ChapterFourProps glow={palette.glow} />}
      {chapter === 5 && <ChapterFiveProps glow={palette.glow} />}
      <AmbientGears glow={palette.glow} />
      <ambientLight intensity={1.6} color="#ffe5c4" />
      <directionalLight position={[-5, 9, 6]} intensity={2.5} color="#ffe5c4" />
      <pointLight position={[-4.4, 4.1, -2.4]} color={palette.glow} intensity={22} distance={12} />
      <pointLight
        position={[4.5, 3.2, -2.2]}
        color={chapter >= 3 ? "#58e4ff" : "#f7a25b"}
        intensity={15}
        distance={10}
      />
    </group>
  );
};

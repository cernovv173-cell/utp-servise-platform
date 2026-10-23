import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import type { Group } from "three";

type RaccoonMascot3DProps = {
  level: number;
  celebrating: boolean;
  position: [number, number, number];
  scale?: number;
};

const RaccoonTail = () => (
  <group>
    {[
      [0.57, 0.56, -0.12],
      [0.76, 0.72, -0.26],
      [0.96, 0.78, -0.43],
      [1.15, 0.67, -0.61],
      [1.3, 0.48, -0.77],
    ].map(([x, y, z], index) => (
      <mesh key={index} position={[x, y, z]} scale={[0.24, 0.2, 0.27]} castShadow>
        <sphereGeometry args={[1, 12, 10]} />
        <meshStandardMaterial color={index % 2 === 0 ? "#8a7968" : "#2a2420"} roughness={0.72} />
      </mesh>
    ))}
  </group>
);

const RaccoonEars = () => (
  <group>
    {[-1, 1].map((side) => (
      <group key={side} position={[side * 0.38, 2.48, 0]}>
        <mesh position={[0, 0.08, 0]} rotation={[0, 0, side * -0.14]} castShadow>
          <coneGeometry args={[0.19, 0.42, 7]} />
          <meshStandardMaterial color="#746454" roughness={0.8} />
        </mesh>
        <mesh position={[0, 0.08, 0.105]} scale={[0.58, 0.7, 0.42]}>
          <coneGeometry args={[0.14, 0.29, 7]} />
          <meshStandardMaterial color="#d39a82" roughness={0.8} />
        </mesh>
      </group>
    ))}
  </group>
);

const RaccoonGoggles = () => (
  <group>
    {[-1, 1].map((side) => (
      <group key={side} position={[side * 0.2, 2.07, 0.47]}>
        <mesh>
          <torusGeometry args={[0.18, 0.035, 8, 18]} />
          <meshStandardMaterial color="#f7bd62" metalness={0.78} roughness={0.24} />
        </mesh>
        <mesh position={[0, 0, -0.018]}>
          <circleGeometry args={[0.145, 20]} />
          <meshStandardMaterial color="#72d4dc" emissive="#135d67" emissiveIntensity={0.42} />
        </mesh>
      </group>
    ))}
    <mesh position={[0, 2.07, 0.47]}>
      <boxGeometry args={[0.1, 0.055, 0.07]} />
      <meshStandardMaterial color="#f7bd62" metalness={0.75} roughness={0.27} />
    </mesh>
    <mesh position={[0, 2.07, 0.13]} rotation={[0, 0, Math.PI / 2]}>
      <torusGeometry args={[0.38, 0.025, 6, 24, Math.PI]} />
      <meshStandardMaterial color="#d99a43" metalness={0.55} roughness={0.36} />
    </mesh>
  </group>
);

const RaccoonHelmet = () => (
  <group>
    <mesh position={[0, 2.43, -0.01]} castShadow>
      <sphereGeometry args={[0.57, 16, 9, 0, Math.PI * 2, 0, Math.PI / 2]} />
      <meshStandardMaterial
        color="#244d5b"
        metalness={0.6}
        roughness={0.28}
        emissive="#07363f"
        emissiveIntensity={0.42}
      />
    </mesh>
    <mesh position={[0, 2.43, 0.12]}>
      <cylinderGeometry args={[0.62, 0.62, 0.075, 20]} />
      <meshStandardMaterial color="#d7a24f" metalness={0.72} roughness={0.29} />
    </mesh>
    <mesh position={[0, 2.44, 0.49]}>
      <boxGeometry args={[0.58, 0.055, 0.045]} />
      <meshStandardMaterial color="#65edff" emissive="#22cde5" emissiveIntensity={1.2} />
    </mesh>
  </group>
);

const RaccoonArm = ({ side, celebrating }: { side: -1 | 1; celebrating: boolean }) => {
  const arm = useRef<Group>(null);

  useFrame(({ clock }) => {
    if (!arm.current) return;
    const wave = Math.sin(clock.elapsedTime * 8) * 0.12;
    arm.current.rotation.z = celebrating ? side * (-1.05 + wave) : side * -0.18;
  });

  return (
    <group ref={arm} position={[side * 0.48, 1.38, 0]}>
      <mesh position={[side * 0.14, -0.26, 0]} rotation={[0, 0, side * -0.28]} castShadow>
        <capsuleGeometry args={[0.14, 0.28, 4, 8]} />
        <meshStandardMaterial color="#315e62" roughness={0.66} />
      </mesh>
      <mesh position={[side * 0.22, -0.47, 0.02]} castShadow>
        <sphereGeometry args={[0.15, 10, 8]} />
        <meshStandardMaterial color="#8b7766" roughness={0.76} />
      </mesh>
      <mesh position={[side * 0.14, -0.25, 0.11]}>
        <boxGeometry args={[0.2, 0.07, 0.035]} />
        <meshStandardMaterial
          color="#57e4f2"
          emissive={celebrating ? "#35e8ff" : "#103a40"}
          emissiveIntensity={celebrating ? 1.8 : 0.3}
        />
      </mesh>
    </group>
  );
};

export const RaccoonMascot3D = ({
  level,
  celebrating,
  position,
  scale = 1,
}: RaccoonMascot3DProps) => {
  const model = useRef<Group>(null);
  const hasGoggles = level >= 31;
  const hasHelmet = level >= 71;

  useFrame(({ clock }) => {
    if (!model.current) return;
    const time = clock.elapsedTime;
    model.current.position.y =
      position[1] +
      (celebrating ? Math.abs(Math.sin(time * 7)) * 0.48 : Math.sin(time * 1.7) * 0.035);
    model.current.rotation.y =
      Math.sin(time * 0.55) * 0.045 + (celebrating ? Math.sin(time * 7) * 0.12 : 0);
  });

  return (
    <group ref={model} position={position} scale={scale}>
      <RaccoonTail />

      <mesh position={[0, 0.39, 0]} scale={[0.43, 0.19, 0.36]} castShadow>
        <sphereGeometry args={[1, 12, 9]} />
        <meshStandardMaterial color="#342a23" roughness={0.82} />
      </mesh>
      <mesh position={[0, 0.93, 0]} castShadow>
        <capsuleGeometry args={[0.42, 0.62, 5, 10]} />
        <meshStandardMaterial
          color="#24525c"
          metalness={0.16}
          roughness={0.62}
          emissive={hasHelmet ? "#0b4148" : "#000000"}
          emissiveIntensity={hasHelmet ? 0.5 : 0}
        />
      </mesh>
      <mesh position={[0, 1.03, 0.385]} castShadow>
        <boxGeometry args={[0.58, 0.36, 0.08]} />
        <meshStandardMaterial color="#d29a54" metalness={0.62} roughness={0.38} />
      </mesh>
      <mesh position={[0, 1.04, 0.438]}>
        <boxGeometry args={[0.13, 0.24, 0.025]} />
        <meshStandardMaterial color="#2c3431" metalness={0.42} roughness={0.48} />
      </mesh>

      {[-1, 1].map((side) => (
        <group key={side}>
          <mesh position={[side * 0.22, 0.18, 0.04]} castShadow>
            <capsuleGeometry args={[0.13, 0.38, 4, 8]} />
            <meshStandardMaterial color="#394846" roughness={0.74} />
          </mesh>
          <mesh position={[side * 0.22, 0.06, 0.16]} scale={[1, 0.56, 1.4]} castShadow>
            <sphereGeometry args={[0.17, 10, 8]} />
            <meshStandardMaterial color="#4a3024" roughness={0.82} />
          </mesh>
        </group>
      ))}

      <RaccoonArm side={-1} celebrating={celebrating} />
      <RaccoonArm side={1} celebrating={celebrating} />

      <mesh position={[0, 2.03, 0]} scale={[0.59, 0.5, 0.49]} castShadow>
        <sphereGeometry args={[1, 16, 12]} />
        <meshStandardMaterial color="#857767" roughness={0.79} />
      </mesh>
      <RaccoonEars />
      {[-1, 1].map((side) => (
        <group key={side}>
          <mesh position={[side * 0.22, 2.05, 0.407]} scale={[0.245, 0.145, 0.075]}>
            <sphereGeometry args={[1, 14, 10]} />
            <meshStandardMaterial color="#28231f" roughness={0.66} />
          </mesh>
          <mesh position={[side * 0.16, 2.08, 0.478]} scale={[0.068, 0.075, 0.045]}>
            <sphereGeometry args={[1, 12, 8]} />
            <meshStandardMaterial color="#fff1d2" roughness={0.34} />
          </mesh>
          <mesh position={[side * 0.15, 2.08, 0.513]} scale={[0.031, 0.042, 0.022]}>
            <sphereGeometry args={[1, 10, 8]} />
            <meshStandardMaterial color="#201b19" roughness={0.28} />
          </mesh>
        </group>
      ))}
      <mesh position={[0, 1.9, 0.453]} scale={[0.23, 0.13, 0.14]}>
        <sphereGeometry args={[1, 12, 8]} />
        <meshStandardMaterial color="#ded1b5" roughness={0.78} />
      </mesh>
      <mesh position={[0, 1.98, 0.57]} scale={[0.075, 0.052, 0.045]}>
        <sphereGeometry args={[1, 12, 8]} />
        <meshStandardMaterial color="#251d1a" roughness={0.35} />
      </mesh>

      {hasGoggles && <RaccoonGoggles />}
      {hasHelmet && <RaccoonHelmet />}

      {hasGoggles && (
        <group position={[0.38, 0.9, 0.31]}>
          <mesh rotation={[0, 0, -0.36]}>
            <boxGeometry args={[0.13, 0.27, 0.11]} />
            <meshStandardMaterial color="#c48543" metalness={0.48} roughness={0.48} />
          </mesh>
          <mesh position={[0.06, -0.04, 0.01]} rotation={[0, 0, -0.3]}>
            <boxGeometry args={[0.16, 0.045, 0.13]} />
            <meshStandardMaterial color="#e0ad5c" metalness={0.67} roughness={0.37} />
          </mesh>
        </group>
      )}

      {hasHelmet && (
        <mesh position={[0, 1.04, -0.425]}>
          <torusGeometry args={[0.37, 0.035, 6, 20]} />
          <meshStandardMaterial color="#47e8ff" emissive="#24d9f0" emissiveIntensity={1.5} />
        </mesh>
      )}
    </group>
  );
};

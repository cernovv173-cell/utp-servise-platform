import { Canvas } from "@react-three/fiber";

import { Raccoon3DFallback } from "./raccoon-3d-fallback";
import type { Raccoon3DStageProps } from "./raccoon-3d-stage";
import { RaccoonThreeWorld } from "./raccoon-3d-world";

export const Raccoon3DCanvas = (props: Raccoon3DStageProps) => (
  <Canvas
    dpr={[1, 1.35]}
    gl={{ antialias: true, powerPreference: "low-power" }}
    camera={{
      position: [0, 8.2, 11.8],
      rotation: [-0.6, 0, 0],
      fov: 42,
      near: 0.1,
      far: 60,
    }}
    fallback={
      <div className="grid h-full place-items-center bg-[#1a120e] p-4">
        <Raccoon3DFallback
          {...props}
          message="3D-графика недоступна на этом устройстве. Уровень открыт в облегчённом режиме."
        />
      </div>
    }
  >
    <RaccoonThreeWorld
      {...props}
      disabled={Boolean(props.disabled)}
      celebrating={Boolean(props.celebrating)}
    />
  </Canvas>
);

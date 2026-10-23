import { useLoader } from "@react-three/fiber";
import { useMemo } from "react";
import { Mesh } from "three";
import type { Group } from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const workshopAssetUrls = [
  "/assets/game-models/polyhaven/metal_toolbox/metal_toolbox.gltf",
  "/assets/game-models/polyhaven/bench_vice_01/bench_vice_01.gltf",
] as const;

const enableShadows = (root: Group) => {
  root.traverse((object) => {
    if (object instanceof Mesh) {
      object.castShadow = true;
      object.receiveShadow = true;
    }
  });
};

export const Raccoon3DWorkshopModels = () => {
  const [toolboxAsset, viceAsset] = useLoader(GLTFLoader, [...workshopAssetUrls]);
  const { toolbox, vice } = useMemo(() => {
    const toolbox = toolboxAsset.scene.clone(true);
    const vice = viceAsset.scene.clone(true);
    enableShadows(toolbox);
    enableShadows(vice);
    return { toolbox, vice };
  }, [toolboxAsset.scene, viceAsset.scene]);

  return (
    <>
      <primitive
        object={toolbox}
        position={[4.52, -0.03, -3.56]}
        rotation={[0, -0.3, 0]}
        scale={2.15}
        dispose={null}
      />
      <primitive
        object={vice}
        position={[4.52, 0.08, -2.35]}
        rotation={[0, 0.2, 0]}
        scale={2.6}
        dispose={null}
      />
    </>
  );
};

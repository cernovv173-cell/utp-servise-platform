import {
  CircuitBoard,
  Cpu,
  Fan,
  HardDrive,
  MemoryStick,
  MonitorCog,
  Package,
  Sparkles,
  Zap,
} from "lucide-react";

import type { RaccoonObjective } from "./raccoon-game-api";

const icons = {
  cpu: Cpu,
  gpu: MonitorCog,
  ram: MemoryStick,
  ssd: HardDrive,
  board: CircuitBoard,
  fan: Fan,
  gold: Sparkles,
  crate: Package,
  circuit: Zap,
} as const;

export const RaccoonPartIcon = ({
  part,
  className = "",
}: {
  part: RaccoonObjective;
  className?: string;
}) => {
  const Icon = icons[part];
  return <Icon aria-hidden="true" className={className} strokeWidth={2.5} />;
};

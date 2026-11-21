import { type CSSProperties, type ReactNode } from "react";

import { getFlowingFirePaletteColors } from "@/features/visual-effects/flowing-fire-palettes";

import type { FlowingFirePalette } from "@/lib/api";

type FlowingFireFrameProps = {
  children: ReactNode;
  borderRadius?: CSSProperties["borderRadius"];
  className?: string;
  enabled?: boolean;
  palette?: FlowingFirePalette;
};

export const FlowingFireFrame = ({
  children,
  borderRadius = "1.5rem",
  className,
  enabled = true,
  palette = "EMBER",
}: FlowingFireFrameProps) => {
  const classes = [enabled ? "flowing-fire-frame" : "", className].filter(Boolean).join(" ");
  const colors = getFlowingFirePaletteColors(palette);
  const style: CSSProperties | undefined = enabled
    ? ({
        borderRadius,
        "--flow-fire-dark": colors.dark,
        "--flow-fire-hot": colors.hot,
        "--flow-fire-light": colors.light,
        "--flow-fire-mid": colors.mid,
      } as CSSProperties)
    : undefined;

  return (
    <div className={classes} style={style}>
      {children}
    </div>
  );
};

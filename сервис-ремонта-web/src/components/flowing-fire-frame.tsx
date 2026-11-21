import { type CSSProperties, type ReactNode } from "react";

type FlowingFireFrameProps = {
  children: ReactNode;
  borderRadius?: CSSProperties["borderRadius"];
  className?: string;
  enabled?: boolean;
};

export const FlowingFireFrame = ({
  children,
  borderRadius = "1.5rem",
  className,
  enabled = true,
}: FlowingFireFrameProps) => {
  const classes = [enabled ? "flowing-fire-frame" : "", className].filter(Boolean).join(" ");

  return (
    <div className={classes} style={enabled ? { borderRadius } : undefined}>
      {children}
    </div>
  );
};

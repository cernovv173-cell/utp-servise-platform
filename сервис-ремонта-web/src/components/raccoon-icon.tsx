type RaccoonMotion = "bounce" | "peek" | "wiggle";

export const RaccoonIcon = ({
  motion = "bounce",
  className = "",
}: {
  motion?: RaccoonMotion;
  className?: string;
}) => (
  <span aria-hidden="true" className={`raccoon-icon raccoon-icon--${motion} ${className}`}>
    🦝
  </span>
);

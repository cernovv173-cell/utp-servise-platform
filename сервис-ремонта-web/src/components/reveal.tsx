"use client";

import { motion, useReducedMotion } from "motion/react";
import type { HTMLMotionProps } from "motion/react";

type RevealDirection = "down" | "left" | "right" | "up";

export type RevealProps = HTMLMotionProps<"div"> & {
  readonly delay?: number;
  readonly direction?: RevealDirection;
  readonly distance?: number;
  readonly once?: boolean;
};

const offsets: Record<RevealDirection, (distance: number) => { x: number; y: number }> = {
  down: (distance) => ({ x: 0, y: -distance }),
  left: (distance) => ({ x: distance, y: 0 }),
  right: (distance) => ({ x: -distance, y: 0 }),
  up: (distance) => ({ x: 0, y: distance }),
};

export const Reveal = ({
  delay = 0,
  direction = "up",
  distance = 16,
  once = true,
  transition,
  ...props
}: RevealProps) => {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, ...offsets[direction](distance) }}
      transition={{ delay, duration: 0.35, ease: "easeOut", ...transition }}
      viewport={{ amount: 0.15, once }}
      whileInView={reduceMotion ? undefined : { opacity: 1, x: 0, y: 0 }}
      {...props}
    />
  );
};

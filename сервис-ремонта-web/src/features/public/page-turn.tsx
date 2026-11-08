import { motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";

export const PageTurn = ({ children }: { children: ReactNode }) => {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, rotateX: -5, y: 26, scale: 0.99 }}
      whileInView={reduceMotion ? undefined : { opacity: 1, rotateX: 0, y: 0, scale: 1 }}
      viewport={{ amount: 0.14, once: true }}
      transition={{ duration: 0.62, ease: [0.2, 0.7, 0.2, 1] }}
      style={{ transformPerspective: 1200, transformOrigin: "50% 0%" }}
    >
      {children}
    </motion.div>
  );
};

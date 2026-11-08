import { useInView, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";

export const TypewriterText = ({ text }: { text: string }) => {
  const targetRef = useRef<HTMLSpanElement>(null);
  const isInView = useInView(targetRef, { once: true, amount: 0.8 });
  const reduceMotion = useReducedMotion();
  const characters = Array.from(text);
  const visibleCountRef = useRef(0);
  const [visibleCount, setVisibleCount] = useState(0);

  useEffect(() => {
    if (reduceMotion || !isInView || characters.length === 0) return;
    if (visibleCountRef.current >= characters.length) return;

    let current = visibleCountRef.current;
    const interval = window.setInterval(() => {
      current = Math.min(current + 1, characters.length);
      visibleCountRef.current = current;
      setVisibleCount(current);
      if (current >= characters.length) window.clearInterval(interval);
    }, 38);

    return () => window.clearInterval(interval);
  }, [characters.length, isInView, reduceMotion]);

  const visibleText = reduceMotion ? text : characters.slice(0, visibleCount).join("");
  const isTyping = !reduceMotion && isInView && visibleCount < characters.length;

  return (
    <span className="grid">
      <span className="invisible col-start-1 row-start-1 select-none" aria-hidden="true">
        {text}
      </span>
      <span className="sr-only">{text}</span>
      <span ref={targetRef} className="col-start-1 row-start-1" aria-hidden="true">
        {visibleText}
        {isTyping && (
          <span className="ml-0.5 inline-block h-[0.9em] w-0.5 translate-y-[0.08em] bg-current motion-safe:animate-pulse" />
        )}
      </span>
    </span>
  );
};

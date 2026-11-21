import { ArrowUp } from "lucide-react";
import { useEffect, useState } from "react";

import { calculateReadProgress, shouldShowReadProgressButton } from "./read-progress";

export const ReadingProgressButton = () => {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let frame = 0;

    const updateProgress = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const documentHeight = Math.max(
          document.documentElement.scrollHeight,
          document.body.scrollHeight,
        );
        setProgress(calculateReadProgress(window.scrollY, window.innerHeight, documentHeight));
      });
    };

    updateProgress();
    window.addEventListener("scroll", updateProgress, { passive: true });
    window.addEventListener("resize", updateProgress);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", updateProgress);
      window.removeEventListener("resize", updateProgress);
    };
  }, []);

  if (!shouldShowReadProgressButton(progress)) return null;

  const scrollToTop = () => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
  };

  return (
    <div
      className="pointer-events-none fixed right-5 z-30 print:hidden"
      style={{ bottom: "calc(6rem + env(safe-area-inset-bottom))" }}
    >
      <button
        type="button"
        onClick={scrollToTop}
        aria-label={`Вернуться в начало страницы. Прочитано ${progress}%`}
        title={`Прочитано ${progress}%`}
        className="pointer-events-auto grid size-14 place-items-center rounded-full p-[3px] shadow-lg shadow-red-950/20 transition-[transform,filter] hover:scale-105 hover:brightness-105 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-red-600"
        style={{
          background: `conic-gradient(from -90deg, #dc2626 0 ${progress}%, rgb(148 163 184 / 45%) ${progress}% 100%)`,
        }}
      >
        <span className="grid size-full place-items-center rounded-full border border-white bg-white text-slate-800 shadow-inner dark:border-slate-800 dark:bg-slate-950 dark:text-white">
          <ArrowUp size={22} aria-hidden="true" />
        </span>
      </button>
    </div>
  );
};

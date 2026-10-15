import { Sparkles } from "lucide-react";

import type { Match3Epilogue } from "./chapter-stories";

export const GameEpilogueScene = ({ epilogue }: { epilogue: Match3Epilogue }) => (
  <section
    aria-labelledby="game-epilogue-title"
    className="mt-6 overflow-hidden rounded-3xl border border-amber-200/30 bg-[#0b132a]/95 shadow-[0_20px_70px_rgba(0,0,0,0.28)]"
  >
    <div className="grid sm:grid-cols-[9rem_minmax(0,1fr)]">
      <div className="relative min-h-48 overflow-hidden sm:min-h-full">
        <img
          src="/images/raccoon-computer-mascot.jpg"
          alt="Енот празднует завершение сборки компьютера"
          className="absolute inset-0 h-full w-full object-cover object-[center_30%]"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#071022] via-[#071022]/20 to-transparent sm:bg-gradient-to-r" />
      </div>
      <div className="p-5 sm:p-6">
        <p className="flex items-center gap-2 text-xs font-semibold tracking-[0.16em] text-amber-200 uppercase">
          <Sparkles size={14} aria-hidden="true" />
          Финал · глава 5 · мастерская енота
        </p>
        <h2 id="game-epilogue-title" className="mt-2 text-xl font-bold text-white sm:text-2xl">
          {epilogue.title}
        </h2>
        <p className="mt-3 text-sm leading-6 text-[#d1def8]">{epilogue.narration}</p>
        <blockquote className="mt-4 rounded-2xl border border-amber-200/20 bg-amber-200/10 px-4 py-3 text-sm leading-6 text-amber-100">
          «{epilogue.raccoonDialogue}»
        </blockquote>
      </div>
    </div>
  </section>
);

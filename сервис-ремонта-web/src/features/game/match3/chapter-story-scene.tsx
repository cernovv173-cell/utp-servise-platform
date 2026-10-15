import { ArrowRight, RotateCcw, Sparkles, Volume2, VolumeX } from "lucide-react";

import type { ChapterStory } from "./chapter-stories";

type ChapterStorySceneProps = {
  story: ChapterStory;
  onContinue: () => void;
  voiceEnabled: boolean;
  voiceSupported: boolean;
  onToggleVoice: () => void;
  onReplayVoice: () => void;
};

export const ChapterStoryScene = ({
  story,
  onContinue,
  voiceEnabled,
  voiceSupported,
  onToggleVoice,
  onReplayVoice,
}: ChapterStorySceneProps) => (
  <section
    aria-labelledby="chapter-story-title"
    className="mt-6 overflow-hidden rounded-3xl border border-violet-300/30 bg-[#0b132a]/95 shadow-[0_20px_70px_rgba(0,0,0,0.28)]"
  >
    <div className="grid sm:grid-cols-[9rem_minmax(0,1fr)]">
      <div className="relative min-h-48 overflow-hidden sm:min-h-full">
        <img
          src="/images/raccoon-computer-mascot.jpg"
          alt="Енот готовится к следующему этапу сборки компьютера"
          className="absolute inset-0 h-full w-full object-cover object-[center_30%]"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#071022] via-[#071022]/20 to-transparent sm:bg-gradient-to-r" />
      </div>
      <div className="p-5 sm:p-6">
        <p className="flex items-center gap-2 text-xs font-semibold tracking-[0.16em] text-cyan-200 uppercase">
          <Sparkles size={14} aria-hidden="true" />
          Сюжетная сцена · глава {story.nextChapter.number} · {story.nextChapter.setting}
        </p>
        <h2 id="chapter-story-title" className="mt-2 text-xl font-bold text-white sm:text-2xl">
          {story.nextChapter.title}
        </h2>
        <p className="mt-3 text-sm leading-6 text-[#d1def8]">{story.narration}</p>
        <blockquote className="mt-4 rounded-2xl border border-violet-300/20 bg-violet-300/10 px-4 py-3 text-sm leading-6 text-violet-100">
          «{story.raccoonDialogue}»
        </blockquote>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            aria-pressed={voiceSupported && voiceEnabled}
            disabled={!voiceSupported}
            onClick={onToggleVoice}
            className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-cyan-200/25 bg-[#101a34] px-3 text-sm font-medium text-cyan-100 transition hover:bg-[#182648] focus-visible:ring-2 focus-visible:ring-cyan-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {voiceSupported && voiceEnabled ? (
              <Volume2 size={16} aria-hidden="true" />
            ) : (
              <VolumeX size={16} aria-hidden="true" />
            )}
            {voiceSupported
              ? voiceEnabled
                ? "Озвучка включена"
                : "Включить озвучку"
              : "Озвучка недоступна"}
          </button>
          {voiceSupported && voiceEnabled && (
            <button
              type="button"
              onClick={onReplayVoice}
              aria-label="Повторить реплику енота"
              className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-violet-200/25 bg-violet-300/10 px-3 text-sm font-medium text-violet-100 transition hover:bg-violet-300/20 focus-visible:ring-2 focus-visible:ring-violet-100"
            >
              <RotateCcw size={15} aria-hidden="true" />
              Повторить реплику
            </button>
          )}
          {!voiceSupported && (
            <p className="text-xs text-[#a0afd2]" role="status">
              Браузер или устройство не поддерживает синтез речи.
            </p>
          )}
          {voiceSupported && (
            <p className="text-xs text-[#a0afd2]">Русский голос зависит от настроек устройства.</p>
          )}
        </div>
        <button
          type="button"
          onClick={onContinue}
          className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-cyan-300 px-5 font-semibold text-[#071022] transition hover:bg-cyan-200 focus-visible:ring-2 focus-visible:ring-cyan-100 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0b132a]"
        >
          Продолжить к главе {story.nextChapter.number}
          <ArrowRight size={16} aria-hidden="true" />
        </button>
      </div>
    </div>
  </section>
);

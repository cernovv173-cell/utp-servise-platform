import { ArrowRight, Info, Sparkles } from "lucide-react";

export type GameTutorialStep = 0 | 1;

type GameTutorialProps = {
  step: GameTutorialStep;
  onSkip: () => void;
  onContinue: () => void;
};

const tips = [
  {
    eyebrow: "ШАГ 1 ИЗ 2 · ПОПРОБУЙ НА ПОЛЕ",
    title: "Найди удачный обмен",
    body: "Выбери фишку, затем соседнюю по вертикали или горизонтали. Собери три одинаковые детали в ряд — ход сработает только если получится комбинация.",
  },
  {
    eyebrow: "ШАГ 2 ИЗ 2 · ПРЕПЯТСТВИЯ",
    title: "Помогай еноту очищать поле",
    body: "Замороженная клетка оттает от комбинации рядом, мусор исчезнет от соседнего совпадения, аномальные фишки меняются с каждым ходом. Эти препятствия встретятся дальше по главам.",
  },
] as const;

export const GameTutorial = ({ step, onSkip, onContinue }: GameTutorialProps) => {
  const tip = tips[step];

  return (
    <section
      aria-labelledby="game-tutorial-title"
      aria-live="polite"
      className="mt-5 rounded-2xl border border-cyan-200/25 bg-[#101a34]/95 p-4 shadow-[0_10px_35px_rgba(0,0,0,0.25)] sm:p-5"
    >
      <div className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-cyan-300/10 text-cyan-200">
          {step === 0 ? (
            <Sparkles size={18} aria-hidden="true" />
          ) : (
            <Info size={18} aria-hidden="true" />
          )}
        </span>
        <div className="min-w-0">
          <p className="text-[10px] font-semibold tracking-[0.16em] text-cyan-300 uppercase">
            {tip.eyebrow}
          </p>
          <h2 id="game-tutorial-title" className="mt-1 font-semibold text-white">
            {tip.title}
          </h2>
          <p className="mt-1 text-sm leading-6 text-[#bdccec]">{tip.body}</p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {step === 0 ? (
              <button
                type="button"
                onClick={onSkip}
                className="min-h-10 rounded-xl bg-cyan-300 px-4 text-sm font-semibold text-[#071022] transition hover:bg-cyan-200 focus-visible:ring-2 focus-visible:ring-cyan-100"
              >
                Пропустить обучение
              </button>
            ) : (
              <button
                type="button"
                onClick={onContinue}
                className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-cyan-300 px-4 text-sm font-semibold text-[#071022] transition hover:bg-cyan-200 focus-visible:ring-2 focus-visible:ring-cyan-100"
              >
                Понятно, играть
                <ArrowRight size={15} aria-hidden="true" />
              </button>
            )}
            {step === 1 && (
              <button
                type="button"
                onClick={onSkip}
                className="min-h-10 rounded-xl px-3 text-sm text-[#a0afd2] underline-offset-4 hover:text-white hover:underline focus-visible:ring-2 focus-visible:ring-cyan-100"
              >
                Закрыть
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

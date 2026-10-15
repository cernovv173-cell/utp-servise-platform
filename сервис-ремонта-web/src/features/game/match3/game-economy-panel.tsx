import type { Match3BoosterKey, Match3PartKey, Match3Progress } from "./game-api";

const partPresentation: Record<Match3PartKey, { name: string; icon: string }> = {
  processor: { name: "Процессор", icon: "🧠" },
  ram: { name: "Оперативная память", icon: "🧩" },
  ssd: { name: "SSD-накопитель", icon: "💽" },
  cooling: { name: "Система охлаждения", icon: "🌀" },
  gpu: { name: "Видеокарта", icon: "🎮" },
  motherboard: { name: "Материнская плата", icon: "🟩" },
  power: { name: "Блок питания", icon: "⚡" },
  case: { name: "Корпус", icon: "🖥️" },
};

export const GameEconomyPanel = ({
  progress,
  selectedBooster,
  canUseBoosters,
  isClaiming,
  craftingBooster,
  onClaim,
  onCraft,
  onSelectBooster,
}: {
  progress: Match3Progress;
  selectedBooster: Match3BoosterKey | null;
  canUseBoosters: boolean;
  isClaiming: boolean;
  craftingBooster: Match3BoosterKey | null;
  onClaim: () => void;
  onCraft: (boosterId: Match3BoosterKey) => void;
  onSelectBooster: (boosterId: Match3BoosterKey | null) => void;
}) => (
  <section className="mt-5 rounded-2xl border border-violet-200/20 bg-[#101a34]/95 p-4 sm:p-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 className="text-lg font-bold text-white">Детали и бустеры</h2>
        <p className="mt-1 text-sm text-[#d1def8]">
          Собирайте детали в комбинациях и создавайте из них помощь для игры.
        </p>
      </div>
      <div className="rounded-xl border border-amber-200/25 bg-amber-200/10 px-3 py-2 text-sm text-amber-100">
        Заработано: <strong>{progress.totalGamePoints}</strong> · к получению:{" "}
        {progress.pendingGamePoints}
      </div>
    </div>

    <div className="mt-4 flex flex-wrap gap-2" aria-label="Собранные детали">
      {Object.entries(progress.inventory.parts).map(([part, quantity]) => {
        const metadata = partPresentation[part as Match3PartKey];
        return (
          <span
            key={part}
            className="rounded-lg border border-white/10 bg-[#071022]/70 px-2.5 py-1.5 text-xs text-cyan-50"
          >
            {metadata.icon} {metadata.name}: {quantity}
          </span>
        );
      })}
    </div>

    <div className="mt-4 grid gap-3 sm:grid-cols-2">
      {progress.boosterCatalog.map((booster) => {
        const canCraft = booster.recipe.every(
          ({ part, quantity }) => progress.inventory.parts[part] >= quantity,
        );
        const count = progress.inventory.boosters[booster.id];
        const selected = selectedBooster === booster.id;
        return (
          <article
            key={booster.id}
            className="rounded-xl border border-white/10 bg-[#071022]/65 p-3"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="font-semibold text-white">
                  <span aria-hidden="true" className="mr-1">
                    {booster.icon}
                  </span>
                  {booster.name} · {count}
                </h3>
                <p className="mt-1 text-xs leading-5 text-[#c4d2ef]">{booster.description}</p>
              </div>
              <button
                type="button"
                disabled={!canUseBoosters || count < 1}
                aria-pressed={selected}
                onClick={() => onSelectBooster(selected ? null : booster.id)}
                className={`min-h-10 shrink-0 rounded-lg px-3 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${selected ? "bg-fuchsia-300 text-[#071022]" : "border border-fuchsia-200/30 bg-fuchsia-200/10 text-fuchsia-100 hover:bg-fuchsia-200/20"}`}
              >
                {selected ? "Выберите клетку" : "Использовать"}
              </button>
            </div>
            <p className="mt-2 text-xs text-slate-300">
              Рецепт:{" "}
              {booster.recipe
                .map((item) => `${item.icon} ${item.name} × ${item.quantity}`)
                .join(" + ")}
            </p>
            <button
              type="button"
              disabled={!canCraft || craftingBooster !== null}
              onClick={() => onCraft(booster.id)}
              className="mt-2 min-h-9 rounded-lg border border-cyan-200/25 px-3 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-100/10 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {craftingBooster === booster.id ? "Собираем…" : "Собрать бустер"}
            </button>
          </article>
        );
      })}
    </div>

    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-200/20 bg-emerald-200/5 p-3">
      <p className="max-w-xl text-sm text-emerald-50">
        За каждый пройденный уровень вы сразу получаете бустер-подарок. Баллы накапливаются
        отдельно; забрать их можно после любого количества уровней, не проходя всю кампанию.
        {progress.pendingGamePoints > 0 && (
          <strong className="ml-1">Доступно: {progress.pendingGamePoints}.</strong>
        )}
      </p>
      <button
        type="button"
        disabled={progress.pendingGamePoints < 1 || isClaiming}
        onClick={onClaim}
        className="min-h-11 rounded-xl bg-emerald-300 px-4 py-2 font-semibold text-[#071022] transition hover:bg-emerald-200 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {isClaiming
          ? "Зачисляем…"
          : `Забрать баллы${progress.pendingGamePoints ? ` · ${progress.pendingGamePoints}` : ""}`}
      </button>
    </div>
    {selectedBooster && (
      <p className="mt-3 text-sm text-fuchsia-100" role="status">
        Нажмите клетку поля, чтобы применить бустер. Он расходует один ход.
      </p>
    )}
  </section>
);

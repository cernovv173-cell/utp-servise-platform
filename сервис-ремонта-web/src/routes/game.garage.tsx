import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";

import { AppShell } from "@/components/app-shell";

import { useAuth } from "@/features/auth/auth-context";
import { getMatch3Progress } from "@/features/game/match3/game-api";
import {
  getUnlockedRaccoonCosmetics,
  raccoonCosmetics,
} from "@/features/game/match3/raccoon-cosmetics";
import { useRaccoonCosmeticSelection } from "@/features/game/match3/use-raccoon-cosmetic-selection";

const RaccoonGaragePage = () => {
  const { token, user } = useAuth();
  const progress = useQuery({
    queryKey: ["match3-progress", token],
    queryFn: ({ signal }) => getMatch3Progress(token!, signal),
    enabled: Boolean(token && user?.role === "CUSTOMER"),
  });
  const completedCount = progress.data?.completedCount ?? 0;
  const cosmetics = useRaccoonCosmeticSelection(user?.id ?? null, completedCount);
  const chapterRewards = getUnlockedRaccoonCosmetics(completedCount).filter(
    (cosmetic) => cosmetic.chapterNumber !== null,
  ).length;

  return (
    <AppShell active="/game">
      <main className="rounded-3xl border border-cyan-300/20 bg-[#071022] p-4 text-white sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold tracking-[0.18em] text-cyan-200 uppercase">
              Мастерская енота
            </p>
            <h1 className="mt-2 text-2xl font-bold sm:text-3xl">Коллекция визоров</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#d1def8]">
              Открывай новые образы за главы и выбирай любимый. Визоры меняют только внешний вид.
            </p>
          </div>
          <Link
            to="/game"
            className="inline-flex min-h-10 items-center rounded-xl border border-cyan-200/25 bg-[#101a34] px-4 text-sm font-medium text-cyan-100 transition hover:bg-[#182648] focus-visible:ring-2 focus-visible:ring-cyan-100"
          >
            Вернуться в игру
          </Link>
        </div>

        {user?.role !== "CUSTOMER" ? (
          <p className="mt-6 rounded-2xl bg-[#101a34] p-4">
            Мастерская доступна аккаунтам клиентов.
          </p>
        ) : progress.isPending ? (
          <p className="mt-6" role="status">
            Загружаем коллекцию…
          </p>
        ) : progress.isError ? (
          <div className="mt-6 rounded-2xl bg-[#101a34] p-4" role="alert">
            <p>Не удалось загрузить прогресс: {progress.error.message}</p>
            <button
              className="mt-3 text-cyan-200 underline"
              onClick={() => void progress.refetch()}
            >
              Повторить
            </button>
          </div>
        ) : (
          <>
            <section className="mt-6 grid gap-5 rounded-3xl border border-violet-200/20 bg-[#0b132a]/90 p-4 sm:grid-cols-[12rem_minmax(0,1fr)] sm:items-center sm:p-5">
              <img
                src={cosmetics.selected.image}
                alt={`Енот в косметическом образе «${cosmetics.selected.name}»`}
                className="mx-auto aspect-square w-full max-w-48 rounded-2xl border border-cyan-200/20 object-cover"
              />
              <div>
                <p className="text-xs font-semibold tracking-[0.16em] text-violet-200 uppercase">
                  Сейчас надет
                </p>
                <h2 className="mt-2 text-xl font-bold">{cosmetics.selected.name}</h2>
                <p className="mt-2 text-sm leading-6 text-[#bdccec]">
                  {cosmetics.selected.description}
                </p>
                <p className="mt-3 text-xs text-cyan-100">
                  Открыто наград за главы: {chapterRewards} / 5
                </p>
              </div>
            </section>

            <section className="mt-7" aria-labelledby="cosmetic-collection-title">
              <div className="mb-3 flex items-end justify-between gap-3">
                <h2 id="cosmetic-collection-title" className="text-lg font-semibold">
                  Образы енота
                </h2>
                <p className="text-xs text-[#a0afd2]">Прогресс: {completedCount} / 100 этапов</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {raccoonCosmetics.map((cosmetic) => {
                  const unlocked = completedCount >= cosmetic.unlockAt;
                  const selected = cosmetics.selected.id === cosmetic.id;
                  const Icon = cosmetic.icon;
                  return (
                    <article
                      key={cosmetic.id}
                      className={`overflow-hidden rounded-2xl border bg-[#0b132a]/90 ${selected ? "border-cyan-200/60 ring-1 ring-cyan-200/20" : "border-[#26365f]"}`}
                    >
                      <div className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-3 p-3">
                        <img
                          src={cosmetic.image}
                          alt=""
                          aria-hidden="true"
                          className={`aspect-square w-full rounded-xl border border-white/10 object-cover ${unlocked ? "" : "opacity-45 grayscale"}`}
                          loading="lazy"
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 text-cyan-200">
                            <Icon size={16} aria-hidden="true" />
                            <h3 className="truncate text-sm font-semibold text-white">
                              {cosmetic.name}
                            </h3>
                          </div>
                          <p className="mt-1 text-xs leading-5 text-[#a0afd2]">
                            {cosmetic.description}
                          </p>
                          <p className="mt-2 text-[11px] text-[#8fa0c8]">
                            {cosmetic.chapterNumber === null
                              ? "Стартовый образ"
                              : `Глава ${cosmetic.chapterNumber} · ${cosmetic.unlockAt} этапов`}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        disabled={!unlocked || selected}
                        aria-pressed={selected}
                        onClick={() => cosmetics.select(cosmetic.id)}
                        className="min-h-10 w-full border-t border-[#26365f] px-3 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-300/10 disabled:cursor-not-allowed disabled:text-[#8090b9]"
                      >
                        {selected
                          ? "Надет сейчас"
                          : unlocked
                            ? "Надеть визор"
                            : `Закрыто · ещё ${Math.max(cosmetic.unlockAt - completedCount, 0)} этапов`}
                      </button>
                    </article>
                  );
                })}
              </div>
            </section>
          </>
        )}
      </main>
    </AppShell>
  );
};

export const Route = createFileRoute("/game/garage")({ component: RaccoonGaragePage });

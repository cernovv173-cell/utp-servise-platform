import { Reveal } from "@/components/reveal";

const repairScenes = [
  {
    image: "/images/repair-scenes/repair-workbench-laptop.webp",
    alt: "Иллюстрация: ноутбук и инструменты на рабочем столе",
    title: "Компьютеры и ноутбуки",
  },
  {
    image: "/images/repair-scenes/repair-laptop-internals.webp",
    alt: "Иллюстрация: разборка ноутбука для диагностики",
    title: "Диагностика и ремонт",
  },
];

export const RepairScenes = () => (
  <section className="mx-auto max-w-7xl px-4 py-10 md:px-8" aria-labelledby="repair-scenes-title">
    <div className="mb-6 max-w-2xl">
      <p className="text-xs font-bold tracking-[0.18em] text-blue-600 uppercase dark:text-cyan-300">
        ЕНОТ СЕРВИС
      </p>
      <h2 id="repair-scenes-title" className="mt-2 text-3xl font-semibold tracking-tight">
        Техника, с которой мы работаем
      </h2>
      <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
        Помогаем с компьютерами и ноутбуками — объясняем этапы ремонта и остаёмся на связи.
      </p>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
        Иллюстрации сервисного направления.
      </p>
    </div>

    <div className="grid gap-4 sm:grid-cols-2">
      {repairScenes.map((scene, index) => (
        <Reveal key={scene.image} delay={index * 0.06} className="h-full">
          <figure className="group relative h-full overflow-hidden rounded-3xl border border-slate-200 bg-slate-950 shadow-sm dark:border-[#405b9c]/40">
            <img
              src={scene.image}
              alt={scene.alt}
              loading="lazy"
              decoding="async"
              className="aspect-[4/3] w-full object-cover object-[center_68%] transition-transform duration-500 group-hover:scale-[1.03]"
            />
            <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/90 via-slate-950/55 to-transparent px-5 pt-12 pb-4 text-sm font-semibold text-white">
              {scene.title}
            </figcaption>
          </figure>
        </Reveal>
      ))}
    </div>
  </section>
);

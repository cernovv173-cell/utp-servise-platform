export const MyTargetAd = () => (
  <section className="my-6" aria-label="Реклама">
    <p className="mb-2 text-center text-xs text-slate-500">Реклама</p>
    <iframe
      src="/mytarget-ad.html"
      title="Рекламное объявление MyTarget"
      width="300"
      height="250"
      loading="lazy"
      referrerPolicy="strict-origin-when-cross-origin"
      className="mx-auto block max-w-full border-0"
    />
  </section>
);

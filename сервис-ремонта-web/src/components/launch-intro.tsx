import { Volume2, VolumeX } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type PlaybackState = "starting" | "playing" | "blocked" | "failed";

export const LaunchIntro = ({ onClose }: { onClose: () => void }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playback, setPlayback] = useState<PlaybackState>("starting");
  const [muted, setMuted] = useState(true);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    document.body.style.overflow = "hidden";
    video.muted = true;
    void video.play().catch(() => setPlayback("blocked"));

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
      video.pause();
    };
  }, [onClose]);

  const startWithSound = async () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = false;
    setMuted(false);
    try {
      await video.play();
      setPlayback("playing");
    } catch {
      setPlayback("failed");
    }
  };

  const toggleSound = () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setMuted(video.muted);
  };

  return (
    <div
      aria-label="Приветствие UTP Servise"
      aria-modal="true"
      className="fixed inset-0 z-[100] grid place-items-center overflow-y-auto bg-[#050a18] px-4 py-8 text-white"
      role="dialog"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_20%,rgba(50,104,255,0.28),transparent_56%),radial-gradient(ellipse_at_85%_90%,rgba(136,70,222,0.2),transparent_44%)]" />
      <section className="relative w-full max-w-4xl rounded-[2rem] border border-white/10 bg-[#0b1429]/80 p-4 shadow-[0_28px_100px_rgba(0,0,0,0.55)] backdrop-blur-xl sm:p-7">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-2xl bg-gradient-to-br from-[#55e6ff] via-[#5580ff] to-[#ad65ff] text-lg font-bold shadow-[0_0_26px_rgba(83,121,255,0.45)]">
              U
            </span>
            <div>
              <p className="font-semibold tracking-wide">UTP Servise</p>
              <p className="text-xs text-blue-100/70">Сервис ремонта техники</p>
            </div>
          </div>
          <button
            className="min-h-11 rounded-xl border border-white/15 px-4 text-sm font-semibold text-white/80 transition hover:border-cyan-200/50 hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300"
            onClick={onClose}
            type="button"
          >
            Пропустить
          </button>
        </div>

        <div className="relative grid min-h-[min(62dvh,34rem)] place-items-center overflow-hidden rounded-3xl bg-[#050a18]">
          <video
            ref={videoRef}
            aria-label="Приветствие от Енота"
            autoPlay
            className={`absolute inset-0 h-full w-full object-contain transition-opacity duration-500 ${playback === "playing" ? "opacity-100" : "opacity-0"}`}
            muted
            onEnded={onClose}
            onError={() => setPlayback("failed")}
            onPlay={() => setPlayback("playing")}
            playsInline
            preload="auto"
          >
            <source src="/welcome-intro.mp4" type="video/mp4" />
          </video>

          {playback !== "playing" && (
            <div className="relative z-10 max-w-lg px-6 py-10 text-center">
              <p className="text-xs font-semibold tracking-[0.22em] text-cyan-200/80 uppercase">
                Рады видеть вас
              </p>
              <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
                Привет! Я ваш енот-сервис!
              </h1>
              <p className="mt-3 text-base leading-7 text-blue-100/75">Махаю вам в знак дружбы!</p>
              {playback === "starting" ? (
                <p className="mt-6 text-sm text-blue-100/60">Загружаем приветствие…</p>
              ) : playback === "blocked" ? (
                <button
                  className="mt-7 inline-flex min-h-12 items-center justify-center rounded-xl bg-gradient-to-r from-blue-500 to-violet-500 px-5 font-semibold shadow-lg shadow-blue-950/40 transition hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300"
                  onClick={() => void startWithSound()}
                  type="button"
                >
                  Посмотреть приветствие со звуком
                </button>
              ) : (
                <button
                  className="mt-7 inline-flex min-h-12 items-center justify-center rounded-xl bg-gradient-to-r from-blue-500 to-violet-500 px-5 font-semibold shadow-lg shadow-blue-950/40 transition hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300"
                  onClick={onClose}
                  type="button"
                >
                  Продолжить
                </button>
              )}
              {playback === "failed" && (
                <p className="mt-4 text-sm text-amber-100/80">
                  Видео не запустилось. Можно продолжить без него.
                </p>
              )}
            </div>
          )}

          {playback === "playing" && (
            <p className="pointer-events-none absolute right-4 bottom-4 left-4 rounded-2xl bg-black/45 px-4 py-3 text-center text-sm font-medium text-white shadow-lg backdrop-blur-sm sm:text-base">
              Привет! Я ваш енот-сервис! Махаю вам в знак дружбы!
            </p>
          )}
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="max-w-xl text-sm leading-6 text-blue-100/60">
            Приветствие можно пропустить в любой момент.
          </p>
          {playback === "playing" && (
            <button
              aria-label={muted ? "Включить звук" : "Выключить звук"}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/15 px-4 text-sm font-medium text-white/85 transition hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300"
              onClick={toggleSound}
              type="button"
            >
              {muted ? <VolumeX size={17} /> : <Volume2 size={17} />}
              {muted ? "Включить звук" : "Выключить звук"}
            </button>
          )}
        </div>
      </section>
    </div>
  );
};

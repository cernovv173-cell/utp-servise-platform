import { Download } from "lucide-react";

const isAppleMobileDevice = () => {
  if (typeof navigator === "undefined") return false;
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
};

export const AppInstallButton = () => {
  if (isAppleMobileDevice()) return null;

  return (
    <a
      href="/downloads/ru.utp.servise.apk"
      download="UTP-Servise.apk"
      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-red-600 px-5 text-sm font-semibold text-white shadow-md shadow-red-600/25 transition hover:bg-red-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500"
    >
      <Download size={17} aria-hidden="true" />
      Установить приложения
    </a>
  );
};

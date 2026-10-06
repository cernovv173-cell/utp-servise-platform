import { Download } from "lucide-react";

export const AppInstallButton = () => (
  <a
    href="/downloads/ru.utp.servise.apk"
    download="UTP-Servise.apk"
    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-red-600 px-5 text-sm font-semibold text-white shadow-md shadow-red-600/25 transition hover:bg-red-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500"
  >
    <Download size={17} aria-hidden="true" />
    Установить приложения
  </a>
);

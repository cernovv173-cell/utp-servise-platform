import { Bot, House } from "lucide-react";

import {
  Modal,
  ModalClose,
  ModalContent,
  ModalDescription,
  ModalFooter,
  ModalHeader,
  ModalTitle,
  ModalTrigger,
} from "@/components/modal";

export const AppInstallButton = () => (
  <div className="flex flex-wrap items-center gap-3">
    <a
      href="/downloads/ru.utp.servise.apk"
      download="UTP-Servise.apk"
      aria-label="Скачать приложение UTP Servise для Android"
      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-red-600 px-5 text-sm font-semibold text-white shadow-md shadow-red-600/25 transition hover:bg-red-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500"
    >
      <Bot size={18} aria-hidden="true" />
      Android APK
    </a>

    <Modal>
      <ModalTrigger asChild>
        <button
          type="button"
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-blue-600 px-5 text-sm font-semibold text-white shadow-md shadow-blue-600/25 transition hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
        >
          <House size={17} aria-hidden="true" />
          На экран «Домой»
        </button>
      </ModalTrigger>
      <ModalContent className="border-slate-200 bg-white text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
        <ModalHeader>
          <ModalTitle>Добавить UTP Servise на экран «Домой»</ModalTitle>
          <ModalDescription className="dark:text-slate-300">
            Так вы создадите ярлык веб-версии на iPhone или iPad. Это не установка приложения из App
            Store.
          </ModalDescription>
        </ModalHeader>
        <ol className="mt-5 list-decimal space-y-2 pl-5 text-sm leading-6 text-slate-700 dark:text-slate-200">
          <li>Откройте сайт в браузере Safari.</li>
          <li>Нажмите «Поделиться» в меню браузера.</li>
          <li>
            Выберите «На экран „Домой“», включите «Открывать как веб-приложение» и нажмите
            «Добавить».
          </li>
        </ol>
        <ModalFooter>
          <ModalClose asChild>
            <button
              type="button"
              className="min-h-10 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Понятно
            </button>
          </ModalClose>
        </ModalFooter>
      </ModalContent>
    </Modal>
  </div>
);

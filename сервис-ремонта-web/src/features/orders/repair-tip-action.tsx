import { HandCoins } from "lucide-react";

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

export const RepairTipAction = ({ serviceNumber }: { serviceNumber: string }) => (
  <Modal>
    <ModalTrigger asChild>
      <button
        type="button"
        className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-emerald-700 px-4 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-50 dark:border-emerald-500 dark:text-emerald-300 dark:hover:bg-emerald-950/40"
      >
        <HandCoins size={17} aria-hidden="true" />
        Отправить чаевые
      </button>
    </ModalTrigger>
    <ModalContent className="dark:border-slate-700 dark:bg-slate-900 dark:text-white">
      <ModalHeader>
        <ModalTitle>Чаевые за ремонт · {serviceNumber}</ModalTitle>
        <ModalDescription className="dark:text-slate-300">
          Приём чаевых пока не подключён. Он станет доступен после регистрации и настройки ЮMoney.
          Сейчас перевод денег не выполняется.
        </ModalDescription>
      </ModalHeader>
      <ModalFooter>
        <ModalClose asChild>
          <button
            type="button"
            className="min-h-10 rounded-lg bg-emerald-700 px-4 text-sm font-semibold text-white transition hover:bg-emerald-800"
          >
            Понятно
          </button>
        </ModalClose>
      </ModalFooter>
    </ModalContent>
  </Modal>
);

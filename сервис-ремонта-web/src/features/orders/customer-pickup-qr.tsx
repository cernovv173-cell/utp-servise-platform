import { useMutation } from "@tanstack/react-query";
import { QrCode } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useState } from "react";
import { toast } from "sonner";

import { Modal, ModalContent, ModalDescription, ModalHeader, ModalTitle } from "@/components/modal";

import { createOrderPickupCode } from "@/lib/api";

export const CustomerPickupQr = ({ token, orderId }: { token: string; orderId: string }) => {
  const [open, setOpen] = useState(false);
  const pickupCode = useMutation({
    mutationFn: () => createOrderPickupCode(token, orderId),
    onError: () =>
      toast.error("Не удалось выпустить QR. Проверьте статус заявки и попробуйте ещё раз."),
  });
  const showQr = () => {
    setOpen(true);
    pickupCode.mutate();
  };

  return (
    <Modal open={open} onOpenChange={setOpen}>
      <button
        type="button"
        onClick={showQr}
        className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-cyan-600 px-4 text-sm font-semibold text-white shadow-[0_0_24px_rgba(35,199,202,0.2)] hover:brightness-110"
      >
        <QrCode size={17} aria-hidden="true" />
        Показать QR для выдачи
      </button>
      <ModalContent className="max-w-sm text-center dark:border-slate-700 dark:bg-slate-900 dark:text-white">
        <ModalHeader>
          <ModalTitle>Подтверждение получения заказа</ModalTitle>
          <ModalDescription className="dark:text-slate-400">
            Покажите код сотруднику сервиса при получении устройства. Он действует 2 часа; каждый
            новый код отменяет предыдущий.
          </ModalDescription>
        </ModalHeader>
        {pickupCode.isPending ? (
          <p className="py-10 text-sm text-slate-500">Готовим одноразовый код…</p>
        ) : pickupCode.data ? (
          <div className="mt-4 grid justify-items-center gap-3 rounded-2xl border border-emerald-200 bg-white p-4 dark:border-emerald-900">
            <QRCodeSVG
              value={pickupCode.data.qrPayload}
              size={232}
              level="M"
              marginSize={4}
              title="Одноразовый QR-код выдачи заказа"
              className="max-w-full"
            />
            <div className="grid justify-items-center gap-1 rounded-xl bg-slate-100 px-5 py-3 dark:bg-slate-800">
              <p className="text-xs font-medium text-slate-600 dark:text-slate-300">
                Если QR не сканируется, сообщите сотруднику код:
              </p>
              <p className="font-mono text-3xl font-bold tracking-[0.35em] text-slate-950 dark:text-white">
                {pickupCode.data.fallbackPin}
              </p>
            </div>
            <p className="text-xs text-slate-500">
              Действует до{" "}
              {new Date(pickupCode.data.expiresAt).toLocaleTimeString("ru-RU", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          </div>
        ) : (
          <p role="alert" className="py-8 text-sm text-rose-600">
            Не удалось сформировать код. Закройте окно и повторите попытку.
          </p>
        )}
      </ModalContent>
    </Modal>
  );
};

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Camera, QrCode } from "lucide-react";
import { type FormEvent, useCallback, useState } from "react";
import { toast } from "sonner";

import {
  Modal,
  ModalContent,
  ModalDescription,
  ModalFooter,
  ModalHeader,
  ModalTitle,
} from "@/components/modal";

import { QrCameraReader } from "@/features/orders/qr-camera-reader";

import { closeOrderByQr } from "@/lib/api";

const inputClass =
  "min-h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950";

export const PickupQrScanner = ({ token }: { token: string }) => {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [qrPayload, setQrPayload] = useState("");
  const [serviceNumber, setServiceNumber] = useState("");
  const [pickupPin, setPickupPin] = useState("");
  const mutation = useMutation({
    mutationFn: () => {
      const handoff =
        qrPayload.trim().length >= 20
          ? { qrPayload: qrPayload.trim() }
          : { serviceNumber: serviceNumber.trim(), pickupPin: pickupPin.trim() };
      return closeOrderByQr(token, handoff);
    },
    onSuccess: async ({ order }) => {
      toast.success(`Заявка ${order.serviceNumber} закрыта. Гарантийный талон сформирован.`);
      setOpen(false);
      setQrPayload("");
      setServiceNumber("");
      setPickupPin("");
      await queryClient.invalidateQueries({ queryKey: ["orders", token] });
      await queryClient.invalidateQueries({ queryKey: ["admin-order-search", token] });
      await queryClient.invalidateQueries({ queryKey: ["order-search", token] });
    },
    onError: () =>
      toast.error("Код выдачи не принят. Проверьте данные клиента, срок действия и статус заявки."),
  });
  const receiveScan = useCallback((value: string) => {
    setQrPayload(value);
    setServiceNumber("");
    setPickupPin("");
  }, []);
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    mutation.mutate();
  };

  return (
    <Modal open={open} onOpenChange={setOpen}>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-cyan-300/50 bg-[#102a4e] px-4 text-sm font-semibold text-white shadow-[0_0_22px_rgba(64,204,255,0.16)] hover:bg-[#173b69]"
      >
        <QrCode size={17} aria-hidden="true" />
        Выдать заказ по QR
      </button>
      <ModalContent className="max-w-xl dark:border-slate-700 dark:bg-slate-900 dark:text-white">
        <ModalHeader>
          <ModalTitle>Подтверждение выдачи заказа</ModalTitle>
          <ModalDescription className="dark:text-slate-400">
            Если QR клиента не сканируется, введите номер заявки и резервный 4-значный код. После
            проверки заявка закроется, а талон с постоянными условиями сохранится в её документах.
          </ModalDescription>
        </ModalHeader>
        <form onSubmit={submit} className="mt-4 grid gap-3">
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm dark:border-emerald-900 dark:bg-emerald-950/40">
            <p className="font-semibold">Постоянные условия гарантии: 1 год</p>
            <p className="mt-1 text-slate-600 dark:text-slate-300">
              Талон с датами, перечнем работ и полным текстом условий автоматически сохранится в
              документах заявки после выдачи.
            </p>
          </div>
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Camera size={16} aria-hidden="true" />
            Сканер QR клиента
          </div>
          <QrCameraReader onScan={receiveScan} />
          <label className="grid gap-1 text-sm font-medium">
            Или введите данные QR вручную
            <input
              value={qrPayload}
              onChange={(event) => {
                setQrPayload(event.target.value);
                setServiceNumber("");
                setPickupPin("");
              }}
              placeholder="UTP-PICKUP:…"
              className={inputClass}
            />
          </label>
          <div className="grid gap-3 rounded-xl border border-slate-200 p-3 dark:border-slate-700">
            <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
              QR не сканируется? Используйте данные с карточки заявки и код клиента.
            </p>
            <label className="grid gap-1 text-sm font-medium">
              Номер заявки
              <input
                value={serviceNumber}
                onChange={(event) => {
                  setServiceNumber(event.target.value);
                  setQrPayload("");
                }}
                placeholder="Например, SRV-2026-000081"
                className={inputClass}
              />
            </label>
            <label className="grid gap-1 text-sm font-medium">
              Резервный код, 4 цифры
              <input
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={4}
                pattern="[0-9]{4}"
                value={pickupPin}
                onChange={(event) => {
                  setPickupPin(event.target.value.replace(/\D/gu, "").slice(0, 4));
                  setQrPayload("");
                }}
                placeholder="0000"
                className={`${inputClass} font-mono tracking-[0.3em]`}
              />
            </label>
          </div>
          <ModalFooter>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="min-h-10 rounded-lg border border-slate-200 px-4 text-sm font-medium dark:border-slate-700"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={
                mutation.isPending ||
                (qrPayload.trim().length < 20 &&
                  (!serviceNumber.trim() || !/^\d{4}$/u.test(pickupPin)))
              }
              className="min-h-10 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white disabled:opacity-50"
            >
              {mutation.isPending ? "Проверяем…" : "Проверить и закрыть"}
            </button>
          </ModalFooter>
        </form>
      </ModalContent>
    </Modal>
  );
};

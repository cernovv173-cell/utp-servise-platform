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
  const [warrantyDays, setWarrantyDays] = useState("");
  const [warrantyTerms, setWarrantyTerms] = useState("");
  const [qrPayload, setQrPayload] = useState("");
  const mutation = useMutation({
    mutationFn: () =>
      closeOrderByQr(token, {
        qrPayload: qrPayload.trim(),
        warrantyDays: Number(warrantyDays),
        warrantyTerms: warrantyTerms.trim(),
      }),
    onSuccess: async ({ order }) => {
      toast.success(`Заявка ${order.serviceNumber} закрыта. Гарантийный талон сформирован.`);
      setOpen(false);
      setQrPayload("");
      await queryClient.invalidateQueries({ queryKey: ["orders", token] });
      await queryClient.invalidateQueries({ queryKey: ["admin-order-search", token] });
      await queryClient.invalidateQueries({ queryKey: ["order-search", token] });
    },
    onError: () => toast.error("QR не принят. Проверьте срок действия и статус заявки."),
  });
  const receiveScan = useCallback((value: string) => setQrPayload(value), []);
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
            Укажите гарантийный срок и условия, затем отсканируйте QR клиента. После проверки заявка
            закроется, а талон сохранится в её документах.
          </ModalDescription>
        </ModalHeader>
        <form onSubmit={submit} className="mt-4 grid gap-3">
          <label className="grid gap-1 text-sm font-medium">
            Срок гарантии, дней <span aria-hidden="true">*</span>
            <input
              type="number"
              required
              min={1}
              max={3650}
              value={warrantyDays}
              onChange={(event) => setWarrantyDays(event.target.value)}
              className={inputClass}
            />
          </label>
          <label className="grid gap-1 text-sm font-medium">
            Условия гарантии <span aria-hidden="true">*</span>
            <textarea
              required
              minLength={5}
              maxLength={2000}
              rows={3}
              value={warrantyTerms}
              onChange={(event) => setWarrantyTerms(event.target.value)}
              className="rounded-lg border border-slate-200 bg-white p-3 text-sm dark:border-slate-700 dark:bg-slate-950"
            />
          </label>
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Camera size={16} aria-hidden="true" />
            Сканер QR клиента
          </div>
          <QrCameraReader onScan={receiveScan} />
          <label className="grid gap-1 text-sm font-medium">
            Или введите данные QR вручную
            <input
              value={qrPayload}
              onChange={(event) => setQrPayload(event.target.value)}
              placeholder="UTP-PICKUP:…"
              className={inputClass}
            />
          </label>
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
              disabled={mutation.isPending || qrPayload.trim().length < 20}
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

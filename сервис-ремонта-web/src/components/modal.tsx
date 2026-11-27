"use client";

import * as Dialog from "@radix-ui/react-dialog";
import type { ComponentProps } from "react";

import { classNames } from "@/lib/class-names";

export const Modal = Dialog.Root;
export const ModalTrigger = Dialog.Trigger;
export const ModalClose = Dialog.Close;

export const ModalContent = ({
  className,
  children,
  ...props
}: ComponentProps<typeof Dialog.Content>) => (
  <Dialog.Portal>
    <Dialog.Overlay className="fixed inset-0 z-40 bg-black/50 backdrop-blur-xs" />
    <Dialog.Content
      className={classNames(
        "fixed top-1/2 left-1/2 z-50 max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border border-slate-700 !bg-slate-900 p-6 !text-white shadow-xl focus:outline-none [&_*:not(svg)]:!text-white [&_input]:!bg-slate-950 [&_input]:!text-white [&_input::placeholder]:!text-white/60 [&_select]:!bg-slate-950 [&_select]:!text-white [&_textarea]:!bg-slate-950 [&_textarea]:!text-white [&_textarea::placeholder]:!text-white/60",
        className,
      )}
      {...props}
    >
      {children}
    </Dialog.Content>
  </Dialog.Portal>
);

export const ModalHeader = ({ className, ...props }: ComponentProps<"div">) => (
  <div className={classNames("space-y-1.5", className)} {...props} />
);

export const ModalFooter = ({ className, ...props }: ComponentProps<"div">) => (
  <div
    className={classNames("mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", className)}
    {...props}
  />
);

export const ModalTitle = ({ className, ...props }: ComponentProps<typeof Dialog.Title>) => (
  <Dialog.Title className={classNames("text-lg font-semibold", className)} {...props} />
);

export const ModalDescription = ({
  className,
  ...props
}: ComponentProps<typeof Dialog.Description>) => (
  <Dialog.Description className={classNames("text-sm text-neutral-600", className)} {...props} />
);

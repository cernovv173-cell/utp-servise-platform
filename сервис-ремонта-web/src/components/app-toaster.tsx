"use client";

import { CircleCheck, CircleX, Info, LoaderCircle, TriangleAlert } from "lucide-react";
import { Toaster } from "sonner";

export const AppToaster = () => (
  <Toaster
    closeButton
    richColors
    position="bottom-right"
    icons={{
      success: <CircleCheck className="size-5" aria-hidden="true" />,
      error: <CircleX className="size-5" aria-hidden="true" />,
      info: <Info className="size-5" aria-hidden="true" />,
      warning: <TriangleAlert className="size-5" aria-hidden="true" />,
      loading: <LoaderCircle className="size-5 motion-safe:animate-spin" aria-hidden="true" />,
    }}
  />
);

import { useEffect, useRef } from "react";

import { encodeServiceNumberBarcode } from "./service-number-barcode";

const BAR_WIDTH = 2;
const BAR_HEIGHT = 72;
const HORIZONTAL_MARGIN = 12;

export const ServiceNumberBarcode = ({ serviceNumber }: { serviceNumber: string }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !serviceNumber.trim()) return;

    const bars = encodeServiceNumberBarcode(serviceNumber);
    const width = bars.length * BAR_WIDTH + HORIZONTAL_MARGIN * 2;
    canvas.width = width;
    canvas.height = BAR_HEIGHT;
    const context = canvas.getContext("2d");
    if (!context) return;

    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, BAR_HEIGHT);
    context.fillStyle = "#000000";
    for (let index = 0; index < bars.length; index += 1) {
      if (bars[index] === "1") {
        context.fillRect(HORIZONTAL_MARGIN + index * BAR_WIDTH, 0, BAR_WIDTH, BAR_HEIGHT);
      }
    }
  }, [serviceNumber]);

  return (
    <figure className="mt-3 w-full max-w-xs rounded-lg border border-slate-200 bg-white p-2 dark:border-slate-700">
      <canvas
        ref={canvasRef}
        width={640}
        height={96}
        role="img"
        aria-label={`Штрихкод заявки ${serviceNumber}`}
        className="block h-auto w-full"
      />
      <figcaption className="mt-1 text-center font-mono text-[11px] text-slate-600">
        {serviceNumber}
      </figcaption>
    </figure>
  );
};

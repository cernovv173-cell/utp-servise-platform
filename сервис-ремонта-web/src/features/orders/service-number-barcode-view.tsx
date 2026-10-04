import JsBarcode from "jsbarcode";
import { useEffect, useRef } from "react";

export const ServiceNumberBarcode = ({ serviceNumber }: { serviceNumber: string }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !serviceNumber.trim()) return;

    JsBarcode(canvas, serviceNumber, {
      format: "CODE128",
      width: 2,
      height: 72,
      displayValue: false,
      margin: 8,
      background: "#ffffff",
      lineColor: "#000000",
    });
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

import { BrowserQRCodeReader } from "@zxing/browser";
import { useEffect, useRef, useState } from "react";

export const QrCameraReader = ({ onScan }: { onScan: (value: string) => void }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const reader = new BrowserQRCodeReader();
    let stopped = false;
    let stopScanner: (() => void) | undefined;

    void reader
      .decodeFromVideoDevice(undefined, video, (result) => {
        if (!result || stopped) return;
        stopped = true;
        stopScanner?.();
        onScan(result.getText());
      })
      .then((controls) => {
        if (stopped) controls.stop();
        else stopScanner = () => controls.stop();
      })
      .catch(() => {
        if (!stopped)
          setError("Не удалось открыть камеру. Разрешите доступ к камере или введите код вручную.");
      });

    return () => {
      stopped = true;
      stopScanner?.();
    };
  }, [onScan]);

  return (
    <div className="grid gap-3">
      <video
        ref={videoRef}
        muted
        playsInline
        aria-label="Камера для чтения QR-кода выдачи заказа"
        className="max-h-72 w-full rounded-xl bg-slate-950 object-cover"
      />
      {error && (
        <p role="alert" className="text-sm text-rose-600">
          {error}
        </p>
      )}
    </div>
  );
};

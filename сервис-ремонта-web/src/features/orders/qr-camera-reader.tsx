import { useEffect, useRef, useState } from "react";

export const QrCameraReader = ({ onScan }: { onScan: (value: string) => void }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    let stopped = false;
    let stopScanner: (() => void) | undefined;

    const startScanner = async () => {
      try {
        const { BrowserQRCodeReader } = await import("@zxing/browser");
        if (stopped) return;

        const reader = new BrowserQRCodeReader();
        const controls = await reader.decodeFromVideoDevice(undefined, video, (result) => {
          if (!result || stopped) return;
          stopped = true;
          stopScanner?.();
          setIsLoading(false);
          onScan(result.getText());
        });

        if (stopped) controls.stop();
        else {
          stopScanner = () => controls.stop();
          setIsLoading(false);
        }
      } catch {
        if (!stopped) {
          setIsLoading(false);
          setError("Не удалось открыть камеру. Разрешите доступ к камере или введите код вручную.");
        }
      }
    };

    void startScanner();

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
      {isLoading && (
        <p role="status" className="text-sm text-slate-500">
          Запускаем сканер…
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-rose-600">
          {error}
        </p>
      )}
    </div>
  );
};

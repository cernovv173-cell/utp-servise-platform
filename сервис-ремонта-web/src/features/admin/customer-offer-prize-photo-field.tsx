import { useEffect, useMemo } from "react";

export const CustomerOfferPrizePhotoField = ({
  place,
  file,
  inputKey,
  disabled,
  onChange,
}: {
  place: number;
  file: File | null;
  inputKey: number;
  disabled: boolean;
  onChange: (file: File | null) => void;
}) => {
  const previewUrl = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  return (
    <div className="grid gap-2 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center">
      <label className="inline-flex min-h-10 cursor-pointer items-center justify-center rounded-xl border border-blue-200 px-4 text-sm font-semibold text-blue-700 hover:bg-blue-50 dark:border-blue-900 dark:text-cyan-200 dark:hover:bg-blue-950/50">
        {file ? "Заменить фото" : "Добавить фото приза"}
        <input
          key={inputKey}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          disabled={disabled}
          className="sr-only"
          aria-label={`Фото приза за ${place}-е место`}
          onChange={(event) => onChange(event.currentTarget.files?.[0] ?? null)}
        />
      </label>
      <div className="flex min-w-0 items-center gap-3">
        {previewUrl && (
          <img
            src={previewUrl}
            alt={`Предпросмотр приза за ${place}-е место`}
            className="size-16 shrink-0 rounded-lg object-cover"
          />
        )}
        <div className="min-w-0">
          <p className="truncate text-xs text-slate-500">
            {file ? file.name : "Фото необязательно · JPG, PNG или WebP, до 5 МБ"}
          </p>
          {file && (
            <button
              type="button"
              disabled={disabled}
              onClick={() => onChange(null)}
              className="mt-1 text-xs font-medium text-rose-600 underline-offset-2 hover:underline disabled:opacity-60"
            >
              Убрать выбранное фото
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

import { useEffect, useState } from "react";
import { toast } from "sonner";

const MAX_PHOTOS = 3;
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const SUPPORTED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

const CraftOrderPhotoPreview = ({ file, onRemove }: { file: File; onRemove: () => void }) => {
  const [previewUrl, setPreviewUrl] = useState("");

  useEffect(() => {
    let isActive = true;
    const reader = new FileReader();
    reader.onload = () => {
      if (isActive && typeof reader.result === "string") setPreviewUrl(reader.result);
    };
    reader.readAsDataURL(file);
    return () => {
      isActive = false;
      if (reader.readyState === FileReader.LOADING) reader.abort();
    };
  }, [file]);

  return (
    <li className="relative size-20 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
      {previewUrl && <img src={previewUrl} alt={file.name} className="size-full object-cover" />}
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Убрать фото ${file.name}`}
        className="absolute top-1 right-1 rounded-md bg-slate-950/75 px-1.5 py-0.5 text-xs font-semibold text-white hover:bg-slate-950"
      >
        Убрать
      </button>
    </li>
  );
};

export const CraftOrderPhotoPicker = ({
  files,
  onChange,
  disabled = false,
}: {
  files: File[];
  onChange: (files: File[]) => void;
  disabled?: boolean;
}) => (
  <div className="grid gap-2">
    <label
      className={`inline-flex min-h-10 w-fit cursor-pointer items-center rounded-lg border border-slate-200 px-3 text-sm font-medium hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800 ${disabled || files.length >= MAX_PHOTOS ? "cursor-not-allowed opacity-50" : ""}`}
    >
      {files.length ? `Добавить ещё фото · ${files.length}/${MAX_PHOTOS}` : "Добавить фото"}
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        className="sr-only"
        disabled={disabled || files.length >= MAX_PHOTOS}
        onChange={(event) => {
          const selectedFiles = Array.from(event.currentTarget.files ?? []);
          event.currentTarget.value = "";

          const accepted: File[] = [];
          for (const file of selectedFiles) {
            if (!SUPPORTED_IMAGE_TYPES.has(file.type)) {
              toast.error("Поддерживаются фотографии JPG, PNG или WebP.");
              continue;
            }
            if (file.size > MAX_PHOTO_BYTES) {
              toast.error("Размер одного фото не должен превышать 5 МБ.");
              continue;
            }
            if (
              files.some((existing) => existing.name === file.name && existing.size === file.size)
            ) {
              continue;
            }
            accepted.push(file);
          }

          const remaining = MAX_PHOTOS - files.length;
          if (accepted.length > remaining) {
            toast.error("К одной заявке можно прикрепить не более 3 фотографий.");
          }
          if (accepted.length > 0 && remaining > 0) {
            onChange([...files, ...accepted.slice(0, remaining)]);
          }
        }}
      />
    </label>
    <p className="text-xs text-slate-500">До 3 фото JPG, PNG или WebP — не более 5 МБ каждое.</p>
    {files.length > 0 && (
      <ul className="flex flex-wrap gap-2" aria-label="Выбранные фотографии">
        {files.map((file) => (
          <CraftOrderPhotoPreview
            key={`${file.name}-${file.size}-${file.lastModified}`}
            file={file}
            onRemove={() => onChange(files.filter((selected) => selected !== file))}
          />
        ))}
      </ul>
    )}
  </div>
);

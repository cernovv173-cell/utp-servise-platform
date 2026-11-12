import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { SectionCard } from "@/components/app-shell";
import { UserAvatar } from "@/components/user-avatar";

import type { User } from "@/lib/api";
import { uploadAvatar } from "@/lib/api";

export const CustomerAvatarCard = ({ token, user }: { token: string; user: User }) => {
  const queryClient = useQueryClient();
  const uploadMutation = useMutation({
    mutationFn: (file: File) => uploadAvatar(token, file),
    onSuccess: async ({ user: updatedUser }) => {
      queryClient.setQueryData(["auth", "me", token], { user: updatedUser });
      await queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
      toast.success("Фото профиля обновлено.");
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Не удалось загрузить фото профиля."),
  });

  return (
    <SectionCard>
      <h2 className="font-semibold">Фото профиля</h2>
      <div className="mt-4 flex flex-wrap items-center gap-4">
        <UserAvatar
          objectId={user.avatarObjectId}
          alt={`Аватар ${user.displayName}`}
          className="size-20 rounded-full"
        />
        <div className="min-w-0 flex-1">
          <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">
            {user.avatarObjectId
              ? "Можно заменить фотографию в любой момент."
              : "Пока у вас нет своего фото — показываем аватар сервиса. Его можно заменить."}
          </p>
          <label className="mt-3 inline-grid cursor-pointer gap-1.5 text-sm font-medium">
            <span className="sr-only">Выбрать фото профиля</span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              disabled={uploadMutation.isPending}
              onChange={(event) => {
                const input = event.currentTarget;
                const file = input.files?.[0];
                input.value = "";
                if (!file) return;
                if (file.size > 5 * 1024 * 1024) {
                  toast.error("Размер фото не должен превышать 5 МБ.");
                  return;
                }
                uploadMutation.mutate(file);
              }}
              className="block max-w-full text-sm file:mr-3 file:min-h-10 file:cursor-pointer file:rounded-xl file:border-0 file:bg-blue-600 file:px-4 file:font-semibold file:text-white hover:file:bg-blue-700 disabled:opacity-60"
            />
          </label>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            JPG, PNG или WEBP, до 5 МБ.
          </p>
          {uploadMutation.isPending && (
            <p role="status" className="mt-2 text-xs text-slate-500">
              Загружаем фото…
            </p>
          )}
        </div>
      </div>
    </SectionCard>
  );
};

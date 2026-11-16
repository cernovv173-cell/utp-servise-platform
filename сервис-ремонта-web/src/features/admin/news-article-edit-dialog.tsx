import { useMutation, useQueryClient } from "@tanstack/react-query";
import { type FormEvent, useState } from "react";
import { toast } from "sonner";

import {
  Modal,
  ModalContent,
  ModalDescription,
  ModalFooter,
  ModalHeader,
  ModalTitle,
} from "@/components/modal";

import { type NewsArticle, updateNews } from "@/lib/api";

export const NewsArticleEditDialog = ({
  article,
  token,
  onClose,
}: {
  article: NewsArticle;
  token: string;
  onClose: () => void;
}) => {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState(article.title);
  const [content, setContent] = useState(article.content);
  const update = useMutation({
    mutationFn: () => updateNews(token, article.id, { title, content }),
    onSuccess: async () => {
      toast.success(
        article.kind === "WORK_STORY" ? "История работы сохранена." : "Новость сохранена.",
      );
      await queryClient.invalidateQueries({ queryKey: ["news", token] });
      onClose();
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Не удалось сохранить публикацию."),
  });

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    update.mutate();
  };

  return (
    <Modal
      open
      onOpenChange={(open) => {
        if (!open && !update.isPending) onClose();
      }}
    >
      <ModalContent className="dark:border-slate-700 dark:bg-slate-900 dark:text-white">
        <ModalHeader>
          <ModalTitle>
            {article.kind === "WORK_STORY" ? "Изменить пример работы" : "Изменить новость"}
          </ModalTitle>
          <ModalDescription className="dark:text-slate-400">
            {article.kind === "WORK_STORY"
              ? "Материал от сервиса, не отзыв клиента."
              : "Измените текст публикации."}
          </ModalDescription>
        </ModalHeader>
        <form onSubmit={submit} className="mt-5 grid gap-4">
          <label className="grid gap-1.5 text-sm font-medium">
            Заголовок
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              required
              minLength={3}
              maxLength={160}
              className="h-11 rounded-xl border border-slate-200 bg-white px-3 font-normal dark:border-slate-700 dark:bg-slate-950"
            />
          </label>
          <label className="grid gap-1.5 text-sm font-medium">
            {article.kind === "WORK_STORY" ? "Описание работы" : "Текст"}
            <textarea
              value={content}
              onChange={(event) => setContent(event.target.value)}
              required
              minLength={5}
              maxLength={8000}
              rows={7}
              className="rounded-xl border border-slate-200 bg-white p-3 font-normal dark:border-slate-700 dark:bg-slate-950"
            />
          </label>
          <ModalFooter>
            <button
              type="button"
              onClick={onClose}
              disabled={update.isPending}
              className="min-h-10 rounded-xl border border-slate-200 px-4 text-sm font-semibold disabled:opacity-50 dark:border-slate-700"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={update.isPending || title.trim().length < 3 || content.trim().length < 5}
              className="min-h-10 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white disabled:opacity-50"
            >
              {update.isPending ? "Сохраняем…" : "Сохранить"}
            </button>
          </ModalFooter>
        </form>
      </ModalContent>
    </Modal>
  );
};

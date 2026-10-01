import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { FormEvent } from "react";

import { SectionCard } from "@/components/app-shell";

import { useAuth } from "@/features/auth/auth-context";

import { type CompanyInfo, getCompany, updateCompany } from "@/lib/api";

const lines = (value: FormDataEntryValue | null) =>
  String(value ?? "")
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);

export const CompanyAdmin = () => {
  const { token } = useAuth();
  const client = useQueryClient();
  const query = useQuery({ queryKey: ["company"], queryFn: ({ signal }) => getCompany(signal) });
  const mutation = useMutation({
    mutationFn: (company: CompanyInfo) => updateCompany(token!, company),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["company"] });
    },
  });
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const socials = lines(form.get("socials")).map((line) => {
      const [label, ...url] = line.split("|");
      return { label: label.trim(), url: url.join("|").trim() };
    });
    mutation.mutate({
      name: String(form.get("name")),
      description: String(form.get("description")),
      history: String(form.get("history")),
      services: lines(form.get("services")),
      phone: String(form.get("phone")),
      email: String(form.get("email")),
      address: String(form.get("address")),
      hours: String(form.get("hours")),
      socials,
      requisites: String(form.get("requisites")),
      mediaUrls: lines(form.get("mediaUrls")),
    });
  };
  const company = query.data?.company;
  return (
    <SectionCard>
      <h2 className="font-semibold">Раздел «О компании»</h2>
      <p className="mt-1 text-sm text-slate-500">
        Контакты, адрес, график, услуги, соцсети, реквизиты и ссылки на фото или видео.
      </p>
      {query.isLoading && <p className="mt-4 text-sm text-slate-500">Загружаем…</p>}
      {company && (
        <form onSubmit={submit} className="mt-5 grid gap-4 md:grid-cols-2">
          <label className="grid gap-1.5 text-sm font-medium">
            Название
            <input
              name="name"
              required
              defaultValue={company.name}
              maxLength={120}
              className="h-10 rounded-lg border border-slate-200 bg-white px-3 font-normal dark:border-slate-700 dark:bg-slate-950"
            />
          </label>
          <label className="grid gap-1.5 text-sm font-medium">
            Телефон
            <input
              name="phone"
              defaultValue={company.phone}
              className="h-10 rounded-lg border border-slate-200 bg-white px-3 font-normal dark:border-slate-700 dark:bg-slate-950"
            />
          </label>
          <label className="grid gap-1.5 text-sm font-medium md:col-span-2">
            Описание
            <textarea
              name="description"
              rows={3}
              defaultValue={company.description}
              className="rounded-lg border border-slate-200 bg-white p-3 font-normal dark:border-slate-700 dark:bg-slate-950"
            />
          </label>
          <label className="grid gap-1.5 text-sm font-medium md:col-span-2">
            История
            <textarea
              name="history"
              rows={3}
              defaultValue={company.history}
              className="rounded-lg border border-slate-200 bg-white p-3 font-normal dark:border-slate-700 dark:bg-slate-950"
            />
          </label>
          <label className="grid gap-1.5 text-sm font-medium">
            Электронная почта
            <input
              name="email"
              type="email"
              defaultValue={company.email}
              className="h-10 rounded-lg border border-slate-200 bg-white px-3 font-normal dark:border-slate-700 dark:bg-slate-950"
            />
          </label>
          <label className="grid gap-1.5 text-sm font-medium">
            Адрес
            <input
              name="address"
              defaultValue={company.address}
              className="h-10 rounded-lg border border-slate-200 bg-white px-3 font-normal dark:border-slate-700 dark:bg-slate-950"
            />
          </label>
          <label className="grid gap-1.5 text-sm font-medium">
            График работы
            <input
              name="hours"
              defaultValue={company.hours}
              className="h-10 rounded-lg border border-slate-200 bg-white px-3 font-normal dark:border-slate-700 dark:bg-slate-950"
            />
          </label>
          <label className="grid gap-1.5 text-sm font-medium">
            Услуги, по одной на строке
            <textarea
              name="services"
              rows={3}
              defaultValue={company.services.join("\n")}
              className="rounded-lg border border-slate-200 bg-white p-3 font-normal dark:border-slate-700 dark:bg-slate-950"
            />
          </label>
          <label className="grid gap-1.5 text-sm font-medium">
            Соцсети — «Название | URL», по одной на строке
            <textarea
              name="socials"
              rows={3}
              defaultValue={company.socials.map((item) => `${item.label} | ${item.url}`).join("\n")}
              className="rounded-lg border border-slate-200 bg-white p-3 font-normal dark:border-slate-700 dark:bg-slate-950"
            />
          </label>
          <label className="grid gap-1.5 text-sm font-medium md:col-span-2">
            Реквизиты
            <textarea
              name="requisites"
              rows={3}
              defaultValue={company.requisites}
              className="rounded-lg border border-slate-200 bg-white p-3 font-normal dark:border-slate-700 dark:bg-slate-950"
            />
          </label>
          <label className="grid gap-1.5 text-sm font-medium md:col-span-2">
            Ссылки на фото или видео, по одной на строке
            <textarea
              name="mediaUrls"
              rows={3}
              defaultValue={company.mediaUrls.join("\n")}
              placeholder="https://…"
              className="rounded-lg border border-slate-200 bg-white p-3 font-normal dark:border-slate-700 dark:bg-slate-950"
            />
            <span className="text-xs text-slate-400">
              Загрузку файлов с устройства пока не подключали; укажите прямые ссылки.
            </span>
          </label>
          {mutation.isError && (
            <p role="alert" className="text-sm text-rose-600 md:col-span-2">
              Не удалось сохранить. Проверьте URL соцсетей и медиа.
            </p>
          )}
          {mutation.isSuccess && (
            <p className="text-sm text-emerald-600 md:col-span-2">Информация обновлена.</p>
          )}
          <button
            disabled={mutation.isPending}
            className="min-h-10 justify-self-start rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white disabled:opacity-60"
          >
            {mutation.isPending ? "Сохраняем…" : "Сохранить раздел"}
          </button>
        </form>
      )}
    </SectionCard>
  );
};

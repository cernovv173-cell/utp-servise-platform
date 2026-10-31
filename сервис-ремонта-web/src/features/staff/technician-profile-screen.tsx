import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { BadgeCheck, BriefcaseBusiness, Star } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AppShell, PageTitle, SectionCard } from "@/components/app-shell";
import { ProtectedImage } from "@/components/protected-image";

import { useAuth } from "@/features/auth/auth-context";

import {
  getTechnicianProfile,
  saveTechnicianProfile,
  setTechnicianProfileVerified,
} from "@/lib/api";

export const TechnicianProfileScreen = ({ technicianId }: { technicianId: string }) => {
  const { token, user } = useAuth();
  const queryClient = useQueryClient();
  const profileQuery = useQuery({
    queryKey: ["technician-profile", token, technicianId],
    queryFn: ({ signal }) => getTechnicianProfile(token!, technicianId, signal),
    enabled: Boolean(token && technicianId),
  });
  const profile = profileQuery.data?.profile;
  const isOwner = user?.role === "TECHNICIAN" && user.id === technicianId;
  const isAdmin = user?.role === "ADMIN";
  const [experience, setExperience] = useState<number | "">(profile?.experienceYears ?? "");
  const [bio, setBio] = useState(profile?.bio ?? "");
  const [certificates, setCertificates] = useState(profile?.certificates.join("\n") ?? "");
  const save = useMutation({
    mutationFn: () =>
      saveTechnicianProfile(token!, technicianId, {
        experienceYears: experience === "" ? null : experience,
        bio,
        certificates: certificates
          .split("\n")
          .map((value) => value.trim())
          .filter(Boolean),
      }),
    onSuccess: async () => {
      toast.success("Профиль мастера сохранён. После изменения потребуется повторная проверка.");
      await queryClient.invalidateQueries({
        queryKey: ["technician-profile", token, technicianId],
      });
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Не удалось сохранить профиль."),
  });
  const verify = useMutation({
    mutationFn: (isVerified: boolean) =>
      setTechnicianProfileVerified(token!, technicianId, isVerified),
    onSuccess: async () => {
      toast.success("Статус проверки профиля обновлён.");
      await queryClient.invalidateQueries({
        queryKey: ["technician-profile", token, technicianId],
      });
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Не удалось изменить статус проверки."),
  });

  return (
    <AppShell active="/orders">
      <PageTitle eyebrow="МАСТЕР" title={profile?.user.displayName ?? "Карточка мастера"} />
      {profileQuery.isLoading && <p className="text-sm text-slate-500">Загружаем профиль…</p>}
      {profileQuery.isError && (
        <SectionCard>
          <p role="alert" className="text-sm text-slate-500">
            {profileQuery.error.message || "Профиль пока недоступен или ожидает подтверждения."}
          </p>
          <Link className="mt-3 inline-flex text-sm text-blue-600 underline" to="/orders">
            Вернуться к заявкам
          </Link>
        </SectionCard>
      )}
      {profile && (
        <>
          <SectionCard className="mb-5">
            <div className="flex flex-wrap items-center gap-4">
              <ProtectedImage
                objectId={profile.user.avatarObjectId}
                alt={`Фото мастера ${profile.user.displayName}`}
                className="size-20 rounded-full object-cover"
              />
              <div className="min-w-0 flex-1">
                <h2 className="text-xl font-semibold">{profile.user.displayName}</h2>
                <p className="mt-1 inline-flex items-center gap-2 text-sm text-slate-500">
                  <BadgeCheck
                    size={17}
                    className={profile.isVerified ? "text-emerald-500" : "text-slate-400"}
                  />
                  {profile.isVerified ? "Профиль проверен" : "Профиль ожидает проверки"}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3 text-center text-sm">
                <div className="rounded-xl bg-slate-100 p-3 dark:bg-slate-800">
                  <span className="flex items-center justify-center gap-1 font-semibold">
                    <Star size={15} className="text-amber-400" />
                    {profile.rating?.toFixed(1) ?? "—"}
                  </span>
                  <span className="text-xs text-slate-500">рейтинг</span>
                </div>
                <div className="rounded-xl bg-slate-100 p-3 dark:bg-slate-800">
                  <span className="flex items-center justify-center gap-1 font-semibold">
                    <BriefcaseBusiness size={15} />
                    {profile.completedOrders}
                  </span>
                  <span className="text-xs text-slate-500">заказов</span>
                </div>
              </div>
            </div>
          </SectionCard>
          <SectionCard>
            {isOwner ? (
              <form
                className="grid gap-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  save.mutate();
                }}
              >
                <label className="grid gap-1.5 text-sm font-medium">
                  Стаж, лет
                  <input
                    type="number"
                    min={0}
                    max={70}
                    value={experience}
                    onChange={(event) =>
                      setExperience(event.target.value === "" ? "" : Number(event.target.value))
                    }
                    className="h-11 rounded-xl border border-slate-200 bg-white px-3 dark:border-slate-700 dark:bg-slate-900"
                  />
                </label>
                <label className="grid gap-1.5 text-sm font-medium">
                  О мастере
                  <textarea
                    maxLength={2000}
                    rows={4}
                    value={bio}
                    onChange={(event) => setBio(event.target.value)}
                    className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900"
                  />
                </label>
                <label className="grid gap-1.5 text-sm font-medium">
                  Сертификаты — по одному в строке
                  <textarea
                    maxLength={4000}
                    rows={3}
                    value={certificates}
                    onChange={(event) => setCertificates(event.target.value)}
                    className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900"
                  />
                </label>
                <button
                  disabled={save.isPending}
                  className="min-h-11 rounded-xl bg-blue-600 px-4 font-semibold text-white disabled:opacity-50"
                >
                  {save.isPending ? "Сохраняем…" : "Сохранить профиль"}
                </button>
              </form>
            ) : (
              <div className="grid gap-4">
                <p>
                  <strong>Стаж:</strong>{" "}
                  {profile.experienceYears === null
                    ? "не указан"
                    : `${profile.experienceYears} лет`}
                </p>
                <p className="whitespace-pre-wrap">
                  {profile.bio || "Описание пока не добавлено."}
                </p>
                <div>
                  <h3 className="font-semibold">Сертификаты</h3>
                  {profile.certificates.length ? (
                    <ul className="mt-2 list-inside list-disc text-sm text-slate-500">
                      {profile.certificates.map((certificate) => (
                        <li key={certificate}>{certificate}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-1 text-sm text-slate-500">Сертификаты не добавлены.</p>
                  )}
                </div>
              </div>
            )}
            {isAdmin && (
              <button
                type="button"
                disabled={verify.isPending}
                onClick={() => verify.mutate(!profile.isVerified)}
                className="mt-5 min-h-10 rounded-lg border border-slate-300 px-4 text-sm font-semibold dark:border-slate-600"
              >
                {profile.isVerified ? "Снять подтверждение" : "Подтвердить профиль"}
              </button>
            )}
          </SectionCard>
        </>
      )}
    </AppShell>
  );
};

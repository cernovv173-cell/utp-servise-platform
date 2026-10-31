import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { BriefcaseBusiness, Star } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AppShell, PageTitle, SectionCard } from "@/components/app-shell";
import { ProtectedImage } from "@/components/protected-image";

import { useAuth } from "@/features/auth/auth-context";

import { getTechnicianProfile, saveTechnicianProfile, uploadAvatar } from "@/lib/api";

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
  const canViewAddress = isOwner || user?.role === "ADMIN";
  const [draft, setDraft] = useState<{
    profileKey: string;
    experience: number | "";
    name: string;
    phone: string;
    address: string;
  } | null>(null);
  const profileKey = profile
    ? `${profile.userId}:${profile.user.displayName}:${profile.user.phoneNumber ?? ""}:${profile.homeAddress}:${profile.experienceYears ?? ""}`
    : "";
  const currentDraft = draft?.profileKey === profileKey ? draft : null;
  const experience = currentDraft?.experience ?? profile?.experienceYears ?? "";
  const name = currentDraft?.name ?? profile?.user.displayName ?? "";
  const phone = currentDraft?.phone ?? profile?.user.phoneNumber ?? "";
  const address = currentDraft?.address ?? profile?.homeAddress ?? "";
  const updateDraft = (updates: Partial<NonNullable<typeof draft>>) =>
    setDraft({
      profileKey,
      experience: currentDraft?.experience ?? profile?.experienceYears ?? "",
      name: currentDraft?.name ?? profile?.user.displayName ?? "",
      phone: currentDraft?.phone ?? profile?.user.phoneNumber ?? "",
      address: currentDraft?.address ?? profile?.homeAddress ?? "",
      ...updates,
    });
  const save = useMutation({
    mutationFn: async () => {
      return saveTechnicianProfile(token!, technicianId, {
        displayName: name,
        phoneNumber: phone || null,
        experienceYears: experience === "" ? null : experience,
        homeAddress: address,
      });
    },
    onSuccess: async () => {
      toast.success("Анкета сохранена.");
      await queryClient.invalidateQueries({
        queryKey: ["technician-profile", token, technicianId],
      });
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Не удалось сохранить профиль."),
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
                <p className="mt-1 text-sm text-slate-500">Анкета мастера</p>
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
                  ФИО
                  <input
                    value={name}
                    onChange={(event) => updateDraft({ name: event.target.value })}
                    required
                    maxLength={120}
                    className="h-11 rounded-xl border border-slate-200 bg-white px-3 dark:border-slate-700 dark:bg-slate-900"
                  />
                </label>
                <label className="grid gap-1.5 text-sm font-medium">
                  Номер телефона
                  <input
                    type="tel"
                    value={phone}
                    onChange={(event) => updateDraft({ phone: event.target.value })}
                    className="h-11 rounded-xl border border-slate-200 bg-white px-3 dark:border-slate-700 dark:bg-slate-900"
                  />
                </label>
                <label className="grid gap-1.5 text-sm font-medium">
                  Домашний адрес{" "}
                  <span className="font-normal text-slate-500">
                    Виден только вам и администратору
                  </span>
                  <input
                    value={address}
                    onChange={(event) => updateDraft({ address: event.target.value })}
                    maxLength={500}
                    className="h-11 rounded-xl border border-slate-200 bg-white px-3 dark:border-slate-700 dark:bg-slate-900"
                  />
                </label>
                <label className="grid gap-1.5 text-sm font-medium">
                  Фото мастера
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file && token)
                        void uploadAvatar(token, file)
                          .then(async () => {
                            toast.success("Фото профиля обновлено.");
                            await queryClient.invalidateQueries({
                              queryKey: ["technician-profile", token, technicianId],
                            });
                            await queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
                          })
                          .catch((error: unknown) =>
                            toast.error(
                              error instanceof Error ? error.message : "Не удалось загрузить фото.",
                            ),
                          );
                    }}
                    className="text-sm"
                  />
                </label>
                <label className="grid gap-1.5 text-sm font-medium">
                  Стаж, лет
                  <input
                    type="number"
                    min={0}
                    max={70}
                    value={experience}
                    onChange={(event) =>
                      updateDraft({
                        experience: event.target.value === "" ? "" : Number(event.target.value),
                      })
                    }
                    className="h-11 rounded-xl border border-slate-200 bg-white px-3 dark:border-slate-700 dark:bg-slate-900"
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
                <p>
                  <strong>Телефон:</strong> {profile.user.phoneNumber || "не указан"}
                </p>
                {canViewAddress && (
                  <p>
                    <strong>Домашний адрес:</strong> {profile.homeAddress || "не указан"}
                  </p>
                )}
              </div>
            )}
          </SectionCard>
        </>
      )}
    </AppShell>
  );
};

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";

import { AppShell, PageTitle, SectionCard } from "@/components/app-shell";

import { useAuth } from "@/features/auth/auth-context";
import { BusinessDeviceManager } from "@/features/business/business-device-manager";
import { BusinessOrderList } from "@/features/business/business-order-list";
import { BusinessProfileForm } from "@/features/business/business-profile-form";

import {
  createCustomerDevice,
  deleteCustomerDevice,
  getCustomerBusinessProfile,
  getCustomerDevices,
  getOrders,
  saveCustomerBusinessProfile,
} from "@/lib/api";

const BusinessPage = () => {
  const { token, user } = useAuth();
  const queryClient = useQueryClient();
  const isCustomer = Boolean(token && user?.role === "CUSTOMER");
  const profileQuery = useQuery({
    queryKey: ["customer-business-profile", token],
    queryFn: ({ signal }) => getCustomerBusinessProfile(token!, signal),
    enabled: isCustomer,
  });
  const hasProfile = Boolean(profileQuery.data?.profile);
  const devicesQuery = useQuery({
    queryKey: ["customer-devices", token, "business"],
    queryFn: ({ signal }) => getCustomerDevices(token!, signal, "business"),
    enabled: isCustomer && hasProfile,
  });
  const ordersQuery = useQuery({
    queryKey: ["orders", token, "all", "business"],
    queryFn: ({ signal }) => getOrders(token!, signal, undefined, "business"),
    enabled: isCustomer && hasProfile,
  });
  const saveProfileMutation = useMutation({
    mutationFn: (companyName: string) => saveCustomerBusinessProfile(token!, companyName),
    onSuccess: async ({ profile }) => {
      queryClient.setQueryData(["customer-business-profile", token], { profile });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["customer-devices", token] }),
        queryClient.invalidateQueries({ queryKey: ["orders", token] }),
      ]);
      toast.success("Профиль компании сохранён");
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Не удалось сохранить профиль."),
  });
  const addDeviceMutation = useMutation({
    mutationFn: (input: Parameters<typeof createCustomerDevice>[1]) =>
      createCustomerDevice(token!, input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["customer-devices", token, "business"],
      });
      toast.success("Устройство добавлено в корпоративный список");
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Не удалось добавить устройство."),
  });
  const deleteDeviceMutation = useMutation({
    mutationFn: (deviceId: string) => deleteCustomerDevice(token!, deviceId, "business"),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["customer-devices", token, "business"],
      });
      toast.success("Устройство удалено; история ремонтов сохранена");
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Не удалось удалить устройство."),
  });

  return (
    <AppShell active="/account">
      <PageTitle
        eyebrow="ДЛЯ КОМПАНИЙ"
        title="Корпоративный кабинет"
        description="Соберите технику компании, заявки на ремонт и документы по ним в одном месте."
        action={
          hasProfile ? (
            <Link
              to="/orders"
              search={{ scope: "business" }}
              className="inline-flex min-h-11 items-center rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Заявки компании
            </Link>
          ) : undefined
        }
      />

      {user?.role !== "CUSTOMER" ? (
        <SectionCard>Корпоративный кабинет доступен после входа в клиентский аккаунт.</SectionCard>
      ) : (
        <>
          {profileQuery.isLoading && (
            <p className="text-sm text-slate-500">Загружаем профиль компании…</p>
          )}
          {profileQuery.isError && (
            <SectionCard>
              <p role="alert" className="text-sm text-rose-600">
                Не удалось загрузить профиль компании. Обновите страницу и попробуйте снова.
              </p>
            </SectionCard>
          )}
          {!profileQuery.isLoading && !profileQuery.isError && (
            <>
              <SectionCard>
                <BusinessProfileForm
                  key={`${profileQuery.data?.profile?.id ?? "new-company"}:${profileQuery.data?.profile?.updatedAt ?? ""}`}
                  companyName={profileQuery.data?.profile?.companyName ?? ""}
                  isSaving={saveProfileMutation.isPending}
                  onSave={(companyName) => saveProfileMutation.mutate(companyName)}
                />
              </SectionCard>
              <p className="mt-3 text-xs leading-5 text-slate-500 dark:text-slate-400">
                Это организационная метка для ваших устройств и новых обращений, а не проверка
                юридического статуса. Старые личные заявки автоматически не переносятся; для
                документов используйте карточки новых заявок. Доступ сотрудников и отдельные
                бухгалтерские документы пока не предусмотрены.
              </p>
              {hasProfile && (
                <div className="mt-5 grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
                  <BusinessDeviceManager
                    devices={devicesQuery.data?.devices ?? []}
                    enabled={hasProfile}
                    isLoading={devicesQuery.isLoading}
                    isError={devicesQuery.isError}
                    isAdding={addDeviceMutation.isPending}
                    isDeleting={deleteDeviceMutation.isPending}
                    onAdd={(input) => addDeviceMutation.mutateAsync(input)}
                    onDelete={(deviceId) => deleteDeviceMutation.mutate(deviceId)}
                  />
                  <BusinessOrderList
                    orders={ordersQuery.data?.orders ?? []}
                    token={token!}
                    isLoading={ordersQuery.isLoading}
                    isError={ordersQuery.isError}
                  />
                </div>
              )}
            </>
          )}
        </>
      )}
    </AppShell>
  );
};

export const Route = createFileRoute("/business")({ component: BusinessPage });

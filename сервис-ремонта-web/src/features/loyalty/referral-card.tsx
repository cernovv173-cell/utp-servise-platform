import { useQuery } from "@tanstack/react-query";
import { Check, Copy, Gift, Users } from "lucide-react";
import { toast } from "sonner";

import { SectionCard } from "@/components/app-shell";

import { getReferralProgram } from "@/lib/api";

export const ReferralCard = ({ token }: { token: string }) => {
  const query = useQuery({
    queryKey: ["referrals", token],
    queryFn: ({ signal }) => getReferralProgram(token, signal),
  });
  const codes = query.data?.codes?.length
    ? query.data.codes
    : query.data?.referralCode
      ? [
          {
            id: "legacy-primary",
            slot: 1,
            code: query.data.referralCode,
            issuedAt: "",
            expiresAt: "",
            status: "AVAILABLE" as const,
          },
        ]
      : [];

  const copyInviteLink = async (code: string) => {
    try {
      const inviteLink = `${window.location.origin}/login?ref=${encodeURIComponent(code)}`;
      await navigator.clipboard.writeText(inviteLink);
      toast.success("Ссылка приглашения скопирована.");
    } catch {
      toast.error("Не удалось скопировать ссылку. Попробуйте ещё раз.");
    }
  };

  const statusLabel = (status: (typeof codes)[number]["status"]) => {
    switch (status) {
      case "AVAILABLE":
        return "Можно отправить другу";
      case "PENDING":
        return "Ждём завершения и оплаты первого ремонта";
      case "REWARDED":
        return "Награда начислена";
      case "EXPIRED":
        return "Срок действия истёк";
      case "USED":
        return "Код использован";
    }
  };

  return (
    <SectionCard className="mt-4 max-w-3xl">
      <div className="flex items-start gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300">
          <Gift size={21} />
        </span>
        <div>
          <h2 className="font-semibold">Пригласите друга</h2>
          <p className="mt-1 text-sm leading-6 text-slate-500">
            У вас {query.data?.codeCount ?? 3} личных одноразовых кода — каждый действует{" "}
            {query.data?.validityMonths ?? 6} месяцев с момента выдачи. После первого завершённого и
            оплаченного ремонта нового клиента вам обоим начислят по{" "}
            {query.data?.rewardPoints ?? 250} баллов. Регистрация без оплаты ремонта баллы не даёт.
            Баллы можно использовать для скидки на услуги ремонта; они не переводятся и не выдаются
            деньгами.
          </p>
        </div>
      </div>

      {query.isLoading && <p className="mt-4 text-sm text-slate-500">Готовим вашу ссылку…</p>}
      {query.isError && (
        <p role="alert" className="mt-4 text-sm text-rose-600">
          Не удалось загрузить приглашения. Обновите страницу и попробуйте ещё раз.
        </p>
      )}
      {query.data && (
        <>
          <div className="mt-5 grid grid-cols-3 gap-2 text-center">
            {[
              ["Приглашено", query.data.totalInvites],
              ["Ожидают ремонта", query.data.pendingCount],
              ["Награда получена", query.data.rewardedCount],
            ].map(([label, count]) => (
              <div key={label} className="rounded-xl bg-slate-50 px-2 py-3 dark:bg-slate-800/70">
                <p className="text-lg font-semibold">{count}</p>
                <p className="mt-1 text-xs leading-4 text-slate-500">{label}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {codes.map((code) => {
              const inviteLink = `${window.location.origin}/login?ref=${encodeURIComponent(code.code)}`;
              const available = code.status === "AVAILABLE";
              return (
                <div
                  key={code.id}
                  className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-xs text-slate-500">
                        Код {code.slot} из {query.data?.codeCount ?? 3}
                      </p>
                      <p className="mt-1 font-mono text-sm font-bold tracking-wide break-all text-blue-700 dark:text-blue-300">
                        {code.code}
                      </p>
                    </div>
                    {code.status === "REWARDED" && (
                      <Check size={16} className="shrink-0 text-emerald-600" />
                    )}
                  </div>
                  <p className="mt-3 min-h-10 text-xs leading-5 text-slate-500">
                    {statusLabel(code.status)}
                  </p>
                  {code.expiresAt && (
                    <p className="mt-1 text-xs text-slate-500">
                      Действует до {new Date(code.expiresAt).toLocaleDateString("ru-RU")}
                    </p>
                  )}
                  {available && (
                    <div className="mt-3 flex flex-col gap-2">
                      <input
                        aria-label={`Ссылка приглашения по коду ${code.slot}`}
                        readOnly
                        value={inviteLink}
                        className="min-h-10 min-w-0 rounded-xl border border-slate-200 bg-slate-50 px-2 text-xs text-slate-600 outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                      />
                      <button
                        type="button"
                        onClick={() => void copyInviteLink(code.code)}
                        className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-blue-600 px-3 text-sm font-semibold text-white hover:bg-blue-700"
                      >
                        <Copy size={15} /> Скопировать ссылку
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {query.data.referrals.length > 0 && (
            <div className="mt-5">
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <Users size={16} /> Последние приглашения
              </h3>
              <ul className="mt-2 grid gap-2">
                {query.data.referrals.slice(0, 5).map((referral) => (
                  <li
                    key={referral.id}
                    className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2 text-sm dark:bg-slate-800/70"
                  >
                    <span className="text-slate-500">
                      {new Date(referral.createdAt).toLocaleDateString("ru-RU")}
                    </span>
                    <span className="inline-flex items-center gap-1.5 font-medium">
                      {referral.status === "REWARDED" ? (
                        <>
                          <Check size={15} className="text-emerald-600" /> Награда начислена
                        </>
                      ) : (
                        "Ожидает первой оплаты ремонта"
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </SectionCard>
  );
};

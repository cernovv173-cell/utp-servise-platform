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
  const inviteLink = query.data
    ? `${window.location.origin}/login?ref=${encodeURIComponent(query.data.referralCode)}`
    : "";

  const copyInviteLink = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink);
      toast.success("Ссылка приглашения скопирована.");
    } catch {
      toast.error("Не удалось скопировать ссылку. Скопируйте её из поля ниже.");
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
            После завершения первого ремонта и подтверждения оплаты сервисом вам обоим начислят по
            100 бонусных баллов. Их можно использовать для скидки на услуги ремонта; баллы не
            переводятся и не выдаются деньгами.
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
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <input
              aria-label="Ваша ссылка приглашения"
              readOnly
              value={inviteLink}
              className="min-h-11 min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-600 outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
            />
            <button
              type="button"
              onClick={() => void copyInviteLink()}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700"
            >
              <Copy size={16} /> Скопировать ссылку
            </button>
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

type RepairOrderIntakeNoticeProps = {
  readonly phone?: string;
  readonly className?: string;
};

export const RepairOrderIntakeNotice = ({
  phone,
  className = "",
}: RepairOrderIntakeNoticeProps) => (
  <div
    role="status"
    className={`rounded-2xl border border-amber-300/80 bg-amber-50 p-4 text-amber-950 dark:border-amber-700/60 dark:bg-amber-950/30 dark:text-amber-100 ${className}`}
  >
    <p className="font-semibold">Приём новых заявок временно приостановлен</p>
    <p className="mt-1 text-sm leading-6">
      Уже созданные заявки и их статусы остаются доступны в личном кабинете.
    </p>
    {phone && (
      <a
        href={`tel:${phone.replace(/[^\d+]/gu, "")}`}
        className="mt-2 inline-flex min-h-10 items-center font-semibold underline underline-offset-4"
      >
        Связаться с сервисом: {phone}
      </a>
    )}
  </div>
);

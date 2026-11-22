import { type FormEvent, useState } from "react";

export const BusinessProfileForm = ({
  companyName: savedCompanyName,
  isSaving,
  onSave,
}: {
  companyName: string;
  isSaving: boolean;
  onSave: (companyName: string) => void;
}) => {
  const [companyName, setCompanyName] = useState(savedCompanyName);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSave(companyName.trim());
  };

  return (
    <form onSubmit={submit} className="grid gap-4">
      <div>
        <h2 className="font-semibold">Профиль компании</h2>
        <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">
          Сейчас кабинет привязан к вашему клиентскому аккаунту: доступ есть только у вас.
          Сотрудников и отдельные роли компания пока не подключает.
        </p>
      </div>
      <label className="grid gap-1.5 text-sm font-medium">
        Название компании&nbsp;*
        <input
          required
          minLength={2}
          maxLength={160}
          value={companyName}
          onChange={(event) => setCompanyName(event.target.value)}
          placeholder="Например, ООО «Ромашка»"
          className="min-h-11 rounded-xl border border-slate-200 bg-white px-3 font-normal dark:border-slate-700 dark:bg-slate-950"
        />
      </label>
      <button
        type="submit"
        disabled={isSaving || companyName.trim().length < 2}
        className="min-h-11 justify-self-start rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isSaving ? "Сохраняем…" : savedCompanyName ? "Сохранить название" : "Создать профиль"}
      </button>
    </form>
  );
};

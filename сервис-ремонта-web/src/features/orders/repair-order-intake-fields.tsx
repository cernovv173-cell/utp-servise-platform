import type { RepairLocation } from "@/lib/api";

const fieldClassName =
  "h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-normal dark:border-slate-700 dark:bg-slate-900";

const deviceTypes = [
  ["COMPUTER", "ПК"],
  ["LAPTOP", "Ноутбук"],
  ["MONOBLOCK", "Моноблок"],
] as const;

type RepairOrderDeviceFieldsProps = {
  deviceType: string;
  onDeviceTypeChange: (value: string) => void;
  deviceTypeLocked?: boolean;
  showDeviceDetails?: boolean;
  problem: string;
  onProblemChange: (value: string) => void;
  wideClassName?: string;
};

export const RepairOrderDeviceFields = ({
  deviceType,
  onDeviceTypeChange,
  deviceTypeLocked = false,
  showDeviceDetails = true,
  problem,
  onProblemChange,
  wideClassName = "md:col-span-2",
}: RepairOrderDeviceFieldsProps) => (
  <>
    <label className="grid gap-1.5 text-sm font-medium">
      Тип устройства
      <select
        name="deviceType"
        value={deviceType}
        onChange={(event) => onDeviceTypeChange(event.target.value)}
        disabled={deviceTypeLocked}
        className={fieldClassName}
      >
        {deviceTypes.map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
    </label>
    {deviceTypeLocked && <input type="hidden" name="deviceType" value={deviceType} />}
    {showDeviceDetails && (
      <>
        <label className="grid gap-1.5 text-sm font-medium">
          Марка
          <input name="deviceBrand" maxLength={120} className={fieldClassName} />
        </label>
        <label className="grid gap-1.5 text-sm font-medium">
          Модель
          <input name="deviceModel" maxLength={160} className={fieldClassName} />
        </label>
        <label className={`grid gap-1.5 text-sm font-medium ${wideClassName}`}>
          Серийный номер (если известен)
          <input name="deviceSerialNumber" maxLength={160} className={fieldClassName} />
        </label>
      </>
    )}
    <label className={`grid gap-1.5 text-sm font-medium ${wideClassName}`}>
      Опишите неисправность
      <textarea
        name="problem"
        minLength={5}
        maxLength={2000}
        required
        rows={3}
        value={problem}
        onChange={(event) => onProblemChange(event.target.value)}
        className="rounded-xl border border-slate-200 bg-white p-3 text-sm font-normal dark:border-slate-700 dark:bg-slate-900"
      />
    </label>
  </>
);

type RepairOrderContactFieldsProps = {
  phone: string;
  onPhoneChange: (value: string) => void;
  phoneRequired?: boolean;
  phoneLabel?: string;
  repairLocation: RepairLocation;
  wideClassName?: string;
};

const localDateTimeMinimum = () => {
  const localNow = new Date(Date.now() - new Date().getTimezoneOffset() * 60_000);
  return localNow.toISOString().slice(0, 16);
};

export const RepairOrderContactFields = ({
  phone,
  onPhoneChange,
  phoneRequired = true,
  phoneLabel = "Телефон для связи",
  repairLocation,
  wideClassName = "md:col-span-2",
}: RepairOrderContactFieldsProps) => (
  <>
    <label className="grid gap-1.5 text-sm font-medium">
      {phoneLabel}
      <input
        name="contactPhone"
        type="tel"
        minLength={7}
        maxLength={32}
        required={phoneRequired}
        value={phone}
        onChange={(event) => onPhoneChange(event.target.value)}
        className={fieldClassName}
      />
    </label>
    <label className="grid gap-1.5 text-sm font-medium">
      Город {repairLocation === "CUSTOMER_ADDRESS" ? "для выезда" : "(необязательно)"}
      <input
        name="city"
        maxLength={120}
        required={repairLocation === "CUSTOMER_ADDRESS"}
        className={fieldClassName}
      />
    </label>
    <label className="grid gap-1.5 text-sm font-medium">
      Улица {repairLocation === "CUSTOMER_ADDRESS" ? "для выезда" : "(необязательно)"}
      <input
        name="street"
        maxLength={180}
        required={repairLocation === "CUSTOMER_ADDRESS"}
        className={fieldClassName}
      />
    </label>
    <label className="grid gap-1.5 text-sm font-medium">
      Дом {repairLocation === "CUSTOMER_ADDRESS" ? "для выезда" : "(необязательно)"}
      <input
        name="house"
        maxLength={30}
        required={repairLocation === "CUSTOMER_ADDRESS"}
        className={fieldClassName}
      />
    </label>
    <label className="grid gap-1.5 text-sm font-medium">
      Квартира
      <input name="apartment" maxLength={30} className={fieldClassName} />
    </label>
    <label className="grid gap-1.5 text-sm font-medium">
      Подъезд
      <input name="entrance" maxLength={30} className={fieldClassName} />
    </label>
    <label className="grid gap-1.5 text-sm font-medium">
      Этаж
      <input name="floor" maxLength={20} className={fieldClassName} />
    </label>
    <label className="grid gap-1.5 text-sm font-medium">
      Дополнительный телефон
      <input name="additionalPhone" type="tel" maxLength={32} className={fieldClassName} />
    </label>
    <label className="grid gap-1.5 text-sm font-medium">
      Удобное время для связи или выезда
      <input
        name="preferredAt"
        type="datetime-local"
        min={localDateTimeMinimum()}
        className={fieldClassName}
      />
    </label>
    <p className="self-end text-xs leading-5 text-slate-500">
      Время предварительное: сервис подтвердит его после проверки расписания.
    </p>
    <label className="flex items-center gap-2 text-sm font-medium">
      <input type="checkbox" name="hasBarrier" className="size-4 accent-blue-600" />
      Есть шлагбаум
    </label>
    <label className={`grid gap-1.5 text-sm font-medium ${wideClassName}`}>
      Дополнительная информация
      <textarea
        name="additionalInfo"
        maxLength={500}
        rows={2}
        className="rounded-xl border border-slate-200 bg-white p-3 text-sm font-normal dark:border-slate-700 dark:bg-slate-900"
      />
    </label>
  </>
);

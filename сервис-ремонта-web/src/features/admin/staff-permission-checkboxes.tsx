import type { StaffPermission, StaffPermissionOption } from "@/lib/api";

export const StaffPermissionCheckboxes = ({
  options,
  selected,
  onChange,
  disabled = false,
  label = "Доступ к разделам",
}: {
  options: StaffPermissionOption[];
  selected: StaffPermission[];
  onChange: (permissions: StaffPermission[]) => void;
  disabled?: boolean;
  label?: string;
}) => (
  <fieldset disabled={disabled} className="grid gap-2">
    <legend className="text-sm font-medium">{label}</legend>
    <div className="grid gap-2 sm:grid-cols-2">
      {options.map((option) => {
        const checked = selected.includes(option.key);
        return (
          <label
            key={option.key}
            className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition ${checked ? "border-blue-500 bg-blue-50/70 dark:bg-blue-950/30" : "border-slate-200 dark:border-slate-700"} ${disabled ? "cursor-not-allowed opacity-60" : "hover:border-blue-300 dark:hover:border-blue-800"}`}
          >
            <input
              type="checkbox"
              checked={checked}
              onChange={(event) => {
                onChange(
                  event.currentTarget.checked
                    ? [...selected, option.key]
                    : selected.filter((permission) => permission !== option.key),
                );
              }}
              className="mt-0.5 size-4 shrink-0 accent-blue-600"
            />
            <span className="grid gap-1">
              <span className="text-sm font-semibold">{option.label}</span>
              <span className="text-xs leading-5 text-slate-500 dark:text-slate-400">
                {option.description}
              </span>
            </span>
          </label>
        );
      })}
    </div>
  </fieldset>
);

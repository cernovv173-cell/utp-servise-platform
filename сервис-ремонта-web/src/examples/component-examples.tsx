"use client";

/*
 * Reference examples for the supplied components and inline Tailwind styling.
 * One file is intentional for this demo only. In product code, strongly prefer separate
 * components, hooks and utilities by responsibility; do not copy this all-in-one structure.
 * Replace the demo page while reusing suitable primitives from components.
 * Keep Next.js client boundaries focused.
 */
import { zodResolver } from "@hookform/resolvers/zod";
import { Send } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Calendar } from "@/components/calendar";
import { DatePicker } from "@/components/date-picker";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/dropdown-menu";
import {
  Modal,
  ModalClose,
  ModalContent,
  ModalDescription,
  ModalFooter,
  ModalHeader,
  ModalTitle,
  ModalTrigger,
} from "@/components/modal";
import { Reveal } from "@/components/reveal";
import { Select } from "@/components/select";

import { QueryExamples } from "@/examples/query-examples";
import { TableExample } from "@/examples/table-example";

export const ComponentExamples = () => (
  <main className="min-h-dvh bg-neutral-50 px-5 py-12 text-neutral-950 sm:px-8 sm:py-20">
    <div className="mx-auto max-w-5xl">
      <header className="max-w-2xl">
        <p className="text-sm font-medium text-neutral-500">Application starter</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">Ready to build.</h1>
        <p className="mt-5 text-base leading-7 text-neutral-600">
          Working examples of the included UI components. Try the controls, then replace this
          demonstration with your application.
        </p>
      </header>
      <div className="mt-10 grid gap-6 md:grid-cols-2">
        <Reveal className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Dialogs and menus</h2>
          <p className="mt-2 mb-6 text-sm leading-6 text-neutral-600">
            Open a dialog or try menu actions, checkboxes and radio options.
          </p>
          <ActionExamples />
        </Reveal>
        <Reveal
          delay={0.08}
          className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm"
        >
          <h2 className="text-lg font-semibold">Selection</h2>
          <p className="mt-2 mb-6 text-sm leading-6 text-neutral-600">
            Choose an option with the mouse or keyboard.
          </p>
          <SelectExample />
        </Reveal>
        <Reveal
          delay={0.16}
          className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm md:col-span-2"
        >
          <h2 className="text-lg font-semibold">Dates</h2>
          <p className="mt-2 mb-6 text-sm leading-6 text-neutral-600">
            The calendar and date picker share the same selected date.
          </p>
          <DateExamples />
        </Reveal>
        <Reveal className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Notifications</h2>
          <p className="mt-2 mb-6 text-sm leading-6 text-neutral-600">
            Try each notification, including a loading state.
          </p>
          <ToastExamples />
        </Reveal>
        <Reveal className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Validated form</h2>
          <p className="mt-2 mb-6 text-sm leading-6 text-neutral-600">
            Submit empty fields to see validation, then try valid details.
          </p>
          <FormExample />
        </Reveal>
        <Reveal className="min-w-0 rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm md:col-span-2">
          <h2 className="text-lg font-semibold">Table</h2>
          <p className="mt-2 mb-6 text-sm leading-6 text-neutral-600">
            Headers, rows and a footer. Scroll horizontally on smaller screens.
          </p>
          <TableExample />
        </Reveal>
        <QueryExamples />
      </div>
      <footer className="mt-8 text-sm text-neutral-500">
        Modal · DropdownMenu · Select · Calendar · DatePicker · Table · Reveal · Toasts · Forms ·
        Icons
      </footer>
    </div>
  </main>
);

const ActionExamples = () => {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState(true);
  const [density, setDensity] = useState("comfortable");
  const [message, setMessage] = useState("Try an action to see its result.");

  return (
    <div>
      <div className="flex flex-wrap gap-3">
        <Modal open={open} onOpenChange={setOpen}>
          <ModalTrigger asChild>
            <button
              type="button"
              className="rounded-lg bg-neutral-950 px-4 py-2.5 text-sm font-medium text-white focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              Open dialog
            </button>
          </ModalTrigger>
          <ModalContent>
            <ModalHeader>
              <ModalTitle>A reusable dialog</ModalTitle>
              <ModalDescription>
                Focus stays inside while open. Escape or Cancel closes it.
              </ModalDescription>
            </ModalHeader>
            <p className="mt-5 text-sm leading-6 text-neutral-700">
              Use this component for an edit form, confirmation or focused interaction.
            </p>
            <ModalFooter>
              <ModalClose asChild>
                <button
                  type="button"
                  className="rounded-lg border border-neutral-300 px-4 py-2 text-sm"
                >
                  Cancel
                </button>
              </ModalClose>
              <button
                type="button"
                className="rounded-lg bg-neutral-950 px-4 py-2 text-sm text-white"
                onClick={() => {
                  setMessage("Dialog confirmed.");
                  setOpen(false);
                }}
              >
                Confirm
              </button>
            </ModalFooter>
          </ModalContent>
        </Modal>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="rounded-lg border border-neutral-300 px-4 py-2.5 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              Menu options
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuLabel>Example actions</DropdownMenuLabel>
            <DropdownMenuGroup>
              <DropdownMenuItem onSelect={() => setMessage("Menu action selected.")}>
                Run an action
              </DropdownMenuItem>
              <DropdownMenuItem disabled>Unavailable action</DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuCheckboxItem
              checked={notifications}
              onCheckedChange={(value) => setNotifications(value === true)}
            >
              Notifications
            </DropdownMenuCheckboxItem>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Density</DropdownMenuLabel>
            <DropdownMenuRadioGroup value={density} onValueChange={setDensity}>
              <DropdownMenuRadioItem value="comfortable">Comfortable</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="compact">Compact</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <p className="mt-5 text-sm text-neutral-600" role="status">
        {message}
      </p>
      <p className="mt-2 text-xs text-neutral-500">
        Notifications {notifications ? "on" : "off"} · {density}
      </p>
    </div>
  );
};

const DateExamples = () => {
  const [date, setDate] = useState<Date | undefined>();
  const [month, setMonth] = useState(() => new Date(2026, 0, 1));
  const selectDate = (value: Date | undefined) => {
    setDate(value);
    if (value) setMonth(value);
  };

  return (
    <div className="flex flex-col items-start gap-6 sm:flex-row sm:gap-10">
      <div className="relative rounded-xl border border-neutral-200">
        <Calendar
          mode="single"
          month={month}
          onMonthChange={setMonth}
          selected={date}
          onSelect={selectDate}
        />
      </div>
      <div className="w-full max-w-sm">
        <p className="mb-3 text-sm font-medium">Date picker</p>
        <DatePicker
          ariaLabel="Example date"
          value={date}
          onValueChange={selectDate}
          locale="en-GB"
        />
        <p className="mt-4 text-sm text-neutral-600" role="status">
          {date
            ? `Selected: ${date.toLocaleDateString("en-GB")}`
            : "Choose a date in either control."}
        </p>
        <button
          type="button"
          disabled={!date}
          onClick={() => setDate(undefined)}
          className="mt-4 rounded-lg border border-neutral-300 px-3 py-2 text-sm disabled:opacity-40"
        >
          Clear date
        </button>
      </div>
    </div>
  );
};

const SelectExample = () => {
  const [value, setValue] = useState("draft");

  return (
    <div className="max-w-sm">
      <Select
        ariaLabel="Example status"
        value={value}
        onValueChange={setValue}
        options={[
          { value: "draft", label: "Draft" },
          { value: "review", label: "In review" },
          { value: "ready", label: "Ready" },
          { value: "archived", label: "Archived", disabled: true },
        ]}
      />
      <p className="mt-4 text-sm text-neutral-600" role="status">
        Selected value: {value}
      </p>
    </div>
  );
};

const ToastExamples = () => (
  <div className="flex flex-wrap gap-3">
    {(["success", "error", "info", "warning"] as const).map((kind) => (
      <button
        key={kind}
        type="button"
        className="rounded-lg border border-neutral-300 px-4 py-2 text-sm capitalize"
        onClick={() =>
          toast[kind](`Example ${kind} notification`, {
            description: "Notifications are available on every page.",
          })
        }
      >
        {kind}
      </button>
    ))}
    <button
      type="button"
      className="rounded-lg border border-neutral-300 px-4 py-2 text-sm"
      onClick={() =>
        toast.promise(new Promise<void>((resolve) => setTimeout(resolve, 1000)), {
          loading: "Running a demo action…",
          success: "Demo action completed.",
          error: "Demo action failed.",
        })
      }
    >
      Loading to success
    </button>
  </div>
);

const exampleFormSchema = z.object({
  name: z.string().trim().min(2, "Enter at least two characters."),
  email: z.email("Enter a valid email address."),
});

const FormExample = () => {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<z.infer<typeof exampleFormSchema>>({
    resolver: zodResolver(exampleFormSchema),
    defaultValues: { name: "", email: "" },
  });
  return (
    <form
      noValidate
      className="grid gap-4"
      onSubmit={handleSubmit((values) => {
        toast.success(`Thanks, ${values.name}!`, {
          description: "Demo form validated. No data was sent.",
        });
        reset();
      })}
    >
      <div>
        <label htmlFor="example-name" className="mb-2 block text-sm font-medium">
          Name
          <span aria-hidden="true" className="inline text-red-700">
            {"\u00a0"}*
          </span>
        </label>
        <input
          id="example-name"
          required
          autoComplete="name"
          {...register("name")}
          aria-invalid={Boolean(errors.name)}
          aria-describedby={errors.name ? "example-name-error" : undefined}
          className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 focus-visible:outline-2 focus-visible:outline-offset-2"
        />
        {errors.name && (
          <p id="example-name-error" role="alert" className="mt-2 text-sm text-red-700">
            {errors.name.message}
          </p>
        )}
      </div>
      <div>
        <label htmlFor="example-email" className="mb-2 block text-sm font-medium">
          Email
          <span aria-hidden="true" className="inline text-red-700">
            {"\u00a0"}*
          </span>
        </label>
        <input
          id="example-email"
          required
          type="email"
          autoComplete="email"
          {...register("email")}
          aria-invalid={Boolean(errors.email)}
          aria-describedby={errors.email ? "example-email-error" : undefined}
          className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 focus-visible:outline-2 focus-visible:outline-offset-2"
        />
        {errors.email && (
          <p id="example-email-error" role="alert" className="mt-2 text-sm text-red-700">
            {errors.email.message}
          </p>
        )}
      </div>
      <button
        type="submit"
        className="inline-flex items-center justify-center gap-2 rounded-lg bg-neutral-950 px-4 py-2.5 text-sm font-medium text-white"
      >
        <Send className="size-4" aria-hidden="true" />
        Submit demo
      </button>
    </form>
  );
};

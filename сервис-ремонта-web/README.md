# Application

Install dependencies and start the development server:

```bash
pnpm install
pnpm run dev
```

## Reusable UI

Brand-neutral interactive primitives live under `@/components` and are imported directly from
their files:

- `Modal` and its compound dialog components
- `DropdownMenu` with regular, checkbox, and radio items
- `Select`, implemented with Radix Popover and keyboard navigation
- `Calendar` and the Popover-based `DatePicker`
- `Reveal`, powered by Motion with reduced-motion support
- `Table` with header, body, footer, row, header-cell, cell and caption components; horizontal scrolling stays inside the table

This application does not define a theme. Style product surfaces with inline Tailwind utilities and
adapt the neutral primitive classes when the requested design requires it.

## Home page examples

The home route renders `src/examples/component-examples.tsx`. Follow its direct imports
for working dialog/menu actions, a controlled Select, a Calendar and DatePicker sharing state,
Motion Reveal containers, Sonner notifications with Lucide icons, and a React Hook Form
with Zod validation, required labels and accessible field errors. `src/examples/table-example.tsx` demonstrates the compound Table with scoped headers, rows, a caption and a footer. The examples demonstrate inline Tailwind styling and reuse of every
supplied UI primitive. The single demo file owns its example state; the surrounding page stays composable. Its opening
comment explains why product code should split components and supporting logic by responsibility.
Replace this demonstration when building the product and retain useful primitives. During later
feature work, inspect the current page and component consumers before adding a parallel implementation.

## Installed UI libraries

- `lucide-react`: icons, imported individually from the package.
- `sonner`: toast notifications; `AppToaster` is already mounted once at the application root.
  Import `toast` from `sonner` in any interactive component; keep the root host when replacing the demo.
- `react-hook-form`, `zod`, and `@hookform/resolvers`: forms with schema validation.

## Server requests with TanStack Query

Use TanStack Query for client-side server requests instead of manually coordinating fetch in effects.

src/main.tsx already mounts QueryClientProvider; src/lib/query-client.ts configures its stable client. Query defaults: 30-second staleTime, one query retry, no window-focus refetch, no mutation retries. Three small reference hooks in src/examples use useQuery, useMutation (invalidates related queries on success), and useInfiniteQuery (cursor pagination with separate keys). src/examples/query-examples.tsx demonstrates loading, errors, retries, mutations, and load-more in the home component examples. The example API is in-memory demo data, not a backend; replace it with real endpoints using src/lib/request-json.ts (checks HTTP status and accepts AbortSignal). Keep query keys inline in the hooks; separate request functions and UI; adapt these examples into feature hooks rather than building another cache or generic hook framework.

```ts
// Request functions use fetch; hooks own client request state and caching.
const getItems = (signal?: AbortSignal) => requestJson<Item[]>("/api/items", { signal });
const createItem = (label: string) =>
  requestJson<Item>("/api/items", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ label }),
  });
```

Include filters and identifiers in query keys. Pass the query signal to fetch.
After mutations, invalidate affected keys. For infinite queries, stop when the API returns
no next cursor and disable load-more while fetching. Clear user-specific caches on sign-out.

## Required field labels

Keep the label text and its required asterisk in one text wrapper, separated by a non-breaking space.
The marker must not be a separate child of a field grid or flex layout. The form example demonstrates
this pattern; HTML inputs also carry `required`, while native inputs name their required state for accessibility.

## Repair catalog

The `/catalog` page uses the API catalog shared with Android. Administrators can add and edit
service and spare-part names/prices and deactivate or reactivate entries; technicians can view active
items. Administrators can enter and correct spare-part stock balances; both administrators and
technicians see recorded stock, while unrecorded legacy stock is identified separately. Services do
not carry stock. Customer accounts do not have permission to browse this internal price catalog.

On `/checks`, administrators manage each completed order's receipt separately in the shared list:
they can adjust its service and spare-part quantities, add one manual service or product line, and
save or revise an unpaid receipt. The server synchronizes those changes with the order, bonus
discount and service-pay calculation. Paid receipts remain read-only. Each saved receipt has its own
print action, which prints that order's receipt rather than the whole list.

The `/login` screen can request a password-reset email. Its one-time link opens `/reset-password`,
where the account owner can set a new password. The API enforces the 8-character minimum and
invalidates active sessions after a successful reset.

Administrators can open the dedicated `/admin/orders` page from the navigation or admin dashboard.
It keeps the full repair-request list together while status, technician, deadline and contact edits
are scoped to each individual order card.

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

## Home pages

The customer home route retains its service-request, home-advertising and priority-news cards.
Administrators and technicians see a staff dashboard with shortcuts to new and archived requests,
live home-placement advertising, service-news previews, and the repair, manual-work and chat areas.
The administrator dashboard also links to order editing, advertising management, support and the
existing administrator panel. The staff navigation is role-specific; administrator-only links are
not shown to technicians. `/account`, `/admin`, `/catalog`, and `/about` retain their existing pages.

`src/examples` contains reusable implementation examples only: dialogs, menus, controlled
Select, Calendar/DatePicker, Motion Reveal, Sonner notifications, validated forms and the compound
Table. It is not mounted as the product home page.

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

On `/crafts`, administrators assign an active technician and set the quoted price before completing
a craft request. Completion creates a service number, a receipt snapshot, and a salary entry at the
technician's saved rate; craft salary is included in the regular salary summaries. Before payment,
the customer may apply available bonuses up to 30% of the receipt. An administrator records the
payment method after receiving payment outside the app, and the customer then receives 5% of the
remaining cash amount as bonus points. This is not an online-payment flow.

The `/login` screen can request a password-reset email. Its one-time link opens `/reset-password`,
where the account owner can set a new password. The API enforces the 8-character minimum and
invalidates active sessions after a successful reset.

Customers can optionally save gender and date of birth in `/account`. The API sends one birthday
push greeting per customer per year, using the Moscow calendar date and only to devices with a
registered, permitted push token. Staff profiles do not expose these fields.

On the customer's birthday, `/news` shows a personalized greeting only to that signed-in customer.
It expires at the next Moscow midnight (a 24-hour Moscow calendar day), matching the birthday push
delivery window. Other users do not receive or see the customer's birthday card.

When `YANDEX_CLIENT_ID` is configured, `/login` also supports Yandex ID. The Yandex OAuth callback
page is `/yandex-token`; add that exact path for both development and production Web origins in the
Yandex OAuth app. If the Yandex email matches an existing account, its current password is required
once before the provider identity is linked.

The Web `/login` page supports password and Yandex ID sign-in. VK ID sign-in is intentionally not
offered in the Web client; the server-side VK endpoint remains available to other clients.

The shared app-install controls offer the Android APK and instructions for adding the website to an
iPhone or iPad Home Screen from Safari as a web app. The iOS control creates a website shortcut; it
is not an App Store installation or an iOS binary.

Administrators can open the dedicated `/admin/orders` page from the navigation or admin dashboard.
It keeps the full repair-request list together while status, technician, deadline and contact edits
are scoped to each individual order card. Until repair work starts, the administrator can also edit
the device type, fault description and customer address; active service-catalog entries can be added
to an open order with a quantity. The card lists existing service and item lines, while the API
checks the active catalog entry, order status and inventory balance before saving changes.

While an administrator is signed in to the Web app, it checks for new repair and craft-product orders
every 30 seconds. New orders appear as in-app alerts with a shortcut to the relevant order list. The
administrator can also enable browser system notifications from the header; these can appear while
the site tab is in the background, as long as the page remains open. Browser notifications are not
delivered after the site is closed.

In `/checks`, only administrators can apply customer loyalty bonuses to an unpaid repair receipt.
The server caps redemption at 30% of service lines only; spare parts and craft-product orders are
not eligible. The receipt identifies the redeemed amount on its own “Оплата бонусами” line, and
customers can view it without being able to initiate redemption.

Customer and administrator order cards show a Code 128 barcode generated from the order's existing
unique service number. The barcode is derived at display time, so it adds no database field and does
not replace the separate pickup QR code.

Administrators can also start a repair order from the fixed “СТАРТ / СТОП — Создать заявку” action.
The form supports an existing client or registering a new client with their email as the login;
the generated temporary password is shown once after account creation, and the client must change
it at first sign-in. If order creation fails after account registration, the client remains in the
customer list and the order can be retried for that account.

Orders are automatically archived after their creation day in the `Europe/Moscow` time zone. The
active/archive tabs on `/orders` and `/admin/orders` load separate role-authorized lists; archiving
preserves the order and its status. The dark interface uses the existing `repair-nebula-bg.png`
background asset.

Order cards expose the intake act, work-order summary, and any issued warranty card. Administrators
and assigned technicians record front/back/left/right condition notes and upload a protected photo
for each side; the service will not mark an order ready for pickup until the act is complete. A
customer can create a short-lived, one-time pickup QR from their own ready order. Staff scan the
customer's code and enter the applicable warranty duration and terms to close the repair and issue
its warranty card. The QR is not a password; only the server-side hashed token is retained.

The `/orders` and `/admin/orders` lists separate new requests, active requests, completed/cancelled
repair history, and the automatically archived requests. The new and archive views can be opened
directly from the staff home dashboard. The Android-aligned order cards expose structured address
and contact details, assigned technician contact, protected request photos, status history, itemized
services/parts/products and totals, repair paperwork, and pickup QR actions. Customers can edit or
cancel their own requests only while they are new, and may leave one review with an optional photo
after completion. Assigned technicians can advance their assigned repair through the allowed status
steps, add catalogue items, update the intake act, upload photos, scan pickup QR codes, and use the
order chat. Administrators can create and edit requests, assign technicians, manage the order
composition and receipts, search by service number, and manage the same paperwork and repair chat.
The API remains authoritative for each role and order lifecycle transition.

Customers can open the chat on their own cards in `/orders`; administrators connect to the same
conversation from the detail page before replying. Assigned technicians can also open and write in
their repair-order chats from `/orders`, and can request administrator participation when needed.
`/support` provides a separate direct support conversation for customers and an administrator inbox;
administrators open an individual customer conversation at `/support/:customerId`. The API restricts
customer support conversations to their owner and administrator access to staff accounts with the
ADMIN role.
The administrator header polls for unread repair chats every 15 seconds, shows the unread-chat count,
and links to the latest conversation. New messages produce an in-app alert or a browser notification
when system notifications are enabled; notification selection opens the corresponding repair card.
The support inbox refreshes every five seconds and alerts administrators to new customer messages,
with notifications opening the matching support conversation.
Administrators can correct request details in any status; customers can edit only their own requests
before technician assignment. Service lines and paid financial documents keep their separate
lifecycle safeguards. The staff section of `/admin` can create technician accounts with one-time
temporary passwords that must be changed on first sign-in; customer self-registration remains on
`/login` and cannot create staff or administrator accounts.

The administrator manages service news at `/news`: create a scheduled or immediate publication,
edit its title and body, change its display schedule, feature it on the home page, and publish or
unpublish it. The `/crafts` page is labeled “Ручная работа” in navigation and on the page; its
existing catalog and order handling remain unchanged. Home-placement banners remain visible on the
staff home page, while administrators can manage them from the home-page advertising shortcut.

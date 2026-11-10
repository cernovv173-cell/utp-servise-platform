# Application

Видео-заставка с приветствием отключена: при открытии сайта сразу показывается выбранная страница, без промежуточного экрана.

На главной странице размещены рекламные места MyTarget (в отдельной AMP-странице) и Mail.ru (`ad-2087473`, асинхронная загрузка). Фактический показ зависит от доступности рекламной сети, её настроек и блокировщиков. Русскоязычная политика конфиденциальности опубликована как статическая страница `/privacy-policy.html` и связана с публичным подвалом, экраном входа и личным кабинетом; она раскрывает категории данных сервиса, внешние сервисы и удаление аккаунта.

На главной приоритетные новости стоят выше рекламных блоков и при наличии нескольких публикаций сменяются раз в 10 секунд; карусель приостанавливается при наведении, фокусе или вручную. Внутренние рекламные баннеры показываются компактной каруселью: активные публикации обновляются с сервера раз в 10 секунд, и текущий слайд меняется каждые 10 секунд. Новости и баннеры поддерживают загруженное фото или видео MP4. Новости и баннеры плавно перемещаются при смене; анимация перехода отключается при системной настройке уменьшения движения. На главной есть кнопка звонка, использующая сохранённый телефон компании. В меню, логотипе и карточках главной используются еноты, которые двигаются только при наведении мышью; анимации отключаются при системной настройке уменьшения движения.

Публичная гостевая главная сокращена до заявки, услуг, трёх шагов ремонта, одного опубликованного отзыва и контактов; телефон компании доступен по кнопке звонка. Стоимость не выдумывается и показывается только при наличии подтверждённых данных. Лента цен на работы собирается из активных услуг действующего прайса через `GET /public/service-prices`: популярные работы идут первыми, отсутствующие в прайсе позиции не подставляются, а при пустом ответе лента скрыта. Лента прокручивается автоматически и останавливается по кнопке, при наведении и при системной настройке уменьшения движения; на уменьшенном движении цены остаются доступны горизонтальной прокруткой. Полный список опубликованных отзывов доступен по `/reviews` и использует публичную выдачу завершённых ремонтов. Карточка факта о технологиях показывается на авторизованной главной и в `/news`; браузер сохраняет ID последнего факта в `sessionStorage` и передаёт его API, чтобы при обновлении страницы получить следующий факт. Дополнительно карточка обновляется раз в два часа по серверному времени и при возврате вкладки в фокус.

Основная навигация короткая и зависит от роли: клиент — главная, ремонты, магазин, бонусы и профиль; мастер — заявки, каталог, зарплата и профиль; закупки — закупки, товары и профиль; администратор — заявки, управление, каталог и профиль. Вспомогательные клиентские и мастерские экраны собраны в быстрых ссылках профиля; администраторские операции сгруппированы в шесть направлений управления. Прямые адреса дополнительных страниц остаются доступны.

В акте ремонта мастер добавляет позицию через единый поиск по работам, запчастям и товарам, с фильтрами, избранным и последними выбранными позициями. Избранное и недавний список сохраняются в браузере для конкретной учётной записи и не синхронизируются с Android. Добавленные строки остаются в черновике: чек и склад меняются только после подтверждения акта администратором.

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

The signed-in home page includes one 300×250 MyTarget ad slot (`2087468`). It is served through a
small standalone AMP document in an iframe, because `<amp-ad>` requires the AMP runtime and should
not be inserted directly into the React document. The fixed iframe space remains reserved if the ad
network has no creative to show. Actual ad delivery depends on MyTarget's inventory and publisher
account configuration.

The `/catalog` page uses the API catalog shared with Android. Administrators can add and edit
service, spare-part and product details and deactivate or reactivate entries; technicians can view active
items. Administrators can enter and correct spare-part stock balances; both administrators and
technicians see recorded stock, while unrecorded legacy stock is identified separately. Each tracked
item has an administrator-configurable minimum balance shown with its stock; the catalog summary
highlights items at or below that threshold, and always highlights zero stock. A threshold of 0
alerts only on zero balance; newly tracked items default to 3. Services do not carry stock. Customer
accounts do not have permission to browse this internal price catalog. Administrators may permanently
delete a service, spare part or product after confirming the action. Inventory items must have a
recorded zero balance; deletion is blocked while the item is in an unfinished repair, pending repair
estimate, or pending/confirmed shop order. Completed and cancelled order history keeps its saved
names and prices after the catalog entry is removed.

The separate `/shop` storefront uses only active product entries, never repair services or spare parts.
Customers can browse the catalog, keep a per-account cart, and submit an order without online payment;
the order stores the item names and prices at submission time. Product entries support an optional
description and up to four protected product photos, managed from the shared catalog in Web or
Android. Administrators review requests in the dedicated confirmation queue at `/admin/shop-orders`;
the page also retains an all-orders view. They confirm availability before tracked stock is deducted,
then can mark a confirmed order as handed over or cancel it. Cancelling a confirmed order restores
its reserved stock. Payment and pickup are arranged outside the app, independently of repair requests.

On `/checks`, administrators manage each completed order's receipt separately in the shared list:
they can adjust its service and spare-part quantities, add one manual service or product line, and
save or revise an unpaid receipt. The server synchronizes those changes with the order, bonus
discount and service-pay calculation. Paid receipts remain read-only. Each saved receipt has its own
print action, which prints that order's receipt rather than the whole list.

On `/crafts`, administrators assign an active technician and set the quoted price before completing
a craft request. Completion creates a service number, a receipt snapshot, and a salary entry at the
technician's saved rate; craft salary is included in the regular salary summaries. Before payment,
bonus points cannot be redeemed against craft orders. An administrator records the
payment method after receiving payment outside the app, and the customer then receives 5% of the
remaining cash amount as bonus points. This is not an online-payment flow.

The `/login` screen can request a password-reset email. Its one-time link opens `/reset-password`,
where the account owner can set a new password. The API enforces the 8-character minimum and
invalidates active sessions after a successful reset.

Customers see the shared default raccoon avatar in `/account` until they upload a profile photo.
They can replace it at any time with a JPEG, PNG or WEBP image up to 5 MB; uploaded photos stay
protected and are visible to the owner, administrators and the technician assigned to that customer's
repair. Existing custom avatars are preserved. The Android account profile uses the same default image
and already supports replacing it.

Customers can optionally save gender and date of birth in `/account`. The API sends one birthday
push greeting per customer per year, using the Moscow calendar date and only to devices with a
registered, permitted push token. In production, the birthday worker also grants 250 loyalty points
once per customer per birthday year; the unique award record prevents duplicate grants. Push permission
is not required for points. Staff profiles do not expose these fields.

On the customer's birthday, `/news` shows a personalized greeting only to that signed-in customer.
It expires at the next Moscow midnight (a 24-hour Moscow calendar day), matching the birthday push
delivery window. Other users do not receive or see the customer's birthday card.

The signed-in home page and `/news` feed show a source-linked computer-technology fact. Web keeps
the last shown fact ID in `sessionStorage` and passes it to the API after a page reload, so the API
returns a different entry from the shared curated list. The feed also refreshes at the returned
`nextUpdateAt` and when the page regains focus.
This is a curated fact collection, not a live external-news feed.

The Web `/login` page offers MAX sign-in and registration for customers. The card asks the API for
the bot configuration, opens the `https://max.ru/<botName>?start=<payload>` chat link, and polls
every two seconds (and on window focus) until the bot confirms the phone number. New accounts are
created automatically in the customer role; the referral code from the login screen is applied at
creation. New customers receive “Спасибо что выбрали нас!” from the bot. Accounts created this way
start without an email. A signed-in customer with a MAX-linked account can add a backup email in
`/account`: the API sends a six-digit verification code, then the customer sets a password. Until the
address is verified it is not attached; after confirmation the customer can continue to use MAX or
sign in with the verified email and password.

The Web `/login` page supports password and MAX sign-in. Yandex ID sign-in was removed; its callback
page and client component no longer exist. VK ID sign-in is intentionally not offered in the Web
client; the server-side VK endpoint remains available to other clients.

The shared app-install controls offer the Android APK and instructions for adding the website to an
iPhone or iPad Home Screen from Safari as a web app. The iOS control creates a website shortcut; it
is not an App Store installation or an iOS binary.

Administrators can open the dedicated `/admin/orders` page from the navigation or admin dashboard.
It keeps the full repair-request list together while status, technician, deadline and contact edits
are scoped to each individual order card. Until repair work starts, the administrator can also edit
the device type, fault description and customer address; active service-catalog entries can be added
to an open order with a quantity. The card lists existing service and item lines, while the API
checks the active catalog entry, order status and inventory balance before saving changes.

Navigation is filtered by account role. On small screens, four frequently used destinations stay
visible, while the remaining permitted pages are grouped under “Разделы”; the desktop sidebar keeps
the same groups in its own scrollable area. Administrator-only pages, including scheduling,
procurement, customer records, repair editing and store-order confirmation, are available directly
from the administrator group.

While an administrator is signed in to the Web app, it checks for new repair and craft-product orders
every 30 seconds. New orders appear as in-app alerts with a shortcut to the relevant order list. The
administrator can also enable browser system notifications from the header; these can appear while
the site tab is in the background, as long as the page remains open. Browser notifications are not
delivered after the site is closed.

In `/checks`, only administrators can apply customer loyalty bonuses to an unpaid repair receipt.
The server caps redemption at 30% of service lines only; spare parts and craft-product orders are
not eligible. The receipt identifies the redeemed amount on its own “Оплата бонусами” line, and
customers can view it without being able to initiate redemption. One point equals one ruble of
discount, but points are not cash and cannot be withdrawn or transferred. Repair receipts earn 10%
of the amount paid in cash, and craft orders earn 5% after payment. Previously credited game points
remain in customer loyalty balances; game rewards are no longer issued. Preventive work qualifies
only when included in a repair order as a service line and uses the same 30% limit.

On `/loyalty`, customers receive three personal, one-use referral codes, each valid for six months
from issue, and can copy an individual registration link for each. A code is attached to a new
customer during registration and cannot be reused or applied to an existing account. After that
customer's first completed repair is confirmed as paid, both people receive 250 bonus points. Signup
alone never issues the reward; points remain non-cash and follow the normal redemption rules.

Customer and administrator order cards show a Code 128 barcode generated from the order's existing
unique service number. The barcode is derived at display time, so it adds no database field and is
not used to confirm payment or release an order.

Administrators can also start a repair order from the fixed “СТАРТ / СТОП — Создать заявку” action.
The form supports an existing client or registering a new client with their email as the login;
the generated temporary password is shown once after account creation, and the client must change
it at first sign-in. If order creation fails after account registration, the client remains in the
customer list and the order can be retried for that account. The administrator also selects whether
the repair will take place at the client's address or at the service center. This choice is saved
separately from the client's contact address and shown in the order details; the company address
continues to be maintained independently in “About the company.”

On `/admin/customers`, administrators can permanently delete a customer after entering the customer's
email in a confirmation dialog. This removes the account and its linked repair/craft orders, receipts,
related payroll entries, devices, chats, reviews, bonus and referral records, offer participation,
and customer photos. The operation cannot be undone; stock balances are not restored.

Customers can start deleting their own account from `/account`; no administrator approval or support
request is required. Before final confirmation, the app explains that linked repair and shop orders
(including unfinished repairs), chats, reviews, photos, and bonuses will be removed.
On success it clears the session and that customer's local shop cart. On error,
the dialog stays open and the customer remains signed in to retry; local data is cleared only after a
successful response.
If a photo cannot be removed from storage, the customer's access is disabled and the administrator can
retry the deletion.

Orders are automatically archived after their creation day in the `Europe/Moscow` time zone. The
active/archive tabs on `/orders` and `/admin/orders` load separate role-authorized lists; archiving
preserves the order and its status. The dark interface uses the existing `repair-nebula-bg.png`
background asset.

Order cards expose the intake act, work-order summary, and any issued warranty card. Administrators
and assigned technicians record one condition summary and attach one protected photo or video, plus
the serial number, included accessories, and notes. Before release, the API requires the saved act and
its single media file. An administrator or assigned technician uses the ordinary “Выдать заказ”
action; it shows the amount due and payment options, checks the confirmed amount again, records the
payment method, closes the order, and issues its warranty card. QR pickup codes and scanning are not
part of the release flow; old act data and attached media remain available for history.

The `/orders` and `/admin/orders` lists separate active requests, completed/cancelled repair history,
and the automatically archived requests. The Android-aligned order cards expose structured address
and contact details, assigned technician contact, protected request photos, status history, itemized
services/parts/products and totals, repair paperwork, and a standard release action with payment
confirmation. All request cards in customer/staff lists and the administrator list start as compact
summaries; opening a card reveals its details and available actions. Direct administrator order-detail
links remain expanded. Each service and spare part is tagged for one or more of PC, laptop, phone, or tablet;
requests and estimates show only matching catalog entries, and a selected saved device supplies its
type automatically. Customers can edit or cancel their own requests only while they are new, and may
leave one review with an optional photo after completion. Assigned technicians can advance their
assigned repair through the allowed status steps, prepare and send a versioned estimate, update the
intake act, upload its single photo or video, release a ready order with the confirmed payment method,
and use the order chat. The estimate is surfaced before the collapsible contact, photo and
history details; paperwork and chat are grouped separately. Administrators can create and edit
requests, assign technicians, prepare estimates from the active catalog, review pending estimates,
manage receipts, search by service number, and manage paperwork and repair chat. Customers can view
the estimate but do not approve or decline it in the application; only an administrator can confirm
or return it for rework. The API snapshots catalog prices, leaves stock untouched until administrator
confirmation, then creates order lines and deducts tracked stock in one transaction. Direct line edits
are locked once estimate history exists, and the server requires administrator confirmation before
work starts. Orders without estimates retain the previous item-entry flow. The API remains
authoritative for each role and order lifecycle transition.

Customer requests may include device brand, model, serial number, one optional initial photo and a
preferred visit time. The time is explicitly a request; it is not confirmed until the service checks
the schedule. Administrators can view a weekly schedule with technician workload, update priority to
urgent, and open a request to assign or change its technician and time. The `/admin/overview` page
shows rolling 30-day counts, overdue work, average completion time, paid receipts and popular
services. `/admin/procurement` recommends bringing tracked spare parts back to their configured
minimum; active approved-estimate parts are shown separately because their stock was already
deducted. Completed-job reviews and electronic repair documents remain available through the existing
order-card workflows. On a customer's completed repair, a raccoon card shows the recorded work
summary and warranty terms and opens the existing one-review flow. It also has a separate “Отправить
чаевые” button; until the business registers and configures YooMoney, it explains that tips are not
available and does not initiate a payment.

Administrators set, move, or clear a repair's planned completion time from the order card and can add
a customer-facing reason. The date change and audit entry are saved together; customers and staff see
the current estimate and recorded change history, while the API triggers a customer push
notification when the date changes. Delivery depends on the customer's registered device token and
notification permission.

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

## Customer repair guides

The public home page and signed-in customer navigation link to `/guides`, with separate public
articles at `/guides/prepare-laptop`, `/guides/thermal-paste`, and `/guides/what-to-bring`. The
two checklists can be marked on the page and reset; their state is temporary and is not saved to an
account. Each article includes a browser print action, a short service note, and an application
link to create a repair request. The cooling guide describes five reasons to have the cooling system
checked and does not diagnose thermal paste from symptoms alone.

The game feature, screens, API endpoints, and active game models have been removed from the Web and
Android applications. Old game endpoints are no longer supported. The first visit clears obsolete
browser caches and local game preferences while retaining customer logins, shopping carts, and other
site data. The retirement migration removes the ten game-progress tables and saved game cosmetics.
Previously credited `GAME_REWARD` bonus ledger entries remain unchanged; historical game progress is
deleted.

## Seasonal themes

The root layout reads the public `GET /seasonal-theme` state and applies the active palette across
Web pages; it refreshes the server state once per minute. When a theme is active, its computer-repair
illustration fills a shared, fixed background behind every route, including sign-in, while seasonal
particles move across the viewport: spring petals, summer light glints, autumn leaves, or winter
snow. During the autumn theme, a 30-minute rain effect runs once per hour alongside the leaves.
The illustrations feature laptops, computer parts, and repair tools, not household appliances.
Motion is disabled when the visitor requests reduced motion.
Administrators manage seasonal appearance from the separate “Оформление” tab in the role navigation.
Four switches enable spring, summer, autumn, or winter at any time; enabling one replaces the previous
choice, and switching it off disables the seasonal theme. The selection is saved on the server and
applies across Web and Android until the administrator changes it. No calendar season is calculated,
displayed, or used to determine the active theme.

Signed-in customers receive in-app alerts for newly published news and promotions/giveaways, plus
their repair reaching `READY_FOR_PICKUP` or `COMPLETED`. The customer header
polls these records every 30 seconds, stores a per-account seen snapshot, and links each alert to its
news, offers, or orders page. If the customer grants browser notification permission, an alert is
shown as a system notification while the site tab is open in the background; when the site is visible
or system notifications are unavailable, it appears inside the site. Closed-browser push is not
configured for Web.

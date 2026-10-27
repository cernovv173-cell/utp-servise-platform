# Application

Install dependencies and start the development server:

```bash
pnpm install
pnpm run dev
```

Optional environment settings use `optionalEnvironmentValue` so missing, empty, and whitespace-only
values mean unconfigured. Nonempty values still pass their normal validation. Use this helper for
optional provider credentials; validate required delivery settings when the corresponding operation
runs. Required database migration commands still reject an absent database URL.

Any authenticated customer, technician, or administrator can change their own password through
`POST /auth/change-password` by supplying the current password and a new password of at least 8
characters. Passwords are stored as scrypt hashes. A successful change revokes that user's active
sessions and returns a fresh session to the current client; client forms ask the user to confirm the
new password before submitting.

Password recovery is available through `POST /auth/password-reset/request` and
`POST /auth/password-reset/confirm`. Requests always return the same response to avoid revealing
whether an address is registered. The API stores only a hash of the random reset token; email links
expire after 30 minutes and are single-use. Completing a reset sets an 8-character-minimum password,
clears the temporary-password flag, and revokes every active session. Email delivery uses the
server-bound Mail.ru application credentials (`MAIL_RU_EMAIL` and `MAIL_RU_APP_PASSWORD`) over
implicit TLS on SMTP port 465. These credentials are assigned only to the API. Reset links are
restricted to origins in `WEB_APP_ORIGIN` and lead to the web `/reset-password` screen.

The public landing pages on Web and Android load only the curated technology fact from
`GET /public/technology-fact`; it includes a source link and the next UTC update time. The
endpoint does not expose news articles, reviews, or user data. The authenticated `GET /news`
response also contains the same fact for signed-in home screens. The shared fact rotates every
two hours without a background job or database writes.

Customer registration accepts an optional referral code from Web, Android, or Yandex/VK signup.
After the invited customer's first repair is completed and an administrator confirms its receipt as
paid, the same transaction records 100 personal bonus points for both customers and marks the
referral rewarded. A conditional status claim and unique referral/customer ledger key prevent repeat
rewards; registration alone never awards points.

Startup diagnostics identify invalid configuration fields and sanitize other error messages without
printing configuration values. Run `pnpm test` for configuration and diagnostic regressions.

## Repair catalog stock

Repair spare parts and products have an optional `stockQuantity`. Existing catalog rows remain untracked
(`null`) until an administrator records a factual starting balance; services do not use stock.
Each stock-tracked item can have its own `minimumStockQuantity`; new items default to 3 units, and
older tracked rows keep that threshold until an administrator changes it. A threshold of 0 alerts only
when the balance reaches zero; zero-stock items are always highlighted. The additive migration leaves
untracked legacy balances and service rows untracked.

## Product shop

The standalone shop sells only active `PRODUCT` catalog entries; repair services and spare parts stay
in the repair workflow. Customers submit a separate cart order with server-calculated price snapshots,
and can review its status in their account. A new shop order starts as `PENDING` and does not reserve
stock. An administrator checks availability and confirms it; tracked stock is then deducted atomically
with the status change, while an untracked (`null`) balance still requires the administrator's manual
availability check. If tracked stock is insufficient, confirmation fails without changing the order
or partially deducting its lines. Cancelling a confirmed order restores its tracked stock; completing
it records the handoff after payment and receiving have been arranged outside the app. There is no
online payment integration. Permanently deleting a customer releases any still-confirmed shop-order
stock before removing that customer's shop order history.

The shop's optional courier pilot covers Moscow and the Moscow Region. Existing orders and new orders
without a delivery choice use pickup. Customers requesting a courier select the region and enter a
locality and address; the administrator checks the exact address and manually offers a delivery fee
and time window. The customer must accept the current offer before an administrator can confirm the
order and reserve stock. Revising an offer clears the prior acceptance; declining cancels the
still-unconfirmed order without reserving stock. The delivery fee is stored separately from the goods
subtotal, and no courier API or online payment provider is connected for this pilot.

Adding a tracked spare part or product to an open order decrements inventory atomically with the new
order line. Removing that line returns its quantity. In an unpaid completed-order receipt, an
administrator can set an existing line quantity to zero to remove it; linked stock is restored in the
same transaction. Completed orders can only be changed through their unpaid receipt, and a paid
receipt cannot be changed. Administrators can add a manual sale line to an unpaid receipt; free-form
lines are not linked to catalog stock. Saving the receipt updates its item snapshot, bonus discount,
and technician service calculation in the same database transaction. Only administrators can set
catalog balances; technicians can read active item balances. A tracked zero balance blocks use of that
spare part or product. Administrators can create a repair order for an
active customer through `POST /admin/orders`; its creation is recorded in order history. The
administrator can create a customer record through `POST /admin/customers`; the one-time temporary
password is returned only with that creation response and must be changed on first sign-in.
Customers can permanently delete their own account from the signed-in app through
`DELETE /customer/account`; the endpoint uses the authenticated customer's ID and accepts no target
account ID. Only administrators can delete another customer through
`DELETE /admin/customers/:customerId`. Both paths remove the customer's repair and craft orders,
receipts, related payroll entries, device records, chats, reviews, bonuses, referral links, and
offer participation in a database transaction. Customer-specific photos are removed
from project storage first; objects still referenced by another account or shared content are
preserved. The administrator path disables the account and revokes its sessions before cleanup. The
self-service path keeps the current session available until cleanup succeeds, so the customer can
retry if photo storage is temporarily unavailable; successful user deletion also removes all
sessions. Deleting a referral also detaches, but does not delete, another customer's referral bonus
ledger entry. Confirmed shop orders restore their tracked stock before their history is removed.
Removing repair history does not restore spare-part stock quantities.

Repair orders are archived automatically after the Moscow calendar day in which they were created.
The worker checks once per minute and marks older orders with `archived_at`; it never deletes the
order or changes its status. `GET /orders?archive=active` and `GET /orders?archive=archived`
return the corresponding role-scoped list. Omitting `archive` retains the unfiltered legacy response.

Administrators can load an individual repair record through `GET /admin/orders/:orderId`; this
endpoint is restricted to the administrator role. `POST /staff` also requires an administrator and
creates a staff login with a generated temporary password and mandatory password change on first
sign-in. Supported staff roles are `TECHNICIAN`, `ADMIN`, and `PROCUREMENT`; customer self-registration
remains separate at `POST /auth/register` and always creates a customer account. Public registration
cannot assign staff roles.

The procurement role is managed by an administrator and signs in through the `PROCUREMENT` portal.
It can view the purchase-replenishment summary and active products and spare parts, then update only
their stock and minimum-stock quantities through `PATCH /catalog/:catalogItemId/inventory`. It cannot
create catalog entries or change names, prices, item types, or activation state. The role does not
receive administrator staff-management, customer-management, or repair-workspace navigation in Web
or Android; authorization is enforced by the API, not only by those interfaces.
Administrators can correct request details through `PATCH /orders/:orderId` in any order status;
customers can edit only their own not-yet-assigned orders. Status transitions, service lines, stock,
and paid receipts keep their independent authorization and lifecycle checks.

Assigned repair orders can use immutable, versioned estimates. An administrator or assigned
technician selects active catalog items and quantities; the API snapshots the current catalog names
and prices rather than accepting prices from the client. `POST /orders/:orderId/estimates` submits a
version for customer approval. Until approval, no order lines are created and tracked inventory is
not deducted. The customer responds with `PATCH /orders/:orderId/estimates/:estimateId/response`;
approval rechecks tracked stock and atomically creates the actual order lines at the snapshotted
prices, while a decline records the response without changing the order composition. A changed
offer creates a new version and preserves prior versions. Once estimates exist, direct order-line
add/edit/delete endpoints are locked; an initial estimate must be approved before a technician starts
the repair, and pending additional work must receive a response before the repair can be marked ready.
No repair may transition to `IN_PROGRESS` without a customer-approved estimate, including orders
that predate estimates. Customers can read only active service names and exact unit prices through
`GET /customer/service-prices`; this response excludes parts, stock levels, inactive rows, and admin
data. Web and Android show these as pre-visit catalog references, not a diagnosis or guaranteed
repair total. Each quoted work item and any parts must be included in the technician's exact estimate,
which the customer must approve before work begins. The new
`20261011190000_repair_estimate_approval` migration is additive and does not rewrite existing orders.

Administrators set or revise the planned completion date through
`PATCH /orders/:orderId/expected-completion`; an optional customer-facing `note` explains a delay.
Each actual change records the previous and new dates, actor, timestamp, and note in
`repair_order_deadline_changes` within the same transaction as the order update. Repeating the
current date creates no duplicate history row or notification. The API triggers a push notification
to the customer when the date changes or is cleared; delivery depends on a registered device token
and notification permission. Existing dates are preserved and are not presented as historical
changes because their earlier values were not recorded. The `20261011195000_repair_deadline_history`
migration adds the history table without rewriting existing orders.

Customers may save an optional gender and birth date with `PATCH /auth/profile`. On the customer's
Moscow-calendar birthday, the production worker records one 250-point `EARN` entry in the normal
loyalty balance and transaction history, even if the customer has no push token. A unique
`(user_id, birthday_year)` award record prevents duplicate points across API instances. The same
worker sends the birthday greeting once per year to active customers with a registered push-device
token; a separate unique delivery record prevents duplicate notifications, and failed delivery is
retried during that birthday only. Clearing the date stops future awards and greetings. The additive
`20261019230000_birthday_bonus_points` migration preserves existing loyalty transactions.

## Craft-order chat

Each craft-product request has its own customer-and-administrator chat. The customer can send text
and protected JPEG, PNG, or WebP photos (up to 5 MB) from the request; administrators can read and
reply in that same thread. The chat is embedded in each request card and opens automatically when
an administrator moves the request to `IN_PROGRESS`. Message and image endpoints verify the signed-in
user is either an administrator or the owner of that request, and protected image reads repeat this
ownership check. A message push is sent to the other side when a registered device is available.

Repair-order conversations are available to the order's customer, assigned technician, and
administrators. An administrator can explicitly join the conversation from the repair-order detail
page and reply even when no technician escalation was requested; only an authenticated administrator
can perform the join action. Message access remains scoped to the repair order.

Each administrator has an independent read receipt in `order_chat_admin_reads`. The administrator-only
`GET /admin/chat-notifications` endpoint returns chats whose latest message is newer than that
administrator's read cursor, and `POST /orders/:orderId/chat/read` advances the cursor only through
a message belonging to that chat. New messages from a customer or assigned technician also send a
push notification to active administrators with registered devices. The additive migration preserves
existing conversations and makes unread state consistent across the administrator's sessions.

## Craft-order receipts and technician pay

Before completing a craft order, an administrator must assign an active technician and set its
price. Completion creates a unique `SRV-…` service number, a `DOC-…` receipt with a snapshot of the
ordered item and price, and a salary entry using the technician's current individual rate. Craft
salary entries are included in the same day, week, and month totals as repair salary entries.
Craft-product orders do not allow bonus redemption. An administrator records their payment method
after receiving payment outside the app; there is no online payment integration. The server awards
5% of the paid craft-order amount as loyalty points, and repeated confirmations do not duplicate the
bonus transaction. For repair receipts, only an administrator can apply bonuses, capped at 30% of
`SERVICE` line totals; spare parts and products are excluded. The server deducts the redeemed amount
when the administrator confirms the repair payment and awards 10% of the remaining cash amount.

## Customer referrals

Each customer receives a unique referral code. `GET /referrals/me` returns the code, totals, and up to
50 recent invitations; legacy accounts receive a code on first access. Public registration may
include `referralCode`, which links the new customer to one active customer inviter. When an
administrator confirms payment for the referred customer's first completed repair, the same database
transaction marks the referral rewarded and records two 100-point `REFERRAL_REWARD` ledger entries with a
referral-specific reason.
Registration, craft orders, repeated payment confirmation, and later repairs do not issue another
referral reward. Points remain non-cash loyalty points and follow the existing repair-redemption cap.

## Intake, work orders, and customer pickup

Administrators and the assigned technician maintain one intake act per repair order. It records the visible condition and a protected photo for the front, back, left, and right sides, plus the serial number, included accessories, and notes. The order cannot be marked ready for pickup until all four condition notes and photos are saved; the act becomes read-only once the order is ready, completed, or cancelled.

The service moves a repair from `IN_PROGRESS` to `READY_FOR_PICKUP`; staff cannot directly set `COMPLETED`. The customer requests a pickup QR code from their own ready order. The server stores only its SHA-256 token hash; the raw payload expires after two hours, and requesting a replacement invalidates the previous code. An administrator or assigned technician scans or enters the code and supplies the warranty duration and terms. One transaction consumes the code, closes the order, records the status event, issues the warranty card, and calculates technician salary. Expired or replayed codes do not close an order.

## Repair notifications in Telegram and MAX

Customers can independently opt in to Telegram and MAX from the Web or Android profile. Each
channel uses its own short-lived, one-time deep link and unique customer identifier; identifiers
remain server-side and either channel can be disconnected without affecting the other. The API never
exposes either bot token or messenger identifier to client applications.

Each configured channel queues three separately deduplicated repair messages: “Устройство принято”
when a technician is first assigned, “Диагностика завершена” when a technician or administrator
records that milestone, and “Готово к выдаче” when the order enters `READY_FOR_PICKUP`. Completion of
diagnosis is an explicit staff action and does not by itself change the repair status. Production
retries transient delivery failures and skips customers who have not linked that channel.

Production startup checks `getWebhookInfo` before registering the configured `TELEGRAM_WEBHOOK_URL`.
It registers only when Telegram has no webhook, leaves an existing different webhook untouched, and
never switches the bot to `getUpdates` polling. The Telegram token is bound only to the API.

MAX links use the bot's username from `GET /me` and the official `https://max.ru/<botName>?start=<payload>`
deep-link format. The MAX webhook handles `bot_started` link confirmations and `bot_stopped` disconnects;
it validates the configured webhook secret using a constant-time comparison. Production startup registers
the webhook at `MAX_WEBHOOK_URL` only when no different subscription exists. MAX API requests use the
official `platform-api2.max.ru` host and a dedicated HTTPS agent that trusts the Russian Trusted Root CA
only for MAX API calls; TLS verification remains enabled. The certificate is stored in
`certificates/russian-trusted-root-ca.pem`, downloaded from
`https://gu-st.ru/content/lending/russian_trusted_root_ca_pem.crt`, and checked against the MAX
intermediate certificate chain. Requests send the token only in the `Authorization` header and are paced
to stay within the per-dialog message limit. `MAX_WEBHOOK_SIGNING_SECRET` is the API-owned webhook secret
and takes precedence over the optional integration-provided `MAX_WEBHOOK_SECRET`; both, along with
`MAX_BOT_TOKEN` and `MAX_WEBHOOK_URL`, must be bound only to the API. Until a production release has
registered the webhook and each customer links MAX in their profile, MAX notifications are not delivered;
Telegram remains operational independently.

Yandex ID login accepts an OAuth access token at `POST /auth/yandex`; the server verifies it with
Yandex ID and checks the returned OAuth client ID against `YANDEX_CLIENT_ID`. The OAuth app needs
`login:info` and `login:email` permissions. New provider accounts are created as customers only.
An existing account is linked only after the user confirms its current password; the provider token
is never stored. Use the same public Yandex OAuth Client ID in the API, Web, and Android apps.

VK ID login accepts a VK ID access token at `POST /auth/vk` and verifies the profile server-side
using the public `VK_ID_APP_ID`. The Web widget uses `VITE_VK_ID_APP_ID`, asks for email access, and
exchanges the authorization code through the VK ID SDK; provider tokens are never stored. New VK
accounts are customers only. An existing account with the same email is linked only after its current
password is confirmed. The VK ID app must allow `https://task.app.amazi.pro/` as its redirect URL and
grant email access.

# Birthday greetings

Customer gender and birth date are optional profile fields. The birthday push
worker runs only in production, because development and production share the
managed database and push credentials. It sends the configured greeting to
customers with a registered push device token on their birthday in Moscow time,
at most once per customer per calendar year. The same production worker gives every
active customer with a saved birth date **250 bonus points** on that Moscow birthday,
whether or not push notifications are enabled. It writes a "Подарок ко дню рождения"
entry to the loyalty ledger and uses a unique customer/year award record so repeated
worker runs or multiple API instances cannot award the same birthday twice. The award
and ledger entry are committed together; removing a customer also removes the private
award marker.

On the same Moscow calendar day, `GET /news` also returns a personal birthday
greeting only for the signed-in customer whose saved birth date matches that
day. The Web and Android news feeds display it until the next Moscow midnight
and hide it at expiry. Birthday push messages use the remaining time in that day as their
Android delivery TTL; the existing worker retries only while the birthday is
still the current Moscow date. Neither the card nor the date is exposed to
other users.

Every authenticated `GET /news` response also includes a source-linked
`technologyFact`. The API selects from a curated fact list in a shared UTC
two-hour interval and returns `updatedAt` and `nextUpdateAt`, so Web and Android
show the same fact and can refresh at its next boundary. This rotation is
derived from the current time; it does not create database records, run a
background job, send push notifications, or fetch live technology news.

# Customer visit requests and service operations

Customer repair requests can include optional device brand, model, serial number, one initial
photo, and a preferred visit time. The preferred time is a request, not a confirmed booking: the
service checks its weekly calendar and confirms or changes the time with the customer. The Web and
Android forms label this distinction; administrators can edit the preferred time from the order and
assign a technician through the existing order workflow. Request photos use the existing protected
order-photo storage and access rules. Intake paperwork, four-sided condition photos, customer reviews,
receipts, work orders, and warranties were already supported and remain on their existing workflows.

Customers can keep a private equipment list through `/customer/devices`. Each saved device belongs
to its customer and can be linked to a repair request; the request stores a snapshot of the device
details so later edits or removal do not rewrite repair records. Customers can set one next-service
date and note per device. Production queues a deduplicated push reminder for the due date and retries
temporary delivery failures; without an active registered push device, the due reminder remains
visible in the equipment list. Removing a device clears only the equipment link and its reminders;
repair requests, receipts, and warranties are retained. The self-help symptom selector only helps
describe a fault and does not advise opening equipment or testing live electrical components.

Each repair order has an administrator-controlled `NORMAL` or `URGENT` priority. The API defaults
existing and new records to `NORMAL`; only administrators can change it. This marks work for sorting
and attention but does not define a new service-level deadline.

Administrator operations endpoints provide a date-bounded weekly schedule, a spare-parts purchasing
recommendation, and a rolling 30-day dashboard. The suggested purchase quantity is the amount needed
to restore an item's current stock to its configured minimum. Parts from approved estimates are
already deducted from stock at approval, so active approved-estimate quantities are shown separately
and are never added again to the suggested purchase. Dashboard averages use the interval from request
creation to its `COMPLETED` status event; collected revenue uses paid receipts after bonus discounts.
The Web admin navigation and Android **Управление** area expose all three views.

# Retired game feature

The game endpoints and active game models have been removed. The retirement migration drops the ten
progress tables and the user's saved game cosmetic preference. Existing `GAME_REWARD` entries in
`loyalty_transactions` remain part of customer bonus balances and history; this cleanup does not
change earned points. Earlier game migrations remain in the repository so existing database migration
history stays intact.

## Seasonal themes

`GET /seasonal-theme` exposes the active theme and the Moscow calendar season to Web and Android.
The calendar uses meteorological season starts: spring on March 1, summer on June 1, autumn on
September 1, and winter on December 1. `PUT /seasonal-theme` is restricted to administrators and
accepts only the current season or `NONE`; the server rejects early activation even if a client
submits a direct request. The theme is never enabled automatically: an administrator must use the
control on the Web home page or Android administrator's order screen on or after the season start.
The setting is stored in the existing `app_settings` row `seasonal_theme`, with no schema migration.
When the calendar moves to another season, the prior theme stops applying; an administrator must
enable the new season. Both clients refresh the public state periodically and do not decide whether
a season is available locally.

## Customer promotions and giveaways

Administrators create scheduled `PROMOTION` and `GIVEAWAY` offers through the authenticated admin
endpoints and publish them for customers. A signed-in customer may join each published offer once while
it is open. Promotions are participation campaigns only; they do not change repair-order prices.
Giveaways require a prize or bonus-point amount for each of the three places. After an offer closes,
an administrator can draw three distinct participants; the selected names remain private until the
administrator publishes the results. Publishing reveals the three-place podium and credits each
winner's configured bonus points to the loyalty ledger in the same transaction. A unique ledger key
prevents duplicate awards if results are published again. The additive
`20261018200000_customer_offers` migration creates the offer and participation records and links
award transactions without rewriting existing customer data.

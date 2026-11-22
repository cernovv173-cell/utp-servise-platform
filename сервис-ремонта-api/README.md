# Application

## Technician profiles

Signed-in users can open a technician card from a repair order. Technicians can edit their own name,
phone, home address, profile photo, and years of experience; administrators can view the card and
home address. Other signed-in users receive the public card fields, but the API omits `homeAddress`
from their response entirely. A missing profile is initialized when its owner opens the card. The
additive `20261031120000_technician_home_address` migration stores the private address.

## Customer business profiles

Authenticated customers can create or rename one company profile through `GET` and `PUT /api/customer/business-profile`. The owner is always taken from the signed-in session. Device and repair
order lists support personal and business scopes; personal is the default, and a business request can
only use a device owned by the same customer and linked to that customer's profile. Warranty claims
retain the source order's business association. Existing devices and orders stay personal; the additive
`20261122090000_customer_business_accounts` migration does not reclassify historical records. The
profile is an organizational label, not legal-entity verification. It does not support employee
accounts or accounting documents; repair paperwork continues to come from the existing order records.

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

Password login uses the same progressive delay for every portal (customer, technician, administrator,
and procurement): after four consecutive failures for a normalized identifier, later attempts wait
250 ms, then double up to 5 seconds. There is no hard account lockout. The bounded, in-memory tracker
stores only a hash of the identifier, resets after 15 minutes without a failure, and is local to one
API process; it resets on restart and does not replace a shared gateway limit or MFA.

Password recovery is available through `POST /auth/password-reset/request` and
`POST /auth/password-reset/confirm`. Requests always return the same response to avoid revealing
whether an account exists. The account identifier can be an email address or generated login; the
legacy `email` request field remains accepted for existing clients. For active accounts the API sends a six-digit, single-use code and
a link to the web `/reset-password` screen by email, and also through MAX when the customer has
explicitly linked a MAX account. Accounts without email can recover through a linked MAX account.
The same email or login is used when confirming the code. The code expires after 30 minutes; the API stores only its
HMAC-SHA-256 digest, keyed by the server-only `PASSWORD_RESET_CODE_SECRET`, and accepts at most five
incorrect code attempts. Password-reset requests are limited to five per normalized identifier
per 15 minutes, not per proxy IP, so customers sharing an ingress do not block one another. The
confirm endpoint continues to accept unexpired legacy link tokens already sent before code recovery
was introduced. Completing a reset sets an 8-character-minimum password, clears the
temporary-password flag, and revokes every active session. Email delivery uses the server-bound
Mail.ru application credentials (`MAIL_RU_EMAIL` and `MAIL_RU_APP_PASSWORD`) over implicit TLS on
SMTP port 465. These credentials are assigned only to the API. Reset links are restricted to origins
in `WEB_APP_ORIGIN`.

Customers with a linked MAX account can add a backup email from their signed-in profile with
`POST /auth/profile/email-login/request` and `POST /auth/profile/email-login/confirm`. The API emails a
six-digit code, stores only its HMAC-SHA-256 digest using `PASSWORD_RESET_CODE_SECRET`, limits codes to
five attempts, applies a 60-second resend delay and five requests per 15 minutes, and expires each code
after 10 minutes. Only a successfully verified, currently unused email is attached; confirmation also
sets the customer's email-login password. Existing MAX sign-in remains available. A customer may
also create an account through the self-service MAX sign-in flow; an account provisioned by an
administrator can connect MAX later from the signed-in profile.

## Product analytics

Administrators can request `GET /admin/analytics?days=30` for a daily summary of successful logins,
customer registrations, and Android APK download-link redirects. The requested period is limited to
7–90 days. Data is grouped by Moscow calendar day and source (`WEB`, `ANDROID`, `MAX`, or `OTHER`)
and stored only as aggregate counts; no customer identifiers, credentials, or request contents are
recorded. A download is counted when the API resolves and issues an APK redirect, not when the file
finishes downloading or is installed. Collection starts after the analytics database migration and
API version are active; earlier events cannot be reconstructed.

`GET /public/technology-fact` exposes only a curated technology fact and its source; it does not
expose news articles, reviews, or user data. Authenticated `GET /news` also returns a fact for the
signed-in home screen. Clients pass the previously shown `previousFactId` to receive the next fact
on a page/app refresh. Both routes share the same curated list; selection is stateless and creates
no database records.

Customer registration accepts an optional one-use referral code from Web, Android, MAX, or VK
signup. Each active customer can issue three codes, valid for six calendar months. After the invited
customer's first repair is completed and an administrator confirms its receipt as paid, the same
transaction records 250 personal bonus points for both customers and marks the referral rewarded. A
conditional status claim and unique referral/customer ledger key prevent repeat rewards; registration
alone never awards points.

Startup diagnostics identify invalid configuration fields and sanitize other error messages without
printing configuration values. Run `pnpm test` for configuration and diagnostic regressions.

## Repair catalog stock

Repair spare parts and products have an optional `stockQuantity`. Existing catalog rows remain untracked
(`null`) until an administrator records a factual starting balance; services do not use stock.
Each stock-tracked item can have its own `minimumStockQuantity`; new items default to 3 units, and
older tracked rows keep that threshold until an administrator changes it. A threshold of 0 alerts only
when the balance reaches zero; zero-stock items are always highlighted. The additive migration leaves
untracked legacy balances and service rows untracked.

Only administrators can permanently delete a catalog entry through `DELETE /catalog/:catalogItemId`.
Services can be deleted without a stock balance; a spare part or product must have a recorded balance
of 0 first. Deletion is blocked while the item is used by an unfinished repair, a pending customer
estimate, or a pending/confirmed shop order. Completed and cancelled order lines remain in history
with their saved names and prices; their catalog foreign key is cleared. Product photos are removed
from project storage on a best-effort basis after the database transaction succeeds; a temporary
storage failure does not undo the catalog deletion.

## Repair order intake

The public `GET /company/order-intake` endpoint returns whether customers can submit new repair
requests. Administrators change that setting with `PUT /admin/company/order-intake` and
`{ "acceptingNewOrders": boolean }`. If no setting has been saved yet, intake remains enabled.
When paused, the API rejects only customer `POST /orders` requests; existing orders and
administrator-created orders remain available. Web and Android show the paused state to customers.

## Repair visit pickup

For an assigned technician, an active home-visit order can be transferred to the service center
after the technician confirms the customer's consent. The pickup endpoint verifies the assigned
technician, visit scenario, location, status, and that consent has not already been recorded; it
updates the order location so the service-center process becomes available. The technician closes a
repair completed at the customer's address through the onsite-completion flow instead of moving it
to `READY_FOR_PICKUP`. When a device is transferred, the service center fills its intake act after
the device arrives, then continues through the normal estimate, repair, readiness, payment, and
release steps. The intake act requires a condition summary, not an attachment.

## Closure announcement

The public `GET /company/closure-announcement` endpoint returns the administrator-managed notice
configuration. Administrators can update it with `PUT /admin/company/closure-announcement`.
The setting controls only the notice shown on web and Android; it does not pause customer requests.
When no value has been saved, the existing holiday notice remains enabled for December 31, 2026
through January 10, 2027, with reopening at 08:30 Moscow time on January 11. The last closed day
is inclusive, the countdown uses `Europe/Moscow`, and a blank emergency phone falls back to the
company phone. Configuration is stored in the existing `AppSetting` table, so no database
migration is needed.

## Customer catalog visibility

Administrators can read `GET /company/catalog-visibility` and update the settings with
`PUT /admin/company/catalog-visibility`, using `{ "servicesVisible": boolean, "productsVisible": boolean }`.
Both categories are visible until an administrator changes the settings. Disabling services removes
their prices from the public and signed-in customer price-list endpoints; disabling ordinary products
removes them from the web and Android shop and prevents customers from placing new orders for those
products. Handmade craft items remain available. Catalog records, stock, existing shop orders, repair
estimates, and work acts are not changed. Spare-part visibility is not controlled by this setting;
parts remain listed in repair estimates and acts for customer transparency. Settings use the existing
`AppSetting` table and do not require a database migration.

## Public service prices

The guest web landing page reads the active service price list from
`GET /public/service-prices`. The public response contains only `id`, `name`, and
`unitPriceRub` for active `SERVICE` catalog entries (up to 100) and never exposes stock,
spare parts, products, or user data. The site shows these catalog prices as a price guide and
keeps the final-estimate wording; it does not substitute invented or approximate amounts when
the list is empty.

## Product shop

The standalone shop sells only active `PRODUCT` catalog entries; repair services and spare parts stay
in the repair workflow. Customers submit a separate cart order with server-calculated price snapshots,
and can review its status in their account. A new shop order starts as `PENDING` and does not reserve
stock. At checkout, the API rejects a requested quantity above the current tracked balance and creates
no order; the customer can reduce the quantity and retry. An untracked (`null`) balance still requires
the administrator's manual availability check. The administrator checks availability and confirms a
valid request; tracked stock is then deducted atomically with the status change, with a second stock
check to handle changes since checkout. Cancelling a confirmed order restores its tracked stock;
customers may cancel their own pending pickup orders before confirmation. Completing an order records
the handoff after payment and receiving have been arranged outside the app. There is no online payment
integration. Permanently deleting a customer releases any still-confirmed shop-order stock before
removing that customer's shop order history.

Published ready-to-sell handmade goods are listed by `GET /shop/craft-items` and can be ordered in the
same cart as active catalog products. The public listing contains only published craft records; its
image endpoint serves only images attached to published records. Order lines retain a craft-item link
and the server snapshots the current title and price, checks stock, and reserves/restores inventory
with the same transactional rules as ordinary products. Made-to-order requests remain a separate
`/craft-orders` workflow; shipping for such work is discussed after the item is made.

Administrators can edit craft-item fields through `PATCH /craft-items/:itemId` after publication and
manage up to three attached images through `POST` and `DELETE /craft-items/:itemId/images`. The
legacy single-image endpoint replaces the gallery with one image for older clients. Permanent
deletion through `DELETE /craft-items/:itemId` removes the listing and its photos, but is blocked
while a craft request is open or a shop order is pending or confirmed. Completed and cancelled order
snapshots remain available after deletion. Ordinary catalog-product galleries are also limited to
three images by the API.

Active administrator assistants receive push notifications only for new and changed shop orders,
including customer responses to courier offers and cancellations of pending pickup orders. Ready handmade goods use the same shop-order
notifications because they share the store cart; made-to-order craft requests, repair work, support
chats, and other non-shop events do not notify assistants. Full administrators keep the existing
notification behavior.

The first courier pilot is presented in the Android and Web storefronts as pickup from Pushkino or
manual courier delivery in Pushkino and nearby Moscow Region localities. Pickup is the default;
courier orders start with the locality set to Pushkino and `MOSCOW_REGION`. The administrator manually
checks each address, may decline an out-of-zone request, and offers a separate fee and time window.
The customer must accept the current offer before an administrator can confirm the order and reserve
stock. Revising an offer clears the prior acceptance; declining cancels the still-unconfirmed order
without reserving stock. The pickup-cancellation endpoint is limited to the owning customer and a
`PENDING` `PICKUP` order; courier orders continue to use the offer-response flow. The delivery fee is
stored separately from the goods subtotal, and no courier
API or online payment provider is connected. The API continues to accept the older `MOSCOW` area code
for compatibility with existing clients; the displayed pilot zone is a manual check, not automatic
geocoding.

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
administrator creates a customer through `POST /admin/customers`, including while starting a first
repair order. The API generates a unique 8-character login and temporary password, returning the
password once in the administrator-only response for secure handoff. The password is hashed for
storage and is never queued or sent through MAX. The first password login requires the customer to
choose a new password. `/auth/login` accepts either email or the generated login in its existing
`email` request field. After signing in, the customer can connect MAX themselves from their profile;
the API validates MAX's signed contact payload and confirms the phone matches the account. The
onboarding flow does not create an administrator MAX activation link.

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

Open repair orders—including jobs with a rescheduled expected date—remain active until the repair is
fully completed or cancelled; their creation date does not send them to the archive. After a
completed or cancelled order's last update falls before the current Moscow calendar day, the worker
archives it on its next minute check by setting `archived_at`; it never deletes the order or changes
its status. `GET /orders?archive=active` and `GET /orders?archive=archived` return the corresponding
role-scoped list. Omitting `archive` retains the unfiltered legacy response.

Administrators can load an individual repair record through `GET /admin/orders/:orderId`. `POST /staff`
creates staff accounts with a unique 8-character login, a generated temporary password, and mandatory
password change on first sign-in. A full administrator can create another `ADMIN`; an `ADMIN_ASSISTANT` is stored with the
same operational administrator permissions but cannot create an `ADMIN`. Administrators and assistants
can create assistants. Staff-list responses omit permanently terminated accounts, while the user
record and order history remain stored. Customer self-registration remains separate at
`POST /auth/register` and always creates a customer account; public registration cannot assign staff roles.

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
version for administrator review. Until an administrator approves it, no order lines are created and
tracked inventory is not deducted. Customers can inspect the estimate but cannot approve or decline
it in the application. An administrator reviews it with
`PATCH /orders/:orderId/estimates/:estimateId/review`; approval rechecks tracked stock and atomically
creates the actual order lines at the snapshotted prices, while a decline records the decision
without changing the order composition. The former `/response` path remains as an admin-only
compatibility alias; customer requests to either path are forbidden. A changed offer creates a new
version and preserves prior versions. Once estimates exist, direct order-line add/edit/delete endpoints are locked. The initial estimate must be approved by an administrator before a technician starts the repair; no repair may transition to `IN_PROGRESS` without an administrator-approved estimate, including orders that predate estimates.

After work starts, the assigned technician can add actual services and parts to the order's work-act draft without advance administrator approval. The API snapshots catalog names and prices and does not change order lines, inventory, receipt totals, or technician pay while the act is a draft or pending review. The technician submits the draft when ready; an administrator alone chooses the lines to keep and approves the act, without a second confirmation from the technician. Removed lines remain in the act's audit snapshot. Approval reconciles order lines and tracked stock atomically; the approved lines then feed the receipt and technician calculation. For orders created by this API version, an approved work act is required before `READY_FOR_PICKUP`, receipt finalization, or release. On older in-progress orders, technicians must use the work act instead of directly changing receipt lines; if an older order already has an estimate, additional changes remain subject to administrator-approved estimates. The additive `20261107190000_repair_work_acts` migration adds the act and audit records without rewriting existing orders.

Customers can read only active service names and exact unit prices through
`GET /customer/service-prices`; this response excludes parts, stock levels, inactive rows, and admin
data. Web and Android show these as pre-visit catalog references, not a diagnosis or guaranteed
repair total. Each initial quoted work item and any parts must be included in the technician's exact estimate,
which an administrator confirms before work begins; the service communicates the confirmed work and
price to the customer beforehand. The new
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
bonus transaction. For repair orders, the assigned technician or administrator can choose to redeem
points at pickup. One point equals one ruble, capped by the available balance and 30% of `SERVICE`
line totals; spare parts and products are excluded. The release transaction records the redemption,
marks the receipt paid, and awards 10% of the remaining cash amount. The server recalculates the due
amount under lock, so a changed balance or order total requires refreshing the release screen.

## Customer referrals

Each active customer receives three personal, one-use referral codes. `GET /referrals/me` returns the
codes, their issue and expiry dates, status, totals, and up to 50 recent invitations. Codes expire six
calendar months after first issue; an unused legacy code is retained as the first code, and the other
two are created at the same time. Public registration may include `referralCode`; it is claimed
atomically and linked to the new account, so it cannot be reused or applied to an existing account.
When an administrator confirms payment for the referred customer's first completed repair, the same
database transaction marks the referral rewarded and records two 250-point `REFERRAL_REWARD` ledger
entries with referral-specific reasons.
Registration alone, craft orders, repeated payment confirmation, and later repairs do not issue
another referral reward. Referral points remain non-cash loyalty points and follow the existing
repair-redemption cap.

## Device-specific repair catalog

New repair requests, saved customer devices, and newly managed catalog entries support `COMPUTER`, `LAPTOP`, and `MONOBLOCK`; legacy `PHONE` and `TABLET` records remain readable. Repair services can be assigned to the `SOFTWARE` catalog group without changing their names or prices.
The API rejects new requests for other device types. Existing `PHONE` and `TABLET` orders and their
catalog compatibility remain readable for historical records and previously issued warranties;
they cannot be selected for a new repair. Products for the separate customer shop keep their
existing workflow.

## Intake, work orders, and order release

Administrators and the assigned technician maintain one intake act per service-center repair. It
records a condition summary, serial number, included accessories, and notes. The first save creates
the act record, so intake does not depend on an upload step. The API requires the saved summary before
the order can become ready for pickup or be released; the act becomes read-only once the order is
ready, completed, or cancelled. The old four-side fields and legacy attachment references remain
readable for history without being required by the current workflow.

New orders record whether repair is at the service center or at the customer's address. At a home
visit, the customer supplies an approximate one-way distance from Pushkino's boundary; the assigned
technician or administrator checks the address and distance manually in Yandex Maps before recording
diagnosis. No Maps API or automatic route calculation is used. Pushkino visits are free; outside the
city, the verified one-way distance is charged at 25 RUB/km only after a diagnosis is recorded.
Diagnosis costs 850 RUB when performed, is charged once, cannot be covered by loyalty bonuses, and is
credited in full to the technician. The new flow is opted into with `useNewRepairScenario: true`;
legacy orders and older clients that omit that flag keep scenario version 0 and receive none of the
new fees or status gates.

Customer and administrator order-creation endpoints share the same intake field schema and the
transactional record-creation helper in `src/features/orders/repair-order-intake.ts`. Keep
role-specific work at the endpoint boundary: customer intake checks whether intake is open and
validates ownership of a saved device; administrator intake validates an active customer and may
fall back to that customer's saved phone number. Both paths keep the same address, visit, and
legacy-version rules. When extending intake, update this shared contract and both client forms
rather than adding a parallel creation path. Web forms share `RepairOrderIntakeFields`; Android uses
`RepairOrderIntakeInput` and one serializer while retaining the customer and administrator endpoints
for their separate authorization rules.

For an on-site repair, the assigned technician agrees the repair price directly with the customer,
records cash or bank-transfer payment, and closes the order without administrator approval. When an
on-site repair is declined after diagnosis, the receipt contains the diagnostic and applicable travel
fees. If the repair cannot be completed there, the technician records customer consent to transport
the device; after arrival at the service center, staff fill the normal intake act and continue through
estimate and repair approval. A home-visit order still at the customer's address cannot be marked
ready for pickup or released as a service-center order.

For service-center repairs, the technician records work completion separately. Only an administrator
can move a new-scenario order to `READY_FOR_PICKUP` and release it. Release shows repair and parts
separately from diagnosis and travel fees, applies bonuses only to eligible services (up to 30%, not
to diagnosis, travel, or parts), records payment, closes the order, issues the warranty card, and
calculates technician salary. Diagnosis and travel fees are added to the technician's salary in full,
outside the repair percentage. These additive fields are introduced by migration
`20261111080000_repair_visit_scenario`; existing order rows default to scenario version 0. See
[`../docs/repair-visit-scenario.md`](../docs/repair-visit-scenario.md) for the complete workflow.

A production-only worker creates one XLSX report for each fully completed Moscow calendar month at
10:00 on the first day of the following month. The workbook has a summary for every technician, a
detailed row for each recorded repair or craft-order salary entry, and a separate adjustment ledger.
It uses the frozen `salaryRub`, rate, service total, and repair visit-fee values saved with each
entry; repair diagnosis/travel fees are shown separately and are already included in the recorded
salary. Administrators enter actual tax amounts manually; the system does not infer tax status or
calculate tax rates. The amount remaining to pay is recorded salary less active tax, advance, and
deduction records. Each adjustment stores its date, reason, creator, and (if cancelled) cancellation
reason; cancelled entries remain visible in the ledger but do not reduce the amount due. This is an
internal accrual summary, not a statutory payroll or tax document. Customer names, contacts,
addresses, and device details are excluded from the workbook.

Adjustments are recorded against a monthly report and a technician by administrators only. The
adjustment date must fall inside that report month. The report's adjustment and file versions ensure
the private archived XLSX is refreshed after a change; previously sent MAX deliveries are queued for
the latest version. An uncertain MAX delivery result is not retried automatically to avoid duplicate
payroll files, while the current workbook remains available to administrators in the archive.

Each report is stored as a private project-storage object and indexed in
`technician_monthly_salary_reports`. Administrators can list and download reports through the
admin-only `GET /admin/salary-reports` and `GET /admin/salary-reports/:reportId/file` endpoints; the
web admin archive is at `/admin/salary-reports`. An XLSX copy is retained in that archive whether or
not any administrator has linked MAX. When the MAX bot is configured, the worker queues a file
delivery only for active administrator accounts with a linked MAX user ID. Delivery retries are
bounded; an uncertain message result is not resent automatically to avoid duplicate payroll files.
No report for a month before the feature was enabled is generated. The monthly archive is retained
until an administrator removes it through a future supported retention workflow; there is currently
no automatic deletion.

The former pickup-QR endpoints are no longer available; legacy code records and columns are retained
for historical data.

## Post-repair follow-up

When an order reaches `COMPLETED` after an actual service-center handoff or an agreed and paid
on-site repair, the same transaction queues one customer follow-up for 48 hours later. Diagnosis-only
returns and historical completed orders do not create follow-ups. A production-only database-backed
worker sends the Android push, uses a lease to avoid concurrent deliveries, and retries temporary
delivery failures with bounded backoff. Delivery requires the customer's active account and a
registered push token.

The customer can answer once: `WORKING` closes the follow-up and offers the existing review form only
if there is not already a review for that order; `NEEDS_HELP` atomically records the answer and a
message in the existing support conversation, then notifies active administrators. Repeating the
same answer is idempotent, while changing an already saved answer is rejected. The additive
`20261116120000_repair_order_follow_ups` migration creates only the follow-up queue and does not
backfill or modify existing orders.

The assigned technician may also request a review once from a completed order. The API records the
request timestamp and technician, then sends the customer a `repair_review_request` push with a
direct link to the existing review form. Orders that are not completed, belong to another technician,
or already have a review reject the request. Repeated requests do not send another push; the saved
request remains visible in the customer's completed order if push delivery is unavailable. The
additive `20261120130000_repair_order_review_requests` migration adds nullable fields only and does
not change existing orders.

## Customer complaints and suggestions

Authenticated customers can submit a private complaint or suggestion with a message of up to 2,000
characters. Submissions are separate from the customer's general support chat so each item can be
triaged independently. Only administrators can view the inbox or change status (`NEW`,
`IN_PROGRESS`, `RESOLVED`); submissions are not public and do not create a public feed. The additive
`20261118090000_customer_feedback` migration creates an empty table. Customer account deletion also
removes that customer's feedback records.

## Repair notifications in Telegram and MAX

Customers can independently opt in to Telegram and MAX from the Web or Android profile. Each
channel uses its own short-lived, one-time deep link and unique customer identifier; identifiers
remain server-side and either channel can be disconnected without affecting the other. The API never
exposes either bot token or messenger identifier to client applications.

Telegram queues three separately deduplicated repair messages: “Устройство принято” when a
technician is first assigned, “Диагностика завершена” when a technician or administrator records
that milestone, and “Готово к выдаче” when the order enters `READY_FOR_PICKUP`. Completion of
diagnosis is an explicit staff action and does not by itself change the repair status. MAX queues
these milestones plus “Работы завершены” when the technician marks service-center work complete
(with a note that an administrator still checks readiness) and “Ремонт завершён” after an agreed,
successful on-site repair. A customer declining an on-site repair after diagnosis does not receive
the repair-completed MAX message. The existing “Готово к выдаче” message remains a separate event.
Deliveries are deduplicated per order and milestone. Production retries transient delivery failures
and skips customers who have not linked the relevant channel.

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

MAX login and self-registration replace the former Yandex ID sign-in. `GET /auth/max/config` reports
whether the bot is configured. `POST /auth/max/login` creates a single-use request (10-minute TTL)
and returns the `https://max.ru/<botName>?start=<payload>` deep link plus a poll token;
`POST /auth/max/login/poll` returns `pending`, `awaiting_contact`, `failed`, `expired`, or
`completed` with a session. The webhook handles `bot_started` and the `request_contact` reply:
the contact signature (`vcf_info` HMAC-SHA256 with the bot token) is verified server-side, the
customer is matched by the last ten phone digits; when no account exists, the verified MAX contact
can create a customer account. Referral codes from the web login screen are applied on creation.
Poll tokens are stored only as SHA-256 hashes, a request can be consumed once,
and MAX contact data is used only for sign-in and order communication. Staff accounts still sign in
with email and password.

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
`technologyFact`. Web and Android use the same curated list and pass the last
shown `previousFactId` when they load the feed, so the next fact differs from
the one previously displayed. The API still returns `updatedAt` and
`nextUpdateAt` for the existing two-hour automatic refresh. Selection is
stateless: it does not create database records, run a background job, send push
notifications, or fetch live technology news.

# Customer visit requests and service operations

Customer repair requests can include optional device brand, model, serial number, one initial
photo, and a preferred visit time. The preferred time is a request, not a confirmed booking: the
service checks its weekly calendar and confirms or changes the time with the customer. The Web and
Android forms label this distinction; administrators can edit the preferred time from the order and
assign a technician through the existing order workflow. Request photos use the existing protected
order-photo storage and access rules. Intake paperwork, customer reviews, receipts, work orders, and
warranties remain on their existing workflows; the intake act uses its text fields and does not need
an attachment.
News articles and site banners can also store either an image or an MP4 video, using protected media
access for uploaded files.
News articles use the `NEWS` kind by default. Administrators can create a `WORK_STORY` publication
through the same news editor to describe service-authored repair examples separately from customer
reviews. Public `GET /public/work-stories` returns only currently published, in-range examples; its
image route serves only an image attached to a currently visible example. Work stories accept images,
not video, and do not create customer news-push deliveries. The additive
`20261116100000_work_story_publications` migration assigns the default `NEWS` kind to existing rows.

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

`GET /seasonal-theme` returns only the manually selected theme and its activation time; it does not
calculate or expose a calendar season. `PUT /seasonal-theme` is restricted to administrators and
accepts any one of the four seasons or `NONE`, regardless of the date. Enabling a season replaces
the previously selected season; `NONE` disables the seasonal theme. Administrators choose the
setting from the dedicated seasonal-appearance tab in Web or Android. The selection is stored in the
existing `app_settings` row `seasonal_theme`, with no schema migration, and remains active until an
administrator changes it. Both clients refresh the public state periodically.

## Customer promotions and giveaways

Administrators create scheduled `PROMOTION` and `GIVEAWAY` offers through the authenticated admin
endpoints and publish them for customers. A signed-in customer may join each published offer once
while it is open. Promotions are participation campaigns only; they do not change repair-order
prices. The public `GET /public/offers` endpoint lists published offers during their active period;
its `completedOffers` list contains recently finished offers after an administrator publishes
results. Winner names are shown without customer identifiers, while participant counts and personal
participation remain available only through authenticated customer/admin endpoints.

A giveaway may define one, two, or three sequential prize places. The first place must have a prize
description and/or bonus points; later places are optional, but configured places cannot have gaps.
Prize photos are optional and stored separately from the offer. After a giveaway closes, an
administrator draws the configured number of distinct participants and publishes the results.
Publishing credits configured bonus points to the loyalty ledger in the same transaction; a unique
ledger key prevents duplicate awards if results are published again. Promotions do not use prize
places. Administrators can upload, replace, or remove JPEG, PNG, and WebP prize images up to 5 MB.
Public images are served only for published active offers or after published results; administrators
may preview draft images through the authenticated media route. The database stores opaque object
IDs, and replacing or deleting a photo removes the previous stored object when possible.

The first publication of a `NEWS` article sends a customer push notification; service-authored
`WORK_STORY` examples do not. Publishing a promotion or giveaway also creates a durable
`customer_offer_push_deliveries` work item in the same database transaction; the worker sends it as
soon as it is published, skips unpublished or expired offers,
and retries temporary Firebase delivery failures. An offer scheduled to start later can therefore
be announced at publication; its Android notification expires at the configured end time. Repair-order status changes already notify the order's
other participants; `READY_FOR_PICKUP` now explicitly says the repair is ready, and successful
staff release confirmation sends a separate completion notification. Firebase delivery
requires a registered device token and the relevant notification permission. Android FCM messages
are routed to `repair_updates_soft_spark` by default; `customer_offer_winner` uses
`repair_winner_soft_spark`, which the Android app creates with the separate celebration sound.
The new additive
`20261028190000_customer_offer_push_deliveries` migration adds only the delivery queue.

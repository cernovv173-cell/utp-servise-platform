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
server-bound Yandex Mail application credentials over implicit TLS on SMTP port 465. Reset links are
restricted to origins in `WEB_APP_ORIGIN` and lead to the web `/reset-password` screen.

Startup diagnostics identify invalid configuration fields and sanitize other error messages without
printing configuration values. Run `pnpm test` for configuration and diagnostic regressions.

## Repair catalog stock

Repair spare parts and products have an optional `stockQuantity`. Existing catalog rows remain untracked
(`null`) until an administrator records a factual starting balance; services do not use stock.
Adding a tracked spare part or product to an open order decrements inventory atomically with the new order
line. Removing that line returns its quantity, and changing a linked line's quantity in an unpaid
completed-order receipt applies the corresponding stock delta. Order lines cannot be removed after
completion, and a paid receipt cannot be changed. Administrators can add a manual sale line to an
unpaid receipt; free-form lines are not linked to catalog stock. Saving the receipt updates its item
snapshot, bonus discount, and technician service calculation in the same database transaction. Only
administrators can set catalog balances; technicians can read active item balances. A tracked zero
balance blocks use of that spare part or product. Administrators can create a repair order for an
active customer through `POST /admin/orders`; its creation is recorded in order history. The
administrator can create a customer record through `POST /admin/customers`; the one-time temporary
password is returned only with that creation response and must be changed on first sign-in.

Repair orders are archived automatically after the Moscow calendar day in which they were created.
The worker checks once per minute and marks older orders with `archived_at`; it never deletes the
order or changes its status. `GET /orders?archive=active` and `GET /orders?archive=archived`
return the corresponding role-scoped list. Omitting `archive` retains the unfiltered legacy response.

Administrators can load an individual repair record through `GET /admin/orders/:orderId`; this
endpoint is restricted to the administrator role. `POST /staff` also requires an administrator and
creates a technician login with a generated temporary password and mandatory password change on
first sign-in. Customer self-registration remains separate at `POST /auth/register` and always
creates a customer account; the public registration flow cannot assign staff or administrator roles.
Administrators can correct request details through `PATCH /orders/:orderId` in any order status;
customers can edit only their own not-yet-assigned orders. Status transitions, service lines, stock,
and paid receipts keep their independent authorization and lifecycle checks.

Customers may save an optional gender and birth date with `PATCH /auth/profile`. The birthday worker
uses the Moscow calendar date and sends the greeting once per customer per year only to active
customers with a registered push-device token. A unique `(user_id, birthday_year)` delivery record
prevents duplicates across API instances; failed delivery is retried during that birthday only.
Clearing the date stops future greetings. Customers without a registered push token are not queued.

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

## Intake, work orders, and customer pickup

Administrators and the assigned technician maintain one intake act per repair order. It records the visible condition and a protected photo for the front, back, left, and right sides, plus the serial number, included accessories, and notes. The order cannot be marked ready for pickup until all four condition notes and photos are saved; the act becomes read-only once the order is ready, completed, or cancelled.

The service moves a repair from `IN_PROGRESS` to `READY_FOR_PICKUP`; staff cannot directly set `COMPLETED`. The customer requests a pickup QR code from their own ready order. The server stores only its SHA-256 token hash; the raw payload expires after two hours, and requesting a replacement invalidates the previous code. An administrator or assigned technician scans or enters the code and supplies the warranty duration and terms. One transaction consumes the code, closes the order, records the status event, issues the warranty card, and calculates technician salary. Expired or replayed codes do not close an order.

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
at most once per customer per calendar year.

On the same Moscow calendar day, `GET /news` also returns a personal birthday
greeting only for the signed-in customer whose saved birth date matches that
day. The Web and Android news feeds display it until the next Moscow midnight
and hide it at expiry. Birthday push messages use the remaining time in that day as their
Android delivery TTL; the existing worker retries only while the birthday is
still the current Moscow date. Neither the card nor the date is exposed to
other users.

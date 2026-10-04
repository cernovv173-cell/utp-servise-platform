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

Repair spare parts have an optional `stockQuantity`. Existing catalog rows remain untracked
(`null`) until an administrator records a factual starting balance; services do not use stock.
Adding a tracked spare part to an open order decrements inventory atomically with the new order
line. Removing that line returns its quantity, and changing a linked line's quantity in an unpaid
completed-order receipt applies the corresponding stock delta. Order lines cannot be removed after
completion, and a paid receipt cannot be changed. Administrators can add a manual sale line to an
unpaid receipt; free-form lines are not linked to catalog stock. Saving the receipt updates its item
snapshot, bonus discount, and technician service calculation in the same database transaction. Only
administrators can set catalog balances; technicians can read active item balances. A tracked zero
balance blocks use of that spare part.

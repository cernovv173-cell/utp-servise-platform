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

Startup diagnostics identify invalid configuration fields and sanitize other error messages without
printing configuration values. Run `pnpm test` for configuration and diagnostic regressions.

import assert from "node:assert/strict";
import { test } from "node:test";
import { z } from "zod";

import { readConfig, requireDatabaseUrl } from "../src/lib/config.js";
import { optionalEnvironmentValue } from "../src/lib/optional-environment.js";
import { formatStartupError } from "../src/lib/startup-error.js";

test("blank optional values do not block startup while invalid supplied values fail", () => {
  for (const DATABASE_URL of [undefined, "", "  "]) {
    assert.equal(
      readConfig({ DATABASE_URL, PORT: "10001" }).databaseUrl,
      undefined,
    );
  }
  assert.throws(() => readConfig({ DATABASE_URL: "-", PORT: "10001" }));
  assert.throws(() => requireDatabaseUrl({ DATABASE_URL: "" }));
  assert.throws(() => readConfig({ PORT: "invalid" }));
  const email = optionalEnvironmentValue(z.string().email());
  const password = optionalEnvironmentValue(z.string().min(1));
  assert.equal(email.parse(""), undefined);
  assert.equal(password.parse("  "), undefined);
  assert.equal(
    password.parse(" password with spaces "),
    " password with spaces ",
  );
  assert.throws(() => email.parse("-"));
  assert.equal(email.parse("operator@example.com"), "operator@example.com");
});

test("configuration diagnostics name invalid fields without exposing inputs or custom messages", () => {
  const result = z
    .object({ MAILRU_EMAIL: z.string().email("secret custom message") })
    .safeParse({ MAILRU_EMAIL: "sensitive-value" });
  assert.equal(result.success, false);
  if (result.success) return;
  const output = formatStartupError(result.error, {});
  assert.match(output, /MAILRU_EMAIL: invalid_format/);
  assert.doesNotMatch(output, /sensitive-value|secret custom message/);
});

test("startup diagnostics redact environment values and connection credentials", () => {
  const output = formatStartupError(
    new Error(
      "Connection refused: postgresql://user:hidden-password@database:5432/app?token=query-secret; provider=unlabelled-secret; token=other-secret",
    ),
    { SMS_RU_API_ID: "unlabelled-secret" },
  );
  assert.match(output, /Connection refused/);
  assert.match(output, /database:5432/);
  assert.doesNotMatch(
    output,
    /hidden-password|query-secret|unlabelled-secret|other-secret/,
  );
  assert.match(formatStartupError(null, {}), /Unknown startup error/);
});

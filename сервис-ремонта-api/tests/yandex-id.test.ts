import assert from "node:assert/strict";
import test from "node:test";

import { getYandexIdentity } from "../src/features/auth/yandex-id.js";

const mockResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

test("Yandex identity lookup uses the authorization header and checks the app id", async () => {
  let requestUrl = "";
  let authorization = "";
  const identity = await getYandexIdentity(
    "yandex-oauth-access-token-for-test",
    "utp-yandex-client-id",
    async (input, init) => {
      requestUrl = String(input);
      authorization = new Headers(init?.headers).get("Authorization") ?? "";
      return mockResponse({
        id: "yandex-user-100",
        client_id: "utp-yandex-client-id",
        login: "repair.customer",
        default_email: "Customer@Example.test",
        real_name: "Тестовый клиент",
      });
    },
  );

  assert.equal(requestUrl, "https://login.yandex.ru/info?format=json");
  assert.equal(authorization, "OAuth yandex-oauth-access-token-for-test");
  assert.deepEqual(identity, {
    id: "yandex-user-100",
    email: "customer@example.test",
    displayName: "Тестовый клиент",
  });
});

test("Yandex identity lookup rejects tokens issued to another app", async () => {
  await assert.rejects(
    getYandexIdentity(
      "yandex-oauth-access-token-for-test",
      "expected-client-id",
      async () =>
        mockResponse({
          id: "yandex-user-100",
          client_id: "different-client-id",
          login: "repair.customer",
          default_email: "customer@example.test",
        }),
    ),
    { code: "YANDEX_TOKEN_INVALID" },
  );
});

test("Yandex sign-in requires a provider email", async () => {
  await assert.rejects(
    getYandexIdentity(
      "yandex-oauth-access-token-for-test",
      "expected-client-id",
      async () =>
        mockResponse({
          id: "yandex-user-100",
          client_id: "expected-client-id",
          login: "repair.customer",
        }),
    ),
    { code: "YANDEX_EMAIL_REQUIRED" },
  );
});

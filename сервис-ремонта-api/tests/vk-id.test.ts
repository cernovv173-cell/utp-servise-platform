import assert from "node:assert/strict";
import test from "node:test";

import { getVkIdentity } from "../src/features/auth/vk-id.js";

test("VK ID user info validates the server-side token and normalizes identity", async () => {
  let requestUrl = "";
  let requestBody = "";
  const identity = await getVkIdentity(
    "vk-oauth-access-token-for-test",
    "54808157",
    async (input, init) => {
      requestUrl = String(input);
      requestBody = String(init?.body);
      return new Response(
        JSON.stringify({
          user: {
            user_id: 123456,
            email: "Customer@Example.test",
            first_name: "Тест",
            last_name: "Клиент",
          },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    },
  );

  assert.equal(
    requestUrl,
    "https://id.vk.ru/oauth2/user_info?client_id=54808157",
  );
  assert.equal(requestBody, "access_token=vk-oauth-access-token-for-test");
  assert.deepEqual(identity, {
    id: "123456",
    email: "customer@example.test",
    displayName: "Тест Клиент",
  });
});

test("VK ID sign-in rejects a profile without email", async () => {
  await assert.rejects(
    getVkIdentity(
      "vk-oauth-access-token-for-test",
      "54808157",
      async () =>
        new Response(JSON.stringify({ user: { user_id: 123456 } }), {
          status: 200,
        }),
    ),
    { code: "VK_EMAIL_REQUIRED" },
  );
});

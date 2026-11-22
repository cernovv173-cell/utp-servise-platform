import assert from "node:assert/strict";
import test from "node:test";

import { downloadProjectApk } from "../src/features/android-app/android-app.storage.js";

test("APK download streams signed storage bytes without forwarding the storage token", async (t) => {
  const originalFetch = globalThis.fetch;
  const originalApiUrl = process.env.AMAZI_STORAGE_API_URL;
  const originalToken = process.env.AMAZI_STORAGE_PROJECT_TOKEN;
  t.after(() => {
    globalThis.fetch = originalFetch;
    if (originalApiUrl === undefined) delete process.env.AMAZI_STORAGE_API_URL;
    else process.env.AMAZI_STORAGE_API_URL = originalApiUrl;
    if (originalToken === undefined)
      delete process.env.AMAZI_STORAGE_PROJECT_TOKEN;
    else process.env.AMAZI_STORAGE_PROJECT_TOKEN = originalToken;
  });

  process.env.AMAZI_STORAGE_API_URL = "https://storage.example.test";
  process.env.AMAZI_STORAGE_PROJECT_TOKEN = "test-storage-token";

  const requests: Array<{ url: string; authorization: string | null }> = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = input instanceof Request ? input.url : String(input);
    const authorization = new Headers(init?.headers).get("authorization");
    requests.push({ url, authorization });

    if (url === "https://storage.example.test/objects/apk-object/download") {
      return new Response(null, {
        status: 302,
        headers: { location: "https://cdn.example.test/signed.apk" },
      });
    }
    if (url === "https://cdn.example.test/signed.apk") {
      return new Response(new Uint8Array([0x50, 0x4b, 0x03, 0x04]), {
        headers: {
          "content-length": "4",
          "content-type": "application/vnd.android.package-archive",
        },
      });
    }
    throw new Error(`Unexpected URL: ${url}`);
  }) as typeof fetch;

  const response = await downloadProjectApk("apk-object");

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-length"), "4");
  assert.deepEqual(
    Array.from(new Uint8Array(await response.arrayBuffer())),
    [0x50, 0x4b, 0x03, 0x04],
  );
  assert.deepEqual(requests, [
    {
      url: "https://storage.example.test/objects/apk-object/download",
      authorization: "Bearer test-storage-token",
    },
    { url: "https://cdn.example.test/signed.apk", authorization: null },
  ]);
});

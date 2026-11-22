import { describe, expect, it, vi } from "vitest";

import { readApkResponse } from "@/features/android-app/read-apk-response";

describe("readApkResponse", () => {
  it("reports chunk progress and returns the complete APK blob", async () => {
    const progress = vi.fn();
    const response = new Response(
      new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new Uint8Array([0x50, 0x4b]));
          controller.enqueue(new Uint8Array([0x03, 0x04]));
          controller.close();
        },
      }),
      {
        headers: {
          "content-length": "4",
          "content-type": "application/vnd.android.package-archive",
        },
      },
    );

    const file = await readApkResponse(response, null, progress);

    expect(file.size).toBe(4);
    expect(file.type).toBe("application/vnd.android.package-archive");
    expect(Array.from(new Uint8Array(await file.arrayBuffer()))).toEqual([0x50, 0x4b, 0x03, 0x04]);
    expect(progress.mock.calls).toEqual([[50], [100]]);
  });

  it("uses the published APK size when the response header is not exposed", async () => {
    const progress = vi.fn();
    const response = new Response(
      new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new Uint8Array([1, 2, 3, 4]));
          controller.close();
        },
      }),
    );

    await readApkResponse(response, 4, progress);

    expect(progress.mock.calls).toEqual([[100]]);
  });

  it("keeps progress indeterminate when the file size is unknown", async () => {
    const progress = vi.fn();
    const response = new Response(new Uint8Array([1, 2, 3]));

    await readApkResponse(response, null, progress);

    expect(progress.mock.calls).toEqual([[null], [100]]);
  });

  it("rejects an incomplete stream instead of saving a corrupt file", async () => {
    const response = new Response(new Uint8Array([1, 2]), {
      headers: { "content-length": "4" },
    });

    await expect(readApkResponse(response, null, vi.fn())).rejects.toThrow(
      "APK download was incomplete",
    );
  });
});

const APK_CONTENT_TYPE = "application/vnd.android.package-archive";

export const readApkResponse = async (
  response: Response,
  reportedSizeBytes: number | null | undefined,
  onProgress: (percent: number | null) => void,
): Promise<Blob> => {
  if (!response.ok) throw new Error("APK download failed");

  const headerSizeBytes = Number(response.headers.get("content-length"));
  const totalBytes = headerSizeBytes > 0 ? headerSizeBytes : (reportedSizeBytes ?? 0);
  const reader = response.body?.getReader();

  if (!reader) {
    const file = await response.blob();
    if (file.size === 0) throw new Error("APK download was empty");
    onProgress(100);
    return file;
  }

  const chunks: Uint8Array[] = [];
  let downloadedBytes = 0;
  let lastReportedProgress: number | null = null;
  if (totalBytes <= 0) onProgress(null);

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      downloadedBytes += value.byteLength;
      if (totalBytes > 0) {
        const progress = Math.min(100, Math.floor((downloadedBytes / totalBytes) * 100));
        if (progress !== lastReportedProgress) {
          onProgress(progress);
          lastReportedProgress = progress;
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  if (downloadedBytes === 0 || (totalBytes > 0 && downloadedBytes !== totalBytes)) {
    throw new Error("APK download was incomplete");
  }

  if (lastReportedProgress !== 100) onProgress(100);
  const blobParts = chunks.map((chunk) => {
    const part = new ArrayBuffer(chunk.byteLength);
    new Uint8Array(part).set(chunk);
    return part;
  });
  return new Blob(blobParts, { type: APK_CONTENT_TYPE });
};

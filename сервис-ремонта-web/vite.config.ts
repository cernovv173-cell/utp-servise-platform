import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { URL, fileURLToPath } from "node:url";
import { defineConfig, loadEnv } from "vite";

const readPort = (): number | undefined => {
  const configuredPort = process.env.PORT?.trim();
  if (!configuredPort) return undefined;

  const port = Number(configuredPort);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error("PORT must be an integer between 1 and 65535.");
  }

  return port;
};

export default defineConfig(({ mode }) => {
  const buildEnv = loadEnv(mode, process.cwd(), "");
  const port = readPort();
  const server = {
    host: "0.0.0.0",
    port,
    strictPort: port !== undefined,
    allowedHosts: process.env.AMAZI_PREVIEW_HOST?.trim()
      ? [process.env.AMAZI_PREVIEW_HOST.trim()]
      : [],
  };

  return {
    define: {
      "import.meta.env.VITE_YANDEX_CLIENT_ID": JSON.stringify(
        buildEnv.YANDEX_CLIENT_ID?.trim() ?? "",
      ),
    },
    plugins: [tanstackRouter({ autoCodeSplitting: true }), react(), tailwindcss()],
    preview: server,
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
      },
    },
    server,
  };
});

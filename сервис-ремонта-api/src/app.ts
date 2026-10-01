import express, { type Express } from "express";
import helmet from "helmet";
import type { Logger } from "pino";
import { pinoHttp } from "pino-http";

import type { Database } from "./lib/database/database.js";
import { errorHandler } from "./lib/http/error-handler.js";
import { notFoundHandler } from "./lib/http/not-found-handler.js";
import { createApiRouter } from "./routes.js";

type CreateAppOptions = {
  readonly database?: Database;
  readonly logger: Logger;
};

export const createApp = ({ database, logger }: CreateAppOptions): Express => {
  const app = express();

  app.disable("x-powered-by");
  const webOrigins = new Set(
    (process.env.WEB_APP_ORIGIN ?? "")
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean),
  );
  app.use((request, response, next) => {
    const origin = request.header("origin");
    if (origin && webOrigins.has(origin)) {
      response.setHeader("Access-Control-Allow-Origin", origin);
      response.setHeader("Vary", "Origin");
      response.setHeader(
        "Access-Control-Allow-Methods",
        "GET,POST,PATCH,PUT,DELETE,OPTIONS",
      );
      response.setHeader(
        "Access-Control-Allow-Headers",
        "Authorization,Content-Type",
      );
      response.setHeader("Access-Control-Max-Age", "600");
    }
    if (request.method === "OPTIONS") {
      response.status(origin && webOrigins.has(origin) ? 204 : 403).end();
      return;
    }
    next();
  });
  app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
  app.use(
    pinoHttp({
      autoLogging: {
        ignore: (request) =>
          request.method === "GET" && request.url === "/health",
      },
      logger,
    }),
  );
  app.use(express.json({ limit: "1mb" }));

  app.get("/", (_request, response) => {
    response.json({ application: "backend", status: "ok" });
  });
  app.get("/health", (_request, response) => {
    response.json({ status: "ok" });
  });
  app.use("/api", createApiRouter({ database }));

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};

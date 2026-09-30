import type { RequestHandler } from "express";

import type { DatabaseHealth } from "../../lib/database/database.js";

export const createGetApiHealth =
  (database?: DatabaseHealth): RequestHandler =>
  async (request, response) => {
    if (!database) {
      response.json({ database: "not_configured", status: "ok" });
      return;
    }

    try {
      await database.check();
      response.json({ database: "ok", status: "ok" });
    } catch {
      request.log.warn("Database readiness check failed");
      response
        .status(503)
        .json({ database: "unavailable", status: "unavailable" });
    }
  };

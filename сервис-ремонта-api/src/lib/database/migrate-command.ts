import { requireDatabaseUrl } from "../config.js";
import { formatStartupError } from "../startup-error.js";
import { createDatabase } from "./database.js";
import { runDatabaseMigrations } from "./migrations.js";

const run = async (): Promise<void> => {
  const database = createDatabase(requireDatabaseUrl());

  try {
    await runDatabaseMigrations(database);
  } finally {
    await database.close();
  }
};

void run().catch((error: unknown) => {
  process.stderr.write(formatStartupError(error, process.env));
  process.exitCode = 1;
});

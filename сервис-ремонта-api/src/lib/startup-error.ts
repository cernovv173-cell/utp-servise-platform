import { z } from "zod";

const redactMessage = (
  message: string,
  environment: NodeJS.ProcessEnv,
): string => {
  let output = message;
  const values = Object.values(environment)
    .filter((value): value is string => Boolean(value))
    .sort((left, right) => right.length - left.length);
  for (const value of values) {
    output = output.split(value).join("[REDACTED]");
  }
  return output
    .replace(/\u001b\[[0-?]*[ -/]*[@-~]/gu, "")
    .replace(
      /\b(?:https?|postgres(?:ql)?|rediss?):\/\/[^\s"'<>]+/giu,
      (value) => {
        try {
          const url = new URL(value);
          url.username = "";
          url.password = "";
          url.search = url.search ? "?[REDACTED]" : "";
          url.hash = "";
          return url.toString();
        } catch {
          return "[REDACTED URL]";
        }
      },
    )
    .replace(/\b(Bearer|Basic)\s+[^\s,;"']+/giu, "$1 [REDACTED]")
    .replace(
      /(["']?\b[\w-]*(?:password|passwd|secret|token|api[_-]?key|authorization|cookie)[\w-]*["']?\s*[:=]\s*)(?:"[^"]*"|'[^']*'|[^\s,;}]+)/giu,
      "$1[REDACTED]",
    )
    .slice(0, 2_000);
};

export const formatStartupError = (
  error: unknown,
  environment: NodeJS.ProcessEnv,
): string => {
  if (error instanceof z.ZodError) {
    const issues = error.issues.map(
      (issue) => `${issue.path.join(".") || "configuration"}: ${issue.code}`,
    );
    return `Backend startup failed. Invalid configuration: ${issues.join("; ")}.\n`;
  }
  const message =
    error instanceof Error ? error.message : "Unknown startup error";
  return `Backend startup failed. ${redactMessage(message, environment)}\n`;
};

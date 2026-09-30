import { z } from "zod";

export const optionalEnvironmentValue = <Schema extends z.ZodType>(
  schema: Schema,
) =>
  z.preprocess(
    (value) =>
      typeof value === "string" && value.trim() === "" ? undefined : value,
    schema.optional(),
  );

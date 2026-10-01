"use client";

import { useQuery } from "@tanstack/react-query";

import { readExamples } from "./example-api";

export const useExampleQuery = () =>
  useQuery({
    queryKey: ["query-examples", "list"],
    // Real API: ({ signal }) => requestJson<ExampleItem[]>("/api/items", { signal })
    queryFn: ({ signal }) => readExamples(signal),
  });

"use client";

import { useInfiniteQuery } from "@tanstack/react-query";

import { readExamplePage } from "./example-api";

export const useExampleInfiniteQuery = () =>
  useInfiniteQuery({
    queryKey: ["query-examples", "pages"],
    initialPageParam: 0,
    queryFn: ({ pageParam, signal }) => readExamplePage(pageParam, signal),
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  });

"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { addExample } from "./example-api";

export const useExampleMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: addExample,
    // Returning the promise keeps isPending true until both views have refreshed.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["query-examples"] }),
  });
};

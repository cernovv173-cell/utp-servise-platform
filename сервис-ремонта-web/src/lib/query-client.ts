import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

const isAbortError = (error: unknown) => error instanceof Error && error.name === "AbortError";

const showRequestError = (error: unknown, fallback: string) => {
  const message = error instanceof Error ? error.message.trim() : "";
  toast.error(message || fallback);
};

export const createQueryClient = () => {
  const notifiedQueries = new WeakSet<object>();
  const queryCache = new QueryCache({
    onError: (error, query) => {
      if (isAbortError(error) || query.state.data !== undefined || notifiedQueries.has(query)) {
        return;
      }

      notifiedQueries.add(query);
      showRequestError(
        error,
        "Не удалось загрузить данные. Проверьте соединение и повторите попытку.",
      );
    },
    onSuccess: (_data, query) => {
      notifiedQueries.delete(query);
    },
  });
  const mutationCache = new MutationCache({
    onError: (error, _variables, _context, mutation) => {
      if (isAbortError(error) || mutation.options.onError) return;

      showRequestError(error, "Не удалось выполнить действие. Попробуйте ещё раз.");
    },
  });

  return new QueryClient({
    queryCache,
    mutationCache,
    defaultOptions: {
      mutations: { retry: 0 },
      queries: {
        refetchOnWindowFocus: false,
        retry: 1,
        staleTime: 30_000,
      },
    },
  });
};

export const queryClient = createQueryClient();

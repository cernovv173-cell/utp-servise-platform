"use client";

import { useState } from "react";

import { useExampleInfiniteQuery } from "@/examples/use-example-infinite-query";
import { useExampleMutation } from "@/examples/use-example-mutation";
import { useExampleQuery } from "@/examples/use-example-query";

const buttonClass = "rounded-lg bg-neutral-950 px-4 py-2 text-sm text-white disabled:opacity-50";

export const QueryExamples = () => (
  <section className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm md:col-span-2">
    <h2 className="text-lg font-semibold">Server state</h2>
    <p className="mt-2 text-sm text-neutral-600">
      Local demo data — resets on reload. Replace the demo API with your server requests.
    </p>
    <div className="mt-6 grid gap-6 md:grid-cols-3">
      <QueryExample />
      <MutationExample />
      <InfiniteQueryExample />
    </div>
  </section>
);

const QueryExample = () => {
  const query = useExampleQuery();
  return (
    <div className="space-y-3">
      <h3 className="font-medium">useQuery</h3>
      {query.isPending ? (
        <p role="status">Loading…</p>
      ) : query.isError ? (
        <p role="alert">{query.error.message}</p>
      ) : (
        <p>{query.data.length} items</p>
      )}
      <button
        type="button"
        className={buttonClass}
        disabled={query.isFetching}
        onClick={() => void query.refetch()}
      >
        Refresh
      </button>
    </div>
  );
};

const MutationExample = () => {
  const [label, setLabel] = useState("");
  const mutation = useExampleMutation();
  return (
    <form
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        mutation.mutate(label, { onSuccess: () => setLabel("") });
      }}
    >
      <h3 className="font-medium">useMutation</h3>
      <label className="grid gap-1 text-sm">
        Item label
        <input
          value={label}
          onChange={(event) => setLabel(event.target.value)}
          className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 outline-none focus:border-neutral-950 focus:ring-2 focus:ring-neutral-200"
        />
      </label>
      <button type="submit" className={buttonClass} disabled={mutation.isPending}>
        {mutation.isPending ? "Saving…" : "Add item"}
      </button>
      {mutation.isError && (
        <p role="alert" className="text-sm text-red-700">
          {mutation.error.message}
        </p>
      )}
      {mutation.isSuccess && (
        <p role="status" className="text-sm text-neutral-600">
          Saved; both queries refreshed.
        </p>
      )}
    </form>
  );
};

const InfiniteQueryExample = () => {
  const query = useExampleInfiniteQuery();
  return (
    <div className="space-y-3">
      <h3 className="font-medium">useInfiniteQuery</h3>
      {query.isPending && <p role="status">Loading…</p>}
      {query.isError && <p role="alert">{query.error.message}</p>}
      <ul className="space-y-1 text-sm">
        {query.data?.pages
          .flatMap((page) => page.items)
          .map((item) => (
            <li key={item.id}>{item.label}</li>
          ))}
      </ul>
      <button
        type="button"
        className={buttonClass}
        disabled={!query.hasNextPage || query.isFetching}
        onClick={() => void query.fetchNextPage()}
      >
        {query.isFetchingNextPage ? "Loading…" : query.hasNextPage ? "Load more" : "All loaded"}
      </button>
      {query.isError && (
        <button
          type="button"
          className={buttonClass}
          disabled={query.isFetching}
          onClick={() => void query.refetch()}
        >
          Retry
        </button>
      )}
    </div>
  );
};

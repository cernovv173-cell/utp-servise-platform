// Local demo data, not a backend. Replace these functions with requestJson calls for your API.
export type ExampleItem = { id: number; label: string };
export type ExamplePage = { items: ExampleItem[]; nextCursor: number | undefined };
let items: ExampleItem[] = Array.from({ length: 6 }, (_, index) => ({
  id: index + 1,
  label: `Example ${index + 1}`,
}));

export const readExamples = async (signal?: AbortSignal): Promise<ExampleItem[]> => {
  await Promise.resolve();
  signal?.throwIfAborted();
  return [...items];
};

export const addExample = async (label: string): Promise<ExampleItem> => {
  if (!label.trim()) throw new Error("Укажите название.");
  const item = { id: items.length + 1, label: label.trim() };
  items = [...items, item];
  return item;
};

export const readExamplePage = async (
  cursor: number,
  signal?: AbortSignal,
): Promise<ExamplePage> => {
  const all = await readExamples(signal);
  const end = cursor + 3;
  return { items: all.slice(cursor, end), nextCursor: end < all.length ? end : undefined };
};

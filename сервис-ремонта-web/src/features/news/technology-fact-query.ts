import { getNews } from "@/lib/api";

const lastShownFactKey = "utp-servise:last-shown-technology-fact";

const readLastShownFactId = (): string | undefined => {
  try {
    return window.sessionStorage.getItem(lastShownFactKey) ?? undefined;
  } catch {
    return undefined;
  }
};

const rememberShownFactId = (factId: string): void => {
  try {
    window.sessionStorage.setItem(lastShownFactKey, factId);
  } catch {
    // Keep the news feed usable when browser storage is unavailable.
  }
};

export const getNewsWithNextTechnologyFact = async (token: string, signal?: AbortSignal) => {
  const news = await getNews(token, signal, readLastShownFactId());
  if (news.technologyFact?.id) rememberShownFactId(news.technologyFact.id);
  return news;
};

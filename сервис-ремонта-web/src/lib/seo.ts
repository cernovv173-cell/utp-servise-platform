export const SITE_URL = "https://xn----dtbhbq0ahshee.xn--p1ai";
export const SITE_NAME = "ЕНОТ СЕРВИС";
export const DEFAULT_SOCIAL_IMAGE = `${SITE_URL}/images/enot-brand-logo.jpg`;

export const DEFAULT_TITLE = "Ремонт компьютеров и ноутбуков в Пушкино — ЕНОТ СЕРВИС";
export const DEFAULT_DESCRIPTION =
  "Ремонт ноутбуков, компьютеров и телефонов в Пушкино с 2008 года. Диагностика, смета до начала работ, гарантия и документы. Ежедневно 8:30–21:30.";

type PageHeadOptions = {
  title: string;
  description: string;
  path: string;
  noindex?: boolean;
};

export const createPageHead = ({ title, description, path, noindex = false }: PageHeadOptions) => {
  const canonicalUrl = `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;

  return {
    meta: [
      { title },
      { name: "description", content: description },
      ...(noindex ? [{ name: "robots", content: "noindex, nofollow" }] : []),
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: SITE_NAME },
      { property: "og:locale", content: "ru_RU" },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:url", content: canonicalUrl },
      { property: "og:image", content: DEFAULT_SOCIAL_IMAGE },
      { property: "og:image:alt", content: "Новый логотип ЕНОТ СЕРВИС с енотом-мастером" },
    ],
    links: [{ rel: "canonical", href: canonicalUrl }],
  };
};

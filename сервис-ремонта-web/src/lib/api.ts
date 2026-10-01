import { requestJson } from "@/lib/request-json";

const apiBase =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/u, "") ?? "";

export type Role = "CUSTOMER" | "TECHNICIAN" | "ADMIN";

export type User = {
  id: string;
  email: string;
  displayName: string;
  phoneNumber?: string | null;
  role: Role;
  mustChangePassword: boolean;
};

export type AuthResponse = {
  accessToken: string;
  expiresAt: string;
  user: User;
};

export type RepairOrder = {
  id: string;
  deviceType: string;
  problem: string;
  address: string;
  status: string;
  preferredAt: string | null;
  createdAt: string;
  items: { id: string; name: string; quantity: number; unitPriceRub: number }[];
  review?: { id: string } | null;
};

export type NewsArticle = {
  id: string;
  title: string;
  content: string;
  isPublished: boolean;
  publishedAt: string | null;
  startsAt: string | null;
  endsAt: string | null;
  isFeatured: boolean;
};

export type Review = {
  id: string;
  rating: number;
  comment: string;
  createdAt: string;
  customer?: { displayName: string };
  order: { deviceType: string; problem: string };
};

export type CompanyInfo = {
  name: string;
  description: string;
  history: string;
  services: string[];
  phone: string;
  email: string;
  address: string;
  hours: string;
  socials: { label: string; url: string }[];
  requisites: string;
  mediaUrls: string[];
};

export const apiRequest = <T>(path: string, token?: string | null, init: RequestInit = {}) => {
  const headers = new Headers(init.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  return requestJson<T>(`${apiBase}${path}`, { ...init, headers });
};

export const loginRequest = (email: string, password: string, portal: Role) =>
  apiRequest<AuthResponse>("/auth/login", null, {
    method: "POST",
    body: JSON.stringify({ email, password, portal }),
  });

export const registerRequest = (
  displayName: string,
  email: string,
  phoneNumber: string,
  password: string,
) =>
  apiRequest<AuthResponse>("/auth/register", null, {
    method: "POST",
    body: JSON.stringify({ displayName, email, phoneNumber: phoneNumber || undefined, password }),
  });

export const getOrders = (token: string, signal?: AbortSignal) =>
  apiRequest<{ orders: RepairOrder[] }>("/orders", token, { signal });

export const createOrder = (
  token: string,
  input: { deviceType: string; problem: string; address: string },
) =>
  apiRequest<{ order: RepairOrder }>("/orders", token, {
    method: "POST",
    body: JSON.stringify(input),
  });

export const getNews = (token: string, signal?: AbortSignal) =>
  apiRequest<{ articles: NewsArticle[] }>("/news", token, { signal });

export const createNews = (
  token: string,
  input: Partial<NewsArticle> & Pick<NewsArticle, "title" | "content">,
) =>
  apiRequest<{ article: NewsArticle }>("/news", token, {
    method: "POST",
    body: JSON.stringify(input),
  });

export const updateNews = (token: string, id: string, input: Partial<NewsArticle>) =>
  apiRequest<{ article: NewsArticle }>(`/news/${id}`, token, {
    method: "PATCH",
    body: JSON.stringify(input),
  });

export const getReviews = (token: string, signal?: AbortSignal) =>
  apiRequest<{ reviews: Review[] }>("/reviews", token, { signal });

export const getCompany = (signal?: AbortSignal) =>
  apiRequest<{ company: CompanyInfo }>("/about", null, { signal });

export const updateCompany = (token: string, company: CompanyInfo) =>
  apiRequest<{ company: CompanyInfo }>("/about", token, {
    method: "PUT",
    body: JSON.stringify(company),
  });

export const updateProfile = (token: string, phoneNumber: string) =>
  apiRequest<{ user: User }>("/auth/profile", token, {
    method: "PATCH",
    body: JSON.stringify({ phoneNumber: phoneNumber || null }),
  });

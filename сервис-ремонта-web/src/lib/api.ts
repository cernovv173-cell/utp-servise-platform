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
  serviceNumber: string;
  deviceType: string;
  problem: string;
  address: string;
  status: string;
  preferredAt: string | null;
  expectedCompletionAt: string | null;
  redeemBonuses: boolean;
  bonusDiscountRub: number;
  createdAt: string;
  items: { id: string; name: string; quantity: number; unitPriceRub: number }[];
  review?: { id: string } | null;
  receipt?: RepairReceipt | null;
  assignedTechnicianId?: string | null;
  assignedTechnician?: { id: string; displayName: string } | null;
  customer?: { id: string; displayName: string; email: string };
};

export type StaffMember = {
  id: string;
  displayName: string;
  email: string;
  active: boolean;
  role: string;
};

export type RepairReceipt = {
  receiptNumber: string;
  issuedAt: string;
  totalRub: number;
  bonusDiscountRub: number;
  itemsSnapshot: { name: string; quantity: number; unitPriceRub: number; totalRub: number }[];
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
  imageObjectId?: string | null;
};

export type Review = {
  id: string;
  rating: number;
  comment: string;
  createdAt: string;
  customer?: { displayName: string };
  order: { deviceType: string; problem: string };
  isPublished: boolean;
};

export type CraftItem = {
  id: string;
  title: string;
  description: string;
  priceRub: number;
  imageObjectId: string | null;
  isPublished: boolean;
  customOrderAvailable: boolean;
};

export type CraftOrder = {
  id: string;
  itemTitleSnapshot: string;
  unitPriceRubSnapshot: number;
  quotedPriceRub: number | null;
  quantity: number;
  note: string;
  isCustomOrder: boolean;
  status: "REQUESTED" | "ACCEPTED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
  createdAt: string;
  customer?: { id: string; displayName: string; email: string; phoneNumber: string | null };
};

export type LoyaltyTransaction = {
  id: string;
  type: "EARN" | "REDEEM" | "MANUAL_ADJUSTMENT";
  points: number;
  reason: string;
  createdAt: string;
  order?: { serviceNumber: string } | null;
};
export type LoyaltyCustomer = {
  customer: { id: string; displayName: string; email: string };
  balance: number;
  transactions: LoyaltyTransaction[];
};

export type SiteBanner = {
  id: string;
  title: string;
  content: string;
  imageObjectId: string | null;
  targetUrl: string | null;
  startsAt: string | null;
  endsAt: string | null;
  isActive: boolean;
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

export const setExpectedCompletion = (
  token: string,
  orderId: string,
  expectedCompletionAt: string | null,
) =>
  apiRequest<{ order: RepairOrder }>(`/orders/${orderId}/expected-completion`, token, {
    method: "PATCH",
    body: JSON.stringify({ expectedCompletionAt }),
  });

export const searchOrders = (token: string, serviceNumber: string) =>
  apiRequest<{ orders: RepairOrder[] }>(
    `/orders/search?serviceNumber=${encodeURIComponent(serviceNumber)}`,
    token,
  );

export const getStaff = (token: string, signal?: AbortSignal) =>
  apiRequest<{ staff: StaffMember[] }>("/staff", token, { signal });

export const assignOrder = (token: string, orderId: string, technicianId: string) =>
  apiRequest<{ order: RepairOrder }>(`/orders/${orderId}/assign`, token, {
    method: "PATCH",
    body: JSON.stringify({ technicianId }),
  });

export const updateOrderStatus = (token: string, orderId: string, status: string) =>
  apiRequest<{ order: RepairOrder }>(`/orders/${orderId}/status`, token, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });

export const requestBonusRedemption = (token: string, orderId: string, redeemBonuses: boolean) =>
  apiRequest<{ order: RepairOrder }>(`/orders/${orderId}/bonus-redemption`, token, {
    method: "PATCH",
    body: JSON.stringify({ redeemBonuses }),
  });

export const createRepairReceipt = (token: string, orderId: string) =>
  apiRequest<{ receipt: RepairReceipt }>(`/orders/${orderId}/receipt`, token, { method: "POST" });

export const getCraftItems = (token: string, signal?: AbortSignal) =>
  apiRequest<{ items: CraftItem[] }>("/craft-items", token, { signal });

export const createCraftOrder = (
  token: string,
  input: { itemId?: string | null; quantity: number; note: string; customTitle?: string },
) =>
  apiRequest<{ order: CraftOrder }>("/craft-orders", token, {
    method: "POST",
    body: JSON.stringify(input),
  });

export const getCraftOrders = (token: string, signal?: AbortSignal) =>
  apiRequest<{ orders: CraftOrder[] }>("/craft-orders", token, { signal });

export const updateCraftOrder = (
  token: string,
  id: string,
  data: { status?: CraftOrder["status"]; quotedPriceRub?: number | null },
) =>
  apiRequest<{ order: CraftOrder }>(`/craft-orders/${id}`, token, {
    method: "PATCH",
    body: JSON.stringify(data),
  });

export const createCraftItem = (token: string, item: Omit<CraftItem, "id" | "imageObjectId">) =>
  apiRequest<{ item: CraftItem }>("/craft-items", token, {
    method: "POST",
    body: JSON.stringify(item),
  });

export const updateCraftItem = (token: string, id: string, item: Partial<CraftItem>) =>
  apiRequest<{ item: CraftItem }>(`/craft-items/${id}`, token, {
    method: "PATCH",
    body: JSON.stringify(item),
  });

export const getLoyalty = (token: string, signal?: AbortSignal) =>
  apiRequest<{ balance: number; transactions: LoyaltyTransaction[] }>("/loyalty/me", token, {
    signal,
  });

export const getAdminLoyalty = (token: string, signal?: AbortSignal) =>
  apiRequest<{ customers: LoyaltyCustomer[] }>("/admin/loyalty", token, { signal });

export const getBanners = (token: string, signal?: AbortSignal) =>
  apiRequest<{ banners: SiteBanner[] }>("/banners", token, { signal });

export const createBanner = (token: string, banner: Omit<SiteBanner, "id" | "imageObjectId">) =>
  apiRequest<{ banner: SiteBanner }>("/banners", token, {
    method: "POST",
    body: JSON.stringify(banner),
  });

export const updateBanner = (token: string, id: string, banner: Partial<SiteBanner>) =>
  apiRequest<{ banner: SiteBanner }>(`/banners/${id}`, token, {
    method: "PATCH",
    body: JSON.stringify(banner),
  });

export const uploadAdminImage = async (path: string, token: string, file: File) => {
  const response = await fetch(`${apiBase}${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": file.type },
    body: file,
  });
  if (!response.ok) throw new Error(`Не удалось загрузить изображение (${response.status}).`);
  return response.json() as Promise<unknown>;
};

export const fetchProtectedMedia = async (
  token: string,
  objectId: string,
  signal?: AbortSignal,
) => {
  const response = await fetch(`${apiBase}/media/${encodeURIComponent(objectId)}`, {
    signal,
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error(`Не удалось загрузить изображение (${response.status}).`);
  return response.blob();
};

export const moderateReview = (token: string, reviewId: string, isPublished: boolean) =>
  apiRequest<{ review: Review }>(`/reviews/${reviewId}`, token, {
    method: "PATCH",
    body: JSON.stringify({ isPublished }),
  });

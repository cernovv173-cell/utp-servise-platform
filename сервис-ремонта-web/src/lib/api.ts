import { requestJson } from "@/lib/request-json";

const apiBase =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/u, "") ?? "";

export type Role = "CUSTOMER" | "TECHNICIAN" | "ADMIN";
export type OrderArchiveView = "active" | "archived";
export type RepairCatalogType = "SERVICE" | "SPARE_PART" | "PRODUCT";
export type RepairEstimate = {
  id: string;
  orderId: string;
  version: number;
  kind: "INITIAL" | "ADDITIONAL";
  status: "PENDING" | "APPROVED" | "DECLINED" | "SUPERSEDED";
  diagnosis: string;
  itemsSnapshot: {
    catalogItemId: string;
    type: RepairCatalogType;
    name: string;
    quantity: number;
    unitPriceRub: number;
  }[];
  totalRub: number;
  customerResponseNote: string | null;
  submittedAt: string;
  respondedAt: string | null;
  createdBy: { id: string; displayName: string } | null;
};

export type RepairOrderDeadlineChange = {
  id: string;
  previousExpectedAt: string | null;
  expectedCompletionAt: string | null;
  note: string | null;
  createdAt: string;
  actor: { id: string; displayName: string } | null;
};

export type User = {
  id: string;
  email: string;
  displayName: string;
  phoneNumber?: string | null;
  gender?: "MALE" | "FEMALE" | null;
  birthDate?: string | null;
  telegramLinked?: boolean;
  maxLinked?: boolean;
  maxAvailable?: boolean;
  role: Role;
  mustChangePassword: boolean;
};

export type AndroidApkInfo = {
  state: "available" | "legacy" | "deleted" | "unavailable";
  fileName: string | null;
  sizeBytes: number | null;
  sha256?: string | null;
  uploadedAt: string | null;
  pendingDeletionCount?: number;
};

export type SeasonalSeason = "SPRING" | "SUMMER" | "AUTUMN" | "WINTER";
export type SeasonalSeasonChoice = SeasonalSeason | "NONE";

export type SeasonalThemeState = {
  activeSeason: SeasonalSeasonChoice;
  calendarSeason: SeasonalSeason;
  seasonStartsOn: string;
  nextSeason: SeasonalSeason;
  nextSeasonStartsOn: string;
  activatedAt: string | null;
};

export type AuthResponse = {
  accessToken: string;
  expiresAt: string;
  accountCreated?: boolean;
  referralApplied?: boolean;
  user: User;
};

export type RepairOrder = {
  id: string;
  serviceNumber: string;
  deviceType: string;
  deviceBrand?: string | null;
  deviceModel?: string | null;
  deviceSerialNumber?: string | null;
  customerDeviceId?: string | null;
  priority?: "NORMAL" | "URGENT";
  problem: string;
  address: string;
  repairLocation?: RepairLocation | null;
  contactPhone: string | null;
  city: string | null;
  street: string | null;
  house: string | null;
  apartment: string | null;
  entrance: string | null;
  hasBarrier: boolean;
  floor: string | null;
  additionalPhone: string | null;
  additionalInfo: string | null;
  status: string;
  archivedAt: string | null;
  preferredAt: string | null;
  expectedCompletionAt: string | null;
  deadlineChanges?: RepairOrderDeadlineChange[];
  diagnosisCompletedAt?: string | null;
  redeemBonuses: boolean;
  bonusDiscountRub: number;
  createdAt: string;
  statusEvents?: {
    from: string | null;
    to: string;
    note: string | null;
    createdAt: string;
    actor: { id: string; displayName: string; role: Role } | null;
  }[];
  photos?: {
    id: string;
    objectId: string;
    createdAt: string;
    createdBy: { displayName: string } | null;
  }[];
  items: {
    id: string;
    type: RepairCatalogType;
    name: string;
    quantity: number;
    unitPriceRub: number;
  }[];
  estimates?: RepairEstimate[];
  review?: { id: string } | null;
  receipt?: RepairReceipt | null;
  intake?: RepairOrderIntake | null;
  warranty?: RepairWarranty | null;
  warrantyOriginOrder?: { id: string; serviceNumber: string } | null;
  assignedTechnicianId?: string | null;
  assignedTechnician?: {
    id: string;
    displayName: string;
    phoneNumber?: string | null;
    avatarObjectId?: string | null;
  } | null;
  customer?: {
    id: string;
    displayName: string;
    email: string;
    phoneNumber?: string | null;
    avatarObjectId?: string | null;
  };
};

export type RepairLocation = "CUSTOMER_ADDRESS" | "SERVICE_CENTER";

export type CustomerDevice = {
  id: string;
  deviceType: string;
  nickname: string | null;
  brand: string | null;
  model: string | null;
  serialNumber: string | null;
  nextMaintenanceAt: string | null;
  maintenanceNote: string | null;
  repairOrders?: {
    id: string;
    serviceNumber: string;
    deviceType: string;
    problem: string;
    status: string;
    createdAt: string;
    warranty: { warrantyNumber: string; expiresAt: string } | null;
    warrantyOriginOrder?: { id: string; serviceNumber: string } | null;
    receipt: { receiptNumber: string; issuedAt: string } | null;
  }[];
};

export type OperationsDashboard = {
  periodDays: number;
  activeOrders: number;
  overdueOrders: number;
  newOrders: number;
  completedOrders: number;
  averageRepairMinutes: number | null;
  collectedRub: number;
  popularWorks: { name: string; completedQuantity: number }[];
};

export type ProcurementItem = {
  id: string;
  name: string;
  stockQuantity: number;
  minimumStockQuantity: number;
  unitPriceRub: number;
  recommendedPurchase: number;
  activeEstimateQuantity: number;
};

export type ScheduledRepairOrder = Pick<
  RepairOrder,
  | "id"
  | "serviceNumber"
  | "deviceType"
  | "deviceBrand"
  | "deviceModel"
  | "problem"
  | "preferredAt"
  | "expectedCompletionAt"
  | "status"
  | "priority"
> & {
  city: string | null;
  street: string | null;
  house: string | null;
  customer: { displayName: string };
  assignedTechnician: { id: string; displayName: string } | null;
};

export type RepairOrderChatMessage = {
  id: string;
  chatId: string;
  senderId: string | null;
  content: string;
  imageObjectId: string | null;
  createdAt: string;
  sender: { id: string; displayName: string; role: Role } | null;
};

export type RepairOrderChat = {
  id: string | null;
  orderId: string;
  adminRequestedAt: string | null;
  adminRequestedBy: { id: string; displayName: string } | null;
  adminJoinedAt: string | null;
  joinedBy: { id: string; displayName: string } | null;
  messages: RepairOrderChatMessage[];
};

export type AdminRepairChatNotifications = {
  totalUnread: number;
  chats: {
    orderId: string;
    serviceNumber: string;
    customerName: string;
    lastMessageId: string;
    lastMessageAt: string;
    senderName: string;
    preview: string;
  }[];
};

export type SupportChatMessage = {
  id: string;
  senderId: string | null;
  content: string;
  createdAt: string;
  sender: { id: string; displayName: string; role: Role } | null;
};

export type SupportChat = {
  id: string | null;
  customerId: string;
  customer: {
    id: string;
    displayName: string;
    email: string;
    phoneNumber: string | null;
  };
  messages: SupportChatMessage[];
};

export type SupportChatInboxItem = {
  id: string;
  customer: { id: string; displayName: string; email: string };
  updatedAt: string;
  messages: Array<{
    id: string;
    senderId: string;
    content: string;
    createdAt: string;
    sender: { displayName: string; role: Role } | null;
  }>;
};

export type RepairOrderIntake = {
  id: string;
  orderId: string;
  frontCondition: string;
  frontPhotoObjectId: string | null;
  backCondition: string;
  backPhotoObjectId: string | null;
  leftCondition: string;
  leftPhotoObjectId: string | null;
  rightCondition: string;
  rightPhotoObjectId: string | null;
  serialNumber: string | null;
  includedAccessories: string;
  intakeNotes: string;
  createdAt: string;
  updatedAt: string;
};

export type RepairWarranty = {
  id: string;
  orderId: string;
  warrantyNumber: string;
  customerName: string;
  deviceType: string;
  repairSummary: string;
  warrantyDays: number;
  terms: string;
  issuedAt: string;
  expiresAt: string;
};

export type StaffMember = {
  id: string;
  displayName: string;
  email: string;
  salaryRatePercent: number;
  active: boolean;
  role: string;
};

export type RepairReceipt = {
  id: string;
  receiptNumber: string;
  serviceNumber: string;
  customerName: string;
  customerPhone: string | null;
  issuedAt: string;
  totalRub: number;
  bonusDiscountRub: number;
  paymentStatus: "PENDING" | "PAID";
  paymentMethod: "CASH" | "CARD_TERMINAL" | "BANK_TRANSFER" | "OTHER" | null;
  paidAt: string | null;
  itemsSnapshot: { name: string; quantity: number; unitPriceRub: number; totalRub: number }[];
};

export type ReceiptDraft = {
  itemQuantities: { itemId: string; quantity: number }[];
  freeSaleItems: {
    type: RepairCatalogType;
    name: string;
    quantity: number;
    unitPriceRub: number;
  }[];
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

export type PersonalBirthdayGreeting = {
  title: string;
  content: string;
  startsAt: string;
  endsAt: string;
};

export type TechnologyFact = {
  id: string;
  title: string;
  content: string;
  sourceName: string;
  sourceUrl: string;
  updatedAt: string;
  nextUpdateAt: string;
};

export type RepairCatalogItem = {
  id: string;
  type: RepairCatalogType;
  name: string;
  description: string | null;
  imageObjectIds: string[];
  unitPriceRub: number;
  stockQuantity: number | null;
  minimumStockQuantity: number | null;
  active: boolean;
};

export type ShopProductAvailability = "IN_STOCK" | "OUT_OF_STOCK" | "ADMIN_CONFIRMATION_REQUIRED";

export type ShopProduct = {
  id: string;
  name: string;
  description: string | null;
  imageObjectIds: string[];
  unitPriceRub: number;
  availability: ShopProductAvailability;
};

export type ShopOrderStatus = "PENDING" | "CONFIRMED" | "COMPLETED" | "CANCELLED";

export type ShopOrderItem = {
  id: string;
  catalogItemId: string | null;
  name: string;
  quantity: number;
  unitPriceRub: number;
  stockDeducted: boolean;
};

export type ShopOrder = {
  id: string;
  status: ShopOrderStatus;
  customerNote: string | null;
  totalRub: number;
  confirmedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  items: ShopOrderItem[];
  customer?: {
    id: string;
    displayName: string;
    email: string;
    phoneNumber: string | null;
  };
};

export type CustomerServicePrice = Pick<RepairCatalogItem, "id" | "name" | "unitPriceRub">;

export type AdminCustomer = {
  id: string;
  email: string;
  displayName: string;
  phoneNumber: string | null;
  active: boolean;
  createdAt: string;
};

export type AdminCustomerPage = {
  customers: AdminCustomer[];
  pagination: { page: number; totalPages: number; totalItems: number };
};

export type NewAdminCustomer = {
  customer: AdminCustomer;
  temporaryPassword: string;
};

export type Review = {
  id: string;
  rating: number;
  comment: string;
  createdAt: string;
  customer?: { displayName: string };
  order: { deviceType: string; problem: string };
  isPublished: boolean;
  imageObjectId?: string | null;
  clientPhotoObjectId?: string | null;
  clientPhotoConsentAt?: string | null;
  workPhotoObjectId?: string | null;
};

export type PublicReview = {
  id: string;
  rating: number;
  comment: string;
  createdAt: string;
  customer: { displayName: string };
  order: { deviceType: string };
  hasClientPhoto: boolean;
  hasWorkPhoto: boolean;
};

export type ReviewShowcaseImageKind = "client" | "work";

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
  serviceNumber: string | null;
  redeemBonuses: boolean;
  bonusDiscountRub: number;
  status: "REQUESTED" | "ACCEPTED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
  createdAt: string;
  assignedTechnicianId: string | null;
  assignedTechnician?: { id: string; displayName: string; salaryRatePercent?: number } | null;
  receipt?: CraftOrderReceipt | null;
  salaryEntry?: { serviceTotalRub: number; salaryRub: number; ratePercent: number } | null;
  customer?: { id: string; displayName: string; email: string; phoneNumber: string | null };
};

export type CraftOrderReceipt = {
  id: string;
  receiptNumber: string;
  serviceNumber: string;
  totalRub: number;
  bonusDiscountRub: number;
  paymentStatus: "PENDING" | "PAID";
  paymentMethod: "CASH" | "CARD_TERMINAL" | "BANK_TRANSFER" | "OTHER" | null;
  paidAt: string | null;
  issuedAt: string;
  itemsSnapshot: { name: string; quantity: number; unitPriceRub: number; totalRub: number }[];
};

export type CraftOrderChatMessage = {
  id: string;
  craftOrderId: string;
  senderId: string | null;
  content: string;
  imageObjectId: string | null;
  createdAt: string;
  sender: { id: string; displayName: string; role: Role } | null;
};

export type CraftOrderChat = {
  id: string;
  craftOrderId: string;
  messages: CraftOrderChatMessage[];
};

export type LoyaltyTransaction = {
  id: string;
  type: "EARN" | "REDEEM" | "MANUAL_ADJUSTMENT" | "GAME_REWARD" | "REFERRAL_REWARD";
  points: number;
  reason: string;
  createdAt: string;
  order?: { serviceNumber: string } | null;
};
export type ReferralProgram = {
  referralCode: string;
  totalInvites: number;
  pendingCount: number;
  rewardedCount: number;
  referrals: Array<{
    id: string;
    status: "PENDING" | "REWARDED";
    createdAt: string;
    rewardedAt: string | null;
  }>;
};
export type LoyaltyCustomer = {
  customer: { id: string; displayName: string; email: string };
  balance: number;
  transactions: LoyaltyTransaction[];
};

export type SalaryPeriodName = "day" | "week" | "month";
export type SalarySummary = {
  ratePercent: number | null;
  timeZone: string;
  generatedAt: string;
  ranges: Record<SalaryPeriodName, { startsAt: string; endsAt: string }>;
  totals: Record<SalaryPeriodName, number>;
  technicians: Array<{
    id: string;
    displayName: string;
    salaryRatePercent: number;
    amounts: Record<SalaryPeriodName, number>;
  }>;
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
  placements: ("HOME" | "NEWS" | "SERVICE" | "CRAFTS" | "ABOUT" | "LOYALTY")[];
};

export type CustomerOfferType = "PROMOTION" | "GIVEAWAY";

export type CustomerOfferReward = {
  prize: string | null;
  bonusPoints: number;
};

export type CustomerOfferWinner = CustomerOfferReward & {
  place: number;
  displayName: string;
  customerId?: string;
};

export type CustomerOffer = {
  id: string;
  type: CustomerOfferType;
  title: string;
  content: string;
  firstPlacePrize: string | null;
  firstPlacePoints: number;
  secondPlacePrize: string | null;
  secondPlacePoints: number;
  thirdPlacePrize: string | null;
  thirdPlacePoints: number;
  isPublished: boolean;
  startsAt: string;
  endsAt: string;
  drawnAt: string | null;
  resultsPublishedAt: string | null;
  createdAt: string;
  participantCount: number;
  myParticipation: { id: string; joinedAt: string; place: number | null } | null;
  winners: CustomerOfferWinner[];
};

export type AdminCustomerOffer = Omit<CustomerOffer, "myParticipation">;

export type CreateCustomerOfferInput = {
  type: CustomerOfferType;
  title: string;
  content: string;
  firstPlacePrize: string | null;
  firstPlacePoints: number;
  secondPlacePrize: string | null;
  secondPlacePoints: number;
  thirdPlacePrize: string | null;
  thirdPlacePoints: number;
  startsAt: string;
  endsAt: string;
  isPublished: boolean;
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

export class ApiRequestError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiRequestError";
  }
}

export const yandexLoginRequest = async (
  accessToken: string,
  portal: Role,
  password?: string,
  referralCode?: string,
): Promise<AuthResponse> => {
  const normalizedReferralCode = referralCode?.trim().toUpperCase();
  const response = await fetch(`${apiBase}/auth/yandex`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      accessToken,
      portal,
      ...(password ? { password } : {}),
      ...(normalizedReferralCode ? { referralCode: normalizedReferralCode } : {}),
    }),
  });
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const error =
      typeof body === "object" && body !== null && "error" in body
        ? (body as { error?: { code?: unknown; message?: unknown } }).error
        : undefined;
    throw new ApiRequestError(
      typeof error?.code === "string" ? error.code : "REQUEST_FAILED",
      response.status,
      typeof error?.message === "string" ? error.message : "Не удалось войти через Яндекс ID.",
    );
  }
  return body as AuthResponse;
};

export const requestPasswordReset = (email: string) =>
  apiRequest<{ message: string }>("/auth/password-reset/request", null, {
    method: "POST",
    body: JSON.stringify({ email }),
  });

export const confirmPasswordReset = (token: string, newPassword: string) =>
  apiRequest<{ message: string }>("/auth/password-reset/confirm", null, {
    method: "POST",
    body: JSON.stringify({ token, newPassword }),
  });

export const registerRequest = (
  displayName: string,
  email: string,
  phoneNumber: string,
  password: string,
  referralCode?: string,
) =>
  apiRequest<AuthResponse>("/auth/register", null, {
    method: "POST",
    body: JSON.stringify({
      displayName,
      email,
      phoneNumber: phoneNumber || undefined,
      password,
      referralCode: referralCode?.trim() || undefined,
    }),
  });

export const getOrders = (token: string, signal?: AbortSignal, archive?: OrderArchiveView) =>
  apiRequest<{ orders: RepairOrder[] }>(`/orders${archive ? `?archive=${archive}` : ""}`, token, {
    signal,
  });

export const getCustomerDevices = (token: string, signal?: AbortSignal) =>
  apiRequest<{ devices: CustomerDevice[] }>("/customer/devices", token, { signal });

export type CustomerDeviceInput = Pick<CustomerDevice, "deviceType"> &
  Partial<
    Pick<
      CustomerDevice,
      "nickname" | "brand" | "model" | "serialNumber" | "nextMaintenanceAt" | "maintenanceNote"
    >
  >;

export const createCustomerDevice = (token: string, input: CustomerDeviceInput) =>
  apiRequest<{ device: CustomerDevice }>("/customer/devices", token, {
    method: "POST",
    body: JSON.stringify(input),
  });

export const updateCustomerDevice = (
  token: string,
  deviceId: string,
  input: Partial<CustomerDeviceInput>,
) =>
  apiRequest<{ device: CustomerDevice }>(`/customer/devices/${deviceId}`, token, {
    method: "PATCH",
    body: JSON.stringify(input),
  });

export const deleteCustomerDevice = (token: string, deviceId: string) =>
  apiRequest<void>(`/customer/devices/${deviceId}`, token, { method: "DELETE" });

export const createWarrantyClaim = (token: string, originalOrderId: string, problem: string) =>
  apiRequest<{ order: RepairOrder }>(`/orders/${originalOrderId}/warranty-claims`, token, {
    method: "POST",
    body: JSON.stringify({ problem }),
  });

export const getAdminRepairOrder = (token: string, orderId: string, signal?: AbortSignal) =>
  apiRequest<{ order: RepairOrder }>(`/admin/orders/${orderId}`, token, { signal });

export const getOperationsDashboard = (token: string, signal?: AbortSignal) =>
  apiRequest<OperationsDashboard>("/admin/operations/dashboard", token, { signal });

export const getProcurementList = (token: string, signal?: AbortSignal) =>
  apiRequest<{ items: ProcurementItem[] }>("/admin/operations/procurement", token, {
    signal,
  });

export const getRepairSchedule = (token: string, from: string, to: string, signal?: AbortSignal) =>
  apiRequest<{ orders: ScheduledRepairOrder[] }>(
    `/admin/operations/calendar?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
    token,
    { signal },
  );

export const updateRepairPriority = (
  token: string,
  orderId: string,
  priority: "NORMAL" | "URGENT",
) =>
  apiRequest<{ order: { id: string; priority: "NORMAL" | "URGENT" } }>(
    `/admin/operations/orders/${orderId}/priority`,
    token,
    { method: "PATCH", body: JSON.stringify({ priority }) },
  );

export const createOrder = (
  token: string,
  input: {
    deviceType: string;
    customerDeviceId?: string;
    deviceBrand?: string;
    deviceModel?: string;
    deviceSerialNumber?: string;
    problem: string;
    contactPhone: string;
    city?: string;
    street?: string;
    house?: string;
    apartment?: string;
    entrance?: string;
    hasBarrier?: boolean;
    floor?: string;
    additionalPhone?: string;
    additionalInfo?: string;
    preferredAt?: string | null;
  },
) =>
  apiRequest<{ order: RepairOrder }>("/orders", token, {
    method: "POST",
    body: JSON.stringify(input),
  });

export const createAdminOrder = (
  token: string,
  input: {
    customerId: string;
    deviceType: string;
    repairLocation: RepairLocation;
    deviceBrand?: string;
    deviceModel?: string;
    deviceSerialNumber?: string;
    problem: string;
    contactPhone?: string;
    city?: string;
    street?: string;
    house?: string;
    apartment?: string;
    entrance?: string;
    hasBarrier?: boolean;
    floor?: string;
    additionalPhone?: string;
    additionalInfo?: string;
    preferredAt?: string | null;
  },
) =>
  apiRequest<{ order: RepairOrder }>("/admin/orders", token, {
    method: "POST",
    body: JSON.stringify(input),
  });

export const updateRepairOrder = (
  token: string,
  orderId: string,
  input: Partial<
    Pick<
      RepairOrder,
      | "deviceType"
      | "deviceBrand"
      | "deviceModel"
      | "deviceSerialNumber"
      | "problem"
      | "contactPhone"
      | "city"
      | "street"
      | "house"
      | "apartment"
      | "entrance"
      | "hasBarrier"
      | "floor"
      | "additionalPhone"
      | "additionalInfo"
      | "preferredAt"
    >
  >,
) =>
  apiRequest<{ order: RepairOrder }>(`/orders/${orderId}`, token, {
    method: "PATCH",
    body: JSON.stringify(input),
  });

export const uploadRepairOrderPhoto = (token: string, orderId: string, file: File) =>
  apiRequest<{ photo: NonNullable<RepairOrder["photos"]>[number] }>(
    `/orders/${orderId}/photos`,
    token,
    {
      method: "POST",
      headers: { "Content-Type": file.type || "image/jpeg" },
      body: file,
    },
  );

export const createRepairOrderReview = (
  token: string,
  input: { orderId: string; rating: number; comment: string },
) =>
  apiRequest<{ review: { id: string } }>("/reviews", token, {
    method: "POST",
    body: JSON.stringify(input),
  });

export const uploadRepairOrderReviewPhoto = (token: string, reviewId: string, file: File) =>
  apiRequest<{ review: { id: string } }>(`/reviews/${reviewId}/image`, token, {
    method: "POST",
    headers: { "Content-Type": file.type || "image/jpeg" },
    body: file,
  });

export const addRepairOrderItem = (
  token: string,
  orderId: string,
  catalogItemId: string,
  quantity: number,
) =>
  apiRequest<{ order: RepairOrder }>(`/orders/${orderId}/items`, token, {
    method: "POST",
    body: JSON.stringify({ catalogItemId, quantity }),
  });

export const submitRepairEstimate = (
  token: string,
  orderId: string,
  input: {
    diagnosis: string;
    items: { catalogItemId: string; quantity: number }[];
  },
) =>
  apiRequest<{ estimate: RepairEstimate }>(`/orders/${orderId}/estimates`, token, {
    method: "POST",
    body: JSON.stringify(input),
  });

export const respondToRepairEstimate = (
  token: string,
  orderId: string,
  estimateId: string,
  decision: "APPROVED" | "DECLINED",
  note?: string,
) =>
  apiRequest<{ estimate: RepairEstimate }>(
    `/orders/${orderId}/estimates/${estimateId}/response`,
    token,
    { method: "PATCH", body: JSON.stringify({ decision, note }) },
  );

export const updateRepairOrderItemQuantity = (
  token: string,
  orderId: string,
  itemId: string,
  quantity: number,
) =>
  apiRequest<{ order: RepairOrder }>(`/orders/${orderId}/items/${itemId}`, token, {
    method: "PATCH",
    body: JSON.stringify({ quantity }),
  });

export const removeRepairOrderItem = (token: string, orderId: string, itemId: string) =>
  apiRequest<{ order: RepairOrder }>(`/orders/${orderId}/items/${itemId}`, token, {
    method: "DELETE",
  });

export const getNews = (token: string, signal?: AbortSignal) =>
  apiRequest<{
    articles: NewsArticle[];
    reviews: Review[];
    birthdayGreeting: PersonalBirthdayGreeting | null;
    technologyFact: TechnologyFact;
  }>("/news", token, { signal });

export const getRepairCatalog = (token: string, signal?: AbortSignal) =>
  apiRequest<{ catalogItems: RepairCatalogItem[] }>("/catalog", token, { signal });

export const getShopProducts = (signal?: AbortSignal) =>
  apiRequest<{ products: ShopProduct[] }>("/shop/products", null, { signal });

export const getShopProductImageUrl = (productId: string, objectId: string) =>
  `${apiBase}/shop/products/${encodeURIComponent(productId)}/images/${encodeURIComponent(objectId)}`;

export const getMyShopOrders = (token: string, signal?: AbortSignal) =>
  apiRequest<{ orders: ShopOrder[] }>("/shop/orders", token, { signal });

export const getAdminShopOrders = (token: string, signal?: AbortSignal) =>
  apiRequest<{ orders: ShopOrder[] }>("/admin/shop/orders", token, { signal });

export const createShopOrder = (
  token: string,
  items: { catalogItemId: string; quantity: number }[],
  customerNote: string,
) =>
  apiRequest<{ order: ShopOrder }>("/shop/orders", token, {
    method: "POST",
    body: JSON.stringify({ items, customerNote }),
  });

export const updateShopOrderStatus = (
  token: string,
  orderId: string,
  status: Extract<ShopOrderStatus, "CONFIRMED" | "COMPLETED" | "CANCELLED">,
) =>
  apiRequest<{ order: ShopOrder }>(`/admin/shop/orders/${orderId}/status`, token, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });

export const getCustomerServicePrices = (token: string, signal?: AbortSignal) =>
  apiRequest<{ prices: CustomerServicePrice[] }>("/customer/service-prices", token, {
    signal,
  });

export const getAdminCustomers = (
  token: string,
  search = "",
  page = 1,
  pageSize = 20,
  signal?: AbortSignal,
) =>
  apiRequest<AdminCustomerPage>(
    `/admin/customers?search=${encodeURIComponent(search)}&page=${page}&pageSize=${pageSize}`,
    token,
    { signal },
  );

export const uploadIntakePhoto = (
  token: string,
  orderId: string,
  side: "front" | "back" | "left" | "right",
  file: File,
) =>
  apiRequest<{ intake: RepairOrderIntake }>(`/orders/${orderId}/intake-photos/${side}`, token, {
    method: "POST",
    headers: { "Content-Type": file.type || "image/jpeg" },
    body: file,
  });

export const saveOrderIntake = (
  token: string,
  orderId: string,
  input: Pick<
    RepairOrderIntake,
    | "frontCondition"
    | "backCondition"
    | "leftCondition"
    | "rightCondition"
    | "serialNumber"
    | "includedAccessories"
    | "intakeNotes"
  >,
) =>
  apiRequest<{ intake: RepairOrderIntake }>(`/orders/${orderId}/intake`, token, {
    method: "PUT",
    body: JSON.stringify(input),
  });

export const createOrderPickupCode = (token: string, orderId: string) =>
  apiRequest<{ qrPayload: string; fallbackPin: string; expiresAt: string }>(
    `/orders/${orderId}/pickup-code`,
    token,
    { method: "POST" },
  );

export const closeOrderByQr = (
  token: string,
  input: { qrPayload: string } | { serviceNumber: string; pickupPin: string },
) =>
  apiRequest<{ order: RepairOrder; warranty: RepairWarranty }>("/orders/close-by-qr", token, {
    method: "POST",
    body: JSON.stringify(input),
  });

export const createAdminCustomer = (
  token: string,
  input: { email: string; displayName: string; phoneNumber?: string },
) =>
  apiRequest<NewAdminCustomer>("/admin/customers", token, {
    method: "POST",
    body: JSON.stringify(input),
  });

export const updateAdminCustomer = (
  token: string,
  customerId: string,
  input: { email: string; displayName: string; phoneNumber?: string | null },
) =>
  apiRequest<{ customer: AdminCustomer }>(`/admin/customers/${customerId}`, token, {
    method: "PATCH",
    body: JSON.stringify(input),
  });

export const deleteAdminCustomer = (token: string, customerId: string) =>
  apiRequest<{
    customer: Pick<AdminCustomer, "id" | "email" | "displayName">;
  }>(`/admin/customers/${customerId}`, token, { method: "DELETE" });

export const createRepairCatalogItem = (
  token: string,
  input: Pick<RepairCatalogItem, "type" | "name" | "unitPriceRub"> & {
    description?: string | null;
    stockQuantity?: number;
    minimumStockQuantity?: number;
  },
) =>
  apiRequest<{ catalogItem: RepairCatalogItem }>("/catalog", token, {
    method: "POST",
    body: JSON.stringify(input),
  });

export const updateRepairCatalogItem = (
  token: string,
  id: string,
  input: Partial<
    Pick<
      RepairCatalogItem,
      | "type"
      | "name"
      | "description"
      | "unitPriceRub"
      | "stockQuantity"
      | "minimumStockQuantity"
      | "active"
    >
  >,
) =>
  apiRequest<{ catalogItem: RepairCatalogItem }>(`/catalog/${id}`, token, {
    method: "PATCH",
    body: JSON.stringify(input),
  });

export const uploadCatalogProductImage = (token: string, catalogItemId: string, file: File) =>
  uploadAdminImage(`/catalog/${catalogItemId}/images`, token, file);

export const deleteCatalogProductImage = (token: string, catalogItemId: string, objectId: string) =>
  apiRequest<{ catalogItem: RepairCatalogItem }>(
    `/catalog/${catalogItemId}/images/${encodeURIComponent(objectId)}`,
    token,
    { method: "DELETE" },
  );

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

export const getPublicReviews = (signal?: AbortSignal) =>
  apiRequest<{ reviews: PublicReview[] }>("/public/reviews", null, { signal });

export const getPublicReviewImageUrl = (reviewId: string, kind: ReviewShowcaseImageKind) =>
  `${apiBase || "/api"}/public/reviews/${reviewId}/image/${kind}`;

export const uploadReviewShowcaseImage = (
  token: string,
  reviewId: string,
  kind: ReviewShowcaseImageKind,
  file: File,
  clientPhotoConsent: boolean,
) =>
  apiRequest<{ review: Review }>(
    `/admin/reviews/${reviewId}/showcase-image/${kind}${
      kind === "client" ? `?clientPhotoConsent=${clientPhotoConsent}` : ""
    }`,
    token,
    {
      method: "POST",
      headers: { "Content-Type": file.type || "image/jpeg" },
      body: file,
    },
  );

export const deleteReviewShowcaseImage = (
  token: string,
  reviewId: string,
  kind: ReviewShowcaseImageKind,
) =>
  apiRequest<{ review: Review }>(`/admin/reviews/${reviewId}/showcase-image/${kind}`, token, {
    method: "DELETE",
  });

export const getCompany = (signal?: AbortSignal) =>
  apiRequest<{ company: CompanyInfo }>("/about", null, { signal });

export const updateCompany = (token: string, company: CompanyInfo) =>
  apiRequest<{ company: CompanyInfo }>("/about", token, {
    method: "PUT",
    body: JSON.stringify(company),
  });

export const updateProfile = (
  token: string,
  phoneNumber: string,
  gender?: "MALE" | "FEMALE" | null,
  birthDate?: string | null,
) =>
  apiRequest<{ user: User }>("/auth/profile", token, {
    method: "PATCH",
    body: JSON.stringify({
      phoneNumber: phoneNumber || null,
      ...(gender !== undefined ? { gender } : {}),
      ...(birthDate !== undefined ? { birthDate: birthDate || null } : {}),
    }),
  });

export const getTelegramStatus = (token: string, signal?: AbortSignal) =>
  apiRequest<{ connected: boolean }>("/auth/telegram/status", token, { signal });

export const requestTelegramLink = (token: string) =>
  apiRequest<{ url: string; expiresAt: string }>("/auth/telegram/link", token, {
    method: "POST",
  });

export const disconnectTelegram = (token: string) =>
  apiRequest<void>("/auth/telegram/link", token, { method: "DELETE" });

export const getMaxStatus = (token: string, signal?: AbortSignal) =>
  apiRequest<{ available: boolean; connected: boolean }>("/auth/max/status", token, {
    signal,
  });

export const requestMaxLink = (token: string) =>
  apiRequest<{ url: string; expiresAt: string }>("/auth/max/link", token, {
    method: "POST",
  });

export const disconnectMax = (token: string) =>
  apiRequest<void>("/auth/max/link", token, { method: "DELETE" });

export const changePassword = (token: string, currentPassword: string, newPassword: string) =>
  apiRequest<AuthResponse>("/auth/change-password", token, {
    method: "POST",
    body: JSON.stringify({ currentPassword, newPassword }),
  });

export const deleteOwnAccount = (token: string) =>
  apiRequest<{ deleted: boolean }>("/customer/account", token, {
    method: "DELETE",
  });

export const setExpectedCompletion = (
  token: string,
  orderId: string,
  expectedCompletionAt: string | null,
  note?: string,
) =>
  apiRequest<{ order: RepairOrder }>(`/orders/${orderId}/expected-completion`, token, {
    method: "PATCH",
    body: JSON.stringify({ expectedCompletionAt, note }),
  });

export const searchOrders = (token: string, serviceNumber: string, signal?: AbortSignal) =>
  apiRequest<{ orders: RepairOrder[] }>(
    `/orders/search?serviceNumber=${encodeURIComponent(serviceNumber)}`,
    token,
    { signal },
  );

export const getStaff = (token: string, signal?: AbortSignal) =>
  apiRequest<{ staff: StaffMember[] }>("/staff", token, { signal });

export const createTechnician = (
  token: string,
  input: { email: string; displayName: string; phoneNumber?: string },
) =>
  apiRequest<{
    staff: Pick<StaffMember, "id" | "displayName" | "email" | "role">;
    temporaryPassword: string;
  }>("/staff", token, {
    method: "POST",
    body: JSON.stringify({ ...input, role: "TECHNICIAN" }),
  });

export const updateTechnician = (
  token: string,
  userId: string,
  input: { salaryRatePercent: number },
) =>
  apiRequest<{ staff: StaffMember }>(`/staff/${userId}`, token, {
    method: "PATCH",
    body: JSON.stringify(input),
  });

export const setStaffActive = (token: string, userId: string, active: boolean) =>
  apiRequest<{ staff: StaffMember }>(`/staff/${userId}/active`, token, {
    method: "PATCH",
    body: JSON.stringify({ active }),
  });

export const deleteTechnician = (token: string, userId: string) =>
  apiRequest<{ staff: StaffMember }>(`/staff/${userId}`, token, { method: "DELETE" });

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

export const completeRepairDiagnosis = (token: string, orderId: string) =>
  apiRequest<{ order: RepairOrder }>(`/orders/${orderId}/diagnosis-completed`, token, {
    method: "POST",
  });

export const requestBonusRedemption = (token: string, orderId: string, redeemBonuses: boolean) =>
  apiRequest<{ order: RepairOrder }>(`/orders/${orderId}/bonus-redemption`, token, {
    method: "PATCH",
    body: JSON.stringify({ redeemBonuses }),
  });

export const createRepairReceipt = (
  token: string,
  orderId: string,
  draft: ReceiptDraft = { itemQuantities: [], freeSaleItems: [] },
) =>
  apiRequest<{ receipt: RepairReceipt }>(`/orders/${orderId}/receipt`, token, {
    method: "POST",
    body: JSON.stringify(draft),
  });

export const markReceiptPaid = (
  token: string,
  orderId: string,
  paymentMethod: NonNullable<RepairReceipt["paymentMethod"]>,
) =>
  apiRequest<{ receipt: RepairReceipt }>(`/orders/${orderId}/receipt/payment`, token, {
    method: "PATCH",
    body: JSON.stringify({ paymentMethod }),
  });

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
  data: {
    status?: CraftOrder["status"];
    quotedPriceRub?: number | null;
    assignedTechnicianId?: string | null;
  },
) =>
  apiRequest<{ order: CraftOrder }>(`/craft-orders/${id}`, token, {
    method: "PATCH",
    body: JSON.stringify(data),
  });

export const markCraftReceiptPaid = (
  token: string,
  id: string,
  paymentMethod: NonNullable<CraftOrderReceipt["paymentMethod"]>,
) =>
  apiRequest<{ receipt: CraftOrderReceipt }>(`/craft-orders/${id}/receipt/payment`, token, {
    method: "PATCH",
    body: JSON.stringify({ paymentMethod }),
  });

export const getCraftOrderChat = (token: string, id: string, signal?: AbortSignal) =>
  apiRequest<{ chat: CraftOrderChat }>(`/craft-orders/${id}/chat`, token, { signal });

export const getRepairOrderChat = (token: string, id: string, signal?: AbortSignal) =>
  apiRequest<{ chat: RepairOrderChat }>(`/orders/${id}/chat`, token, { signal });

export const getAdminRepairChatNotifications = (token: string, signal?: AbortSignal) =>
  apiRequest<AdminRepairChatNotifications>("/admin/chat-notifications", token, { signal });

export const markRepairOrderChatRead = (token: string, id: string, messageId: string) =>
  apiRequest<void>(`/orders/${id}/chat/read`, token, {
    method: "POST",
    body: JSON.stringify({ messageId }),
  });

export const joinAdminToRepairOrderChat = (token: string, id: string) =>
  apiRequest<{ chat: RepairOrderChat }>(`/orders/${id}/chat/join-admin`, token, {
    method: "POST",
  });

export const requestRepairOrderChatAdministrator = (token: string, id: string) =>
  apiRequest<{ chat: RepairOrderChat }>(`/orders/${id}/chat/request-admin`, token, {
    method: "POST",
  });

export const sendRepairOrderChatMessage = (token: string, id: string, content: string) =>
  apiRequest<{ chat: RepairOrderChat }>(`/orders/${id}/chat/messages`, token, {
    method: "POST",
    body: JSON.stringify({ content }),
  });

export const sendCraftOrderChatMessage = (token: string, id: string, content: string) =>
  apiRequest<{ chat: CraftOrderChat }>(`/craft-orders/${id}/chat/messages`, token, {
    method: "POST",
    body: JSON.stringify({ content }),
  });

export const getSupportChat = (token: string, signal?: AbortSignal) =>
  apiRequest<{ chat: SupportChat }>("/support/chat", token, { signal });

export const sendSupportChatMessage = (token: string, content: string) =>
  apiRequest<{ chat: SupportChat }>("/support/chat/messages", token, {
    method: "POST",
    body: JSON.stringify({ content }),
  });

export const getAdminSupportChats = (token: string, signal?: AbortSignal) =>
  apiRequest<{ chats: SupportChatInboxItem[] }>("/admin/support/chats", token, { signal });

export const getAdminSupportChat = (token: string, customerId: string, signal?: AbortSignal) =>
  apiRequest<{ chat: SupportChat }>(`/admin/support/chats/${customerId}`, token, { signal });

export const sendAdminSupportMessage = (token: string, customerId: string, content: string) =>
  apiRequest<{ chat: SupportChat }>(`/admin/support/chats/${customerId}/messages`, token, {
    method: "POST",
    body: JSON.stringify({ content }),
  });

export const uploadCraftOrderChatImage = async (token: string, id: string, file: File) => {
  const response = await fetch(`${apiBase}/craft-orders/${id}/chat/image`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": file.type },
    body: file,
  });
  if (!response.ok) throw new Error(`Не удалось отправить фото (${response.status}).`);
  return response.json() as Promise<{ message: CraftOrderChatMessage }>;
};

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

export const getReferralProgram = (token: string, signal?: AbortSignal) =>
  apiRequest<ReferralProgram>("/referrals/me", token, { signal });

export const getSalarySummary = (token: string, timeZone: string, signal?: AbortSignal) =>
  apiRequest<SalarySummary>(`/salary?timeZone=${encodeURIComponent(timeZone)}`, token, { signal });

export const getAdminLoyalty = (token: string, signal?: AbortSignal) =>
  apiRequest<{ customers: LoyaltyCustomer[] }>("/admin/loyalty", token, { signal });

export const getBanners = (token: string, signal?: AbortSignal) =>
  apiRequest<{ banners: SiteBanner[] }>("/banners", token, { signal });

export const getCustomerOffers = (token: string, signal?: AbortSignal) =>
  apiRequest<{ offers: CustomerOffer[] }>("/offers", token, { signal });

export const participateInCustomerOffer = (token: string, offerId: string) =>
  apiRequest<{
    participation: { id: string; joinedAt: string; place: number | null };
    alreadyParticipating: boolean;
  }>(`/offers/${offerId}/participate`, token, { method: "POST" });

export const getAdminCustomerOffers = (token: string, signal?: AbortSignal) =>
  apiRequest<{ offers: AdminCustomerOffer[] }>("/admin/offers", token, { signal });

export const createAdminCustomerOffer = (token: string, offer: CreateCustomerOfferInput) =>
  apiRequest<{ offer: AdminCustomerOffer }>("/admin/offers", token, {
    method: "POST",
    body: JSON.stringify(offer),
  });

export const updateAdminCustomerOffer = (token: string, offerId: string, isPublished: boolean) =>
  apiRequest<{ offer: AdminCustomerOffer }>(`/admin/offers/${offerId}`, token, {
    method: "PATCH",
    body: JSON.stringify({ isPublished }),
  });

export const drawAdminCustomerOffer = (token: string, offerId: string) =>
  apiRequest<{ offer: AdminCustomerOffer }>(`/admin/offers/${offerId}/draw`, token, {
    method: "POST",
  });

export const publishAdminCustomerOfferResults = (token: string, offerId: string) =>
  apiRequest<{ offer: AdminCustomerOffer }>(`/admin/offers/${offerId}/publish-results`, token, {
    method: "POST",
  });

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

export const getAndroidApk = (signal?: AbortSignal) =>
  apiRequest<{ apk: AndroidApkInfo }>("/android-app", null, { signal });

export const getSeasonalTheme = (signal?: AbortSignal) =>
  apiRequest<SeasonalThemeState>("/seasonal-theme", null, { signal });

export const setSeasonalTheme = (token: string, season: SeasonalSeasonChoice) =>
  apiRequest<SeasonalThemeState>("/seasonal-theme", token, {
    method: "PUT",
    body: JSON.stringify({ season }),
  });

export const getAdminAndroidApk = (token: string, signal?: AbortSignal) =>
  apiRequest<{ apk: AndroidApkInfo }>("/admin/android-app", token, { signal });

export const uploadAndroidApk = (token: string, file: File) =>
  apiRequest<{ apk: AndroidApkInfo; cleanupPending: boolean }>("/admin/android-app", token, {
    method: "POST",
    headers: { "Content-Type": "application/vnd.android.package-archive" },
    body: file,
  });

export const deleteAndroidApk = (token: string) =>
  apiRequest<{ apk: AndroidApkInfo; cleanupPending: boolean }>("/admin/android-app", token, {
    method: "DELETE",
  });

export const cleanupAndroidApk = (token: string) =>
  apiRequest<{ cleanupPending: boolean; pendingDeletionCount: number }>(
    "/admin/android-app/cleanup",
    token,
    { method: "POST" },
  );

export const notifyAndroidApkUpdate = (token: string) =>
  apiRequest<{
    recipientCount: number;
    deviceCount: number;
    deliverySucceeded: boolean;
  }>("/admin/android-app/notify", token, { method: "POST" });

export const getAndroidApkDownloadUrl = () => `${apiBase || "/api"}/android-app/download`;

export const moderateReview = (token: string, reviewId: string, isPublished: boolean) =>
  apiRequest<{ review: Review }>(`/reviews/${reviewId}`, token, {
    method: "PATCH",
    body: JSON.stringify({ isPublished }),
  });

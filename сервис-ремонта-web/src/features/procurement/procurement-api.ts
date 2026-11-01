import { type RepairCatalogType, apiRequest } from "@/lib/api";

export type ProcurementSupplier = {
  id: string;
  name: string;
  contactName: string | null;
  phone: string | null;
  email: string | null;
  note: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type StockReceipt = {
  id: string;
  supplierId: string | null;
  supplierNameSnapshot: string;
  catalogItemId: string | null;
  itemType: RepairCatalogType;
  itemNameSnapshot: string;
  quantity: number;
  unitCostRub: number | null;
  documentReference: string | null;
  receivedAt: string;
};

export type ProcurementSupplierInput = Pick<
  ProcurementSupplier,
  "name" | "contactName" | "phone" | "email" | "note"
>;

export const getProcurementSuppliers = (token: string, signal?: AbortSignal) =>
  apiRequest<{ suppliers: ProcurementSupplier[] }>("/admin/operations/suppliers", token, {
    signal,
  });

export const createProcurementSupplier = (token: string, input: ProcurementSupplierInput) =>
  apiRequest<{ supplier: ProcurementSupplier }>("/admin/operations/suppliers", token, {
    method: "POST",
    body: JSON.stringify(input),
  });

export const updateProcurementSupplier = (
  token: string,
  supplierId: string,
  input: Partial<ProcurementSupplierInput> & { isActive?: boolean },
) =>
  apiRequest<{ supplier: ProcurementSupplier }>(
    `/admin/operations/suppliers/${supplierId}`,
    token,
    { method: "PATCH", body: JSON.stringify(input) },
  );

export const getStockReceipts = (token: string, signal?: AbortSignal) =>
  apiRequest<{ receipts: StockReceipt[] }>("/admin/operations/stock-receipts", token, {
    signal,
  });

export const createStockReceipt = (
  token: string,
  input: {
    supplierId: string;
    catalogItemId: string;
    quantity: number;
    unitCostRub: number | null;
    documentReference: string | null;
  },
) =>
  apiRequest<{ receipt: StockReceipt }>("/admin/operations/stock-receipts", token, {
    method: "POST",
    body: JSON.stringify(input),
  });

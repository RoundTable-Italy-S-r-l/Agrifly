import {
  Drone,
  Crop,
  Treatment,
  Affiliate,
  GisCategory,
  SavedField
} from "@shared/api";

// Re-export types for convenience
export type {
  Drone,
  Crop,
  Treatment,
  Affiliate,
  GisCategory,
  SavedField
};

// API Base URL - in dev, Vite serve anche le API sulla stessa porta (8080)
const API_BASE = '';

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

async function apiRequest<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE}/api${endpoint}`;

  try {
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      ...options,
    });

    if (!response.ok) {
      throw new ApiError(response.status, `API request failed: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(0, `Network error: ${error.message}`);
  }
}

// Drones API
export const fetchDrones = (): Promise<Drone[]> =>
  apiRequest<Drone[]>('/drones');

export const fetchDroneById = (id: string): Promise<Drone> =>
  apiRequest<Drone>(`/drones/${id}`);

// Crops API
export const fetchCrops = (): Promise<Crop[]> =>
  apiRequest<Crop[]>('/crops');

export const fetchCropById = (id: string): Promise<Crop> =>
  apiRequest<Crop>(`/crops/${id}`);

// Treatments API
export const fetchTreatments = (): Promise<Treatment[]> =>
  apiRequest<Treatment[]>('/treatments');

export const fetchTreatmentsByCategory = (categoryId: string): Promise<Treatment[]> =>
  apiRequest<Treatment[]>(`/treatments/category/${categoryId}`);

export const fetchTreatmentById = (id: string): Promise<Treatment> =>
  apiRequest<Treatment>(`/treatments/${id}`);

// Affiliates API
export const fetchAffiliates = (): Promise<Affiliate[]> =>
  apiRequest<Affiliate[]>('/affiliates');

export const fetchAffiliateById = (id: number): Promise<Affiliate> =>
  apiRequest<Affiliate>(`/affiliates/${id}`);

// Saved Fields API
export const fetchSavedFields = (): Promise<SavedField[]> =>
  apiRequest<SavedField[]>('/fields');

export const createSavedField = (data: Omit<SavedField, 'id' | 'createdAt' | 'updatedAt'>): Promise<SavedField> =>
  apiRequest<SavedField>('/fields', {
    method: 'POST',
    body: JSON.stringify(data),
  });

export const fetchSavedFieldById = (id: string): Promise<SavedField> =>
  apiRequest<SavedField>(`/fields/${id}`);

export const deleteSavedField = (id: string): Promise<void> =>
  apiRequest<void>(`/fields/${id}`, {
    method: 'DELETE',
  });

// GIS Categories API
export const fetchGisCategories = (): Promise<GisCategory[]> =>
  apiRequest<GisCategory[]>('/gis-categories');

export const fetchGisCategoryById = (id: string): Promise<GisCategory> =>
  apiRequest<GisCategory>(`/gis-categories/${id}`);

// Orders API
export interface Order {
  id: string;
  buyer_org_id: string;
  seller_org_id: string;
  buyer_org_name: string;
  order_status: string;
  total_cents: number;
  currency: string;
  created_at: string;
  order_lines: Array<{
    id: string;
    sku_id: string;
    sku_code: string;
    product_name: string;
    product_model: string;
    qty: number;
    unit_price_cents: number;
    line_total_cents: number;
  }>;
}

export interface OrderStats {
  totalRevenue: number;
  activeOrders: number;
  completedOrdersThisMonth: number;
  recentOrders: Array<{
    id: string;
    buyer_org_name: string;
    order_status: string;
    total_cents: number;
    created_at: string;
    products: string;
  }>;
}

export const fetchOrders = (orgId: string): Promise<Order[]> =>
  apiRequest<Order[]>(`/orders?orgId=${orgId}`);

export const fetchOrderStats = (orgId: string): Promise<OrderStats> =>
  apiRequest<OrderStats>(`/orders/stats?orgId=${orgId}`);

// Missions API
export interface Mission {
  id: string;
  location: string;
  operator: string;
  area: number;
  progress: number;
  status: 'scheduled' | 'in_progress' | 'completed';
}

export interface MissionsStats {
  totalMissions: number;
  activeMissions: number;
  completedThisMonth: number;
  totalAreaTreated: number;
}

export const fetchActiveMissions = (orgId: string): Promise<Mission[]> =>
  apiRequest<Mission[]>(`/missions/active?orgId=${orgId}`);

export const fetchMissionsStats = (orgId: string): Promise<MissionsStats> =>
  apiRequest<MissionsStats>(`/missions/stats?orgId=${orgId}`);

// Catalog API
export interface CatalogVendor {
  id: string;
  name: string;
  logo: string;
  description: string;
  products: CatalogProduct[];
}

export interface CatalogProduct {
  id: string;
  skuCode: string;
  name: string;
  model: string;
  brand: string;
  category: string;
  price: number;
  currency: string;
  stock: number;
  leadTimeDays: number;
  imageUrl?: string;
  glbUrl?: string;
  description: string;
  specs?: any;
  vendorNotes?: string;
}

export interface VendorCatalogItem {
  id: string;
  skuCode: string;
  productName: string;
  productModel: string;
  productType: string;
  isActive: boolean;
  isForRent: boolean;
  price: number | null;
  leadTimeDays: number | null;
  stock: number;
  location: string | null;
  notes: string | null;
}

export interface PublicCatalogResponse {
  vendors: CatalogVendor[];
}

export interface VendorCatalogResponse {
  catalog: VendorCatalogItem[];
}

export const fetchPublicCatalog = (filters?: {
  category?: string;
  vendor?: string;
  minPrice?: number;
  maxPrice?: number;
}): Promise<PublicCatalogResponse> => {
  const params = new URLSearchParams();
  if (filters?.category) params.append('category', filters.category);
  if (filters?.vendor) params.append('vendor', filters.vendor);
  if (filters?.minPrice) params.append('minPrice', filters.minPrice.toString());
  if (filters?.maxPrice) params.append('maxPrice', filters.maxPrice.toString());

  return apiRequest<PublicCatalogResponse>(`/catalog/public?${params}`);
};

export const fetchVendorCatalog = (orgId: string): Promise<VendorCatalogResponse> =>
  apiRequest<VendorCatalogResponse>(`/catalog/vendor/${orgId}`);

export const toggleVendorProduct = (orgId: string, skuId: string, isForSale: boolean): Promise<any> =>
  apiRequest<any>(`/catalog/vendor/${orgId}/toggle`, {
    method: 'POST',
    body: JSON.stringify({ skuId, isForSale })
  });

export const updateVendorProduct = (orgId: string, skuId: string, updates: {
  price?: number;
  leadTimeDays?: number;
  notes?: string;
}): Promise<any> =>
  apiRequest<any>(`/catalog/vendor/${orgId}/product`, {
    method: 'PUT',
    body: JSON.stringify({ skuId, ...updates })
  });

export const initializeVendorCatalog = (orgId: string): Promise<any> =>
  apiRequest<any>(`/catalog/vendor/${orgId}/initialize`, {
    method: 'POST'
  });

export const initializeLenziCatalog = (): Promise<any> =>
  apiRequest<any>('/catalog/initialize/lenzi', {
    method: 'POST'
  });

export const setupTestData = (): Promise<any> =>
  apiRequest<any>('/setup-test-data', {
    method: 'POST'
  });

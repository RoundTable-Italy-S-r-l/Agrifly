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
  stock?: number;
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

// Offers API (Bundle e Offerte)
export interface Offer {
  id: string;
  vendor_org_id: string;
  offer_type: 'BUNDLE' | 'PROMO' | 'SEASON_PACKAGE';
  name: string;
  rules_json: any;
  valid_from: string;
  valid_to: string | null;
  status: 'ACTIVE' | 'INACTIVE';
}

export const fetchOffers = (orgId: string): Promise<Offer[]> =>
  apiRequest<Offer[]>(`/offers/${orgId}`);

export const createOffer = (orgId: string, offer: {
  offer_type: 'BUNDLE' | 'PROMO' | 'SEASON_PACKAGE';
  name: string;
  rules_json: any;
  valid_from: string;
  valid_to?: string | null;
  status?: 'ACTIVE' | 'INACTIVE';
}): Promise<Offer> =>
  apiRequest<Offer>(`/offers/${orgId}`, {
    method: 'POST',
    body: JSON.stringify(offer)
  });

export const updateOffer = (orgId: string, offerId: string, updates: {
  name?: string;
  rules_json?: any;
  valid_from?: string;
  valid_to?: string | null;
  status?: 'ACTIVE' | 'INACTIVE';
}): Promise<Offer> =>
  apiRequest<Offer>(`/offers/${orgId}/${offerId}`, {
    method: 'PUT',
    body: JSON.stringify(updates)
  });

export const deleteOffer = (orgId: string, offerId: string): Promise<void> =>
  apiRequest<void>(`/offers/${orgId}/${offerId}`, {
    method: 'DELETE'
  });

export const setupTestData = (): Promise<any> =>
  apiRequest<any>('/setup-test-data', {
    method: 'POST'
  });

// Services API (Rate Cards)
export interface RateCard {
  id: string;
  seller_org_id: string;
  service_type: 'SPRAY' | 'SPREAD' | 'MAPPING';
  base_rate_per_ha_cents: number;
  min_charge_cents: number;
  travel_rate_per_km_cents: number;
  hourly_operator_rate_cents: number | null;
  seasonal_multipliers_json: any;
  risk_multipliers_json: any;
}

export const fetchRateCards = (orgId: string): Promise<RateCard[]> =>
  apiRequest<RateCard[]>(`/services/${orgId}`);

export const fetchRateCard = (orgId: string, serviceType: string): Promise<RateCard> =>
  apiRequest<RateCard>(`/services/${orgId}/${serviceType}`);

export const upsertRateCard = (orgId: string, rateCard: {
  service_type: 'SPRAY' | 'SPREAD' | 'MAPPING';
  base_rate_per_ha_cents: number;
  min_charge_cents: number;
  travel_rate_per_km_cents: number;
  hourly_operator_rate_cents?: number | null;
  seasonal_multipliers_json?: any;
  risk_multipliers_json?: any;
}): Promise<RateCard> =>
  apiRequest<RateCard>(`/services/${orgId}`, {
    method: 'POST',
    body: JSON.stringify(rateCard)
  });

export const deleteRateCard = (orgId: string, serviceType: string): Promise<void> =>
  apiRequest<void>(`/services/${orgId}/${serviceType}`, {
    method: 'DELETE'
  });

// Missions API
export interface MissionHistory {
  id: string;
  booking_id: string;
  service_type: 'SPRAY' | 'SPREAD' | 'MAPPING';
  executed_start_at: string;
  executed_end_at: string | null;
  actual_area_ha: number | null;
  actual_hours: number | null;
  notes: string | null;
  buyer_org_name: string;
  location: string;
  lat: number | null;
  lon: number | null;
  operator: string;
  model: string;
  status: 'DONE' | 'IN_PROGRESS' | 'SCHEDULED';
}

export const fetchMissions = (orgId: string, filters?: {
  period?: string;
  serviceType?: string;
  status?: string;
}): Promise<MissionHistory[]> => {
  const params = new URLSearchParams({ orgId, ...filters });
  return apiRequest<MissionHistory[]>(`/missions?${params}`);
};


// ============================================================================
// QUOTE ESTIMATE (Netlify Function)
// ============================================================================

export interface QuoteEstimateInput {
  seller_org_id: string;
  service_type: string;
  area_ha: number;
  distance_km?: number;
  risk_key?: string;
  month?: number;
}

export interface QuoteEstimateResponse {
  currency: string;
  total_estimated_cents: number;
  breakdown: {
    baseCents: number;
    travelCents: number;
    subtotalCents: number;
    seasonalMult: number;
    riskMult: number;
    multipliedCents: number;
    minCharge: number;
    totalCents: number;
  };
  pricing_snapshot_json: any;
}

export const estimateQuote = async (input: QuoteEstimateInput): Promise<QuoteEstimateResponse> => {
  const response = await fetch('/api/quote-estimate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || 'Quote estimation failed');
  }

  return response.json();
};


// Operators API
export interface Operator {
  id: string;
  user_id: string;
  org_id: string;
  first_name: string;
  last_name: string;
  email: string;
  service_tags: string[];
  max_hours_per_day: number | null;
  max_ha_per_day: number | null;
  home_location: string | null;
  service_area_set_name: string | null;
  status: 'ACTIVE' | 'INACTIVE';
}

export const fetchOperators = (orgId: string): Promise<Operator[]> =>
  apiRequest<Operator[]>(`/operators/${orgId}`);

export const fetchOperator = (orgId: string, operatorId: string): Promise<any> =>
  apiRequest(`/operators/${orgId}/${operatorId}`);

// Bookings API
export interface Booking {
  id: string;
  service_type: 'SPRAY' | 'SPREAD' | 'MAPPING';
  status: 'REQUESTED' | 'CONFIRMED' | 'IN_PROGRESS' | 'DONE' | 'CANCELLED';
  buyer_org_name: string;
  location: string;
  lat: number | null;
  lon: number | null;
  start_at: string | null;
  end_at: string | null;
  model: string;
  created_at: string;
}

export const fetchBookings = (orgId: string, filters?: {
  status?: string;
  period?: string;
}): Promise<Booking[]> => {
  const params = new URLSearchParams();
  if (filters?.status) params.append('status', filters.status);
  if (filters?.period) params.append('period', filters.period);
  const queryString = params.toString();
  return apiRequest<Booking[]>(`/bookings/${orgId}${queryString ? `?${queryString}` : ''}`);
};

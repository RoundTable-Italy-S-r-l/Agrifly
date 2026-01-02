import {
  Drone,
  Crop,
  Treatment,
  Affiliate,
  GisCategory
} from "@shared/api";
import { getAuthHeaders } from "./auth";

// Re-export types for convenience
export type {
  Drone,
  Crop,
  Treatment,
  Affiliate,
  GisCategory
};

// Service Management Types
export interface RateCard {
  id: string;
  seller_org_id?: string; // May be seller_org_id or org_id depending on backend
  org_id?: string;
  service_type: string;
  crop_type?: string;
  treatment_type?: string;
  terrain_conditions?: string;
  base_rate_per_ha_cents: number;
  min_charge_cents: number;
  travel_fixed_cents?: number; // Quota fissa trasporto
  travel_rate_per_km_cents?: number; // Quota variabile euro/km
  hilly_terrain_multiplier?: number; // Moltiplicatore terreno collinare (es. 1.2 = +20%)
  hilly_terrain_surcharge_cents?: number; // Maggiorazione fissa terreno collinare
  custom_multipliers_json?: string | Record<string, number>; // { "obstacles": 1.15, "steep_slope": 1.3, ... }
  custom_surcharges_json?: string | Record<string, number>; // { "urgent": 5000, "weekend": 2000, ... }
  max_area_per_hour_ha?: number;
  liquid_consumption_l_per_ha?: number;
  hourly_operator_rate_cents?: number;
  seasonal_multipliers_json?: string | Record<string, number>;
  risk_multipliers_json?: string | Record<string, number>;
  is_active?: boolean;
  valid_from?: string;
  valid_until?: string;
  created_at?: string;
  updated_at?: string;
}

export interface OperatorProfile {
  id: string;
  org_id: string;
  user_id: string;
  license_number?: string;
  certifications?: string[];
  experience_years?: number;
  max_flight_time_hours?: number;
  supported_drone_models?: string[];
  availability_schedule?: any;
  preferred_regions?: string[];
  completed_missions: number;
  average_rating?: number;
  reliability_score?: number;
  is_active: boolean;
  last_active_at?: string;
  created_at: string;
  updated_at: string;
  user: {
    id: string;
    email: string;
    first_name?: string;
    last_name?: string;
    phone?: string;
  };
}

export interface OfferFilters {
  enable_offer_filters: boolean;
  max_distance_from_base?: number;
  accepted_service_types?: string[];
  min_price_per_ha_cents?: number;
  max_price_per_ha_cents?: number;
  accepted_terrain_conditions?: string[];
  max_accepted_slope?: number;
}

export interface ServiceConfiguration {
  id: string;
  org_id: string;
  base_location_lat?: number;
  base_location_lng?: number;
  base_location_address?: string;
  working_hours_start: number;
  working_hours_end: number;
  available_days: string;
  offer_message_template?: string;
  rejection_message_template?: string;
  available_drones?: string[];
  preferred_terrain?: string;
  max_slope_percentage?: number;
  fuel_surcharge_cents: number;
  maintenance_surcharge_cents: number;

  // FILTRI OPERATORE PER LAVORI
  enable_job_filters: boolean;
  operating_regions?: string; // JSON array
  offered_service_types?: string; // JSON array
  hourly_rate_min_cents?: number;
  hourly_rate_max_cents?: number;
  manageable_terrain?: string; // JSON array
  max_manageable_slope?: number;
  work_start_hour: number;
  work_end_hour: number;

  created_at: string;
  updated_at: string;
}

// API Base URL - in dev, Vite serve anche le API sulla stessa porta (8082)
const API_BASE = '';

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function apiRequest<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE}/api${endpoint}`;

  try {
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
        ...options?.headers,
      },
      ...options,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: response.statusText }));
      throw new ApiError(response.status, errorData.error || errorData.message || `API request failed: ${response.statusText}`);
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

// GIS Categories API
export const fetchGisCategories = (): Promise<GisCategory[]> =>
  apiRequest<GisCategory[]>('/gis-categories');

export const fetchGisCategoryById = (id: string): Promise<GisCategory> =>
  apiRequest<GisCategory>(`/gis-categories/${id}`);

// Orders API
export interface OrderLine {
  id: string;
  sku_id: string;
  quantity: number;
  unit_price_cents: number;
  line_total_cents: number;
  sku_code?: string;
  product_name?: string;
  product_model?: string;
  brand?: string;
}

export interface Order {
  id: string;
  order_number?: string;
  buyer_org_id: string;
  seller_org_id: string;
  buyer_org_name?: string;
  seller_org_name?: string;
  status: string;
  payment_status: string;
  subtotal_cents?: number;
  tax_cents?: number;
  shipping_cents?: number;
  total_cents: number;
  currency: string;
  shipping_address?: any;
  billing_address?: any;
  customer_notes?: string;
  tracking_number?: string;
  created_at: string;
  shipped_at?: string;
  delivered_at?: string;
  order_lines: OrderLine[];
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

export const fetchOrders = (orgId: string, role?: 'buyer' | 'seller'): Promise<Order[]> => {
  const params = new URLSearchParams({ orgId });
  if (role) params.append('role', role);
  return apiRequest<Order[]>(`/orders?${params}`);
};

export const fetchOrderById = (orderId: string): Promise<Order> =>
  apiRequest<Order>(`/orders/${orderId}`);

export const fetchOrderStats = (orgId: string): Promise<OrderStats> =>
  apiRequest<OrderStats>(`/orders/stats?orgId=${orgId}`);

export const createOrderFromCart = (data: {
  cartId: string;
  shippingAddress: any;
  billingAddress: any;
  customerNotes?: string;
}): Promise<{ order: Order }> =>
  apiRequest<{ order: Order }>('/orders/create-from-cart', {
    method: 'POST',
    body: JSON.stringify(data)
  });

// ============================================================================
// ORDER MESSAGES API
// ============================================================================

export interface OrderMessage {
  id: string;
  order_id: string;
  sender_org_id: string;
  sender_user_id?: string;
  message_text: string;
  is_read: boolean;
  created_at: string;
  sender_org_name?: string;
}

export interface JobOfferMessage {
  id: string;
  offer_id: string;
  sender_org_id: string;
  sender_user_id?: string;
  message_text: string;
  is_read: boolean;
  created_at: string;
  sender_org_name?: string;
}

export const fetchOrderMessages = (orderId: string): Promise<OrderMessage[]> =>
  apiRequest<OrderMessage[]>(`/orders/${orderId}/messages`);

export const sendOrderMessage = (orderId: string, data: {
  sender_org_id: string;
  sender_user_id?: string;
  message_text: string;
}): Promise<OrderMessage> =>
  apiRequest<OrderMessage>(`/orders/${orderId}/messages`, {
    method: 'POST',
    body: JSON.stringify(data)
  });

export const markOrderMessagesAsRead = (orderId: string, reader_org_id: string): Promise<{ success: boolean }> =>
  apiRequest<{ success: boolean }>(`/orders/${orderId}/messages/read`, {
    method: 'PUT',
    body: JSON.stringify({ reader_org_id })
  });

// ============================================================================
// JOB OFFER MESSAGES API
// ============================================================================

export interface JobOfferMessage {
  id: string;
  offer_id: string;
  sender_org_id: string;
  sender_user_id?: string;
  message_text: string;
  is_read: boolean;
  created_at: string;
  sender_org_name?: string;
}

export const fetchJobOfferMessages = (offerId: string): Promise<JobOfferMessage[]> =>
  apiRequest<JobOfferMessage[]>(`/jobs/offers/${offerId}/messages`);

export const sendJobOfferMessage = (offerId: string, data: {
  content: string;
}): Promise<JobOfferMessage> =>
  apiRequest<JobOfferMessage>(`/jobs/offers/${offerId}/messages`, {
    method: 'POST',
    body: JSON.stringify(data)
  });

export const markJobOfferMessagesAsRead = (offerId: string, reader_org_id: string): Promise<{ success: boolean }> =>
  apiRequest<{ success: boolean }>(`/jobs/offers/${offerId}/messages/read`, {
    method: 'PUT',
    body: JSON.stringify({ reader_org_id })
  });

// ============================================================================
// E-COMMERCE API
// ============================================================================

export interface ShoppingCart {
  id: string;
  user_id?: string;
  session_id?: string;
  org_id?: string;
  created_at: string;
  updated_at: string;
}

export interface CartItem {
  id: string;
  cart_id: string;
  sku_id: string;
  quantity: number;
  unit_price_cents?: number;
  created_at: string;
  sku_code: string;
  product_name: string;
  product_model: string;
  brand: string;
}

export interface CartResponse {
  cart: ShoppingCart;
  items: CartItem[];
}

export interface WishlistItem {
  id: string;
  sku_id: string;
  note?: string;
  created_at: string;
  sku_code: string;
  product_name: string;
  product_model: string;
  brand: string;
  images_json?: any;
  specs_json?: any;
}

export interface Address {
  id: string;
  org_id: string;
  type: 'SHIPPING' | 'BILLING';
  name: string;
  company?: string;
  address_line: string;
  city: string;
  province: string;
  postal_code: string;
  country: string;
  phone?: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

// Shopping Cart API
export const getCart = (orgId: string | null, userId?: string, sessionId?: string): Promise<CartResponse> => {
  const params = new URLSearchParams();
  if (orgId && orgId !== 'guest_org') params.append('orgId', orgId);
  if (userId) params.append('userId', userId);
  if (sessionId) params.append('sessionId', sessionId);
  // Se non c'è orgId e non c'è sessionId, usa 'guest_org' come fallback
  if (!orgId && !sessionId) params.append('orgId', 'guest_org');
  return apiRequest<CartResponse>(`/ecommerce/cart?${params}`);
};

export const addToCart = (cartId: string, skuId: string, quantity?: number): Promise<CartItem> =>
  apiRequest<CartItem>('/ecommerce/cart/items', {
    method: 'POST',
    body: JSON.stringify({ cartId, skuId, quantity: quantity || 1 })
  });

export const updateCartItem = (itemId: string, quantity: number): Promise<CartItem> =>
  apiRequest<CartItem>(`/ecommerce/cart/items/${itemId}`, {
    method: 'PUT',
    body: JSON.stringify({ quantity })
  });

export const removeFromCart = (itemId: string): Promise<{ message: string }> =>
  apiRequest<{ message: string }>(`/ecommerce/cart/items/${itemId}`, {
    method: 'DELETE'
  });

export const migrateCart = (sessionId: string, userId: string, orgId: string): Promise<{ message: string; migrated: boolean; itemsMigrated?: number; userCartId?: string }> =>
  apiRequest(`/ecommerce/cart/migrate`, {
    method: 'POST',
    body: JSON.stringify({ sessionId, userId, orgId })
  });

// Wishlist API
export const getWishlist = (orgId: string): Promise<WishlistItem[]> =>
  apiRequest<WishlistItem[]>(`/ecommerce/wishlist?orgId=${orgId}`);

export const addToWishlist = (orgId: string, productId?: string, skuId?: string, note?: string): Promise<WishlistItem> => {
  const body: any = { orgId };
  if (productId) {
    body.productId = productId;
  } else if (skuId) {
    body.skuId = skuId;
  } else {
    throw new Error('Product ID or SKU ID required');
  }
  if (note) {
    body.note = note;
  }
  return apiRequest<WishlistItem>('/ecommerce/wishlist', {
    method: 'POST',
    body: JSON.stringify(body)
  });
};

export const removeFromWishlist = (itemId: string): Promise<{ message: string }> =>
  apiRequest<{ message: string }>(`/ecommerce/wishlist/${itemId}`, {
    method: 'DELETE'
  });

// Address Management API
export const getAddresses = (orgId: string, type?: 'SHIPPING' | 'BILLING'): Promise<Address[]> => {
  const params = new URLSearchParams({ orgId });
  if (type) params.append('type', type);
  return apiRequest<Address[]>(`/ecommerce/addresses?${params}`);
};

export const createAddress = (address: Omit<Address, 'id' | 'created_at' | 'updated_at'>): Promise<Address> =>
  apiRequest<Address>('/ecommerce/addresses', {
    method: 'POST',
    body: JSON.stringify(address)
  });

export const updateAddress = (addressId: string, updates: Partial<Address>): Promise<Address> =>
  apiRequest<Address>(`/ecommerce/addresses/${addressId}`, {
    method: 'PUT',
    body: JSON.stringify(updates)
  });

export const deleteAddress = (addressId: string): Promise<{ message: string }> =>
  apiRequest<{ message: string }>(`/ecommerce/addresses/${addressId}`, {
    method: 'DELETE'
  });

// Services API - Geo Areas and Crop Types
export const fetchGeoAreas = (): Promise<{
  provinces: Array<{code: string, name: string}>;
  regions: Array<{region_code: string, name: string}>;
  comuni: Array<{code: string, name: string, province_code: string}>;
}> => apiRequest('/services/geo-areas');

export const fetchCropTypes = (): Promise<Array<{
  id: string;
  name: string;
  category: string;
}>> => apiRequest('/services/crop-types');

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
  products: CatalogProductVendor[]; // Prodotto con info vendor specifica
}

// Prodotto nel catalogo pubblico (senza vendor specifico)
export interface CatalogProduct {
  id: string;
  productId?: string; // da assets (prd_t25, etc.)
  name: string;
  model: string;
  brand: string;
  category: string;
  price?: number; // Prezzo minimo (opzionale)
  currency?: string;
  stock?: number; // Stock totale (opzionale)
  leadTimeDays?: number;
  imageUrl?: string;
  glbUrl?: string;
  description: string;
  specs?: any;
  vendorCount: number; // Numero di vendor che vendono questo prodotto
}

// Prodotto con info vendor (per compatibilità con vecchio formato)
export interface CatalogProductVendor {
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

export interface BundleOffer {
  id: string;
  type: 'bundle';
  name: string;
  description: string;
  bundlePrice: number;
  products: Array<{
    product_id: string;
    name: string;
    model: string;
    quantity: number;
  }>;
  vendorName: string;
  vendorLogo?: string;
  imageUrl?: string;
  validUntil?: string;
  savings?: string;
}

export interface PublicCatalogResponse {
  products: CatalogProduct[];
  bundles?: BundleOffer[];
}

export interface CatalogProduct {
  id: string;
  productId?: string; // da assets (prd_t25, etc.)
  name: string;
  model: string;
  brand: string;
  category: string;
  price?: number; // Prezzo minimo (opzionale, calcolato lato server)
  currency?: string;
  stock?: number; // Stock totale (opzionale)
  leadTimeDays?: number;
  imageUrl?: string;
  glbUrl?: string;
  description: string;
  specs?: any;
  vendorCount: number; // Numero di vendor che vendono questo prodotto
}

export interface ProductVendor {
  vendorId: string;
  vendorName: string;
  vendorLogo: string;
  vendorAddress: string;
  skuId: string;
  skuCode: string;
  price: number;
  currency: string;
  availableStock: number;
  leadTimeDays: number | null;
  notes: string | null;
  offer?: {
    id: string;
    name: string;
    type: 'BUNDLE' | 'PROMO' | 'SEASON_PACKAGE';
    discountPercent: number;
    originalPrice: number;
    rules: any;
  } | null;
}

export interface ProductVendorsResponse {
  vendors: ProductVendor[];
}

export interface VendorCatalogResponse {
  catalog: VendorCatalogItem[];
}

export const fetchPublicCatalog = (filters?: {
  category?: string;
  minPrice?: number;
  maxPrice?: number;
}): Promise<PublicCatalogResponse> => {
  const params = new URLSearchParams();
  if (filters?.category) params.append('category', filters.category);
  if (filters?.minPrice) params.append('minPrice', filters.minPrice.toString());
  if (filters?.maxPrice) params.append('maxPrice', filters.maxPrice.toString());

  return apiRequest<PublicCatalogResponse>(`/catalog/public?${params}`);
};

export const fetchProductVendors = (productId: string): Promise<ProductVendorsResponse> => {
  return apiRequest<ProductVendorsResponse>(`/catalog/product/${productId}/vendors`);
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

export const fetchJobs = (): Promise<{ jobs: any[] }> =>
  apiRequest<{ jobs: any[] }>('/jobs');

export const fetchOperatorJobs = (): Promise<{ jobs: any[] }> =>
  apiRequest<{ jobs: any[] }>('/jobs/operator/jobs');

export const fetchJobOffers = (orgId: string): Promise<{
  received: JobOffer[];
  made: JobOffer[];
}> =>
  apiRequest<{
    received: JobOffer[];
    made: JobOffer[];
  }>(`/jobs/offers/${orgId}`);

export const createOffer = (offer: {
  offer_type: 'BUNDLE' | 'PROMO' | 'SEASON_PACKAGE';
  name: string;
  rules_json: any;
  valid_from: string;
  valid_to?: string | null;
  status?: 'ACTIVE' | 'INACTIVE';
}): Promise<Offer> =>
  apiRequest<Offer>('/offers', {
    method: 'POST',
    body: JSON.stringify(offer)
  });

export const updateOffer = (offerId: string, updates: {
  name?: string;
  rules_json?: any;
  valid_from?: string;
  valid_to?: string | null;
  status?: 'ACTIVE' | 'INACTIVE';
}): Promise<Offer> =>
  apiRequest<Offer>(`/offers/${offerId}`, {
    method: 'PUT',
    body: JSON.stringify(updates)
  });

export const deleteOffer = (offerId: string): Promise<void> =>
  apiRequest<void>(`/offers/${offerId}`, {
    method: 'DELETE'
  });

export const setupTestData = (): Promise<any> =>
  apiRequest<any>('/setup-test-data', {
    method: 'POST'
  });

// Rate Cards API
export const fetchRateCards = (orgId: string): Promise<RateCard[]> =>
  apiRequest<RateCard[]>(`/services/${orgId}`);

export const createRateCard = (orgId: string, rateCard: Omit<RateCard, 'id' | 'org_id' | 'is_active' | 'valid_from' | 'created_at' | 'updated_at'>): Promise<RateCard> =>
  apiRequest<RateCard>(`/services/${orgId}`, {
    method: 'POST',
    body: JSON.stringify(rateCard)
  });

export const updateRateCard = (orgId: string, rateCardId: string, rateCard: Partial<RateCard>): Promise<RateCard> =>
  apiRequest<RateCard>(`/services/${orgId}/${rateCardId}`, {
    method: 'PUT',
    body: JSON.stringify(rateCard)
  });

export const deleteRateCard = (orgId: string, rateCardId: string): Promise<void> =>
  apiRequest(`/services/${orgId}/${rateCardId}`, {
    method: 'DELETE'
  });

// Operator Profiles API
export const fetchOperators = (orgId: string): Promise<OperatorProfile[]> =>
  apiRequest<OperatorProfile[]>(`/operators/${orgId}`);

export const createOperator = (orgId: string, operator: {
  user_id: string;
  license_number?: string;
  certifications?: string[];
  experience_years?: number;
  max_flight_time_hours?: number;
  supported_drone_models?: string[];
  availability_schedule?: any;
  preferred_regions?: string[];
}): Promise<OperatorProfile> =>
  apiRequest<OperatorProfile>(`/operators/${orgId}`, {
    method: 'POST',
    body: JSON.stringify(operator)
  });

export const updateOperator = (orgId: string, operatorId: string, operator: Partial<OperatorProfile>): Promise<OperatorProfile> =>
  apiRequest<OperatorProfile>(`/operators/${orgId}/${operatorId}`, {
    method: 'PUT',
    body: JSON.stringify(operator)
  });

export const deleteOperator = (orgId: string, operatorId: string): Promise<void> =>
  apiRequest(`/operators/${orgId}/${operatorId}`, {
    method: 'DELETE'
  });

// Service Configuration API
export const fetchServiceConfig = (orgId: string): Promise<ServiceConfiguration> =>
  apiRequest<ServiceConfiguration>(`/service-config/${orgId}`);

export const updateServiceConfig = (orgId: string, config: Partial<ServiceConfiguration>): Promise<ServiceConfiguration> =>
  apiRequest<ServiceConfiguration>(`/service-config/${orgId}`, {
    method: 'PUT',
    body: JSON.stringify(config)
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
  is_hilly_terrain?: boolean;
  has_obstacles?: boolean;
  custom_multipliers?: Record<string, number>;
  custom_surcharges?: Record<string, number>;
  month?: number;
}

export interface QuoteEstimateResponse {
  total_estimated_cents: number;
  breakdown: {
    baseCents: number;
    baseRatePerHaCents: number;
    areaHa: number;
    seasonalMult: number;
    seasonalAdjustedCents: number;
    terrainMult: number;
    multipliedCents: number;
    travelFixedCents: number;
    travelVariableCents: number;
    travelCents: number;
    surchargesCents: number;
    subtotalCents: number;
    minChargeCents: number;
    totalCents: number;
  };
  pricing_snapshot_json: any;
}

export const estimateQuote = async (input: QuoteEstimateInput): Promise<QuoteEstimateResponse> => {
  const response = await fetch('/api/quote-estimate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || 'Quote estimation failed');
  }

  return response.json();
};

// ============================================================================
// CERTIFIED QUOTES API
// ============================================================================

export interface CertifiedQuote {
  org_id: string;
  org_name: string;
  logo_url: string | null;
  total_cents: number;
  distance_km: number;
  rate_card_id: string;
}

export interface CertifiedQuotesResponse {
  quotes: CertifiedQuote[];
}

export interface CertifiedQuotesInput {
  service_type: string;
  area_ha: number;
  location_lat?: number;
  location_lng?: number;
  terrain_conditions?: string;
  crop_type?: string;
  treatment_type?: string;
  month?: number;
}

export const fetchCertifiedQuotes = async (input: CertifiedQuotesInput): Promise<CertifiedQuotesResponse> => {
  const params = new URLSearchParams({
    service_type: input.service_type,
    area_ha: String(input.area_ha),
    ...(input.location_lat && { location_lat: String(input.location_lat) }),
    ...(input.location_lng && { location_lng: String(input.location_lng) }),
    ...(input.terrain_conditions && { terrain_conditions: input.terrain_conditions }),
    ...(input.crop_type && { crop_type: input.crop_type }),
    ...(input.treatment_type && { treatment_type: input.treatment_type }),
    ...(input.month && { month: String(input.month) }),
  });

  const response = await fetch(`/api/certified-quotes?${params.toString()}`, {
    method: 'GET',
    headers: {
      ...getAuthHeaders(),
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || 'Failed to fetch certified quotes');
  }

  return response.json();
};

// ============================================================================
// JOB MARKETPLACE API
// ============================================================================

export interface CreateJobRequest {
  field_name: string;
  service_type: string;
  field_polygon: any;
  area_ha: number;
  location_json?: any;
  requested_window_start?: string;
  requested_window_end?: string;
  constraints_json?: any;
}

export interface Job {
  id: string;
  buyer_org_id: string;
  service_type: string;
  status: string;
  field_name: string;
  field_polygon: string;
  area_ha: number;
  location_json?: string;
  requested_window_start?: string;
  requested_window_end?: string;
  constraints_json?: string;
  created_at: string;
  offers: JobOffer[];
}

export interface JobOffer {
  id: string;
  job_id: string;
  operator_org_id: string;
  status: 'OFFERED' | 'AWARDED' | 'DECLINED' | 'WITHDRAWN';
  pricing_snapshot_json: string;
  total_cents: number;
  currency: string;
  proposed_start?: string;
  proposed_end?: string;
  provider_note?: string;
  operator_org: {
    id: string;
    legal_name: string;
  };
}

// Create a new job
export const createJob = async (jobData: CreateJobRequest): Promise<{ job: Partial<Job> }> => {
  const response = await fetch('/api/jobs', {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(jobData),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || 'Failed to create job');
  }

  return response.json();
};

// Get buyer's jobs
export const getMyJobs = async (): Promise<{ jobs: Job[] }> => {
  const response = await fetch('/api/jobs', {
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || 'Failed to fetch jobs');
  }

  return response.json();
};

// Get available jobs for operators (feed)
export const getAvailableJobs = async (): Promise<{ jobs: Job[] }> => {
  const response = await fetch('/api/jobs/operator/jobs', {
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || 'Failed to fetch available jobs');
  }

  return response.json();
};

// Accept job offer and create booking
export const acceptJobOffer = async (jobId: string, offerId: string): Promise<{
  message: string;
  job: { id: string; status: string };
  booking: { id: string; status: string };
  conversation_unlocked: boolean;
}> => {
  const response = await fetch(`/api/jobs/${jobId}/accept-offer/${offerId}`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || 'Failed to accept offer');
  }

  return response.json();
};

// Pay booking (unlock chat after payment)
export const payBooking = async (bookingId: string): Promise<{
  message: string;
  booking: { id: string; payment_status: string; paid_at: string | null };
  conversation_unlocked: boolean;
}> => {
  const response = await fetch(`/api/bookings/${bookingId}/pay`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || 'Failed to pay booking');
  }

  return response.json();
};

// Get bookings for organization
export const getBookings = async (orgId: string): Promise<{
  bookings: Array<{
    id: string;
    job_id: string;
    accepted_offer_id: string;
    buyer_org_id: string;
    executor_org_id: string;
    service_type: string;
    status: string;
    payment_status: string;
    paid_at: string | null;
    created_at: string;
    job: {
      id: string;
      field_name: string | null;
      area_ha: number | null;
      service_type: string;
      buyer_org: { id: string; legal_name: string };
    };
    accepted_offer: {
      id: string;
      total_cents: number;
      operator_org: { id: string; legal_name: string };
    };
    buyer_org: { id: string; legal_name: string };
    executor_org: { id: string; legal_name: string };
  }>;
}> => {
  console.log('📞 [API] Calling getBookings with orgId:', orgId);
  const response = await fetch(`/api/bookings/${orgId}`, {
    method: 'GET',
    headers: getAuthHeaders(),
  });

  console.log('📞 [API] getBookings response status:', response.status, response.statusText);

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    console.error('❌ [API] getBookings error:', error);
    throw new Error(error.error || 'Failed to fetch bookings');
  }

  const data = await response.json();
  console.log('📞 [API] getBookings response data:', { bookingsCount: data.bookings?.length || 0 });
  return data;
};

// Complete mission (using offer ID - creates/updates booking with status DONE)
export const completeMission = async (offerId: string): Promise<{ message: string; offer_id: string; job_id: string }> => {
  const response = await fetch(`/api/jobs/offers/${offerId}/complete`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || 'Failed to complete mission');
  }

  return response.json();
};

// Create job offer (for operators)
export const createJobOffer = async (jobId: string, offerData: {
  total_cents: number;
  proposed_start?: string;
  proposed_end?: string;
  provider_note?: string;
  pricing_snapshot_json?: any;
}): Promise<{ offer: Partial<JobOffer> }> => {
  const response = await fetch(`/api/jobs/${jobId}/offers`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(offerData),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || 'Failed to create offer');
  }

  return response.json();
};

// Update job offer (for operators)
export const updateJobOffer = async (jobId: string, offerId: string, offerData: {
  total_cents: number;
  proposed_start?: string;
  proposed_end?: string;
  provider_note?: string;
  pricing_snapshot_json?: any;
}): Promise<{ offer: Partial<JobOffer> }> => {
  const response = await fetch(`/api/jobs/${jobId}/offers/${offerId}`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify(offerData),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || 'Failed to update offer');
  }

  return response.json();
};

// ============================================================================
// MESSAGING API
// ============================================================================

export interface Conversation {
  id: string;
  context_type: string;
  context_id: string;
  status: string;
  messages: Message[];
  participants: ConversationParticipant[];
}

export interface ConversationParticipant {
  id: string;
  conversation_id: string;
  org_id: string;
  role: string;
  org: {
    id: string;
    legal_name: string;
  };
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_user_id: string;
  sender_org_id: string;
  body: string;
  attachments_json?: string;
  created_at: string;
  sender: {
    id: string;
    first_name: string;
    last_name: string;
  };
}

// Get conversations
export const getConversations = async (): Promise<{ conversations: Conversation[] }> => {
  const response = await fetch('/api/conversations', {
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || 'Failed to fetch conversations');
  }

  return response.json();
};

// Get conversation messages
export const getConversationMessages = async (conversationId: string): Promise<{ messages: Message[] }> => {
  const response = await fetch(`/api/conversations/${conversationId}/messages`, {
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || 'Failed to fetch messages');
  }

  return response.json();
};

// Send message
export const sendMessage = async (conversationId: string, messageData: {
  body: string;
  attachments_json?: any;
}): Promise<{ message: Message }> => {
  const response = await fetch(`/api/conversations/${conversationId}/messages`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(messageData),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || 'Failed to send message');
  }

  return response.json();
};

// Polling utility for real-time updates (Netlify compatible)
export const startMessagePolling = (
  conversationId: string,
  onNewMessages: (messages: Message[]) => void,
  intervalMs: number = 5000
) => {
  const poll = async () => {
    try {
      const result = await getConversationMessages(conversationId);
      onNewMessages(result.messages);
    } catch (error) {
      console.error('Polling error:', error);
    }
  };

  // Initial poll
  poll();

  // Set up interval
  const intervalId = setInterval(poll, intervalMs);

  // Return cleanup function
  return () => clearInterval(intervalId);
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

// Saved Fields API
export interface SavedField {
  id: string;
  organization_id: string;
  name: string;
  polygon: any;
  area_ha: number;
  location_json?: any;
  created_at: string;
  updated_at: string;
}

export const getSavedFields = async (): Promise<{ fields: SavedField[] }> => {
  const response = await fetch('/api/saved-fields', {
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Errore nel recupero dei campi salvati');
  }

  return response.json();
};

export const saveField = async (field: {
  name: string;
  polygon: any;
  area_ha: number;
  location_json?: any;
}): Promise<{ field: SavedField }> => {
  const response = await fetch('/api/saved-fields', {
    method: 'POST',
    headers: {
      ...getAuthHeaders(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(field),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Errore nel salvataggio del campo');
  }

  return response.json();
};

export const deleteSavedField = async (fieldId: string): Promise<{ message: string }> => {
  const response = await fetch(`/api/saved-fields/${fieldId}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Errore nell\'eliminazione del campo');
  }

  return response.json();
};

// Routing Types
export interface RoutingPoint {
  lng: number;
  lat: number;
}

export interface RoutingResponse {
  distance: {
    text: string;
    value: number; // meters
  };
  duration: {
    text: string;
    value: number | null; // milliseconds
  };
  fallback: boolean;
  navigation_links: {
    google_maps: string;
    apple_maps: string;
    waze: string;
  };
}

export const getDirections = async (
  origin: RoutingPoint | [number, number],
  destination: RoutingPoint | [number, number]
): Promise<RoutingResponse> => {
  const response = await fetch('/api/routing/directions', {
    method: 'POST',
    headers: {
      ...getAuthHeaders(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ origin, destination }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Errore nel calcolo del percorso');
  }

  return response.json();
};

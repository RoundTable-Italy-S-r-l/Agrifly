/**
 * Shared code between client and server
 * Useful to share types between client and server
 * and/or small pure JS functions that can be used on both client and server
 */

/**
 * Example response type for /api/demo
 */
export interface DemoResponse {
  message: string;
}

// Database Models
export interface GisCategory {
  id: string;
  name: string;
  icon: string;
  description: string;
  treatments?: Treatment[];
}

export interface Treatment {
  id: string;
  name: string;
  type: 'liquid' | 'solid';
  targetCrops: string;
  dosage: string;
  operatingSpeed: number;
  marketPriceMin: number;
  marketPriceMax: number;
  categoryId: string;
  category?: GisCategory;
}

export interface Crop {
  id: string;
  name: string;
  yieldPerHa: number;
  marketPrice: number;
  grossRevenue: number;
  tramplingImpact: number;
  tramplingEnabled: boolean;
}

export interface Drone {
  id: string;
  model: string;
  price: number;
  category: string;
  tagline: string;
  targetUse: string;
  imageUrl?: string;
  glbUrl?: string;
  images?: Array<{ url: string; alt?: string; is_primary?: boolean }>;
  tankCapacity: string;
  batteryInfo: string;
  efficiency: string;
  features: string;
  roiMonths: number;
  efficiencyHaPerHour: number;
}

export interface Affiliate {
  id: number;
  name: string;
  region: string;
  zone: string;
  status: 'active' | 'busy' | 'offline';
  jobsDone: number;
  rating: number;
}

export interface GisData {
  area: string;
  points: any[]; // LatLng array
  slope: number;
}

export interface SavedField {
  id: string;
  clientName: string;
  fieldName: string;
  area: string;
  slope: number;
  points: any[]; // LatLng array
  gisData: GisData;
  savedAt: string;
  createdAt: string;
  updatedAt: string;
}

// API Response Types
export interface ApiResponse<T> {
  data?: T;
  error?: string;
}

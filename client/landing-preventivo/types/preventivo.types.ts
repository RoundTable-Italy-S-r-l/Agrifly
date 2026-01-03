import L from "leaflet";

// Tipi base dal sistema esistente
export interface GisData {
  area: string;
  points: L.LatLng[];
  slope: number;
}

export interface Treatment {
  id: string;
  name: string;
  type: "liquid" | "solid";
  categoryId: string;
  marketPriceMin: number;
  marketPriceMax: number;
  operatingSpeed: number;
  dosage: string;
}

export interface GisCategory {
  id: string;
  name: string;
  icon: string;
  description: string;
}

export interface Drone {
  id: string;
  name: string;
  model: string;
  description: string;
  maxPayload: number;
  maxFlightTime: number;
  maxSpeed: number;
  sprayingWidth: number;
  imageUrl?: string;
}

export interface Operator {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  service_tags: string[];
  max_hours_per_day?: number;
  max_ha_per_day?: number;
  home_location?: string;
  status: string;
}

// Tipi specifici per il flusso preventivo
export interface ServiceConfiguration {
  category: GisCategory | null;
  treatment: Treatment | null;
  selectedDrone: Drone | null;
  isHillyTerrain: boolean;
  hasObstacles: boolean;
}

export interface PricingBreakdown {
  serviceBase: number;
  basePricePerHa: number;
  slopeMultiplier: number;
  terrainMultiplier: number;
  obstacleMultiplier: number;
  logistics: number;
  total: number;
  recommendedDrone: string;
}

export interface AvailableOperator {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  distance_km: number;
  daily_rate_cents: number;
  travel_cost_cents: number;
  total_cost_cents: number;
  availability_score: number;
  estimated_days: number;
  service_tags: string[];
  rating?: number;
  review_count?: number;
}

export interface PreventivoState {
  currentStep: 1 | 2 | 3 | 4;
  gisData: GisData | null;
  serviceConfig: ServiceConfiguration;
  pricing: PricingBreakdown | null;
  selectedOperator: AvailableOperator | null;
  autoSelectOperator: boolean; // true = "troviamo noi il migliore"
  isLoading: boolean;
  error: string | null;
}

export interface CheckoutData {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  companyName: string;
  notes?: string;
}

// Step del wizard
export type PreventivoStep = 1 | 2 | 3 | 4;

// Costanti per il design system
export const PREVENTIVO_COLORS = {
  primary: "#10B981", // Emerald
  secondary: "#64748B", // Slate
  accent: "#F59E0B", // Amber
  danger: "#EF4444", // Red
  background: "#FFFFFF", // White
  surface: "#F8FAFC", // Gray-50
} as const;

export const PREVENTIVO_SERVICE_TYPES = {
  SPRAY: {
    label: "Irrorazione",
    icon: "💧",
    color: "bg-blue-50 text-blue-700",
  },
  SPREAD: {
    label: "Spandimento",
    icon: "📦",
    color: "bg-purple-50 text-purple-700",
  },
  MAPPING: {
    label: "Mappatura",
    icon: "🗺️",
    color: "bg-green-50 text-green-700",
  },
} as const;

/**
 * Utility per normalizzare e calcolare metriche prodotti per grafico a ragnatela
 */

// Mapping cluster -> campi normalizzati
// NOTA: Sistema Irrorazione solo per SPRAY, Sistema Spandimento solo per SPREAD
export const METRIC_CLUSTERS = {
  Velivolo: [
    "mtow_spreading_kg",
    "flight_max_radius_m",
    "operating_temperature_min_c",
    "operating_temperature_max_c",
    "flight_max_wind_resistance_ms",
  ],
  "Sistema Irrorazione": [
    "spray_tank_capacity_l",
    "spray_payload_max_kg",
    "spray_effective_width_m",
  ],
  "Sistema Spandimento": [
    "spreading_tank_capacity_l",
    "spreading_payload_max_kg",
    "spreading_effective_width_m",
  ],
  Batteria: ["battery_weight_kg", "battery_capacity_mah"],
  Caricatore: ["charger_charge_time_min"],
  Generatore: ["generator_fuel_consumption_ml_kwh"],
  Radar: ["radar_detection_range_m"],
};

// Cluster per purpose specifico (massimo 6 cluster per grafico)
export const CLUSTERS_BY_PURPOSE: Record<string, string[]> = {
  SPRAY: [
    "Velivolo",
    "Sistema Irrorazione",
    "Batteria",
    "Caricatore",
    "Generatore",
    "Radar",
  ],
  SPREAD: [
    "Velivolo",
    "Sistema Spandimento",
    "Batteria",
    "Caricatore",
    "Generatore",
    "Radar",
  ],
  MAPPING: [
    "Velivolo",
    "Batteria",
    "Caricatore",
    "Radar",
    "RGB_CAMERA",
    "FLIGHT_PERFORMANCE",
  ],
};

// Mapping chiavi normalizzate -> label display
export const METRIC_LABELS: Record<string, string> = {
  mtow_spreading_kg: "Peso max decollo (kg)",
  flight_max_radius_m: "Raggio max volo (m)",
  operating_temperature_min_c: "Temp. operativa min (°C)",
  operating_temperature_max_c: "Temp. operativa max (°C)",
  flight_max_wind_resistance_ms: "Resistenza vento (m/s)",
  spray_tank_capacity_l: "Capacità serbatoio (L)",
  spray_payload_max_kg: "Carico max (kg)",
  spray_effective_width_m: "Larghezza effettiva (m)",
  spreading_tank_capacity_l: "Capacità serbatoio (L)",
  spreading_payload_max_kg: "Carico max (kg)",
  spreading_effective_width_m: "Larghezza effettiva (m)",
  battery_weight_kg: "Peso batteria (kg)",
  battery_capacity_mah: "Capacità batteria (mAh)",
  charger_charge_time_min: "Tempo ricarica (min)",
  generator_fuel_consumption_ml_kwh: "Consumo carburante (mL/kWh)",
  radar_detection_range_m: "Portata radar (m)",
};

/**
 * Estrae valore numerico da stringa (gestisce range come "4-7" prendendo il max)
 */
export function extractNumericValue(value: any): number | null {
  if (typeof value === "number") return value;
  if (typeof value !== "string") return null;

  // Normalizza: rimuovi spazi multipli, converti virgole in punti
  let cleaned = value.trim();

  // Gestisci range (es. "4-7 m" -> 7, "9-12 minutes" -> 12)
  // Cerca pattern tipo "numero-numero" o "numero - numero"
  const rangeMatch = cleaned.match(/(\d+[.,]?\d*)\s*[-–—]\s*(\d+[.,]?\d*)/);
  if (rangeMatch) {
    const min = parseFloat(rangeMatch[1].replace(",", "."));
    const max = parseFloat(rangeMatch[2].replace(",", "."));
    if (!isNaN(min) && !isNaN(max)) {
      return Math.max(min, max); // Prendi il valore massimo del range
    }
  }

  // Estrai primo numero trovato (gestisce anche decimali con virgola)
  const numberMatch = cleaned.match(/(\d+[.,]?\d*)/);
  if (numberMatch) {
    const num = parseFloat(numberMatch[1].replace(",", "."));
    return isNaN(num) ? null : num;
  }

  return null;
}

/**
 * Normalizza specs di un prodotto in metriche per cluster
 */
export function normalizeProductSpecs(
  specs: any[],
): Record<string, number | null> {
  const metrics: Record<string, number | null> = {};

  if (!Array.isArray(specs)) return metrics;

  specs.forEach((spec) => {
    const key = spec.key || "";
    const value = extractNumericValue(spec.value);

    if (value !== null) {
      metrics[key] = value;
    }
  });

  return metrics;
}

/**
 * Calcola min/max per ogni metrica tra prodotti con stesso purpose
 */
export function calculateMinMax(
  allProductsMetrics: Array<{
    productId: string;
    metrics: Record<string, number | null>;
  }>,
): Record<string, { min: number; max: number }> {
  const minMax: Record<string, { min: number; max: number }> = {};

  // Raccogli tutti i valori per ogni metrica
  const metricValues: Record<string, number[]> = {};

  allProductsMetrics.forEach(({ metrics }) => {
    Object.entries(metrics).forEach(([key, value]) => {
      if (value !== null) {
        if (!metricValues[key]) metricValues[key] = [];
        metricValues[key].push(value);
      }
    });
  });

  // Calcola min/max per ogni metrica
  Object.entries(metricValues).forEach(([key, values]) => {
    if (values.length > 0) {
      minMax[key] = {
        min: Math.min(...values),
        max: Math.max(...values),
      };
    }
  });

  return minMax;
}

/**
 * Normalizza valore tra 0-100 basandosi su min/max
 */
export function normalizeValue(
  value: number | null,
  min: number,
  max: number,
): number {
  if (value === null || min === max) return 50; // Default a metà se non disponibile o tutti uguali

  // Normalizza tra 0-100
  const normalized = ((value - min) / (max - min)) * 100;
  return Math.max(0, Math.min(100, normalized)); // Clamp tra 0-100
}

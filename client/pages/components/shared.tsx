import type { Drone, Crop, Treatment } from "@/lib/api";

/**
 * @deprecated This hardcoded pricing function is deprecated.
 * Use the /api/quote-estimate endpoint instead, which calculates pricing
 * based on rate_cards configured by operators/vendors.
 *
 * This function is kept for backward compatibility only and should not be used in new code.
 */
export const BASE_RATE_PER_HA = 45;
export const LOGISTICS_FIXED = 100;
export const KM_RATE = 0.5;

/**
 * @deprecated Use /api/quote-estimate endpoint instead
 * This function uses hardcoded values and doesn't respect operator/vendor rate_card configurations
 */
export const calculatePricing = (
  area: number,
  slope: number,
  distance_km: number = 20,
  treatment: Treatment | null = null,
  isHilly: boolean = false,
  hasObstacles: boolean = false,
) => {
  console.warn(
    "⚠️  calculatePricing is deprecated. Use /api/quote-estimate endpoint instead.",
  );

  let slopeMultiplier = 1.0;
  let recommendedDrone = "DJI Agras T50";

  // Base price from treatment or default
  const basePricePerHa = treatment
    ? (treatment.marketPriceMin + treatment.marketPriceMax) / 2
    : BASE_RATE_PER_HA;

  // Slope multiplier from terrain data
  if (slope <= 10) {
    slopeMultiplier = 1.0;
    recommendedDrone = area > 20 ? "DJI Agras T50" : "DJI Agras T30";
  } else if (slope <= 20) {
    slopeMultiplier = 1.2;
    recommendedDrone = "DJI Agras T30";
  } else {
    slopeMultiplier = 1.5;
    recommendedDrone = "DJI Agras T30";
  }

  // Additional complexity multipliers
  const terrainMultiplier = isHilly ? 1.2 : 1.0;
  const obstacleMultiplier = hasObstacles ? 1.15 : 1.0;

  const serviceBase =
    area *
    basePricePerHa *
    slopeMultiplier *
    terrainMultiplier *
    obstacleMultiplier;
  const logistics = LOGISTICS_FIXED + distance_km * KM_RATE;
  const total = serviceBase + logistics;

  return {
    serviceBase,
    basePricePerHa,
    slopeMultiplier,
    terrainMultiplier,
    obstacleMultiplier,
    logistics,
    total,
    recommendedDrone,
  };
};

export const calculateROI = (
  drone: Drone,
  hectaresPerYear: number = 500,
  crop: Crop,
  treatment: Treatment,
  interventionsPerYear: number = 1,
  isHilly: boolean = false,
) => {
  const terrainMultiplier = isHilly ? 1.4 : 1.0;
  const speedReduction = isHilly ? 0.7 : 1.0;

  const croppingDamageSaved = crop.tramplingEnabled
    ? hectaresPerYear *
      crop.grossRevenue *
      crop.tramplingImpact *
      interventionsPerYear
    : 0;

  const avgTreatmentPrice =
    (treatment.marketPriceMin + treatment.marketPriceMax) / 2;
  const externalServiceCost =
    hectaresPerYear *
    avgTreatmentPrice *
    terrainMultiplier *
    interventionsPerYear;

  const droneOperatingCost = hectaresPerYear * 2.5 * interventionsPerYear;
  const serviceSavings = externalServiceCost - droneOperatingCost;

  const chemicalSavings =
    treatment.type === "liquid"
      ? hectaresPerYear * 150 * 0.18 * interventionsPerYear
      : 0;
  const waterSavings =
    treatment.type === "liquid"
      ? hectaresPerYear * 50 * interventionsPerYear
      : 0;

  const totalAnnualSavings =
    croppingDamageSaved + serviceSavings + chemicalSavings + waterSavings;

  const operatingHoursPerYear =
    (hectaresPerYear / (treatment.operatingSpeed * speedReduction)) *
    interventionsPerYear;
  const potentialServiceRevenue =
    hectaresPerYear * avgTreatmentPrice * interventionsPerYear;

  const breakEvenMonths =
    totalAnnualSavings > 0
      ? Math.ceil((drone.price / totalAnnualSavings) * 12)
      : 999;

  return {
    croppingDamageSaved,
    serviceSavings,
    chemicalSavings,
    waterSavings,
    droneOperatingCost,
    externalServiceCost,
    totalAnnualSavings,
    potentialServiceRevenue,
    operatingHoursPerYear,
    breakEvenMonths,
    firstYearProfit: totalAnnualSavings - drone.price,
  };
};

export const Badge = ({
  children,
  color = "emerald",
}: {
  children: React.ReactNode;
  color?: string;
}) => {
  const colors = {
    emerald: "bg-emerald-100 text-emerald-800",
    amber: "bg-amber-100 text-amber-800",
    slate: "bg-slate-100 text-slate-600",
    red: "bg-red-100 text-red-600",
  };
  return (
    <span
      className={`px-2 py-1 rounded-full text-xs font-bold ${colors[color as keyof typeof colors] || colors.emerald}`}
    >
      {children}
    </span>
  );
};

export const Button = ({
  children,
  onClick,
  variant = "primary",
  className = "",
  disabled = false,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "outline" | "ghost";
  className?: string;
  disabled?: boolean;
}) => {
  const baseStyle =
    "px-4 py-2 rounded-lg font-bold transition flex items-center gap-2 justify-center";
  const variants = {
    primary: "bg-emerald-600 text-white hover:bg-emerald-700 shadow-md",
    secondary: "bg-slate-800 text-white hover:bg-slate-700",
    outline:
      "border-2 border-slate-200 text-slate-700 hover:border-emerald-500 hover:text-emerald-600",
    ghost: "text-slate-500 hover:bg-slate-100",
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${baseStyle} ${variants[variant]} ${className}`}
    >
      {children}
    </button>
  );
};

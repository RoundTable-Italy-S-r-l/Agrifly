import { useState, useCallback } from "react";
import {
  PreventivoState,
  GisData,
  ServiceConfiguration,
  PricingBreakdown,
  AvailableOperator,
  PreventivoStep,
} from "../types/preventivo.types";
import { estimateQuote, QuoteEstimateInput } from "@/lib/api";

const DEFAULT_SELLER_ORG_ID = "org_default";

const initialServiceConfig: ServiceConfiguration = {
  category: null,
  treatment: null,
  selectedDrone: null,
  isHillyTerrain: false,
  hasObstacles: false,
};

const initialState: PreventivoState = {
  currentStep: 1,
  gisData: null,
  serviceConfig: initialServiceConfig,
  pricing: null,
  selectedOperator: null,
  autoSelectOperator: true, // Default: "troviamo noi il migliore"
  isLoading: false,
  error: null,
};

export function usePreventivoState() {
  const [state, setState] = useState<PreventivoState>(initialState);

  // Navigation
  const goToStep = useCallback((step: PreventivoStep) => {
    setState((prev) => ({ ...prev, currentStep: step, error: null }));
  }, []);

  const nextStep = useCallback(() => {
    setState((prev) => ({
      ...prev,
      currentStep: Math.min(prev.currentStep + 1, 4) as PreventivoStep,
      error: null,
    }));
  }, []);

  const prevStep = useCallback(() => {
    setState((prev) => ({
      ...prev,
      currentStep: Math.max(prev.currentStep - 1, 1) as PreventivoStep,
      error: null,
    }));
  }, []);

  // GIS Data management
  const setGisData = useCallback((gisData: GisData) => {
    setState((prev) => ({ ...prev, gisData, error: null }));
  }, []);

  // Service configuration
  const updateServiceConfig = useCallback(
    (updates: Partial<ServiceConfiguration>) => {
      setState((prev) => ({
        ...prev,
        serviceConfig: { ...prev.serviceConfig, ...updates },
        error: null,
      }));
    },
    [],
  );

  // Pricing calculation
  const calculatePricing = useCallback(async () => {
    if (!state.gisData || !state.serviceConfig.treatment) {
      setState((prev) => ({
        ...prev,
        error: "Dati mancanti per il calcolo del preventivo",
      }));
      return;
    }

    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      // Determine service type
      const service_type =
        state.serviceConfig.treatment.type === "solid" ? "SPANDIMENTO" : "IRRORAZIONE";

      // Determine risk multiplier
      let risk_key: string | undefined;
      if (
        state.serviceConfig.hasObstacles &&
        state.serviceConfig.isHillyTerrain
      ) {
        risk_key = "high";
      } else if (
        state.serviceConfig.hasObstacles ||
        state.serviceConfig.isHillyTerrain
      ) {
        risk_key = "medium";
      }

      const input: QuoteEstimateInput = {
        seller_org_id: DEFAULT_SELLER_ORG_ID,
        service_type,
        area_ha: parseFloat(state.gisData.area),
        distance_km: 20, // Default distance
        risk_key,
        month: new Date().getMonth() + 1,
      };

      const response = await estimateQuote(input);

      // Convert to our format
      const area = parseFloat(state.gisData.area);
      const basePricePerHa = response.breakdown.baseCents / area / 100;
      const logistics = response.breakdown.travelCents / 100;
      const serviceBase = response.breakdown.multipliedCents / 100;

      // Determine recommended drone
      let recommendedDrone = "DJI Agras T50";
      if (state.gisData.slope <= 10) {
        recommendedDrone = area > 20 ? "DJI Agras T50" : "DJI Agras T30";
      } else {
        recommendedDrone = "DJI Agras T30";
      }

      const pricing: PricingBreakdown = {
        serviceBase,
        basePricePerHa,
        slopeMultiplier: response.breakdown.seasonalMult,
        terrainMultiplier: response.breakdown.riskMult,
        obstacleMultiplier: 1.0, // Included in risk multiplier
        logistics,
        total: response.total_estimated_cents / 100,
        recommendedDrone,
      };

      setState((prev) => ({ ...prev, pricing, isLoading: false }));
    } catch (error: any) {
      console.error("Error calculating pricing:", error);
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: error.message || "Errore nel calcolo del preventivo",
      }));
    }
  }, [state.gisData, state.serviceConfig]);

  // Operator selection
  const setOperatorSelection = useCallback(
    (operator: AvailableOperator | null, autoSelect: boolean = false) => {
      setState((prev) => ({
        ...prev,
        selectedOperator: operator,
        autoSelectOperator: autoSelect,
        error: null,
      }));
    },
    [],
  );

  // Reset state
  const reset = useCallback(() => {
    setState(initialState);
  }, []);

  // Validation
  const canProceedToStep = useCallback(
    (targetStep: PreventivoStep): boolean => {
      switch (targetStep) {
        case 2:
          return !!state.gisData;
        case 3:
          return (
            !!state.gisData &&
            !!state.serviceConfig.category &&
            !!state.serviceConfig.treatment &&
            !!state.serviceConfig.selectedDrone
          );
        case 4:
          return (
            !!state.pricing &&
            (!!state.selectedOperator || state.autoSelectOperator)
          );
        default:
          return true;
      }
    },
    [state],
  );

  return {
    state,
    actions: {
      goToStep,
      nextStep,
      prevStep,
      setGisData,
      updateServiceConfig,
      calculatePricing,
      setOperatorSelection,
      reset,
    },
    canProceedToStep,
  };
}

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { GisMapSelector } from "./components/GisMapSelector";
import { ServiceConfigurator } from "./components/ServiceConfigurator";
import { OperatorMatcher } from "./components/OperatorMatcher";
import { CheckoutForm } from "./components/CheckoutForm";
import { usePreventivoState } from "./hooks/usePreventivoState";
import { CheckoutData, PreventivoStep } from "./types/preventivo.types";
import { Layout } from "@/components/Layout";

export default function PreventivoLanding() {
  const navigate = useNavigate();
  const { state, actions } = usePreventivoState();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Progress indicator
  const steps = [
    { id: 1, label: "Campo", description: "Seleziona area" },
    { id: 2, label: "Servizio", description: "Configura intervento" },
    { id: 3, label: "Operatore", description: "Scegli professionista" },
    { id: 4, label: "Conferma", description: "Completa prenotazione" },
  ];

  const handleGisComplete = (gisData: any) => {
    actions.setGisData(gisData);
    actions.nextStep();
  };

  const handleServiceConfigured = () => {
    if (actions.canProceedToStep(3)) {
      actions.nextStep();
    }
  };

  const handleOperatorSelected = () => {
    if (actions.canProceedToStep(4)) {
      actions.nextStep();
    }
  };

  const handleCheckoutSubmit = async (checkoutData: CheckoutData) => {
    setIsSubmitting(true);

    try {
      // Check if field data is already saved from ServiziGIS page
      let existingFieldData = localStorage.getItem("temp_field_data");

      if (!existingFieldData) {
        // Save field data temporarily for anonymous users
        const fieldData = {
          field_polygon: state.gisData?.polygon,
          area_ha: state.gisData?.area_ha,
          location_json: state.gisData?.location,
          service_type: state.serviceConfig?.serviceType,
          crop_type: state.serviceConfig?.cropType,
          treatment_type: state.serviceConfig?.treatmentType,
          terrain_conditions: state.serviceConfig?.terrainConditions,
          field_name:
            state.gisData?.fieldName ||
            `Campo ${state.gisData?.area_ha?.toFixed(2)} ha`,
          timestamp: Date.now(),
        };

        localStorage.setItem("temp_field_data", JSON.stringify(fieldData));
        existingFieldData = JSON.stringify(fieldData);
        console.log("💾 Field data saved from PreventivoLanding:", fieldData);
      } else {
        // Update existing data with service configuration
        const existingData = JSON.parse(existingFieldData);
        const updatedData = {
          ...existingData,
          service_type:
            state.serviceConfig?.serviceType || existingData.service_type,
          crop_type: state.serviceConfig?.cropType || existingData.crop_type,
          treatment_type:
            state.serviceConfig?.treatmentType || existingData.treatment_type,
          terrain_conditions:
            state.serviceConfig?.terrainConditions ||
            existingData.terrain_conditions,
        };
        localStorage.setItem("temp_field_data", JSON.stringify(updatedData));
        console.log("📝 Field data updated with service config:", updatedData);
      }

      toast.info("Dati salvati! Procedi con la registrazione.", {
        description:
          "I tuoi dati del campo sono stati salvati temporaneamente.",
      });

      // Navigate to login with registration flag and redirect to nuovo-preventivo
      setTimeout(() => {
        navigate("/login?mode=register&redirect=nuovo-preventivo");
      }, 1500);
    } catch (error) {
      toast.error("Errore nel salvataggio dei dati", {
        description: "Riprova più tardi o contatta il supporto.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBack = () => {
    if (state.currentStep === 1) {
      navigate("/");
    } else {
      actions.prevStep();
    }
  };

  return (
    <Layout>
      <div className="min-h-screen bg-slate-50">
        {/* Header with Progress */}
        <div className="bg-white border-b border-slate-200 sticky top-0 z-10">
          <div className="max-w-6xl mx-auto px-4 py-4">
            <div className="flex items-center justify-between mb-4">
              <button
                onClick={handleBack}
                className="text-slate-600 hover:text-slate-900 transition"
              >
                ← {state.currentStep === 1 ? "Torna alla home" : "Indietro"}
              </button>
              <div className="text-center">
                <h1 className="text-2xl font-bold text-slate-900">
                  Richiedi Preventivo
                </h1>
                <p className="text-sm text-slate-600 mt-1">
                  Preventivo gratuito e senza impegno per trattamenti con droni
                </p>
              </div>
              <div className="w-20"></div> {/* Spacer for centering */}
            </div>

            {/* Progress Bar */}
            <div className="flex items-center justify-between">
              {steps.map((step, index) => (
                <div key={step.id} className="flex items-center">
                  <div
                    className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold ${
                      state.currentStep >= step.id
                        ? "bg-emerald-600 text-white"
                        : "bg-slate-200 text-slate-600"
                    }`}
                  >
                    {state.currentStep > step.id ? "✓" : step.id}
                  </div>

                  <div className="ml-3">
                    <div
                      className={`text-sm font-medium ${
                        state.currentStep >= step.id
                          ? "text-emerald-700"
                          : "text-slate-500"
                      }`}
                    >
                      {step.label}
                    </div>
                    <div className="text-xs text-slate-400">
                      {step.description}
                    </div>
                  </div>

                  {index < steps.length - 1 && (
                    <div
                      className={`flex-1 h-0.5 mx-4 ${
                        state.currentStep > step.id
                          ? "bg-emerald-600"
                          : "bg-slate-200"
                      }`}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-6xl mx-auto px-4 py-8">
          {state.error && (
            <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-700">⚠️ {state.error}</p>
            </div>
          )}

          {/* Step Content */}
          {state.currentStep === 1 && (
            <GisMapSelector
              onComplete={handleGisComplete}
              onBack={handleBack}
            />
          )}

          {state.currentStep === 2 && state.gisData && (
            <ServiceConfigurator
              gisData={state.gisData}
              serviceConfig={state.serviceConfig}
              pricing={state.pricing}
              isLoadingPricing={state.isLoading}
              onUpdateConfig={actions.updateServiceConfig}
              onCalculatePricing={actions.calculatePricing}
              onBack={handleBack}
              onProceed={handleServiceConfigured}
            />
          )}

          {state.currentStep === 3 && state.gisData && state.pricing && (
            <OperatorMatcher
              gisData={state.gisData}
              serviceConfig={state.serviceConfig}
              pricing={state.pricing}
              selectedOperator={state.selectedOperator}
              autoSelectOperator={state.autoSelectOperator}
              onSelectOperator={actions.setOperatorSelection}
              onBack={handleBack}
              onProceed={handleOperatorSelected}
            />
          )}

          {state.currentStep === 4 && state.gisData && state.pricing && (
            <CheckoutForm
              gisData={state.gisData}
              serviceConfig={state.serviceConfig}
              pricing={state.pricing}
              selectedOperator={state.selectedOperator}
              autoSelectOperator={state.autoSelectOperator}
              onBack={handleBack}
              onSubmit={handleCheckoutSubmit}
              isSubmitting={isSubmitting}
            />
          )}
        </div>

        {/* Footer */}
        <footer className="bg-slate-900 text-white mt-16">
          <div className="max-w-6xl mx-auto px-4 py-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div>
                <h3 className="font-bold text-lg mb-4">DJI Agras</h3>
                <p className="text-slate-300 text-sm">
                  Specialisti in trattamenti agricoli con droni DJI. Tecnologia
                  avanzata per agricoltura di precisione.
                </p>
              </div>

              <div>
                <h4 className="font-semibold mb-4">Servizi</h4>
                <ul className="space-y-2 text-sm text-slate-300">
                  <li>Trattamenti fitosanitari</li>
                  <li>Spandimento fertilizzanti</li>
                  <li>Rilievo aereo</li>
                  <li>Monitoraggio colture</li>
                </ul>
              </div>

              <div>
                <h4 className="font-semibold mb-4">Contatti</h4>
                <div className="text-sm text-slate-300 space-y-1">
                  <p>📧 info@djiagras.it</p>
                  <p>📞 +39 0461 123 456</p>
                  <p>📍 Trento, Trentino-Alto Adige</p>
                </div>
              </div>
            </div>

            <div className="border-t border-slate-800 mt-8 pt-6 text-center text-sm text-slate-400">
              <p>&copy; 2025 DJI Agras. Tutti i diritti riservati.</p>
            </div>
          </div>
        </footer>
      </div>
    </Layout>
  );
}

import { useNavigate } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { GisMapSelector } from '../landing-preventivo/components/GisMapSelector';

const SimpleFieldSelector = () => {
  const navigate = useNavigate();

  const handleGisComplete = (data: any) => {
    console.log('🎯 Campo selezionato dal GisMapSelector originale:', data);

    // Save field data temporarily for anonymous flow
    const fieldData = {
      field_polygon: data.polygon,
      area_ha: data.area_ha,
      location_json: data.location,
      field_name: `Campo ${data.area_ha.toFixed(1)} ha`,
      timestamp: Date.now()
    };

    localStorage.setItem('temp_field_data', JSON.stringify(fieldData));
    console.log('💾 Field data saved:', fieldData);

    // Navigate to login/registration
    navigate('/login?mode=register&redirect=nuovo-preventivo');
    console.log('✅ Navigation triggered to login');
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">Servizi GIS Agricoli</h1>
        <p className="text-slate-600">Seleziona il tuo campo e richiedi un preventivo per i nostri servizi</p>
      </div>

      {/* GIS Map Component - Il componente originale completo */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
        <GisMapSelector onComplete={handleGisComplete} />
      </div>

      {/* Actions Section */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <div className="text-center">
          <h3 className="text-lg font-semibold text-slate-900 mb-2">Come funziona</h3>
          <p className="text-slate-600 text-sm mb-4">
            Usa gli strumenti della mappa per selezionare il tuo campo. Quando hai finito, clicca "Procedi al Configuratore" per continuare con la richiesta di preventivo.
          </p>
          <p className="text-xs text-slate-500">
            Verrai reindirizzato alla pagina di registrazione/login dove potrai completare la tua richiesta.
          </p>
        </div>
      </div>
    </div>
  );
};

export default function ServiziGIS() {
  return (
    <Layout>
      <SimpleFieldSelector />
    </Layout>
  );
}
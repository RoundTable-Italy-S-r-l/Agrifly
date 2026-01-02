import React from 'react';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Legend } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ProductMetricsResponse } from '@/lib/api';

interface ProductRadarChartProps {
  metrics: ProductMetricsResponse;
}

// Helper per formattare valori metriche con unità corrette
function formatMetricValue(value: number | null, key: string): string {
  if (value === null) return 'N/A';
  
  const formatted = typeof value === 'number' ? value.toLocaleString('it-IT', { maximumFractionDigits: 1 }) : value;
  
  if (key.includes('temperature')) return `${formatted}°C`;
  if (key.includes('capacity') && key.includes('mah')) return `${formatted} mAh`;
  if (key.includes('capacity')) return `${formatted} L`;
  if (key.includes('weight') || key.includes('payload') || key.includes('mtow')) return `${formatted} kg`;
  if (key.includes('width') || key.includes('radius') || key.includes('range') || key.includes('detection')) return `${formatted} m`;
  if (key.includes('time') || key.includes('charge')) return `${formatted} min`;
  if (key.includes('consumption')) return `${formatted} mL/kWh`;
  if (key.includes('resistance') || key.includes('wind')) return `${formatted} m/s`;
  
  return String(formatted);
}

export function ProductRadarChart({ metrics }: ProductRadarChartProps) {
  // Raccogli tutte le metriche da tutti i cluster in un array per il grafico
  const allMetrics: Array<{ 
    metric: string; 
    value: number; 
    cluster: string;
    rawValue: number | null;
    min: number;
    max: number;
  }> = [];
  
  Object.entries(metrics.clusters).forEach(([cluster, clusterMetrics]) => {
    clusterMetrics.forEach(metric => {
      allMetrics.push({
        metric: metric.label,
        value: metric.value,
        cluster,
        rawValue: metric.rawValue,
        min: metric.min,
        max: metric.max
      });
    });
  });
  
  if (allMetrics.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Confronto con altri prodotti</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-600">Metriche non disponibili per questo prodotto.</p>
        </CardContent>
      </Card>
    );
  }
  
  // Prepara dati per Recharts (formato richiesto)
  const chartData = allMetrics.map(m => ({
    metric: m.metric,
    value: m.value,
    fullMark: 100
  }));
  
  // Colori per cluster
  const clusterColors: Record<string, string> = {
    'Velivolo': '#10b981', // emerald
    'Sistema Irrorazione': '#3b82f6', // blue
    'Sistema Spandimento': '#8b5cf6', // purple
    'Batteria': '#f59e0b', // amber
    'Caricatore': '#ef4444', // red
    'Generatore': '#06b6d4', // cyan
    'Radar': '#ec4899' // pink
  };
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>Confronto con altri prodotti ({metrics.purposes.join(', ')})</CardTitle>
        <p className="text-sm text-slate-500 mt-2">
          Il grafico mostra come questo prodotto si posiziona rispetto agli altri prodotti con lo stesso purpose.
          I valori sono normalizzati su una scala 0-100 basata sui min/max del gruppo.
        </p>
      </CardHeader>
      <CardContent>
        <div className="w-full h-[500px]">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={chartData}>
              <PolarGrid stroke="#e5e7eb" />
              <PolarAngleAxis 
                dataKey="metric" 
                tick={{ fill: '#64748b', fontSize: 12 }}
                style={{ fontSize: '12px' }}
              />
              <PolarRadiusAxis 
                angle={90} 
                domain={[0, 100]}
                tick={{ fill: '#94a3b8', fontSize: 10 }}
              />
              <Radar
                name={metrics.productName}
                dataKey="value"
                stroke="#4f46e5"
                fill="#4f46e5"
                fillOpacity={0.6}
                strokeWidth={2}
              />
              <Legend 
                wrapperStyle={{ paddingTop: '20px' }}
                formatter={(value) => <span className="text-sm text-slate-700">{value}</span>}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}


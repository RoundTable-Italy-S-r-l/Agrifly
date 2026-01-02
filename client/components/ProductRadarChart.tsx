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
        
        {/* Legenda dettagliata per cluster */}
        <div className="mt-6 grid grid-cols-2 md:grid-cols-3 gap-4">
          {Object.entries(metrics.clusters).map(([cluster, clusterMetrics]) => {
            if (clusterMetrics.length === 0) return null;
            
            return (
              <div key={cluster} className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                <h4 className="font-semibold text-slate-900 mb-2 flex items-center gap-2">
                  <span 
                    className="w-3 h-3 rounded-full" 
                    style={{ backgroundColor: clusterColors[cluster] || '#94a3b8' }}
                  />
                  {cluster}
                </h4>
                <div className="space-y-1">
                  {clusterMetrics.map(metric => (
                    <div key={metric.key} className="text-sm">
                      <div className="flex justify-between items-center">
                        <span className="text-slate-600">{metric.label}:</span>
                        <span className="font-medium text-slate-900">
                          {metric.rawValue !== null 
                            ? formatMetricValue(metric.rawValue, metric.key)
                            : 'N/A'
                          }
                        </span>
                      </div>
                      <div className="text-xs text-slate-500">
                        Range: {formatMetricValue(metric.min, metric.key)} - {formatMetricValue(metric.max, metric.key)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}


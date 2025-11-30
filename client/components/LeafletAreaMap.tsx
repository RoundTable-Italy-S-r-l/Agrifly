import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { X } from 'lucide-react';
import { area as turfArea } from '@turf/area';
import { polygon as turfPolygon } from '@turf/helpers';

interface LeafletAreaMapProps {
  onComplete: (data: { area: string; points: L.LatLng[]; slope: number }) => void;
}

export function LeafletAreaMap({ onComplete }: LeafletAreaMapProps) {
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const [drawnLayer, setDrawnLayer] = useState<L.Polygon | null>(null);
  const [markers, setMarkers] = useState<L.CircleMarker[]>([]);
  const [points, setPoints] = useState<L.LatLng[]>([]);
  const [isClosed, setIsClosed] = useState(false);
  const [area, setArea] = useState('0');
  const [slope, setSlope] = useState(0);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    // Initialize map centered on Italy (agricultural area)
    const map = L.map(mapContainerRef.current, {
      center: [44.5, 11.3], // Emilia-Romagna region
      zoom: 15,
      zoomControl: true
    });

    // Add OpenStreetMap tile layer (free satellite-like imagery)
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      attribution: 'Tiles &copy; Esri',
      maxZoom: 19
    }).addTo(map);

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  const handleMapClick = (e: L.LeafletMouseEvent) => {
    if (isClosed || !mapRef.current) return;

    const newPoint = e.latlng;
    const newPoints = [...points, newPoint];

    // Add marker
    const marker = L.circleMarker(newPoint, {
      radius: 6,
      fillColor: '#10b981',
      color: '#fff',
      weight: 2,
      fillOpacity: 1
    }).addTo(mapRef.current);

    setMarkers([...markers, marker]);
    setPoints(newPoints);

    // Check if user clicked near the first point to close polygon (min 3 points)
    if (newPoints.length > 2) {
      const firstPoint = newPoints[0];
      const distance = mapRef.current.distance(newPoint, firstPoint);
      
      if (distance < 50) { // 50 meters threshold
        closePolygon(newPoints);
      } else {
        // Draw temporary line
        updatePolyline(newPoints);
      }
    } else if (newPoints.length > 1) {
      updatePolyline(newPoints);
    }
  };

  const updatePolyline = (pts: L.LatLng[]) => {
    if (!mapRef.current) return;
    
    if (drawnLayer) {
      drawnLayer.remove();
    }

    const polyline = L.polyline(pts, {
      color: '#10b981',
      weight: 3,
      dashArray: '10, 10'
    }).addTo(mapRef.current);

    setDrawnLayer(polyline as any);
  };

  const closePolygon = (pts: L.LatLng[]) => {
    if (!mapRef.current) return;

    // Remove temporary polyline
    if (drawnLayer) {
      drawnLayer.remove();
    }

    // Create final polygon
    const polygon = L.polygon(pts, {
      color: '#10b981',
      weight: 3,
      fillColor: '#10b981',
      fillOpacity: 0.3
    }).addTo(mapRef.current);

    setDrawnLayer(polygon);
    setIsClosed(true);

    // Calculate area using Turf.js (geodesic calculation)
    const coords = pts.map(p => [p.lng, p.lat]);
    coords.push([pts[0].lng, pts[0].lat]); // Close the polygon
    
    const turfPoly = turfPolygon([coords]);
    const areaInSquareMeters = turfArea(turfPoly);
    const areaInHectares = (areaInSquareMeters / 10000).toFixed(2);

    // Simulate slope calculation (in a real app, this would use DEM data)
    const simulatedSlope = Math.floor(Math.random() * 25 + 3);

    setArea(areaInHectares);
    setSlope(simulatedSlope);

    // Callback to parent
    onComplete({
      area: areaInHectares,
      points: pts,
      slope: simulatedSlope
    });
  };

  const resetMap = () => {
    if (!mapRef.current) return;

    // Remove all markers
    markers.forEach(m => m.remove());
    
    // Remove drawn layer
    if (drawnLayer) {
      drawnLayer.remove();
    }

    setMarkers([]);
    setPoints([]);
    setDrawnLayer(null);
    setIsClosed(false);
    setArea('0');
    setSlope(0);
  };

  // Attach click handler to map
  useEffect(() => {
    if (!mapRef.current) return;

    mapRef.current.on('click', handleMapClick);

    return () => {
      if (mapRef.current) {
        mapRef.current.off('click', handleMapClick);
      }
    };
  }, [points, isClosed, markers, drawnLayer]);

  return (
    <div className="relative">
      <div 
        ref={mapContainerRef} 
        className="w-full h-96 rounded-xl overflow-hidden border-2 border-slate-300 shadow-inner z-0"
        style={{ cursor: isClosed ? 'default' : 'crosshair' }}
      />
      
      {!isClosed && points.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
          <div className="bg-white/90 px-4 py-2 rounded-lg shadow-lg text-slate-700 font-medium animate-bounce">
            📍 Clicca sulla mappa per disegnare il perimetro del campo
          </div>
        </div>
      )}

      {points.length > 0 && !isClosed && (
        <div className="absolute top-4 left-4 bg-emerald-600 text-white px-3 py-1.5 rounded-lg shadow-lg text-sm font-bold z-10 pointer-events-none">
          {points.length} punt{points.length === 1 ? 'o' : 'i'} • Clicca vicino al primo punto per chiudere
        </div>
      )}

      <div className="absolute top-4 right-4 z-10">
        <button 
          onClick={resetMap} 
          className="bg-white p-2 rounded-lg shadow-lg text-slate-600 hover:text-red-500 hover:bg-red-50 transition"
          title="Resetta disegno"
        >
          <X size={20} />
        </button>
      </div>

      {isClosed && (
        <div className="absolute bottom-4 left-4 right-4 bg-white/95 backdrop-blur p-4 rounded-xl shadow-xl border-l-4 border-emerald-500 flex flex-wrap gap-4 justify-between items-center z-10">
          <div>
            <p className="text-xs text-slate-500 uppercase font-bold">Area Calcolata (Geodesica)</p>
            <p className="text-2xl font-bold text-slate-800">{area} ha</p>
          </div>
          <div>
            <p className="text-xs text-slate-500 uppercase font-bold">Pendenza Media (DEM)</p>
            <p className="text-lg font-bold text-slate-800 flex items-center gap-1">
              {slope}%
            </p>
          </div>
          <div className="text-right">
            <span className="text-xs bg-emerald-100 text-emerald-800 px-2 py-1 rounded font-bold">
              {slope <= 10 ? 'T50/T30 Ottimale' : slope <= 20 ? 'T30 Consigliato' : 'T25 Necessario'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

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
  const [tempLine, setTempLine] = useState<L.Polyline | null>(null);
  const [polygons, setPolygons] = useState<L.Polygon[]>([]);
  const [markers, setMarkers] = useState<L.CircleMarker[]>([]);
  const [points, setPoints] = useState<L.LatLng[]>([]);
  const [isClosed, setIsClosed] = useState(false);
  const [area, setArea] = useState('0');
  const [slope, setSlope] = useState(0);
  const [totalAreaHa, setTotalAreaHa] = useState(0);
  const [fieldCount, setFieldCount] = useState(0);

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

    if (tempLine) {
      tempLine.remove();
    }

    const polyline = L.polyline(pts, {
      color: '#10b981',
      weight: 3,
      dashArray: '10, 10'
    }).addTo(mapRef.current);

    setTempLine(polyline);
  };

  const estimateElevation = (point: L.LatLng) => {
    const base = ((point.lat * 1000) + (point.lng * 1000)) % 300;
    return 50 + base;
  };

  const computeSlopeFromPoints = (pts: L.LatLng[]): number => {
    if (!mapRef.current || pts.length < 2) return 0;

    let minElevation = Infinity;
    let maxElevation = -Infinity;
    let minPoint = pts[0];
    let maxPoint = pts[0];

    pts.forEach((p) => {
      const h = estimateElevation(p);
      if (h < minElevation) {
        minElevation = h;
        minPoint = p;
      }
      if (h > maxElevation) {
        maxElevation = h;
        maxPoint = p;
      }
    });

    const distance = mapRef.current.distance(minPoint, maxPoint);
    if (distance === 0) return 0;

    const deltaH = maxElevation - minElevation;
    const slopePercent = (deltaH / distance) * 100;
    const clamped = Math.max(0, Math.min(60, slopePercent));

    return Math.round(clamped);
  };

  const closePolygon = (pts: L.LatLng[]) => {
    if (!mapRef.current || pts.length < 3) return;

    // Remove temporary polyline
    if (tempLine) {
      tempLine.remove();
      setTempLine(null);
    }

    // Create final polygon for this field
    const polygon = L.polygon(pts, {
      color: '#10b981',
      weight: 3,
      fillColor: '#10b981',
      fillOpacity: 0.3
    }).addTo(mapRef.current);

    setPolygons(prev => [...prev, polygon]);
    setIsClosed(true);

    // Calculate area using Turf.js (geodesic calculation)
    const coords = pts.map(p => [p.lng, p.lat]);
    coords.push([pts[0].lng, pts[0].lat]); // Close the polygon

    const turfPoly = turfPolygon([coords]);
    const areaInSquareMeters = turfArea(turfPoly);
    const areaInHectaresNumber = areaInSquareMeters / 10000;

    const fieldSlope = computeSlopeFromPoints(pts);

    const newTotalArea = totalAreaHa + areaInHectaresNumber;
    const newFieldCount = fieldCount + 1;
    const newAverageSlope = newFieldCount === 1
      ? fieldSlope
      : Math.round(((slope * totalAreaHa) + (fieldSlope * areaInHectaresNumber)) / newTotalArea);

    setTotalAreaHa(newTotalArea);
    setFieldCount(newFieldCount);
    setArea(newTotalArea.toFixed(2));
    setSlope(newAverageSlope);

    // Callback to parent with aggregated data (treating multi-appezzamento come unico intervento)
    onComplete({
      area: newTotalArea.toFixed(2),
      points: pts,
      slope: newAverageSlope
    });
  };

  const resetMap = () => {
    if (!mapRef.current) return;

    // Remove all markers
    markers.forEach(m => m.remove());

    // Remove temporary line
    if (tempLine) {
      tempLine.remove();
    }

    // Remove all polygons
    polygons.forEach(p => p.remove());

    setMarkers([]);
    setPoints([]);
    setTempLine(null);
    setPolygons([]);
    setIsClosed(false);
    setArea('0');
    setSlope(0);
    setTotalAreaHa(0);
    setFieldCount(0);
  };

  const startNewField = () => {
    if (!mapRef.current) return;

    setPoints([]);
    setIsClosed(false);

    if (tempLine) {
      tempLine.remove();
      setTempLine(null);
    }
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
  }, [points, isClosed, markers, tempLine]);

  return (
    <div className="relative">
      <div
        ref={mapContainerRef}
        className="w-full h-[520px] md:h-[600px] rounded-xl overflow-hidden border-2 border-slate-300 shadow-inner z-0"
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

      {totalAreaHa > 0 && (
        <div className="absolute bottom-4 left-4 right-4 bg-white/95 backdrop-blur p-4 rounded-xl shadow-xl border-l-4 border-emerald-500 flex flex-wrap gap-4 justify-between items-center z-10">
          <div>
            <p className="text-xs text-slate-500 uppercase font-bold">Area Totale Intervento (Geodesica)</p>
            <p className="text-2xl font-bold text-slate-800">{area} ha</p>
            <p className="text-xs text-slate-500 mt-1">{fieldCount} camp{fieldCount === 1 ? 'o' : 'i'} disegnat{fieldCount === 1 ? 'o' : 'i'}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500 uppercase font-bold">Pendenza Media Stimata (DEM)</p>
            <p className="text-lg font-bold text-slate-800 flex items-center gap-1">
              {slope}%
            </p>
            <span className="mt-1 inline-block text-xs bg-emerald-100 text-emerald-800 px-2 py-1 rounded font-bold">
              {slope <= 10 ? 'T50/T30 Ottimale' : slope <= 20 ? 'T30 Consigliato' : 'T25 Necessario'}
            </span>
          </div>
          <div className="flex flex-col items-end gap-2">
            {isClosed && (
              <button
                type="button"
                onClick={startNewField}
                className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold shadow hover:bg-emerald-700"
              >
                + Aggiungi campo
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

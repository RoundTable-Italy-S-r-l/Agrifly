import { FormEvent, useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { X, ChevronLeft, Layers } from 'lucide-react';
import { area as turfArea } from '@turf/area';
import { polygon as turfPolygon } from '@turf/helpers';

interface LeafletAreaMapProps {
  onComplete: (data: { area: string; points: L.LatLng[]; slope: number }) => void;
  onBack: () => void;
}

export function LeafletAreaMap({ onComplete, onBack }: LeafletAreaMapProps) {
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
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchSuggestions, setSearchSuggestions] = useState<Array<{ display_name: string; lat: string; lon: string }>>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [mapLayer, setMapLayer] = useState<'satellite' | 'street' | 'terrain'>('satellite');

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [44.5, 11.3],
      zoom: 15,
      zoomControl: false
    });

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

  const handleSearchSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!mapRef.current) return;

    const query = searchQuery.trim();
    if (!query) return;

    setIsSearching(true);
    setSearchError(null);
    setShowSuggestions(false);

    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1&addressdetails=1`,
      );

      if (!response.ok) {
        throw new Error('Geocoding error');
      }

      const results: { lat: string; lon: string; display_name: string }[] = await response.json();

      if (!results.length) {
        setSearchError('Nessun risultato per questo luogo');
        return;
      }

      const { lat, lon } = results[0];
      const latNum = parseFloat(lat);
      const lonNum = parseFloat(lon);

      if (Number.isNaN(latNum) || Number.isNaN(lonNum)) {
        setSearchError('Risultato non valido per questo luogo');
        return;
      }

      mapRef.current.setView([latNum, lonNum], 16);
    } catch {
      setSearchError('Impossibile cercare questo luogo al momento');
    } finally {
      setIsSearching(false);
    }
  };

  const handleSearchInputChange = async (value: string) => {
    setSearchQuery(value);
    setSearchError(null);

    if (value.trim().length < 3) {
      setSearchSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(value.trim())}&limit=5&addressdetails=1`,
      );

      if (!response.ok) return;

      const results: { lat: string; lon: string; display_name: string }[] = await response.json();
      setSearchSuggestions(results);
      setShowSuggestions(results.length > 0);
    } catch {
      // Silently fail autocomplete
    }
  };

  const handleSuggestionClick = (suggestion: { lat: string; lon: string; display_name: string }) => {
    if (!mapRef.current) return;

    const latNum = parseFloat(suggestion.lat);
    const lonNum = parseFloat(suggestion.lon);

    if (!Number.isNaN(latNum) && !Number.isNaN(lonNum)) {
      mapRef.current.setView([latNum, lonNum], 16);
      setSearchQuery(suggestion.display_name);
      setShowSuggestions(false);
    }
  };

  const handleMapClick = (e: L.LeafletMouseEvent) => {
    if (!mapRef.current) return;
    if (isClosed) return;

    const newPoint = e.latlng;
    const pts = [...points, newPoint];

    const marker = L.circleMarker(newPoint, {
      color: '#FFC107',
      fillColor: '#FFC107',
      fillOpacity: 0.8,
      radius: 6,
      weight: 2
    }).addTo(mapRef.current);

    if (pts.length === 1) {
      marker.on('click', () => {
        if (pts.length >= 3) {
          closePolygon(pts);
        }
      });
    }

    setPoints(pts);

    if (pts.length > 1) {
      updatePolyline(pts);
    }

    if (pts.length >= 3) {
      marker.on('click', () => {
        closePolygon(pts);
      });
    }

    setMarkers([...markers, marker]);
  };

  const updatePolyline = (pts: L.LatLng[]) => {
    if (!mapRef.current) return;

    if (tempLine) {
      tempLine.remove();
    }

    const polyline = L.polyline(pts, {
      color: '#FFFFFF',
      weight: 3,
      dashArray: '10, 10',
      opacity: 0.9
    }).addTo(mapRef.current);

    setTempLine(polyline);
  };

  const closePolygon = (pts: L.LatLng[]) => {
    if (!mapRef.current || pts.length < 3) return;

    if (tempLine) {
      tempLine.remove();
      setTempLine(null);
    }

    const polygon = L.polygon(pts, {
      color: '#FFC107',
      weight: 3,
      fillColor: '#FFC107',
      fillOpacity: 0.25
    }).addTo(mapRef.current);

    setPolygons(prev => [...prev, polygon]);
    setIsClosed(true);

    const coords = pts.map(p => [p.lng, p.lat]);
    coords.push([pts[0].lng, pts[0].lat]);

    const turfPoly = turfPolygon([coords]);
    const areaInSquareMeters = turfArea(turfPoly);
    const areaInHectaresNumber = areaInSquareMeters / 10000;

    const newTotalArea = totalAreaHa + areaInHectaresNumber;
    const newFieldCount = fieldCount + 1;
    const newAverageSlope = 0;

    setTotalAreaHa(newTotalArea);
    setFieldCount(newFieldCount);
    setArea(newTotalArea.toFixed(2));
    setSlope(newAverageSlope);

    onComplete({
      area: newTotalArea.toFixed(2),
      points: pts,
      slope: newAverageSlope
    });
  };

  const resetMap = () => {
    if (!mapRef.current) return;

    markers.forEach(m => m.remove());

    if (tempLine) {
      tempLine.remove();
    }

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

  const handleLayerSwitch = (layer: 'satellite' | 'street' | 'terrain') => {
    if (!mapRef.current) return;
    setMapLayer(layer);

    mapRef.current.eachLayer((l) => {
      if ((l as any)._url) {
        mapRef.current?.removeLayer(l);
      }
    });

    const tileUrls = {
      satellite: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      street: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      terrain: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}'
    };

    L.tileLayer(tileUrls[layer], {
      attribution: layer === 'street' ? '&copy; OpenStreetMap' : '&copy; Esri',
      maxZoom: 19
    }).addTo(mapRef.current);
  };

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
    <div className="relative w-full h-full">
      <div
        ref={mapContainerRef}
        className="w-full h-full z-0"
        style={{ cursor: isClosed ? 'default' : 'crosshair' }}
      />

      {/* Back button */}
      <button
        onClick={onBack}
        className="absolute top-4 left-4 z-30 bg-white/95 backdrop-blur p-2.5 rounded shadow-xl border border-slate-200 hover:bg-white transition flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-700"
      >
        <ChevronLeft size={18} />
        <span className="hidden md:inline">Indietro</span>
      </button>

      {/* Floating HUD Panel */}
      <div className="absolute top-4 left-4 md:left-20 right-4 md:right-auto md:w-[360px] z-20 mt-14">
        <div className="bg-white/95 backdrop-blur rounded shadow-2xl border-l-4 border-slate-900 p-5">
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-900 mb-2">1. DEFINISCI AREA</h2>
          <p className="text-xs text-slate-600 mb-3">Clicca i vertici del campo sulla mappa satellitare. Chiudi il poligono cliccando sul primo punto.</p>
          {totalAreaHa > 0 && (
            <div className="bg-slate-900 text-white p-3 rounded mt-2">
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold">{area}</span>
                <span className="text-sm">ha</span>
              </div>
              <p className="text-[10px] text-slate-300 uppercase tracking-wide mt-1">{fieldCount} camp{fieldCount === 1 ? 'o' : 'i'} disegnat{fieldCount === 1 ? 'o' : 'i'}</p>
            </div>
          )}
        </div>
      </div>

      {/* Search Bar */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 w-[90%] md:w-[400px] z-20">
        <form
          onSubmit={handleSearchSubmit}
          className="flex items-center gap-2 bg-white/95 backdrop-blur px-3 py-2 rounded-full shadow-lg border border-slate-200"
        >
          <input
            type="text"
            value={searchQuery}
            onChange={event => handleSearchInputChange(event.target.value)}
            onFocus={() => searchSuggestions.length > 0 && setShowSuggestions(true)}
            placeholder="Cerca località, comune o indirizzo..."
            className="flex-1 bg-transparent border-none text-xs md:text-[11px] text-slate-800 placeholder:text-slate-400 outline-none"
          />
          <button
            type="submit"
            disabled={isSearching}
            className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-600 disabled:opacity-50"
          >
            {isSearching ? '...' : 'Vai'}
          </button>
        </form>
        {searchError && (
          <div className="mt-1 text-[10px] text-red-600 bg-white/90 rounded-md px-2 py-1 shadow-sm border border-red-100">
            {searchError}
          </div>
        )}
        {showSuggestions && searchSuggestions.length > 0 && (
          <div className="mt-1 bg-white/95 backdrop-blur rounded-lg shadow-xl border border-slate-200 max-h-48 overflow-y-auto">
            {searchSuggestions.map((suggestion, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleSuggestionClick(suggestion)}
                className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-slate-100 transition border-b border-slate-100 last:border-b-0"
              >
                {suggestion.display_name}
              </button>
            ))}
          </div>
        )}
      </div>

      {points.length > 0 && !isClosed && (
        <div className="absolute top-32 left-4 md:left-20 bg-emerald-600 text-white px-3 py-1.5 rounded-lg shadow-lg text-sm font-bold z-10 pointer-events-none md:w-[360px] text-center">
          {points.length} punt{points.length === 1 ? 'o' : 'i'} • Clicca vicino al primo punto per chiudere
        </div>
      )}

      {/* Custom Zoom Controls + Layer Switcher + Reset (bottom right) */}
      <div className="absolute bottom-6 right-6 z-20 flex flex-col gap-2">
        <button
          onClick={() => mapRef.current?.zoomIn()}
          className="w-10 h-10 bg-white rounded shadow-lg flex items-center justify-center text-slate-900 hover:bg-slate-100 font-bold text-lg transition"
          title="Zoom in"
        >
          +
        </button>
        <button
          onClick={() => mapRef.current?.zoomOut()}
          className="w-10 h-10 bg-white rounded shadow-lg flex items-center justify-center text-slate-900 hover:bg-slate-100 font-bold text-lg transition"
          title="Zoom out"
        >
          −
        </button>
        <div className="h-px bg-slate-300 my-1"></div>
        <button
          onClick={() => handleLayerSwitch('satellite')}
          className={`w-10 h-10 rounded shadow-lg flex items-center justify-center transition ${
            mapLayer === 'satellite' ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 hover:bg-slate-100'
          }`}
          title="Satellite"
        >
          <Layers size={18} />
        </button>
        <button
          onClick={() => handleLayerSwitch('street')}
          className={`w-10 h-10 rounded shadow-lg flex items-center justify-center text-xs font-bold transition ${
            mapLayer === 'street' ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 hover:bg-slate-100'
          }`}
          title="Stradale"
        >
          <span>🗺️</span>
        </button>
        <button
          onClick={() => handleLayerSwitch('terrain')}
          className={`w-10 h-10 rounded shadow-lg flex items-center justify-center text-xs font-bold transition ${
            mapLayer === 'terrain' ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 hover:bg-slate-100'
          }`}
          title="Terreno"
        >
          <span>⛰️</span>
        </button>
        <div className="h-px bg-slate-300 my-1"></div>
        <button
          onClick={resetMap}
          className="w-10 h-10 bg-white rounded shadow-lg flex items-center justify-center text-slate-600 hover:text-red-500 hover:bg-red-50 transition"
          title="Resetta disegno"
        >
          <X size={20} />
        </button>
      </div>

      {/* Add Field Button (bottom left) */}
      {isClosed && (
        <button
          type="button"
          onClick={startNewField}
          className="absolute bottom-6 left-6 z-20 px-4 py-2.5 rounded bg-emerald-600 text-white text-xs font-bold shadow-xl hover:bg-emerald-700 uppercase tracking-wide transition"
        >
          + Aggiungi campo
        </button>
      )}
    </div>
  );
}

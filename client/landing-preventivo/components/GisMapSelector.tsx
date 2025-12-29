import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { X, Search, Undo, Redo, Trash2, Save, FolderOpen, ChevronDown, ChevronUp, Eye, Upload } from 'lucide-react';
import { area as turfArea } from '@turf/area';
import { polygon as turfPolygon } from '@turf/helpers';
import { getSavedFields, saveField, deleteSavedField, SavedField } from '@/lib/api';
import { toast } from 'sonner';

// Fix for default markers in Leaflet
import 'leaflet/dist/leaflet.css';
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface GisData {
  area: string;
  points: L.LatLng[];
  slope: number;
  area_ha?: number;
  location?: any;
}

interface FieldPreviewMapProps {
  field: SavedField;
}

function FieldPreviewMap({ field }: FieldPreviewMapProps) {
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    // Initialize map centered on the field
    const fieldPoints = field.polygon.map((coord: [number, number]) => L.latLng(coord[0], coord[1]));

    // Calculate center of the field
    let centerLat = 0, centerLng = 0;
    fieldPoints.forEach(point => {
      centerLat += point.lat;
      centerLng += point.lng;
    });
    centerLat /= fieldPoints.length;
    centerLng /= fieldPoints.length;

    const map = L.map(mapContainerRef.current, {
      center: [centerLat, centerLng],
      zoom: 14,
      zoomControl: false,
      attributionControl: false
    });

    // Satellite layer
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 19,
    }).addTo(map);

    // Add polygon
    const polygon = L.polygon(fieldPoints, {
      color: '#10B981',
      weight: 3,
      fillColor: '#10B981',
      fillOpacity: 0.3
    }).addTo(map);

    // Fit map to polygon bounds
    map.fitBounds(polygon.getBounds(), { padding: [20, 20] });

    mapRef.current = map;

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [field]);

  return <div ref={mapContainerRef} className="w-full h-full" />;
}

interface GisMapSelectorProps {
  onComplete: (data: GisData) => void;
  onBack: () => void;
  initialData?: GisData | null;
  className?: string;
}

export function GisMapSelector({ onComplete, onBack, initialData, className = '' }: GisMapSelectorProps) {
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const [points, setPoints] = useState<L.LatLng[]>([]);
  const [area, setArea] = useState('0');
  const [slope, setSlope] = useState(0);
  const [isClosed, setIsClosed] = useState(false);
  const [totalAreaHa, setTotalAreaHa] = useState(0);
  const [fieldCount, setFieldCount] = useState(0);
  const [polygons, setPolygons] = useState<L.Polygon[]>([]);
  const [tempLine, setTempLine] = useState<L.Polyline | null>(null);
  const firstMarkerRef = useRef<L.CircleMarker | null>(null);
  const [markers, setMarkers] = useState<L.CircleMarker[]>([]);
  const pointsRef = useRef<L.LatLng[]>([]);

  // Undo/Redo functionality - track removed points for undo/redo
  const [removedPoints, setRemovedPoints] = useState<L.LatLng[]>([]);

  // Undo/Redo functions
  const handleUndo = () => {
    console.log('🔄 UNDO chiamato - rimuovo ULTIMO punto, punti attuali:', points.length);
    if (points.length === 0) {
      console.log('❌ UNDO: nessun punto da rimuovere');
      return;
    }

    // Remove last point and add to removed points for potential redo
    const lastPoint = points[points.length - 1];
    const newPoints = points.slice(0, -1);

    console.log('🔄 UNDO: rimuovo punto, da', points.length, 'a', newPoints.length, 'punti');
    setRemovedPoints(prev => [lastPoint, ...prev]);
    updatePoints(newPoints);

    // Reset closed state if we undo from a closed polygon
    if (isClosed) {
      setIsClosed(false);
    }

    // Give user feedback
    toast.info(`🔄 UNDO: punto rimosso (${newPoints.length} rimasti)`);
  };

  const handleRedo = () => {
    console.log('🔄 REDO chiamato - ripristino ultimo punto rimosso');
    if (removedPoints.length === 0) {
      console.log('❌ REDO: nessun punto da ripristinare');
      return;
    }

    // Re-add the last removed point
    const pointToRestore = removedPoints[0];
    const newRemovedPoints = removedPoints.slice(1);

    const newPoints = [...points, pointToRestore];
    console.log('🔄 REDO: aggiungo punto, da', points.length, 'a', newPoints.length, 'punti');
    setRemovedPoints(newRemovedPoints);
    updatePoints(newPoints);

    // Give user feedback
    toast.info(`🔄 REDO: punto ripristinato (${newPoints.length} totali)`);
  };

  const handleClearAll = () => {
    console.log('🗑️ CANCELLA TUTTO chiamato - CANCELLO TUTTO IL DISEGNO');
    console.log('📊 Prima dello svuotamento - punti:', points.length, 'area:', area, 'mappa chiusa:', isClosed);

    if (!mapRef.current) {
      console.log('❌ Nessuna mappa da pulire');
      return;
    }

    // Clear ALL layers from the map except the tile layer (satellite/street/terrain)
    let layersRemoved = 0;
    mapRef.current.eachLayer((layer) => {
      // Keep tile layers (they have _url property), remove everything else
      if (!(layer as any)._url) {
        mapRef.current!.removeLayer(layer);
        layersRemoved++;
      }
    });
    console.log('🗑️ Rimosso', layersRemoved, 'layer dalla mappa');

    // Reset all state - do it all at once to avoid intermediate states
    console.log('🔄 Resetto tutto lo stato...');
    setPoints([]);
    pointsRef.current = [];
    setMarkers([]);
    setTempLine(null);
    setPolygons([]);
    setArea('0');
    setTotalAreaHa(0);
    setFieldCount(0);
    setIsClosed(false);
    setRemovedPoints([]);
    firstMarkerRef.current = null;

    console.log('✅ CANCELLA TUTTO completato - tutto azzerato a 0');
    console.log('🎯 Ora puoi ricominciare da zero');
  };

  // Helper function to update points and map
  const updatePoints = (newPoints: L.LatLng[]) => {
    setPoints(newPoints);
    pointsRef.current = newPoints;

    // Clear existing markers and lines
    markers.forEach(marker => mapRef.current?.removeLayer(marker));
    if (tempLine && mapRef.current) {
      mapRef.current.removeLayer(tempLine);
    }
    polygons.forEach(polygon => mapRef.current?.removeLayer(polygon));
    if (firstMarkerRef.current && mapRef.current) {
      mapRef.current.removeLayer(firstMarkerRef.current);
    }

    // Recreate markers and lines
    const newMarkers: L.CircleMarker[] = [];
    newPoints.forEach((point, index) => {
      const marker = L.circleMarker([point.lat, point.lng], {
        color: 'red',
        fillColor: '#ff0000',
        fillOpacity: 0.8,
        radius: 6
      }).addTo(mapRef.current!);

      marker.bindTooltip(`Punto ${index + 1}`, { permanent: false });
      newMarkers.push(marker);
    });

    setMarkers(newMarkers);

    // Update line
    if (newPoints.length >= 2) {
      const newTempLine = L.polyline(newPoints.map(p => [p.lat, p.lng]), {
        color: 'red',
        weight: 3
      }).addTo(mapRef.current!);
      setTempLine(newTempLine);
    } else {
      setTempLine(null);
    }

    // Update area calculation
    if (newPoints.length >= 3) {
      // Calculate area for single field mode
      const coords = newPoints.map(p => [p.lng, p.lat]);
      coords.push([newPoints[0].lng, newPoints[0].lat]);

      const poly = turfPolygon([coords]);
      const areaInSquareMeters = turfArea(poly);
      const areaInHectares = areaInSquareMeters / 10000;

      setArea(areaInHectares.toFixed(2));
      setTotalAreaHa(areaInHectares);
    } else {
      setArea('0');
      setTotalAreaHa(0);
    }

    setIsClosed(false);
    if (firstMarkerRef.current) {
      firstMarkerRef.current.setStyle({ fillColor: '#ff0000' });
    }
  };

  // Search functionality
  const [searchQuery, setSearchQuery] = useState('');
  const [searchSuggestions, setSearchSuggestions] = useState<{ lat: string; lon: string; display_name: string }[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [mapLayer, setMapLayer] = useState<'satellite' | 'street' | 'terrain'>('satellite');

  // Saved fields functionality
  const [savedFields, setSavedFields] = useState<SavedField[]>([]);
  const [isLoadingSavedFields, setIsLoadingSavedFields] = useState(false);
  const [showFieldPreviewModal, setShowFieldPreviewModal] = useState(false);
  const [previewField, setPreviewField] = useState<SavedField | null>(null);
  const [savedFieldsExpanded, setSavedFieldsExpanded] = useState(false);
  const [showSaveFieldDialog, setShowSaveFieldDialog] = useState(false);
  const [fieldNameInput, setFieldNameInput] = useState('');

  // Search functions
  const handleSearch = async () => {
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

  // Sync ref with state
  useEffect(() => {
    pointsRef.current = points;
  }, [points]);

  // Map click handler
  const handleMapClick = (e: L.LeafletMouseEvent) => {
    console.log('Map clicked, current points:', pointsRef.current.length);
    if (!mapRef.current) {
      console.log('No map ref');
      return;
    }
    // If polygon is closed OR we have no points (after clear), allow new drawing
    if (isClosed && pointsRef.current.length > 0) {
      console.log('Polygon is closed');
      return;
    }

    const newPoint = e.latlng;
    console.log('New point:', newPoint);

    // Use ref to get current points
    const currentPoints = pointsRef.current;

    // Check if clicking near first point to close polygon (reduced to 30 meters for better UX)
    if (currentPoints.length >= 3 && firstMarkerRef.current) {
      const firstPoint = currentPoints[0];
      const distanceToFirst = mapRef.current.distance(newPoint, firstPoint);
      console.log('Distance to first point:', distanceToFirst, 'meters');

      // If click is within 30 meters of first point, close the polygon
      if (distanceToFirst < 30) {
        console.log('🔄 Closing polygon automatically - clicked near first point');
        closePolygon(currentPoints);
        return;
      }

      // Show feedback if close but not close enough
      if (distanceToFirst < 100) {
        console.log('📍 Vicino al primo punto! Distanza:', Math.round(distanceToFirst), 'metri - clicca più vicino per chiudere');
      }
    }

    const pts = [...currentPoints, newPoint];
    console.log('New points array:', pts.length);

    const marker = L.circleMarker(newPoint, {
      color: '#FFC107',
      fillColor: '#FFC107',
      fillOpacity: 0.8,
      radius: 6,
      weight: 2
    }).addTo(mapRef.current);
    console.log('Marker added');

    // Save reference to first marker and make it clickable
    if (pts.length === 1) {
      firstMarkerRef.current = marker;
      // Use current points in closure
      const checkAndClose = () => {
        const updatedPoints = pointsRef.current;
        if (updatedPoints.length >= 3) {
          closePolygon(updatedPoints);
        }
      };
      marker.on('click', (evt: L.LeafletMouseEvent) => {
        L.DomEvent.stopPropagation(evt.originalEvent);
        L.DomEvent.preventDefault(evt.originalEvent);
        checkAndClose();
      });
      // Add extra click area
      marker.bringToFront();
    }

    setPoints(pts);
    pointsRef.current = pts;

    // Reset removed points when adding new point (invalidate redo)
    setRemovedPoints([]);

    if (pts.length > 1) {
      console.log('Calling updatePolyline with', pts.length, 'points');
      updatePolyline(pts);
    } else {
      console.log('Not calling updatePolyline, only', pts.length, 'point');
    }

    // Make first marker larger and more visible when ready to close
    if (pts.length >= 3 && firstMarkerRef.current) {
      console.log('Making first marker green and clickable');
      firstMarkerRef.current.setStyle({
        radius: 14,
        color: '#10B981',
        fillColor: '#10B981',
        fillOpacity: 1,
        weight: 4
      });
      // Add tooltip to first marker
      firstMarkerRef.current.bindTooltip('🏠 Clicca qui per chiudere il campo!', {
        permanent: false,
        direction: 'top',
        className: 'custom-tooltip'
      }).openTooltip();

      // Re-attach click handler with updated points reference
      firstMarkerRef.current.off('click');
      firstMarkerRef.current.on('click', (evt: L.LeafletMouseEvent) => {
        L.DomEvent.stopPropagation(evt.originalEvent);
        L.DomEvent.preventDefault(evt.originalEvent);
        const updatedPoints = pointsRef.current;
        console.log('🏠 First marker clicked - closing polygon');
        closePolygon(updatedPoints);
      });
    }

    setMarkers([...markers, marker]);
  };

  // Keyboard shortcuts for undo/redo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'z' && !e.shiftKey) {
          e.preventDefault();
          handleUndo();
        } else if ((e.key === 'y') || (e.key === 'z' && e.shiftKey)) {
          e.preventDefault();
          handleRedo();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [points, removedPoints]);

  // Load initial data if provided
  useEffect(() => {
    if (initialData && initialData.polygon && initialData.polygon.length > 0) {
      console.log('📂 Loading initial data:', initialData);

      // Convert polygon coordinates to LatLng points
      const fieldPoints = initialData.polygon.map((coord: [number, number]) => L.latLng(coord[0], coord[1]));

      // Set the points
      setPoints(fieldPoints);
      pointsRef.current = fieldPoints;

      // Set area
      setTotalAreaHa(initialData.area_ha);
      setArea(initialData.area_ha.toFixed(2));

      // Close the polygon immediately since it's loaded from initial data
      closePolygon(fieldPoints);

      console.log('✅ Initial data loaded successfully');
    }
  }, [initialData]);

  // Saved fields functions
  const loadSavedFields = async () => {
    try {
      setIsLoadingSavedFields(true);
      const response = await getSavedFields();
      setSavedFields(response.fields);
    } catch (error: any) {
      toast.error('Errore nel caricamento dei campi salvati');
    } finally {
      setIsLoadingSavedFields(false);
    }
  };

  const handleSaveField = async () => {
    if (!isClosed || points.length < 3) {
      toast.error('Completa prima la selezione del campo');
      return;
    }

    setShowSaveFieldDialog(true);
  };

  const handleConfirmSaveField = async () => {
    if (!fieldNameInput.trim()) {
      toast.error('Inserisci un nome per il campo');
      return;
    }

    if (points.length < 3) {
      toast.error('Disegna un poligono valido con almeno 3 punti');
      return;
    }

    if (totalAreaHa <= 0) {
      toast.error('Area del campo non valida. Ridisegna il poligono.');
      return;
    }

    setShowSaveFieldDialog(false);

    try {
      console.log('💾 Salvando campo:', fieldNameInput, 'con', points.length, 'punti');

      const fieldData = {
        name: fieldNameInput.trim(),
        polygon: points.map(p => [p.lat, p.lng]),
        area_ha: totalAreaHa,
        location_json: null // TODO: add location data
      };

      console.log('📤 Invio dati:', fieldData);

      const result = await saveField(fieldData);
      console.log('✅ Campo salvato:', result);

      toast.success(`Campo "${fieldNameInput}" salvato con successo!`);
      setFieldNameInput('');
      loadSavedFields(); // Refresh the list
    } catch (error: any) {
      console.error('❌ Errore salvataggio campo:', error);
      toast.error(`Errore nel salvataggio: ${error.message || 'Riprova più tardi'}`);
    }
  };

  const handleLoadField = (field: SavedField) => {
    try {
      // Clear current selection
      handleClearAll();

      // Load field points - questi sono già un poligono chiuso dal database
      const fieldPoints = field.polygon.map((coord: [number, number]) => L.latLng(coord[0], coord[1]));

      console.log('📂 Caricamento campo salvato:', field.name, 'con', fieldPoints.length, 'punti');

      // Set points and immediately close the polygon (since it's already closed in DB)
      setPoints(fieldPoints);
      pointsRef.current = fieldPoints;
      setTotalAreaHa(field.area_ha);

      // Close the polygon immediately since it's loaded from saved field (visualizza sulla mappa)
      closePolygon(fieldPoints);

      // Calculate location if not available (per quando l'utente confermerà)
      let location = field.location_json;
      if (!location) {
        const centerLat = fieldPoints.reduce((sum, p) => sum + p.lat, 0) / fieldPoints.length;
        const centerLng = fieldPoints.reduce((sum, p) => sum + p.lng, 0) / fieldPoints.length;
        location = {
          lat: centerLat,
          lng: centerLng,
          address: `Centro campo salvato: ${centerLat.toFixed(6)}, ${centerLng.toFixed(6)}`
        };
      }

      // Store location for when user confirms (non chiamare onComplete subito)
      // L'utente vedrà il campo sulla mappa e potrà confermare con il pulsante
      
      // Center map on the field
      if (mapRef.current && fieldPoints.length > 0) {
        const bounds = L.latLngBounds(fieldPoints);
        mapRef.current.fitBounds(bounds, { padding: [50, 50] });
      }

      toast.success(`Campo "${field.name}" caricato! Verifica sulla mappa e clicca "Conferma" per procedere.`);
    } catch (error) {
      console.error('Errore caricamento campo:', error);
      toast.error('Errore nel caricamento del campo');
    }
  };

  const handlePreviewField = (field: SavedField) => {
    setPreviewField(field);
    setShowFieldPreviewModal(true);
  };

  const handleDeleteField = async (fieldId: string, fieldName: string) => {
    if (!confirm(`Sei sicuro di voler eliminare il campo "${fieldName}"?`)) return;

    try {
      await deleteSavedField(fieldId);
      toast.success('Campo eliminato con successo!');
      loadSavedFields(); // Refresh the list
    } catch (error: any) {
      toast.error('Errore nell\'eliminazione del campo');
    }
  };

  // Initialize map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    console.log('Initializing map...');

    try {
      const map = L.map(mapContainerRef.current, {
        center: [46.0, 11.0], // Trentino
        zoom: 12,
        zoomControl: true
      });

      // Satellite layer
      L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Tiles &copy; Esri',
        maxZoom: 19
      }).addTo(map);

      mapRef.current = map;
      console.log('Map initialized successfully');

      // Add click handler for area selection
      map.on('click', handleMapClick);

      return () => {
        console.log('Cleaning up map');
        if (mapRef.current) {
          mapRef.current.remove();
          mapRef.current = null;
        }
      };
    } catch (error) {
      console.error('Map initialization error:', error);
    }
  }, []); // Empty dependency array - only run once

  // Helper functions
  const updatePolyline = (pts: L.LatLng[]) => {
    if (!mapRef.current) return;

    console.log('Updating polyline with points:', pts.length);

    if (tempLine) {
      tempLine.remove();
    }

    const polyline = L.polyline(pts, {
      color: '#FF0000',
      weight: 3,
      dashArray: '10, 10',
      opacity: 0.9
    }).addTo(mapRef.current);

    setTempLine(polyline);
    console.log('Polyline added to map');
  };

  const calculateSlope = async (pts: L.LatLng[]): Promise<number> => {
    try {
      // Simple slope calculation based on latitude (Trentino has varied terrain)
      // In a real app, this would use elevation data
      const latitudes = pts.map(p => p.lat);

      // Rough estimation: higher latitudes in Trentino tend to be at higher elevation
      const avgLat = latitudes.reduce((sum, lat) => sum + lat, 0) / latitudes.length;

      // Simple formula: base elevation + latitude factor
      const baseElevation = 200; // Base elevation in meters
      const latFactor = (46.5 - avgLat) * 100; // Rough elevation increase with latitude
      const elevation = Math.max(0, baseElevation + latFactor);

      // Calculate slope as variation from average elevation
      const elevationVariation = latitudes.reduce((sum, lat) => {
        const latElevation = baseElevation + (46.5 - lat) * 100;
        return sum + Math.abs(latElevation - elevation);
      }, 0) / latitudes.length;

      const slopePercentage = (elevationVariation / 100) * 100; // Convert to percentage

      return Math.round(slopePercentage * 10) / 10; // Round to 1 decimal
    } catch (error) {
      console.warn('Error calculating slope:', error);
      return 0;
    }
  };

  const closePolygon = async (pts: L.LatLng[]) => {
    if (!mapRef.current) return;

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

    // Calculate area using Turf.js
    const poly = turfPolygon([coords]);
    const areaInSquareMeters = turfArea(poly);
    const areaInHectaresNumber = areaInSquareMeters / 10000;

    const newTotalArea = totalAreaHa + areaInHectaresNumber;
    const newFieldCount = fieldCount + 1;

    // Calculate real slope using elevation API
    const calculatedSlope = await calculateSlope(pts);

    setTotalAreaHa(newTotalArea);
    setFieldCount(newFieldCount);
    setArea(newTotalArea.toFixed(2));
    setSlope(calculatedSlope);

    // Don't auto-complete, let user click the button
    // onComplete({
    //   area: newTotalArea.toFixed(2),
    //   points: pts,
    //   slope: calculatedSlope
    // });
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
    firstMarkerRef.current = null;
  };

  const startNewField = () => {
    if (!mapRef.current) return;

    setPoints([]);
    setIsClosed(false);
    firstMarkerRef.current = null;

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

  const clearPoints = () => {
    handleClearAll();
  };

  const handleComplete = () => {
    if (points.length < 3) {
      alert('Seleziona almeno 3 punti per definire l\'area del campo');
      return;
    }

    // If polygon is not closed, close it automatically
    if (!isClosed) {
      closePolygon(points);
    }
  };

  return (
    <div className={`w-full bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden ${className}`}>
      {/* Header */}
      <div className="bg-slate-100 px-6 py-4 border-b border-slate-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-50 rounded-lg">
              <span className="text-emerald-600 text-xl">🗺️</span>
            </div>
            <div>
              <h3 className="font-bold text-lg text-slate-900">Seleziona il tuo campo</h3>
              <p className="text-sm text-slate-600">Clicca sulla mappa per definire l'area</p>
            </div>
          </div>
          <button
            onClick={onBack}
            className="p-2 hover:bg-slate-200 rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="px-6 py-4 bg-white border-b border-slate-200">
        <div className="relative">
          <div className="relative">
            <input
              type="text"
              placeholder="Cerca una località..."
              value={searchQuery}
              onChange={(e) => handleSearchInputChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleSearch();
                }
              }}
              className="w-full pl-10 pr-12 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            />
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <button
              onClick={handleSearch}
              disabled={isSearching}
              className="absolute right-2 top-1.5 px-3 py-1 bg-emerald-600 text-white text-xs rounded hover:bg-emerald-700 disabled:opacity-50"
            >
              {isSearching ? '...' : 'Cerca'}
            </button>
          </div>

          {/* Search Suggestions */}
          {showSuggestions && searchSuggestions.length > 0 && (
            <div className="absolute top-full left-0 right-0 z-[9999] bg-white border border-slate-300 rounded-lg shadow-lg mt-1 max-h-60 overflow-y-auto">
              {searchSuggestions.map((suggestion, index) => (
                <button
                  key={index}
                  onClick={() => handleSuggestionClick(suggestion)}
                  className="w-full text-left px-4 py-2 hover:bg-slate-50 border-b border-slate-100 last:border-b-0"
                >
                  <div className="text-sm text-slate-900 truncate">{suggestion.display_name}</div>
                </button>
              ))}
            </div>
          )}

          {searchError && (
            <div className="mt-2 text-sm text-red-600">{searchError}</div>
          )}
        </div>
      </div>

      {/* Map Container */}
      <div className="relative">
        <div
          ref={mapContainerRef}
          className="w-full h-[500px] bg-slate-100"
          style={{ zIndex: 1 }}
        />

        {/* Map Controls */}
        <div className="absolute top-4 right-4 z-10 bg-white rounded-lg shadow-lg p-2">
          <div className="flex flex-col gap-1">
            <button
              onClick={() => handleLayerSwitch('satellite')}
              className={`w-10 h-10 rounded shadow-lg flex items-center justify-center text-xs font-bold transition ${
                mapLayer === 'satellite' ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 hover:bg-slate-100'
              }`}
              title="Satellite"
            >
              🛰️
            </button>
            <button
              onClick={() => handleLayerSwitch('street')}
              className={`w-10 h-10 rounded shadow-lg flex items-center justify-center text-xs font-bold transition ${
                mapLayer === 'street' ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 hover:bg-slate-100'
              }`}
              title="Stradale"
            >
              🗺️
            </button>
            <button
              onClick={() => handleLayerSwitch('terrain')}
              className={`w-10 h-10 rounded shadow-lg flex items-center justify-center text-xs font-bold transition ${
                mapLayer === 'terrain' ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 hover:bg-slate-100'
              }`}
              title="Terreno"
            >
              ⛰️
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
        </div>

        {/* Instructions Overlay */}
        <div className="absolute bottom-4 left-4 right-4 bg-white/90 backdrop-blur-sm rounded-lg p-4 shadow-lg">
          <div className="flex items-start gap-3">
            <div className="text-2xl">📍</div>
            <div className="flex-1">
              <h4 className="font-semibold text-slate-900 mb-1">Come selezionare l'area</h4>
              <ol className="text-sm text-slate-600 space-y-1">
                <li>1. Clicca sulla mappa per selezionare i punti del campo</li>
                <li>2. Seleziona almeno 3 punti per definire l'area</li>
                <li>3. Per chiudere il poligono, clicca vicino al primo punto giallo o sul primo punto quando diventa verde</li>
                <li>4. Usa la ricerca per trovare la tua località</li>
              </ol>
            </div>
          </div>
        </div>

        {/* Stats Overlay */}
        {(area !== '0' || points.length > 0) && (
          <div className="absolute top-4 left-4 bg-white rounded-lg p-3 shadow-lg">
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <div className="text-slate-500">Punti selezionati</div>
                <div className="font-bold text-slate-900">{points.length}</div>
              </div>
              <div>
                <div className="text-slate-500">Area stimata</div>
                <div className="font-bold text-slate-900">{area} ha</div>
              </div>
              <div>
                <div className="text-slate-500">Pendenza</div>
                <div className="font-bold text-slate-900">{slope}°</div>
              </div>
            </div>
          </div>
        )}

        {/* Add Field Button */}
        {isClosed && (
          <button
            type="button"
            onClick={startNewField}
            className="absolute bottom-6 left-6 z-20 px-4 py-2.5 rounded bg-emerald-600 text-white text-xs font-bold shadow-xl hover:bg-emerald-700 uppercase tracking-wide transition"
          >
            + Aggiungi campo
          </button>
        )}

        {/* Closed Polygon Indicator */}
        {isClosed && (
          <div className="absolute top-4 right-4 z-20 bg-green-100 border border-green-300 rounded-lg px-3 py-2 shadow-lg">
            <div className="flex items-center gap-2 text-green-800 text-sm font-medium">
              <span>✅</span>
              <span>Campo definito</span>
            </div>
          </div>
        )}

        {/* Proceed to Quote Button */}
        {isClosed && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 bg-white/95 backdrop-blur rounded-lg shadow-2xl border border-slate-200 p-4">
            <div className="text-xs text-slate-600 flex flex-wrap items-center gap-2">
              <span>Area: <strong className="text-slate-900">{area} ha</strong></span>
              <span className="text-slate-300">•</span>
              <span>Pendenza: <strong className="text-slate-900">{slope}°</strong></span>
            </div>
            <button
              onClick={() => {
                // Calculate center of polygon for location
                const centerLat = points.reduce((sum, p) => sum + p.lat, 0) / points.length;
                const centerLng = points.reduce((sum, p) => sum + p.lng, 0) / points.length;

                onComplete({
                  polygon: points.map(p => [p.lat, p.lng]),
                  area_ha: totalAreaHa,
                  location: {
                    lat: centerLat,
                    lng: centerLng,
                    address: `Centro campo: ${centerLat.toFixed(6)}, ${centerLng.toFixed(6)}`
                  }
                });
              }}
              className="mt-3 px-5 py-2.5 bg-slate-900 text-white text-xs font-bold uppercase tracking-wide rounded hover:bg-black transition shadow-lg flex items-center gap-2 whitespace-nowrap"
            >
              <span>→</span> Procedi al Configuratore
            </button>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="p-6 bg-slate-50 border-t border-slate-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <button
                onClick={handleUndo}
                disabled={points.length === 0}
                className="p-2 text-slate-600 hover:bg-slate-200 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
                title="Annulla ULTIMO punto aggiunto (Ctrl+Z)"
              >
                <Undo size={18} />
              </button>
              <button
                onClick={handleRedo}
                disabled={removedPoints.length === 0}
                className="p-2 text-slate-600 hover:bg-slate-200 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
                title="Ripristina (Ctrl+Y)"
              >
                <Redo size={18} />
              </button>
              <div className="w-px h-6 bg-slate-300"></div>
              <button
                onClick={handleClearAll}
                disabled={points.length === 0}
                className="p-2 text-white bg-red-600 hover:bg-red-700 rounded-lg transition disabled:opacity-30 disabled:cursor-not-allowed disabled:bg-red-300"
                title="Cancella TUTTO (svuota completamente la mappa)"
              >
                <Trash2 size={18} />
              </button>
            </div>
            <div className="text-sm text-slate-500 ml-4">
              {points.length === 0 ? 'Clicca sulla mappa per iniziare' :
               points.length === 1 ? 'Aggiungi almeno altri 2 punti' :
               points.length === 2 ? 'Aggiungi almeno 1 punto in più' :
               isClosed ? '✅ Poligono chiuso - puoi salvare il campo!' :
               points.length >= 3 ? '🎯 Clicca sul primo punto VERDE o usa "Chiudi area"' :
               'Aggiungi più punti per definire l\'area'}
            </div>
          </div>

            <div className="flex items-center gap-3">

              {isClosed && (
                <button
                  onClick={handleSaveField}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition flex items-center gap-2"
                  title="Salva campo per riutilizzarlo"
                >
                  <Save size={18} />
                  💾 Salva Campo
                </button>
              )}

              <button
                onClick={handleComplete}
                disabled={points.length < 3 || isClosed}
                className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center gap-2"
              >
                {isClosed ? 'Area definita ✓' : 'Chiudi area'}
              </button>
            </div>
        </div>
      </div>

      {/* Saved Fields Expandable Section */}
      <div className="bg-white border-t border-slate-200">
        <button
          onClick={() => {
            setSavedFieldsExpanded(!savedFieldsExpanded);
            if (!savedFieldsExpanded) {
              loadSavedFields();
            }
          }}
          className="w-full px-6 py-4 flex items-center justify-between hover:bg-slate-50 transition"
        >
          <div className="flex items-center gap-3">
            <FolderOpen size={20} className="text-slate-600" />
            <span className="font-medium text-slate-900">Campi Salvati</span>
            {savedFields && savedFields.length > 0 && (
              <span className="px-2 py-1 bg-emerald-100 text-emerald-700 text-xs font-medium rounded-full">
                {savedFields.length}
              </span>
            )}
          </div>
          {savedFieldsExpanded ? (
            <ChevronUp size={20} className="text-slate-600" />
          ) : (
            <ChevronDown size={20} className="text-slate-600" />
          )}
        </button>

        {savedFieldsExpanded && (
          <div className="px-6 pb-6 border-t border-slate-100">
            {isLoadingSavedFields ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-emerald-600 mx-auto mb-2"></div>
                <p className="text-sm text-slate-600">Caricamento campi salvati...</p>
              </div>
            ) : (!savedFields || savedFields.length === 0) ? (
              <div className="text-center py-8">
                <FolderOpen className="w-8 h-8 text-slate-400 mx-auto mb-3" />
                <h4 className="text-sm font-medium text-slate-900 mb-1">Nessun campo salvato</h4>
                <p className="text-xs text-slate-600">Salva i tuoi campi per poterli riutilizzare velocemente.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {savedFields?.map((field) => (
                  <div key={field.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-slate-900 text-sm truncate">{field.name}</h4>
                      <p className="text-xs text-slate-600 mt-0.5">
                        Area: {field.area_ha.toFixed(2)} ha • {new Date(field.created_at).toLocaleDateString('it-IT')}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 ml-3">
                      <button
                        onClick={() => handlePreviewField(field)}
                        className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition"
                        title="Vedi sulla mappa"
                      >
                        <Eye size={16} />
                      </button>
                      <button
                        onClick={() => handleLoadField(field)}
                        className="px-3 py-1.5 bg-emerald-600 text-white text-xs font-medium rounded hover:bg-emerald-700 transition"
                      >
                        <Upload size={14} className="inline mr-1" />
                        Carica
                      </button>
                      <button
                        onClick={() => handleDeleteField(field.id, field.name)}
                        className="p-1.5 text-red-600 hover:bg-red-50 rounded transition"
                        title="Elimina campo"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>


      {/* Save Field Dialog */}
      {showSaveFieldDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="p-6 border-b border-slate-200">
              <h3 className="text-lg font-semibold text-slate-900">Salva Campo</h3>
              <p className="text-sm text-slate-600 mt-1">
                Dai un nome al tuo campo per poterlo riutilizzare
              </p>
            </div>

            <div className="p-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Nome del Campo
                  </label>
                  <input
                    type="text"
                    value={fieldNameInput}
                    onChange={(e) => setFieldNameInput(e.target.value)}
                    placeholder="es. Vigneto Chianti Classico"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleConfirmSaveField();
                      } else if (e.key === 'Escape') {
                        setShowSaveFieldDialog(false);
                        setFieldNameInput('');
                      }
                    }}
                  />
                </div>

                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                  <div className="text-sm text-emerald-800">
                    <div><strong>Area:</strong> {totalAreaHa.toFixed(2)} ha</div>
                    <div><strong>Punti:</strong> {points.length}</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-slate-200 bg-slate-50 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowSaveFieldDialog(false);
                  setFieldNameInput('');
                }}
                className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-lg transition"
              >
                Annulla
              </button>
              <button
                onClick={handleConfirmSaveField}
                disabled={!fieldNameInput.trim()}
                className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                Salva Campo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Field Preview Modal */}
      {showFieldPreviewModal && previewField && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setShowFieldPreviewModal(false)}>
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[80vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b border-slate-200">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">{previewField.name}</h3>
                  <p className="text-sm text-slate-600">Area: {previewField.area_ha.toFixed(2)} ha</p>
                </div>
                <button
                  onClick={() => setShowFieldPreviewModal(false)}
                  className="p-2 hover:bg-slate-100 rounded-lg transition"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="p-4">
              <div className="w-full h-96 bg-slate-100 rounded-lg overflow-hidden">
                <FieldPreviewMap field={previewField} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
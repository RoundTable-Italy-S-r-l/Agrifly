import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet-geometryutil";

interface JobFieldMapProps {
  fieldPolygon: any;
  areaHa: number;
  fieldName: string;
  className?: string;
}

const JobFieldMap = ({
  fieldPolygon,
  areaHa,
  fieldName,
  className = "",
}: JobFieldMapProps) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!mapRef.current || !fieldPolygon) return;

    // Se la mappa esiste già, non ricrearla
    if (leafletMapRef.current) {
      return;
    }

    let map: L.Map | null = null;

    try {
      // Parse polygon data
      let polygon =
        typeof fieldPolygon === "string"
          ? JSON.parse(fieldPolygon)
          : fieldPolygon;

      // Handle GeoJSON format: {type: "Polygon", coordinates: [[[lng, lat], ...]]}
      if (polygon && polygon.type === "Polygon" && polygon.coordinates) {
        polygon = polygon.coordinates[0]; // Get first ring
      }

      // Handle array format: [[lng, lat], [lng, lat], ...] or [[lat, lng], [lat, lng], ...]
      if (Array.isArray(polygon) && polygon.length > 0) {
        const firstPoint = polygon[0];
        let latLngs: [number, number][];

        if (Array.isArray(firstPoint) && firstPoint.length >= 2) {
          // Check if it's [lng, lat] format (GeoJSON standard, common in database)
          // For Italy, lng is around 6-18, lat is around 36-47
          // If first value is > 10 and < 20, it's likely lng (Italy longitude range)
          if (
            firstPoint[0] > 10 &&
            firstPoint[0] < 20 &&
            firstPoint[1] > 35 &&
            firstPoint[1] < 48
          ) {
            // Format is [lng, lat] - convert to [lat, lng] for Leaflet
            latLngs = polygon.map((point: [number, number]) => [
              point[1],
              point[0],
            ]);
          } else {
            // Format is already [lat, lng]
            latLngs = polygon.map((point: [number, number]) => [
              point[0],
              point[1],
            ]);
          }

          // Calculate center for initial map view
          let centerLat = 0,
            centerLng = 0;
          latLngs.forEach((point) => {
            centerLat += point[0];
            centerLng += point[1];
          });
          centerLat /= latLngs.length;
          centerLng /= latLngs.length;

          // Initialize map centered on the field
          map = L.map(mapRef.current, {
            center: [centerLat, centerLng],
            zoom: 14,
            zoomControl: true,
            attributionControl: true,
          });
          leafletMapRef.current = map;

          // Add satellite layer (like in GisMapSelector)
          L.tileLayer(
            "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
            {
              maxZoom: 19,
              attribution: "© Esri",
            },
          ).addTo(map);

          // Create polygon
          const leafletPolygon = L.polygon(latLngs, {
            color: "#10B981", // emerald-500
            weight: 3,
            fillColor: "#10B981",
            fillOpacity: 0.3,
          }).addTo(map);

          // Fit map to polygon bounds
          map.fitBounds(leafletPolygon.getBounds(), { padding: [20, 20] });

          // Add popup with area info
          leafletPolygon.bindPopup(`
            <div class="text-sm">
              <strong>${fieldName}</strong><br/>
              Area: ${areaHa.toFixed(1)} ha
            </div>
          `);
        } else {
          console.warn("Unexpected polygon format:", firstPoint);
        }
      } else {
        console.warn("Polygon is not a valid array:", polygon);
        // Initialize map anyway with default center
        map = L.map(mapRef.current).setView([43.5, 12.0], 10);
        leafletMapRef.current = map;
        L.tileLayer(
          "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
          {
            maxZoom: 19,
            attribution: "© Esri",
          },
        ).addTo(map);
      }
    } catch (error) {
      console.error("Error parsing field polygon:", error);
      console.error("Polygon data:", fieldPolygon);
      // Initialize map anyway with default center
      if (!map && mapRef.current) {
        map = L.map(mapRef.current).setView([43.5, 12.0], 10);
        leafletMapRef.current = map;
        L.tileLayer(
          "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
          {
            maxZoom: 19,
            attribution: "© Esri",
          },
        ).addTo(map);
      }
    }

    // Cleanup function - solo quando il componente viene smontato
    return () => {
      // Non rimuoviamo la mappa qui per evitare problemi di re-rendering
      // La mappa verrà gestita dal componente padre
    };
  }, []); // Solo al mount, gestisce internamente gli aggiornamenti

  return (
    <div
      ref={mapRef}
      className={`w-full h-64 rounded-lg border border-slate-200 ${className}`}
      style={{ minHeight: "256px" }}
    />
  );
};

export default JobFieldMap;

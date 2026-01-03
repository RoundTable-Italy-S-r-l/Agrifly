import { Hono } from "hono";
import {
  calculateDistance,
  generateNavigationLinks,
  formatCoordinatesForGraphHopper,
} from "../utils/routing";
import { GRAPHHOPPER_API_KEY } from "../config";
import { validateBody } from "../middleware/validation";
import { DirectionsRequestSchema } from "../schemas/api.schemas";

const app = new Hono();

// Routing endpoint with GraphHopper API
app.post("/directions", validateBody(DirectionsRequestSchema), async (c) => {
  try {
    const { origin, destination } = c.get("validatedBody");

    // Extract coordinates from origin and destination
    // Expected format: [lng, lat] or { lng, lat }
    let originCoords: string, destCoords: string;

    try {
      originCoords = formatCoordinatesForGraphHopper(origin);
      destCoords = formatCoordinatesForGraphHopper(destination);
    } catch (error: any) {
      return c.json(
        { error: error.message || "Invalid coordinate format" },
        400,
      );
    }

    // GraphHopper API call
    // To enable routing, add GRAPHHOPPER_API_KEY to your .env file
    // Get your free API key at: https://www.graphhopper.com/dashboard/#/register
    console.log(
      "🔑 GraphHopper API Key:",
      GRAPHHOPPER_API_KEY ? "Present" : "Missing",
    );

    if (!GRAPHHOPPER_API_KEY) {
      console.warn(
        "⚠️ No GraphHopper API key found, falling back to distance calculation",
      );

      // Fallback: calculate straight-line distance
      const distance = calculateDistance(origin, destination);
      return c.json({
        distance: {
          text: `${distance.toFixed(1)} km`,
          value: Math.round(distance * 1000), // meters
        },
        duration: {
          text: "Tempo non disponibile",
          value: null,
        },
        fallback: true,
        navigation_links: generateNavigationLinks(originCoords, destCoords),
      });
    }

    const graphHopperUrl = `https://graphhopper.com/api/1/route?point=${originCoords}&point=${destCoords}&vehicle=car&locale=it&instructions=false&key=${GRAPHHOPPER_API_KEY}`;

    const response = await fetch(graphHopperUrl);
    const data = await response.json();

    if (!response.ok || !data.paths || data.paths.length === 0) {
      console.warn(
        "⚠️ GraphHopper API failed, falling back to distance calculation",
      );
      const distance = calculateDistance(origin, destination);
      return c.json({
        distance: {
          text: `${distance.toFixed(1)} km`,
          value: Math.round(distance * 1000),
        },
        duration: {
          text: "Tempo non disponibile",
          value: null,
        },
        fallback: true,
        navigation_links: generateNavigationLinks(originCoords, destCoords),
      });
    }

    const path = data.paths[0];
    const distanceKm = (path.distance / 1000).toFixed(1);
    const durationMin = Math.round(path.time / 60000); // Convert ms to minutes

    return c.json({
      distance: {
        text: `${distanceKm} km`,
        value: path.distance, // meters
      },
      duration: {
        text: `${durationMin} min`,
        value: path.time, // milliseconds
      },
      fallback: false,
      navigation_links: generateNavigationLinks(originCoords, destCoords),
    });
  } catch (error) {
    console.error("🚨 Routing API error:", error);
    return c.json(
      { error: "Internal server error during routing calculation" },
      500,
    );
  }
});

export default app;

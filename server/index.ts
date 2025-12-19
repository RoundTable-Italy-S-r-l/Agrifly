import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "path";

// Configurazione ottimizzata per Supabase
process.env.PRISMA_GENERATE_DATAPROXY = "true";
process.env.PRISMA_GENERATE_ACCELERATE = "true";
import { handleDemo } from "./routes/demo";
import { getDrones, getDroneById } from "./routes/drones";
import { getCrops, getCropById } from "./routes/crops";
import { getTreatments, getTreatmentsByCategory, getTreatmentById } from "./routes/treatments";
import { getAffiliates, getAffiliateById } from "./routes/affiliates";
import { getSavedFields, createSavedField, getSavedFieldById, deleteSavedField } from "./routes/fields";
import { getGisCategories, getGisCategoryById } from "./routes/gis-categories";
import { getOrders, getOrderStats, createSampleOrder } from "./routes/orders";
import { getActiveMissions, getMissionsStats } from "./routes/missions";
import { getPublicCatalog, getVendorCatalog, toggleVendorProduct, updateVendorProduct, initializeVendorCatalog, initializeLenziCatalog, setupTestData, createVendorCatalogItems } from "./routes/catalog";
import * as authRoutes from "./routes/auth";
import { requireAuth } from "./middleware/auth";

export function createServer() {
  const app = express();

  // Middleware
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Logging middleware per debug
  app.use((req, res, next) => {
    if (req.path.startsWith('/api/')) {
      console.log(`📡 ${req.method} ${req.path}`);
    }
    next();
  });

  // Serve GLB files staticamente dalla cartella DJI KB sulla scrivania
  // Path assoluto dalla scrivania
  const glbPath = path.resolve('/Users/macbook/Desktop/DJI KB/glb');
  console.log('Serving GLB files from:', glbPath);
  app.use('/glb', express.static(glbPath, {
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('.glb')) {
        res.setHeader('Content-Type', 'model/gltf-binary');
      }
    }
  }));

  // Serve manuali PDF staticamente dalla cartella DJI KB
  const manualsPath = path.resolve('/Users/macbook/Desktop/DJI KB/manuals/pdfs');
  console.log('Serving manuals from:', manualsPath);
  app.use('/manuals', express.static(manualsPath, {
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('.pdf')) {
        res.setHeader('Content-Type', 'application/pdf');
      }
    }
  }));

  // Health check
  app.get("/api/ping", (_req, res) => {
    const ping = process.env.PING_MESSAGE ?? "pong";
    res.json({ message: ping });
  });

  // Demo route
  app.get("/api/demo", handleDemo);

  // Drones API
  app.get("/api/drones", getDrones);
  app.get("/api/drones/:id", getDroneById);

  // Crops API
  app.get("/api/crops", getCrops);
  app.get("/api/crops/:id", getCropById);

  // Treatments API
  app.get("/api/treatments", getTreatments);
  app.get("/api/treatments/category/:categoryId", getTreatmentsByCategory);
  app.get("/api/treatments/:id", getTreatmentById);

  // Affiliates API
  app.get("/api/affiliates", getAffiliates);
  app.get("/api/affiliates/:id", getAffiliateById);

  // Saved Fields API
  app.get("/api/fields", getSavedFields);
  app.post("/api/fields", createSavedField);
  app.get("/api/fields/:id", getSavedFieldById);
  app.delete("/api/fields/:id", deleteSavedField);

  // GIS Categories API
  app.get("/api/gis-categories", getGisCategories);
  app.get("/api/gis-categories/:id", getGisCategoryById);

  // Orders API
  app.get("/api/orders", getOrders);
  app.get("/api/orders/stats", getOrderStats);
  app.post("/api/orders/sample", createSampleOrder);

  // Missions API
  app.get("/api/missions/active", getActiveMissions);
  app.get("/api/missions/stats", getMissionsStats);

  // Catalog API
  app.get("/api/catalog/public", getPublicCatalog);
  app.get("/api/catalog/vendor/:orgId", getVendorCatalog);
  app.post("/api/catalog/vendor/:orgId/toggle", toggleVendorProduct);
  app.put("/api/catalog/vendor/:orgId/product", updateVendorProduct);
  app.post("/api/catalog/vendor/:orgId/initialize", initializeVendorCatalog);
  app.post("/api/catalog/vendor/:orgId/create-items", createVendorCatalogItems);
  app.post("/api/catalog/initialize/lenzi", initializeLenziCatalog);
  app.post("/api/setup-test-data", setupTestData);

  // Auth API
  app.post("/api/auth/send-verification-code", authRoutes.sendVerificationCode);
  app.post("/api/auth/register", authRoutes.register);
  app.post("/api/auth/login", authRoutes.login);
  app.post("/api/auth/select-organization", authRoutes.selectOrganization);
  app.post("/api/auth/request-password-reset", authRoutes.requestPasswordReset);
  app.post("/api/auth/reset-password", authRoutes.resetPassword);
  app.get("/api/auth/google", authRoutes.googleAuth);
  app.get("/api/auth/google/callback", authRoutes.googleCallback);
  app.get("/api/auth/microsoft", authRoutes.microsoftAuth);
  app.get("/api/auth/microsoft/callback", authRoutes.microsoftCallback);
  app.post("/api/auth/invite", requireAuth, authRoutes.inviteToOrganization);

  return app;
}

// Avvia il server standalone quando eseguito direttamente
// Con tsx/esm, il file viene sempre eseguito come main module
const port = process.env.PORT || 3001;
const server = createServer();

server.listen(port, () => {
  console.log(`🚀 Server Express running on http://localhost:${port}`);
  console.log(`📡 API available at http://localhost:${port}/api/*`);
});

server.on('error', (err: any) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`❌ Port ${port} is already in use`);
  } else {
    console.error('❌ Server error:', err);
  }
  process.exit(1);
});

-- CreateTable
CREATE TABLE "GisCategory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "icon" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Treatment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "targetCrops" TEXT NOT NULL,
    "dosage" TEXT NOT NULL,
    "operatingSpeed" REAL NOT NULL,
    "marketPriceMin" REAL NOT NULL,
    "marketPriceMax" REAL NOT NULL,
    "categoryId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Treatment_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "GisCategory" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Crop" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "yieldPerHa" REAL NOT NULL,
    "marketPrice" REAL NOT NULL,
    "grossRevenue" REAL NOT NULL,
    "tramplingImpact" REAL NOT NULL,
    "tramplingEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Drone" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "model" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "category" TEXT NOT NULL,
    "tagline" TEXT NOT NULL,
    "targetUse" TEXT NOT NULL,
    "imageUrl" TEXT,
    "tankCapacity" TEXT NOT NULL,
    "batteryInfo" TEXT NOT NULL,
    "efficiency" TEXT NOT NULL,
    "features" TEXT NOT NULL,
    "roiMonths" INTEGER NOT NULL,
    "efficiencyHaPerHour" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Affiliate" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "zone" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "jobsDone" INTEGER NOT NULL DEFAULT 0,
    "rating" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "SavedField" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clientName" TEXT NOT NULL,
    "fieldName" TEXT NOT NULL,
    "area" TEXT NOT NULL,
    "slope" REAL NOT NULL,
    "points" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

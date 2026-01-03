/**
 * Mock data centralizzati
 * Usato per sviluppo locale quando il database non ha tutti i dati
 */

export const mockGisCategories = [
  {
    id: "cat1",
    name: "Trattamenti fogliari",
    icon: "🌿",
    description: "Trattamenti fitosanitari per colture",
  },
  {
    id: "cat2",
    name: "Concimazione",
    icon: "🌱",
    description: "Spandimento fertilizzanti e concimi",
  },
  {
    id: "cat3",
    name: "Mappatura",
    icon: "🗺️",
    description: "Rilievo aereo e monitoraggio",
  },
];

export const mockTreatments = [
  {
    id: "treat1",
    name: "Trattamento fungicida",
    type: "liquid" as const,
    categoryId: "cat1",
    marketPriceMin: 25,
    marketPriceMax: 35,
    operatingSpeed: 8,
    dosage: "2-3 L/ha",
    category: {
      id: "cat1",
      name: "Trattamenti fogliari",
      icon: "🌿",
      description: "Trattamenti fitosanitari per colture",
    },
  },
  {
    id: "treat2",
    name: "Trattamento insetticida",
    type: "liquid" as const,
    categoryId: "cat1",
    marketPriceMin: 30,
    marketPriceMax: 40,
    operatingSpeed: 7,
    dosage: "1.5-2.5 L/ha",
    category: {
      id: "cat1",
      name: "Trattamenti fogliari",
      icon: "🌿",
      description: "Trattamenti fitosanitari per colture",
    },
  },
  {
    id: "treat3",
    name: "Concime organico",
    type: "solid" as const,
    categoryId: "cat2",
    marketPriceMin: 15,
    marketPriceMax: 25,
    operatingSpeed: 6,
    dosage: "500-800 kg/ha",
    category: {
      id: "cat2",
      name: "Concimazione",
      icon: "🌱",
      description: "Spandimento fertilizzanti e concimi",
    },
  },
  {
    id: "treat4",
    name: "Mappatura NDVI",
    type: "liquid" as const,
    categoryId: "cat3",
    marketPriceMin: 50,
    marketPriceMax: 70,
    operatingSpeed: 10,
    dosage: "N/A",
    category: {
      id: "cat3",
      name: "Mappatura",
      icon: "🗺️",
      description: "Rilievo aereo e monitoraggio",
    },
  },
];

export const mockDrones = [
  {
    id: "drone1",
    name: "DJI Agras T50",
    model: "T50",
    description: "Drone agricolo professionale per trattamenti di precisione",
    maxPayload: 50,
    maxFlightTime: 25,
    maxSpeed: 15,
    sprayingWidth: 11,
  },
  {
    id: "drone2",
    name: "DJI Agras T30",
    model: "T30",
    description: "Drone versatile per medie estensioni",
    maxPayload: 30,
    maxFlightTime: 20,
    maxSpeed: 12,
    sprayingWidth: 9,
  },
  {
    id: "drone3",
    name: "DJI Agras T20",
    model: "T20",
    description: "Drone compatto per piccole aree",
    maxPayload: 20,
    maxFlightTime: 15,
    maxSpeed: 10,
    sprayingWidth: 7,
  },
];

import { Response } from "express";

/**
 * Gestisce errori Prisma e restituisce array vuoto se la tabella non esiste
 */
export function handlePrismaError(
  error: any,
  res: Response,
  defaultData: any = [],
) {
  // Se la tabella non esiste ancora, restituisci array vuoto invece di errore
  if (error?.code === "P2021" || error?.message?.includes("does not exist")) {
    return res.json(defaultData);
  }

  console.error("Prisma error:", error);
  res.status(500).json({
    error: "Internal server error",
    message: error?.message || "Unknown error",
  });
}

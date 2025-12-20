import { RequestHandler } from "express";
import { prisma } from "../utils/prisma";
import { handlePrismaError } from "../utils/error-handler";
export const getTreatments: RequestHandler = async (req, res) => {
  try {
    const treatments = await prisma.treatment.findMany({
      include: {
        category: true
      },
      orderBy: { name: 'asc' }
    });
    res.json(treatments);
  } catch (error: any) {
    console.error('Errore nel recupero treatments:', error);
    // Restituisci array vuoto invece di errore per non bloccare il frontend
    res.json([]);
  }
};

export const getTreatmentsByCategory: RequestHandler = async (req, res) => {
  try {
    const { categoryId } = req.params;
    const treatments = await prisma.treatment.findMany({
      where: { categoryId },
      include: {
        category: true
      },
      orderBy: { name: 'asc' }
    });
    res.json(treatments);
  } catch (error) {
    console.error('Error fetching treatments by category:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getTreatmentById: RequestHandler = async (req, res) => {
  try {
    const { id } = req.params;
    const treatment = await prisma.treatment.findUnique({
      where: { id },
      include: {
        category: true
      }
    });

    if (!treatment) {
      return res.status(404).json({ error: 'Treatment not found' });
    }

    res.json(treatment);
  } catch (error) {
    console.error('Error fetching treatment:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

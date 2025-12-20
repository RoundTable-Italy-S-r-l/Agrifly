import { RequestHandler } from "express";
import { handlePrismaError } from "../utils/error-handler";
import { prisma } from "../utils/prisma";

export const getGisCategories: RequestHandler = async (req, res) => {
  try {
    const categories = await prisma.gisCategory.findMany({
      include: {
        treatments: true
      },
      orderBy: { name: 'asc' }
    });
    res.json(categories);
  } catch (error: any) {
    console.error('Errore nel recupero GIS categories:', error);
    // Restituisci array vuoto invece di errore per non bloccare il frontend
    res.json([]);
  }
};

export const getGisCategoryById: RequestHandler = async (req, res) => {
  try {
    const { id } = req.params;
    const category = await prisma.gisCategory.findUnique({
      where: { id },
      include: {
        treatments: true
      }
    });

    if (!category) {
      return res.status(404).json({ error: 'GIS category not found' });
    }

    res.json(category);
  } catch (error: any) {
    handlePrismaError(error, res, null);
  }
};

import { RequestHandler } from "express";
import { prisma } from "../utils/prisma";
import { handlePrismaError } from "../utils/error-handler";
export const getCrops: RequestHandler = async (req, res) => {
  try {
    const crops = await prisma.crop.findMany({
      orderBy: { name: 'asc' }
    });
    res.json(crops);
  } catch (error: any) {
    handlePrismaError(error, res, []);
  }
};

export const getCropById: RequestHandler = async (req, res) => {
  try {
    const { id } = req.params;
    const crop = await prisma.crop.findUnique({
      where: { id }
    });

    if (!crop) {
      return res.status(404).json({ error: 'Crop not found' });
    }

    res.json(crop);
  } catch (error) {
    console.error('Error fetching crop:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

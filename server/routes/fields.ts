import { RequestHandler } from "express";
import { prisma } from "../utils/prisma";
export const getSavedFields: RequestHandler = async (req, res) => {
  try {
    const fields = await prisma.savedField.findMany({
      orderBy: { createdAt: 'desc' }
    });
    res.json(fields);
  } catch (error) {
    console.error('Error fetching saved fields:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const createSavedField: RequestHandler = async (req, res) => {
  try {
    const { clientName, fieldName, area, slope, points } = req.body;

    if (!clientName || !fieldName || !area || !points) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const field = await prisma.savedField.create({
      data: {
        clientName,
        fieldName,
        area: area.toString(),
        slope: parseFloat(slope) || 0,
        points: JSON.stringify(points)
      }
    });

    res.status(201).json(field);
  } catch (error) {
    console.error('Error creating saved field:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getSavedFieldById: RequestHandler = async (req, res) => {
  try {
    const { id } = req.params;
    const field = await prisma.savedField.findUnique({
      where: { id }
    });

    if (!field) {
      return res.status(404).json({ error: 'Field not found' });
    }

    // Parse points back to array
    const fieldWithParsedPoints = {
      ...field,
      points: JSON.parse(field.points)
    };

    res.json(fieldWithParsedPoints);
  } catch (error) {
    console.error('Error fetching saved field:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const deleteSavedField: RequestHandler = async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.savedField.delete({
      where: { id }
    });

    res.status(204).send();
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Field not found' });
    }
    console.error('Error deleting saved field:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

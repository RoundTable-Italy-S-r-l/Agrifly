import { RequestHandler } from "express";
import { prisma } from "../utils/prisma";
import { handlePrismaError } from "../utils/error-handler";
export const getAffiliates: RequestHandler = async (req, res) => {
  try {
    // TODO: Implement Affiliate model in Prisma schema
    // For now, return mock data
    const mockAffiliates = [
      {
        id: 1,
        name: "Mario Rossi",
        region: "Trentino",
        zone: "Val di Non",
        status: "active" as const,
        jobsDone: 45,
        rating: 4.8
      },
      {
        id: 2,
        name: "Giovanni Bianchi",
        region: "Veneto",
        zone: "Verona",
        status: "active" as const,
        jobsDone: 32,
        rating: 4.6
      }
    ];
    res.json(mockAffiliates);
  } catch (error: any) {
    handlePrismaError(error, res, []);
  }
};

export const getAffiliateById: RequestHandler = async (req, res) => {
  try {
    const { id } = req.params;
    // TODO: Implement Affiliate model in Prisma schema
    // For now, return mock data
    const mockAffiliate = {
      id: parseInt(id),
      name: "Mario Rossi",
      region: "Trentino",
      zone: "Val di Non",
      status: "active" as const,
      jobsDone: 45,
      rating: 4.8
    };

    if (!mockAffiliate) {
      return res.status(404).json({ error: 'Affiliate not found' });
    }

    res.json(mockAffiliate);
  } catch (error: any) {
    handlePrismaError(error, res, null);
  }
};

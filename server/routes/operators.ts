import { RequestHandler } from "express";
import { handlePrismaError } from "../utils/error-handler";
import { prisma } from "../utils/prisma";

// Ottieni tutti gli operatori per un'organizzazione
export const getOperators: RequestHandler = async (req, res) => {
  try {
    const { orgId } = req.params;

    if (!orgId) {
      return res.status(400).json({ error: 'orgId richiesto' });
    }

    const operators = await prisma.operatorProfile.findMany({
      where: { org_id: orgId },
      include: {
        user: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            email: true,
          }
        },
        home_location: true,
        default_service_area_set: {
          include: {
            items: {
              include: {
                geo_admin_unit: true
              }
            }
          }
        }
      },
      orderBy: { status: 'asc' }
    });

    // Trasforma per il frontend
    const transformed = operators.map(op => ({
      id: op.id,
      user_id: op.user_id,
      org_id: op.org_id,
      first_name: op.user.first_name,
      last_name: op.user.last_name,
      email: op.user.email,
      service_tags: op.service_tags,
      max_hours_per_day: op.max_hours_per_day ? Number(op.max_hours_per_day) : null,
      max_ha_per_day: op.max_ha_per_day ? Number(op.max_ha_per_day) : null,
      home_location: op.home_location?.name || null,
      service_area_set_name: op.default_service_area_set?.name || null,
      status: op.status,
    }));

    res.json(transformed);
  } catch (error: any) {
    console.error('Errore nel recupero operatori:', error);
    handlePrismaError(error, res, []);
  }
};

// Ottieni un operatore specifico
export const getOperator: RequestHandler = async (req, res) => {
  try {
    const { orgId, operatorId } = req.params;

    if (!orgId || !operatorId) {
      return res.status(400).json({ error: 'orgId e operatorId richiesti' });
    }

    const operator = await prisma.operatorProfile.findUnique({
      where: { id: operatorId },
      include: {
        user: true,
        home_location: true,
        default_service_area_set: {
          include: {
            items: {
              include: {
                geo_admin_unit: true
              }
            }
          }
        },
        busy_blocks: {
          where: {
            status: 'ACTIVE',
            end_at: { gte: new Date() }
          },
          orderBy: { start_at: 'asc' },
          take: 50
        }
      }
    });

    if (!operator || operator.org_id !== orgId) {
      return res.status(404).json({ error: 'Operatore non trovato' });
    }

    res.json(operator);
  } catch (error: any) {
    handlePrismaError(error, res, {});
  }
};


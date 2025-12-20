import { RequestHandler } from "express";
import { handlePrismaError } from "../utils/error-handler";
import { prisma } from "../utils/prisma";

// Ottieni tutte le rate cards (servizi) per un vendor
export const getRateCards: RequestHandler = async (req, res) => {
  try {
    const { orgId } = req.params;

    if (!orgId) {
      return res.status(400).json({ error: 'orgId richiesto' });
    }

    const rateCards = await prisma.rateCard.findMany({
      where: { seller_org_id: orgId },
      orderBy: { service_type: 'asc' }
    });

    res.json(rateCards);
  } catch (error: any) {
    handlePrismaError(error, res, []);
  }
};

// Ottieni una rate card specifica
export const getRateCard: RequestHandler = async (req, res) => {
  try {
    const { orgId, serviceType } = req.params;

    if (!orgId || !serviceType) {
      return res.status(400).json({ error: 'orgId e serviceType richiesti' });
    }

    const rateCard = await prisma.rateCard.findUnique({
      where: {
        seller_org_id_service_type: {
          seller_org_id: orgId,
          service_type: serviceType as any
        }
      }
    });

    if (!rateCard) {
      return res.status(404).json({ error: 'Rate card non trovata' });
    }

    res.json(rateCard);
  } catch (error: any) {
    handlePrismaError(error, res, {});
  }
};

// Crea o aggiorna una rate card
export const upsertRateCard: RequestHandler = async (req, res) => {
  try {
    const { orgId } = req.params;
    const {
      service_type,
      base_rate_per_ha_cents,
      min_charge_cents,
      travel_rate_per_km_cents,
      hourly_operator_rate_cents,
      seasonal_multipliers_json,
      risk_multipliers_json
    } = req.body;

    if (!orgId || !service_type) {
      return res.status(400).json({ error: 'orgId e service_type richiesti' });
    }

    const rateCard = await prisma.rateCard.upsert({
      where: {
        seller_org_id_service_type: {
          seller_org_id: orgId,
          service_type: service_type
        }
      },
      update: {
        base_rate_per_ha_cents,
        min_charge_cents,
        travel_rate_per_km_cents,
        hourly_operator_rate_cents,
        seasonal_multipliers_json: seasonal_multipliers_json || null,
        risk_multipliers_json: risk_multipliers_json || null
      },
      create: {
        seller_org_id: orgId,
        service_type: service_type,
        base_rate_per_ha_cents,
        min_charge_cents,
        travel_rate_per_km_cents,
        hourly_operator_rate_cents,
        seasonal_multipliers_json: seasonal_multipliers_json || null,
        risk_multipliers_json: risk_multipliers_json || null
      }
    });

    res.json(rateCard);
  } catch (error: any) {
    handlePrismaError(error, res, {});
  }
};

// Elimina una rate card
export const deleteRateCard: RequestHandler = async (req, res) => {
  try {
    const { orgId, serviceType } = req.params;

    if (!orgId || !serviceType) {
      return res.status(400).json({ error: 'orgId e serviceType richiesti' });
    }

    await prisma.rateCard.delete({
      where: {
        seller_org_id_service_type: {
          seller_org_id: orgId,
          service_type: serviceType as any
        }
      }
    });

    res.json({ success: true });
  } catch (error: any) {
    handlePrismaError(error, res, {});
  }
};


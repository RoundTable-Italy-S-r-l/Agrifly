import { RequestHandler } from "express";
import { handlePrismaError } from "../utils/error-handler";
import { prisma } from "../utils/prisma";

// Ottieni tutte le offerte per un vendor
export const getOffers: RequestHandler = async (req, res) => {
  try {
    const { orgId } = req.params;

    if (!orgId) {
      return res.status(400).json({ error: 'orgId richiesto' });
    }

    const offers = await prisma.offer.findMany({
      where: { vendor_org_id: orgId },
      orderBy: { created_at: 'desc' }
    });

    res.json(offers);
  } catch (error: any) {
    handlePrismaError(error, res, []);
  }
};

// Crea nuova offerta (bundle o promo)
export const createOffer: RequestHandler = async (req, res) => {
  try {
    const { orgId } = req.params;
    const { offer_type, name, rules_json, valid_from, valid_to, status } = req.body;

    if (!orgId || !offer_type || !name || !rules_json) {
      return res.status(400).json({ error: 'orgId, offer_type, name e rules_json richiesti' });
    }

    const offer = await prisma.offer.create({
      data: {
        vendor_org_id: orgId,
        offer_type,
        name,
        rules_json,
        valid_from: valid_from ? new Date(valid_from) : new Date(),
        valid_to: valid_to ? new Date(valid_to) : null,
        status: status || 'ACTIVE'
      }
    });

    res.json(offer);
  } catch (error: any) {
    handlePrismaError(error, res, null);
  }
};

// Aggiorna offerta
export const updateOffer: RequestHandler = async (req, res) => {
  try {
    const { orgId, offerId } = req.params;
    const { name, rules_json, valid_from, valid_to, status } = req.body;

    if (!orgId || !offerId) {
      return res.status(400).json({ error: 'orgId e offerId richiesti' });
    }

    const offer = await prisma.offer.update({
      where: { id: offerId },
      data: {
        name,
        rules_json,
        valid_from: valid_from ? new Date(valid_from) : undefined,
        valid_to: valid_to ? new Date(valid_to) : undefined,
        status
      }
    });

    res.json(offer);
  } catch (error: any) {
    handlePrismaError(error, res, null);
  }
};

// Elimina offerta
export const deleteOffer: RequestHandler = async (req, res) => {
  try {
    const { orgId, offerId } = req.params;

    if (!orgId || !offerId) {
      return res.status(400).json({ error: 'orgId e offerId richiesti' });
    }

    await prisma.offer.delete({
      where: { id: offerId }
    });

    res.json({ success: true });
  } catch (error: any) {
    handlePrismaError(error, res, null);
  }
};


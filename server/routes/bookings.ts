import { RequestHandler } from "express";
import { handlePrismaError } from "../utils/error-handler";
import { prisma } from "../utils/prisma";

// Ottieni tutti i bookings per un'organizzazione
export const getBookings: RequestHandler = async (req, res) => {
  try {
    const { orgId } = req.params;
    const { status, period } = req.query;

    if (!orgId) {
      return res.status(400).json({ error: 'orgId richiesto' });
    }

    const where: any = {
      OR: [
        { seller_org_id: orgId },
        { executor_org_id: orgId }
      ]
    };

    if (status && status !== 'all') {
      where.status = status;
    }

    if (period) {
      const now = new Date();
      let startDate: Date;
      switch (period) {
        case 'today':
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          break;
        case 'week':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'month':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          break;
        default:
          startDate = new Date(0);
      }
      where.created_at = { gte: startDate };
    }

    const bookings = await prisma.booking.findMany({
      where,
      include: {
        buyer_org: true,
        service_site: true,
        booking_slots: {
          include: {
            booking_assignments: {
              include: {
                asset: {
                  include: {
                    product: true
                  }
                }
              }
            }
          },
          orderBy: { start_at: 'asc' }
        }
      },
      orderBy: { created_at: 'desc' },
      take: 100
    });

    // Trasforma per il frontend
    const transformed = bookings.map(booking => {
      const firstSlot = booking.booking_slots[0];
      const assignment = firstSlot?.booking_assignments[0];
      
      return {
        id: booking.id,
        service_type: booking.service_type,
        status: booking.status,
        buyer_org_name: booking.buyer_org.legal_name,
        location: booking.service_site?.name || booking.service_site?.address || 'N/A',
        lat: booking.service_site?.lat ? Number(booking.service_site.lat) : null,
        lon: booking.service_site?.lon ? Number(booking.service_site.lon) : null,
        start_at: firstSlot?.start_at || null,
        end_at: firstSlot?.end_at || null,
        model: assignment?.asset?.product?.model || 'N/A',
        created_at: booking.created_at,
      };
    });

    res.json(transformed);
  } catch (error: any) {
    console.error('Errore nel recupero bookings:', error);
    handlePrismaError(error, res, []);
  }
};


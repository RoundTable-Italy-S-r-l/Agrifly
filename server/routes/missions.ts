import { RequestHandler } from "express";
import { handlePrismaError } from "../utils/error-handler";
import { prisma } from "../utils/prisma";

// Ottieni missioni attive per dashboard
export const getActiveMissions: RequestHandler = async (req, res) => {
  try {
    const { orgId } = req.query;

    if (!orgId || typeof orgId !== 'string') {
      return res.status(400).json({ error: 'orgId richiesto' });
    }

    // Trova bookings attivi (con missioni in corso o programmate)
    const activeBookings = await prisma.booking.findMany({
      where: {
        seller_org_id: orgId,
        status: { in: ['confirmed', 'in_progress'] }
      },
      include: {
        booking_slots: {
          include: {
            booking_assignments: {
              include: {
                pilot_user: true,
                asset: {
                  include: {
                    product: true
                  }
                }
              }
            },
            missions: true
          }
        },
        service_site: true
      },
      orderBy: { created_at: 'desc' },
      take: 10
    });

    // Trasforma per il frontend
    const transformedMissions = activeBookings.map(booking => {
      const firstSlot = booking.booking_slots[0];
      const firstAssignment = firstSlot?.booking_assignments[0];
      const mission = firstSlot?.missions[0];

      // Calcola progresso basato sui dati disponibili
      let progress = 0;
      let status = 'scheduled';

      if (mission) {
        if (mission.executed_start_at && mission.executed_end_at) {
          status = 'completed';
          progress = 100;
        } else if (mission.executed_start_at) {
          status = 'in_progress';
          // Calcola progresso basato sul tempo (semplificato)
          const now = new Date();
          const start = new Date(mission.executed_start_at);
          const duration = firstSlot.end_at.getTime() - firstSlot.start_at.getTime();
          const elapsed = now.getTime() - start.getTime();
          progress = Math.min(100, Math.max(0, (elapsed / duration) * 100));
        }
      }

      return {
        id: booking.id,
        location: booking.service_site?.name || `${booking.service_site?.city || 'Località'} - Campo`,
        operator: firstAssignment?.pilot_user ?
          `${firstAssignment.pilot_user.first_name} ${firstAssignment.pilot_user.last_name}` :
          'Operatore da assegnare',
        area: firstSlot ? Math.round((firstSlot.end_at.getTime() - firstSlot.start_at.getTime()) / (1000 * 60 * 60) * 2) : 10, // Stima area basata su durata (2 ha/ora)
        progress: Math.round(progress),
        status
      };
    });

    res.json(transformedMissions);
  } catch (error: any) {
    console.error('Errore nel recupero missioni attive:', error);
    handlePrismaError(error, res, []);
  }
};

// Ottieni statistiche missioni per dashboard
export const getMissionsStats: RequestHandler = async (req, res) => {
  try {
    const { orgId } = req.query;

    if (!orgId || typeof orgId !== 'string') {
      return res.status(400).json({ error: 'orgId richiesto' });
    }

    // Statistiche missioni
    const [
      totalMissions,
      activeMissions,
      completedThisMonth,
      totalAreaTreated
    ] = await Promise.all([
      // Missioni totali completate
      prisma.mission.count({
        where: {
          booking: {
            seller_org_id: orgId
          },
          executed_end_at: { not: null }
        }
      }),

      // Missioni attive
      prisma.booking.count({
        where: {
          seller_org_id: orgId,
          status: 'in_progress'
        }
      }),

      // Missioni completate questo mese
      prisma.mission.count({
        where: {
          booking: {
            seller_org_id: orgId
          },
          executed_end_at: {
            not: null,
            gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
          }
        }
      }),

      // Area totale trattata (stima semplificata)
      prisma.mission.aggregate({
        where: {
          booking: {
            seller_org_id: orgId
          },
          executed_end_at: { not: null }
        },
        _sum: {
          actual_area_ha: true
        }
      })
    ]);

    res.json({
      totalMissions,
      activeMissions,
      completedThisMonth,
      totalAreaTreated: totalAreaTreated._sum.actual_area_ha || 0
    });
  } catch (error: any) {
    console.error('Errore nel recupero statistiche missioni:', error);
    handlePrismaError(error, res, {
      totalMissions: 0,
      activeMissions: 0,
      completedThisMonth: 0,
      totalAreaTreated: 0
    });
  }
};

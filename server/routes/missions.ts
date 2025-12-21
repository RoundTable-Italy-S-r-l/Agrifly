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
        status: { in: ['CONFIRMED', 'IN_PROGRESS'] }
      },
      include: {
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
            },
            missions: true
          }
        },
        service_site: true
      },
      orderBy: { created_at: 'desc' },
      take: 10
    });

      // Ottieni operatori per le assegnazioni
      const assignmentUserIds = activeBookings
        .flatMap(b => b.booking_slots.flatMap(s => s.booking_assignments.map(a => a.pilot_user_id)))
        .filter((id): id is string => id !== null);

      const users = assignmentUserIds.length > 0 ? await prisma.user.findMany({
        where: { id: { in: assignmentUserIds } },
        select: { id: true, first_name: true, last_name: true }
      }) : [];

      const userMap = new Map(users.map(u => [u.id, u]));

      // Trasforma per il frontend
      const transformedMissions = activeBookings.map(booking => {
        const firstSlot = booking.booking_slots[0];
        const firstAssignment = firstSlot?.booking_assignments[0];
        const mission = firstSlot?.missions[0];
        const pilotUser = firstAssignment?.pilot_user_id ? userMap.get(firstAssignment.pilot_user_id) : null;

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
          location: booking.service_site?.name || `${booking.service_site?.address || 'Località'} - Campo`,
          operator: pilotUser ?
            `${pilotUser.first_name} ${pilotUser.last_name}` :
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

// Ottieni tutte le missioni con filtri
export const getMissions: RequestHandler = async (req, res) => {
  try {
    const { orgId, period, serviceType, operatorId, status, location } = req.query;

    if (!orgId || typeof orgId !== 'string') {
      return res.status(400).json({ error: 'orgId richiesto' });
    }

    // Costruisci filtri
    const where: any = {
      booking: {
        OR: [
          { seller_org_id: orgId },
          { executor_org_id: orgId }
        ]
      }
    };

    if (serviceType) {
      where.booking = {
        ...where.booking,
        service_type: serviceType
      };
    }

    if (status) {
      if (status === 'DONE') {
        where.executed_end_at = { not: null };
      } else if (status === 'CANCELLED') {
        where.booking = {
          ...where.booking,
          status: 'CANCELLED'
        };
      }
    }

    // Filtro periodo
    if (period) {
      const now = new Date();
      let startDate: Date;
      switch (period) {
        case '7d':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case '30d':
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        case 'season':
          startDate = new Date(now.getFullYear(), 2, 1); // Marzo
          break;
        default:
          startDate = new Date(0);
      }
      where.executed_start_at = { gte: startDate };
    }

    const missions = await prisma.mission.findMany({
      where,
      include: {
        booking: {
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
              }
            }
          }
        },
        booking_slot: {
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
          }
        }
      },
      orderBy: { executed_start_at: 'desc' },
      take: 100
    });

    // Trasforma per il frontend
    const transformed = missions.map(mission => {
      // Prova a ottenere l'assegnazione dal booking_slot della missione, altrimenti dal primo slot del booking
      const assignment = mission.booking_slot?.booking_assignments[0] || 
                         mission.booking.booking_slots[0]?.booking_assignments[0];
      const asset = assignment?.asset;
      const model = asset?.product?.model || 'N/A';
      
      return {
        id: mission.id,
        booking_id: mission.booking_id,
        service_type: mission.booking.service_type,
        executed_start_at: mission.executed_start_at,
        executed_end_at: mission.executed_end_at,
        actual_area_ha: mission.actual_area_ha ? Number(mission.actual_area_ha) : null,
        actual_hours: mission.actual_hours ? Number(mission.actual_hours) : null,
        notes: mission.notes,
        buyer_org_name: mission.booking.buyer_org.legal_name,
        location: mission.booking.service_site?.name || mission.booking.service_site?.address || 'N/A',
        lat: mission.booking.service_site?.lat ? Number(mission.booking.service_site.lat) : null,
        lon: mission.booking.service_site?.lon ? Number(mission.booking.service_site.lon) : null,
        operator: 'Operatore', // TODO: ottenere da User tramite pilot_user_id
        model,
        status: mission.executed_end_at ? 'DONE' : mission.executed_start_at ? 'IN_PROGRESS' : 'SCHEDULED'
      };
    });

    res.json(transformed);
  } catch (error: any) {
    console.error('Errore nel recupero missioni:', error);
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

    // Usa query semplice sui booking invece delle missioni per evitare problemi con prepared statements
    try {
      const bookings = await prisma.booking.findMany({
        where: { seller_org_id: orgId },
        include: { 
          missions: {
            select: {
              executed_end_at: true,
              executed_start_at: true,
              actual_area_ha: true
            }
          }
        }
      });

      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

      // Calcola statistiche dai booking e missioni
      const totalMissions = bookings.filter(b => 
        b.status === 'DONE' && b.missions.some(m => m.executed_end_at !== null)
      ).length;
      
      const activeMissions = bookings.filter(b => 
        b.status === 'IN_PROGRESS' || 
        b.missions.some(m => m.executed_start_at && !m.executed_end_at)
      ).length;
      
      const completedThisMonth = bookings.filter(b => 
        b.status === 'DONE' && 
        b.created_at >= monthStart &&
        b.missions.some(m => m.executed_end_at && m.executed_end_at >= monthStart)
      ).length;
      
      const totalAreaTreated = bookings
        .flatMap(b => b.missions)
        .filter(m => m.executed_end_at && m.actual_area_ha)
        .reduce((sum, m) => sum + Number(m.actual_area_ha || 0), 0);

      return res.json({
        totalMissions,
        activeMissions,
        completedThisMonth,
        totalAreaTreated
      });
    } catch (dbError: any) {
      // Se la query fallisce, restituisci valori basati solo sui booking (senza missioni)
      console.warn('Query booking con missioni fallita, uso fallback semplice:', dbError.message);
      const simpleBookings = await prisma.booking.findMany({
        where: { seller_org_id: orgId },
        select: { status: true, created_at: true }
      });

      const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
      const totalMissions = simpleBookings.filter(b => b.status === 'DONE').length;
      const activeMissions = simpleBookings.filter(b => b.status === 'IN_PROGRESS').length;
      const completedThisMonth = simpleBookings.filter(b => 
        b.status === 'DONE' && b.created_at >= monthStart
      ).length;

      return res.json({
        totalMissions,
        activeMissions,
        completedThisMonth,
        totalAreaTreated: 0 // Non disponibile senza query missioni
      });
    }
  } catch (error: any) {
    console.error('Errore nel recupero statistiche missioni:', error);
    // Restituisci sempre valori di default invece di errore
    res.json({
      totalMissions: 0,
      activeMissions: 0,
      completedThisMonth: 0,
      totalAreaTreated: 0
    });
  }
};

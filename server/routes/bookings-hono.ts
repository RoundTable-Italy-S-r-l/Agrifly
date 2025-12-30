import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth';
import { query } from '../utils/database';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../config';

const app = new Hono();

// Migration function to ensure bookings table has all required columns
let migrationExecuted = false;
async function ensureBookingsTableColumns() {
  if (migrationExecuted) return; // Execute only once per server instance
  
  // Use same logic as database.ts to determine database type
  const hasPostgresConfig = process.env.PGHOST && process.env.PGUSER && process.env.PGPASSWORD;
  const hasFileDatabase = process.env.DATABASE_URL?.startsWith('file:');
  const isPostgreSQL = hasPostgresConfig || (!hasFileDatabase && process.env.DATABASE_URL && (process.env.DATABASE_URL.startsWith('postgresql://') || process.env.DATABASE_URL.startsWith('postgres://')));
  
  try {
    if (isPostgreSQL) {
      // PostgreSQL: Use IF NOT EXISTS
      await query(`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW()`, []);
      await query(`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS payment_status VARCHAR(50) DEFAULT 'PENDING'`, []);
      await query(`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS paid_at TIMESTAMP`, []);
    } else {
      // SQLite: Try to add columns, ignore errors if they already exist
      try {
        await query(`ALTER TABLE bookings ADD COLUMN updated_at TEXT`, []);
        // Popola updated_at con created_at per i record esistenti
        await query(`UPDATE bookings SET updated_at = created_at WHERE updated_at IS NULL`, []);
      } catch (err: any) {
        if (!err.message?.includes('duplicate column')) {
          throw err;
        }
      }
      
      try {
        await query(`ALTER TABLE bookings ADD COLUMN payment_status TEXT DEFAULT 'PENDING'`, []);
      } catch (err: any) {
        if (!err.message?.includes('duplicate column')) {
          throw err;
        }
      }
      
      try {
        await query(`ALTER TABLE bookings ADD COLUMN paid_at TEXT`, []);
      } catch (err: any) {
        if (!err.message?.includes('duplicate column')) {
          throw err;
        }
      }
    }
    migrationExecuted = true;
    console.log('✅ [BOOKINGS MIGRATION] Migration completed');
  } catch (err: any) {
    // If table doesn't exist, that's fine - it will be created elsewhere
    if (!err.message?.includes('no such table') && !err.message?.includes('does not exist')) {
      console.log('📋 [BOOKINGS MIGRATION] Error:', err.message);
    }
    migrationExecuted = true; // Mark as executed even on error to avoid retrying
  }
}

// ============================================================================
// BOOKINGS LIST
// ============================================================================

app.get('/:orgId', authMiddleware, async (c) => {
  try {
    const user = c.get('user');
    const orgId = c.req.param('orgId');
    const period = c.req.query('period') || 'week';

    console.log('📅 [GET BOOKINGS] Endpoint chiamato:', { orgId, period, userId: user?.id, userOrgId: user?.organizationId });

    if (!orgId) {
      return c.json({ error: 'Organization ID required' }, 400);
    }

    // Verify user belongs to organization
    if (!user || user.organizationId !== orgId) {
      console.log('❌ [GET BOOKINGS] Unauthorized:', { userOrgId: user?.organizationId, requestedOrgId: orgId });
      return c.json({ error: 'Unauthorized' }, 403);
    }

    console.log('📅 [GET BOOKINGS] Richiesta bookings per org:', orgId, 'periodo:', period);

    // Ensure bookings table has all required columns (migration - executed only once)
    await ensureBookingsTableColumns();

    // Query to get bookings where organization is buyer or executor
    console.log('📋 [GET BOOKINGS] Executing query with orgId:', orgId);
    
    // First, let's check if there are any bookings at all (for debugging)
    const allBookingsCheck = await query(`SELECT COUNT(*) as count FROM bookings`, []);
    console.log('📋 [GET BOOKINGS] Total bookings in database:', allBookingsCheck.rows[0]?.count || 0);
    
    // Also check bookings with this orgId to see if any exist
    const orgBookingsCheck = await query(`
      SELECT COUNT(*) as count FROM bookings 
      WHERE buyer_org_id = $1 OR executor_org_id = $1
    `, [orgId]);
    console.log('📋 [GET BOOKINGS] Bookings for orgId', orgId, ':', orgBookingsCheck.rows[0]?.count || 0);
    
    const bookingsResult = await query(`
      SELECT 
        b.id, b.job_id, b.accepted_offer_id, b.buyer_org_id, b.executor_org_id,
        b.service_type, b.site_snapshot_json, b.status, 
        COALESCE(b.payment_status, 'PENDING') as payment_status,
        b.paid_at, b.created_at, 
        COALESCE(b.updated_at, b.created_at) as updated_at,
        j.field_name, j.area_ha, j.service_type as job_service_type,
        j.status as job_status,
        buyer_org.legal_name as buyer_org_legal_name,
        executor_org.legal_name as executor_org_legal_name,
        jo.total_cents, jo.operator_org_id,
        operator_org.legal_name as operator_org_legal_name
      FROM bookings b
      LEFT JOIN jobs j ON b.job_id = j.id
      LEFT JOIN organizations buyer_org ON b.buyer_org_id = buyer_org.id
      LEFT JOIN organizations executor_org ON b.executor_org_id = executor_org.id
      LEFT JOIN job_offers jo ON b.accepted_offer_id = jo.id
      LEFT JOIN organizations operator_org ON jo.operator_org_id = operator_org.id
      WHERE (b.buyer_org_id = $1 OR b.executor_org_id = $1)
      ORDER BY b.created_at DESC
    `, [orgId]);

    console.log('📋 [GET BOOKINGS] Query result:', {
      rowsCount: bookingsResult.rows.length,
      rawRows: bookingsResult.rows.map((r: any) => ({
        id: r.id,
        job_id: r.job_id,
        accepted_offer_id: r.accepted_offer_id,
        status: r.status
      }))
    });

    // Format bookings to match frontend expectations
    const bookings = bookingsResult.rows.map((row: any) => {
      const siteSnapshot = row.site_snapshot_json 
        ? (typeof row.site_snapshot_json === 'string' 
            ? JSON.parse(row.site_snapshot_json) 
            : row.site_snapshot_json)
        : null;

      return {
        id: row.id,
        job_id: row.job_id,
        accepted_offer_id: row.accepted_offer_id,
        buyer_org_id: row.buyer_org_id,
        executor_org_id: row.executor_org_id,
        service_type: row.service_type || row.job_service_type,
        status: row.status,
        payment_status: row.payment_status || 'PENDING',
        paid_at: row.paid_at,
        created_at: row.created_at,
        updated_at: row.updated_at || row.created_at,
        job: {
          id: row.job_id,
          field_name: row.field_name,
          area_ha: row.area_ha ? parseFloat(row.area_ha) : null,
          service_type: row.job_service_type,
          status: row.job_status,
          buyer_org: {
            id: row.buyer_org_id,
            legal_name: row.buyer_org_legal_name || 'N/A'
          }
        },
        accepted_offer: row.accepted_offer_id ? {
          id: row.accepted_offer_id,
          total_cents: row.total_cents ? parseInt(row.total_cents) : 0,
          operator_org: {
            id: row.operator_org_id,
            legal_name: row.operator_org_legal_name || 'N/A'
          }
        } : null,
        buyer_org: {
          id: row.buyer_org_id,
          legal_name: row.buyer_org_legal_name || 'N/A'
        },
        executor_org: {
          id: row.executor_org_id,
          legal_name: row.executor_org_legal_name || 'N/A'
        }
      };
    });

    console.log('✅ Recuperati', bookings.length, 'bookings');
    console.log('📋 [GET BOOKINGS] Formatted bookings:', bookings.map((b: any) => ({
      id: b.id,
      job_id: b.job_id,
      accepted_offer_id: b.accepted_offer_id,
      status: b.status
    })));

    return c.json({ bookings });

  } catch (error: any) {
    console.error('❌ Errore get bookings:', error);
    return c.json({
      error: 'Errore interno',
      message: error.message
    }, 500);
  }
});

// Placeholder per altre routes
app.get('/', (c) => c.json({ message: 'bookings API' }));

// Export function for Express server compatibility - COMMENTED OUT: uses Prisma which is not available
/*
export async function getBookings(req: any, res: any) {
  try {
    // Verify authentication
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Token mancante' });
    }

    const token = authHeader.substring(7);
    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      return res.status(401).json({ error: 'Token non valido' });
    }

    const { orgId } = req.params;

    // Verify user belongs to organization
    const membership = await prisma.orgMembership.findFirst({
      where: {
        org_id: orgId,
        user_id: decoded.userId,
        is_active: true
      },
      include: { org: true }
    });

    if (!membership) {
      return res.status(403).json({ error: 'Accesso negato' });
    }

    // Get bookings where organization is buyer or executor
    const bookings = await prisma.booking.findMany({
      where: {
        OR: [
          { buyer_org_id: orgId },
          { executor_org_id: orgId }
        ]
      },
      include: {
        job: {
          include: {
            buyer_org: { select: { id: true, legal_name: true } }
          }
        },
        accepted_offer: {
          include: {
            operator_org: { select: { id: true, legal_name: true } }
          }
        },
        buyer_org: { select: { id: true, legal_name: true } },
        executor_org: { select: { id: true, legal_name: true } }
      },
      orderBy: { created_at: 'desc' }
    });

    res.json(bookings);

  } catch (error) {
    console.error('❌ [GET BOOKINGS] Error:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
}
*/

export default app;

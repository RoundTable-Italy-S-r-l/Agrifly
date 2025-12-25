import { Hono } from 'hono';
import { query } from '../utils/database';

const app = new Hono();

// ============================================================================
// MISSIONS STATS
// ============================================================================

app.get('/stats', async (c) => {
  try {
    const orgId = c.req.query('orgId');

    if (!orgId) {
      return c.json({ error: 'orgId parameter required' }, 400);
    }

    console.log('📊 Richiesta statistiche missioni per org:', orgId);

    // Query per ottenere le statistiche delle missioni
    const statsQuery = `
      SELECT
        COUNT(*) as total_missions,
        COUNT(CASE WHEN status = 'in_progress' THEN 1 END) as active_missions,
        COUNT(CASE WHEN status = 'completed' AND completed_at >= DATE_TRUNC('month', NOW()) THEN 1 END) as completed_this_month,
        COALESCE(SUM(area_treated_ha), 0) as total_area_treated
      FROM missions
      WHERE organization_id = $1
    `;

    const result = await query(statsQuery, [orgId]);

    if (result.rows.length === 0) {
      return c.json({
        totalMissions: 0,
        activeMissions: 0,
        completedThisMonth: 0,
        totalAreaTreated: 0
      });
    }

    const stats = result.rows[0];

    const response = {
      totalMissions: parseInt(stats.total_missions) || 0,
      activeMissions: parseInt(stats.active_missions) || 0,
      completedThisMonth: parseInt(stats.completed_this_month) || 0,
      totalAreaTreated: parseFloat(stats.total_area_treated) || 0
    };

    console.log('✅ Statistiche missioni calcolate:', response);

    return c.json(response);

  } catch (error: any) {
    console.error('❌ Errore get missions stats:', error);
    return c.json({
      error: 'Errore interno',
      message: error.message
    }, 500);
  }
});

// ============================================================================
// ACTIVE MISSIONS
// ============================================================================

app.get('/active', async (c) => {
  try {
    const orgId = c.req.query('orgId');

    if (!orgId) {
      return c.json({ error: 'orgId parameter required' }, 400);
    }

    console.log('🎯 Richiesta missioni attive per org:', orgId);

    // Query per ottenere le missioni attive
    const activeMissionsQuery = `
      SELECT
        id,
        name,
        status,
        area_treated_ha,
        estimated_duration_hours,
        assigned_operator_id,
        scheduled_date,
        started_at,
        completed_at,
        created_at
      FROM missions
      WHERE organization_id = $1 AND status = 'in_progress'
      ORDER BY created_at DESC
      LIMIT 10
    `;

    const result = await query(activeMissionsQuery, [orgId]);

    console.log('✅ Missioni attive recuperate:', result.rows.length);

    return c.json(result.rows);

  } catch (error: any) {
    console.error('❌ Errore get active missions:', error);
    return c.json({
      error: 'Errore interno',
      message: error.message
    }, 500);
  }
});

// ============================================================================
// MISSIONS LIST
// ============================================================================

app.get('/', async (c) => {
  try {
    const orgId = c.req.query('orgId');
    const limit = parseInt(c.req.query('limit') || '20');
    const offset = parseInt(c.req.query('offset') || '0');

    if (!orgId) {
      return c.json({ error: 'orgId parameter required' }, 400);
    }

    console.log('📋 Richiesta lista missioni per org:', orgId, 'limit:', limit, 'offset:', offset);

    // Query per ottenere la lista delle missioni
    const missionsQuery = `
      SELECT
        id,
        name,
        status,
        area_treated_ha,
        estimated_duration_hours,
        assigned_operator_id,
        scheduled_date,
        started_at,
        completed_at,
        created_at
      FROM missions
      WHERE organization_id = $1
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3
    `;

    const result = await query(missionsQuery, [orgId, limit, offset]);

    console.log('✅ Missioni recuperate:', result.rows.length);

    return c.json(result.rows);

  } catch (error: any) {
    console.error('❌ Errore get missions:', error);
    return c.json({
      error: 'Errore interno',
      message: error.message
    }, 500);
  }
});

export default app;

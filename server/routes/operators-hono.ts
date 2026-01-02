import { Hono } from 'hono';
import { query } from '../utils/database';
import { authMiddleware } from '../middleware/auth';
import { validateBody, validateParams } from '../middleware/validation';
import { CreateOperatorSchema, UpdateOperatorSchema, DeleteOperatorParamsSchema } from '../schemas/api.schemas';

const app = new Hono();

// ============================================================================
// GET OPERATORS LIST
// ============================================================================

app.get('/:orgId', async (c) => {
  try {
    const orgId = c.req.param('orgId');
    const serviceType = c.req.query('serviceType');
    const internal = c.req.query('internal') === 'true';

    if (!orgId) {
      return c.json({ error: 'Organization ID required' }, 400);
    }

    console.log('👥 Richiesta lista operatori per org:', orgId, serviceType ? `servizio: ${serviceType}` : '', internal ? '(richiesta interna)' : '(richiesta esterna)');

    // Determina se mostrare operatori individuali
    // Le richieste interne (dashboard aziendale) mostrano sempre tutti gli operatori
    let showIndividualOperators = true;

    if (!internal) {
      // Solo per richieste esterne (clienti) applica le impostazioni di visibilità
      if (serviceType) {
        // Controlla l'impostazione per servizio specifico
        const serviceQuery = `SELECT show_company_only FROM rate_cards WHERE seller_org_id = $1 AND service_type = $2`;
        const serviceResult = await query(serviceQuery, [orgId, serviceType]);
        if (serviceResult.rows.length > 0) {
          showIndividualOperators = !serviceResult.rows[0].show_company_only;
        }
      } else {
        // Fallback all'impostazione globale dell'organizzazione
        const orgSettingsQuery = `SELECT show_individual_operators FROM organizations WHERE id = $1`;
        const orgResult = await query(orgSettingsQuery, [orgId]);
        showIndividualOperators = orgResult.rows[0]?.show_individual_operators ?? true;
      }
    }

    const dbUrl = process.env.DATABASE_URL || '';
    const isPostgreSQL = dbUrl.startsWith('postgresql://') || dbUrl.startsWith('postgres://') || !!process.env.PGHOST;
    
    let operatorsQuery;
    let queryParams;

    if (!showIndividualOperators) {
      // Se l'azienda non vuole mostrare operatori individuali,
      // restituisci un operatore "virtuale" che rappresenta l'azienda
      const serviceTagsArray = isPostgreSQL 
        ? "ARRAY['SPRAY', 'SPREAD', 'MAPPING']::text[]"
        : "'[\"SPRAY\", \"SPREAD\", \"MAPPING\"]'";
      operatorsQuery = `
        SELECT
          'company_' || o.id as id,
          NULL as user_id,
          o.id as org_id,
          NULL as home_location_id,
          NULL as max_hours_per_day,
          NULL as max_ha_per_day,
          ${serviceTagsArray} as service_tags,
          NULL as default_service_area_set_id,
          'ORG_DEFAULT' as service_area_mode,
          'ACTIVE' as status,
          o.legal_name as first_name,
          '' as last_name,
          o.support_email as email,
          NULL as home_location_name,
          NULL as service_area_set_name,
          'company' as source_type
        FROM organizations o
        WHERE o.id = $1 AND o.status = 'ACTIVE'
      `;
      queryParams = [orgId];
    } else {
      // Mostra operatori individuali come prima
      operatorsQuery = `
        SELECT
          COALESCE(op.id, 'member_' || om.id) as id,
          COALESCE(op.user_id, om.user_id) as user_id,
          COALESCE(op.org_id, om.org_id) as org_id,
          op.home_location_id,
          op.max_hours_per_day,
          op.max_ha_per_day,
          op.service_tags,
          op.default_service_area_set_id,
          op.service_area_mode,
          COALESCE(op.status, 'ACTIVE') as status,
          u.first_name,
          u.last_name,
          u.email,
          l.name as home_location_name,
          s.name as service_area_set_name,
          CASE WHEN op.id IS NOT NULL THEN 'profile' ELSE 'member' END as source_type
        FROM org_memberships om
        LEFT JOIN operator_profiles op ON om.user_id = op.user_id AND om.org_id = op.org_id
        LEFT JOIN users u ON om.user_id = u.id
        LEFT JOIN locations l ON op.home_location_id = l.id
        LEFT JOIN service_area_sets s ON op.default_service_area_set_id = s.id
        WHERE om.org_id = $1 AND om.is_active = true AND om.role IN ('operator', 'dispatcher')
        ORDER BY u.first_name, u.last_name
      `;
      queryParams = [orgId];
    }

    const result = await query(operatorsQuery, [orgId]);

    // Formatta i risultati per il frontend
    const operators = result.rows.map(row => ({
      id: row.id,
      user_id: row.user_id,
      org_id: row.org_id,
      first_name: row.first_name || 'Operatore',
      last_name: row.last_name || 'Interno',
      email: row.email || '',
      service_tags: row.service_tags || [],
      max_hours_per_day: row.max_hours_per_day ? parseFloat(row.max_hours_per_day) : null,
      max_ha_per_day: row.max_ha_per_day ? parseFloat(row.max_ha_per_day) : null,
      home_location: row.home_location_name || null,
      service_area_set_name: row.service_area_set_name || null,
      status: row.status
    }));

    console.log('✅ Recuperati', operators.length, 'operatori');

    return c.json(operators);

  } catch (error: any) {
    console.error('❌ Errore get operators:', error);
    return c.json({
      error: 'Errore interno',
      message: error.message
    }, 500);
  }
});

// ============================================================================
// GET SINGLE OPERATOR
// ============================================================================

app.get('/:orgId/:operatorId', async (c) => {
  try {
    const orgId = c.req.param('orgId');
    const operatorId = c.req.param('operatorId');

    if (!orgId || !operatorId) {
      return c.json({ error: 'Organization ID and Operator ID required' }, 400);
    }

    console.log('👤 Richiesta dettaglio operatore:', operatorId, 'org:', orgId);

    const dbUrl = process.env.DATABASE_URL || '';
    const isPostgreSQL = dbUrl.startsWith('postgresql://') || dbUrl.startsWith('postgres://') || !!process.env.PGHOST;

    // Query per ottenere il dettaglio dell'operatore
    // Gestisce operatori individuali, membri senza profilo, e operatori "company"
    let operatorQuery;
    let queryParams;

    if (operatorId.startsWith('company_')) {
      // È l'operatore "company" (rappresenta l'azienda)
      const serviceTagsArray = isPostgreSQL 
        ? "ARRAY['SPRAY', 'SPREAD', 'MAPPING']::text[]"
        : "'[\"SPRAY\", \"SPREAD\", \"MAPPING\"]'";
      operatorQuery = `
        SELECT
          'company_' || o.id as id,
          NULL as user_id,
          o.id as org_id,
          NULL as home_location_id,
          NULL as max_hours_per_day,
          NULL as max_ha_per_day,
          ${serviceTagsArray} as service_tags,
          NULL as default_service_area_set_id,
          'ORG_DEFAULT' as service_area_mode,
          'ACTIVE' as status,
          o.legal_name as first_name,
          '' as last_name,
          o.support_email as email,
          NULL as home_location_name,
          NULL as latitude,
          NULL as longitude,
          NULL as service_area_set_name
        FROM organizations o
        WHERE o.id = $1 AND o.status = 'ACTIVE'
      `;
      queryParams = [orgId];
    } else if (operatorId.startsWith('member_')) {
      // È un membro senza profilo operatore dedicato
      const emptyServiceTagsArray = isPostgreSQL ? "ARRAY[]::text[]" : "'[]'";
      operatorQuery = `
        SELECT
          om.id,
          om.user_id,
          om.role,
          om.is_active,
          om.created_at,
          u.first_name,
          u.last_name,
          u.email,
          NULL as home_location_id,
          NULL as max_hours_per_day,
          NULL as max_ha_per_day,
          ${emptyServiceTagsArray} as service_tags,
          NULL as default_service_area_set_id,
          NULL as service_area_mode,
          'ACTIVE' as status,
          NULL as home_location_name,
          NULL as latitude,
          NULL as longitude,
          NULL as service_area_set_name
        FROM org_memberships om
        JOIN users u ON om.user_id = u.id
        WHERE om.org_id = $1 AND om.id = $2
      `;
      queryParams = [orgId, operatorId.replace('member_', '')];
    } else {
      // È un operatore con profilo dedicato
      operatorQuery = `
        SELECT
          op.id,
          op.user_id,
          op.org_id,
          op.home_location_id,
          op.max_hours_per_day,
          op.max_ha_per_day,
          op.service_tags,
          op.default_service_area_set_id,
          op.service_area_mode,
          op.status,
          u.first_name,
          u.last_name,
          u.email,
          l.name as home_location_name,
          l.latitude,
          l.longitude,
          s.name as service_area_set_name
        FROM operator_profiles op
        LEFT JOIN users u ON op.user_id = u.id
        LEFT JOIN locations l ON op.home_location_id = l.id
        LEFT JOIN service_area_sets s ON op.default_service_area_set_id = s.id
        WHERE op.id = $1 AND op.org_id = $2
      `;
      queryParams = [operatorId, orgId];
    }

    const result = await query(operatorQuery, queryParams);

    if (result.rows.length === 0) {
      return c.json({ error: 'Operatore non trovato' }, 404);
    }

    const row = result.rows[0];
    const operator = {
      id: row.id,
      user_id: row.user_id,
      org_id: row.org_id,
      first_name: row.first_name || 'Operatore',
      last_name: row.last_name || 'Interno',
      email: row.email || '',
      service_tags: row.service_tags || [],
      max_hours_per_day: row.max_hours_per_day ? parseFloat(row.max_hours_per_day) : null,
      max_ha_per_day: row.max_ha_per_day ? parseFloat(row.max_ha_per_day) : null,
      home_location: row.home_location_name || null,
      home_location_coords: row.latitude && row.longitude ? {
        lat: parseFloat(row.latitude),
        lng: parseFloat(row.longitude)
      } : null,
      service_area_set_name: row.service_area_set_name || null,
      status: row.status,
      // Aggiungiamo info aggiuntive per il dettaglio
      service_area_mode: row.service_area_mode,
      has_user_account: !!row.user_id
    };

    console.log('✅ Dettaglio operatore recuperato');

    return c.json(operator);

  } catch (error: any) {
    console.error('❌ Errore get operator detail:', error);
    return c.json({
      error: 'Errore interno',
      message: error.message
    }, 500);
  }
});

// ============================================================================
// CREATE OPERATOR (INTERNO)
// ============================================================================

app.post('/:orgId', authMiddleware, validateBody(CreateOperatorSchema), async (c) => {
  try {
    const orgId = c.req.param('orgId');
    const user = c.get('user') as any;

    if (!orgId) {
      return c.json({ error: 'Organization ID required' }, 400);
    }

    if (!user || !user.organizationId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const validatedBody = c.get('validatedBody') as any;
    const {
      first_name,
      last_name,
      email,
      service_tags = [],
      max_hours_per_day,
      max_ha_per_day,
      home_location_id,
      default_service_area_set_id,
      user_id // Opzionale - collega a user esistente
    } = validatedBody;

    console.log('➕ Creazione operatore interno per org:', orgId);

    // Verifica che l'organizzazione esista
    const orgCheck = await query('SELECT id FROM organizations WHERE id = $1', [orgId]);
    if (orgCheck.rows.length === 0) {
      return c.json({ error: 'Organizzazione non trovata' }, 404);
    }

    // Se fornito user_id, verifica che esista e sia membro dell'organizzazione
    if (user_id) {
      const userCheck = await query(`
        SELECT u.id, u.first_name, u.last_name, u.email
        FROM users u
        JOIN org_memberships om ON u.id = om.user_id
        WHERE u.id = $1 AND om.org_id = $2 AND om.is_active = true
      `, [user_id, orgId]);

      if (userCheck.rows.length === 0) {
        return c.json({ error: 'Utente non trovato o non membro dell\'organizzazione' }, 400);
      }
    }

    const dbUrl = process.env.DATABASE_URL || '';
    const isPostgreSQL = dbUrl.startsWith('postgresql://') || dbUrl.startsWith('postgres://') || !!process.env.PGHOST;

    // PostgreSQL: service_tags è text[] nel DB, quindi costruiamo ARRAY[...]::text[]
    // Handle both array and string inputs
    let serviceTagsArray: string[];
    if (Array.isArray(service_tags)) {
      serviceTagsArray = service_tags;
    } else if (typeof service_tags === 'string') {
      try {
        const parsed = JSON.parse(service_tags);
        serviceTagsArray = Array.isArray(parsed) ? parsed : [parsed];
      } catch {
        serviceTagsArray = [service_tags];
      }
    } else {
      serviceTagsArray = [];
    }
    
    // Genera ID manualmente per compatibilità
    const operatorId = `opr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Inserisci il nuovo operatore
    // PostgreSQL: usa ARRAY[...]::text[] per service_tags
    const insertQuery = isPostgreSQL
      ? `
        INSERT INTO operator_profiles (
          id,
          org_id,
          user_id,
          home_location_id,
          max_hours_per_day,
          max_ha_per_day,
          service_tags,
          default_service_area_set_id,
          service_area_mode,
          status
        ) VALUES ($1, $2, $3, $4, $5, $6::text[], $7, $8, $9, $10)
        RETURNING id
      `
      : `
        INSERT INTO operator_profiles (
          id,
          org_id,
          user_id,
          home_location_id,
          max_hours_per_day,
          max_ha_per_day,
          service_tags,
          default_service_area_set_id,
          service_area_mode,
          status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING id
      `;
    
    const values = [
      operatorId,
      orgId,
      user_id || null,
      home_location_id || null,
      max_hours_per_day || null,
      max_ha_per_day || null,
      isPostgreSQL ? serviceTagsArray : JSON.stringify(serviceTagsArray),
      default_service_area_set_id || null,
      'ORG_DEFAULT', // Default: usa area organizzazione
      'ACTIVE'
    ];

    const result = await query(insertQuery, values);

    console.log('✅ Operatore creato con ID:', operatorId);

    // Se collegato a user, aggiorna anche i dati dell'utente
    if (user_id && first_name && last_name) {
      await query(
        'UPDATE users SET first_name = $1, last_name = $2 WHERE id = $3',
        [first_name, last_name, user_id]
      );
    }

    return c.json({
      success: true,
      operator_id: operatorId,
      message: 'Operatore creato con successo'
    });

  } catch (error: any) {
    console.error('❌ Errore create operator:', error);
    return c.json({
      error: 'Errore interno',
      message: error.message
    }, 500);
  }
});

// ============================================================================
// UPDATE OPERATOR
// ============================================================================

app.put('/:orgId/:operatorId', authMiddleware, validateBody(UpdateOperatorSchema), async (c) => {
  try {
    const orgId = c.req.param('orgId');
    const operatorId = c.req.param('operatorId');

    if (!orgId || !operatorId) {
      return c.json({ error: 'Organization ID and Operator ID required' }, 400);
    }

    const validatedBody = c.get('validatedBody');
    const {
      service_tags,
      max_hours_per_day,
      max_ha_per_day,
      home_location_id,
      default_service_area_set_id,
      service_area_mode,
      status
    } = validatedBody;

    console.log('✏️ Aggiornamento operatore:', operatorId, 'org:', orgId);

    // Verifica che l'operatore esista e appartenga all'organizzazione
    const checkQuery = 'SELECT id FROM operator_profiles WHERE id = $1 AND org_id = $2';
    const checkResult = await query(checkQuery, [operatorId, orgId]);

    if (checkResult.rows.length === 0) {
      return c.json({ error: 'Operatore non trovato' }, 404);
    }

    // Handle service_tags JSON serialization
    let serviceTagsJson: string;
    if (service_tags !== undefined) {
      if (Array.isArray(service_tags)) {
        serviceTagsJson = JSON.stringify(service_tags);
      } else if (typeof service_tags === 'string') {
        try {
          const parsed = JSON.parse(service_tags);
          serviceTagsJson = JSON.stringify(parsed);
        } catch {
          serviceTagsJson = JSON.stringify([service_tags]);
        }
      } else {
        serviceTagsJson = '[]';
      }
    } else {
      serviceTagsJson = '[]'; // Default empty array
    }

    // Aggiorna l'operatore
    const updateQuery = `
      UPDATE operator_profiles
      SET
        service_tags = $1,
        max_hours_per_day = $2,
        max_ha_per_day = $3,
        home_location_id = $4,
        default_service_area_set_id = $5,
        service_area_mode = $6,
        status = $7,
        updated_at = NOW()
      WHERE id = $8 AND org_id = $9
    `;
    
    await query(updateQuery, [
      serviceTagsJson,
      max_hours_per_day || null,
      max_ha_per_day || null,
      home_location_id || null,
      default_service_area_set_id || null,
      service_area_mode || 'ORG_DEFAULT',
      status || 'ACTIVE',
      operatorId,
      orgId
    ]);

    console.log('✅ Operatore aggiornato');

    return c.json({
      success: true,
      message: 'Operatore aggiornato con successo'
    });

  } catch (error: any) {
    console.error('❌ Errore update operator:', error);
    return c.json({
      error: 'Errore interno',
      message: error.message
    }, 500);
  }
});

// ============================================================================
// DELETE OPERATOR
// ============================================================================

app.delete('/:orgId/:operatorId', authMiddleware, validateParams(DeleteOperatorParamsSchema), async (c) => {
  try {
    const { orgId, operatorId } = c.get('validatedParams');

    if (!orgId || !operatorId) {
      return c.json({ error: 'Organization ID and Operator ID required' }, 400);
    }

    console.log('🗑️ Eliminazione operatore:', operatorId, 'org:', orgId);

    // Verifica che l'operatore esista e appartenga all'organizzazione
    const checkQuery = 'SELECT id FROM operator_profiles WHERE id = $1 AND org_id = $2';
    const checkResult = await query(checkQuery, [operatorId, orgId]);

    if (checkResult.rows.length === 0) {
      return c.json({ error: 'Operatore non trovato' }, 404);
    }

    // Elimina l'operatore (il CASCADE eliminerà anche i busy_blocks associati)
    await query('DELETE FROM operator_profiles WHERE id = $1 AND org_id = $2', [operatorId, orgId]);

    console.log('✅ Operatore eliminato');

    return c.json({
      success: true,
      message: 'Operatore eliminato con successo'
    });

  } catch (error: any) {
    console.error('❌ Errore delete operator:', error);
    return c.json({
      error: 'Errore interno',
      message: error.message
    }, 500);
  }
});

// ============================================================================
// GET ORGANIZATION PUBLIC INFO
// ============================================================================

// GET /api/operators/org/:orgId - Ottieni info pubbliche organizzazione
app.get('/org/:orgId', async (c) => {
  try {
    const orgId = c.req.param('orgId');
    
    if (!orgId) {
      return c.json({ error: 'Organization ID required' }, 400);
    }
    
    console.log(`📋 Richiesta info pubblica organizzazione:`, orgId);
    
    const result = await query(`
      SELECT 
        id,
        legal_name,
        phone,
        support_email,
        address_line,
        city,
        province,
        region,
        postal_code,
        country,
        type,
        is_certified
      FROM organizations
      WHERE id = $1 AND status = 'ACTIVE'
    `, [orgId]);
    
    if (result.rows.length === 0) {
      return c.json({ error: 'Organizzazione non trovata' }, 404);
    }
    
    return c.json(result.rows[0]);
    
  } catch (error: any) {
    console.error('❌ Errore get organization public info:', error);
    return c.json({
      error: 'Errore interno',
      message: error.message
    }, 500);
  }
});

// ============================================================================
// GET RESPONSE METRICS
// ============================================================================

// GET /api/operators/metrics/:entityType/:entityId - Ottieni metriche di risposta
app.get('/metrics/:entityType/:entityId', authMiddleware, async (c) => {
  try {
    const entityType = c.req.param('entityType'); // 'ORGANIZATION' o 'OPERATOR_PROFILE'
    const entityId = c.req.param('entityId');
    
    if (!entityType || !entityId) {
      return c.json({ error: 'Entity type and ID required' }, 400);
    }
    
    if (entityType !== 'ORGANIZATION' && entityType !== 'OPERATOR_PROFILE') {
      return c.json({ error: 'Invalid entity type. Must be ORGANIZATION or OPERATOR_PROFILE' }, 400);
    }
    
    console.log(`📊 Richiesta metriche risposta per ${entityType}:`, entityId);
    
    const result = await query(`
      SELECT 
        avg_response_minutes,
        sample_count,
        last_response_at,
        calculation_window_days,
        last_calculated_at
      FROM response_metrics
      WHERE entity_type = $1 AND entity_id = $2
    `, [entityType, entityId]);
    
    if (result.rows.length === 0) {
      return c.json({
        avg_response_minutes: null,
        sample_count: 0,
        last_response_at: null,
        calculation_window_days: 90,
        last_calculated_at: null,
        status: 'insufficient_data'
      });
    }
    
    const metric = result.rows[0];
    
    return c.json({
      avg_response_minutes: parseFloat(metric.avg_response_minutes) || null,
      sample_count: parseInt(metric.sample_count) || 0,
      last_response_at: metric.last_response_at,
      calculation_window_days: parseInt(metric.calculation_window_days) || 90,
      last_calculated_at: metric.last_calculated_at,
      status: metric.sample_count >= 5 ? 'reliable' : 'building'
    });
    
  } catch (error: any) {
    console.error('❌ Errore get response metrics:', error);
    return c.json({
      error: 'Errore interno',
      message: error.message
    }, 500);
  }
});

export default app;

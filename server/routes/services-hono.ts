import { Hono } from 'hono';
import { query } from '../utils/database';
import { expandRateCardsTable } from '../utils/database-migrations';
import { authMiddleware } from '../middleware/auth';

const app = new Hono();

// Middleware globale per tracciare tutte le richieste a questa sub-app
app.use('*', async (c, next) => {
  console.log('🔵 [SERVICES SUB-APP] Request received:', c.req.method, c.req.path);
  console.log('🔵 [SERVICES SUB-APP] Full URL:', c.req.url);
  await next();
});

// ============================================================================
// GET AVAILABLE GEO AREAS
// ============================================================================

app.get('/geo-areas', async (c) => {
  try {
    console.log('🗺️ Richiesta aree geografiche disponibili');

    // Recupera province
    const provincesResult = await query(`
      SELECT code, name
      FROM geo_admin_units
      WHERE level = 'PROVINCE'
      ORDER BY name
    `);

    // Recupera regioni (distinte)
    const regionsResult = await query(`
      SELECT DISTINCT region_code,
             CASE
               WHEN region_code = '04' THEN 'Trentino-Alto Adige'
               WHEN region_code = '05' THEN 'Veneto'
               ELSE 'Regione ' || region_code
             END as name
      FROM geo_admin_units
      WHERE region_code IS NOT NULL
      ORDER BY name
    `);

    // Recupera comuni di Trento (per esempio)
    const comuniResult = await query(`
      SELECT code, name, province_code
      FROM geo_admin_units
      WHERE level = 'MUNICIPALITY' AND province_code = '022'
      ORDER BY name
    `);

    const result = {
      provinces: provincesResult.rows,
      regions: regionsResult.rows,
      comuni: comuniResult.rows
    };

    console.log('✅ Aree geografiche recuperate');
    return c.json(result);

  } catch (error: any) {
    console.error('❌ Errore get geo areas:', error);
    return c.json({
      error: 'Errore interno',
      message: error.message
    }, 500);
  }
});

// ============================================================================
// GET CROP TYPES
// ============================================================================

app.get('/crop-types', async (c) => {
  try {
    console.log('🌾 Richiesta tipi di coltura');

    // Per ora restituiamo una lista statica, in futuro potrebbe venire dal database
    const cropTypes = [
      { id: 'wheat', name: 'Grano', category: 'cereali' },
      { id: 'corn', name: 'Mais', category: 'cereali' },
      { id: 'barley', name: 'Orzo', category: 'cereali' },
      { id: 'soy', name: 'Soia', category: 'oleaginose' },
      { id: 'sunflower', name: 'Girasole', category: 'oleaginose' },
      { id: 'vineyard', name: 'Vigneto', category: 'viticoltura' },
      { id: 'olive', name: 'Oliveto', category: 'orticoltura' },
      { id: 'fruit_trees', name: 'Frutteto', category: 'orticoltura' },
      { id: 'vegetables', name: 'Ortaggi', category: 'orticoltura' },
      { id: 'pasture', name: 'Prato/Pascolo', category: 'foraggere' }
    ];

    console.log('✅ Tipi di coltura recuperati');
    return c.json(cropTypes);

  } catch (error: any) {
    console.error('❌ Errore get crop types:', error);
    return c.json({
      error: 'Errore interno',
      message: error.message
    }, 500);
  }
});

// ============================================================================
// GET RATE CARDS LIST
// ============================================================================

// IMPORTANTE: Questo endpoint DEVE essere dopo /geo-areas e /crop-types
// perché Hono matcha le route in ordine e /:orgId matcha qualsiasi stringa
app.get('/:orgId', authMiddleware, async (c: any) => {
  try {
    console.log('💰💰💰 [GET RATE CARDS] ENDPOINT RAGGIUNTO - INIZIO 💰💰💰');
    console.log('💰 [GET RATE CARDS] ===========================================');
    console.log('💰 [GET RATE CARDS] Endpoint chiamato');
    console.log('💰 [GET RATE CARDS] Path:', c.req.path);
    console.log('💰 [GET RATE CARDS] Method:', c.req.method);
    console.log('💰 [GET RATE CARDS] Raw path:', c.req.raw.url);
    console.log('💰 [GET RATE CARDS] Headers:', Object.keys(c.req.raw.headers));
    
    const user = c.get('user') as { organizationId: string; orgId?: string } | undefined;
    const orgId = c.req.param('orgId');
    
    console.log('💰 [GET RATE CARDS] User object completo:', JSON.stringify(user, null, 2));
    console.log('💰 [GET RATE CARDS] User organizationId:', user?.organizationId);
    console.log('💰 [GET RATE CARDS] User orgId:', user?.orgId);
    console.log('💰 [GET RATE CARDS] Requested orgId:', orgId);
    console.log('💰 [GET RATE CARDS] Comparison:', {
      userOrgId: user?.organizationId,
      userOrgIdAlt: user?.orgId,
      requestedOrgId: orgId,
      match1: user?.organizationId === orgId,
      match2: user?.orgId === orgId,
      hasUser: !!user
    });
    
    // Verifica che l'utente appartenga all'organizzazione
    // Usa la stessa logica di jobs-hono.ts per consistenza
    if (!user || user.organizationId !== orgId) {
      console.log('❌❌❌ [GET RATE CARDS] UNAUTHORIZED - RESTITUISCO 403 ❌❌❌');
      console.log('❌ [GET RATE CARDS] Unauthorized:', { 
        userOrgId: user?.organizationId,
        requestedOrgId: orgId, 
        hasUser: !!user
      });
      return c.json({ error: 'Unauthorized' }, 403);
    }

    if (!orgId) {
      return c.json({ error: 'Organization ID required' }, 400);
    }

    // Ensure rate_cards table has latest columns
    try {
      await expandRateCardsTable();
    } catch (error: any) {
      console.warn('⚠️  Migration warning (non-critical):', error.message);
    }

    console.log('💰 Richiesta rate cards per org:', orgId);

    // Query con tutte le colonne disponibili
    const result = await query(`
      SELECT
        id,
        seller_org_id,
        service_type,
        base_rate_per_ha_cents,
        min_charge_cents,
        travel_fixed_cents,
        travel_rate_per_km_cents,
        hilly_terrain_multiplier,
        hilly_terrain_surcharge_cents,
        custom_multipliers_json,
        custom_surcharges_json,
        is_active,
        supported_model_codes,
        hourly_operator_rate_cents,
        seasonal_multipliers_json,
        risk_multipliers_json,
        show_company_only,
        assigned_operator_ids,
        operator_assignment_mode,
        service_area_set_id,
        crop_types
      FROM rate_cards
      WHERE seller_org_id = $1
      ORDER BY service_type
    `, [orgId]);

    const rateCards = result.rows.map((row: any) => ({
      id: row.id,
      seller_org_id: row.seller_org_id,
      service_type: row.service_type,
      base_rate_per_ha_cents: parseInt(row.base_rate_per_ha_cents),
      min_charge_cents: parseInt(row.min_charge_cents),
      travel_fixed_cents: row.travel_fixed_cents ? parseInt(row.travel_fixed_cents) : 0,
      travel_rate_per_km_cents: row.travel_rate_per_km_cents ? parseInt(row.travel_rate_per_km_cents) : null,
      hilly_terrain_multiplier: row.hilly_terrain_multiplier ? parseFloat(row.hilly_terrain_multiplier) : null,
      hilly_terrain_surcharge_cents: row.hilly_terrain_surcharge_cents ? parseInt(row.hilly_terrain_surcharge_cents) : 0,
      custom_multipliers_json: row.custom_multipliers_json,
      custom_surcharges_json: row.custom_surcharges_json,
      is_active: row.is_active !== undefined ? (typeof row.is_active === 'boolean' ? row.is_active : row.is_active === 1 || row.is_active === 'true') : true,
      supported_model_codes: row.supported_model_codes || null,
      hourly_operator_rate_cents: row.hourly_operator_rate_cents ? parseInt(row.hourly_operator_rate_cents) : null,
      seasonal_multipliers_json: row.seasonal_multipliers_json || null,
      risk_multipliers_json: row.risk_multipliers_json || null,
      show_company_only: row.show_company_only !== undefined ? (typeof row.show_company_only === 'boolean' ? row.show_company_only : row.show_company_only === 1 || row.show_company_only === 'true') : false,
      assigned_operator_ids: row.assigned_operator_ids || null,
      operator_assignment_mode: row.operator_assignment_mode || "ASSIGNED_ONLY",
      service_area_set_id: row.service_area_set_id || null,
      crop_types: row.crop_types || null,
    }));

    console.log('✅ [GET RATE CARDS] Recuperate', rateCards.length, 'rate cards');
    console.log('✅ [GET RATE CARDS] Rate cards:', JSON.stringify(rateCards, null, 2));
    console.log('💰 [GET RATE CARDS] ===========================================');

    return c.json(rateCards);

  } catch (error: any) {
    console.error('❌ Errore get rate cards:', error);
    return c.json({
      error: 'Errore interno',
      message: error.message
    }, 500);
  }
});

// ============================================================================
// GET SINGLE RATE CARD
// ============================================================================

app.get('/:orgId/:serviceType', async (c) => {
  try {
    const orgId = c.req.param('orgId');
    const serviceType = c.req.param('serviceType');

    if (!orgId || !serviceType) {
      return c.json({ error: 'Organization ID and Service Type required' }, 400);
    }

    // Ensure rate_cards table has latest columns
    try {
      await expandRateCardsTable();
    } catch (error: any) {
      console.warn('⚠️  Migration warning (non-critical):', error.message);
    }

    console.log('💰 Richiesta rate card:', serviceType, 'per org:', orgId);

    // Query con tutte le colonne disponibili
    const result = await query(`
      SELECT
        id,
        seller_org_id,
        service_type,
        base_rate_per_ha_cents,
        min_charge_cents,
        travel_fixed_cents,
        travel_rate_per_km_cents,
        hilly_terrain_multiplier,
        hilly_terrain_surcharge_cents,
        custom_multipliers_json,
        custom_surcharges_json,
        is_active,
        supported_model_codes,
        hourly_operator_rate_cents,
        seasonal_multipliers_json,
        risk_multipliers_json,
        show_company_only,
        assigned_operator_ids,
        operator_assignment_mode,
        service_area_set_id,
        crop_types
      FROM rate_cards
      WHERE seller_org_id = $1 AND service_type = $2
    `, [orgId, serviceType]);

    if (result.rows.length === 0) {
      return c.json({ error: 'Rate card not found' }, 404);
    }

    const row = result.rows[0];
    const rateCard = {
      id: row.id,
      seller_org_id: row.seller_org_id,
      service_type: row.service_type,
      base_rate_per_ha_cents: parseInt(row.base_rate_per_ha_cents),
      min_charge_cents: parseInt(row.min_charge_cents),
      travel_fixed_cents: row.travel_fixed_cents ? parseInt(row.travel_fixed_cents) : 0,
      travel_rate_per_km_cents: row.travel_rate_per_km_cents ? parseInt(row.travel_rate_per_km_cents) : null,
      hilly_terrain_multiplier: row.hilly_terrain_multiplier ? parseFloat(row.hilly_terrain_multiplier) : null,
      hilly_terrain_surcharge_cents: row.hilly_terrain_surcharge_cents ? parseInt(row.hilly_terrain_surcharge_cents) : 0,
      custom_multipliers_json: row.custom_multipliers_json,
      custom_surcharges_json: row.custom_surcharges_json,
      is_active: row.is_active !== undefined ? (typeof row.is_active === 'boolean' ? row.is_active : row.is_active === 1 || row.is_active === 'true') : true,
      supported_model_codes: row.supported_model_codes || null,
      hourly_operator_rate_cents: row.hourly_operator_rate_cents ? parseInt(row.hourly_operator_rate_cents) : null,
      seasonal_multipliers_json: row.seasonal_multipliers_json || null,
      risk_multipliers_json: row.risk_multipliers_json || null,
      show_company_only: row.show_company_only !== undefined ? (typeof row.show_company_only === 'boolean' ? row.show_company_only : row.show_company_only === 1 || row.show_company_only === 'true') : false,
      assigned_operator_ids: row.assigned_operator_ids || null,
      operator_assignment_mode: row.operator_assignment_mode || "ASSIGNED_ONLY",
      service_area_set_id: row.service_area_set_id || null,
      crop_types: row.crop_types || null,
    };

    return c.json(rateCard);

  } catch (error: any) {
    console.error('❌ Errore get rate card:', error);
    return c.json({
      error: 'Errore interno',
      message: error.message
    }, 500);
  }
});

// ============================================================================
// UPSERT RATE CARD
// ============================================================================

app.post('/:orgId', async (c) => {
  try {
    const orgId = c.req.param('orgId');
    const body = await c.req.json();

    if (!orgId) {
      return c.json({ error: 'Organization ID required' }, 400);
    }

    // Ensure rate_cards table has latest columns
    try {
      await expandRateCardsTable();
    } catch (error: any) {
      console.warn('⚠️  Migration warning (non-critical):', error.message);
    }

    const {
      service_type,
      base_rate_per_ha_cents,
      min_charge_cents,
      travel_fixed_cents,
      travel_rate_per_km_cents,
      hilly_terrain_multiplier,
      hilly_terrain_surcharge_cents,
      custom_multipliers_json,
      custom_surcharges_json,
      hourly_operator_rate_cents,
      seasonal_multipliers_json,
      risk_multipliers_json,
      show_company_only,
      assigned_operator_ids,
      supported_model_codes,
      operator_assignment_mode,
      service_area_set_id,
      crop_types,
      is_active,
      id // ID viene ignorato ma estratto per logging
    } = body;

    console.log('💰 Upsert rate card:', service_type, 'per org:', orgId);
    console.log('📦 Body received:', JSON.stringify(body, null, 2));
    console.log('📋 Extracted fields:', {
      service_type,
      base_rate_per_ha_cents,
      min_charge_cents,
      travel_fixed_cents,
      travel_rate_per_km_cents,
      hilly_terrain_multiplier,
      hilly_terrain_surcharge_cents,
      custom_multipliers_json,
      custom_surcharges_json,
      hourly_operator_rate_cents,
      supported_model_codes,
      id
    });

    // Verifica se esiste già
    const existing = await query(
      'SELECT id FROM rate_cards WHERE seller_org_id = $1 AND service_type = $2',
      [orgId, service_type]
    );

    if (existing.rows.length > 0) {
      // Update existing - build dynamic UPDATE query with only provided fields
      const updateFields = [];
      const updateValues = [];
      let paramIndex = 1;

      if (base_rate_per_ha_cents !== undefined) {
        updateFields.push(`base_rate_per_ha_cents = $${paramIndex++}`);
        updateValues.push(base_rate_per_ha_cents);
      }
      if (min_charge_cents !== undefined) {
        updateFields.push(`min_charge_cents = $${paramIndex++}`);
        updateValues.push(min_charge_cents);
      }
      if (travel_fixed_cents !== undefined) {
        updateFields.push(`travel_fixed_cents = $${paramIndex++}`);
        updateValues.push(travel_fixed_cents);
      }
      if (travel_rate_per_km_cents !== undefined) {
        updateFields.push(`travel_rate_per_km_cents = $${paramIndex++}`);
        updateValues.push(travel_rate_per_km_cents);
      }
      if (hilly_terrain_multiplier !== undefined) {
        updateFields.push(`hilly_terrain_multiplier = $${paramIndex++}`);
        updateValues.push(hilly_terrain_multiplier);
      }
      if (hilly_terrain_surcharge_cents !== undefined) {
        updateFields.push(`hilly_terrain_surcharge_cents = $${paramIndex++}`);
        updateValues.push(hilly_terrain_surcharge_cents);
      }
      if (custom_multipliers_json !== undefined) {
        updateFields.push(`custom_multipliers_json = $${paramIndex++}`);
        updateValues.push(custom_multipliers_json === null ? null : (typeof custom_multipliers_json === 'string' ? custom_multipliers_json : JSON.stringify(custom_multipliers_json)));
      }
      if (custom_surcharges_json !== undefined) {
        updateFields.push(`custom_surcharges_json = $${paramIndex++}`);
        updateValues.push(custom_surcharges_json === null ? null : (typeof custom_surcharges_json === 'string' ? custom_surcharges_json : JSON.stringify(custom_surcharges_json)));
      }
      if (hourly_operator_rate_cents !== undefined) {
        updateFields.push(`hourly_operator_rate_cents = $${paramIndex++}`);
        updateValues.push(hourly_operator_rate_cents);
      }
      if (seasonal_multipliers_json !== undefined) {
        updateFields.push(`seasonal_multipliers_json = $${paramIndex++}`);
        updateValues.push(seasonal_multipliers_json === null ? null : (typeof seasonal_multipliers_json === 'string' ? seasonal_multipliers_json : JSON.stringify(seasonal_multipliers_json)));
      }
      if (risk_multipliers_json !== undefined) {
        updateFields.push(`risk_multipliers_json = $${paramIndex++}`);
        updateValues.push(risk_multipliers_json === null ? null : (typeof risk_multipliers_json === 'string' ? risk_multipliers_json : JSON.stringify(risk_multipliers_json)));
      }
      if (show_company_only !== undefined) {
        updateFields.push(`show_company_only = $${paramIndex++}`);
        updateValues.push(show_company_only);
      }
      if (assigned_operator_ids !== undefined) {
        updateFields.push(`assigned_operator_ids = $${paramIndex++}`);
        updateValues.push(assigned_operator_ids === null ? null : (typeof assigned_operator_ids === 'string' ? assigned_operator_ids : JSON.stringify(assigned_operator_ids)));
      }
      if (operator_assignment_mode !== undefined) {
        updateFields.push(`operator_assignment_mode = $${paramIndex++}`);
        updateValues.push(operator_assignment_mode);
      }
      if (service_area_set_id !== undefined) {
        updateFields.push(`service_area_set_id = $${paramIndex++}`);
        updateValues.push(service_area_set_id);
      }
      if (crop_types !== undefined) {
        updateFields.push(`crop_types = $${paramIndex++}`);
        updateValues.push(crop_types === null ? null : (typeof crop_types === 'string' ? crop_types : JSON.stringify(crop_types)));
      }
      if (supported_model_codes !== undefined) {
        updateFields.push(`supported_model_codes = $${paramIndex++}`);
        updateValues.push(supported_model_codes === null ? null : (typeof supported_model_codes === 'string' ? supported_model_codes : JSON.stringify(supported_model_codes)));
      }
      if (is_active !== undefined) {
        updateFields.push(`is_active = $${paramIndex++}`);
        updateValues.push(is_active);
      }

      console.log('🔧 Update fields:', updateFields);
      console.log('🔧 Update values:', updateValues);

      if (updateFields.length === 0) {
        console.log('❌ No fields to update! Body keys:', Object.keys(body));
        return c.json({ error: 'No fields to update', bodyKeys: Object.keys(body) }, 400);
      }

      const dbUrl = process.env.DATABASE_URL || '';
      const isPostgreSQL = dbUrl.startsWith('postgresql://') || dbUrl.startsWith('postgres://');

      const updateQuery = `
        UPDATE rate_cards SET
          ${updateFields.join(', ')},
          updated_at = ${isPostgreSQL ? 'NOW()' : "datetime('now')"}
        WHERE seller_org_id = $${paramIndex++} AND service_type = $${paramIndex++}
      `;

      updateValues.push(orgId, service_type);

      console.log('🔧 POST UPDATE query:', updateQuery);
      console.log('🔧 POST UPDATE values:', updateValues);

      await query(updateQuery, updateValues);

      const result = await query(
        'SELECT * FROM rate_cards WHERE seller_org_id = $1 AND service_type = $2',
        [orgId, service_type]
      );

      const row = result.rows[0];
      const rateCard = {
        id: row.id,
        seller_org_id: row.seller_org_id,
        service_type: row.service_type,
        base_rate_per_ha_cents: parseInt(row.base_rate_per_ha_cents),
        min_charge_cents: parseInt(row.min_charge_cents),
        travel_fixed_cents: row.travel_fixed_cents ? parseInt(row.travel_fixed_cents) : 0,
        travel_rate_per_km_cents: row.travel_rate_per_km_cents ? parseInt(row.travel_rate_per_km_cents) : null,
        hilly_terrain_multiplier: row.hilly_terrain_multiplier ? parseFloat(row.hilly_terrain_multiplier) : null,
        hilly_terrain_surcharge_cents: row.hilly_terrain_surcharge_cents ? parseInt(row.hilly_terrain_surcharge_cents) : 0,
        custom_multipliers_json: row.custom_multipliers_json,
        custom_surcharges_json: row.custom_surcharges_json,
        is_active: row.is_active !== undefined ? (typeof row.is_active === 'boolean' ? row.is_active : row.is_active === 1 || row.is_active === 'true') : true,
        supported_model_codes: row.supported_model_codes || null,
        hourly_operator_rate_cents: row.hourly_operator_rate_cents ? parseInt(row.hourly_operator_rate_cents) : null,
        seasonal_multipliers_json: row.seasonal_multipliers_json || null,
        risk_multipliers_json: row.risk_multipliers_json || null,
        show_company_only: row.show_company_only !== undefined ? (typeof row.show_company_only === 'boolean' ? row.show_company_only : row.show_company_only === 1 || row.show_company_only === 'true') : false,
        assigned_operator_ids: row.assigned_operator_ids || null,
        operator_assignment_mode: row.operator_assignment_mode || "ASSIGNED_ONLY",
        service_area_set_id: row.service_area_set_id || null,
        crop_types: row.crop_types || null,
      };

      return c.json(rateCard);
    } else {
      // Insert - handle SQLite vs PostgreSQL RETURNING clause
      const dbUrl = process.env.DATABASE_URL || '';
      const isPostgreSQL = dbUrl.startsWith('postgresql://') || dbUrl.startsWith('postgres://');
      
      const insertQuery = isPostgreSQL
        ? `
        INSERT INTO rate_cards (
          seller_org_id, service_type, base_rate_per_ha_cents, min_charge_cents,
            travel_fixed_cents, travel_rate_per_km_cents,
            hilly_terrain_multiplier, hilly_terrain_surcharge_cents,
            custom_multipliers_json, custom_surcharges_json,
            hourly_operator_rate_cents,
          seasonal_multipliers_json, risk_multipliers_json, show_company_only,
            assigned_operator_ids, supported_model_codes, operator_assignment_mode,
            service_area_set_id, crop_types, is_active
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
        RETURNING *
        `
        : `
          INSERT INTO rate_cards (
            seller_org_id, service_type, base_rate_per_ha_cents, min_charge_cents,
            travel_fixed_cents, travel_rate_per_km_cents,
            hilly_terrain_multiplier, hilly_terrain_surcharge_cents,
            custom_multipliers_json, custom_surcharges_json,
            hourly_operator_rate_cents,
            seasonal_multipliers_json, risk_multipliers_json, show_company_only,
            assigned_operator_ids, supported_model_codes, operator_assignment_mode,
            service_area_set_id, crop_types, is_active
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
      
      const insertValues = [
        orgId,
        service_type,
        base_rate_per_ha_cents,
        min_charge_cents,
        travel_fixed_cents || 0,
        travel_rate_per_km_cents || null,
        hilly_terrain_multiplier || null,
        hilly_terrain_surcharge_cents || 0,
        typeof custom_multipliers_json === 'string' ? custom_multipliers_json : (custom_multipliers_json ? JSON.stringify(custom_multipliers_json) : null),
        typeof custom_surcharges_json === 'string' ? custom_surcharges_json : (custom_surcharges_json ? JSON.stringify(custom_surcharges_json) : null),
        hourly_operator_rate_cents || null,
        typeof seasonal_multipliers_json === 'string' ? seasonal_multipliers_json : (seasonal_multipliers_json ? JSON.stringify(seasonal_multipliers_json) : null),
        typeof risk_multipliers_json === 'string' ? risk_multipliers_json : (risk_multipliers_json ? JSON.stringify(risk_multipliers_json) : null),
        show_company_only || false,
        typeof assigned_operator_ids === 'string' ? assigned_operator_ids : (assigned_operator_ids ? JSON.stringify(assigned_operator_ids) : null),
        typeof supported_model_codes === 'string' ? supported_model_codes : (supported_model_codes ? JSON.stringify(supported_model_codes) : null),
        operator_assignment_mode || "ASSIGNED_ONLY",
        service_area_set_id || null,
        typeof crop_types === 'string' ? crop_types : (crop_types ? JSON.stringify(crop_types) : null),
        is_active ?? true
      ];
      
      const result = await query(insertQuery, insertValues);

      // For SQLite, we need to fetch the inserted row separately
      let insertedRow;
      if (isPostgreSQL) {
        insertedRow = result.rows[0];
      } else {
        const fetchResult = await query(
          'SELECT * FROM rate_cards WHERE seller_org_id = $1 AND service_type = $2 ORDER BY created_at DESC LIMIT 1',
          [orgId, service_type]
        );
        insertedRow = fetchResult.rows[0];
      }

      const row = insertedRow;
      const rateCard = {
        id: row.id,
        seller_org_id: row.seller_org_id,
        service_type: row.service_type,
        base_rate_per_ha_cents: parseInt(row.base_rate_per_ha_cents),
        min_charge_cents: parseInt(row.min_charge_cents),
        travel_fixed_cents: row.travel_fixed_cents ? parseInt(row.travel_fixed_cents) : 0,
        travel_rate_per_km_cents: row.travel_rate_per_km_cents ? parseInt(row.travel_rate_per_km_cents) : null,
        hilly_terrain_multiplier: row.hilly_terrain_multiplier ? parseFloat(row.hilly_terrain_multiplier) : null,
        hilly_terrain_surcharge_cents: row.hilly_terrain_surcharge_cents ? parseInt(row.hilly_terrain_surcharge_cents) : 0,
        custom_multipliers_json: row.custom_multipliers_json,
        custom_surcharges_json: row.custom_surcharges_json,
        hourly_operator_rate_cents: row.hourly_operator_rate_cents ? parseInt(row.hourly_operator_rate_cents) : null,
        seasonal_multipliers_json: row.seasonal_multipliers_json,
        risk_multipliers_json: row.risk_multipliers_json,
        show_company_only: row.show_company_only || false,
        assigned_operator_ids: row.assigned_operator_ids || [],
        supported_model_codes: row.supported_model_codes || [],
        operator_assignment_mode: row.operator_assignment_mode || "ASSIGNED_ONLY",
        service_area_set_id: row.service_area_set_id,
        crop_types: row.crop_types || [],
      };

      return c.json(rateCard);
    }

  } catch (error: any) {
    console.error('❌ Errore upsert rate card:', error);
    return c.json({
      error: 'Errore interno',
      message: error.message
    }, 500);
  }
});

// ============================================================================
// UPDATE RATE CARD
// ============================================================================

app.put('/:orgId/:serviceType', async (c) => {
  try {
    const orgId = c.req.param('orgId');
    const serviceType = c.req.param('serviceType');
    const body = await c.req.json();

    if (!orgId || !serviceType) {
      return c.json({ error: 'Organization ID and Service Type required' }, 400);
    }

    const {
      base_rate_per_ha_cents,
      min_charge_cents,
      travel_rate_per_km_cents,
      hourly_operator_rate_cents,
      seasonal_multipliers_json,
      risk_multipliers_json,
      show_company_only,
      assigned_operator_ids,
      supported_model_codes,
      operator_assignment_mode,
      service_area_set_id,
      crop_types
    } = body;

    console.log('💰 Update rate card:', serviceType, 'per org:', orgId);

    // Build dynamic UPDATE query with only provided fields
    const updateFields = [];
    const updateValues = [];
    let paramIndex = 1;

    if (base_rate_per_ha_cents !== undefined) {
      updateFields.push(`base_rate_per_ha_cents = $${paramIndex++}`);
      updateValues.push(base_rate_per_ha_cents);
    }
    if (min_charge_cents !== undefined) {
      updateFields.push(`min_charge_cents = $${paramIndex++}`);
      updateValues.push(min_charge_cents);
    }
    if (travel_rate_per_km_cents !== undefined) {
      updateFields.push(`travel_rate_per_km_cents = $${paramIndex++}`);
      updateValues.push(travel_rate_per_km_cents);
    }
    if (hourly_operator_rate_cents !== undefined) {
      updateFields.push(`hourly_operator_rate_cents = $${paramIndex++}`);
      updateValues.push(hourly_operator_rate_cents);
    }
    if (seasonal_multipliers_json !== undefined) {
      updateFields.push(`seasonal_multipliers_json = $${paramIndex++}`);
      updateValues.push(seasonal_multipliers_json);
    }
    if (risk_multipliers_json !== undefined) {
      updateFields.push(`risk_multipliers_json = $${paramIndex++}`);
      updateValues.push(risk_multipliers_json);
    }
    if (show_company_only !== undefined) {
      updateFields.push(`show_company_only = $${paramIndex++}`);
      updateValues.push(show_company_only);
    }
    if (assigned_operator_ids !== undefined) {
      updateFields.push(`assigned_operator_ids = $${paramIndex++}`);
      updateValues.push(assigned_operator_ids);
    }
    if (supported_model_codes !== undefined) {
      updateFields.push(`supported_model_codes = $${paramIndex++}`);
      updateValues.push(supported_model_codes);
    }
    if (operator_assignment_mode !== undefined) {
      updateFields.push(`operator_assignment_mode = $${paramIndex++}`);
      updateValues.push(operator_assignment_mode);
    }
    if (service_area_set_id !== undefined) {
      updateFields.push(`service_area_set_id = $${paramIndex++}`);
      updateValues.push(service_area_set_id);
    }
    if (crop_types !== undefined) {
      updateFields.push(`crop_types = $${paramIndex++}`);
      updateValues.push(crop_types);
    }

    if (updateFields.length === 0) {
      return c.json({ error: 'No fields to update' }, 400);
    }

    const updateQuery = `
      UPDATE rate_cards SET
        ${updateFields.join(', ')}
      WHERE seller_org_id = $${paramIndex++} AND service_type = $${paramIndex++}
    `;

    updateValues.push(orgId, serviceType);

    console.log('🔧 UPDATE query:', updateQuery);
    console.log('🔧 UPDATE values:', updateValues);

    await query(updateQuery, updateValues);

      const result = await query(
        'SELECT * FROM rate_cards WHERE seller_org_id = $1 AND service_type = $2',
        [orgId, serviceType]
      );

    const row = result.rows[0];
    const rateCard = {
      id: row.id,
      seller_org_id: row.seller_org_id,
      service_type: row.service_type,
      base_rate_per_ha_cents: parseInt(row.base_rate_per_ha_cents),
      min_charge_cents: parseInt(row.min_charge_cents),
      travel_rate_per_km_cents: parseInt(row.travel_rate_per_km_cents),
      hourly_operator_rate_cents: row.hourly_operator_rate_cents ? parseInt(row.hourly_operator_rate_cents) : null,
      seasonal_multipliers_json: row.seasonal_multipliers_json,
      risk_multipliers_json: row.risk_multipliers_json,
      show_company_only: row.show_company_only || false,
      assigned_operator_ids: row.assigned_operator_ids || [],
      supported_model_codes: row.supported_model_codes || [],
      operator_assignment_mode: row.operator_assignment_mode || "ASSIGNED_ONLY",
      service_area_set_id: row.service_area_set_id,
      crop_types: row.crop_types || [],
    };

    return c.json(rateCard);

  } catch (error: any) {
    console.error('❌ Errore update rate card:', error);
    return c.json({
      error: 'Errore interno',
      message: error.message
    }, 500);
  }
});

// ============================================================================
// UPDATE RATE CARD (PUT endpoint by ID)
// ============================================================================

app.put('/:orgId/:rateCardId', async (c) => {
  try {
    const orgId = c.req.param('orgId');
    const rateCardId = c.req.param('rateCardId');
    const body = await c.req.json();

    if (!orgId || !rateCardId) {
      return c.json({ error: 'Organization ID and Rate Card ID required' }, 400);
    }

    console.log('💰 PUT Update rate card by ID:', rateCardId, 'per org:', orgId, 'data:', body);

    const dbUrl = process.env.DATABASE_URL || '';
    const isPostgreSQL = dbUrl.startsWith('postgresql://') || dbUrl.startsWith('postgres://');

    // Extract all possible fields
    const {
      base_rate_per_ha_cents,
      min_charge_cents,
      travel_fixed_cents,
      travel_rate_per_km_cents,
      hilly_terrain_multiplier,
      hilly_terrain_surcharge_cents,
      custom_multipliers_json,
      custom_surcharges_json,
      hourly_operator_rate_cents,
      seasonal_multipliers_json,
      risk_multipliers_json,
      show_company_only,
      assigned_operator_ids,
      supported_model_codes,
      operator_assignment_mode,
      service_area_set_id,
      crop_types,
      is_active
    } = body;

    // Build dynamic UPDATE query with only provided fields
    const updateFields = [];
    const updateValues = [];
    let paramIndex = 1;

    if (base_rate_per_ha_cents !== undefined) {
      updateFields.push(`base_rate_per_ha_cents = $${paramIndex++}`);
      updateValues.push(base_rate_per_ha_cents);
    }
    if (min_charge_cents !== undefined) {
      updateFields.push(`min_charge_cents = $${paramIndex++}`);
      updateValues.push(min_charge_cents);
    }
    if (travel_fixed_cents !== undefined) {
      updateFields.push(`travel_fixed_cents = $${paramIndex++}`);
      updateValues.push(travel_fixed_cents);
    }
    if (travel_rate_per_km_cents !== undefined) {
      updateFields.push(`travel_rate_per_km_cents = $${paramIndex++}`);
      updateValues.push(travel_rate_per_km_cents);
    }
    if (hilly_terrain_multiplier !== undefined) {
      updateFields.push(`hilly_terrain_multiplier = $${paramIndex++}`);
      updateValues.push(hilly_terrain_multiplier);
    }
    if (hilly_terrain_surcharge_cents !== undefined) {
      updateFields.push(`hilly_terrain_surcharge_cents = $${paramIndex++}`);
      updateValues.push(hilly_terrain_surcharge_cents);
    }
    if (custom_multipliers_json !== undefined) {
      updateFields.push(`custom_multipliers_json = $${paramIndex++}`);
      updateValues.push(typeof custom_multipliers_json === 'string' ? custom_multipliers_json : JSON.stringify(custom_multipliers_json));
    }
    if (custom_surcharges_json !== undefined) {
      updateFields.push(`custom_surcharges_json = $${paramIndex++}`);
      updateValues.push(typeof custom_surcharges_json === 'string' ? custom_surcharges_json : JSON.stringify(custom_surcharges_json));
    }
    if (hourly_operator_rate_cents !== undefined) {
      updateFields.push(`hourly_operator_rate_cents = $${paramIndex++}`);
      updateValues.push(hourly_operator_rate_cents);
    }
    if (seasonal_multipliers_json !== undefined) {
      updateFields.push(`seasonal_multipliers_json = $${paramIndex++}`);
      updateValues.push(typeof seasonal_multipliers_json === 'string' ? seasonal_multipliers_json : JSON.stringify(seasonal_multipliers_json));
    }
    if (risk_multipliers_json !== undefined) {
      updateFields.push(`risk_multipliers_json = $${paramIndex++}`);
      updateValues.push(typeof risk_multipliers_json === 'string' ? risk_multipliers_json : JSON.stringify(risk_multipliers_json));
    }
    if (show_company_only !== undefined) {
      updateFields.push(`show_company_only = $${paramIndex++}`);
      updateValues.push(show_company_only);
    }
    if (assigned_operator_ids !== undefined) {
      updateFields.push(`assigned_operator_ids = $${paramIndex++}`);
      updateValues.push(typeof assigned_operator_ids === 'string' ? assigned_operator_ids : JSON.stringify(assigned_operator_ids));
    }
    if (supported_model_codes !== undefined) {
      updateFields.push(`supported_model_codes = $${paramIndex++}`);
      updateValues.push(typeof supported_model_codes === 'string' ? supported_model_codes : JSON.stringify(supported_model_codes));
    }
    if (operator_assignment_mode !== undefined) {
      updateFields.push(`operator_assignment_mode = $${paramIndex++}`);
      updateValues.push(operator_assignment_mode);
    }
    if (service_area_set_id !== undefined) {
      updateFields.push(`service_area_set_id = $${paramIndex++}`);
      updateValues.push(service_area_set_id);
    }
    if (crop_types !== undefined) {
      updateFields.push(`crop_types = $${paramIndex++}`);
      updateValues.push(typeof crop_types === 'string' ? crop_types : JSON.stringify(crop_types));
    }
    if (is_active !== undefined) {
      updateFields.push(`is_active = $${paramIndex++}`);
      updateValues.push(is_active);
    }

    if (updateFields.length === 0) {
      return c.json({ error: 'No fields to update' }, 400);
    }

    const updateQuery = `
      UPDATE rate_cards SET
        ${updateFields.join(', ')},
        updated_at = ${isPostgreSQL ? 'NOW()' : "NOW()"}
      WHERE id = $${paramIndex++} AND seller_org_id = $${paramIndex++}
    `;

    updateValues.push(rateCardId, orgId);

    await query(updateQuery, updateValues);

    // Check if update was successful
    const result = await query(
      'SELECT * FROM rate_cards WHERE id = $1 AND seller_org_id = $2',
      [rateCardId, orgId]
    );

    if (result.rows.length === 0) {
      return c.json({ error: 'Rate card not found after update' }, 404);
    }

    const row = result.rows[0];
    const rateCard = {
      id: row.id,
      seller_org_id: row.seller_org_id,
      service_type: row.service_type,
      base_rate_per_ha_cents: parseInt(row.base_rate_per_ha_cents),
      min_charge_cents: parseInt(row.min_charge_cents),
      travel_fixed_cents: row.travel_fixed_cents ? parseInt(row.travel_fixed_cents) : 0,
      travel_rate_per_km_cents: row.travel_rate_per_km_cents ? parseInt(row.travel_rate_per_km_cents) : null,
      hilly_terrain_multiplier: row.hilly_terrain_multiplier ? parseFloat(row.hilly_terrain_multiplier) : null,
      hilly_terrain_surcharge_cents: row.hilly_terrain_surcharge_cents ? parseInt(row.hilly_terrain_surcharge_cents) : 0,
      custom_multipliers_json: row.custom_multipliers_json,
      custom_surcharges_json: row.custom_surcharges_json,
      hourly_operator_rate_cents: row.hourly_operator_rate_cents ? parseInt(row.hourly_operator_rate_cents) : null,
      seasonal_multipliers_json: row.seasonal_multipliers_json,
      risk_multipliers_json: row.risk_multipliers_json,
      show_company_only: row.show_company_only || false,
      assigned_operator_ids: row.assigned_operator_ids || null,
      supported_model_codes: row.supported_model_codes || null,
      operator_assignment_mode: row.operator_assignment_mode || 'ASSIGNED_ONLY',
      service_area_set_id: row.service_area_set_id || null,
      crop_types: row.crop_types || null,
      is_active: row.is_active !== undefined ? (typeof row.is_active === 'boolean' ? row.is_active : row.is_active === 1 || row.is_active === 'true' || row.is_active === '1') : true,
    };

    console.log('✅ PUT Update successful:', rateCard);

    return c.json(rateCard);

  } catch (error: any) {
    console.error('❌ PUT Update rate card error:', error);
    return c.json({
      error: 'Errore interno nell\'aggiornamento',
      message: error.message
    }, 500);
  }
});

// ============================================================================
// UPDATE RATE CARD (PUT endpoint by serviceType - kept for backward compatibility)
// ============================================================================

app.put('/:orgId/:serviceType', async (c) => {
  try {
    const orgId = c.req.param('orgId');
    const serviceType = c.req.param('serviceType');
    const body = await c.req.json();

    if (!orgId || !serviceType) {
      return c.json({ error: 'Organization ID and Service Type required' }, 400);
    }

    console.log('💰 PUT Update rate card by serviceType:', serviceType, 'per org:', orgId, 'data:', body);

    const dbUrl = process.env.DATABASE_URL || '';
    const isPostgreSQL = dbUrl.startsWith('postgresql://') || dbUrl.startsWith('postgres://');

    const {
      base_rate_per_ha_cents,
      min_charge_cents,
      travel_rate_per_km_cents,
      hourly_operator_rate_cents,
      seasonal_multipliers_json,
      risk_multipliers_json,
      show_company_only,
      is_active
    } = body;

    // Build dynamic UPDATE query with only provided fields
    const updateFields = [];
    const updateValues = [];
    let paramIndex = 1;

    if (base_rate_per_ha_cents !== undefined) {
      updateFields.push(`base_rate_per_ha_cents = $${paramIndex++}`);
      updateValues.push(base_rate_per_ha_cents);
    }
    if (min_charge_cents !== undefined) {
      updateFields.push(`min_charge_cents = $${paramIndex++}`);
      updateValues.push(min_charge_cents);
    }
    if (travel_rate_per_km_cents !== undefined) {
      updateFields.push(`travel_rate_per_km_cents = $${paramIndex++}`);
      updateValues.push(travel_rate_per_km_cents);
    }
    if (hourly_operator_rate_cents !== undefined) {
      updateFields.push(`hourly_operator_rate_cents = $${paramIndex++}`);
      updateValues.push(hourly_operator_rate_cents);
    }
    if (seasonal_multipliers_json !== undefined) {
      updateFields.push(`seasonal_multipliers_json = $${paramIndex++}`);
      updateValues.push(typeof seasonal_multipliers_json === 'string' ? seasonal_multipliers_json : JSON.stringify(seasonal_multipliers_json));
    }
    if (risk_multipliers_json !== undefined) {
      updateFields.push(`risk_multipliers_json = $${paramIndex++}`);
      updateValues.push(typeof risk_multipliers_json === 'string' ? risk_multipliers_json : JSON.stringify(risk_multipliers_json));
    }
    if (show_company_only !== undefined) {
      updateFields.push(`show_company_only = $${paramIndex++}`);
      updateValues.push(show_company_only);
    }
    if (is_active !== undefined) {
      updateFields.push(`is_active = $${paramIndex++}`);
      updateValues.push(is_active);
    }

    if (updateFields.length === 0) {
      return c.json({ error: 'No fields to update' }, 400);
    }

    const updateQuery = `
      UPDATE rate_cards SET
        ${updateFields.join(', ')},
        updated_at = ${isPostgreSQL ? 'NOW()' : "NOW()"}
      WHERE seller_org_id = $${paramIndex++} AND service_type = $${paramIndex++}
    `;

    updateValues.push(orgId, serviceType);

    await query(updateQuery, updateValues);

    // Check if update was successful
    const result = await query(
      'SELECT * FROM rate_cards WHERE seller_org_id = $1 AND service_type = $2',
      [orgId, serviceType]
    );

    if (result.rows.length === 0) {
      return c.json({ error: 'Rate card not found after update' }, 404);
    }

    const row = result.rows[0];
    const rateCard = {
      id: row.id,
      seller_org_id: row.seller_org_id,
      service_type: row.service_type,
      base_rate_per_ha_cents: parseInt(row.base_rate_per_ha_cents),
      min_charge_cents: parseInt(row.min_charge_cents),
      travel_rate_per_km_cents: parseInt(row.travel_rate_per_km_cents),
      hourly_operator_rate_cents: row.hourly_operator_rate_cents ? parseInt(row.hourly_operator_rate_cents) : null,
      seasonal_multipliers_json: row.seasonal_multipliers_json,
      risk_multipliers_json: row.risk_multipliers_json,
      show_company_only: row.show_company_only || false,
      is_active: row.is_active !== undefined ? (typeof row.is_active === 'boolean' ? row.is_active : row.is_active === 1 || row.is_active === 'true' || row.is_active === '1') : true,
    };

    console.log('✅ PUT Update successful:', rateCard);

    return c.json(rateCard);

  } catch (error: any) {
    console.error('❌ PUT Update rate card error:', error);
    return c.json({
      error: 'Errore interno nell\'aggiornamento',
      message: error.message
    }, 500);
  }
});

// ============================================================================
// DELETE RATE CARD
// ============================================================================

app.delete('/:orgId/:serviceType', async (c) => {
  try {
    const orgId = c.req.param('orgId');
    const serviceType = c.req.param('serviceType');

    if (!orgId || !serviceType) {
      return c.json({ error: 'Organization ID and Service Type required' }, 400);
    }

    console.log('🗑️ Eliminazione rate card:', serviceType, 'per org:', orgId);

    await query(
      'DELETE FROM rate_cards WHERE seller_org_id = $1 AND service_type = $2',
      [orgId, serviceType]
    );

    return c.json({ success: true });

  } catch (error: any) {
    console.error('❌ Errore delete rate card:', error);
    return c.json({
      error: 'Errore interno',
      message: error.message
    }, 500);
  }
});


export default app;

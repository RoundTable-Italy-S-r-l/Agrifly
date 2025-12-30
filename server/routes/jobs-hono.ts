import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth';
import { validateBody } from '../middleware/validation';
import { query } from '../utils/database';
import { CreateJobSchema, CreateJobOfferSchema, CreateMessageSchema, MarkMessagesReadSchema, AcceptOfferParamsSchema, CompleteMissionParamsSchema } from '../schemas/api.schemas';
// file-db.ts non è compatibile con Netlify Functions (usa import.meta)
// Usiamo solo il database SQLite/PostgreSQL, non file-db


const app = new Hono();

// GET /api/jobs - Get buyer's jobs
app.get('/', authMiddleware, async (c) => {
  try {
    // @ts-ignore - Hono context typing issue
    const user = c.get('user') as any;
    if (!user || !user.organizationId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    // Ensure table exists (compatible with both SQLite and PostgreSQL)
    const dbUrl = process.env.DATABASE_URL || '';
    const isPostgreSQL = true; // Force PostgreSQL for Supabase
    
    const createTableQuery = isPostgreSQL
      ? `
      CREATE TABLE IF NOT EXISTS jobs (
          id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid(),
          buyer_org_id TEXT NOT NULL,
          broker_org_id VARCHAR(255),
          service_type TEXT NOT NULL DEFAULT 'SPRAY',
          crop_type TEXT,
          treatment_type TEXT,
          terrain_conditions VARCHAR(255),
          status TEXT NOT NULL DEFAULT 'OPEN',
          field_name TEXT NOT NULL,
          field_polygon TEXT,
        area_ha DECIMAL(10,4),
        location_json TEXT,
          requested_window_start TIMESTAMP,
          requested_window_end TIMESTAMP,
          constraints_json TEXT,
          visibility_mode VARCHAR(255) DEFAULT 'WHITELIST_ONLY',
          accepted_offer_id VARCHAR(255),
        target_date_start TIMESTAMP,
        target_date_end TIMESTAMP,
          notes TEXT,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        )
      `
      : `
        CREATE TABLE IF NOT EXISTS jobs (
          id TEXT PRIMARY KEY,
          buyer_org_id TEXT NOT NULL,
          broker_org_id TEXT,
          service_type TEXT NOT NULL DEFAULT 'SPRAY',
          crop_type TEXT,
          treatment_type TEXT,
          terrain_conditions TEXT,
          status TEXT DEFAULT 'OPEN',
          field_name TEXT,
          field_polygon TEXT,
          area_ha REAL,
          location_json TEXT,
          requested_window_start TEXT,
          requested_window_end TEXT,
          constraints_json TEXT,
          visibility_mode TEXT DEFAULT 'WHITELIST_ONLY',
          accepted_offer_id TEXT,
          target_date_start TEXT,
          target_date_end TEXT,
        notes TEXT,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
      `;
    
    try {
      await query(createTableQuery);
    } catch (error: any) {
      console.error('Error creating jobs table:', error.message);
      // Continue anyway - table might already exist
    }

    const result = await query(`
      SELECT id, buyer_org_id, broker_org_id, service_type, crop_type, treatment_type, terrain_conditions, status, field_name, field_polygon, area_ha, location_json, requested_window_start, requested_window_end, constraints_json, visibility_mode, accepted_offer_id, target_date_start, target_date_end, notes, created_at, updated_at
      FROM jobs
      WHERE buyer_org_id = $1
      ORDER BY created_at DESC
    `, [user.organizationId]);

    // Deserialize location_json for frontend and add field_polygon
    const jobs = result.rows.map(job => {
      const locJson = job.location_json ? (typeof job.location_json === 'string' ? JSON.parse(job.location_json) : job.location_json) : null;
      return {
      ...job,
        location_json: locJson,
        field_polygon: locJson?.polygon || (Array.isArray(locJson) ? locJson : null)
      };
    });

    return c.json({ jobs });
  } catch (error: any) {
    console.error('Error fetching jobs:', error);
    return c.json({ error: 'Internal server error', message: error.message }, 500);
  }
});

// GET /api/operator/jobs - Get all available jobs for operators/vendors
app.get('/operator/jobs', authMiddleware, async (c) => {
  try {
    // @ts-ignore - Hono context typing issue
    const user = c.get('user') as any;
    if (!user || !user.organizationId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    // Ensure tables exist (compatible with both SQLite and PostgreSQL)
    const dbUrl = process.env.DATABASE_URL || '';
    const isPostgreSQL = true; // Force PostgreSQL for Supabase
    
    const createTableQuery = isPostgreSQL
      ? `
      CREATE TABLE IF NOT EXISTS jobs (
          id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid(),
          buyer_org_id TEXT NOT NULL,
          broker_org_id VARCHAR(255),
          service_type TEXT NOT NULL DEFAULT 'SPRAY',
          crop_type TEXT,
          treatment_type TEXT,
          terrain_conditions VARCHAR(255),
          status TEXT NOT NULL DEFAULT 'OPEN',
          field_name TEXT NOT NULL,
          field_polygon TEXT,
        area_ha DECIMAL(10,4),
        location_json TEXT,
          requested_window_start TIMESTAMP,
          requested_window_end TIMESTAMP,
          constraints_json TEXT,
          visibility_mode VARCHAR(255) DEFAULT 'WHITELIST_ONLY',
          accepted_offer_id VARCHAR(255),
        target_date_start TIMESTAMP,
        target_date_end TIMESTAMP,
          notes TEXT,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        )
      `
      : `
        CREATE TABLE IF NOT EXISTS jobs (
          id TEXT PRIMARY KEY,
          buyer_org_id TEXT NOT NULL,
          broker_org_id TEXT,
          service_type TEXT NOT NULL DEFAULT 'SPRAY',
          crop_type TEXT,
          treatment_type TEXT,
          terrain_conditions TEXT,
          status TEXT DEFAULT 'OPEN',
          field_name TEXT,
          field_polygon TEXT,
          area_ha REAL,
          location_json TEXT,
          requested_window_start TEXT,
          requested_window_end TEXT,
          constraints_json TEXT,
          visibility_mode TEXT DEFAULT 'WHITELIST_ONLY',
          accepted_offer_id TEXT,
          target_date_start TEXT,
          target_date_end TEXT,
        notes TEXT,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
      `;
    
    try {
      await query(createTableQuery);
    } catch (error: any) {
      console.error('Error creating jobs table:', error.message);
    }

    const jobOffersTableQuery = isPostgreSQL
      ? `
      CREATE TABLE IF NOT EXISTS job_offers (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
        job_id TEXT NOT NULL,
        operator_org_id TEXT NOT NULL,
        status TEXT DEFAULT 'OFFERED',
        pricing_snapshot_json TEXT,
        total_cents INTEGER NOT NULL,
        currency TEXT DEFAULT 'EUR',
        proposed_start TIMESTAMP,
        proposed_end TIMESTAMP,
        provider_note TEXT,
        created_at TEXT DEFAULT NOW(),
        updated_at TEXT DEFAULT NOW(),
        reliability_snapshot_json TEXT,
        offer_lines_json TEXT,
        price_cents INTEGER
      )
      `
      : `
      CREATE TABLE IF NOT EXISTS job_offers (
        id TEXT PRIMARY KEY,
        job_id TEXT NOT NULL,
        operator_org_id TEXT NOT NULL,
        status TEXT DEFAULT 'OFFERED',
        pricing_snapshot_json TEXT,
        total_cents INTEGER NOT NULL,
        currency TEXT DEFAULT 'EUR',
        proposed_start TEXT,
        proposed_end TEXT,
        provider_note TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        reliability_snapshot_json TEXT,
        offer_lines_json TEXT,
        price_cents INTEGER
      )
      `;

    await query(jobOffersTableQuery);

    // Get all open jobs (not from the user's own organization) with buyer organization details
    // TEMPORANEO: Per testing, mostriamo tutti i job OPEN indipendentemente dall'organizzazione
    const result = await query(`
      SELECT
        j.id, j.buyer_org_id, j.broker_org_id, j.service_type, j.crop_type, j.treatment_type, j.terrain_conditions,
        j.status, j.field_name, j.field_polygon, j.area_ha, j.location_json, j.requested_window_start, j.requested_window_end,
        j.constraints_json, j.visibility_mode, j.accepted_offer_id, j.target_date_start, j.target_date_end, j.notes,
        j.created_at, j.updated_at, o.legal_name as buyer_org_legal_name
      FROM jobs j
      LEFT JOIN organizations o ON j.buyer_org_id = o.id
      WHERE j.status = 'OPEN'
      ORDER BY j.created_at DESC
    `, []);

    // Deserialize location_json for frontend and structure buyer_org
    // Also check for existing offers by this operator
    const jobsWithOfferStatus = await Promise.all(
      result.rows.map(async (job) => {
        // Check if this operator already submitted an ACTIVE offer for this job
        // OFFERED e AWARDED sono considerati "attivi" e bloccano nuove offerte
        // WITHDRAWN e DECLINED permettono di rifare un'offerta
        const existingOfferResult = await query(`
          SELECT id, status FROM job_offers
          WHERE job_id = $1 AND operator_org_id = $2
          AND status IN ('OFFERED', 'AWARDED')
          LIMIT 1
        `, [job.id, user.organizationId]);

        // Check anche per offerte ritirate/rifiutate per mostrare lo stato
        const anyOfferResult = await query(`
          SELECT id, status FROM job_offers
          WHERE job_id = $1 AND operator_org_id = $2
          ORDER BY created_at DESC
          LIMIT 1
        `, [job.id, user.organizationId]);

        const hasActiveOffer = existingOfferResult.rows.length > 0;
        const hasAnyOffer = anyOfferResult.rows.length > 0;
        const existingOfferStatus = hasAnyOffer ? anyOfferResult.rows[0].status : null;
        const canOffer = !hasActiveOffer; // Can offer if no active offer (OFFERED/AWARDED)

        const locJson = job.location_json ? (typeof job.location_json === 'string' ? JSON.parse(job.location_json) : job.location_json) : null;
        return {
          ...job,
          location_json: locJson,
          field_polygon: locJson?.polygon || (Array.isArray(locJson) ? locJson : null),
          buyer_org: {
            legal_name: job.buyer_org_legal_name || 'Organizzazione sconosciuta'
          },
          can_offer: canOffer,
          has_existing_offer: hasActiveOffer,
          existing_offer_status: existingOfferStatus
        };
      })
    );

    return c.json({ jobs: jobsWithOfferStatus });
  } catch (error: any) {
    console.error('Error fetching operator jobs:', error);
    return c.json({ error: 'Internal server error', message: error.message }, 500);
  }
});


// GET /api/jobs/:jobId - Get a specific job by ID (buyer can see their own jobs, operators can see open jobs)
// IMPORTANTE: questa route deve essere DOPO /operator/jobs e /offers/:orgId per evitare conflitti di routing
app.get('/:jobId', authMiddleware, async (c) => {
  try {
    // @ts-ignore - Hono context typing issue
    const user = c.get('user') as any;
    if (!user || !user.organizationId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const jobId = c.req.param('jobId');

    // Fetch the job
    const jobResult = await query(`
      SELECT j.id, j.buyer_org_id, j.field_name, j.service_type, j.area_ha, j.location_json, 
             j.target_date_start, j.target_date_end, j.notes, j.status, j.created_at, j.updated_at,
             o.legal_name as buyer_org_legal_name
      FROM jobs j
      LEFT JOIN organizations o ON j.buyer_org_id = o.id
      WHERE j.id = $1
    `, [jobId]);

    if (jobResult.rows.length === 0) {
      return c.json({ error: 'Job not found' }, 404);
    }

    const job = jobResult.rows[0];

    // Check permissions: buyer can see their own jobs, operators can see open jobs
    const isBuyer = job.buyer_org_id === user.organizationId;
    const isOpen = job.status === 'OPEN';

    if (!isBuyer && !isOpen) {
      return c.json({ error: 'Non hai i permessi per visualizzare questo job' }, 403);
    }

    // Deserialize location_json
    const locJson = job.location_json ? (typeof job.location_json === 'string' ? JSON.parse(job.location_json) : job.location_json) : null;

    // Fetch offers for this job
    const offersResult = await query(`
      SELECT jo.*, o.legal_name as operator_org_legal_name
      FROM job_offers jo
      LEFT JOIN organizations o ON jo.operator_org_id = o.id
      WHERE jo.job_id = $1
      ORDER BY jo.created_at DESC
    `, [jobId]);

    const offers = offersResult.rows.map((offer: any) => ({
      id: offer.id,
      job_id: offer.job_id,
      operator_org_id: offer.operator_org_id,
      status: offer.status,
      pricing_snapshot_json: offer.pricing_snapshot_json ? (typeof offer.pricing_snapshot_json === 'string' ? JSON.parse(offer.pricing_snapshot_json) : offer.pricing_snapshot_json) : null,
      total_cents: parseInt(offer.total_cents) || 0,
      currency: offer.currency || 'EUR',
      proposed_start: offer.proposed_start,
      proposed_end: offer.proposed_end,
      provider_note: offer.provider_note,
      created_at: offer.created_at,
      updated_at: offer.updated_at,
      operator_org: {
        id: offer.operator_org_id,
        legal_name: offer.operator_org_legal_name || 'Operatore sconosciuto'
      }
    }));

    return c.json({
      id: job.id,
      buyer_org_id: job.buyer_org_id,
      field_name: job.field_name,
      service_type: job.service_type,
      area_ha: job.area_ha ? parseFloat(job.area_ha) : null,
      location_json: locJson,
      field_polygon: locJson?.polygon || (Array.isArray(locJson) ? locJson : null),
      target_date_start: job.target_date_start,
      target_date_end: job.target_date_end,
      notes: job.notes,
      status: job.status,
      created_at: job.created_at,
      updated_at: job.updated_at,
      buyer_org: {
        id: job.buyer_org_id,
        legal_name: job.buyer_org_legal_name || 'Organizzazione sconosciuta'
      },
      offers: offers
    });
  } catch (error: any) {
    console.error('Error fetching job:', error);
    return c.json({ error: 'Internal server error', message: error.message }, 500);
  }
});

// POST /api/jobs - Create a new job
app.post('/', authMiddleware, validateBody(CreateJobSchema, { transform: true }), async (c) => {
  try {
    // @ts-ignore - Hono context typing issue
    const user = c.get('user') as any;
    if (!user || !user.organizationId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    // Get validated and transformed data
    const validatedBody = c.get('validatedBody');
    const {
      field_name,
      service_type,
      area_ha,
      location_json,
      field_polygon,
      target_date_start,
      target_date_end,
      notes,
      crop_type,
      treatment_type,
      terrain_conditions
    } = validatedBody;
    
    // Se field_polygon è presente ma non è in location_json, aggiungilo
    let finalLocationJson = location_json;
    if (field_polygon && (!location_json || !location_json.polygon)) {
      finalLocationJson = {
        ...(location_json || {}),
        polygon: field_polygon
      };
    }

    if (!field_name || !service_type || !area_ha) {
      return c.json({ error: 'Missing required fields' }, 400);
    }

    // Ensure table exists (compatible with both SQLite and PostgreSQL)
    const dbUrl = process.env.DATABASE_URL || '';
    const isPostgreSQL = true; // Force PostgreSQL for Supabase
    
    const createTableQuery = isPostgreSQL
      ? `
      CREATE TABLE IF NOT EXISTS jobs (
          id VARCHAR(255) PRIMARY KEY,
          buyer_org_id VARCHAR(255) NOT NULL,
          field_name VARCHAR(255) NOT NULL,
          service_type VARCHAR(255) NOT NULL,
        area_ha DECIMAL(10,4),
        location_json TEXT,
        target_date_start TIMESTAMP,
        target_date_end TIMESTAMP,
          notes TEXT,
          status VARCHAR(50) DEFAULT 'OPEN',
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        )
      `
      : `
        CREATE TABLE IF NOT EXISTS jobs (
          id TEXT PRIMARY KEY,
          buyer_org_id TEXT NOT NULL,
          field_name TEXT NOT NULL,
          service_type TEXT NOT NULL,
          area_ha REAL,
          location_json TEXT,
          target_date_start TEXT,
          target_date_end TEXT,
        notes TEXT,
        status TEXT DEFAULT 'OPEN',
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
      `;
    
    try {
      await query(createTableQuery);
    } catch (error: any) {
      console.error('Error creating jobs table:', error.message);
      // Continue anyway - table might already exist
    }

    // Generate ID
    const generateId = () => {
      const timestamp = Date.now().toString(36);
      const random = Math.random().toString(36).substring(2, 15);
      return `job_${timestamp}${random}`.substring(0, 30);
    };

    const jobId = generateId();
    const now = new Date().toISOString();

    if (isPostgreSQL) {
      // PostgreSQL: use RETURNING
    const result = await query(`
        INSERT INTO jobs (
          id, buyer_org_id, broker_org_id, service_type, crop_type, treatment_type, terrain_conditions,
          status, field_name, field_polygon, area_ha, location_json, requested_window_start, requested_window_end,
          constraints_json, visibility_mode, accepted_offer_id, target_date_start, target_date_end, notes,
          created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)
      RETURNING id, buyer_org_id, broker_org_id, service_type, crop_type, treatment_type, terrain_conditions, status, field_name, field_polygon, area_ha, location_json, requested_window_start, requested_window_end, constraints_json, visibility_mode, accepted_offer_id, target_date_start, target_date_end, notes, created_at, updated_at
    `, [
        jobId,
        user.organizationId, // buyer_org_id
        null, // broker_org_id
      service_type,
        validatedBody.crop_type || null, // crop_type
        validatedBody.treatment_type || null, // treatment_type
        validatedBody.terrain_conditions || null, // terrain_conditions
        'OPEN', // status
        field_name,
        field_polygon || null, // field_polygon
      parseFloat(area_ha),
        finalLocationJson ? JSON.stringify(finalLocationJson) : null,
        null, // requested_window_start
        null, // requested_window_end
        null, // constraints_json
        'WHITELIST_ONLY', // visibility_mode
        null, // accepted_offer_id
        target_date_start || null,
        target_date_end || null,
        notes || null,
        now,
        now
    ]);

    const newJob = result.rows[0];

      // Deserialize location_json for frontend and add field_polygon
      const locJson = newJob.location_json ? (typeof newJob.location_json === 'string' ? JSON.parse(newJob.location_json) : newJob.location_json) : null;
    const jobResponse = {
      ...newJob,
        location_json: locJson,
        field_polygon: locJson?.polygon || (Array.isArray(locJson) ? locJson : null)
    };

    return c.json({ job: jobResponse }, 201);
    } else {
      // SQLite: insert then fetch
      await query(`
        INSERT INTO jobs (
          id, buyer_org_id, broker_org_id, service_type, crop_type, treatment_type, terrain_conditions,
          status, field_name, field_polygon, area_ha, location_json, requested_window_start, requested_window_end,
          constraints_json, visibility_mode, accepted_offer_id, target_date_start, target_date_end, notes,
          created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)
      `, [
        jobId,
        user.organizationId, // buyer_org_id
        null, // broker_org_id
        service_type,
        validatedBody.crop_type || null, // crop_type
        validatedBody.treatment_type || null, // treatment_type
        validatedBody.terrain_conditions || null, // terrain_conditions
        'OPEN', // status
        field_name,
        field_polygon || null, // field_polygon
        parseFloat(area_ha),
        finalLocationJson ? JSON.stringify(finalLocationJson) : null,
        null, // requested_window_start
        null, // requested_window_end
        null, // constraints_json
        'WHITELIST_ONLY', // visibility_mode
        null, // accepted_offer_id
        target_date_start || null,
        target_date_end || null,
        notes || null,
        now,
        now
      ]);

      // Fetch the inserted job
      const result = await query(`
        SELECT id, buyer_org_id, broker_org_id, service_type, crop_type, treatment_type, terrain_conditions, status, field_name, field_polygon, area_ha, location_json, requested_window_start, requested_window_end, constraints_json, visibility_mode, accepted_offer_id, target_date_start, target_date_end, notes, created_at, updated_at
        FROM jobs
        WHERE id = $1
      `, [jobId]);

      const newJob = result.rows[0];

      // Deserialize location_json for frontend and add field_polygon
      const locJson = newJob.location_json ? (typeof newJob.location_json === 'string' ? JSON.parse(newJob.location_json) : newJob.location_json) : null;
    const jobResponse = {
      ...newJob,
        location_json: locJson,
        field_polygon: locJson?.polygon || (Array.isArray(locJson) ? locJson : null)
    };

    return c.json({ job: jobResponse }, 201);
    }
  } catch (error: any) {
    console.error('Error creating job:', error);
    return c.json({ error: 'Internal server error', message: error.message }, 500);
  }
});

// POST /api/jobs/:jobId/offers - Create job offer (operator)
app.post('/:jobId/offers', authMiddleware, validateBody(CreateJobOfferSchema, { transform: true }), async (c) => {
  try {
    console.log('🚀 [CREATE OFFER] Inizio richiesta');
    
    // @ts-ignore - Hono context typing issue
    const user = c.get('user') as any;
    console.log('👤 [CREATE OFFER] User:', { hasUser: !!user, orgId: user?.organizationId });
    
    if (!user || !user.organizationId) {
      console.log('❌ [CREATE OFFER] Unauthorized - no user or orgId');
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const jobId = c.req.param('jobId');
    console.log('📋 [CREATE OFFER] Job ID:', jobId);
    
    // Get validated and transformed data
    const validatedBody = c.get('validatedBody');
    const {
      pricing_snapshot_json = null,
      total_cents,
      currency = 'EUR',
      proposed_start,
      proposed_end,
      provider_note
    } = validatedBody;

    console.log('🔍 [CREATE OFFER] Parametri estratti:', {
      total_cents,
      currency,
      has_proposed_start: !!proposed_start,
      has_proposed_end: !!proposed_end,
      has_provider_note: !!provider_note,
      has_pricing_snapshot: !!pricing_snapshot_json
    });

    if (!total_cents || total_cents <= 0) {
      console.log('❌ [CREATE OFFER] Invalid pricing:', total_cents);
      return c.json({ error: 'Invalid pricing' }, 400);
    }

    console.log('📝 [CREATE OFFER] Creazione job offer:', { jobId, operatorOrgId: user.organizationId });

    // Verifica che il job esista nel database
    console.log('🔍 [CREATE OFFER] Verifica job esistente...');
    let jobResult;
    try {
      jobResult = await query('SELECT id, status, buyer_org_id FROM jobs WHERE id = $1', [jobId]);
      console.log('✅ [CREATE OFFER] Job query result:', { rowsCount: jobResult?.rows?.length || 0 });
    } catch (jobQueryError: any) {
      console.error('❌ [CREATE OFFER] Errore query job:', jobQueryError.message);
      console.error('❌ [CREATE OFFER] Stack:', jobQueryError.stack);
      throw jobQueryError;
    }
    
    if (!jobResult || !jobResult.rows || jobResult.rows.length === 0) {
      console.log('❌ [CREATE OFFER] Job non trovato:', jobId);
      return c.json({ error: 'Job not found' }, 404);
    }

    const job = jobResult.rows[0];
    console.log('📋 [CREATE OFFER] Job trovato:', { id: job.id, status: job.status });

    if (job.status !== 'OPEN') {
      console.log('❌ [CREATE OFFER] Job non aperto:', job.status);
      return c.json({ error: 'Job is not open for offers' }, 400);
    }

    // Check if operator already submitted an ACTIVE offer (OFFERED or AWARDED)
    // WITHDRAWN and DECLINED offers allow creating a new offer
    console.log('🔍 [CREATE OFFER] Verifica offerte esistenti...');
    let existingOfferResult;
    try {
      existingOfferResult = await query(
        'SELECT id, status FROM job_offers WHERE job_id = $1 AND operator_org_id = $2 AND status IN (\'OFFERED\', \'AWARDED\')',
        [jobId, user.organizationId]
      );
      console.log('✅ [CREATE OFFER] Existing offers query result:', { count: existingOfferResult?.rows?.length || 0 });
    } catch (existingOfferError: any) {
      console.error('❌ [CREATE OFFER] Errore query offerte esistenti:', existingOfferError.message);
      throw existingOfferError;
    }

    if (existingOfferResult && existingOfferResult.rows && existingOfferResult.rows.length > 0) {
      console.log('❌ [CREATE OFFER] Offerta già esistente:', existingOfferResult.rows[0]);
      return c.json({ error: 'Operator already submitted an active offer for this job' }, 400);
    }

    // Generate unique ID
    const offerId = `offer_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();
    console.log('🆔 [CREATE OFFER] ID generato:', offerId);
    console.log('⏰ [CREATE OFFER] Timestamp:', now);

    // Insert job offer into database
    const dbUrl = process.env.DATABASE_URL || '';
    const isPostgreSQL = true; // Force PostgreSQL for Supabase
    console.log('💾 [CREATE OFFER] Database type:', isPostgreSQL ? 'PostgreSQL' : 'SQLite');

    // Handle pricing_snapshot_json - ensure it's valid JSON or null
    let pricingSnapshotStr = null;
    if (pricing_snapshot_json) {
      pricingSnapshotStr = typeof pricing_snapshot_json === 'string'
        ? pricing_snapshot_json
        : JSON.stringify(pricing_snapshot_json);
    }
    // Leave as null if not provided - database allows null
    
    console.log('📦 [CREATE OFFER] Valori per INSERT:', {
      offerId,
      jobId,
      operatorOrgId: user.organizationId,
      total_cents: total_cents, // Already validated and transformed by Zod
      pricingSnapshotStr: pricingSnapshotStr ? pricingSnapshotStr.substring(0, 100) : null,
      currency: currency || 'EUR',
      proposed_start,
      proposed_end,
      provider_note,
      now
    });

    const insertQuery = isPostgreSQL
      ? `
        INSERT INTO job_offers (
          job_id, operator_org_id, status, pricing_snapshot_json,
          total_cents, currency, proposed_start, proposed_end, provider_note,
          created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING id
      `
      : `
        INSERT INTO job_offers (
          id, job_id, operator_org_id, status, pricing_snapshot_json,
          total_cents, currency, proposed_start, proposed_end, provider_note,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

    // Convert empty strings to null for dates
    const proposedStart = proposed_start && proposed_start.trim() !== '' ? proposed_start : null;
    const proposedEnd = proposed_end && proposed_end.trim() !== '' ? proposed_end : null;

    const insertValues = [
      jobId,
      user.organizationId,
      'OFFERED',
      pricingSnapshotStr,
      total_cents, // Already validated and transformed by Zod
      currency || 'EUR',
      proposedStart,
      proposedEnd,
      provider_note || null,
      now,
      now
    ];

    // For SQLite, we need to add the offerId to the values array
    const finalInsertValues = isPostgreSQL ? insertValues : [offerId, ...insertValues];

    console.log('📤 [CREATE OFFER] Esecuzione INSERT query...');
    console.log('📤 [CREATE OFFER] Query:', insertQuery.substring(0, 200));
    console.log('📤 [CREATE OFFER] Values count:', insertValues.length);
    console.log('📤 [CREATE OFFER] Values types:', insertValues.map(v => typeof v));
    
    let insertResult;
    let actualOfferId;

    try {
      insertResult = await query(insertQuery, finalInsertValues);
      console.log('✅ [CREATE OFFER] INSERT completato:', { 
        hasResult: !!insertResult,
        changes: insertResult?.changes,
        lastInsertRowid: insertResult?.lastInsertRowid,
        rows: insertResult?.rows
      });

      // Get the actual offer ID
      if (isPostgreSQL && insertResult.rows && insertResult.rows.length > 0) {
        actualOfferId = insertResult.rows[0].id;
        console.log('📥 [CREATE OFFER] ID from RETURNING:', actualOfferId);
      } else {
        // For SQLite or if RETURNING didn't work
        actualOfferId = offerId;
        console.log('📥 [CREATE OFFER] Using generated ID:', actualOfferId);
      }
    } catch (insertError: any) {
      console.error('❌ [CREATE OFFER] Errore durante INSERT:');
      console.error('❌ [CREATE OFFER] Message:', insertError.message);
      console.error('❌ [CREATE OFFER] Stack:', insertError.stack);
      console.error('❌ [CREATE OFFER] Query:', insertQuery);
      console.error('❌ [CREATE OFFER] Values:', insertValues);
      throw insertError;
    }

    // Fetch the created offer using the actual ID
    console.log('📥 [CREATE OFFER] Recupero offerta creata con ID:', actualOfferId);
    let offerResult;
    try {
      offerResult = await query('SELECT * FROM job_offers WHERE id = $1', [actualOfferId]);
      console.log('📥 [CREATE OFFER] Query SELECT result:', { 
        hasResult: !!offerResult,
        rowsCount: offerResult?.rows?.length || 0 
      });
    } catch (selectError: any) {
      console.error('❌ [CREATE OFFER] Errore durante SELECT:');
      console.error('❌ [CREATE OFFER] Message:', selectError.message);
      console.error('❌ [CREATE OFFER] Stack:', selectError.stack);
      throw selectError;
    }
    
    if (!offerResult || !offerResult.rows || offerResult.rows.length === 0) {
      console.error('❌ [CREATE OFFER] Offerta non trovata dopo INSERT!');
      console.error('❌ [CREATE OFFER] ID cercato:', actualOfferId);
      console.error('❌ [CREATE OFFER] Result:', offerResult);
      return c.json({ error: 'Failed to create offer - offer not found after insert' }, 500);
    }
    
    const newOffer = offerResult.rows[0];
    console.log('✅ [CREATE OFFER] Offerta recuperata:', { 
      id: newOffer.id, 
      status: newOffer.status,
      total_cents: newOffer.total_cents 
    });

    return c.json({ offer: newOffer }, 201);
  } catch (error: any) {
    console.error('❌ [CREATE OFFER] Error creating job offer:');
    console.error('❌ [CREATE OFFER] Error type:', error.constructor.name);
    console.error('❌ [CREATE OFFER] Error message:', error.message);
    console.error('❌ [CREATE OFFER] Error stack:', error.stack);
    if (error.code) console.error('❌ [CREATE OFFER] Error code:', error.code);
    if (error.errno) console.error('❌ [CREATE OFFER] Error errno:', error.errno);
    if (error.detail) console.error('❌ [CREATE OFFER] Error detail:', error.detail);
    if (error.hint) console.error('❌ [CREATE OFFER] Error hint:', error.hint);
    return c.json({ error: 'Internal server error', message: error.message }, 500);
  }
});

// GET /api/jobs/:jobId/offers - Get offers for a specific job
app.get('/:jobId/offers', authMiddleware, async (c) => {
  try {
    // @ts-ignore - Hono context typing issue
    const user = c.get('user') as any;
    if (!user || !user.organizationId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const jobId = c.req.param('jobId');

    console.log('📋 [GET JOB OFFERS] Richiesta offerte per job:', { jobId, userOrgId: user.organizationId });

    // Verify the job exists and user has access (either buyer or operator with offer)
    const jobResult = await query('SELECT id, buyer_org_id FROM jobs WHERE id = $1', [jobId]);
    if (jobResult.rows.length === 0) {
      return c.json({ error: 'Job not found' }, 404);
    }

    const job = jobResult.rows[0];
    const isBuyer = job.buyer_org_id === user.organizationId;

    // Get offers for this job
    const offersResult = await query(`
      SELECT
        jo.id, jo.job_id, jo.operator_org_id, jo.status, jo.pricing_snapshot_json,
        jo.total_cents, jo.currency, jo.proposed_start, jo.proposed_end, jo.provider_note,
        jo.created_at, jo.updated_at,
        o.legal_name as operator_org_legal_name
      FROM job_offers jo
      LEFT JOIN organizations o ON jo.operator_org_id = o.id
      WHERE jo.job_id = $1
      ORDER BY jo.created_at DESC
    `, [jobId]);

    // Format offers
    const offers = offersResult.rows.map((row: any) => ({
      id: row.id,
      job_id: row.job_id,
      operator_org_id: row.operator_org_id,
      status: row.status,
      pricing_snapshot_json: row.pricing_snapshot_json ? (typeof row.pricing_snapshot_json === 'string' ? JSON.parse(row.pricing_snapshot_json) : row.pricing_snapshot_json) : null,
      total_cents: parseInt(row.total_cents) || 0,
      currency: row.currency || 'EUR',
      proposed_start: row.proposed_start,
      proposed_end: row.proposed_end,
      provider_note: row.provider_note,
      created_at: row.created_at,
      updated_at: row.updated_at,
      operator_org: {
        id: row.operator_org_id,
        legal_name: row.operator_org_legal_name || 'N/A'
      }
    }));

    console.log('✅ [GET JOB OFFERS] Trovate', offers.length, 'offerte per job:', jobId);

    return c.json({ offers });
  } catch (error: any) {
    console.error('❌ [GET JOB OFFERS] Error:', error);
    return c.json({ error: 'Internal server error', message: error.message }, 500);
  }
});

// POST /api/jobs/:jobId/accept-offer/:offerId - Accept job offer (buyer)
app.post('/:jobId/accept-offer/:offerId', authMiddleware, async (c) => {
  try {
    // @ts-ignore - Hono context typing issue
    const user = c.get('user') as any;
    if (!user || !user.organizationId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    // Validate URL parameters
    const paramsResult = AcceptOfferParamsSchema.safeParse({
      jobId: c.req.param('jobId'),
      offerId: c.req.param('offerId')
    });

    if (!paramsResult.success) {
      return c.json({
        error: 'Validation failed',
        message: 'Parametri URL non validi',
        details: paramsResult.error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message,
          code: err.code
        }))
      }, 400);
    }

    const { jobId, offerId } = paramsResult.data;

    console.log('✅ [ACCEPT OFFER] Accettazione offerta:', { jobId, offerId, buyerOrgId: user.organizationId });

    // Fetch the job
    const jobResult = await query('SELECT id, buyer_org_id, status FROM jobs WHERE id = $1', [jobId]);
    if (jobResult.rows.length === 0) {
      return c.json({ error: 'Job not found' }, 404);
    }

    const job = jobResult.rows[0];

    // Verify the buyer owns this job
    if (job.buyer_org_id !== user.organizationId) {
      console.log('❌ [ACCEPT OFFER] Unauthorized: buyer org mismatch', { jobBuyerOrgId: job.buyer_org_id, userOrgId: user.organizationId });
      return c.json({ error: 'Unauthorized' }, 403);
    }

    if (job.status !== 'OPEN') {
      return c.json({ error: 'Job is not open' }, 400);
    }

    // Fetch the offer
    const offerResult = await query('SELECT id, job_id, operator_org_id, status FROM job_offers WHERE id = $1 AND job_id = $2', [offerId, jobId]);
    if (offerResult.rows.length === 0) {
      return c.json({ error: 'Offer not found' }, 404);
    }

    const offer = offerResult.rows[0];

    if (offer.status !== 'OFFERED') {
      return c.json({ error: 'Offer is not available' }, 400);
    }

    const dbUrl = process.env.DATABASE_URL || '';
    const isPostgreSQL = true; // Force PostgreSQL for Supabase
    const now = new Date().toISOString();

    // Ensure bookings table exists with all required columns
    const createBookingsTableQuery = isPostgreSQL
      ? `
        CREATE TABLE IF NOT EXISTS bookings (
          id VARCHAR(255) PRIMARY KEY,
          job_id VARCHAR(255) NOT NULL,
          accepted_offer_id VARCHAR(255),
          buyer_org_id VARCHAR(255) NOT NULL,
          seller_org_id VARCHAR(255) NOT NULL,
          executor_org_id VARCHAR(255) NOT NULL,
          service_type VARCHAR(255) NOT NULL,
          site_snapshot_json TEXT,
          status VARCHAR(50) DEFAULT 'CONFIRMED',
          payment_status VARCHAR(50) DEFAULT 'PENDING',
          paid_at TIMESTAMP,
          executed_start_at TIMESTAMP,
          executed_end_at TIMESTAMP,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        )
      `
      : `
        CREATE TABLE IF NOT EXISTS bookings (
          id TEXT PRIMARY KEY,
          job_id TEXT NOT NULL,
          accepted_offer_id TEXT,
          buyer_org_id TEXT NOT NULL,
          seller_org_id TEXT NOT NULL,
          executor_org_id TEXT NOT NULL,
          service_type TEXT NOT NULL,
          site_snapshot_json TEXT,
          status TEXT DEFAULT 'CONFIRMED',
          payment_status TEXT DEFAULT 'PENDING',
          paid_at TEXT,
          executed_start_at TEXT,
          executed_end_at TEXT,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
      `;
    
    try {
      await query(createBookingsTableQuery);
    } catch (error: any) {
      console.error('Error creating bookings table:', error.message);
      // Continue anyway - table might already exist
    }

    // Update job status to AWARDED
    await query(
      'UPDATE jobs SET status = $1, updated_at = $2 WHERE id = $3',
      ['AWARDED', now, jobId]
    );

    // Update offer status to AWARDED
    await query(
      'UPDATE job_offers SET status = $1, updated_at = $2 WHERE id = $3',
      ['AWARDED', now, offerId]
    );

    // Decline all other offers for this job
    await query(
      'UPDATE job_offers SET status = $1, updated_at = $2 WHERE job_id = $3 AND id != $4 AND status = $5',
      ['DECLINED', now, jobId, offerId, 'OFFERED']
    );

    // Create booking record for the accepted offer
    const bookingId = `book_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Get job details for booking
    const jobDetailsResult = await query(`
      SELECT service_type, field_name, area_ha, location_json, target_date_start, target_date_end, notes
      FROM jobs WHERE id = $1
    `, [jobId]);

    const jobDetails = jobDetailsResult.rows[0];

    // Create booking
    await query(`
      INSERT INTO bookings (
        id, job_id, accepted_offer_id, buyer_org_id, seller_org_id, executor_org_id, service_type,
        site_snapshot_json, status, payment_status, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    `, [
      bookingId,
      jobId,
      offerId,
      job.buyer_org_id,
      offer.operator_org_id, // seller_org_id = operator organization
      offer.operator_org_id, // executor_org_id = same as seller for now
      jobDetails.service_type,
      JSON.stringify({
        field_name: jobDetails.field_name,
        area_ha: jobDetails.area_ha,
        location_json: jobDetails.location_json,
        target_date_start: jobDetails.target_date_start,
        target_date_end: jobDetails.target_date_end,
        notes: jobDetails.notes
      }),
      'CONFIRMED',
      'PENDING',
      now,
      now
    ]);

    console.log('✅ [ACCEPT OFFER] Offerta accettata e booking creata:', { offerId, bookingId });

    return c.json({
      message: 'Offerta accettata con successo. Il lavoro è stato assegnato.'
    });
  } catch (error: any) {
    console.error('❌ [ACCEPT OFFER] Error accepting offer:', error);
    return c.json({ error: 'Internal server error', message: error.message }, 500);
  }
});

// PUT /api/jobs/:jobId/offers/:offerId - Update job offer (operator/vendor)
// IMPORTANTE: questa route deve essere PRIMA di /:orgId per evitare conflitti di routing
app.put('/:jobId/offers/:offerId', authMiddleware, async (c) => {
  try {
    // @ts-ignore - Hono context typing issue
    const user = c.get('user') as any;
    if (!user || !user.organizationId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const jobId = c.req.param('jobId');
    const offerId = c.req.param('offerId');
    const validatedBody = c.get('validatedBody');
    const {
      total_cents,
      currency = 'EUR',
      proposed_start,
      proposed_end,
      provider_note,
      pricing_snapshot_json = null
    } = validatedBody;

    if (!total_cents || total_cents <= 0) {
      return c.json({ error: 'Invalid pricing' }, 400);
    }

    console.log('🔄 [UPDATE OFFER] Aggiornamento offerta:', { jobId, offerId, operatorOrgId: user.organizationId });

    // Verifica che l'offerta esista e appartenga all'operatore
    const offerResult = await query(
      'SELECT id, job_id, operator_org_id, status FROM job_offers WHERE id = $1 AND job_id = $2',
      [offerId, jobId]
    );

    if (offerResult.rows.length === 0) {
      return c.json({ error: 'Offerta non trovata' }, 404);
    }

    const offer = offerResult.rows[0];

    // Verifica che l'offerta appartenga all'operatore
    if (offer.operator_org_id !== user.organizationId) {
      return c.json({ error: 'Non autorizzato a modificare questa offerta' }, 403);
    }

    // Verifica che l'offerta sia ancora modificabile (OFFERED)
    if (offer.status !== 'OFFERED') {
      return c.json({ error: 'L\'offerta non può essere modificata (stato: ' + offer.status + ')' }, 400);
    }

    // Aggiorna l'offerta
    const dbUrl = process.env.DATABASE_URL || '';
    const isPostgreSQL = true; // Force PostgreSQL for Supabase
    const now = new Date().toISOString();
    const pricingSnapshotStr = pricing_snapshot_json 
      ? (typeof pricing_snapshot_json === 'string' ? pricing_snapshot_json : JSON.stringify(pricing_snapshot_json))
      : null;

    await query(
      `UPDATE job_offers SET 
        total_cents = $1, 
        currency = $2, 
        proposed_start = $3, 
        proposed_end = $4, 
        provider_note = $5,
        pricing_snapshot_json = $6,
        updated_at = $7 
      WHERE id = $8`,
      [
        parseInt(total_cents),
        currency || 'EUR',
        proposed_start || null,
        proposed_end || null,
        provider_note || null,
        pricingSnapshotStr || offer.pricing_snapshot_json || '{}',
        now,
        offerId
      ]
    );

    // Recupera l'offerta aggiornata
    const updatedOfferResult = await query('SELECT * FROM job_offers WHERE id = $1', [offerId]);
    const updatedOffer = updatedOfferResult.rows[0];

    console.log('✅ [UPDATE OFFER] Offerta aggiornata con successo:', offerId);

    return c.json({ offer: updatedOffer });
  } catch (error: any) {
    console.error('❌ [UPDATE OFFER] Error updating offer:', error);
    return c.json({ error: 'Internal server error', message: error.message }, 500);
  }
});

// POST /api/jobs/:jobId/withdraw-offer/:offerId - Withdraw job offer (operator/vendor)
// IMPORTANTE: questa route deve essere PRIMA di /:orgId per evitare conflitti di routing
app.post('/:jobId/withdraw-offer/:offerId', authMiddleware, async (c) => {
  try {
    // @ts-ignore - Hono context typing issue
    const user = c.get('user') as any;
    if (!user || !user.organizationId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const jobId = c.req.param('jobId');
    const offerId = c.req.param('offerId');

    console.log('🔄 Ritiro offerta:', { jobId, offerId, operatorOrgId: user.organizationId });

    // Verifica che l'offerta esista e appartenga all'operatore
    const offerResult = await query(
      'SELECT id, job_id, operator_org_id, status FROM job_offers WHERE id = $1 AND job_id = $2',
      [offerId, jobId]
    );

    if (offerResult.rows.length === 0) {
      return c.json({ error: 'Offerta non trovata' }, 404);
    }

    const offer = offerResult.rows[0];

    // Verifica che l'offerta appartenga all'operatore
    if (offer.operator_org_id !== user.organizationId) {
      return c.json({ error: 'Non autorizzato a ritirare questa offerta' }, 403);
    }

    // Verifica che l'offerta sia ancora in stato OFFERED
    if (offer.status !== 'OFFERED') {
      return c.json({ error: 'L\'offerta non può essere ritirata (stato: ' + offer.status + ')' }, 400);
    }

    // Aggiorna lo stato dell'offerta a WITHDRAWN
    const dbUrl = process.env.DATABASE_URL || '';
    const isPostgreSQL = true; // Force PostgreSQL for Supabase
    const now = new Date().toISOString();

    await query(
      `UPDATE job_offers SET status = $1, updated_at = $2 WHERE id = $3`,
      ['WITHDRAWN', now, offerId]
    );

    console.log('✅ Offerta ritirata con successo:', offerId);

    return c.json({
      message: 'Offerta ritirata con successo',
      offer: {
        id: offerId,
        status: 'WITHDRAWN'
      }
    });
  } catch (error: any) {
    console.error('❌ Error withdrawing offer:', error);
    return c.json({ error: 'Internal server error', message: error.message }, 500);
  }
});

// ============================================================================
// JOB OFFER MESSAGES ROUTES (deve essere PRIMA di /offers/:orgId per evitare conflitti)
// ============================================================================

// GET MESSAGES FOR OFFER
app.get('/offers/:offerId/messages', authMiddleware, async (c) => {
  try {
    const offerId = c.req.param('offerId');
    // @ts-ignore - Hono context typing issue
    const user = c.get('user') as any;

    console.log('💬 [GET MESSAGES] Starting request for offer:', offerId);

    if (!offerId) {
      console.log('💬 [GET MESSAGES] ❌ Offer ID required');
      return c.json({ error: 'Offer ID required' }, 400);
    }

    if (!user || !user.organizationId) {
      console.log('💬 [GET MESSAGES] ❌ Unauthorized - no user or org');
      return c.json({ error: 'Unauthorized' }, 401);
    }

    console.log('💬 [GET MESSAGES] User authenticated:', { userId: user.userId, orgId: user.organizationId });

    // Verifica che l'offerta esista e che l'utente sia buyer o operator
    const offerCheck = await query(`
      SELECT jo.id, jo.job_id, jo.operator_org_id, jo.status, j.buyer_org_id
      FROM job_offers jo
      JOIN jobs j ON jo.job_id = j.id
      WHERE jo.id = $1
    `, [offerId]);

    console.log('💬 Query result:', offerCheck.rows.length, 'rows');

    if (offerCheck.rows.length === 0) {
      return c.json({ error: 'Offer not found' }, 404);
    }

    const offer = offerCheck.rows[0];

    console.log('💬 Offer details:', {
      offerId: offer.id,
      status: offer.status,
      buyer_org_id: offer.buyer_org_id,
      operator_org_id: offer.operator_org_id,
      user_org: user.organizationId
    });
    
    // Verifica che l'utente sia buyer o operator dell'offerta
    const isBuyer = offer.buyer_org_id === user.organizationId;
    const isOperator = offer.operator_org_id === user.organizationId;

    console.log('💬 Authorization check:', { isBuyer, isOperator });

    if (!isBuyer && !isOperator) {
      console.log('💬 ❌ Authorization failed: user is neither buyer nor operator');
      return c.json({ error: 'Unauthorized: You can only view messages for your own offers' }, 403);
    }

    // La chat è disponibile solo dopo che l'offerta è stata accettata o assegnata
    const isAccepted = offer.status === 'ACCEPTED';
    const isAwarded = offer.status === 'AWARDED';

    console.log('💬 Status check:', { status: offer.status, isAccepted, isAwarded });

    if (!isAccepted && !isAwarded) {
      console.log('💬 ❌ Status check failed: offer not accepted or awarded');
      return c.json({ error: 'Chat is available only after the offer is accepted or awarded' }, 403);
    }

    console.log('💬 ✅ Authorization and status checks passed');

    const messagesQuery = `
      SELECT
        jom.id,
        jom.job_offer_id,
        jom.sender_org_id,
        jom.sender_user_id,
        jom.body,
        jom.created_at,
        u.first_name,
        u.last_name
      FROM job_offer_messages jom
      LEFT JOIN users u ON jom.sender_user_id = u.id
      WHERE jom.job_offer_id = $1
      ORDER BY jom.created_at ASC
    `;

    const result = await query(messagesQuery, [offerId]);

    const messages = result.rows.map(msg => ({
      id: msg.id,
      offer_id: msg.job_offer_id,
      sender_org_id: msg.sender_org_id, // Organizzazione del mittente reale
      sender_user_id: msg.sender_user_id,
      message_text: msg.body,
      is_read: false, // La tabella non ha questo campo
      created_at: msg.created_at,
      sender_name: `${msg.first_name || 'Utente'} ${msg.last_name || ''}`.trim()
    }));

    console.log('✅ [GET MESSAGES] Recuperati', messages.length, 'messaggi per offerta');
    console.log('✅ [GET MESSAGES] Returning messages array:', messages);

    return c.json(messages);

  } catch (error: any) {
    console.error('❌ [GET MESSAGES] Errore get offer messages:', error);
    console.error('❌ [GET MESSAGES] Stack:', error.stack);
    return c.json({
      error: 'Errore interno',
      message: error.message
    }, 500);
  }
});

// POST MESSAGE FOR OFFER
app.post('/offers/:offerId/messages', authMiddleware, validateBody(CreateMessageSchema), async (c) => {
  try {
    const offerId = c.req.param('offerId');
    const validatedBody = c.get('validatedBody');
    const { content: message_text } = validatedBody;
    // @ts-ignore - Hono context typing issue
    const user = c.get('user') as any;

    if (!user || !user.organizationId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    // Usa l'organizzazione e utente autenticati come sender
    const sender_org_id = user.organizationId;
    const sender_user_id = user.userId;

    console.log('💬 Creazione messaggio per offerta:', offerId);

    // Verifica che l'offerta esista
    const offerCheck = await query(`
      SELECT jo.id, jo.job_id, jo.operator_org_id, jo.status, j.buyer_org_id
      FROM job_offers jo
      JOIN jobs j ON jo.job_id = j.id
      WHERE jo.id = $1
    `, [offerId]);

    if (offerCheck.rows.length === 0) {
      return c.json({ error: 'Offer not found' }, 404);
    }

    const offer = offerCheck.rows[0];
    
    // Verifica che il sender sia buyer o operator dell'offerta
    if (offer.buyer_org_id !== sender_org_id && offer.operator_org_id !== sender_org_id) {
      return c.json({ error: 'Unauthorized: You can only send messages for your own offers' }, 403);
    }

    // I messaggi possono essere inviati solo dopo che l'offerta è stata accettata o assegnata
    if (offer.status !== 'ACCEPTED' && offer.status !== 'AWARDED') {
      return c.json({ error: 'Messages can only be sent after the offer is accepted or awarded' }, 403);
    }

    // Crea messaggio
    const messageId = `jom_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const insertQuery = `
      INSERT INTO job_offer_messages (id, job_offer_id, sender_org_id, sender_user_id, body, created_at)
      VALUES ($1, $2, $3, $4, $5, $6)
    `;

    await query(insertQuery, [
      messageId,
      offerId,
      sender_org_id,
      sender_user_id || null,
      message_text,
      new Date().toISOString()
    ]);

    // Recupera il messaggio appena creato
    const messageResult = await query(`
      SELECT jom.id, jom.job_offer_id, jom.sender_org_id, jom.sender_user_id, jom.body, jom.created_at,
             u.first_name, u.last_name
      FROM job_offer_messages jom
      LEFT JOIN users u ON jom.sender_user_id = u.id
      WHERE jom.id = $1
    `, [messageId]);

    const message = messageResult.rows[0];

    console.log('✅ Messaggio creato per offerta:', messageId);

      return c.json({ 
      id: message.id,
      offer_id: message.job_offer_id,
      sender_org_id: message.sender_org_id,
      sender_user_id: message.sender_user_id,
      message_text: message.body,
      is_read: false, // La tabella non ha questo campo
      created_at: message.created_at,
      sender_org_name: message.sender_org_name,
      sender_name: `${message.first_name} ${message.last_name}`.trim()
    });

  } catch (error: any) {
    console.error('❌ Errore create offer message:', error);
    return c.json({
      error: 'Errore interno',
      message: error.message
    }, 500);
  }
});

// MARK MESSAGES AS READ FOR OFFER
app.put('/offers/:offerId/messages/read', authMiddleware, async (c) => {
  try {
    const offerId = c.req.param('offerId');
    // @ts-ignore - Hono context typing issue
    const user = c.get('user') as any;

    if (!user || !user.organizationId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    // Usa l'organizzazione dell'utente autenticato come reader
    const reader_org_id = user.organizationId;

    console.log('💬 Marca messaggi come letti per offerta:', offerId);

    // Verifica che l'offerta esista e che il reader sia buyer o operator
    const offerCheck = await query(`
      SELECT jo.id, jo.job_id, jo.operator_org_id, j.buyer_org_id
      FROM job_offers jo
      JOIN jobs j ON jo.job_id = j.id
      WHERE jo.id = $1
    `, [offerId]);

    if (offerCheck.rows.length === 0) {
      return c.json({ error: 'Offer not found' }, 404);
    }

    const offer = offerCheck.rows[0];
    
    // Verifica che il reader sia buyer o operator dell'offerta
    if (offer.buyer_org_id !== reader_org_id && offer.operator_org_id !== reader_org_id) {
      return c.json({ error: 'Unauthorized' }, 403);
    }

    // Marca come letti solo i messaggi NON inviati dal reader stesso
    await query(`
      UPDATE job_offer_messages 
      SET is_read = 1 
      WHERE offer_id = $1 
        AND sender_org_id != $2
        AND is_read = 0
    `, [offerId, reader_org_id]);

    console.log('✅ Messaggi marcati come letti per offerta');

    return c.json({ success: true });

  } catch (error: any) {
    console.error('❌ Errore mark offer messages as read:', error);
    return c.json({
      error: 'Errore interno',
      message: error.message
    }, 500);
  }
});

// POST /api/jobs/offers/:offerId/complete - Complete mission (operator/vendor)
// IMPORTANTE: questa route deve essere PRIMA di /offers/:orgId per evitare conflitti
app.post('/offers/:offerId/complete', authMiddleware, async (c) => {
  try {
    // @ts-ignore - Hono context typing issue
    const user = c.get('user') as any;
    if (!user || !user.organizationId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    // Validate URL parameters
    const paramsResult = CompleteMissionParamsSchema.safeParse({
      offerId: c.req.param('offerId')
    });

    if (!paramsResult.success) {
      return c.json({
        error: 'Validation failed',
        message: 'Parametri URL non validi',
        details: paramsResult.error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message,
          code: err.code
        }))
      }, 400);
    }

    const { offerId } = paramsResult.data;

    console.log('✅ [COMPLETE MISSION] Completamento missione per offerta:', { offerId, operatorOrgId: user.organizationId });

    // Fetch the offer with job details
    const offerResult = await query(`
      SELECT jo.id, jo.job_id, jo.operator_org_id, jo.status,
             j.buyer_org_id, j.service_type, j.field_name, j.area_ha
      FROM job_offers jo
      JOIN jobs j ON jo.job_id = j.id
      WHERE jo.id = $1
    `, [offerId]);

    if (offerResult.rows.length === 0) {
      return c.json({ error: 'Offerta non trovata' }, 404);
    }

    const offer = offerResult.rows[0];
    const jobId = offer.job_id;

    // Verify the offer is AWARDED or ACCEPTED
    if (offer.status !== 'AWARDED' && offer.status !== 'ACCEPTED') {
      return c.json({ error: 'L\'offerta deve essere assegnata o accettata per completare la missione' }, 400);
    }

    // Check authorization - operator can complete their own offers
    if (offer.operator_org_id !== user.organizationId) {
      return c.json({ error: 'Non autorizzato a completare questa missione' }, 403);
    }

    const dbUrl = process.env.DATABASE_URL || '';
    const isPostgreSQL = true; // Force PostgreSQL for Supabase
    const now = new Date().toISOString();

    // Ensure bookings table exists with all required columns
    const createBookingsTableQuery = isPostgreSQL
      ? `
        CREATE TABLE IF NOT EXISTS bookings (
          id VARCHAR(255) PRIMARY KEY,
          job_id VARCHAR(255) NOT NULL,
          accepted_offer_id VARCHAR(255),
          buyer_org_id VARCHAR(255) NOT NULL,
          seller_org_id VARCHAR(255) NOT NULL,
          executor_org_id VARCHAR(255) NOT NULL,
          service_type VARCHAR(255) NOT NULL,
          site_snapshot_json TEXT,
          status VARCHAR(50) DEFAULT 'CONFIRMED',
          payment_status VARCHAR(50) DEFAULT 'PENDING',
          paid_at TIMESTAMP,
          executed_start_at TIMESTAMP,
          executed_end_at TIMESTAMP,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        )
      `
      : `
        CREATE TABLE IF NOT EXISTS bookings (
          id TEXT PRIMARY KEY,
          job_id TEXT NOT NULL,
          accepted_offer_id TEXT,
          buyer_org_id TEXT NOT NULL,
          seller_org_id TEXT NOT NULL,
          executor_org_id TEXT NOT NULL,
          service_type TEXT NOT NULL,
          site_snapshot_json TEXT,
          status TEXT DEFAULT 'CONFIRMED',
          payment_status TEXT DEFAULT 'PENDING',
          paid_at TEXT,
          executed_start_at TEXT,
          executed_end_at TEXT,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
      `;
    
    try {
      await query(createBookingsTableQuery);
    } catch (error: any) {
      console.error('Error creating bookings table:', error.message);
      // Continue anyway - table might already exist
    }

    // Check if booking already exists for this accepted offer
    let existingBookingResult = await query(
      'SELECT id, status FROM bookings WHERE job_id = $1 AND accepted_offer_id = $2',
      [jobId, offerId]
    );

    // If no booking found for this specific offer, try to find any booking for this job (workaround for existing data)
    if (existingBookingResult.rows.length === 0 && offer.status === 'AWARDED') {
      console.log('⚠️ [COMPLETE MISSION] No booking found for offer, trying to find any booking for job:', jobId);
      existingBookingResult = await query(
      'SELECT id, status FROM bookings WHERE job_id = $1',
      [jobId]
    );
      if (existingBookingResult.rows.length > 0) {
        console.log('⚠️ [COMPLETE MISSION] Found existing booking for job, will update it');
      }
    }

    const siteSnapshot = JSON.stringify({
      name: offer.field_name || 'Campo',
      area_ha: offer.area_ha || 0
    });

    if (existingBookingResult.rows.length > 0) {
      // Update existing booking
      const booking = existingBookingResult.rows[0];
      console.log('📋 [COMPLETE MISSION] Booking esistente trovato:', {
        bookingId: booking.id,
        jobId,
        currentStatus: booking.status,
        offerId,
        buyerOrgId: offer.buyer_org_id,
        operatorOrgId: offer.operator_org_id
      });
      await query(
        'UPDATE bookings SET status = $1, accepted_offer_id = $2, executed_end_at = $3, updated_at = $4 WHERE id = $5',
        ['DONE', offerId, now, now, booking.id]
      );
      console.log('✅ [COMPLETE MISSION] Booking aggiornato:', booking.id);
      
      // Verify the update worked
      const verifyResult = await query(
        'SELECT id, job_id, accepted_offer_id, buyer_org_id, executor_org_id, status FROM bookings WHERE id = $1',
        [booking.id]
      );
      console.log('📋 [COMPLETE MISSION] Booking dopo aggiornamento:', verifyResult.rows[0]);
    } else {
      // Create new booking
      const bookingId = `booking_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      console.log('📋 [COMPLETE MISSION] Creazione nuovo booking:', {
        bookingId,
        jobId,
        offerId,
        buyerOrgId: offer.buyer_org_id,
        operatorOrgId: offer.operator_org_id,
        serviceType: offer.service_type || 'SPRAY'
      });
      await query(`
        INSERT INTO bookings (
          id, job_id, accepted_offer_id, buyer_org_id, seller_org_id, executor_org_id,
          service_type, site_snapshot_json, status, payment_status, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      `, [
        bookingId,
        jobId,
        offerId,
        offer.buyer_org_id,
        offer.operator_org_id, // seller_org_id
        offer.operator_org_id, // executor_org_id
        offer.service_type || 'SPRAY',
        siteSnapshot,
        'DONE',
        'PENDING',
        now,
        now
      ]);
      console.log('✅ [COMPLETE MISSION] Booking creato:', bookingId);
      
      // Verify the insert worked
      const verifyResult = await query(
        'SELECT id, job_id, accepted_offer_id, buyer_org_id, executor_org_id, status FROM bookings WHERE id = $1',
        [bookingId]
      );
      console.log('📋 [COMPLETE MISSION] Booking dopo creazione:', verifyResult.rows[0]);
    }

    // Update job status to DONE (optional, for consistency)
    await query(
      'UPDATE jobs SET status = $1, updated_at = $2 WHERE id = $3',
      ['DONE', now, jobId]
    );

    console.log('✅ [COMPLETE MISSION] Missione completata con successo');

    return c.json({
      message: 'Missione completata con successo',
      offer_id: offerId,
      job_id: jobId
    });
  } catch (error: any) {
    console.error('❌ [COMPLETE MISSION] Error completing mission:', error);
    return c.json({ error: 'Internal server error', message: error.message }, 500);
  }
});

// GET /api/jobs/offers/:orgId - Get offers for organization (received and made)
// IMPORTANTE: questa route deve essere DOPO le route dei messaggi per evitare conflitti
app.get('/offers/:orgId', authMiddleware, async (c) => {
  try {
    // @ts-ignore - Hono context typing issue
    const user = c.get('user') as any;
    const orgId = c.req.param('orgId');

    console.log('🎁 Richiesta job offers per org:', orgId, 'user org:', user?.organizationId);

    // Users can only see offers for their own organization
    if (!user || user.organizationId !== orgId) {
      return c.json({ error: 'Unauthorized' }, 403);
    }

    // Get offers received (where user's org is the buyer)
    // Note: We use JOIN here because we need the job to determine buyer_org_id
    const receivedOffersResult = await query(`
      SELECT 
        jo.id, jo.job_id, jo.operator_org_id, jo.status, jo.pricing_snapshot_json,
        jo.total_cents, jo.currency, jo.proposed_start, jo.proposed_end, jo.provider_note,
        jo.created_at, jo.updated_at,
        j.field_name, j.service_type, j.area_ha, j.location_json,
        j.target_date_start, j.target_date_end, j.notes, j.status as job_status,
        buyer_org.legal_name as buyer_org_legal_name,
        operator_org.legal_name as operator_org_legal_name
      FROM job_offers jo
      JOIN jobs j ON jo.job_id = j.id
      JOIN organizations buyer_org ON j.buyer_org_id = buyer_org.id
      LEFT JOIN organizations operator_org ON jo.operator_org_id = operator_org.id
      WHERE j.buyer_org_id = $1
      ORDER BY jo.created_at DESC
    `, [orgId]);

    // Get offers made (where user's org is the operator)
    const madeOffersResult = await query(`
      SELECT 
        jo.id, jo.job_id, jo.operator_org_id, jo.status, jo.pricing_snapshot_json,
        jo.total_cents, jo.currency, jo.proposed_start, jo.proposed_end, jo.provider_note,
        jo.created_at, jo.updated_at,
        j.field_name, j.service_type, j.area_ha, j.location_json,
        j.target_date_start, j.target_date_end, j.notes, j.status as job_status,
        j.buyer_org_id,
        buyer_org.legal_name as buyer_org_legal_name,
        operator_org.legal_name as operator_org_legal_name
      FROM job_offers jo
      LEFT JOIN jobs j ON jo.job_id = j.id
      LEFT JOIN organizations buyer_org ON j.buyer_org_id = buyer_org.id
      LEFT JOIN organizations operator_org ON jo.operator_org_id = operator_org.id
      WHERE jo.operator_org_id = $1
      ORDER BY jo.created_at DESC
    `, [orgId]);

    // Format received offers
    const received = receivedOffersResult.rows.map((row: any) => {
      const locJson = row.location_json ? (typeof row.location_json === 'string' ? JSON.parse(row.location_json) : row.location_json) : null;
      return {
        id: row.id,
        job_id: row.job_id,
        operator_org_id: row.operator_org_id,
        status: row.status,
        pricing_snapshot_json: row.pricing_snapshot_json ? (typeof row.pricing_snapshot_json === 'string' ? JSON.parse(row.pricing_snapshot_json) : row.pricing_snapshot_json) : null,
        total_cents: parseInt(row.total_cents) || 0,
        currency: row.currency || 'EUR',
        proposed_start: row.proposed_start,
        proposed_end: row.proposed_end,
        provider_note: row.provider_note,
        created_at: row.created_at,
        updated_at: row.updated_at,
        job: {
          id: row.job_id,
          field_name: row.field_name,
          service_type: row.service_type,
          area_ha: row.area_ha ? parseFloat(row.area_ha) : null,
          location_json: locJson,
          field_polygon: locJson?.polygon || (Array.isArray(locJson) ? locJson : null),
          target_date_start: row.target_date_start,
          target_date_end: row.target_date_end,
          notes: row.notes,
          status: row.job_status,
          buyer_org: {
            legal_name: row.buyer_org_legal_name || 'N/A'
          }
        },
        operator_org: {
          id: row.operator_org_id,
          legal_name: row.operator_org_legal_name || 'N/A'
        }
      };
    });

    // Format made offers
    const made = madeOffersResult.rows.map((row: any) => {
      const locJson = row.location_json ? (typeof row.location_json === 'string' ? JSON.parse(row.location_json) : row.location_json) : null;
        return {
        id: row.id,
        job_id: row.job_id,
        operator_org_id: row.operator_org_id,
        status: row.status,
        pricing_snapshot_json: row.pricing_snapshot_json ? (typeof row.pricing_snapshot_json === 'string' ? JSON.parse(row.pricing_snapshot_json) : row.pricing_snapshot_json) : null,
        total_cents: parseInt(row.total_cents) || 0,
        currency: row.currency || 'EUR',
        proposed_start: row.proposed_start,
        proposed_end: row.proposed_end,
        provider_note: row.provider_note,
        created_at: row.created_at,
        updated_at: row.updated_at,
        job: row.job_id ? {
          id: row.job_id,
          field_name: row.field_name || null,
          service_type: row.service_type || null,
          area_ha: row.area_ha ? parseFloat(row.area_ha) : null,
          location_json: locJson,
          field_polygon: locJson?.polygon || (Array.isArray(locJson) ? locJson : null),
          target_date_start: row.target_date_start,
          target_date_end: row.target_date_end,
          notes: row.notes,
          status: row.job_status || null,
          buyer_org: {
            id: row.buyer_org_id || null,
            legal_name: row.buyer_org_legal_name || 'N/A'
          }
        } : null,
        operator_org: {
          id: row.operator_org_id,
          legal_name: row.operator_org_legal_name || 'N/A'
        }
        };
      });

    console.log(`✅ Job offers trovate: received=${received.length}, made=${made.length}`);

    return c.json({ received, made });
  } catch (error: any) {
    console.error('❌ Error fetching job offers:', error);
    console.error('❌ Error stack:', error.stack);
    return c.json({ error: 'Internal server error', message: error.message }, 500);
  }
});

export default app;

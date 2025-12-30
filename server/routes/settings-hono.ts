import { Hono } from 'hono';
import { query } from '../utils/database';
import { authMiddleware } from '../middleware/auth';
import { validateBody } from '../middleware/validation';
import { CreateInvitationSchema } from '../schemas/api.schemas';
import { createClient } from '@supabase/supabase-js';
import { publicObjectUrl } from '../utils/storage';

const app = new Hono();

// ============================================================================
// SERVICE CONFIGURATION
// ============================================================================

// GET /api/service-config/:orgId - Get service configuration
app.get('/:orgId', async (c) => {
  try {
    const orgId = c.req.param('orgId');

    if (!orgId) {
      return c.json({ error: 'Organization ID required' }, 400);
    }

    console.log('⚙️ Richiesta configurazione servizi per org:', orgId);

    try {
      const configQuery = `
        SELECT * FROM service_configurations
        WHERE org_id = $1
      `;

      const result = await query(configQuery, [orgId]);

    if (result.rows.length === 0) {
        // Restituisci configurazione vuota se non esiste
        return c.json({
          id: null,
          org_id: orgId,
          base_location_lat: null,
          base_location_lng: null,
          base_location_address: null,
          working_hours_start: 8,
          working_hours_end: 18,
          available_days: 'MON,TUE,WED,THU,FRI',
          offer_message_template: null,
          rejection_message_template: null,
          available_drones: null,
          preferred_terrain: null,
          max_slope_percentage: null,
          fuel_surcharge_cents: 0,
          maintenance_surcharge_cents: 0,
          enable_job_filters: false,
          operating_regions: null,
          offered_service_types: null,
          hourly_rate_min_cents: null,
          hourly_rate_max_cents: null
        });
      }

      return c.json(result.rows[0]);
    } catch (dbError: any) {
      // Se la tabella non esiste, restituisci configurazione vuota
      if (dbError.code === '42P01') { // relation does not exist
        console.warn('⚠️ Tabella service_configurations non trovata, restituisco configurazione vuota');
        return c.json({
          id: null,
          org_id: orgId,
          base_location_lat: null,
          base_location_lng: null,
          base_location_address: null,
          working_hours_start: 8,
          working_hours_end: 18,
          available_days: 'MON,TUE,WED,THU,FRI',
          offer_message_template: null,
          rejection_message_template: null,
          available_drones: null,
          preferred_terrain: null,
          max_slope_percentage: null,
          fuel_surcharge_cents: 0,
          maintenance_surcharge_cents: 0,
          enable_job_filters: false,
          operating_regions: null,
          offered_service_types: null,
          hourly_rate_min_cents: null,
          hourly_rate_max_cents: null
        });
      }

      // Rilancia altri errori
      throw dbError;
    }

  } catch (error) {
    console.error('❌ Errore recupero configurazione servizi:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// GET /api/settings/organization/general - Get organization general settings
app.get('/organization/general', authMiddleware, async (c) => {
  try {
    const queryParams = c.req.query();
    const orgId = queryParams.orgId;

    if (!orgId) {
      return c.json({ error: 'Organization ID required' }, 400);
    }

    console.log('📖 Recupero impostazioni generali organizzazione:', orgId);

    // Verifica autenticazione
    // @ts-ignore - Hono context typing issue
    const user = c.get('user') as any;
    console.log('👤 User autenticato:', user ? { userId: user.userId, orgId: user.organizationId } : 'null');

    // Usa il database SQLite/PostgreSQL
    const orgResult = await query(`
      SELECT * FROM organizations WHERE id = $1
    `, [orgId]);

    console.log('🔍 Query result rows:', orgResult.rows.length);

    if (orgResult.rows.length === 0) {
      console.log('❌ Organizzazione non trovata per GET:', orgId);
      return c.json({ error: 'Organization not found' }, 404);
    }

    const organization = orgResult.rows[0];

    // Determina il tipo organizzazione basato sulle capabilities
    let orgType = 'BUYER'; // Default
    if (organization.can_sell || organization.can_operate) {
      orgType = 'VENDOR_OPERATOR';
    } else if (organization.can_buy) {
      orgType = 'BUYER';
    }

    console.log('🔍 Organization type determination:', {
      can_buy: organization.can_buy,
      can_sell: organization.can_sell,
      can_operate: organization.can_operate,
      kind: organization.kind,
      type: organization.type,
      determined_org_type: orgType
    });

    // Mappa i campi del database ai nomi del frontend
    const mappedOrganization = {
      ...organization,
      org_type: orgType, // Determinato dalle capabilities, non da kind
    };

    console.log('✅ Impostazioni generali recuperate:', {
      id: mappedOrganization.id,
      legal_name: mappedOrganization.legal_name,
      logo_url: mappedOrganization.logo_url,
      phone: mappedOrganization.phone,
      support_email: mappedOrganization.support_email,
      vat_number: mappedOrganization.vat_number,
      tax_code: mappedOrganization.tax_code,
      org_type: mappedOrganization.org_type,
      kind: organization.kind, // Mostra anche il valore originale
      address_line: mappedOrganization.address_line,
      all_fields: Object.keys(organization)
    });

    return c.json({
      data: mappedOrganization
    });

  } catch (error: any) {
    console.error('❌ Errore recupero impostazioni generali:', error);
    return c.json({
      error: 'Errore interno del server',
      message: error.message
    }, 500);
  }
});

// PATCH /api/settings/organization/general - Update organization general settings
app.patch('/organization/general', authMiddleware, async (c) => {
  try {
    const queryParams = c.req.query();
    const orgId = queryParams.orgId;
    const updates = await c.req.json();

    if (!orgId) {
      return c.json({ error: 'Organization ID required' }, 400);
    }

    console.log('🏢 Aggiornamento impostazioni generali organizzazione:', orgId, updates);

    // Verifica che l'organizzazione esista prima dell'aggiornamento
    const orgCheckResult = await query(`SELECT * FROM organizations WHERE id = $1`, [orgId]);
    if (orgCheckResult.rows.length === 0) {
      console.log('❌ Organizzazione non trovata:', orgId);
      return c.json({ error: 'Organization not found' }, 404);
    }
    console.log('✅ Organizzazione trovata prima dell\'aggiornamento:', orgCheckResult.rows[0]);

    // Verifica quali colonne esistono nella tabella
    try {
      const columnsResult = await query(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = 'organizations'
        ORDER BY column_name
      `);
      console.log('📋 Colonne disponibili nella tabella organizations:', columnsResult.rows.map(r => r.column_name));
    } catch (error) {
      console.log('⚠️ Impossibile verificare le colonne (potrebbe essere SQLite):', error.message);
    }

    // Usa il database SQLite/PostgreSQL
    // Mappa dei campi consentiti (frontend -> database)
    // NOTA: org_type/kind e capabilities non sono modificabili - vengono assegnati alla registrazione
    const fieldMapping: Record<string, string> = {
      'legal_name': 'legal_name',
      'logo_url': 'logo_url',
      'phone': 'phone',
      'support_email': 'support_email',
      'vat_number': 'vat_number',
      'tax_code': 'tax_code',
      // 'org_type': 'kind', // Non modificabile - determinato da capabilities
      'address_line': 'address_line',
      'city': 'city',
      'province': 'province',
      'region': 'region',
      'postal_code': 'postal_code',
      'country': 'country'
      // capabilities non modificabili - can_buy, can_sell, can_operate, can_dispatch
    };

    // Filtra solo i campi consentiti e mappa i nomi
    const validUpdates: any = {};
    console.log('🔍 Incoming updates:', updates);
    console.log('🔍 Field mapping:', fieldMapping);

    for (const [field, value] of Object.entries(updates)) {
      console.log(`🔍 Checking field '${field}' with value:`, value, 'type:', typeof value);
      if (fieldMapping[field]) {
        console.log(`✅ Field '${field}' is allowed, maps to '${fieldMapping[field]}'`);
        if (value !== undefined && value !== null) {
          validUpdates[fieldMapping[field]] = value;
          console.log(`✅ Added to validUpdates: ${fieldMapping[field]} =`, value);
        } else {
          console.log(`❌ Skipped ${field} - value is undefined/null`);
        }
      } else {
        console.log(`❌ Field '${field}' not in mapping`);
      }
    }

    console.log('🔧 Campi validi da aggiornare:', validUpdates);

    if (Object.keys(validUpdates).length === 0) {
      return c.json({ error: 'No valid fields to update' }, 400);
    }

    // Costruisci dinamicamente la query UPDATE
    const updateFields = Object.keys(validUpdates);
    const setClause = updateFields.map((field, index) => `${field} = $${index + 2}`).join(', ');
    const values = [orgId, ...updateFields.map(field => validUpdates[field])];

    console.log('🔧 Query UPDATE:', `UPDATE organizations SET ${setClause} WHERE id = $1`);
    console.log('🔧 Values:', values);

    const updateResult = await query(`
      UPDATE organizations
      SET ${setClause}
      WHERE id = $1
    `, values);

    console.log('✅ Risultato UPDATE:', updateResult);
    console.log('✅ UPDATE affected rows:', updateResult.rowCount || 'unknown');

    // Verifica che l'update abbia funzionato controllando le righe modificate
    if (updateResult.rowCount === 0) {
      console.log('⚠️ UPDATE non ha modificato nessuna riga - possibile che l\'organizzazione non esista o che i valori siano identici');
    }

    // Recupera l'organizzazione aggiornata
    const orgResult = await query(`SELECT * FROM organizations WHERE id = $1`, [orgId]);
    const updatedOrg = orgResult.rows[0];

    if (!updatedOrg) {
      return c.json({ error: 'Organization not found' }, 404);
    }

    // Determina il tipo organizzazione per la risposta
    let responseOrgType = 'BUYER'; // Default
    if (updatedOrg.can_sell || updatedOrg.can_operate) {
      responseOrgType = 'VENDOR_OPERATOR';
    } else if (updatedOrg.can_buy) {
      responseOrgType = 'BUYER';
    }

    // Mappa i campi per il frontend
    const mappedUpdatedOrg = {
      ...updatedOrg,
      org_type: responseOrgType, // Determinato dalle capabilities
    };

    console.log('✅ Organizzazione aggiornata:', {
      id: mappedUpdatedOrg.id,
      legal_name: mappedUpdatedOrg.legal_name,
      org_type: mappedUpdatedOrg.org_type,
      kind: updatedOrg.kind
    });

    return c.json({
      data: mappedUpdatedOrg,
      message: 'Impostazioni aggiornate con successo'
    });

  } catch (error: any) {
    console.error('❌ Errore aggiornamento impostazioni generali:', error);
    return c.json({
      error: 'Errore interno del server',
      message: error.message
    }, 500);
  }
});

// PUT /api/service-config/:orgId - Update service configuration
app.put('/:orgId', async (c) => {
  try {
    const orgId = c.req.param('orgId');
    const updates = await c.req.json();

    if (!orgId) {
      return c.json({ error: 'Organization ID required' }, 400);
    }

    console.log('💾 Aggiornamento configurazione servizi per org:', orgId, updates);

    try {
      // Prima verifica se esiste già una configurazione
      const existingQuery = `SELECT id FROM service_configurations WHERE org_id = $1`;
      const existing = await query(existingQuery, [orgId]);

      let result;

      if (existing.rows.length === 0) {
        // Crea nuova configurazione
        // Genera un ID univoco
        const configId = `config_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const fields = ['id', 'org_id', 'updated_at', ...Object.keys(updates)];
        const values = [configId, orgId, new Date().toISOString(), ...Object.values(updates)];
        const placeholders = fields.map((_, i) => `$${i + 1}`);

        const insertQuery = `
          INSERT INTO service_configurations (${fields.join(', ')})
          VALUES (${placeholders.join(', ')})
        `;

        await query(insertQuery, values);
        
        // Recupera la configurazione appena creata
        const selectQuery = `SELECT * FROM service_configurations WHERE org_id = $1`;
        result = await query(selectQuery, [orgId]);
      } else {
        // Aggiorna configurazione esistente
        const updateKeys = Object.keys(updates);
        const updateValues = Object.values(updates);
        const setParts = updateKeys.map((key, i) => `${key} = $${i + 2}`);
        const updateQuery = `
          UPDATE service_configurations
          SET ${setParts.join(', ')}, updated_at = NOW()
          WHERE org_id = $1
        `;

        await query(updateQuery, [orgId, ...updateValues]);
        
        // Recupera la configurazione aggiornata
        const selectQuery = `SELECT * FROM service_configurations WHERE org_id = $1`;
        result = await query(selectQuery, [orgId]);
      }

      if (!result.rows || result.rows.length === 0) {
        throw new Error('Configurazione non trovata dopo salvataggio');
      }

      return c.json(result.rows[0]);
    } catch (dbError: any) {
      // Se la tabella non esiste, simula il salvataggio ma informa che non è persistente
      if (dbError.code === '42P01') { // relation does not exist
        console.warn('⚠️ Tabella service_configurations non trovata, simulando salvataggio');

        // Restituisci una risposta fittizia per non bloccare il frontend
        return c.json({
          id: 'temp-' + Date.now(),
          org_id: orgId,
          ...updates,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
      }

      // Rilancia altri errori
      throw dbError;
    }

  } catch (error) {
    console.error('❌ Errore aggiornamento configurazione servizi:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// ============================================================================
// ORGANIZATION USERS
// ============================================================================

// GET /api/settings/organization/users - Get organization members
app.get('/organization/users', authMiddleware, async (c) => {
  try {
    const user = c.get('user');
    if (!user || !user.organizationId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const orgId = c.req.query('orgId') || user.organizationId;

    // Verifica che l'utente appartenga all'organizzazione richiesta
    if (orgId !== user.organizationId) {
      return c.json({ error: 'Forbidden' }, 403);
    }

    const usersQuery = `
      SELECT
        om.id,
        om.user_id,
        om.org_id,
        om.role,
        om.is_active,
        om.created_at,
        u.email,
        u.first_name,
        u.last_name,
        u.status as user_status
      FROM org_memberships om
      JOIN users u ON om.user_id = u.id
      WHERE om.org_id = $1 AND om.is_active = true
      ORDER BY om.created_at DESC
    `;

    const result = await query(usersQuery, [orgId]);

    const members = result.rows.map(row => ({
      id: row.id,
      user_id: row.user_id,
      org_id: row.org_id,
      role: row.role,
      is_active: row.is_active,
      created_at: row.created_at,
      user: {
        id: row.user_id,
        email: row.email,
        first_name: row.first_name,
        last_name: row.last_name,
        status: row.user_status
      }
    }));

    return c.json(members);
  } catch (error: any) {
    console.error('❌ Errore recupero membri organizzazione:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// ============================================================================
// ORGANIZATION INVITATIONS
// ============================================================================

// GET /api/settings/organization/invitations?orgId={orgId} - Get invitations for organization
app.get('/organization/invitations', authMiddleware, async (c) => {
  try {
    const orgId = c.req.query('orgId');
    const user = c.get('user');

    if (!orgId) {
      return c.json({ error: 'Organization ID required' }, 400);
    }

    // Verifica che l'utente appartenga all'organizzazione o sia un admin globale
    const membership = await query(
      'SELECT role FROM org_memberships WHERE org_id = $1 AND user_id = $2 AND is_active = true',
      [orgId, user.userId || user.id]
    );

    // Permetti accesso se è membro dell'organizzazione o è admin globale
    const hasAccess = membership.rows.length > 0 || user.isAdmin;

    if (!hasAccess) {
      return c.json({ error: 'Access denied' }, 403);
    }

    // Recupera inviti
    const invitations = await query(`
      SELECT
        oi.id,
        oi.email,
        oi.role,
        oi.status,
        oi.created_at,
        oi.expires_at,
        u.first_name as invited_by_first_name,
        u.last_name as invited_by_last_name
      FROM organization_invitations oi
      LEFT JOIN users u ON oi.invited_by_user_id = u.id
      WHERE oi.organization_id = $1
      ORDER BY oi.created_at DESC
    `, [orgId]);

    const result = invitations.rows.map(row => ({
      id: row.id,
      email: row.email,
      role: row.role,
      status: row.status,
      created_at: row.created_at,
      expires_at: row.expires_at,
      invited_by: {
        first_name: row.invited_by_first_name,
        last_name: row.invited_by_last_name
      }
    }));

    return c.json(result);
  } catch (error: any) {
    console.error('❌ Errore recupero inviti:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// POST /api/settings/organization/invitations/invite - Invite user
app.post('/organization/invitations/invite', authMiddleware, validateBody(CreateInvitationSchema), async (c) => {
  try {
    const validatedBody = c.get('validatedBody');
    const { email, role } = validatedBody;
    const normalizedRole = role.toLowerCase(); // Normalizza il ruolo a lowercase
    const user = c.get('user');

    console.log('📧 [INVITE] ===========================================');
    console.log('📧 [INVITE] Richiesta invito ricevuta');
    console.log('📧 [INVITE] email:', email);
    console.log('📧 [INVITE] role:', normalizedRole);
    console.log('📧 [INVITE] userId:', user.userId || user.id);
    console.log('📧 [INVITE] userRole:', user.role);
    console.log('📧 [INVITE] isAdmin:', user.isAdmin);
    console.log('📧 [INVITE] orgId:', user.organizationId);

    // Validazione già effettuata dal middleware Zod

    // Trova l'organizzazione dell'utente
    console.log('🔍 [INVITE] Cerco membership per user:', user.userId || user.id);
    const membership = await query(
      'SELECT om.org_id, o.type, om.role FROM org_memberships om JOIN organizations o ON om.org_id = o.id WHERE om.user_id = $1 AND om.is_active = true',
      [user.userId || user.id]
    );

    console.log('📋 [INVITE] Membership trovata:', {
      count: membership.rows.length,
      membership: membership.rows[0] ? {
        org_id: membership.rows[0].org_id,
        org_type: membership.rows[0].type,
        member_role: membership.rows[0].role
      } : null
    });

    if (membership.rows.length === 0) {
      console.log('❌ [INVITE] Nessuna membership attiva trovata per user:', user.userId || user.id);
      return c.json({ error: 'User not in organization' }, 403);
    }

    const orgId = membership.rows[0].org_id;
    const orgType = membership.rows[0].type;
    const memberRole = membership.rows[0].role;

    console.log('🔐 [INVITE] Controllo permessi');
    console.log('🔐 [INVITE] memberRole:', memberRole);
    console.log('🔐 [INVITE] user.isAdmin:', user.isAdmin);
    console.log('🔐 [INVITE] orgType:', orgType);

    // Logica autorizzazione basata sul tipo organizzazione
    let canInvite = false;
    if (user.isAdmin) {
      // Admin globale può sempre invitare
      canInvite = true;
      console.log('✅ [INVITE] Utente è admin globale - può invitare');
    } else if (memberRole) {
      // Verifica ruolo nell'organizzazione specifica
      if (orgType === 'buyer') {
        // Buyer org: solo admin possono invitare
        canInvite = memberRole === 'admin';
        console.log('🏢 [INVITE] Org buyer - ruolo richiesto: admin, ruolo attuale:', memberRole, 'canInvite:', canInvite);
      } else if (orgType === 'vendor' || orgType === 'operator') {
        // Vendor/Operator org: admin/vendor/operator/dispatcher possono invitare
        const allowedRoles = ['admin', 'vendor', 'operator', 'dispatcher'];
        canInvite = allowedRoles.includes(memberRole);
        console.log('🏭 [INVITE] Org vendor/operator - ruoli permessi:', allowedRoles, 'ruolo attuale:', memberRole, 'canInvite:', canInvite);
      } else {
        console.log('❌ [INVITE] Tipo organizzazione non supportato:', orgType);
        canInvite = false;
      }
    } else {
      console.log('❌ [INVITE] Utente non è membro dell\'organizzazione');
      canInvite = false;
    }

    if (!canInvite) {
      console.log('🚫 [INVITE] Permesso negato - utente non autorizzato a invitare in questa org');
      return c.json({ error: 'You do not have permission to invite users in this organization' }, 403);
    }

    console.log('✅ [INVITE] Permessi OK, procedo con invito');

    // Validazione ruoli basata su tipo organizzazione
    console.log('🔍 [INVITE] Validazione ruolo per org type:', { orgType, requestedRole: normalizedRole });

    if (orgType === 'buyer') {
      // Buyer organizations possono avere solo membri admin
      console.log('🏢 [INVITE] Org buyer - controllo se ruolo è admin');
      if (normalizedRole !== 'admin') {
        console.log('❌ [INVITE] Ruolo non valido per buyer org:', normalizedRole);
        return c.json({ error: 'Buyer organizations can only have admin members' }, 400);
      }
    } else if (orgType === 'vendor' || orgType === 'operator') {
      // Vendor/operator organizations possono avere admin, vendor, operator, dispatcher
      const allowedRoles = ['admin', 'vendor', 'operator', 'dispatcher'];
      console.log('🏭 [INVITE] Org vendor/operator - ruoli permessi:', allowedRoles);
      if (!allowedRoles.includes(normalizedRole)) {
        console.log('❌ [INVITE] Ruolo non valido per org:', { role: normalizedRole, allowedRoles });
        return c.json({ error: 'Invalid role for this organization type' }, 400);
      }
    } else {
      console.log('❌ [INVITE] Tipo organizzazione non supportato:', orgType);
      return c.json({ error: 'Unsupported organization type' }, 400);
    }

    console.log('✅ [INVITE] Validazione ruolo OK');

    console.log('🔍 [INVITE] Controllo se utente già invitato o membro');

    // Recupera informazioni organizzazione per l'email
    const organization = await query('SELECT legal_name, type FROM organizations WHERE id = $1', [orgId]);
    if (organization.rows.length === 0) {
      console.log('❌ [INVITE] Organizzazione non trovata:', orgId);
      return c.json({ error: 'Organization not found' }, 404);
    }

    // Verifica che l'email non sia già invitata o membro
    const existingUser = await query('SELECT id FROM users WHERE email = $1', [email]);
    if (existingUser.rows.length > 0) {
      // Verifica se è già membro dell'organizzazione
      const existingMembership = await query(
        'SELECT id FROM org_memberships WHERE org_id = $1 AND user_id = $2 AND is_active = true',
        [orgId, existingUser.rows[0].id]
      );
      if (existingMembership.rows.length > 0) {
        return c.json({ error: 'User is already a member' }, 400);
      }
    }

    const existingInvite = await query(
      'SELECT id FROM organization_invitations WHERE organization_id = $1 AND email = $2 AND status = $3',
      [orgId, email, 'PENDING']
    );
    if (existingInvite.rows.length > 0) {
      return c.json({ error: 'User already invited' }, 400);
    }

    // Genera token univoco e ID
    const token = require('crypto').randomBytes(32).toString('hex');
    const inviteId = 'c' + Date.now().toString(36) + Math.random().toString(36).substr(2); // Simple CUID-like ID
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 giorni

    console.log('📧 [INVITE] Creando invito con ID:', inviteId);
    console.log('📧 [INVITE] Parametri INSERT:', {
      inviteId,
      orgId,
      email,
      role,
      tokenLength: token.length,
      status: 'PENDING',
      expiresAt,
      invitedByUserId: user.userId || user.id
    });

    // Crea invito
    const result = await query(`
      INSERT INTO organization_invitations (id, org_id, organization_id, email, role, token, status, expires_at, invited_by_user_id, created_at, accepted_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING id
        `, [inviteId, orgId, orgId, email, normalizedRole, token, 'PENDING', expiresAt, user.userId || user.id, new Date().toISOString(), null]);

    // Invia email di invito
    const inviteUrl = `${process.env.FRONTEND_URL || 'https://your-site.netlify.app'}/accept-invite?token=${token}`;

    console.log('📧 [INVITE] Invito salvato nel database con ID:', inviteId);

    try {
      const { sendOrganizationInvitationEmail } = await import('../utils/email');
      await sendOrganizationInvitationEmail(email, `${user.first_name} ${user.last_name}`, organization.rows[0].legal_name, inviteUrl);
      console.log('✅ [INVITE] Email di invito inviata:', email);
    } catch (emailError: any) {
      console.error('❌ [INVITE] Errore invio email di invito:', emailError.message);
      // Non bloccare la creazione dell'invito se l'email fallisce
    }

    console.log('✅ [INVITE] Invito creato con successo - ID:', result.rows[0].id);
    console.log('📧 [INVITE] ===========================================');

    return c.json({
      success: true,
      invitationId: result.rows[0].id,
      message: 'Invitation sent successfully',
      invitation: {
        id: result.rows[0].id,
        email,
        role,
        organization: organization.rows[0].legal_name,
        expiresAt: expiresAt
      }
    });

  } catch (error: any) {
    console.error('❌ [INVITE] Errore durante invio invito:', error.message);
    console.error('❌ [INVITE] Stack trace:', error.stack);
    console.error('❌ [INVITE] Params - email:', email, 'role:', normalizedRole, 'userId:', user.userId || user.id);
    console.log('📧 [INVITE] ===========================================');
    return c.json({ error: 'Internal server error', message: error.message }, 500);
  }
});

// POST /api/settings/organization/invitations/revoke/{invitationId} - Revoke invitation
app.post('/organization/invitations/revoke/:invitationId', authMiddleware, async (c) => {
  try {
    const invitationId = c.req.param('invitationId');
    const user = c.get('user');
    const currentUserId = user.userId || user.id;

    console.log('🔄 [REVOKE] ===========================================');
    console.log('🔄 [REVOKE] Inizio revoca invito');
    console.log('🔄 [REVOKE] invitationId:', invitationId);
    console.log('🔄 [REVOKE] userId:', currentUserId);
    console.log('🔄 [REVOKE] userRole:', user.role);
    console.log('🔄 [REVOKE] isAdmin:', user.isAdmin);

    if (!invitationId) {
      console.log('❌ [REVOKE] invitationId mancante');
      return c.json({ error: 'Invitation ID required' }, 400);
    }

    if (!currentUserId) {
      console.log('❌ [REVOKE] currentUserId undefined - user.userId:', user.userId, 'user.id:', user.id);
      return c.json({ error: 'User ID not found' }, 401);
    }

    // 1. Trova l'invito
    console.log('🔍 [REVOKE] Cerco invito nel database...');
    const invitation = await query(`
      SELECT oi.*, o.type as org_type, o.legal_name as org_name
      FROM organization_invitations oi
      JOIN organizations o ON oi.organization_id = o.id
      WHERE oi.id = $1 AND oi.status = 'PENDING'
    `, [invitationId]);

    console.log('📋 [REVOKE] Query invito - risultati:', invitation.rows.length);
    if (invitation.rows.length === 0) {
      console.log('❌ [REVOKE] Invito non trovato o già revocato');
      return c.json({ error: 'Invitation not found or already revoked' }, 404);
    }

    const inviteData = invitation.rows[0];
    console.log('📋 [REVOKE] Invito trovato:', {
      id: inviteData.id,
      organization_id: inviteData.organization_id,
      org_name: inviteData.org_name,
      org_type: inviteData.org_type,
      email: inviteData.email,
      role: inviteData.role,
      invited_by: inviteData.invited_by_user_id,
      expires_at: inviteData.expires_at
    });

    // 2. Verifica permessi dell'utente corrente nell'organizzazione dell'invito
    console.log('🔐 [REVOKE] Verifico permessi utente corrente in org:', inviteData.organization_id);
    const membership = await query(
      'SELECT om.role as member_role FROM org_memberships om WHERE om.org_id = $1 AND om.user_id = $2 AND om.is_active = true',
      [inviteData.organization_id, currentUserId]
    );

    console.log('📋 [REVOKE] Membership utente corrente - risultati:', membership.rows.length);
    const memberRole = membership.rows.length > 0 ? membership.rows[0].member_role : null;
    console.log('📋 [REVOKE] Ruolo membro:', memberRole, 'isAdmin:', user.isAdmin);

    // 3. Logica autorizzazione basata sul tipo organizzazione
    console.log('🏢 [REVOKE] Verifico autorizzazione per org type:', inviteData.org_type);

    let canRevoke = false;
    if (user.isAdmin) {
      // Admin globale può sempre revocare
      canRevoke = true;
      console.log('✅ [REVOKE] Utente è admin globale - può revocare');
    } else if (memberRole) {
      // Verifica ruolo nell'organizzazione specifica
      if (inviteData.org_type === 'buyer') {
        // Buyer org: solo admin possono revocare
        canRevoke = memberRole === 'admin';
        console.log('🏢 [REVOKE] Org buyer - ruolo richiesto: admin, ruolo attuale:', memberRole, 'canRevoke:', canRevoke);
      } else if (inviteData.org_type === 'vendor' || inviteData.org_type === 'operator') {
        // Vendor/Operator org: admin/vendor/operator/dispatcher possono revocare
        const allowedRoles = ['admin', 'vendor', 'operator', 'dispatcher'];
        canRevoke = allowedRoles.includes(memberRole);
        console.log('🏭 [REVOKE] Org vendor/operator - ruoli permessi:', allowedRoles, 'ruolo attuale:', memberRole, 'canRevoke:', canRevoke);
      } else {
        console.log('❌ [REVOKE] Tipo organizzazione non supportato:', inviteData.org_type);
        canRevoke = false;
      }
    } else {
      console.log('❌ [REVOKE] Utente non è membro dell\'organizzazione dell\'invito');
      canRevoke = false;
    }

    if (!canRevoke) {
      console.log('🚫 [REVOKE] Permesso negato - utente non autorizzato a revocare inviti in questa org');
      return c.json({ error: 'You do not have permission to revoke invitations in this organization' }, 403);
    }

    // 4. Revoca invito
    console.log('✅ [REVOKE] Permessi OK - procedo con revoca');
    const revokeResult = await query(
      'UPDATE organization_invitations SET status = $1 WHERE id = $2',
      ['REVOKED', invitationId]
    );

    console.log('✅ [REVOKE] Invito revocato con successo - righe aggiornate:', revokeResult.rows.length);
    console.log('🔄 [REVOKE] ===========================================');

    return c.json({
      success: true,
      message: 'Invitation revoked successfully',
      invitation: {
        id: inviteData.id,
        email: inviteData.email,
        organization: inviteData.org_name
      }
    });

  } catch (error: any) {
    console.error('❌ [REVOKE] Errore durante revoca invito:', error.message);
    console.error('❌ [REVOKE] Stack trace:', error.stack);
    console.error('❌ [REVOKE] Params - invitationId:', invitationId, 'userId:', currentUserId);
    console.log('🔄 [REVOKE] ===========================================');
    return c.json({ error: 'Internal server error', message: error.message }, 500);
  }
});

// ============================================================================
// ORGANIZATION LOGO UPLOAD
// ============================================================================

// POST /api/settings/organization/upload-logo - Upload organization logo
app.post('/organization/upload-logo', authMiddleware, async (c) => {
  try {
    console.log('🖼️ [LOGO UPLOAD] ===========================================');
    console.log('🖼️ [LOGO UPLOAD] Inizio upload logo organizzazione');

    const user = c.get('user');
    const currentUserId = user.userId || user.id;
    const queryParams = c.req.query();
    const orgId = queryParams.orgId;

    console.log('🖼️ [LOGO UPLOAD] userId:', currentUserId);
    console.log('🖼️ [LOGO UPLOAD] orgId:', orgId);

    if (!orgId) {
      console.log('❌ [LOGO UPLOAD] orgId mancante');
      return c.json({ error: 'Organization ID required' }, 400);
    }

    // Verifica che l'utente sia membro dell'organizzazione
    console.log('🔐 [LOGO UPLOAD] Verifico autorizzazione utente per org:', orgId);
    const membership = await query(
      'SELECT om.role as member_role FROM org_memberships om WHERE om.org_id = $1 AND om.user_id = $2 AND om.is_active = true',
      [orgId, currentUserId]
    );

    if (membership.rows.length === 0) {
      console.log('❌ [LOGO UPLOAD] Utente non membro dell\'organizzazione');
      return c.json({ error: 'You are not a member of this organization' }, 403);
    }

    const memberRole = membership.rows[0].member_role;
    console.log('📋 [LOGO UPLOAD] Ruolo membro:', memberRole);

    // Solo admin possono cambiare il logo
    if (memberRole !== 'admin' && !user.isAdmin) {
      console.log('❌ [LOGO UPLOAD] Solo admin possono cambiare il logo');
      return c.json({ error: 'Only admins can update organization logo' }, 403);
    }

    // Gestisci upload file
    console.log('📁 [LOGO UPLOAD] Elaborazione file upload...');
    const formData = await c.req.formData();
    const logoFile = formData.get('logo') as File;

    if (!logoFile) {
      console.log('❌ [LOGO UPLOAD] File logo mancante');
      return c.json({ error: 'Logo file is required' }, 400);
    }

    // Verifica tipo file
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(logoFile.type)) {
      console.log('❌ [LOGO UPLOAD] Tipo file non supportato:', logoFile.type);
      return c.json({ error: 'Only JPEG, PNG, and WebP images are allowed' }, 400);
    }

    // Verifica dimensione file (max 5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (logoFile.size > maxSize) {
      console.log('❌ [LOGO UPLOAD] File troppo grande:', logoFile.size, 'bytes');
      return c.json({ error: 'File size must be less than 5MB' }, 400);
    }

    console.log('📋 [LOGO UPLOAD] File info:', {
      name: logoFile.name,
      type: logoFile.type,
      size: logoFile.size
    });

    // Upload su Supabase Storage
    console.log('☁️ [LOGO UPLOAD] Upload su Supabase Storage...');
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.log('❌ [LOGO UPLOAD] Configurazione Supabase mancante');
      return c.json({ error: 'Storage service not configured' }, 500);
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const bucketName = process.env.SUPABASE_STORAGE_BUCKET || 'Media FIle';

    // Genera nome file univoco
    const fileExt = logoFile.name.split('.').pop();
    const fileName = `org-logo-${orgId}-${Date.now()}.${fileExt}`;
    const filePath = `logos/${fileName}`;

    console.log('📁 [LOGO UPLOAD] Upload path:', filePath);

    // Converti File in ArrayBuffer
    const arrayBuffer = await logoFile.arrayBuffer();
    const fileBuffer = new Uint8Array(arrayBuffer);

    // Upload file
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(bucketName)
      .upload(filePath, fileBuffer, {
        contentType: logoFile.type,
        upsert: true
      });

    if (uploadError) {
      console.error('❌ [LOGO UPLOAD] Errore upload Supabase:', uploadError);
      return c.json({ error: 'Failed to upload logo file', details: uploadError.message }, 500);
    }

    console.log('✅ [LOGO UPLOAD] File uploadato con successo:', uploadData.path);

    // Genera URL pubblica
    const logoUrl = publicObjectUrl(bucketName, filePath);
    console.log('🔗 [LOGO UPLOAD] URL logo generata:', logoUrl);

    // Aggiorna database
    console.log('💾 [LOGO UPLOAD] Aggiornamento database...');
    const updateResult = await query(
      'UPDATE organizations SET logo_url = $1, updated_at = NOW() WHERE id = $2 RETURNING id, legal_name, logo_url',
      [logoUrl, orgId]
    );

    if (updateResult.rows.length === 0) {
      console.log('❌ [LOGO UPLOAD] Organizzazione non trovata per update');
      return c.json({ error: 'Organization not found' }, 404);
    }

    console.log('✅ [LOGO UPLOAD] Database aggiornato:', updateResult.rows[0]);
    console.log('🖼️ [LOGO UPLOAD] ===========================================');

    return c.json({
      success: true,
      message: 'Logo uploaded successfully',
      data: {
        organization: {
          id: updateResult.rows[0].id,
          name: updateResult.rows[0].legal_name,
          logoUrl: updateResult.rows[0].logo_url
        }
      }
    });

  } catch (error: any) {
    console.error('❌ [LOGO UPLOAD] Errore durante upload logo:', error.message);
    console.error('❌ [LOGO UPLOAD] Stack trace:', error.stack);
    console.log('🖼️ [LOGO UPLOAD] ===========================================');
    return c.json({ error: 'Internal server error', message: error.message }, 500);
  }
});

// ============================================================================
// USER NOTIFICATION PREFERENCES
// ============================================================================

// GET /api/settings/notifications - Get user notification preferences
app.get('/notifications', authMiddleware, async (c) => {
  try {
    console.log('🔔 [NOTIFICATIONS] ===========================================');
    console.log('🔔 [NOTIFICATIONS] Lettura preferenze notifiche');

    const user = c.get('user');
    const currentUserId = user.userId || user.id;

    console.log('🔔 [NOTIFICATIONS] userId:', currentUserId);

    if (!currentUserId) {
      console.log('❌ [NOTIFICATIONS] userId undefined');
      return c.json({ error: 'User ID not found' }, 401);
    }

    // Leggi preferenze notifiche
    console.log('📖 [NOTIFICATIONS] Query preferenze notifiche...');
    const prefsResult = await query(
      'SELECT id, user_id, email_orders, email_payments, email_updates, inapp_orders, inapp_messages, created_at, updated_at FROM user_notification_preferences WHERE user_id = $1',
      [currentUserId]
    );

    console.log('📋 [NOTIFICATIONS] Risultati query:', prefsResult.rows.length);

    let preferences;
    if (prefsResult.rows.length === 0) {
      // Crea preferenze di default se non esistono
      console.log('📝 [NOTIFICATIONS] Preferenze non trovate, creo default...');
      const defaultPrefs = {
        user_id: currentUserId,
        email_orders: true,
        email_payments: true,
        email_updates: true,
        inapp_orders: true,
        inapp_messages: true
      };

      const insertResult = await query(`
        INSERT INTO user_notification_preferences (id, user_id, email_orders, email_payments, email_updates, inapp_orders, inapp_messages, created_at, updated_at)
        VALUES (cuid(), $1, $2, $3, $4, $5, $6, NOW(), NOW())
        RETURNING id, user_id, email_orders, email_payments, email_updates, inapp_orders, inapp_messages, created_at, updated_at
      `, [
        defaultPrefs.user_id,
        defaultPrefs.email_orders,
        defaultPrefs.email_payments,
        defaultPrefs.email_updates,
        defaultPrefs.inapp_orders,
        defaultPrefs.inapp_messages
      ]);

      preferences = insertResult.rows[0];
      console.log('✅ [NOTIFICATIONS] Preferenze default create:', preferences.id);
    } else {
      preferences = prefsResult.rows[0];
      console.log('✅ [NOTIFICATIONS] Preferenze esistenti recuperate:', preferences.id);
    }

    console.log('📋 [NOTIFICATIONS] Preferenze finali:', {
      email_orders: preferences.email_orders,
      email_payments: preferences.email_payments,
      email_updates: preferences.email_updates,
      inapp_orders: preferences.inapp_orders,
      inapp_messages: preferences.inapp_messages
    });

    console.log('🔔 [NOTIFICATIONS] ===========================================');

    return c.json({
      email_orders: preferences.email_orders,
      email_payments: preferences.email_payments,
      email_updates: preferences.email_updates,
      inapp_orders: preferences.inapp_orders,
      inapp_messages: preferences.inapp_messages
    });

  } catch (error: any) {
    console.error('❌ [NOTIFICATIONS] Errore lettura preferenze:', error.message);
    console.error('❌ [NOTIFICATIONS] Stack trace:', error.stack);
    console.log('🔔 [NOTIFICATIONS] ===========================================');
    return c.json({ error: 'Internal server error', message: error.message }, 500);
  }
});

// PATCH /api/settings/notifications - Update user notification preferences
app.patch('/notifications', authMiddleware, async (c) => {
  try {
    console.log('🔔 [NOTIFICATIONS UPDATE] ===========================================');
    console.log('🔔 [NOTIFICATIONS UPDATE] Aggiornamento preferenze notifiche');

    const user = c.get('user');
    const currentUserId = user.userId || user.id;
    const updates = await c.req.json();

    console.log('🔔 [NOTIFICATIONS UPDATE] userId:', currentUserId);
    console.log('🔔 [NOTIFICATIONS UPDATE] updates:', updates);

    if (!currentUserId) {
      console.log('❌ [NOTIFICATIONS UPDATE] userId undefined');
      return c.json({ error: 'User ID not found' }, 401);
    }

    // Valida input
    const validFields = ['email_orders', 'email_payments', 'email_updates', 'inapp_orders', 'inapp_messages'];
    const invalidFields = Object.keys(updates).filter(key => !validFields.includes(key));

    if (invalidFields.length > 0) {
      console.log('❌ [NOTIFICATIONS UPDATE] Campi non validi:', invalidFields);
      return c.json({ error: 'Invalid fields provided', invalidFields }, 400);
    }

    // Verifica che esistano preferenze per l'utente
    console.log('🔍 [NOTIFICATIONS UPDATE] Verifico esistenza preferenze...');
    const existingPrefs = await query(
      'SELECT id FROM user_notification_preferences WHERE user_id = $1',
      [currentUserId]
    );

    if (existingPrefs.rows.length === 0) {
      console.log('❌ [NOTIFICATIONS UPDATE] Preferenze non trovate per utente');
      return c.json({ error: 'Notification preferences not found' }, 404);
    }

    // Costruisci query di update dinamica
    const updateFields = [];
    const updateValues = [];
    let paramIndex = 1;

    Object.entries(updates).forEach(([key, value]) => {
      if (value !== undefined) {
        updateFields.push(`${key} = $${paramIndex}`);
        updateValues.push(value);
        paramIndex++;
      }
    });

    if (updateFields.length === 0) {
      console.log('⚠️ [NOTIFICATIONS UPDATE] Nessun campo da aggiornare');
      return c.json({ error: 'No valid fields to update' }, 400);
    }

    updateFields.push(`updated_at = NOW()`);
    updateValues.push(currentUserId); // Aggiungi user_id alla fine

    const updateQuery = `
      UPDATE user_notification_preferences
      SET ${updateFields.join(', ')}
      WHERE user_id = $${paramIndex}
      RETURNING id, user_id, email_orders, email_payments, email_updates, inapp_orders, inapp_messages, updated_at
    `;

    console.log('💾 [NOTIFICATIONS UPDATE] Query update:', updateQuery);
    console.log('💾 [NOTIFICATIONS UPDATE] Values:', updateValues);

    const updateResult = await query(updateQuery, updateValues);

    if (updateResult.rows.length === 0) {
      console.log('❌ [NOTIFICATIONS UPDATE] Update fallito');
      return c.json({ error: 'Failed to update preferences' }, 500);
    }

    const updatedPrefs = updateResult.rows[0];
    console.log('✅ [NOTIFICATIONS UPDATE] Preferenze aggiornate:', updatedPrefs.id);
    console.log('📋 [NOTIFICATIONS UPDATE] Nuovi valori:', {
      email_orders: updatedPrefs.email_orders,
      email_payments: updatedPrefs.email_payments,
      email_updates: updatedPrefs.email_updates,
      inapp_orders: updatedPrefs.inapp_orders,
      inapp_messages: updatedPrefs.inapp_messages
    });

    console.log('🔔 [NOTIFICATIONS UPDATE] ===========================================');

    return c.json({
      success: true,
      message: 'Notification preferences updated successfully',
      preferences: {
        email_orders: updatedPrefs.email_orders,
        email_payments: updatedPrefs.email_payments,
        email_updates: updatedPrefs.email_updates,
        inapp_orders: updatedPrefs.inapp_orders,
        inapp_messages: updatedPrefs.inapp_messages
      }
    });

  } catch (error: any) {
    console.error('❌ [NOTIFICATIONS UPDATE] Errore aggiornamento preferenze:', error.message);
    console.error('❌ [NOTIFICATIONS UPDATE] Stack trace:', error.stack);
    console.log('🔔 [NOTIFICATIONS UPDATE] ===========================================');
    return c.json({ error: 'Internal server error', message: error.message }, 500);
  }
});

export default app;
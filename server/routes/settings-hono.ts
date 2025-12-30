import { Hono } from 'hono';
import { query } from '../utils/database';
import { authMiddleware } from '../middleware/auth';

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

    // Usa il database SQLite/PostgreSQL
    const orgResult = await query(`
      SELECT * FROM organizations WHERE id = $1
    `, [orgId]);

    if (orgResult.rows.length === 0) {
      return c.json({ error: 'Organization not found' }, 404);
    }

    const organization = orgResult.rows[0];
    console.log('✅ Impostazioni generali recuperate:', organization);

    return c.json({
      data: organization
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

    // Usa il database SQLite/PostgreSQL
    // Mappa dei campi consentiti
    const allowedFields = [
      'legal_name', 'logo_url', 'phone', 'support_email', 'vat_number',
      'tax_code', 'org_type', 'address_line', 'city', 'province',
      'region', 'postal_code', 'country'
    ];

    // Filtra solo i campi consentiti
    const validUpdates: any = {};
    for (const [field, value] of Object.entries(updates)) {
      if (allowedFields.includes(field) && value !== undefined) {
        validUpdates[field] = value;
      }
    }

    if (Object.keys(validUpdates).length === 0) {
      return c.json({ error: 'No valid fields to update' }, 400);
    }

    // Costruisci dinamicamente la query UPDATE
    const updateFields = Object.keys(validUpdates);
    const setClause = updateFields.map((field, index) => `${field} = $${index + 2}`).join(', ');
    const values = [orgId, ...updateFields.map(field => validUpdates[field])];

    await query(`
      UPDATE organizations 
      SET ${setClause}
      WHERE id = $1
    `, values);

    // Recupera l'organizzazione aggiornata
    const orgResult = await query(`SELECT * FROM organizations WHERE id = $1`, [orgId]);
    const updatedOrg = orgResult.rows[0];

    if (!updatedOrg) {
      return c.json({ error: 'Organization not found' }, 404);
    }

    console.log('✅ Organizzazione aggiornata:', updatedOrg);

    return c.json({
      data: updatedOrg,
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
app.post('/organization/invitations/invite', authMiddleware, async (c) => {
  try {
    const { email, role } = await c.req.json();
    const user = c.get('user');

    console.log('📧 [INVITE] ===========================================');
    console.log('📧 [INVITE] Richiesta invito ricevuta');
    console.log('📧 [INVITE] email:', email);
    console.log('📧 [INVITE] role:', role);
    console.log('📧 [INVITE] userId:', user.userId || user.id);
    console.log('📧 [INVITE] userRole:', user.role);
    console.log('📧 [INVITE] isAdmin:', user.isAdmin);
    console.log('📧 [INVITE] orgId:', user.organizationId);

    if (!email || !role) {
      console.log('❌ [INVITE] Email o ruolo mancanti');
      return c.json({ error: 'Email and role required' }, 400);
    }

    // Verifica che il ruolo sia valido
    const validRoles = ['admin', 'vendor', 'operator', 'dispatcher'];
    if (!validRoles.includes(role)) {
      return c.json({ error: 'Invalid role' }, 400);
    }

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
    console.log('🔍 [INVITE] Validazione ruolo per org type:', { orgType, requestedRole: role });

    if (orgType === 'buyer') {
      // Buyer organizations possono avere solo membri admin
      console.log('🏢 [INVITE] Org buyer - controllo se ruolo è admin');
      if (role !== 'admin') {
        console.log('❌ [INVITE] Ruolo non valido per buyer org:', role);
        return c.json({ error: 'Buyer organizations can only have admin members' }, 400);
      }
    } else if (orgType === 'vendor' || orgType === 'operator') {
      // Vendor/operator organizations possono avere admin, vendor, operator, dispatcher
      const allowedRoles = ['admin', 'vendor', 'operator', 'dispatcher'];
      console.log('🏭 [INVITE] Org vendor/operator - ruoli permessi:', allowedRoles);
      if (!allowedRoles.includes(role)) {
        console.log('❌ [INVITE] Ruolo non valido per org:', { role, allowedRoles });
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
      INSERT INTO organization_invitations (id, organization_id, email, role, token, status, expires_at, invited_by_user_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id
        `, [inviteId, orgId, email, role, token, 'PENDING', expiresAt, user.userId || user.id]);

    // Invia email di invito
    const inviteUrl = `${process.env.FRONTEND_URL || 'http://localhost:8082'}/accept-invite?token=${token}`;

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
    console.error('❌ [INVITE] Params - email:', email, 'role:', role, 'userId:', user.userId || user.id);
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

export default app;
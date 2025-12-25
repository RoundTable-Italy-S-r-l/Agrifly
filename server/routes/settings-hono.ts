import { Hono } from 'hono';
import { query } from '../utils/database';
import { createClient } from '@supabase/supabase-js';

const app = new Hono();

// ============================================================================
// ORGANIZATION GENERAL SETTINGS
// ============================================================================

// GET /settings/organization/general - Ottieni impostazioni generali organizzazione
app.get('/organization/general', async (c) => {
  try {
    // Ottieni l'ID dell'organizzazione dal parametro query (più semplice e affidabile)
    const organizationId = c.req.query('orgId');

    if (!organizationId) {
      return c.json({ error: 'Organization ID mancante. Usa ?orgId=...' }, 400);
    }

    console.log('📋 Richiesta impostazioni generali per org:', organizationId);

    // Query per ottenere i dati dell'organizzazione
    const result = await query(`
      SELECT
        id,
        legal_name,
        logo_url,
        vat_number,
        tax_code,
        org_type,
        address_line,
        city,
        province,
        region,
        country,
        phone,
        support_email,
        postal_code
      FROM organizations
      WHERE id = $1 AND status = 'ACTIVE'
      LIMIT 1
    `, [organizationId]);

    if (result.rows.length === 0) {
      return c.json({ error: 'Organizzazione non trovata' }, 404);
    }

    const org = result.rows[0];
    console.log('✅ Impostazioni generali recuperate per:', org.legal_name);

    return c.json(org);

  } catch (error: any) {
    console.error('❌ Errore get organization general:', error);
    return c.json({
      error: 'Errore interno',
      message: error.message
    }, 500);
  }
});

// PATCH /settings/organization/general - Aggiorna impostazioni generali organizzazione
app.patch('/organization/general', async (c) => {
  try {
    // Ottieni l'ID dell'organizzazione dal parametro query
    const organizationId = c.req.query('orgId');

    if (!organizationId) {
      return c.json({ error: 'Organization ID mancante. Usa ?orgId=...' }, 400);
    }

    const body = await c.req.json();
    console.log('📝 Aggiornamento impostazioni generali per org:', organizationId, body);

    // Costruisci la query di update dinamicamente
    const updateFields = [];
    const values = [];
    let paramIndex = 1;

    // Logo viene gestito separatamente tramite upload-logo endpoint
    const allowedFields = [
      'legal_name', 'vat_number', 'tax_code', 'org_type',
      'address_line', 'city', 'province', 'region', 'country',
      'phone', 'support_email', 'postal_code'
      // 'logo_url' escluso - gestito da upload-logo endpoint
    ];

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateFields.push(`${field} = $${paramIndex}`);
        values.push(body[field]);
        paramIndex++;
      }
    }

    if (updateFields.length === 0) {
      return c.json({ error: 'Nessun campo da aggiornare' }, 400);
    }

    // Aggiungi organizationId come ultimo parametro
    values.push(organizationId);

    const updateQuery = `
      UPDATE organizations
      SET ${updateFields.join(', ')}, updated_at = NOW()
      WHERE id = $${paramIndex} AND status = 'ACTIVE'
      RETURNING *
    `;

    const result = await query(updateQuery, values);

    if (result.rows.length === 0) {
      return c.json({ error: 'Organizzazione non trovata o non aggiornata' }, 404);
    }

    console.log('✅ Impostazioni generali aggiornate per:', result.rows[0].legal_name);

    return c.json({
      data: result.rows[0],
      message: 'Impostazioni aggiornate con successo'
    });

  } catch (error: any) {
    console.error('❌ Errore update organization general:', error);
    return c.json({
      error: 'Errore interno',
      message: error.message
    }, 500);
  }
});

// ============================================================================
// ORGANIZATION USERS
// ============================================================================

// GET /settings/organization/users - Ottieni membri dell'organizzazione
app.get('/organization/users', async (c) => {
  try {
    const organizationId = c.req.query('orgId');

    if (!organizationId) {
      return c.json({ error: 'Organization ID mancante. Usa ?orgId=...' }, 400);
    }

    console.log('👥 Richiesta membri organizzazione:', organizationId);

    // Query per ottenere membri dell'organizzazione
    const result = await query(`
      SELECT
        om.id,
        om.role,
        om.is_active,
        om.created_at,
        u.id as user_id,
        u.email,
        u.first_name,
        u.last_name,
        u.email_verified,
        CASE
          WHEN u.first_name = '' OR u.first_name IS NULL OR u.last_name = '' OR u.last_name IS NULL THEN 'INTERNAL_MEMBER'
          ELSE 'FULL_ACCOUNT'
        END as member_type,
        CASE
          WHEN u.first_name = '' OR u.first_name IS NULL OR u.last_name = '' OR u.last_name IS NULL THEN 'internal'
          ELSE 'user'
        END as member_source
      FROM org_memberships om
      JOIN users u ON om.user_id = u.id
      WHERE om.org_id = $1 AND om.is_active = true AND u.status = 'ACTIVE'
      ORDER BY om.created_at DESC
    `, [organizationId]);

    const allMembers = result.rows;

    console.log('✅ Membri organizzazione recuperati:', allMembers.length);

    return c.json(result.rows);

  } catch (error: any) {
    console.error('❌ Errore get organization users:', error);
    return c.json({
      error: 'Errore interno',
      message: error.message
    }, 500);
  }
});

// ============================================================================
// ORGANIZATION INVITATIONS
// ============================================================================

// GET /settings/organization/invitations - Ottieni inviti pendenti
app.get('/organization/invitations', async (c) => {
  try {
    const organizationId = c.req.query('orgId');

    if (!organizationId) {
      return c.json({ error: 'Organization ID mancante. Usa ?orgId=...' }, 400);
    }

    console.log('📧 Richiesta inviti organizzazione:', organizationId);

    // Query per ottenere inviti pendenti (non accettati e non scaduti)
    const result = await query(`
      SELECT
        oi.id,
        oi.email,
        oi.role,
        CASE
          WHEN oi.accepted_at IS NOT NULL THEN 'ACCEPTED'
          WHEN oi.expires_at < NOW() THEN 'EXPIRED'
          ELSE 'PENDING'
        END as status,
        oi.created_at,
        oi.expires_at,
        oi.invited_by_user_id
      FROM organization_invitations oi
      WHERE oi.organization_id = $1 AND oi.accepted_at IS NULL AND oi.expires_at > NOW()
      ORDER BY oi.created_at DESC
    `, [organizationId]);

    console.log('✅ Inviti pendenti recuperati:', result.rows.length);

    return c.json(result.rows);

  } catch (error: any) {
    console.error('❌ Errore get organization invitations:', error);
    return c.json({
      error: 'Errore interno',
      message: error.message
    }, 500);
  }
});

// POST /settings/organization/invitations/invite - Invia invito
app.post('/organization/invitations/invite', async (c) => {
  try {
    const organizationId = c.req.query('orgId');

    if (!organizationId) {
      return c.json({ error: 'Organization ID mancante. Usa ?orgId=...' }, 400);
    }

    // Per ora prendiamo currentUserId dal localStorage o da un altro modo
    // In produzione dovremmo avere un modo migliore per identificare l'utente corrente
    const currentUserId = 'current-user-id'; // TODO: implementare correttamente

    const body = await c.req.json();
    const { email, role } = body;

    if (!email || !role) {
      return c.json({ error: 'Email e ruolo obbligatori' }, 400);
    }

    console.log('📧 Invito utente:', email, 'ruolo:', role, 'org:', organizationId);

    // Verifica se l'utente ha i permessi per invitare
    const membershipResult = await query(
      'SELECT role FROM org_memberships WHERE organization_id = $1 AND user_id = $2 AND status = $3',
      [organizationId, currentUserId, 'ACTIVE']
    );

    if (membershipResult.rows.length === 0) {
      return c.json({ error: 'Non sei membro di questa organizzazione' }, 403);
    }

    const userRole = membershipResult.rows[0].role;
    if (!userRole.includes('ADMIN')) {
      return c.json({ error: 'Solo gli amministratori possono invitare utenti' }, 403);
    }

    // Verifica se l'invito già esiste
    const existingInvite = await query(
      'SELECT id FROM organization_invitations WHERE organization_id = $1 AND email = $2 AND status = $3',
      [organizationId, email, 'PENDING']
    );

    if (existingInvite.rows.length > 0) {
      return c.json({ error: 'Invito già esistente per questa email' }, 400);
    }

    // Verifica se l'utente è già membro
    const existingUser = await query(`
      SELECT u.id FROM users u
      JOIN org_memberships om ON u.id = om.user_id
      WHERE u.email = $1 AND om.organization_id = $2 AND om.status = $3
    `, [email, organizationId, 'ACTIVE']);

    if (existingUser.rows.length > 0) {
      return c.json({ error: 'Utente già membro dell\'organizzazione' }, 400);
    }

    // Crea l'invito
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 giorni

    const result = await query(`
      INSERT INTO organization_invitations (organization_id, email, role, invited_by_user_id, expires_at)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, email, role, created_at
    `, [organizationId, email, role, currentUserId, expiresAt]);

    console.log('✅ Invito creato:', result.rows[0]);

    return c.json({
      data: result.rows[0],
      message: 'Invito inviato con successo'
    });

  } catch (error: any) {
    console.error('❌ Errore create invitation:', error);
    return c.json({
      error: 'Errore interno',
      message: error.message
    }, 500);
  }
});

// POST /settings/organization/invitations/revoke/:id - Revoca invito
app.post('/organization/invitations/revoke/:id', async (c) => {
  try {
    const organizationId = c.req.query('orgId');
    const invitationId = c.req.param('id');

    if (!organizationId || !invitationId) {
      return c.json({ error: 'Organization ID mancante. Usa ?orgId=...' }, 400);
    }

    console.log('🚫 Revoca invito:', invitationId, 'org:', organizationId);

    // Aggiorna lo status dell'invito
    const result = await query(`
      UPDATE organization_invitations
      SET status = 'REVOKED', updated_at = NOW()
      WHERE id = $1 AND organization_id = $2 AND status = 'PENDING'
      RETURNING id, email, status
    `, [invitationId, organizationId]);

    if (result.rows.length === 0) {
      return c.json({ error: 'Invito non trovato o già revocato' }, 404);
    }

    console.log('✅ Invito revocato:', result.rows[0]);

    return c.json({
      data: result.rows[0],
      message: 'Invito revocato con successo'
    });

  } catch (error: any) {
    console.error('❌ Errore revoke invitation:', error);
    return c.json({
      error: 'Errore interno',
      message: error.message
    }, 500);
  }
});

// ============================================================================
// NOTIFICATIONS SETTINGS
// ============================================================================

// GET /settings/notifications - Ottieni preferenze notifiche utente
app.get('/notifications', async (c) => {
  try {
    // Per ora usiamo un approccio semplificato - prendiamo userId dal query param
    // TODO: Implementare autenticazione JWT corretta
    const userId = c.req.query('userId') || 'dummy-user-id';

    if (!userId) {
      return c.json({ error: 'User ID mancante nel token' }, 401);
    }

    console.log('🔔 Richiesta preferenze notifiche per user:', userId);

    // Ottieni preferenze notifiche
    const result = await query(`
      SELECT
        email_orders,
        email_payments,
        email_updates,
        inapp_orders,
        inapp_messages
      FROM user_notification_preferences
      WHERE user_id = $1
      LIMIT 1
    `, [userId]);

    // Se non esistono preferenze, restituisci valori di default
    const preferences = result.rows.length > 0 ? result.rows[0] : {
      email_orders: true,
      email_payments: true,
      email_updates: false,
      inapp_orders: true,
      inapp_messages: true
    };

    console.log('✅ Preferenze notifiche recuperate');

    return c.json(preferences);

  } catch (error: any) {
    console.error('❌ Errore get notifications:', error);
    return c.json({
      error: 'Errore interno',
      message: error.message
    }, 500);
  }
});

// PATCH /settings/notifications - Aggiorna preferenze notifiche utente
app.patch('/notifications', async (c) => {
  try {
    const authHeader = c.req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json({ error: 'Token mancante' }, 401);
    }

    const payload = JSON.parse(atob(authHeader.split('.')[1]));
    const userId = payload.sub;

    if (!userId) {
      return c.json({ error: 'User ID mancante nel token' }, 401);
    }

    const body = await c.req.json();
    console.log('📝 Aggiornamento preferenze notifiche per user:', userId, body);

    // Costruisci la query di upsert
    const upsertQuery = `
      INSERT INTO user_notification_preferences (
        user_id, email_orders, email_payments, email_updates, inapp_orders, inapp_messages
      ) VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (user_id) DO UPDATE SET
        email_orders = EXCLUDED.email_orders,
        email_payments = EXCLUDED.email_payments,
        email_updates = EXCLUDED.email_updates,
        inapp_orders = EXCLUDED.inapp_orders,
        inapp_messages = EXCLUDED.inapp_messages,
        updated_at = NOW()
      RETURNING *
    `;

    const result = await query(upsertQuery, [
      userId,
      body.email_orders ?? true,
      body.email_payments ?? true,
      body.email_updates ?? false,
      body.inapp_orders ?? true,
      body.inapp_messages ?? true
    ]);

    console.log('✅ Preferenze notifiche aggiornate');

    return c.json({
      data: result.rows[0],
      message: 'Preferenze notifiche aggiornate con successo'
    });

  } catch (error: any) {
    console.error('❌ Errore update notifications:', error);
    return c.json({
      error: 'Errore interno',
      message: error.message
    }, 500);
  }
});

// ============================================================================
// UPLOAD LOGO ORGANIZZAZIONE
// ============================================================================

app.post('/organization/upload-logo', async (c) => {
  try {
    // Ottieni l'ID dell'organizzazione dal parametro query
    const organizationId = c.req.query('orgId');

    if (!organizationId) {
      return c.json({ error: 'Organization ID mancante. Usa ?orgId=...' }, 400);
    }

    console.log('📤 Upload logo per organizzazione:', organizationId);

    // Ottieni il file dal form data
    const formData = await c.req.formData();
    const file = formData.get('logo') as File;

    if (!file) {
      return c.json({ error: 'Nessun file fornito' }, 400);
    }

    // Verifica che sia un'immagine PNG o JPEG
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg'];
    if (!allowedTypes.includes(file.type)) {
      return c.json({ error: 'Solo file PNG e JPEG sono supportati' }, 400);
    }

    // Verifica dimensione file (max 2MB)
    const maxSize = 2 * 1024 * 1024; // 2MB
    if (file.size > maxSize) {
      return c.json({ error: 'File troppo grande. Massimo 2MB' }, 400);
    }

    // Inizializza Supabase client
    const supabaseUrl = process.env.SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const bucketName = 'Media FIle'; // Hardcoded per test
    console.log('🔧 Bucket name:', bucketName);
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Genera nome file univoco
    const fileExt = file.type === 'image/png' ? 'png' : 'jpg';
    const fileName = `org-logos/${organizationId}/logo-${Date.now()}.${fileExt}`;

    // Converti il file in ArrayBuffer
    const fileBuffer = await file.arrayBuffer();
    const fileUint8 = new Uint8Array(fileBuffer);

    // Upload su Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(bucketName)
      .upload(fileName, fileUint8, {
        contentType: file.type,
        upsert: true
      });

    if (uploadError) {
      console.error('❌ Errore upload Supabase:', uploadError);
      return c.json({ error: 'Errore upload file' }, 500);
    }

    // Ottieni URL pubblico
    const { data: { publicUrl } } = supabase.storage
      .from(bucketName)
      .getPublicUrl(fileName);

    // Aggiorna il logo_url dell'organizzazione
    await query(
      'UPDATE organizations SET logo_url = $1, updated_at = NOW() WHERE id = $2',
      [publicUrl, organizationId]
    );

    console.log('✅ Logo caricato con successo:', publicUrl);

    return c.json({
      success: true,
      logo_url: publicUrl,
      message: 'Logo caricato con successo'
    });

  } catch (error: any) {
    console.error('❌ Errore upload logo:', error);
    return c.json({
      error: 'Errore interno',
      message: error.message
    }, 500);
  }
});

export default app;

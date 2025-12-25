import { Hono } from 'hono';
import { query } from '../utils/database';

const app = new Hono();

// ============================================================================
// ORGANIZATION GENERAL SETTINGS
// ============================================================================

// GET /settings/organization/general - Ottieni impostazioni generali organizzazione
app.get('/organization/general', async (c) => {
  try {
    // Ottieni l'ID dell'organizzazione dal token JWT
    const authHeader = c.req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json({ error: 'Token mancante' }, 401);
    }

    // Per ora usiamo un approccio semplificato - prendiamo l'ID dal localStorage del frontend
    // In produzione dovremmo decodificare il JWT per ottenere l'organization_id
    const payload = JSON.parse(atob(authHeader.split('.')[1]));
    const organizationId = payload.organization?.id;

    if (!organizationId) {
      return c.json({ error: 'Organization ID mancante nel token' }, 401);
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
    // Ottieni l'ID dell'organizzazione dal token JWT
    const authHeader = c.req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json({ error: 'Token mancante' }, 401);
    }

    const payload = JSON.parse(atob(authHeader.split('.')[1]));
    const organizationId = payload.organization?.id;

    if (!organizationId) {
      return c.json({ error: 'Organization ID mancante nel token' }, 401);
    }

    const body = await c.req.json();
    console.log('📝 Aggiornamento impostazioni generali per org:', organizationId, body);

    // Costruisci la query di update dinamicamente
    const updateFields = [];
    const values = [];
    let paramIndex = 1;

    const allowedFields = [
      'legal_name', 'logo_url', 'vat_number', 'tax_code', 'org_type',
      'address_line', 'city', 'province', 'region', 'country',
      'phone', 'support_email', 'postal_code'
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

export default app;

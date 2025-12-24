import { Hono } from 'hono';
import { hashPassword, verifyPassword, generateJWT, verifyJWT, generateResetToken, generateVerificationCode, rateLimiter } from '../utils/auth';
import { query } from '../utils/database';
import { sendPasswordResetEmail } from '../utils/email';
import { publicObjectUrl } from '../utils/storage';
import type { UserStatus, OrgRole } from '../types';

const app = new Hono();

// ============================================================================
// REGISTRAZIONE SEMPLIFICATA
// ============================================================================

app.post('/register', async (c) => {
  try {
    const { email, password, firstName, lastName, phone, organizationName } = await c.req.json();

    // Validazione
    if (!email || !password || !firstName || !lastName) {
      return c.json({ error: 'Campi obbligatori mancanti' }, 400);
    }

    // Rate limiting
    const rateLimit = rateLimiter.check(`register_${email}`, 3, 60 * 60 * 1000);
    if (!rateLimit.allowed) {
      return c.json({ error: 'Troppe richieste' }, 429);
    }

    // Verifica email esistente
    const existing = await query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return c.json({ error: 'Email già registrata' }, 400);
    }

    // Hash password
    const { salt, hash } = hashPassword(password);

    // Crea organizzazione
    const orgResult = await query(
      'INSERT INTO organizations (legal_name, org_type, address_line, city, province, region, country, status) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id',
      [organizationName || `${firstName} ${lastName}`, 'FARM', '', '', '', '', 'IT', 'ACTIVE']
    );
    const orgId = orgResult.rows[0].id;

    // Crea utente
    const userResult = await query(
      'INSERT INTO users (email, first_name, last_name, password_salt, password_hash, email_verified, status) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id',
      [email, firstName, lastName, salt, hash, false, 'ACTIVE']
    );
    const userId = userResult.rows[0].id;

    // Crea membership
    await query(
      'INSERT INTO org_memberships (org_id, user_id, role, is_active) VALUES ($1, $2, $3, $4)',
      [orgId, userId, 'BUYER_ADMIN', true]
    );

    // Genera codice verifica
    const code = generateVerificationCode();
    await query(
      'INSERT INTO verification_codes (user_id, email, code, purpose, expires_at) VALUES ($1, $2, $3, $4, $5)',
      [userId, email, code, 'EMAIL_VERIFICATION', new Date(Date.now() + 10 * 60 * 1000)]
    );

    // Genera JWT
    const token = generateJWT({
      userId,
      orgId,
      role: 'BUYER_ADMIN',
      isAdmin: true,
      emailVerified: false
    });

    return c.json({
      message: 'Registrazione completata',
      token,
      user: { id: userId, email, first_name: firstName, last_name: lastName, email_verified: false },
      organization: { id: orgId, name: organizationName || `${firstName} ${lastName}`, role: 'BUYER_ADMIN', isAdmin: true }
    }, 201);

  } catch (error: any) {
    console.error('Errore registrazione:', error);
    return c.json({ error: 'Errore interno' }, 500);
  }
});

// ============================================================================
// LOGIN SEMPLIFICATO
// ============================================================================

app.post('/login', async (c) => {
  try {
    const { email, password } = await c.req.json();

    if (!email || !password) {
      return c.json({ error: 'Email e password obbligatorie' }, 400);
    }

    // Rate limiting
    const clientIP = c.req.header('x-forwarded-for') || 'unknown';
    const rateLimit = rateLimiter.check(`login_${clientIP}_${email}`, 5, 15 * 60 * 1000);
    if (!rateLimit.allowed) {
      return c.json({ error: 'Troppe richieste' }, 429);
    }

    // Trova utente
    const userResult = await query(`
      SELECT u.*, om.role, o.id as org_id, o.legal_name
      FROM users u
      LEFT JOIN org_memberships om ON u.id = om.user_id AND om.is_active = true
      LEFT JOIN organizations o ON om.org_id = o.id
      WHERE u.email = $1 AND u.status = 'ACTIVE'
    `, [email]);

    if (userResult.rows.length === 0) {
      return c.json({ error: 'Credenziali invalide' }, 401);
    }

    const user = userResult.rows[0];

    console.log('🔐 Verifica password per utente:', user.email);
    console.log('🔐 Password hash presente:', !!user.password_hash);
    console.log('🔐 Password salt presente:', !!user.password_salt);

    // Verifica password
    // Controlla se l'utente ha password del vecchio sistema (hash senza salt)
    if (user.password_hash && !user.password_salt) {
      console.warn('⚠️  Utente ha password vecchio sistema (senza salt)');
      return c.json({ 
        error: 'Password reset required',
        message: 'La tua password deve essere resettata. Usa "Password dimenticata" per creare una nuova password.'
      }, 401);
    }

    if (!user.password_hash || !user.password_salt) {
      console.error('❌ Password hash o salt mancanti');
      return c.json({ error: 'Credenziali invalide' }, 401);
    }

    const passwordValid = verifyPassword(password, user.password_hash, user.password_salt);
    console.log('🔐 Password valida:', passwordValid);

    if (!passwordValid) {
      console.warn('⚠️  Password non valida');
      return c.json({ error: 'Credenziali invalide' }, 401);
    }

    console.log('✅ Password verificata con successo');

    // Gestisci caso utente senza membership attiva
    const orgId = user.org_id || null;
    const role = user.role || null;
    const orgName = user.legal_name || null;
    const isAdmin = role === 'BUYER_ADMIN' || role === 'VENDOR_ADMIN';

    // Genera JWT
    const token = generateJWT({
      userId: user.id,
      orgId,
      role,
      isAdmin,
      emailVerified: user.email_verified || false
    });

    const response = {
      token,
      user: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        email_verified: user.email_verified || false
      },
      organization: orgId ? {
        id: orgId,
        name: orgName,
        role,
        isAdmin
      } : null
    };

    console.log('📤 Response login:', {
      hasToken: !!response.token,
      userId: response.user.id,
      orgId: response.organization?.id,
      orgName: response.organization?.name
    });

    return c.json(response);

  } catch (error: any) {
    console.error('Errore login:', error);
    return c.json({ error: 'Errore interno' }, 500);
  }
});

// ============================================================================
// GET PROFILE (ME)
// ============================================================================

app.get('/me', async (c) => {
  try {
    // Estrai token dall'header Authorization
    const authHeader = c.req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json({ error: 'Token mancante' }, 401);
    }

    const token = authHeader.substring(7);
    const payload = verifyJWT(token);

    if (!payload) {
      return c.json({ error: 'Token invalido o scaduto' }, 401);
    }

    // Trova utente e organizzazione
    const userResult = await query(`
      SELECT u.*, om.role, o.id as org_id, o.legal_name
      FROM users u
      LEFT JOIN org_memberships om ON u.id = om.user_id AND om.is_active = true
      LEFT JOIN organizations o ON om.org_id = o.id
      WHERE u.id = $1 AND u.status = 'ACTIVE'
    `, [payload.userId]);

    if (userResult.rows.length === 0) {
      return c.json({ error: 'Utente non trovato' }, 404);
    }

    const user = userResult.rows[0];
    const orgId = user.org_id || null;
    const role = user.role || null;
    const orgName = user.legal_name || null;
    const isAdmin = role === 'BUYER_ADMIN' || role === 'VENDOR_ADMIN';

    return c.json({
      user: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        email_verified: user.email_verified || false
      },
      organization: orgId ? {
        id: orgId,
        name: orgName,
        role,
        isAdmin
      } : null
    });

  } catch (error: any) {
    console.error('Errore get profile:', error);
    return c.json({ error: 'Errore interno' }, 500);
  }
});

// ============================================================================
// RICHIESTA RESET PASSWORD
// ============================================================================

app.post('/request-password-reset', async (c) => {
  try {
    const { email } = await c.req.json();

    if (!email) {
      return c.json({ error: 'Email obbligatoria' }, 400);
    }

    // Rate limiting
    const rateLimit = rateLimiter.check(`reset_${email}`, 3, 60 * 60 * 1000);
    if (!rateLimit.allowed) {
      return c.json({ error: 'Troppe richieste' }, 429);
    }

    // Trova utente
    console.log('🔍 Cerca utente con email:', email);
    let userResult;
    try {
      userResult = await query('SELECT id, email, first_name FROM users WHERE email = $1 AND status = $2', [email, 'ACTIVE']);
      console.log('✅ Query eseguita, risultati:', userResult.rows.length);
    } catch (queryError: any) {
      console.error('❌ Errore query database:', queryError);
      throw queryError;
    }
    
    if (userResult.rows.length === 0) {
      // Per sicurezza, non rivelare se l'email esiste
      console.log('⚠️  Utente non trovato o non attivo');
      return c.json({ message: 'Se l\'email esiste, riceverai un link per resettare la password' });
    }

    const user = userResult.rows[0];
    console.log('✅ Utente trovato:', user.id);

    // Genera token reset
    const resetToken = generateResetToken();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 ore

    // Salva token nel database
    await query(
      'UPDATE users SET reset_token = $1, reset_token_expires = $2 WHERE id = $3',
      [resetToken, expiresAt, user.id]
    );

    // Invia email con link reset
    const frontendUrl = process.env.FRONTEND_URL || 'https://agrifly.it';
    const resetUrl = `${frontendUrl}/reset-password?token=${resetToken}`;
    
    console.log('🔐 Generato reset token per:', email);
    console.log('🔗 Reset URL:', resetUrl);
    console.log('📧 FRONTEND_URL configurato:', frontendUrl);
    console.log('📧 RESEND_API_KEY configurato:', !!process.env.RESEND_API_KEY);
    
    try {
      const emailResult = await sendPasswordResetEmail(email, resetUrl);

      // Se l'email non è stata inviata (dominio non verificato o altro errore), restituiamo il link
      if (!emailResult.sent && emailResult.resetUrl) {
        console.warn('⚠️  Email non inviata - restituisco link nella risposta');
        console.log('📧 RESET PASSWORD LINK:', emailResult.resetUrl);
        
        // Restituiamo sempre il link se l'email non può essere inviata
        return c.json({ 
          message: 'Email non configurata correttamente. Usa questo link per resettare la password:',
          resetUrl: emailResult.resetUrl,
          warning: emailResult.error || 'Email non inviata'
        });
      }

      if (!emailResult.sent && emailResult.error) {
        console.error('Errore invio email reset password:', emailResult.error);
        // Se c'è un errore ma non abbiamo il link, restituiamo comunque un messaggio generico
        return c.json({ 
          message: 'Se l\'email esiste, riceverai un link per resettare la password',
          error: emailResult.error
        });
      }

      return c.json({ 
        message: 'Se l\'email esiste, riceverai un link per resettare la password' 
      });
    } catch (emailError: any) {
      console.error('Errore nell\'invio email:', emailError);
      // Anche se l'email fallisce, restituiamo il link direttamente
      return c.json({ 
        message: 'Email non configurata. Usa questo link per resettare la password:',
        resetUrl: resetUrl,
        warning: 'Errore invio email'
      });
    }

  } catch (error: any) {
    console.error('Errore richiesta reset password:', error);
    console.error('Stack:', error.stack);
    return c.json({ 
      error: 'Errore interno',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    }, 500);
  }
});

// ============================================================================
// RESET PASSWORD CON TOKEN
// ============================================================================

app.post('/reset-password', async (c) => {
  try {
    const { token, newPassword } = await c.req.json();

    if (!token || !newPassword) {
      return c.json({ error: 'Token e nuova password obbligatori' }, 400);
    }

    if (newPassword.length < 8) {
      return c.json({ error: 'La password deve essere di almeno 8 caratteri' }, 400);
    }

    console.log('🔐 Reset password - token ricevuto:', token.substring(0, 10) + '...');
    
    // Trova utente con token valido
    let userResult;
    try {
      userResult = await query(
        'SELECT id, email FROM users WHERE reset_token = $1 AND reset_token_expires > NOW() AND status = $2',
        [token, 'ACTIVE']
      );
      console.log('✅ Query reset password eseguita, risultati:', userResult.rows.length);
    } catch (queryError: any) {
      console.error('❌ Errore query reset password:', queryError.message);
      console.error('❌ Error code:', queryError.code);
      throw queryError;
    }

    if (userResult.rows.length === 0) {
      return c.json({ error: 'Token invalido o scaduto' }, 400);
    }

    const user = userResult.rows[0];

    // Genera nuovo hash password con salt
    const { salt, hash } = hashPassword(newPassword);

    // Aggiorna password e cancella token
    await query(
      'UPDATE users SET password_hash = $1, password_salt = $2, reset_token = NULL, reset_token_expires = NULL WHERE id = $3',
      [hash, salt, user.id]
    );

    return c.json({ 
      message: 'Password resettata con successo. Puoi ora accedere con la nuova password.' 
    });

  } catch (error: any) {
    console.error('Errore reset password:', error);
    return c.json({ error: 'Errore interno' }, 500);
  }
});

// ============================================================================
// DEBUG: CHECK LENZI CATALOG
// ============================================================================

app.get('/debug/lenzi-catalog', async (c) => {
  try {
    console.log('🔍 Debug Lenzi catalog - inizio query...');
    
    // Trova organizzazione Lenzi
    const lenziOrg = await query(`
      SELECT id, legal_name, org_type, status
      FROM organizations
      WHERE legal_name ILIKE '%lenzi%'
      LIMIT 1
    `);

    console.log('📋 Organizzazioni Lenzi trovate:', lenziOrg.rows.length);

    if (lenziOrg.rows.length === 0) {
      // Prova a cercare tutte le organizzazioni vendor
      const allVendors = await query(`
        SELECT id, legal_name, org_type
        FROM organizations
        WHERE org_type = 'VENDOR'
        LIMIT 10
      `);
      return c.json({ 
        error: 'Organizzazione Lenzi non trovata',
        availableVendors: allVendors.rows
      }, 404);
    }

    const lenziId = lenziOrg.rows[0].id;
    console.log('✅ Lenzi ID trovato:', lenziId);

    // Catalog items con prezzi
    const catalogItems = await query(`
      SELECT 
        vci.id,
        vci.sku_id,
        vci.is_for_sale,
        vci.is_for_rent,
        s.sku_code,
        p.name as product_name,
        p.brand,
        p.model,
        (
          SELECT pli.price_cents / 100.0
          FROM price_list_items pli
          JOIN price_lists pl ON pli.price_list_id = pl.id
          WHERE pli.sku_id = s.id
            AND pl.vendor_org_id = $1
            AND pl.status = 'ACTIVE'
            AND pl.valid_from <= NOW()
            AND (pl.valid_to IS NULL OR pl.valid_to >= NOW())
          ORDER BY pl.valid_from DESC
          LIMIT 1
        ) as price_euros
      FROM vendor_catalog_items vci
      JOIN skus s ON vci.sku_id = s.id
      JOIN products p ON s.product_id = p.id
      WHERE vci.vendor_org_id = $1
      LIMIT 10
    `, [lenziId]);

    // Inventari dettagliati
    const inventories = await query(`
      SELECT 
        COUNT(DISTINCT i.sku_id) as sku_count,
        SUM(i.qty_on_hand) as total_stock
      FROM inventories i
      WHERE i.vendor_org_id = $1
    `, [lenziId]);

    // Inventari per SKU
    const inventoryDetails = await query(`
      SELECT 
        i.sku_id,
        s.sku_code,
        p.name as product_name,
        SUM(i.qty_on_hand) as qty_on_hand,
        SUM(i.qty_reserved) as qty_reserved,
        SUM(i.qty_on_hand) - SUM(i.qty_reserved) as qty_available
      FROM inventories i
      JOIN skus s ON i.sku_id = s.id
      JOIN products p ON s.product_id = p.id
      WHERE i.vendor_org_id = $1
      GROUP BY i.sku_id, s.sku_code, p.name
      ORDER BY p.name
    `, [lenziId]);

    // Utente Giacomo
    const giacomo = await query(`
      SELECT 
        u.email,
        om.org_id,
        om.role,
        o.legal_name
      FROM users u
      JOIN org_memberships om ON u.id = om.user_id AND om.is_active = true
      JOIN organizations o ON om.org_id = o.id
      WHERE u.email = 'giacomo.cavalcabo14@gmail.com'
    `);

    return c.json({
      lenziOrg: {
        id: lenziOrg.rows[0].id,
        name: lenziOrg.rows[0].legal_name,
        type: lenziOrg.rows[0].org_type
      },
      catalogItems: catalogItems.rows.length,
      catalogItemsSample: catalogItems.rows.slice(0, 5).map(row => ({
        skuCode: row.sku_code,
        productName: row.product_name,
        isForSale: row.is_for_sale,
        price: row.price_euros || null,
        hasPrice: !!row.price_euros
      })),
      inventories: {
        skuCount: parseInt(inventories.rows[0].sku_count) || 0,
        totalStock: parseInt(inventories.rows[0].total_stock) || 0,
        details: inventoryDetails.rows.map(row => ({
          skuCode: row.sku_code,
          productName: row.product_name,
          onHand: parseInt(row.qty_on_hand) || 0,
          reserved: parseInt(row.qty_reserved) || 0,
          available: parseInt(row.qty_available) || 0
        }))
      },
      giacomoMemberships: giacomo.rows
    });

  } catch (error: any) {
    console.error('Errore debug lenzi catalog:', error);
    return c.json({ error: error.message }, 500);
  }
});

// ============================================================================
// UPDATE LENZI PRICES (Endpoint temporaneo per aggiornare prezzi)
// ============================================================================

app.post('/debug/update-lenzi-prices', async (c) => {
  try {
    console.log('💰 Aggiornamento prezzi Lenzi...');

    // Trova la price list attiva di Lenzi
    const priceListResult = await query(`
      SELECT id, name, currency
      FROM price_lists
      WHERE vendor_org_id = 'lenzi-org-id'
        AND status = 'ACTIVE'
        AND valid_from <= NOW()
        AND (valid_to IS NULL OR valid_to >= NOW())
      ORDER BY valid_from DESC
      LIMIT 1
    `);

    if (priceListResult.rows.length === 0) {
      return c.json({ error: 'Nessuna price list attiva trovata per Lenzi' }, 404);
    }

    const priceListId = priceListResult.rows[0].id;
    console.log(`📋 Price list trovata: ${priceListResult.rows[0].name} (${priceListId})`);

    // Aggiorna i prezzi basati sul modello del prodotto
    const updateResult = await query(`
      UPDATE price_list_items pli
      SET price_cents = CASE
        -- Prezzi specifici per modello drone
        WHEN p.model ILIKE '%T50%' THEN 2850000  -- 28,500€
        WHEN p.model ILIKE '%T30%' THEN 1650000   -- 16,500€
        WHEN p.model ILIKE '%T70P%' THEN 3200000  -- 32,000€
        WHEN p.model ILIKE '%T100%' THEN 4500000  -- 45,000€
        WHEN p.model ILIKE '%T25P%' THEN 1400000  -- 14,000€
        WHEN p.model ILIKE '%T25%' AND p.model NOT ILIKE '%T25P%' THEN 1200000   -- 12,000€
        WHEN p.model ILIKE '%Mavic 3M%' OR p.model ILIKE '%Mavic3M%' THEN 800000  -- 8,000€
        -- Prezzi generici per tipo prodotto (fallback)
        WHEN p.product_type = 'DRONE' THEN 2000000  -- 20,000€ default
        WHEN p.product_type = 'BATTERY' THEN 150000  -- 1,500€
        WHEN p.product_type = 'SPARE' THEN 50000     -- 500€
        ELSE pli.price_cents  -- Mantieni prezzo esistente se non match
      END
      FROM skus s
      JOIN products p ON s.product_id = p.id
      WHERE pli.price_list_id = $1
        AND pli.sku_id = s.id
        AND p.status = 'ACTIVE'
      RETURNING 
        s.sku_code,
        p.model,
        p.product_type,
        pli.price_cents,
        (pli.price_cents / 100.0) as price_euros
    `, [priceListId]);

    console.log(`✅ Prezzi aggiornati: ${updateResult.rows.length} prodotti`);

    // Verifica prodotti senza prezzo
    const missingPrices = await query(`
      SELECT s.sku_code, p.model
      FROM skus s
      JOIN products p ON s.product_id = p.id
      WHERE p.status = 'ACTIVE'
        AND NOT EXISTS (
          SELECT 1 FROM price_list_items pli
          WHERE pli.price_list_id = $1
            AND pli.sku_id = s.id
        )
    `, [priceListId]);

    return c.json({
      success: true,
      priceList: {
        id: priceListId,
        name: priceListResult.rows[0].name,
        currency: priceListResult.rows[0].currency
      },
      updated: updateResult.rows.length,
      products: updateResult.rows.map(row => ({
        skuCode: row.sku_code,
        model: row.model,
        price: row.price_euros
      })),
      missingPrices: missingPrices.rows.length > 0 ? missingPrices.rows.map(row => ({
        skuCode: row.sku_code,
        model: row.model
      })) : []
    });

  } catch (error: any) {
    console.error('❌ Errore aggiornamento prezzi:', error);
    return c.json({ 
      error: 'Errore interno', 
      message: error.message 
    }, 500);
  }
});

// ============================================================================
// HEALTH CHECK SEMPLIFICATO
// ============================================================================

app.get('/health', async (c) => {
  try {
    // Test connessione database
    await query('SELECT 1');

    return c.json({
      timestamp: new Date().toISOString(),
      status: 'ok',
      database: 'connected',
      environment: process.env.NODE_ENV
    });
  } catch (error: any) {
    return c.json({
      status: 'error',
      database: 'disconnected',
      error: error.message
    }, 500);
  }
});

// ============================================================================
// DEBUG: Verifica path GLB nel database
// ============================================================================

app.get('/debug/glb-paths', async (c) => {
  try {
    const result = await query(`
      SELECT 
        p.id,
        p.model,
        p.glb_files_json,
        s.sku_code
      FROM products p
      JOIN skus s ON s.product_id = p.id
      WHERE p.status = 'ACTIVE'
        AND p.glb_files_json IS NOT NULL
      ORDER BY p.model
    `);

    const products = result.rows.map(row => {
      let glbPaths: any[] = [];
      let supabaseUrls: string[] = [];
      
      try {
        const glbFiles = typeof row.glb_files_json === 'string' 
          ? JSON.parse(row.glb_files_json) 
          : row.glb_files_json;
        
        if (Array.isArray(glbFiles)) {
          glbPaths = glbFiles.map(glb => glb.url || glb.filename || glb);
          
          // Costruisci URL Supabase Storage
          supabaseUrls = glbPaths
            .filter((path: string) => typeof path === 'string')
            .map((path: string) => {
              try {
                return publicObjectUrl(undefined, path);
              } catch (e) {
                console.warn('Errore costruzione URL per path:', path, e);
                return null;
              }
            })
            .filter((url): url is string => url !== null);
        }
      } catch (e) {
        console.error('Errore parsing glb_files_json:', e);
      }
      
      return {
        model: row.model,
        skuCode: row.sku_code,
        glbPaths,
        supabaseUrls
      };
    });

    let supabaseUrl: string;
    try {
      const { getSupabaseUrl } = await import('../utils/storage');
      supabaseUrl = getSupabaseUrl();
    } catch (e) {
      supabaseUrl = 'NOT_CONFIGURED';
    }
    
    const bucket = process.env.SUPABASE_STORAGE_BUCKET || 'assets';

    return c.json({
      supabaseUrl,
      bucket: bucket,
      note: 'Se vedi errori 400, verifica che il bucket esista e sia pubblico in Supabase Storage Dashboard',
      troubleshooting: {
        step1: 'Vai su Supabase Dashboard → Storage',
        step2: `Verifica che esista il bucket "${bucket}"`,
        step3: 'Se non esiste, crealo come bucket pubblico',
        step4: 'Carica i file GLB nel path corretto (es. glb/t50/T50.glb)',
        step5: 'Se il bucket ha un nome diverso, configura SUPABASE_STORAGE_BUCKET su Netlify'
      },
      products
    });

  } catch (error: any) {
    console.error('❌ Errore verifica GLB paths:', error);
    return c.json({ 
      error: 'Errore interno', 
      message: error.message 
    }, 500);
  }
});

export default app;

import { Hono } from 'hono';
import { query } from '../utils/database';
import { authMiddleware } from '../middleware/auth';
import { validateBody, validateParams } from '../middleware/validation';
import { AddCartItemSchema, UpdateCartItemSchema, CreateAddressSchema, UpdateAddressSchema, AddWishlistItemSchema, CreateAddressLegacySchema, UpdateAddressLegacySchema, DeleteItemParamsSchema, DeleteAddressParamsSchema, MigrateCartSchema } from '../schemas/api.schemas';

const app = new Hono();

// POST /api/ecommerce/create-tables - Crea tabelle e-commerce con tipi TEXT
app.post('/create-tables', async (c) => {
  try {
    // Elimina tabelle esistenti se presenti
    await query(`DROP TABLE IF EXISTS cart_items CASCADE`);
    await query(`DROP TABLE IF EXISTS shopping_carts CASCADE`);
    await query(`DROP TABLE IF EXISTS wishlist_items CASCADE`);

    // Crea shopping_carts
    await query(`
      CREATE TABLE shopping_carts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id TEXT,
        session_id TEXT,
        org_id TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // Crea cart_items
    await query(`
      CREATE TABLE IF NOT EXISTS cart_items (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        cart_id UUID NOT NULL REFERENCES shopping_carts(id) ON DELETE CASCADE,
        sku_id TEXT NOT NULL,
        quantity INTEGER DEFAULT 1,
        unit_price_cents INTEGER,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // Crea wishlist_items
    await query(`
      CREATE TABLE IF NOT EXISTS wishlist_items (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        buyer_org_id TEXT NOT NULL,
        product_id TEXT NOT NULL,
        note TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    return c.json({ message: 'Tabelle create con successo' });
  } catch (error: any) {
    console.error('Errore creazione tabelle:', error);
    return c.json({ error: 'Errore creazione tabelle', message: error.message }, 500);
  }
});

// ============================================================================
// SHOPPING CART API
// ============================================================================

// GET /api/ecommerce/cart - Ottieni carrello dell'utente/org
app.get('/cart', async (c) => {
  try {
    const orgId = c.req.query('orgId');
    const userId = c.req.query('userId');
    const sessionId = c.req.query('sessionId'); // per guest users

    // Per guest users, sessionId è sufficiente (orgId non è richiesto)
    if (!orgId && !sessionId) {
      return c.json({ error: 'Organization ID or Session ID required' }, 400);
    }

    let cartQuery;
    let cartParams;

    if (userId && orgId) {
      // Carrello di utente registrato
      cartQuery = `
        SELECT sc.id, sc.user_id, sc.session_id, sc.org_id, sc.created_at, sc.updated_at
        FROM shopping_carts sc
        WHERE sc.user_id = $1 AND sc.org_id = $2
      `;
      cartParams = [userId, orgId];
    } else if (sessionId) {
      // Carrello guest - sessionId ha priorità
      cartQuery = `
        SELECT sc.id, sc.user_id, sc.session_id, sc.org_id, sc.created_at, sc.updated_at
        FROM shopping_carts sc
        WHERE sc.session_id = $1
      `;
      cartParams = [sessionId];
    } else if (orgId) {
      // Cerca carrello esistente per organizzazione (fallback)
      cartQuery = `
        SELECT sc.id, sc.user_id, sc.session_id, sc.org_id, sc.created_at, sc.updated_at
        FROM shopping_carts sc
        WHERE sc.org_id = $1
        LIMIT 1
      `;
      cartParams = [orgId];
    } else {
      return c.json({ error: 'Organization ID or Session ID required' }, 400);
    }

    const cartResult = await query(cartQuery, cartParams);

    if (cartResult.rows.length === 0) {
      // Crea un nuovo carrello per l'utente/organizzazione
      let insertQuery: string;
      let insertParams: any[];

      // PostgreSQL genera automaticamente l'UUID con DEFAULT gen_random_uuid()
      if (userId && orgId) {
        insertQuery = `INSERT INTO shopping_carts (user_id, org_id, created_at, updated_at) VALUES ($1, $2, $3, $4) RETURNING id`;
        insertParams = [userId, orgId, new Date().toISOString(), new Date().toISOString()];
      } else if (sessionId) {
        // Carrello guest - usa 'guest_org' come placeholder per org_id (che è NOT NULL)
        insertQuery = `INSERT INTO shopping_carts (session_id, org_id, created_at, updated_at) VALUES ($1, $2, $3, $4) RETURNING id`;
        insertParams = [sessionId, orgId || 'guest_org', new Date().toISOString(), new Date().toISOString()];
      } else if (orgId) {
        insertQuery = `INSERT INTO shopping_carts (org_id, created_at, updated_at) VALUES ($1, $2, $3) RETURNING id`;
        insertParams = [orgId, new Date().toISOString(), new Date().toISOString()];
      } else {
        return c.json({ error: 'Cannot create cart without userId, sessionId, or orgId' }, 400);
      }

      const insertResult = await query(insertQuery, insertParams);
      const cartId = insertResult.rows[0].id;
      
      // Recupera il carrello appena creato
      const newCartResult = await query(cartQuery, cartParams);

      return c.json({
        cart: newCartResult.rows[0],
        items: []
      });
    }

    const cart = cartResult.rows[0];

    // Ottieni gli items del carrello
    const itemsQuery = `
      SELECT ci.id, ci.cart_id, ci.sku_id, ci.quantity, ci.unit_price_cents, ci.created_at,
             s.sku_code, p.name as product_name, p.model as product_model, p.brand
      FROM cart_items ci
      JOIN skus s ON ci.sku_id = s.id
      JOIN products p ON s.product_id = p.id
      WHERE ci.cart_id = $1
      ORDER BY ci.created_at
    `;

    const itemsResult = await query(itemsQuery, [cart.id]);
    
    // Aggiorna i prezzi mancanti nel database
    for (const item of itemsResult.rows) {
      if (!item.unit_price_cents || item.unit_price_cents === null || item.unit_price_cents === 0) {
        // Prova a recuperare il prezzo dalla price list attiva
        try {
          const priceResult = await query(`
            SELECT pli.price_cents
            FROM price_list_items pli
            JOIN price_lists pl ON pli.price_list_id = pl.id
            WHERE pli.sku_id = $1
              AND pl.status = 'ACTIVE'
            ORDER BY pl.valid_from DESC
            LIMIT 1
          `, [item.sku_id]);
          
          if (priceResult.rows.length > 0 && priceResult.rows[0].price_cents) {
            const priceCents = parseInt(priceResult.rows[0].price_cents);
            await query(
              'UPDATE cart_items SET unit_price_cents = $1 WHERE id = $2',
              [priceCents, item.id]
            );
            item.unit_price_cents = priceCents;
          }
        } catch (e) {
          console.warn('⚠️ Errore aggiornamento prezzo per item:', item.id, e);
        }
      }
    }

    return c.json({
      cart,
      items: itemsResult.rows
    });

  } catch (error: any) {
    console.error('❌ Errore get cart:', error);
    return c.json({
      error: 'Errore interno',
      message: error.message
    }, 500);
  }
});

// POST /api/ecommerce/cart/items - Aggiungi item al carrello
app.post('/cart/items', validateBody(AddCartItemSchema), async (c) => {
  try {
    const validatedBody = c.get('validatedBody') as any;
    const { cartId, skuId, quantity = 1 } = validatedBody;

    // Recupera il prezzo dalla price list attiva per questo SKU
    let unitPriceCents: number | null = null;
    try {
      const priceResult = await query(`
        SELECT pli.price_cents
        FROM price_list_items pli
        JOIN price_lists pl ON pli.price_list_id = pl.id
        WHERE pli.sku_id = $1
          AND pl.status = 'ACTIVE'
          AND pl.valid_from <= NOW()
          AND (pl.valid_to IS NULL OR pl.valid_to >= NOW())
        ORDER BY pl.valid_from DESC
        LIMIT 1
      `, [skuId]);

      if (priceResult.rows.length > 0 && priceResult.rows[0].price_cents) {
        unitPriceCents = parseInt(priceResult.rows[0].price_cents);
      }
    } catch (e) {
      console.warn('⚠️ Errore recupero prezzo per SKU:', skuId, e);
    }

    // Verifica se l'item già esiste nel carrello
    const existingItem = await query(
      'SELECT id, quantity, unit_price_cents FROM cart_items WHERE cart_id = $1 AND sku_id = $2',
      [cartId, skuId]
    );

    let result;
    if (existingItem.rows.length > 0) {
      // Aggiorna quantità esistente (mantieni il prezzo esistente se non c'è un nuovo prezzo)
      const newQuantity = existingItem.rows[0].quantity + quantity;
      const priceToUse = unitPriceCents !== null ? unitPriceCents : existingItem.rows[0].unit_price_cents;
      
      if (priceToUse !== null) {
        result = await query(
          'UPDATE cart_items SET quantity = $1, unit_price_cents = $2 WHERE id = $3 RETURNING *',
          [newQuantity, priceToUse, existingItem.rows[0].id]
        );
      } else {
        result = await query(
          'UPDATE cart_items SET quantity = $1 WHERE id = $2 RETURNING *',
          [newQuantity, existingItem.rows[0].id]
        );
      }
    } else {
      // Inserisci nuovo item con prezzo se disponibile
      if (unitPriceCents !== null) {
        result = await query(
          `INSERT INTO cart_items (cart_id, sku_id, quantity, unit_price_cents)
           VALUES ($1, $2, $3, $4) RETURNING *`,
          [cartId, skuId, quantity, unitPriceCents]
        );
      } else {
        result = await query(
          `INSERT INTO cart_items (cart_id, sku_id, quantity)
           VALUES ($1, $2, $3) RETURNING *`,
          [cartId, skuId, quantity]
        );
      }
    }

    // Aggiorna timestamp del carrello
    await query(
      'UPDATE shopping_carts SET updated_at = NOW() WHERE id = $1',
      [cartId]
    );

    return c.json(result.rows[0]);

  } catch (error: any) {
    console.error('❌ Errore add to cart:', error);
    return c.json({
      error: 'Errore interno',
      message: error.message
    }, 500);
  }
});

// PUT /api/ecommerce/cart/items/:itemId - Aggiorna quantità item
app.put('/cart/items/:itemId', validateBody(UpdateCartItemSchema), async (c) => {
  try {
    const itemId = c.req.param('itemId');
    const body = await c.req.json();
    const { quantity } = body;

    console.log('📝 Update cart item request:', { itemId, quantity });

    if (!itemId || quantity === undefined || quantity < 0) {
      return c.json({ error: 'Valid item ID and quantity required' }, 400);
    }

    if (quantity === 0) {
      // Rimuovi item se quantità è 0
      await query('DELETE FROM cart_items WHERE id = $1', [itemId]);
      return c.json({ message: 'Item removed from cart' });
    }

    // Verifica che l'item esista prima di aggiornarlo
    const checkItem = await query(
      'SELECT id, quantity FROM cart_items WHERE id = $1',
      [itemId]
    );

    console.log('🔍 Check item result:', { itemId, found: checkItem.rows.length, currentQuantity: checkItem.rows[0]?.quantity });

    if (checkItem.rows.length === 0) {
      return c.json({ error: 'Cart item not found' }, 404);
    }

    // SQLite non supporta RETURNING, quindi aggiorniamo e poi recuperiamo
    await query(
      'UPDATE cart_items SET quantity = $1 WHERE id = $2',
      [quantity, itemId]
    );

    // Recupera l'item aggiornato con i dati del prodotto (usa LEFT JOIN per evitare problemi se SKU/prodotto non esistono)
    const result = await query(`
      SELECT ci.id, ci.cart_id, ci.sku_id, ci.quantity, ci.unit_price_cents, ci.created_at,
             COALESCE(s.sku_code, ci.sku_id) as sku_code, 
             COALESCE(p.name, p.model, 'Prodotto') as product_name, 
             p.model as product_model, 
             p.brand
      FROM cart_items ci
      LEFT JOIN skus s ON ci.sku_id = s.id
      LEFT JOIN products p ON s.product_id = p.id
      WHERE ci.id = $1
    `, [itemId]);

    console.log('📋 Result after update:', { itemId, rowCount: result.rows.length, firstRow: result.rows[0] });

    if (result.rows.length === 0) {
      console.error('⚠️ Item aggiornato ma non trovato dopo UPDATE:', itemId);
      // Restituisci almeno i dati base dell'item aggiornato
      const basicItem = await query(
        'SELECT id, cart_id, sku_id, quantity, unit_price_cents, created_at FROM cart_items WHERE id = $1',
        [itemId]
      );
      if (basicItem.rows.length > 0) {
        return c.json({
          ...basicItem.rows[0],
          sku_code: basicItem.rows[0].sku_id,
          product_name: 'Prodotto',
          product_model: null,
          brand: null
        });
      }
      return c.json({ error: 'Cart item not found after update' }, 404);
    }

    // Aggiorna timestamp del carrello
    await query(
      'UPDATE shopping_carts SET updated_at = NOW() WHERE id IN (SELECT cart_id FROM cart_items WHERE id = $1)',
      [itemId]
    );

    return c.json(result.rows[0]);

  } catch (error: any) {
    console.error('❌ Errore update cart item:', error);
    return c.json({
      error: 'Errore interno',
      message: error.message
    }, 500);
  }
});

// DELETE /api/ecommerce/cart/items/:itemId - Rimuovi item dal carrello
app.delete('/cart/items/:itemId', validateParams(DeleteItemParamsSchema), async (c) => {
  try {
    const { itemId } = c.get('validatedParams');

    const result = await query(
      'DELETE FROM cart_items WHERE id = $1 RETURNING *',
      [itemId]
    );

    if (result.rows.length === 0) {
      return c.json({ error: 'Cart item not found' }, 404);
    }

    return c.json({ message: 'Item removed from cart' });

  } catch (error: any) {
    console.error('❌ Errore remove cart item:', error);
    return c.json({
      error: 'Errore interno',
      message: error.message
    }, 500);
  }
});

// POST /api/ecommerce/cart/migrate - Migra carrello guest a utente
app.post('/cart/migrate', validateBody(MigrateCartSchema), async (c) => {
  try {
    const { sessionId, userId, orgId } = c.get('validatedBody');

    // Trova carrello guest
    const guestCartResult = await query(
      'SELECT id, org_id FROM shopping_carts WHERE session_id = $1',
      [sessionId]
    );

    if (guestCartResult.rows.length === 0) {
      // Nessun carrello guest da migrare, ok
      return c.json({ message: 'Nessun carrello guest da migrare', migrated: false });
    }

    const guestCart = guestCartResult.rows[0];

    // Trova/crea carrello utente
    let userCartResult = await query(
      'SELECT id FROM shopping_carts WHERE user_id = $1 AND org_id = $2',
      [userId, orgId]
    );

    let userCartId: string;
    if (userCartResult.rows.length === 0) {
      // Crea nuovo carrello utente (SQLite non supporta RETURNING)
      const cartId = `cart_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      await query(
        'INSERT INTO shopping_carts (id, user_id, org_id, created_at, updated_at) VALUES ($1, $2, $3, $4, $5)',
        [cartId, userId, orgId, new Date().toISOString(), new Date().toISOString()]
      );
      // Recupera il carrello appena creato
      const newCartResult = await query(
        'SELECT id FROM shopping_carts WHERE id = $1',
        [cartId]
      );
      userCartId = newCartResult.rows[0].id;
    } else {
      userCartId = userCartResult.rows[0].id;
    }

    // Ottieni tutti gli item del carrello guest
    const guestItemsResult = await query(
      'SELECT sku_id, quantity, unit_price_cents FROM cart_items WHERE cart_id = $1',
      [guestCart.id]
    );

    let migratedCount = 0;

    // Migra ogni item
    for (const item of guestItemsResult.rows) {
      // Verifica se l'item esiste già nel carrello utente
      const existingItem = await query(
        'SELECT id, quantity FROM cart_items WHERE cart_id = $1 AND sku_id = $2',
        [userCartId, item.sku_id]
      );

      if (existingItem.rows.length > 0) {
        // Aggiorna quantità sommando
        const newQuantity = existingItem.rows[0].quantity + item.quantity;
        await query(
          'UPDATE cart_items SET quantity = $1 WHERE id = $2',
          [newQuantity, existingItem.rows[0].id]
        );
      } else {
        // Inserisci nuovo item
        await query(
          'INSERT INTO cart_items (cart_id, sku_id, quantity, unit_price_cents) VALUES ($1, $2, $3, $4)',
          [userCartId, item.sku_id, item.quantity, item.unit_price_cents]
        );
      }
      migratedCount++;
    }

    // Elimina carrello guest (gli item vengono eliminati in cascade)
    await query('DELETE FROM shopping_carts WHERE id = $1', [guestCart.id]);

    // Aggiorna timestamp carrello utente
    await query(
      'UPDATE shopping_carts SET updated_at = NOW() WHERE id = $1',
      [userCartId]
    );

    return c.json({
      message: 'Carrello migrato con successo',
      migrated: true,
      itemsMigrated: migratedCount,
      userCartId
    });

  } catch (error: any) {
    console.error('❌ Errore migrazione carrello:', error);
    return c.json({
      error: 'Errore interno',
      message: error.message
    }, 500);
  }
});

// ============================================================================
// WISHLIST API
// ============================================================================

// GET /api/ecommerce/wishlist - Ottieni wishlist dell'organizzazione
app.get('/wishlist', async (c) => {
  try {
    const orgId = c.req.query('orgId');

    if (!orgId) {
      return c.json({ error: 'Organization ID required' }, 400);
    }

    const wishlistQuery = `
      SELECT wi.id, wi.product_id, wi.note, wi.created_at,
             p.name as product_name, p.model as product_model, p.brand,
             p.images_json, p.specs_json
      FROM wishlist_items wi
      JOIN products p ON wi.product_id = p.id
      WHERE wi.buyer_org_id = $1
      ORDER BY wi.created_at DESC
    `;

    const result = await query(wishlistQuery, [orgId]);

    return c.json(result.rows);

  } catch (error: any) {
    console.error('❌ Errore get wishlist:', error);
    return c.json({
      error: 'Errore interno',
      message: error.message
    }, 500);
  }
});

// Funzione helper per assicurarsi che product_id esista nella tabella wishlist_items
async function ensureWishlistProductIdColumn() {
  const hasPostgresConfig = process.env.PGHOST && process.env.PGUSER && process.env.PGPASSWORD;
  const isPostgreSQL = hasPostgresConfig;
  
  try {
    if (isPostgreSQL) {
      // PostgreSQL: aggiungi colonna se non esiste
      await query(`ALTER TABLE wishlist_items ADD COLUMN IF NOT EXISTS product_id TEXT`, []);
    } else {
      // SQLite: prova ad aggiungere la colonna, ignora errore se esiste già
      try {
        await query(`ALTER TABLE wishlist_items ADD COLUMN product_id TEXT`, []);
        console.log('📋 [WISHLIST MIGRATION] Added column: product_id');
      } catch (err: any) {
        if (!err.message?.includes('duplicate column')) {
          throw err;
        }
        // Colonna già esistente, va bene
      }
    }
  } catch (err: any) {
    // Se la tabella non esiste, sarà creata altrove con la colonna corretta
    if (!err.message?.includes('no such table') && !err.message?.includes('relation "wishlist_items" does not exist')) {
      console.error('❌ [WISHLIST MIGRATION] Error:', err.message);
    }
  }
}

// POST /api/ecommerce/wishlist - Aggiungi item alla wishlist
app.post('/wishlist', authMiddleware, validateBody(AddWishlistItemSchema), async (c) => {
  try {
    // Assicurati che product_id esista
    await ensureWishlistProductIdColumn();
    
    const { orgId, productId, note } = c.get('validatedBody');

    if (!orgId) {
      return c.json({ error: 'Organization ID required' }, 400);
    }

    if (!productId) {
      return c.json({ error: 'Product ID required' }, 400);
    }

    // Verifica che il prodotto esista
    const productCheck = await query(
      'SELECT id FROM products WHERE id = $1 AND status = $2',
      [productId, 'ACTIVE']
    );

    if (productCheck.rows.length === 0) {
      return c.json({ error: 'Product not found or not active' }, 404);
    }

    // Verifica se già in wishlist (usando product_id)
    const existingItem = await query(
      'SELECT id FROM wishlist_items WHERE buyer_org_id = $1 AND product_id = $2',
      [orgId, productId]
    );

    if (existingItem.rows.length > 0) {
      return c.json({ error: 'Item already in wishlist' }, 409);
    }

    // Aggiungi alla wishlist usando product_id
    const hasPostgresConfig = process.env.PGHOST && process.env.PGUSER && process.env.PGPASSWORD;
    const isPostgreSQL = hasPostgresConfig;
    
    const noteValue = note || null;
    
    if (isPostgreSQL) {
      // PostgreSQL: usa RETURNING
      const result = await query(
        `INSERT INTO wishlist_items (buyer_org_id, product_id, note)
         VALUES ($1, $2, $3)
         RETURNING *`,
        [orgId, productId, noteValue]
      );

      if (result.rows.length === 0) {
        return c.json({ error: 'Failed to create wishlist item' }, 500);
      }

      return c.json(result.rows[0]);
    } else {
      // SQLite: inserisci e poi recupera
      const insertId = `wish_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      await query(
        `INSERT INTO wishlist_items (id, buyer_org_id, product_id, note)
         VALUES ($1, $2, $3, $4)`,
        [insertId, orgId, productId, noteValue]
      );

      // Recupera il record appena inserito
      const result = await query(
        'SELECT * FROM wishlist_items WHERE id = $1',
        [insertId]
      );

      if (result.rows.length === 0) {
        return c.json({ error: 'Failed to create wishlist item' }, 500);
      }

      return c.json(result.rows[0]);
    }

  } catch (error: any) {
    console.error('❌ Errore add to wishlist:', error);
    return c.json({
      error: 'Errore interno',
      message: error.message
    }, 500);
  }
});

// DELETE /api/ecommerce/wishlist/:itemId - Rimuovi item dalla wishlist
app.delete('/wishlist/:itemId', validateParams(DeleteItemParamsSchema), async (c) => {
  try {
    const { itemId } = c.get('validatedParams');

    const result = await query(
      'DELETE FROM wishlist_items WHERE id = $1 RETURNING *',
      [itemId]
    );

    if (result.rows.length === 0) {
      return c.json({ error: 'Wishlist item not found' }, 404);
    }

    return c.json({ message: 'Item removed from wishlist' });

  } catch (error: any) {
    console.error('❌ Errore remove from wishlist:', error);
    return c.json({
      error: 'Errore interno',
      message: error.message
    }, 500);
  }
});

// ============================================================================
// ADDRESS MANAGEMENT API
// ============================================================================

// GET /api/ecommerce/addresses - Ottieni indirizzi dell'organizzazione
app.get('/addresses', async (c) => {
  try {
    const orgId = c.req.query('orgId');
    const type = c.req.query('type'); // 'SHIPPING' o 'BILLING'

    if (!orgId) {
      return c.json({ error: 'Organization ID required' }, 400);
    }

    let queryStr = 'SELECT * FROM addresses WHERE org_id = $1';
    let params = [orgId];

    if (type) {
      queryStr += ' AND type = $2';
      params.push(type);
    }

    queryStr += ' ORDER BY is_default DESC, created_at DESC';

    const result = await query(queryStr, params);

    return c.json(result.rows);

  } catch (error: any) {
    console.error('❌ Errore get addresses:', error);
    return c.json({
      error: 'Errore interno',
      message: error.message
    }, 500);
  }
});

// POST /api/ecommerce/addresses - Crea nuovo indirizzo
app.post('/addresses', authMiddleware, validateBody(CreateAddressLegacySchema), async (c) => {
  try {
    const addressData = c.get('validatedBody');
    const { orgId, type, name, company, address_line, city, province, postal_code, country, phone, is_default } = addressData;

    if (!orgId || !type || !name || !address_line || !city || !province || !postal_code) {
      return c.json({ error: 'Required fields missing' }, 400);
    }

    // Se è default, rimuovi il flag da altri indirizzi dello stesso tipo
    if (is_default) {
      await query(
        'UPDATE addresses SET is_default = false WHERE org_id = $1 AND type = $2',
        [orgId, type]
      );
    }

    // Generate ID (cuid format) - ensure it's at least 25 chars and max 30
    const generateId = () => {
      const timestamp = Date.now().toString(36);
      const random = Math.random().toString(36).substring(2, 15);
      const id = `addr_${timestamp}${random}`;
      // Ensure minimum length of 25 chars, max 30
      return id.length >= 25 ? id.substring(0, 30) : id.padEnd(25, random).substring(0, 30);
    };
    
    const addressId = generateId();
    
    if (!addressId || addressId.length < 1) {
      return c.json({ error: 'Failed to generate address ID' }, 500);
    }
    
    const result = await query(
      `INSERT INTO addresses (id, org_id, type, name, company, address_line, city, province, postal_code, country, phone, is_default)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *`,
      [addressId, orgId, type, name, company, address_line, city, province, postal_code, country || 'IT', phone, is_default || false]
    );

    return c.json(result.rows[0]);

  } catch (error: any) {
    console.error('❌ Errore create address:', error);
    return c.json({
      error: 'Errore interno',
      message: error.message
    }, 500);
  }
});

// PUT /api/ecommerce/addresses/:addressId - Aggiorna indirizzo
app.put('/addresses/:addressId', authMiddleware, validateBody(UpdateAddressLegacySchema), async (c) => {
  try {
    const addressId = c.req.param('addressId');
    const updates = c.get('validatedBody');

    // Se sta impostando come default, rimuovi il flag da altri indirizzi
    if (updates.is_default) {
      const addressResult = await query('SELECT org_id, type FROM addresses WHERE id = $1', [addressId]);
      if (addressResult.rows.length > 0) {
        await query(
          'UPDATE addresses SET is_default = false WHERE org_id = $1 AND type = $2 AND id != $3',
          [addressResult.rows[0].org_id, addressResult.rows[0].type, addressId]
        );
      }
    }

    const setClause = Object.keys(updates).map((key, index) => `${key} = $${index + 2}`).join(', ');
    const values = Object.values(updates);
    values.unshift(addressId);

    const result = await query(
      `UPDATE addresses SET ${setClause} WHERE id = $1 RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return c.json({ error: 'Address not found' }, 404);
    }

    return c.json(result.rows[0]);

  } catch (error: any) {
    console.error('❌ Errore update address:', error);
    return c.json({
      error: 'Errore interno',
      message: error.message
    }, 500);
  }
});

// DELETE /api/ecommerce/addresses/:addressId - Elimina indirizzo
app.delete('/addresses/:addressId', validateParams(DeleteAddressParamsSchema), async (c) => {
  try {
    const { addressId } = c.get('validatedParams');

    const result = await query(
      'DELETE FROM addresses WHERE id = $1 RETURNING *',
      [addressId]
    );

    if (result.rows.length === 0) {
      return c.json({ error: 'Address not found' }, 404);
    }

    return c.json({ message: 'Address deleted' });

  } catch (error: any) {
    console.error('❌ Errore delete address:', error);
    return c.json({
      error: 'Errore interno',
      message: error.message
    }, 500);
  }
});

export default app;

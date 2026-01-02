import { Hono } from 'hono';
import { query } from '../utils/database';
import { validateBody } from '../middleware/validation';
import { authMiddleware } from '../middleware/auth';
import { CreateOrderFromCartSchema, UpdateOrderStatusSchema, CreateMessageSchema, MarkMessagesReadSchema } from '../schemas/api.schemas';

const app = new Hono();

// ============================================================================
// ORDER STATS
// ============================================================================

app.get('/stats', async (c) => {
  try {
    const orgId = c.req.query('orgId');

    if (!orgId) {
      return c.json({ error: 'Organization ID required' }, 400);
    }

    console.log('📊 Richiesta statistiche ordini per org:', orgId);

    // Calcola statistiche reali dagli ordini
    const statsQuery = `
      SELECT
        COUNT(*) as total_orders,
        COUNT(CASE WHEN status = 'PENDING' THEN 1 END) as pending_orders,
        COUNT(CASE WHEN status = 'DELIVERED' THEN 1 END) as completed_orders,
        COALESCE(SUM(total_cents), 0) as total_revenue_cents
      FROM orders
      WHERE buyer_org_id = $1
    `;

    const result = await query(statsQuery, [orgId]);
    const stats = result.rows[0];

    console.log('✅ Statistiche calcolate:', stats);

    return c.json({
      total_orders: parseInt(stats.total_orders) || 0,
      pending_orders: parseInt(stats.pending_orders) || 0,
      completed_orders: parseInt(stats.completed_orders) || 0,
      total_revenue_cents: parseInt(stats.total_revenue_cents) || 0
    });

  } catch (error: any) {
    console.error('❌ Errore get order stats:', error);
    return c.json({
      error: 'Errore interno',
      message: error.message
    }, 500);
  }
});

// ============================================================================
// ORDERS LIST
// ============================================================================

app.get('/', async (c) => {
  try {
    const orgId = c.req.query('orgId');
    const role = c.req.query('role'); // 'buyer' o 'seller' - opzionale, default: auto-detect

    if (!orgId) {
      return c.json({ error: 'Organization ID required' }, 400);
    }

    console.log('🛒 Richiesta ordini per org:', orgId, 'role:', role);

    // Determina se l'org è buyer o seller
    // Se role è specificato, usalo; altrimenti controlla l'organizzazione
    let isSeller = false;
    if (role === 'seller' || role === 'vendor') {
      isSeller = true;
    } else if (role === 'buyer') {
      isSeller = false;
    } else {
      // NUOVA LOGICA: determina se è provider dal tipo organizzazione
      const orgCheck = await query('SELECT type, org_type FROM organizations WHERE id = $1', [orgId]);
      if (orgCheck.rows.length > 0) {
        const org = orgCheck.rows[0];
        const orgType = (org.type || org.org_type || '').toLowerCase();
        // Provider è seller, con fallback per retrocompatibilità
        isSeller = orgType === 'provider' || orgType === 'vendor' || orgType === 'operator';
        console.log('🔍 Organization type check:', { orgId, orgType, isSeller });
      }
    }

    // Recupera ordini (SQLite non supporta JSON_AGG, quindi facciamo due query)
    const filterField = isSeller ? 'o.seller_org_id' : 'o.buyer_org_id';
    const ordersQuery = `
      SELECT
        o.id,
        o.buyer_org_id,
        o.seller_org_id,
        o.status,
        o.payment_status,
        o.total_cents,
        o.currency,
        o.shipping_address,
        o.billing_address,
        o.created_at,
        o.shipped_at,
        o.delivered_at,
        buyer_org.legal_name as buyer_org_name,
        seller_org.legal_name as seller_org_name
      FROM orders o
      LEFT JOIN organizations buyer_org ON o.buyer_org_id = buyer_org.id
      LEFT JOIN organizations seller_org ON o.seller_org_id = seller_org.id
      WHERE ${filterField} = $1
      ORDER BY o.created_at DESC
    `;

    console.log('🔍 Query ordini:', { orgId, isSeller, filterField, query: ordersQuery });
    const result = await query(ordersQuery, [orgId]);
    console.log('✅ Trovati', result.rows.length, 'ordini per', isSeller ? 'vendor' : 'buyer');
    
    // Per ogni ordine, recupera le righe
    const orders = await Promise.all(result.rows.map(async (order) => {
      const linesQuery = `
        SELECT ol.id, ol.sku_id, ol.quantity, ol.unit_price_cents, ol.line_total_cents,
               s.sku_code, p.name as product_name, p.model as product_model, p.brand
        FROM order_lines ol
        LEFT JOIN skus s ON ol.sku_id = s.id
        LEFT JOIN products p ON s.product_id = p.id
        WHERE ol.order_id = $1
      `;
      const linesResult = await query(linesQuery, [order.id]);
      
      // Parse JSON addresses
      let parsedShippingAddress = null;
      let parsedBillingAddress = null;
      try {
        parsedShippingAddress = typeof order.shipping_address === 'string' 
          ? JSON.parse(order.shipping_address) 
          : order.shipping_address;
        parsedBillingAddress = typeof order.billing_address === 'string'
          ? JSON.parse(order.billing_address)
          : order.billing_address;
      } catch (e) {
        console.warn('⚠️ Errore parsing indirizzi per ordine', order.id, ':', e);
      }
      
      return {
        id: order.id,
        order_number: order.id, // Usa ID come order_number se la colonna non esiste
        buyer_org_id: order.buyer_org_id,
        seller_org_id: order.seller_org_id,
        buyer_org_name: order.buyer_org_name,
        seller_org_name: order.seller_org_name,
        status: order.status,
        payment_status: order.payment_status,
        total_cents: parseInt(order.total_cents) || 0,
        currency: order.currency || 'EUR',
        shipping_address: parsedShippingAddress,
        billing_address: parsedBillingAddress,
        created_at: order.created_at,
        shipped_at: order.shipped_at,
        delivered_at: order.delivered_at,
        order_lines: linesResult.rows || []
      };
    }));

    console.log('✅ Recuperati', orders.length, 'ordini');

    return c.json(orders);

  } catch (error: any) {
    console.error('❌ Errore get orders:', error);
    return c.json({
      error: 'Errore interno',
      message: error.message
    }, 500);
  }
});

// ============================================================================
// CREATE ORDER FROM CART
// ============================================================================

app.post('/create-from-cart', authMiddleware, validateBody(CreateOrderFromCartSchema), async (c) => {
  try {
    const validatedBody = c.get('validatedBody') as any;
    const { cartId, shippingAddress, billingAddress, customerNotes } = validatedBody;

    console.log('🛒 Creazione ordine dal carrello:', cartId);

    // Recupera il carrello con gli items e i vendor
    const cartQuery = `
      SELECT
        sc.id,
        sc.user_id,
        sc.org_id,
        sc.session_id,
        ci.id as item_id,
        ci.sku_id,
        ci.quantity,
        ci.unit_price_cents,
        s.sku_code,
        p.name as product_name,
        p.model as product_model,
        p.brand,
        pr.price_cents as current_price,
        vci.vendor_org_id
      FROM shopping_carts sc
      JOIN cart_items ci ON sc.id = ci.cart_id
      JOIN skus s ON ci.sku_id = s.id
      JOIN products p ON s.product_id = p.id
      LEFT JOIN price_list_items pr ON s.id = pr.sku_id
      LEFT JOIN vendor_catalog_items vci ON vci.sku_id = s.id AND vci.is_for_sale = true
      WHERE sc.id = $1
    `;

    const cartResult = await query(cartQuery, [cartId]);

    if (cartResult.rows.length === 0) {
      return c.json({ error: 'Cart not found or empty' }, 404);
    }

    const cartItems = cartResult.rows;
    const cartData = cartItems[0]; // Prendi i dati del carrello dalla prima riga

    // Determina il vendor_org_id dai prodotti nel carrello
    // Se tutti i prodotti sono dello stesso vendor, usa quello
    // Altrimenti, usa il vendor del primo prodotto (o il più comune)
    const vendorOrgIds = cartItems
      .map(item => item.vendor_org_id)
      .filter(id => id != null && id !== '');
    
    if (vendorOrgIds.length === 0) {
      return c.json({ error: 'Nessun vendor trovato per i prodotti nel carrello' }, 400);
    }

    // Trova il vendor più comune (o usa il primo se tutti sono diversi)
    const vendorCounts: { [key: string]: number } = {};
    vendorOrgIds.forEach(vendorId => {
      vendorCounts[vendorId] = (vendorCounts[vendorId] || 0) + 1;
    });
    
    const sellerOrgId = Object.keys(vendorCounts).reduce((a, b) => 
      vendorCounts[a] > vendorCounts[b] ? a : b
    );

    console.log('🏪 Vendor determinato per ordine:', sellerOrgId, 'da', cartItems.length, 'prodotti');

    // Calcola totali
    let subtotalCents = 0;
    const orderLines = cartItems.map(item => {
      const unitPrice = item.unit_price_cents || item.current_price || 0;
      const lineTotal = unitPrice * item.quantity;
      subtotalCents += lineTotal;

      return {
        sku_id: item.sku_id,
        quantity: item.quantity,
        unit_price_cents: unitPrice,
        line_total_cents: lineTotal
      };
    });

    const shippingCents = subtotalCents > 50000 ? 0 : 2500; // Spedizione gratuita sopra €500
    const totalCents = subtotalCents + shippingCents;

    // Genera numero ordine unico
    const orderNumber = `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;

    // Crea l'ordine (SQLite non supporta RETURNING)
    const orderId = `ord_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();
    const orderQuery = `
      INSERT INTO orders (
        id, order_number, buyer_org_id, seller_org_id, quote_id, order_status, status, payment_status,
        total_cents, currency,
        shipping_address, billing_address, shipped_at, delivered_at, vendor_org_id,
        created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
    `;

    const orderValues = [
      orderId,
      orderNumber,
      cartData.org_id, // buyer_org_id
      sellerOrgId,
      null, // quote_id
      'CONFIRMED', // order_status
      'CONFIRMED', // status (duplicato per sicurezza)
      'PAID', // payment_status - Mock Stripe
      totalCents,
      'EUR',
      shippingAddress ? JSON.stringify(shippingAddress) : null,
      billingAddress ? JSON.stringify(billingAddress) : null,
      null, // shipped_at
      null, // delivered_at
      sellerOrgId, // vendor_org_id (duplicato di seller_org_id)
      now, // created_at
      now  // updated_at
    ];

    await query(orderQuery, orderValues);

    // Recupera l'ordine appena creato
    const orderResult = await query(
      'SELECT * FROM orders WHERE id = $1',
      [orderId]
    );
    
    if (orderResult.rows.length === 0) {
      return c.json({ error: 'Failed to create order' }, 500);
    }
    
    const order = orderResult.rows[0];

    // Crea le righe dell'ordine
    for (const line of orderLines) {
      const lineId = `ol_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      await query(
        `INSERT INTO order_lines (id, order_id, sku_id, quantity, unit_price_cents, line_total_cents)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [lineId, order.id, line.sku_id, line.quantity, line.unit_price_cents, line.line_total_cents]
      );
    }

    // AGGIORNA INVENTORY: riserva la quantità ordinata per ogni SKU
    console.log('📦 Aggiornando inventory per ordine:', orderNumber);
    for (const line of orderLines) {
      try {
        // Trova il vendor per questo SKU (potrebbe essere diverso per SKU diversi)
        const vendorResult = await query(`
          SELECT vendor_org_id FROM vendor_catalog_items
          WHERE sku_id = $1 AND is_for_sale = true
          LIMIT 1
        `, [line.sku_id]);

        if (vendorResult.rows.length > 0) {
          const vendorId = vendorResult.rows[0].vendor_org_id;

          // Aggiorna inventory: incrementa qty_reserved per la quantità ordinata
          const inventoryUpdate = await query(`
            UPDATE inventories
            SET qty_reserved = qty_reserved + $1,
                updated_at = NOW()
            WHERE sku_id = $2 AND vendor_org_id = $3
          `, [line.quantity, line.sku_id, vendorId]);

          console.log(`✅ Inventory aggiornato per SKU ${line.sku_id}: riservati +${line.quantity} presso vendor ${vendorId}`);
        } else {
          console.warn(`⚠️ Nessun vendor trovato per SKU ${line.sku_id}`);
        }
      } catch (inventoryError: any) {
        console.error(`❌ Errore aggiornamento inventory per SKU ${line.sku_id}:`, inventoryError.message);
        // Non fallire l'ordine per errori di inventory, ma loggare
      }
    }

    // Svuota il carrello
    await query('DELETE FROM cart_items WHERE cart_id = $1', [cartId]);

    console.log('✅ Ordine creato:', orderNumber);

    // Parse JSON addresses per la risposta
    let parsedShippingAddress = null;
    let parsedBillingAddress = null;
    try {
      parsedShippingAddress = typeof order.shipping_address === 'string' 
        ? JSON.parse(order.shipping_address) 
        : order.shipping_address;
      parsedBillingAddress = typeof order.billing_address === 'string'
        ? JSON.parse(order.billing_address)
        : order.billing_address;
    } catch (e) {
      console.warn('⚠️ Errore parsing indirizzi:', e);
    }

    return c.json({
      order: {
        id: order.id,
        order_number: order.order_number,
        status: order.status,
        payment_status: order.payment_status,
        total_cents: parseInt(order.total_cents) || 0,
        currency: order.currency || 'EUR',
        created_at: order.created_at || new Date().toISOString(),
        shipping_address: parsedShippingAddress,
        billing_address: parsedBillingAddress
      }
    });

  } catch (error: any) {
    console.error('❌ Errore create order from cart:', error);
    return c.json({
      error: 'Errore interno',
      message: error.message
    }, 500);
  }
});

// ============================================================================
// UPDATE ORDER STATUS
// ============================================================================

app.put('/:orderId/status', authMiddleware, validateBody(UpdateOrderStatusSchema), async (c) => {
  try {
    const orderId = c.req.param('orderId');
    const { order_status, tracking_number } = await c.req.json();

    if (!orderId || !order_status) {
      return c.json({ error: 'Order ID and status required' }, 400);
    }

    console.log('🔄 Aggiornamento status ordine:', orderId, '→', order_status);

    // Verifica che l'ordine esista
    const orderCheck = await query('SELECT id, seller_org_id FROM orders WHERE id = $1', [orderId]);
    if (orderCheck.rows.length === 0) {
      return c.json({ error: 'Order not found' }, 404);
    }

    // Aggiorna status (e tracking se fornito)
    const updateFields: string[] = ['status = $1'];
    const updateValues: any[] = [order_status];
    let paramIndex = 2;

    if (tracking_number) {
      updateFields.push(`tracking_number = $${paramIndex}`);
      updateValues.push(tracking_number);
      paramIndex++;
    }

    // Aggiorna timestamp in base allo status
    if (order_status === 'SHIPPED') {
      updateFields.push(`shipped_at = $${paramIndex}`);
      updateValues.push(new Date().toISOString());
      paramIndex++;
    } else if (order_status === 'DELIVERED' || order_status === 'FULFILLED') {
      updateFields.push(`delivered_at = $${paramIndex}`);
      updateValues.push(new Date().toISOString());
      paramIndex++;
    }

    updateFields.push(`updated_at = $${paramIndex}`);
    updateValues.push(new Date().toISOString());
    updateValues.push(orderId);

    const updateQuery = `
      UPDATE orders 
      SET ${updateFields.join(', ')}
      WHERE id = $${paramIndex + 1}
    `;

    const updateResult = await query(updateQuery, updateValues);
    
    // Guardrail: Se nessuna riga è stata aggiornata, ritorna 404
    // PostgreSQL restituisce rowCount, SQLite restituisce changes
    const affectedRows = updateResult.rowCount !== undefined ? updateResult.rowCount : (updateResult.changes || 0);
    if (affectedRows === 0) {
      return c.json({ error: 'Order not found or already in this status' }, 404);
    }

    // AGGIORNA INVENTORY quando l'ordine viene spedito o consegnato
    if (order_status === 'SHIPPED' || order_status === 'DELIVERED' || order_status === 'FULFILLED') {
      console.log('📦 Aggiornando inventory per spedizione/consegna ordine:', orderId);

      // Recupera le righe dell'ordine
      const orderLinesResult = await query(`
        SELECT ol.sku_id, ol.quantity, o.seller_org_id
        FROM order_lines ol
        JOIN orders o ON ol.order_id = o.id
        WHERE ol.order_id = $1
      `, [orderId]);

      for (const line of orderLinesResult.rows) {
        try {
          // Aggiorna inventory: decrementa qty_on_hand e azzera qty_reserved per la quantità spedita
          const inventoryUpdate = await query(`
            UPDATE inventories
            SET qty_on_hand = qty_on_hand - $1,
                qty_reserved = qty_reserved - $1,
                updated_at = NOW()
            WHERE sku_id = $2 AND vendor_org_id = $3
            AND qty_reserved >= $1  -- Sicurezza: non andare sotto zero
          `, [line.quantity, line.sku_id, line.seller_org_id]);

          console.log(`✅ Inventory aggiornato per SKU ${line.sku_id}: spediti -${line.quantity} dal vendor ${line.seller_org_id}`);
        } catch (inventoryError: any) {
          console.error(`❌ Errore aggiornamento inventory per SKU ${line.sku_id}:`, inventoryError.message);
        }
      }
    }

    // Recupera l'ordine aggiornato
    const orderResult = await query(`
      SELECT o.id, o.order_number, o.buyer_org_id, o.seller_org_id, o.status, o.payment_status,
             o.subtotal_cents, o.tax_cents, o.shipping_cents, o.total_cents, o.currency,
             o.shipping_address, o.billing_address, o.customer_notes, o.tracking_number,
             o.created_at, o.shipped_at, o.delivered_at,
             buyer_org.legal_name as buyer_org_name,
             seller_org.legal_name as seller_org_name
      FROM orders o
      LEFT JOIN organizations buyer_org ON o.buyer_org_id = buyer_org.id
      LEFT JOIN organizations seller_org ON o.seller_org_id = seller_org.id
      WHERE o.id = $1
    `, [orderId]);

    if (orderResult.rows.length === 0) {
      return c.json({ error: 'Order not found after update' }, 404);
    }

    const order = orderResult.rows[0];

    // Parse JSON addresses
    let parsedShippingAddress = null;
    let parsedBillingAddress = null;
    try {
      parsedShippingAddress = typeof order.shipping_address === 'string' 
        ? JSON.parse(order.shipping_address) 
        : order.shipping_address;
      parsedBillingAddress = typeof order.billing_address === 'string'
        ? JSON.parse(order.billing_address)
        : order.billing_address;
    } catch (e) {
      console.warn('⚠️ Errore parsing indirizzi:', e);
    }

    // Recupera righe ordine
    const linesQuery = `
      SELECT ol.id, ol.sku_id, ol.quantity, ol.unit_price_cents, ol.line_total_cents,
             s.sku_code, p.name as product_name, p.model as product_model, p.brand
      FROM order_lines ol
      LEFT JOIN skus s ON ol.sku_id = s.id
      LEFT JOIN products p ON s.product_id = p.id
      WHERE ol.order_id = $1
    `;
    const linesResult = await query(linesQuery, [orderId]);

    console.log('✅ Status ordine aggiornato:', order_status);

    return c.json({
      id: order.id,
      order_number: order.order_number,
      buyer_org_id: order.buyer_org_id,
      seller_org_id: order.seller_org_id,
      buyer_org_name: order.buyer_org_name,
      seller_org_name: order.seller_org_name,
      status: order.status,
      payment_status: order.payment_status,
      subtotal_cents: parseInt(order.subtotal_cents) || 0,
      tax_cents: parseInt(order.tax_cents) || 0,
      shipping_cents: parseInt(order.shipping_cents) || 0,
      total_cents: parseInt(order.total_cents) || 0,
      currency: order.currency || 'EUR',
      shipping_address: parsedShippingAddress,
      billing_address: parsedBillingAddress,
      customer_notes: order.customer_notes,
      tracking_number: order.tracking_number,
      created_at: order.created_at,
      shipped_at: order.shipped_at,
      delivered_at: order.delivered_at,
      order_lines: linesResult.rows || []
    });

  } catch (error: any) {
    console.error('❌ Errore update order status:', error);
    return c.json({
      error: 'Errore interno',
      message: error.message
    }, 500);
  }
});

// ============================================================================
// GET ORDER BY ID (must be after /:orderId/status and /:orderId/messages routes)
// ============================================================================

app.get('/:orderId', async (c) => {
  try {
    const orderId = c.req.param('orderId');

    if (!orderId) {
      return c.json({ error: 'Order ID required' }, 400);
    }

    console.log('📦 Richiesta dettaglio ordine:', orderId);

    // Recupera ordine
    const orderQuery = `
      SELECT
        o.id,
        o.order_number,
        o.buyer_org_id,
        o.seller_org_id,
        o.status,
        o.payment_status,
        o.subtotal_cents,
        o.tax_cents,
        o.shipping_cents,
        o.total_cents,
        o.currency,
        o.shipping_address,
        o.billing_address,
        o.customer_notes,
        o.tracking_number,
        o.created_at,
        o.shipped_at,
        o.delivered_at,
        buyer_org.legal_name as buyer_org_name,
        seller_org.legal_name as seller_org_name
      FROM orders o
      LEFT JOIN organizations buyer_org ON o.buyer_org_id = buyer_org.id
      LEFT JOIN organizations seller_org ON o.seller_org_id = seller_org.id
      WHERE o.id = $1
    `;

    const orderResult = await query(orderQuery, [orderId]);

    if (orderResult.rows.length === 0) {
      return c.json({ error: 'Order not found' }, 404);
    }

    const order = orderResult.rows[0];

    // Recupera righe ordine
    const linesQuery = `
      SELECT ol.id, ol.sku_id, ol.quantity, ol.unit_price_cents, ol.line_total_cents,
             s.sku_code, p.name as product_name, p.model as product_model, p.brand
      FROM order_lines ol
      LEFT JOIN skus s ON ol.sku_id = s.id
      LEFT JOIN products p ON s.product_id = p.id
      WHERE ol.order_id = $1
    `;
    const linesResult = await query(linesQuery, [orderId]);

    // Parse JSON addresses
    let parsedShippingAddress = null;
    let parsedBillingAddress = null;
    try {
      parsedShippingAddress = typeof order.shipping_address === 'string' 
        ? JSON.parse(order.shipping_address) 
        : order.shipping_address;
      parsedBillingAddress = typeof order.billing_address === 'string'
        ? JSON.parse(order.billing_address)
        : order.billing_address;
    } catch (e) {
      console.warn('⚠️ Errore parsing indirizzi:', e);
    }

    return c.json({
      id: order.id,
      order_number: order.order_number,
      buyer_org_id: order.buyer_org_id,
      seller_org_id: order.seller_org_id,
      buyer_org_name: order.buyer_org_name,
      seller_org_name: order.seller_org_name,
      status: order.status,
      payment_status: order.payment_status,
      subtotal_cents: parseInt(order.subtotal_cents) || 0,
      tax_cents: parseInt(order.tax_cents) || 0,
      shipping_cents: parseInt(order.shipping_cents) || 0,
      total_cents: parseInt(order.total_cents) || 0,
      currency: order.currency || 'EUR',
      shipping_address: parsedShippingAddress,
      billing_address: parsedBillingAddress,
      customer_notes: order.customer_notes,
      tracking_number: order.tracking_number,
      created_at: order.created_at,
      shipped_at: order.shipped_at,
      delivered_at: order.delivered_at,
      order_lines: linesResult.rows || []
    });

  } catch (error: any) {
    console.error('❌ Errore get order:', error);
    return c.json({
      error: 'Errore interno',
      message: error.message
    }, 500);
  }
});

// ============================================================================
// ORDER MESSAGES ROUTES
// ============================================================================

// GET MESSAGES FOR ORDER
app.get('/:orderId/messages', async (c) => {
  try {
    const orderId = c.req.param('orderId');

    if (!orderId) {
      return c.json({ error: 'Order ID required' }, 400);
    }

    console.log('💬 Richiesta messaggi per ordine:', orderId);

    const messagesQuery = `
      SELECT
        om.id,
        om.order_id,
        om.sender_org_id,
        om.sender_user_id,
        om.message_text,
        om.is_read,
        om.created_at,
        o.legal_name as sender_org_name
      FROM order_messages om
      LEFT JOIN organizations o ON om.sender_org_id = o.id
      WHERE om.order_id = $1
      ORDER BY om.created_at ASC
    `;

    const result = await query(messagesQuery, [orderId]);

    const messages = result.rows.map(msg => ({
      id: msg.id,
      order_id: msg.order_id,
      sender_org_id: msg.sender_org_id,
      sender_user_id: msg.sender_user_id,
      message_text: msg.message_text,
      is_read: msg.is_read === 1 || msg.is_read === true,
      created_at: msg.created_at,
      sender_org_name: msg.sender_org_name
    }));

    console.log('✅ Recuperati', messages.length, 'messaggi');

    return c.json(messages);

  } catch (error: any) {
    console.error('❌ Errore get messages:', error);
    return c.json({
      error: 'Errore interno',
      message: error.message
    }, 500);
  }
});

// POST MESSAGE
app.post('/:orderId/messages', authMiddleware, validateBody(CreateMessageSchema), async (c) => {
  try {
    const orderId = c.req.param('orderId');
    const { sender_org_id, sender_user_id, message_text } = c.get('validatedBody');

    console.log('💬 Creazione messaggio per ordine:', orderId);

    // Verifica che l'ordine esista
    const orderCheck = await query('SELECT id, buyer_org_id, seller_org_id FROM orders WHERE id = $1', [orderId]);
    if (orderCheck.rows.length === 0) {
      return c.json({ error: 'Order not found' }, 404);
    }

    const order = orderCheck.rows[0];
    
    // Verifica che il sender sia buyer o seller dell'ordine
    if (order.buyer_org_id !== sender_org_id && order.seller_org_id !== sender_org_id) {
      return c.json({ error: 'Unauthorized: You can only send messages for your own orders' }, 403);
    }

    // Crea messaggio
    const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const insertQuery = `
      INSERT INTO order_messages (id, order_id, sender_org_id, sender_user_id, message_text, is_read, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `;

    await query(insertQuery, [
      messageId,
      orderId,
      sender_org_id,
      sender_user_id || null,
      message_text,
      0, // is_read = false
      new Date().toISOString()
    ]);

    // Recupera il messaggio appena creato
    const messageResult = await query(`
      SELECT om.id, om.order_id, om.sender_org_id, om.sender_user_id, om.message_text, om.is_read, om.created_at,
             o.legal_name as sender_org_name
      FROM order_messages om
      LEFT JOIN organizations o ON om.sender_org_id = o.id
      WHERE om.id = $1
    `, [messageId]);

    const message = messageResult.rows[0];

    console.log('✅ Messaggio creato:', messageId);

    return c.json({
      id: message.id,
      order_id: message.order_id,
      sender_org_id: message.sender_org_id,
      sender_user_id: message.sender_user_id,
      message_text: message.message_text,
      is_read: message.is_read === 1 || message.is_read === true,
      created_at: message.created_at,
      sender_org_name: message.sender_org_name
    });

  } catch (error: any) {
    console.error('❌ Errore create message:', error);
    return c.json({
      error: 'Errore interno',
      message: error.message
    }, 500);
  }
});

// MARK MESSAGES AS READ
app.put('/:orderId/messages/read', authMiddleware, validateBody(MarkMessagesReadSchema), async (c) => {
  try {
    const orderId = c.req.param('orderId');
    const { reader_org_id } = c.get('validatedBody');

    console.log('💬 Marca messaggi come letti per ordine:', orderId);

    // Verifica che l'ordine esista e che il reader sia buyer o seller
    const orderCheck = await query('SELECT id, buyer_org_id, seller_org_id FROM orders WHERE id = $1', [orderId]);
    if (orderCheck.rows.length === 0) {
      return c.json({ error: 'Order not found' }, 404);
    }

    const order = orderCheck.rows[0];
    
    // Verifica che il reader sia buyer o seller dell'ordine
    if (order.buyer_org_id !== reader_org_id && order.seller_org_id !== reader_org_id) {
      return c.json({ error: 'Unauthorized' }, 403);
    }

    // Marca come letti solo i messaggi NON inviati dal reader stesso
    await query(`
      UPDATE order_messages 
      SET is_read = 1 
      WHERE order_id = $1 
        AND sender_org_id != $2
        AND is_read = 0
    `, [orderId, reader_org_id]);

    console.log('✅ Messaggi marcati come letti');

    return c.json({ success: true });

  } catch (error: any) {
    console.error('❌ Errore mark messages as read:', error);
    return c.json({
      error: 'Errore interno',
      message: error.message
    }, 500);
  }
});

export default app;

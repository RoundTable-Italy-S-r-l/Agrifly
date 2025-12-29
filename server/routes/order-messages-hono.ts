import { Hono } from 'hono';
import { query } from '../utils/database';

const app = new Hono();

// ============================================================================
// GET MESSAGES FOR ORDER
// ============================================================================

app.get('/:orderId', async (c) => {
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

// ============================================================================
// POST MESSAGE
// Route: POST /api/orders/:orderId/messages
// ============================================================================

app.post('/:orderId/messages', async (c) => {
  try {
    const orderId = c.req.param('orderId');
    const { sender_org_id, sender_user_id, message_text } = await c.req.json();

    if (!orderId || !sender_org_id || !message_text) {
      return c.json({ error: 'Order ID, sender org ID, and message text required' }, 400);
    }

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

// ============================================================================
// MARK MESSAGES AS READ
// Route: PUT /api/orders/:orderId/messages/read
// ============================================================================

app.put('/:orderId/messages/read', async (c) => {
  try {
    const orderId = c.req.param('orderId');
    const { reader_org_id } = await c.req.json();

    if (!orderId || !reader_org_id) {
      return c.json({ error: 'Order ID and reader org ID required' }, 400);
    }

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


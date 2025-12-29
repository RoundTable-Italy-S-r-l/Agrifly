const { Client } = require('pg');

const client = new Client({
  host: process.env.PGHOST,
  port: Number(process.env.PGPORT || '5432'),
  database: process.env.PGDATABASE,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  ssl: { rejectUnauthorized: false }
});

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    await client.connect();
    
    const orgId = event.queryStringParameters?.orgId;
    const userId = event.queryStringParameters?.userId;
    const sessionId = event.queryStringParameters?.sessionId;
    
    if (!orgId || (!userId && !sessionId)) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'orgId and either userId or sessionId required' })
      };
    }

    console.log('🛒 Cart request:', { orgId, userId, sessionId });

    // Build cart query
    let cartQuery;
    let cartParams;
    
    if (userId) {
      cartQuery = 'SELECT id FROM shopping_carts WHERE user_id = $1 AND org_id = $2';
      cartParams = [userId, orgId];
    } else if (sessionId) {
      cartQuery = 'SELECT id FROM shopping_carts WHERE session_id = $1 AND org_id = $2';
      cartParams = [sessionId, orgId];
    }

    const cartResult = await client.query(cartQuery, cartParams);

    if (cartResult.rows.length === 0) {
      // Create new cart
      const cartId = `cart_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      let insertQuery;
      let insertParams;
      
      if (userId) {
        insertQuery = 'INSERT INTO shopping_carts (id, user_id, org_id, created_at, updated_at) VALUES ($1, $2, $3, $4, $5)';
        insertParams = [cartId, userId, orgId, new Date().toISOString(), new Date().toISOString()];
      } else {
        insertQuery = 'INSERT INTO shopping_carts (id, session_id, org_id, created_at, updated_at) VALUES ($1, $2, $3, $4, $5)';
        insertParams = [cartId, sessionId, orgId, new Date().toISOString(), new Date().toISOString()];
      }
      
      await client.query(insertQuery, insertParams);
      
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cart: { id: cartId },
          items: []
        })
      };
    }

    const cart = cartResult.rows[0];

    // Get cart items
    const itemsQuery = `
      SELECT ci.id, ci.cart_id, ci.sku_id, ci.quantity, ci.unit_price_cents, ci.created_at,
             s.sku_code, p.name as product_name, p.model as product_model, p.brand
      FROM cart_items ci
      JOIN skus s ON ci.sku_id = s.id
      JOIN products p ON s.product_id = p.id
      WHERE ci.cart_id = $1
      ORDER BY ci.created_at
    `;

    const itemsResult = await client.query(itemsQuery, [cart.id]);
    const items = itemsResult.rows;

    console.log('✅ Cart returned:', { cartId: cart.id, itemsCount: items.length });

    await client.end();

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cart,
        items
      })
    };

  } catch (error) {
    console.error('❌ Cart error:', error);
    
    try {
      await client.end();
    } catch (e) {
      // Ignore
    }
    
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: 'Internal server error',
        message: error.message 
      })
    };
  }
};

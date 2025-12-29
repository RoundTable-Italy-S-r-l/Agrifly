const { Client } = require('pg');
const jwt = require('jsonwebtoken');

const client = new Client({
  host: process.env.PGHOST,
  port: Number(process.env.PGPORT || '5432'),
  database: process.env.PGDATABASE,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  ssl: { rejectUnauthorized: false }
});

const JWT_SECRET = process.env.JWT_SECRET;

function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
}

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    // Get token from Authorization header
    const authHeader = event.headers.authorization || event.headers.Authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return {
        statusCode: 401,
        body: JSON.stringify({ error: 'No token provided' })
      };
    }

    const token = authHeader.substring(7); // Remove 'Bearer '
    const decoded = verifyToken(token);
    
    if (!decoded) {
      return {
        statusCode: 401,
        body: JSON.stringify({ error: 'Invalid token' })
      };
    }

    console.log('✅ Token verified for user:', decoded.userId);

    await client.connect();

    // Get user details
    const userResult = await client.query(`
      SELECT u.id, u.email, u.first_name, u.last_name, u.role as user_role, 
             om.role as membership_role, om.is_active as membership_active,
             o.id as org_id, o.legal_name, 
             COALESCE(o.type, o.org_type::text, 'buyer') as org_type
      FROM users u
      LEFT JOIN org_memberships om ON u.id = om.user_id AND om.is_active = true
      LEFT JOIN organizations o ON om.org_id = o.id
      WHERE u.id = $1 AND u.status = 'ACTIVE'
    `, [decoded.userId]);

    ifuserResult.rows.length === 0) {
      await client.end();
      return {
        statusCode: 401,
        body: JSON.stringify({ error: 'User not found' })
      };
    }

    const user = userResult.rows[0];

    const response = {
      user: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        email_verified: true,
        role: user.membership_role || user.user_role || 'admin'
      },
      organization: user.org_id ? {
        id: user.org_id,
        name: user.legal_name,
        type: user.org_type,
        can_buy: user.org_type === 'buyer',
        can_sell: user.org_type === 'vendor',
        can_operate: (user.membership_role === 'operator' || user.membership_role === 'dispatcher'),
        can_dispatch: user.membership_role === 'dispatcher'
      } : null
    };

    await client.end();

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(response)
    };

  } catch (error) {
    console.error('❌ Auth/me error:', error);
    
    try {
      await client.end();
    } catch (e) {}
    
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
};

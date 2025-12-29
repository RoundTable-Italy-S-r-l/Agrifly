const { Client } = require('pg');
const bcrypt = require('bcryptjs');

const client = new Client({
  host: process.env.PGHOST,
  port: Number(process.env.PGPORT || '5432'),
  database: process.env.PGDATABASE,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  ssl: { rejectUnauthorized: false }
});

function verifyPassword(password, hash, salt) {
  if (!hash || !salt) return false;
  
  const crypto = require('crypto');
  const saltBytes = Buffer.from(salt, 'hex');
  const computedHash = crypto.pbkdf2Sync(password, saltBytes, 100000, 64, 'sha256').toString('hex');
  const storedHash = Buffer.from(hash, 'hex');
  const computedHashBytes = Buffer.from(computedHash, 'hex');
  
  return crypto.timingSafeEqual(computedHashBytes, storedHash);
}

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { email, password } = JSON.parse(event.body);

    if (!email || !password) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Email and password required' })
      };
    }

    await client.connect();

    const userResult = await client.query(`
      SELECT u.id, u.email, u.first_name, u.last_name, u.password_salt, u.password_hash,
             u.email_verified, u.role as user_role, 
             om.role as membership_role, om.is_active as membership_active,
             o.id as org_id, o.legal_name, 
             COALESCE(o.type, o.org_type::text, 'buyer') as org_type
      FROM users u
      LEFT JOIN org_memberships om ON u.id = om.user_id AND om.is_active = true
      LEFT JOIN organizations o ON om.org_id = o.id
      WHERE u.email = $1 AND u.status = 'ACTIVE'
    `, [email]);

    if (userResult.rows.length === 0) {
      return {
        statusCode: 401,
        body: JSON.stringify({ error: 'Invalid credentials' })
      };
    }

    const user = userResult.rows[0];
    
    const passwordValid = verifyPassword(password, user.password_hash, user.password_salt);
    
    if (!passwordValid) {
      return {
        statusCode: 401,
        body: JSON.stringify({ error: 'Invalid credentials' })
      };
    }

    const token = 'dummy-token-' + Date.now();

    const response = {
      token,
      user: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        email_verified: user.email_verified || false,
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
    try {
      await client.end();
    } catch (e) {}
    
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
};

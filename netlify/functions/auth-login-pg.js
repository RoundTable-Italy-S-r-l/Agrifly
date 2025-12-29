const { Client } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Configurazione database PostgreSQL diretta
const client = new Client({
  host: process.env.PGHOST,
  port: Number(process.env.PGPORT || '5432'),
  database: process.env.PGDATABASE,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  ssl: { rejectUnauthorized: false }
});

const JWT_SECRET = process.env.JWT_SECRET;

function generateToken(user, organization) {
  return jwt.sign({
    userId: user.id,
    email: user.email,
    orgId: organization?.id,
    role: user.membership_role || 'admin',
    exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60)
  }, JWT_SECRET);
}

async function verifyPassword(password, hash, salt) {
  if (!hash || !salt) return false;
  
  const bcrypt = require('bcryptjs');
  // Prima prova bcrypt (legacy)
  if (hash.startsWith('$2')) {
    return await bcrypt.compare(password, hash);
  }
  
  // Poi PBKDF2 (nuovo sistema)
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
      body: JSON.stringify({ error: 'Metodo non permesso' })
    };
  }

  try {
    const { email, password } = JSON.parse(event.body);

    if (!email || !password) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Email e password sono obbligatori' })
      };
    }

    console.log('🔐 Login tentativo per:', email);
    
    await client.connect();

    // Query per trare utente con membership
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
      console.log('❌ Utente non trovato o non attivo');
      return {
        statusCode: 401,
        body: JSON.stringify({ error: 'Credenziali non valide' })
      };
    }

    const user = userResult.rows[0];
    console.log('✅ Utente trovato:', user.id);

    // Verifica password
    const passwordValid = await verifyPassword(password, user.password_, user.password_salt);
    
    if (!passwordValid) {
      console.log('❌ Password non valida');
      return {
        statusCode: 401,
        body: JSON.stringify({ error: 'Credenziali non valide' })
      };
    }

    console.log('✅ Password verificata');

    // Genera token
    const token = generateToken(user, user.org_id ? { id: user.org_id } : null);

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
        can_dispatch: user.membership_role =dispatcher'
      } : null
    };

    console.log('✅ Login riuscito');
    
    await client.end();
    
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(response)
    };

  } catch (error) {
    console.error('❌ Errore login:', error);
    
    try {
      await client.end();
    } catch (e) {
      // Ignora errori di chiusura
    }
    
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Errore interno del server' })
    };
  }
};

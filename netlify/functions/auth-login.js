const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);
const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret';

function generateToken(user, organization) {
  return jwt.sign({
    userId: user.id,
    email: user.email,
    orgId: organization.id,
    exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 24 ore
  }, JWT_SECRET);
}

async function verifyPassword(password, hash) {
  return await bcrypt.compare(password, hash);
}

exports.handler = async (event, context) => {
  // Solo metodi POST
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

    // Trova l'utente
    const { data: user, error: userError } = await supabase
      .from('user')
      .select(`
        *,
        org_memberships (
          *,
          org (*)
        )
      `)
      .eq('email', email)
      .single();

    if (userError || !user || !user.password_hash) {
      return {
        statusCode: 401,
        body: JSON.stringify({ error: 'Credenziali non valide' })
      };
    }

    // Verifica password
    const isValidPassword = await verifyPassword(password, user.password_hash);
    if (!isValidPassword) {
      return {
        statusCode: 401,
        body: JSON.stringify({ error: 'Credenziali non valide' })
      };
    }

    // Controlla che l'utente abbia almeno un'organizzazione attiva
    const activeMembership = user.org_memberships?.find(m => m.is_active);
    if (!activeMembership) {
      return {
        statusCode: 401,
        body: JSON.stringify({ error: 'Account non attivo' })
      };
    }

    const organization = activeMembership.org;

    // Genera token JWT
    const token = generateToken(user, organization);

    const responseData = {
      token,
      user: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        email_verified: user.email_verified
      },
      organization: {
        id: organization.id,
        legal_name: organization.legal_name,
        can_buy: organization.can_buy,
        can_sell: organization.can_sell,
        can_operate: organization.can_operate,
        can_dispatch: organization.can_dispatch,
        role: activeMembership.role,
        isAdmin: activeMembership.role === 'ADMIN' || activeMembership.role === 'OWNER'
      }
    };

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(responseData)
    };

  } catch (error) {
    console.error('Login error:', error);
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ error: 'Errore interno del server' })
    };
  }
};

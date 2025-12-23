import type { Handler } from "@netlify/functions";
import { Client } from "pg";

// Funzione per generare JWT semplice (senza libreria esterna)
function generateJWT(payload: any): string {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString('base64url');
  const body = Buffer.from(JSON.stringify({
    ...payload,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60) // 7 giorni
  })).toString('base64url');
  const signature = Buffer.from("netlify_function_signature").toString('base64url'); // Firma fissa per ora
  return `${header}.${body}.${signature}`;
}

const handler: Handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  const { email } = JSON.parse(event.body || "{}");
  if (!email) {
    return {
      statusCode: 400,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ error: "Email richiesta" }),
    };
  }

  let client: Client | null = null;

  try {
    console.log('🔍 Inizio connessione database...');

    // Connessione diretta al database PostgreSQL
    client = new Client({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    });

    console.log('🔌 Connessione al database...');
    await client.connect();
    console.log('✅ Connessione riuscita');

    // Trova utente per email
    console.log('👤 Cerco utente per email:', email);
    const userQuery = `
      SELECT id, email, first_name, last_name
      FROM users
      WHERE email = $1
    `;
    const userResult = await client.query(userQuery, [email]);
    console.log('📊 Risultato query utente:', userResult.rows.length, 'righe');

    if (userResult.rows.length === 0) {
      console.log('❌ Utente non trovato per email:', email);
      return {
        statusCode: 404,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ error: "Utente non trovato" }),
      };
    }

    const user = userResult.rows[0];
    console.log('✅ Utente trovato:', user.id, user.email);

    // Trova membership attivo per l'utente
    console.log('🏢 Cerco membership attivo per user:', user.id);
    const membershipQuery = `
      SELECT om.role, om.org_id, o.legal_name
      FROM org_memberships om
      JOIN organizations o ON om.org_id = o.id
      WHERE om.user_id = $1 AND om.is_active = true
    `;
    const membershipResult = await client.query(membershipQuery, [user.id]);
    console.log('📊 Risultato query membership:', membershipResult.rows.length, 'righe');

    if (membershipResult.rows.length === 0) {
      console.log('❌ Nessuna membership attiva trovata');
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ error: "Nessuna organizzazione attiva" }),
      };
    }

    if (membershipResult.rows.length > 1) {
      console.log('⚠️ Multiple memberships attive trovate');
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ error: "Multiple organizzazioni attive - contattare amministratore" }),
      };
    }

    const membership = membershipResult.rows[0];
    const isAdmin = membership.role === "BUYER_ADMIN" || membership.role === "VENDOR_ADMIN";
    console.log('✅ Membership trovata:', membership.org_id, membership.legal_name, membership.role);

    // Genera JWT
    const token = generateJWT({
      userId: user.id,
      orgId: membership.org_id,
      role: membership.role,
      isAdmin,
    });

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
      },
      body: JSON.stringify({
        token,
        user: {
          id: user.id,
          email: user.email,
          first_name: user.first_name,
          last_name: user.last_name,
        },
        organization: {
          id: membership.org_id,
          name: membership.legal_name,
          role: membership.role,
          isAdmin,
        },
      }),
    };

  } catch (error: any) {
    console.error("❌ Errore database:", error);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ error: "Errore interno del server" }),
    };
  } finally {
    if (client) {
      await client.end();
    }
  }
};

export { handler };

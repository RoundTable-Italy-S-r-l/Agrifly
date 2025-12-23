import type { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";
import jwt from "jsonwebtoken";

// Inizializza Supabase con service role key
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Funzione per generare JWT
const generateJWT = (payload: any) => {
  const secret = process.env.JWT_SECRET || "fallback-secret";
  return jwt.sign(payload, secret, { expiresIn: "7d" });
};

const handler: Handler = async (event) => {
  try {
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

    // Trova utente
    const { data: user, error: userError } = await supabase
      .from("users")
      .select("id, email, first_name, last_name")
      .eq("email", email)
      .single();

    if (userError || !user) {
      return {
        statusCode: 404,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ error: "Utente non trovato" }),
      };
    }

    // Trova membership attivo
    const { data: membership, error: membershipError } = await supabase
      .from("org_memberships")
      .select(`
        role,
        org_id,
        organizations (
          id,
          legal_name
        )
      `)
      .eq("user_id", user.id)
      .eq("is_active", true)
      .single();

    if (membershipError || !membership) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ error: "Nessuna organizzazione attiva" }),
      };
    }

    const isAdmin = membership.role === "BUYER_ADMIN" || membership.role === "VENDOR_ADMIN";

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
        user,
        organization: {
          id: membership.org_id,
          name: membership.organizations.legal_name,
          role: membership.role,
          isAdmin,
        },
      }),
    };

  } catch (error: any) {
    console.error("❌ Errore:", error.message);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ error: "Internal server error" }),
    };
  }
};

export { handler };

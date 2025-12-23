import type { Handler } from "@netlify/functions";
import { PrismaClient } from "@prisma/client";
import jwt from "jsonwebtoken";

// Inizializza Prisma con configurazione Netlify
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
});

// Funzione per generare JWT
const generateJWT = (payload: any) => {
  const secret = process.env.JWT_SECRET || "fallback-secret";
  return jwt.sign(payload, secret, { expiresIn: "7d" });
};

const handler: Handler = async (event) => {
  try {
    const { httpMethod, path, body } = event;

    console.log('🔍 Netlify function chiamata:', { httpMethod, path });

    // Gestisci l'endpoint exchange-token
    // Il path può essere /.netlify/functions/api/auth/exchange-token o /.netlify/functions/api
    if ((path === "/.netlify/functions/api/auth/exchange-token" ||
         (path === "/.netlify/functions/api" && event.queryStringParameters?.path === "auth/exchange-token")) &&
        httpMethod === "POST") {
      const { supabaseToken, email } = JSON.parse(body || "{}");

      if (!email) {
        return {
          statusCode: 400,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Content-Type",
          },
          body: JSON.stringify({ error: "Email richiesta" }),
        };
      }

      console.log("🔍 Cerco utente per email:", email, "con body:", JSON.parse(body || "{}"));

      // Trova utente con memberships attivi
      const user = await prisma.user.findUnique({
        where: { email },
        include: {
          org_memberships: {
            where: { is_active: true },
            include: {
              org: true,
            },
          },
        },
      });

      if (!user) {
        console.log("❌ Utente non trovato:", email);
        return {
          statusCode: 404,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
          body: JSON.stringify({ error: "Utente non trovato" }),
        };
      }

      console.log("✅ Utente trovato:", user.email);

      if (user.org_memberships.length !== 1) {
        console.log("❌ Utente deve avere esattamente una organizzazione attiva");
        return {
          statusCode: 400,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
          body: JSON.stringify({ error: "Configurazione organizzazioni non valida" }),
        };
      }

      const membership = user.org_memberships[0];
      const isAdmin = membership.role === "BUYER_ADMIN" || membership.role === "VENDOR_ADMIN";

      console.log("✅ Organizzazione trovata:", membership.org.legal_name, "ruolo:", membership.role);

      // Genera JWT
      const token = generateJWT({
        userId: user.id,
        orgId: membership.org_id,
        role: membership.role,
        isAdmin,
      });

      console.log("✅ JWT generato per user:", user.id);

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
            id: membership.org.id,
            name: membership.org.legal_name,
            role: membership.role,
            isAdmin,
          },
        }),
      };
    }

    // Endpoint non trovato
    return {
      statusCode: 404,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({ error: "Endpoint not found" }),
    };

  } catch (error: any) {
    console.error("❌ Errore Netlify function:", error);
    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({
        error: "Internal server error",
        message: error.message,
      }),
    };
  }
};

export { handler };

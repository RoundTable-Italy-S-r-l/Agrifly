import type { Handler } from "@netlify/functions";
import { Resend } from "resend";
import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
};

function code6(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export const handler: Handler = async (event) => {
  try {
    if (event.httpMethod === "OPTIONS") {
      return { statusCode: 200, headers: corsHeaders, body: "" };
    }

    if (event.httpMethod !== "POST") {
      return {
        statusCode: 405,
        headers: corsHeaders,
        body: JSON.stringify({ error: "Method not allowed" }),
      };
    }

    const { email } = JSON.parse(event.body || "{}");
    if (!email) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: "Missing email" }),
      };
    }

    const SUPABASE_URL = process.env.SUPABASE_URL!;
    const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const RESEND_API_KEY = process.env.RESEND_API_KEY!;

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !RESEND_API_KEY) {
      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({ error: "Missing server env vars" }),
      };
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const resend = new Resend(RESEND_API_KEY);

    const verificationCode = code6();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 minuti

    // Salva su tabella verification_codes (adatta i nomi colonne se diversi)
    const { error: dbError } = await supabase.from("verification_codes").insert({
      email,
      code: verificationCode,
      expires_at: expiresAt,
      created_at: new Date().toISOString(),
    });

    if (dbError) {
      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({ error: "DB insert failed", details: dbError.message }),
      };
    }

    // Invia email via Resend
    const { error: mailError } = await resend.emails.send({
      from: "Agrifly <no-reply@agrifly.it>",
      to: [email],
      subject: "Codice di verifica",
      html: `<p>Il tuo codice di verifica è: <strong>${verificationCode}</strong></p><p>Scade tra 10 minuti.</p>`,
    });

    if (mailError) {
      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({ error: "Email send failed", details: String(mailError) }),
      };
    }

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ ok: true }),
    };
  } catch (e: any) {
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: "Unhandled error", details: e?.message || String(e) }),
    };
  }
};

import type { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";

// Funzione per generare JWT semplice (senza libreria esterna)
function generateJWT(payload: any): string {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString('base64url');
  const body = Buffer.from(JSON.stringify({
    ...payload,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60) // 7 giorni
  })).toString('base64url');
  const signature = Buffer.from("netlify_function_signature").toString('base64url');
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

  try {
    console.log('🔍 Uso Supabase client per email:', email);

    // Usa Supabase client con service role (ha accesso a tutte le tabelle)
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Prima prova a vedere se esiste l'utente nelle nostre tabelle custom
    console.log('👤 Cerco utente nelle tabelle custom...');
    const { data: customUser, error: customError } = await supabase
      .from('users')
      .select('id, email, first_name, last_name')
      .eq('email', email)
      .single();

    if (customUser && !customError) {
      console.log('✅ Utente trovato in tabella custom:', customUser.id);

      // Trova membership attivo
      const { data: membership, error: membershipError } = await supabase
        .from('org_memberships')
        .select(`
          role,
          org_id,
          organizations (
            id,
            legal_name
          )
        `)
        .eq('user_id', customUser.id)
        .eq('is_active', true)
        .single();

      if (membership && !membershipError) {
        const isAdmin = membership.role === "BUYER_ADMIN" || membership.role === "VENDOR_ADMIN";

        console.log('✅ Membership trovata:', membership.organizations.legal_name, membership.role);

        // Genera JWT
        const token = generateJWT({
          userId: customUser.id,
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
            user: customUser,
            organization: {
              id: membership.org_id,
              name: membership.organizations.legal_name,
              role: membership.role,
              isAdmin,
            },
          }),
        };
      }
    }

    // Fallback: se non trovato nelle tabelle custom, usa auth.users di Supabase
    console.log('🔄 Fallback: cerco in auth.users Supabase...');
    const { data: authUser, error: authError } = await supabase.auth.admin.getUserByEmail(email);

    if (authUser?.user && !authError) {
      console.log('✅ Utente trovato in auth.users:', authUser.user.id);

      // Crea organizzazione di default se non esiste
      const orgName = `${authUser.user.user_metadata?.first_name || ''} ${authUser.user.user_metadata?.last_name || ''}`.trim() || email.split('@')[0];

      const { data: org, error: orgError } = await supabase
        .from('organizations')
        .upsert({
          id: `org_${authUser.user.id}`,
          legal_name: orgName,
          org_type: 'FARM',
          address_line: '',
          city: '',
          province: '',
          region: '',
          status: 'ACTIVE'
        })
        .select()
        .single();

      if (org && !orgError) {
        // Crea membership
        await supabase
          .from('org_memberships')
          .upsert({
            org_id: org.id,
            user_id: authUser.user.id,
            role: 'BUYER_ADMIN',
            is_active: true
          });

        const isAdmin = true;

        // Genera JWT
        const token = generateJWT({
          userId: authUser.user.id,
          orgId: org.id,
          role: 'BUYER_ADMIN',
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
              id: authUser.user.id,
              email: authUser.user.email,
              first_name: authUser.user.user_metadata?.first_name || '',
              last_name: authUser.user.user_metadata?.last_name || '',
            },
            organization: {
              id: org.id,
              name: org.legal_name,
              role: 'BUYER_ADMIN',
              isAdmin,
            },
          }),
        };
      }
    }

    console.log('❌ Utente non trovato né in custom né in auth tables');
    return {
      statusCode: 404,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ error: "Utente non trovato" }),
    };

  } catch (error: any) {
    console.error("❌ Errore:", error.message);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ error: "Errore interno del server" }),
    };
  }
};

export { handler };

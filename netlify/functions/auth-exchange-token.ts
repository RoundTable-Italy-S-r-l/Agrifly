import type { Handler } from "@netlify/functions";

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

  // Mock response per ora - utente Lenzi con dati hardcoded
  const mockUser = {
    id: "user_giacomo",
    email: "giacomo.cavalcabo14@gmail.com",
    first_name: "Giacomo",
    last_name: "Cavalcabo"
  };

  const mockOrg = {
    id: "lenzi-org-id",
    name: "Lenzi Agricola Srl",
    role: "VENDOR_ADMIN",
    isAdmin: true
  };

  // JWT semplice senza libreria esterna
  const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = btoa(JSON.stringify({
    userId: mockUser.id,
    orgId: mockOrg.id,
    role: mockOrg.role,
    isAdmin: mockOrg.isAdmin,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60) // 7 giorni
  }));
  const signature = "mock_signature"; // Firma mock per ora
  const token = `${header}.${payload}.${signature}`;

  return {
    statusCode: 200,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type",
    },
    body: JSON.stringify({
      token,
      user: mockUser,
      organization: mockOrg,
    }),
  };
};

export { handler };

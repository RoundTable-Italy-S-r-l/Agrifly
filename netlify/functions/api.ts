import { Hono } from 'hono';
// Import dinamico per evitare problemi con moduli ESM/CJS
let app: any;
async function getApp() {
  if (!app) {
    // Import dinamico per evitare problemi con file-db.ts e altri moduli problematici
    const module = await import('../../server/hono-app');
    app = module.default;
  }
  return app;
}

// Crea handler per Netlify Functions
export async function handler(event: any, context: any) {
  try {
    console.log('🚀 Netlify Function chiamata:', event.httpMethod, event.path);
    console.log('📋 Headers:', Object.keys(event.headers));
    console.log('🔧 Context disponibile');

    // Verifica env variables critiche
    const hasPgHost = !!process.env.PGHOST;
    const hasPgUser = !!process.env.PGUSER;
    const hasPgPassword = !!process.env.PGPASSWORD;
    const hasJwtSecret = !!process.env.JWT_SECRET;

    console.log('✅ PGHOST:', hasPgHost ? 'presente' : 'MANCANTE');
    console.log('✅ PGUSER:', hasPgUser ? 'presente' : 'MANCANTE');
    console.log('✅ PGPASSWORD:', hasPgPassword ? 'presente' : 'MANCANTE');
    console.log('✅ JWT_SECRET:', hasJwtSecret ? 'presente' : 'MANCANTE');

    if (!hasPgHost || !hasPgUser || !hasPgPassword || !hasJwtSecret) {
      console.error('❌ Env variables critiche mancanti');
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: 'Server configuration error',
          details: {
            pghost: hasPgHost,
            pguser: hasPgUser,
            pgpassword: hasPgPassword,
            jwt: hasJwtSecret
          }
        })
      };
    }

    // Carica l'app dinamicamente
    const honoAppInstance = await getApp();
    
    // Wrappa l'app Hono per Netlify
    const honoApp = new Hono();

    // Monta l'app principale
    honoApp.route('/', honoAppInstance);

    // Costruisci URL corretto per Netlify
    const host = event.headers.host || 'localhost';
    const protocol = event.headers['x-forwarded-proto'] || 'https';

    // Prepara il body per Hono (Netlify passa il body come stringa)
    let requestBody = undefined;
    if (event.body && event.httpMethod !== 'GET' && event.httpMethod !== 'HEAD') {
      // Se è JSON, mantieni come stringa (Hono lo parserà)
      if (event.headers['content-type']?.includes('application/json')) {
        requestBody = event.body;
      } else {
        requestBody = event.body;
      }
    }

    // Log dettagliato per debug routing
    const fullUrl = `${protocol}://${host}${event.path}${event.queryStringParameters ? '?' + new URLSearchParams(event.queryStringParameters).toString() : ''}`;
    console.log('🔍 [NETLIFY HANDLER] Full URL:', fullUrl);
    console.log('🔍 [NETLIFY HANDLER] Event path:', event.path);
    console.log('🔍 [NETLIFY HANDLER] Has Authorization header:', !!event.headers.authorization);
    
    // Gestisci la richiesta con Hono
    const response = await honoApp.fetch(
      new Request(fullUrl, {
        method: event.httpMethod,
        headers: event.headers,
        body: requestBody
      }),
      {
        ...context,
        event
      }
    );
    
    console.log('🔍 [NETLIFY HANDLER] Response status:', response.status);
    console.log('🔍 [NETLIFY HANDLER] Response headers:', Object.fromEntries(response.headers.entries()));

    console.log('📤 Response:', response.status);

    // Converte la Response di Hono in formato Netlify
    return {
      statusCode: response.status,
      headers: Object.fromEntries(response.headers.entries()),
      body: await response.text()
    };

  } catch (error: any) {
    console.error('❌ Errore nella Netlify Function:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: 'Internal server error',
        message: error.message,
        stack: error.stack?.split('\n').slice(0, 5)
      })
    };
  }
}

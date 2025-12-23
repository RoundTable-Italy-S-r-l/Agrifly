import { Hono } from 'hono';
import app from '../../server/hono-app';

// Crea handler per Netlify Functions
export async function handler(event: any, context: any) {
  try {
    console.log('🚀 Netlify Function chiamata:', event.httpMethod, event.path);
    console.log('📋 Headers:', Object.keys(event.headers));
    console.log('🔧 Context disponibile');

    // Verifica env variables critiche
    const hasDbUrl = !!process.env.DATABASE_URL;
    const hasJwtSecret = !!process.env.JWT_SECRET;
    const hasSupabaseKey = !!process.env.SUPABASE_SERVICE_ROLE_KEY;

    console.log('✅ DATABASE_URL:', hasDbUrl ? 'presente' : 'MANCANTE');
    console.log('✅ JWT_SECRET:', hasJwtSecret ? 'presente' : 'MANCANTE');
    console.log('✅ SUPABASE_SERVICE_ROLE_KEY:', hasSupabaseKey ? 'presente' : 'MANCANTE');

    if (!hasDbUrl || !hasJwtSecret) {
      console.error('❌ Env variables critiche mancanti');
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: 'Server configuration error',
          details: {
            database: hasDbUrl,
            jwt: hasJwtSecret,
            supabase: hasSupabaseKey
          }
        })
      };
    }

    // Wrappa l'app Hono per Netlify
    const honoApp = new Hono();

    // Monta l'app principale
    honoApp.route('/', app);

    // Costruisci URL corretto per Netlify
    const host = event.headers.host || 'localhost';
    const protocol = event.headers['x-forwarded-proto'] || 'https';

    // Gestisci la richiesta con Hono
    const response = await honoApp.fetch(
      new Request(`${protocol}://${host}${event.path}`, {
        method: event.httpMethod,
        headers: event.headers,
        body: event.body
      }),
      {
        ...context,
        event
      }
    );

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
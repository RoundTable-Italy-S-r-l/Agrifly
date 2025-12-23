import { Hono } from 'hono';
import app from '../../server/hono-app';

// Crea handler per Netlify Functions
export async function handler(event: any, context: any) {
  // Wrappa l'app Hono per Netlify
  const honoApp = new Hono();

  // Monta l'app principale
  honoApp.route('/', app);

  // Gestisci la richiesta con Hono
  const response = await honoApp.fetch(
    new Request(`https://localhost${event.path}`, {
      method: event.httpMethod,
      headers: event.headers,
      body: event.body
    }),
    {
      ...context,
      event
    }
  );

  // Converte la Response di Hono in formato Netlify
  return {
    statusCode: response.status,
    headers: Object.fromEntries(response.headers.entries()),
    body: await response.text()
  };
}
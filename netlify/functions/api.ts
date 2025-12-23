import type { Handler, HandlerEvent, HandlerContext } from "@netlify/functions";
import { createServer } from "../../server/index.js";

// Cache del server Express
let server: any = null;

const handler: Handler = async (event, context) => {
  try {
    // Inizializza il server se non esiste
    if (!server) {
      console.log('🚀 Inizializzazione server Express per Netlify...');
      server = createServer();
    }

    // Simula una richiesta HTTP per Express
    const { httpMethod, path, headers, body, queryStringParameters } = event;

    // Rimuovi '/.netlify/functions/api' dal path per ottenere il path relativo
    const relativePath = path.replace('/.netlify/functions/api', '') || '/';

    // Costruisci l'URL relativo
    const url = new URL(relativePath, 'http://localhost:3001');
    if (queryStringParameters) {
      Object.entries(queryStringParameters).forEach(([key, value]) => {
        if (value) url.searchParams.set(key, value);
      });
    }

    // Crea una richiesta mock per Express
    const req = Object.assign(url, {
      method: httpMethod,
      headers: {
        ...headers,
        host: 'localhost:3001'
      },
      body: body ? JSON.parse(body) : undefined,
      query: queryStringParameters || {}
    });

    // Crea una risposta mock
    let responseBody = '';
    let responseStatus = 200;
    let responseHeaders: Record<string, string> = {
      'Content-Type': 'application/json'
    };

    const res = {
      status: (code: number) => {
        responseStatus = code;
        return res;
      },
      json: (data: any) => {
        responseBody = JSON.stringify(data);
        return res;
      },
      send: (data: any) => {
        responseBody = data;
        return res;
      },
      setHeader: (key: string, value: string) => {
        responseHeaders[key] = value;
        return res;
      },
      end: () => {
        // Fine risposta
      }
    };

    // Gestisci la richiesta con Express
    // Nota: Questo è un workaround semplificato
    // In produzione dovremmo usare un adapter Express-Netlify più robusto

    // Per ora, gestiamo solo le routes che ci servono
    if (relativePath.startsWith('/auth/exchange-token') && httpMethod === 'POST') {
      // Import dinamico per evitare problemi di bundling
      const { exchangeSupabaseToken } = await import('../../server/routes/auth.js');

      // Mock request/response per Express
      const mockReq = {
        body: body ? JSON.parse(body) : {}
      };

      const mockRes = {
        status: (code: number) => ({
          json: (data: any) => {
            responseStatus = code;
            responseBody = JSON.stringify(data);
          }
        }),
        json: (data: any) => {
          responseBody = JSON.stringify(data);
        }
      };

      await exchangeSupabaseToken(mockReq as any, mockRes as any);
    } else {
      responseStatus = 404;
      responseBody = JSON.stringify({ error: 'Endpoint not found' });
    }

    return {
      statusCode: responseStatus,
      headers: {
        ...responseHeaders,
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
      },
      body: responseBody
    };

  } catch (error: any) {
    console.error('❌ Errore Netlify function:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        error: 'Internal server error',
        message: error.message
      })
    };
  }
};

export { handler };

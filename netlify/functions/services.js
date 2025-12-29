const { createClient } = require('@supabase/supabase-js');
const jwt = require('jsonwebtoken');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);
const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret';

function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
}

exports.handler = async (event, context) => {
  // Gestisci richieste OPTIONS per CORS
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
      },
      body: ''
    };
  }

  try {
    // Verifica autenticazione
    const authHeader = event.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return {
        statusCode: 401,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ error: 'Token mancante' })
      };
    }

    const token = authHeader.substring(7);
    const decoded = verifyToken(token);

    if (!decoded) {
      return {
        statusCode: 401,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ error: 'Token non valido' })
      };
    }

    const pathParts = event.path.split('/');
    const isExploreBucket = pathParts.includes('explore-bucket');

    if (isExploreBucket) {
      // Route speciale per esplorare il bucket - TEMPORANEAMENTE senza autenticazione per debug
      console.log('🔍 [DEBUG] Accesso a explore-bucket permesso temporaneamente');
    } else {
      // Route normale che richiede orgId
      const { orgId } = event.pathParameters || {};
      if (!orgId) {
        return {
          statusCode: 400,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ error: 'orgId richiesto' })
        };
      }

      const userId = decoded.userId;

      // Verifica che l'utente appartenga all'organizzazione
      const { data: membership, error: membershipError } = await supabase
        .from('org_membership')
        .select('*')
        .eq('org_id', orgId)
        .eq('user_id', userId)
        .eq('is_active', true)
        .single();

      if (membershipError || !membership) {
        return {
          statusCode: 403,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ error: 'Accesso negato' })
        };
      }
    }

    // Routing basato sul metodo HTTP e path
    if (event.path.includes('/explore-bucket') && event.httpMethod === 'GET') {
      // GET /api/services/explore-bucket - Esplora bucket Supabase
      console.log('🔍 Esplorando bucket Media FIle...');

      try {
        if (!process.env.SUPABASE_STORAGE_BUCKET) {
          return {
            statusCode: 500,
            headers: {
              'Access-Control-Allow-Origin': '*',
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ error: 'SUPABASE_STORAGE_BUCKET environment variable not set' })
          };
        }
        const bucketName = process.env.SUPABASE_STORAGE_BUCKET;
        const { data: files, error } = await supabase.storage
          .from(bucketName)
          .list('', {
            limit: 1000,
            sortBy: { column: 'name', order: 'asc' }
          });

        if (error) {
          console.error('Errore list bucket:', error);
          return {
            statusCode: 500,
            headers: {
              'Access-Control-Allow-Origin': '*',
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ error: 'Errore accesso bucket', details: error })
          };
        }

        console.log(`📁 Trovati ${files.length} file nella root`);

        // Esplora sottocartelle
        const folders = [...new Set(files.filter(f => f.name.includes('/')).map(f => f.name.split('/')[0]))];
        console.log(`📂 Sottocartelle trovate: ${folders.join(', ')}`);

        const folderContents = {};

        for (const folder of folders) {
          try {
            const { data: folderFiles, error: folderError } = await supabase.storage
              .from(bucketName)
              .list(folder, {
                limit: 100,
                sortBy: { column: 'name', order: 'asc' }
              });

            if (!folderError && folderFiles) {
              folderContents[folder] = folderFiles;
              console.log(`📁 ${folder}: ${folderFiles.length} file`);
            }
          } catch (e) {
            console.log(`❌ Errore esplorando ${folder}:`, e.message);
          }
        }

        return {
          statusCode: 200,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            rootFiles: files,
            folders,
            folderContents
          }, null, 2)
        };

      } catch (error) {
        console.error('Errore esplorazione bucket:', error);
        return {
          statusCode: 500,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ error: 'Errore interno esplorazione bucket' })
        };
      }
    }

    if (event.httpMethod === 'GET') {
      // GET /api/services/:orgId - Lista rate cards
      const { data: rateCards, error: rateCardsError } = await supabase
        .from('rate_card')
        .select('*')
        .eq('org_id', orgId)
        .eq('is_active', true)
        .order('service_type', { ascending: true })
        .order('crop_type', { ascending: true })
        .order('treatment_type', { ascending: true });

      if (rateCardsError) {
        console.error('Rate cards error:', rateCardsError);
        return {
          statusCode: 500,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ error: 'Errore nel recupero dei servizi' })
        };
      }

      return {
        statusCode: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(rateCards)
      };

    } else if (event.httpMethod === 'POST') {
      // POST /api/services/:orgId - Crea rate card
      if (membership.role !== 'ADMIN' && membership.role !== 'OWNER') {
        return {
          statusCode: 403,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ error: 'Ruolo amministratore richiesto' })
        };
      }

      const rateCardData = JSON.parse(event.body);
      const { data: rateCard, error: createError } = await supabase
        .from('rate_card')
        .insert({
          org_id: orgId,
          ...rateCardData
        })
        .select()
        .single();

      if (createError) {
        console.error('Create rate card error:', createError);
        return {
          statusCode: 500,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ error: 'Errore nella creazione del servizio' })
        };
      }

      return {
        statusCode: 201,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(rateCard)
      };
    }

    return {
      statusCode: 405,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ error: 'Metodo non supportato' })
    };

  } catch (error) {
    console.error('Services API error:', error);
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ error: 'Errore interno del server' })
    };
  }
};

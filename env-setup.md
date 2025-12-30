# Configurazione Ambiente - Supabase

## Per configurare la connessione a Supabase:

1. Crea un file `.env` nella directory principale del progetto
2. Copia il contenuto seguente e inserisci le tue credenziali reali

```bash
# Supabase Configuration
SUPABASE_URL=https://fzowfkfwriajohjjboed.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

# Frontend Supabase (VITE_ prefix)
VITE_SUPABASE_URL=https://fzowfkfwriajohjjboed.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here

# PostgreSQL Direct Connection (for server-side operations)
PGHOST=aws-1-eu-central-2.pooler.supabase.com
PGPORT=6543
PGDATABASE=postgres
PGUSER=postgres.fzowfkfwriajohjjboed
PGPASSWORD=your-password-here

# JWT Secret (generate a secure random string - at least 32 characters)
JWT_SECRET=your-jwt-secret-here

# Frontend URL (update with your actual domain)
FRONTEND_URL=http://localhost:8082

# Optional: Email service (Resend)
# RESEND_API_KEY=your-resend-api-key-here
# RESEND_FROM_EMAIL=DJI Agriculture <noreply@dji-agriculture.com>

# Optional: Routing service (GraphHopper)
# GRAPHHOPPER_API_KEY=your-graphhopper-api-key-here

# Optional: OpenAI (for AI features)
# OPENAI_API_KEY=your-openai-api-key-here
```

## Come ottenere le credenziali Supabase:

1. Vai su [Supabase Dashboard](https://supabase.com/dashboard)
2. Seleziona il tuo progetto
3. Vai su **Settings > API**
4. Copia:
   - **Project URL** → `SUPABASE_URL` e `VITE_SUPABASE_URL`
   - **anon public** → `SUPABASE_ANON_KEY` e `VITE_SUPABASE_ANON_KEY`
   - **service_role** → `SUPABASE_SERVICE_ROLE_KEY`

## Come ottenere le credenziali PostgreSQL:

1. Nel Supabase Dashboard, vai su **Settings > Database**
2. Nella sezione **Connection info**, copia:
   - **Host** → `PGHOST`
   - **Database** → `PGDATABASE`
   - **Username** → `PGUSER`
   - **Password** → `PGPASSWORD`
   - **Port** → `PGPORT`

## Generare JWT_SECRET:

Puoi generare un secret sicuro con:
```bash
openssl rand -base64 32
# oppure
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

## Test della connessione:

Dopo aver configurato il file `.env`, puoi testare la connessione con:
```bash
npm run dev
```

Verifica nei log del server che appaia:
- "🔧 Configuration loaded:"
- "Database: PostgreSQL" (se usi Supabase)
- Nessun errore di connessione

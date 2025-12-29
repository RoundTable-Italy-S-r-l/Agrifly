# Netlify Setup Guide

## 1. Supabase Database Setup

1. Crea un nuovo progetto su [Supabase](https://supabase.com)
2. Copia lo schema Prisma nel SQL Editor di Supabase
3. Esegui le migrazioni per creare le tabelle

## 2. Environment Variables

Configura queste variabili in Netlify Dashboard > Site Settings > Environment Variables:

### Frontend (VITE_ prefix)
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### Backend (Netlify Functions) - CRITICHE
```
PGHOST=aws-1-eu-central-2.pooler.supabase.com
PGPORT=6543
PGDATABASE=postgres
PGUSER=postgres.fzowfkfwriajohjjboed
PGPASSWORD=_Mszqe_%uF_82%@
JWT_SECRET=your-secure-jwt-secret
FRONTEND_URL=https://your-site.netlify.app
```

### Backend (Netlify Functions) - Opzionali
```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
RESEND_API_KEY=your-resend-key
GRAPHHOPPER_API_KEY=your-graphhopper-key
OPENAI_API_KEY=your-openai-key
```

### Optional
```
OPENAI_API_KEY=your-openai-key
```

## 3. Build Settings

Netlify dovrebbe riconoscere automaticamente il `netlify.toml`. Verifica che:
- Build command: `npm run build`
- Publish directory: `dist`

## 4. Deploy

1. Push del codice su GitHub/GitLab
2. Connetti il repository a Netlify
3. Netlify deployerà automaticamente con le Functions

## 5. Testing

Dopo il deploy, testa:
- Login: `https://your-site.netlify.app/login`
- API: `https://your-site.netlify.app/api/auth/login`

## Database Schema Migration

Esegui questo SQL in Supabase per creare le tabelle necessarie:

```sql
-- Copia qui il contenuto del file prisma/schema.prisma convertito in SQL
-- Nota: Supabase usa PostgreSQL, quindi converti i tipi Prisma di conseguenza
```

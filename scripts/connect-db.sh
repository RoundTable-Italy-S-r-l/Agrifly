#!/bin/bash
# Script per connettersi a Supabase Postgres via psql
# Uso: ./scripts/connect-db.sh

# Carica variabili d'ambiente da .env se esiste
if [ -f .env ]; then
  export $(cat .env | grep -v '^#' | xargs)
fi

# Usa variabili d'ambiente - NON hardcodare credenziali!
DB_PASSWORD="${PGPASSWORD:-${DATABASE_URL#*:}}"
PROJECT_REF="${SUPABASE_PROJECT_REF:-fzowfkfwriajohjjboed}"

if [ -z "$DB_PASSWORD" ]; then
  echo "❌ Errore: PGPASSWORD o DATABASE_URL non configurati"
  echo "Configura le variabili d'ambiente nel file .env"
  exit 1
fi

# Usa Transaction Pooler (porta 6543, supporta IPv4)
# Formato: postgresql://postgres:PASSWORD@db.PROJECT_REF.supabase.co:6543/postgres
echo "🔄 Connessione via Transaction Pooler (porta 6543)..."
export PGPASSWORD="$DB_PASSWORD"
psql "host=db.${PROJECT_REF}.supabase.co port=6543 dbname=postgres user=postgres sslmode=require"


#!/bin/bash
# Script per connettersi a Supabase Postgres via psql
# Uso: ./scripts/connect-db.sh

# Carica variabili d'ambiente da .env se esiste
if [ -f .env ]; then
  export $(cat .env | grep -v '^#' | xargs)
fi

# Password (URL-encoded: % diventa %25)
DB_PASSWORD="66tY3_C_%5iAR8c"
PROJECT_REF="fzowfkfwriajohjjboed"

# Usa Transaction Pooler (porta 6543, supporta IPv4)
# Formato: postgresql://postgres:PASSWORD@db.PROJECT_REF.supabase.co:6543/postgres
echo "🔄 Connessione via Transaction Pooler (porta 6543)..."
export PGPASSWORD="$DB_PASSWORD"
psql "host=db.${PROJECT_REF}.supabase.co port=6543 dbname=postgres user=postgres sslmode=require"


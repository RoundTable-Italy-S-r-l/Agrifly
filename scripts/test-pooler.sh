#!/bin/bash
# Script per testare connessione via Session Pooler (porta 5432) o Transaction Pooler (porta 6543)
# Uso: ./scripts/test-pooler.sh

# Carica variabili d'ambiente da .env se esiste
if [ -f .env ]; then
  export $(cat .env | grep -v '^#' | xargs)
fi

# Password (URL-encoded: % diventa %25)
DB_PASSWORD="66tY3_C_%5iAR8c"
PROJECT_REF="fzowfkfwriajohjjboed"

echo "🔄 Test connessione via Pooler..."
echo ""

# Prova regioni comuni
REGIONS=("eu-central-1" "us-east-1" "us-west-1" "ap-southeast-1" "eu-west-1" "eu-west-2" "eu-west-3" "eu-north-1")

# Test 1: Session Pooler (porta 5432, username: postgres.PROJECT_REF)
echo "📋 Test 1: Session Pooler (porta 5432) - per persistent backend"
for REGION in "${REGIONS[@]}"; do
  echo "  Testando region: $REGION (session mode)"
  export PGPASSWORD="$DB_PASSWORD"
  if psql "host=aws-0-${REGION}.pooler.supabase.com port=5432 dbname=postgres user=postgres.${PROJECT_REF} sslmode=require" -c "SELECT 1;" 2>/dev/null; then
    echo ""
    echo "✅ ✅ ✅ Connessione riuscita con Session Pooler!"
    echo "Region: $REGION"
    echo ""
    echo "Connection string da usare in .env:"
    echo "DATABASE_URL=\"postgresql://postgres.${PROJECT_REF}:66tY3_C_%255iAR8c@aws-0-${REGION}.pooler.supabase.com:5432/postgres?sslmode=require\""
    exit 0
  fi
done

echo ""
echo "📋 Test 2: Transaction Pooler (porta 6543, username: postgres)"
# Test 2: Transaction Pooler (porta 6543, username: postgres)
export PGPASSWORD="$DB_PASSWORD"
if psql "host=db.${PROJECT_REF}.supabase.co port=6543 dbname=postgres user=postgres sslmode=require" -c "SELECT 1;" 2>/dev/null; then
  echo ""
  echo "✅ ✅ ✅ Connessione riuscita con Transaction Pooler!"
  echo ""
  echo "Connection string da usare in .env:"
  echo "DATABASE_URL=\"postgresql://postgres:66tY3_C_%255iAR8c@db.${PROJECT_REF}.supabase.co:6543/postgres?sslmode=require\""
  exit 0
fi

echo ""
echo "⚠️ Nessuna connessione riuscita."
echo ""
echo "🔍 Prossimi passi:"
echo "1. Vai su: https://supabase.com/dashboard/project/${PROJECT_REF}/settings/database"
echo "2. Clicca su 'Connect' in alto"
echo "3. Copia la connection string del 'Pooler session mode' o 'Pooler transaction mode'"
echo "4. Incollala qui e aggiornerò il .env"


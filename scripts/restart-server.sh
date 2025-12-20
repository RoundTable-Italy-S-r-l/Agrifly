#!/bin/bash
# Script per riavviare il server Express con la nuova DATABASE_URL

echo "🛑 Fermando server sulla porta 3001..."
lsof -ti:3001 | xargs kill -9 2>/dev/null && echo "✅ Server fermato" || echo "⚠️ Nessun server in esecuzione"

echo ""
echo "🚀 Riavvio server..."
npm run server


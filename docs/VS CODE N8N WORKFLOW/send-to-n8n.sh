#!/bin/bash
# ============================================================================
# UFOVAL - Envoi des séjours vers n8n via Webhook
# ============================================================================
# Usage:
#   ./scripts/ufoval/send-to-n8n.sh
#
# Prérequis:
#   - Avoir exécuté les scripts de scraping UFOVAL
#   - Le fichier out/ufoval/rewrite_ready_final.json doit exister
#   - Le webhook n8n doit être configuré avec le même secret
# ============================================================================

set -e

# ============================================================================
# CONFIGURATION
# ============================================================================

# URL du webhook n8n
WEBHOOK_URL="https://n8n.srv1307641.hstgr.cloud/webhook/ufoval-import"

# Secret pour sécurisation (envoyé dans un header, pas dans l'URL)
WEBHOOK_SECRET="ged-ufoval-2026"

# Chemin vers le fichier JSON à envoyer
JSON_FILE="$(dirname "$0")/../../out/ufoval/rewrite_ready_final.json"

# ============================================================================
# VÉRIFICATIONS
# ============================================================================

echo "🔍 Vérifications..."

# Vérifier que le fichier JSON existe
if [ ! -f "$JSON_FILE" ]; then
  echo "❌ Erreur: Fichier non trouvé : $JSON_FILE"
  echo ""
  echo "💡 Solution: Exécutez d'abord les scripts de scraping UFOVAL"
  exit 1
fi

# Vérifier que le fichier JSON est valide
if ! jq empty "$JSON_FILE" 2>/dev/null; then
  echo "⚠️  Attention: jq n'est pas installé, pas de validation JSON"
else
  # Compter le nombre de séjours
  STAY_COUNT=$(jq 'length' "$JSON_FILE")
  echo "📊 $STAY_COUNT séjours trouvés dans le JSON"
fi

echo ""
echo "📤 Envoi vers n8n..."
echo "   URL: $WEBHOOK_URL"
echo "   Secret: $WEBHOOK_SECRET (dans header X-Webhook-Secret)"
echo "   Fichier: $JSON_FILE"
echo ""

# ============================================================================
# ENVOI VERS N8N
# ============================================================================

# Envoi avec curl
RESPONSE=$(curl -s -w "\n%{http_code}" \
  -X POST \
  "$WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Secret: $WEBHOOK_SECRET" \
  -H "X-Source: GED-UFOVAL-Script" \
  -d @"$JSON_FILE")

# Séparer body et code HTTP
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
RESPONSE_BODY=$(echo "$RESPONSE" | sed '$d')

# Vérifier le code HTTP
if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "201" ] || [ "$HTTP_CODE" = "204" ]; then
  echo "✅ Succès ! Données envoyées à n8n (HTTP $HTTP_CODE)"
  echo ""
  echo "📋 Réponse:"
  echo "$RESPONSE_BODY" | jq . 2>/dev/null || echo "$RESPONSE_BODY"
  echo ""
  echo "🎯 Prochaine étape: Vérifier dans Supabase"
  echo "   - Table gd_stays : SELECT COUNT(*) FROM gd_stays WHERE import_batch_ts >= NOW() - INTERVAL '5 minutes';"
  echo "   - Table gd_stay_sessions : SELECT COUNT(*) FROM gd_stay_sessions WHERE import_batch_ts >= NOW() - INTERVAL '5 minutes';"
else
  echo "❌ Erreur HTTP $HTTP_CODE"
  echo ""
  echo "📋 Réponse:"
  echo "$RESPONSE_BODY"
  echo ""
  echo "💡 Vérifications:"
  echo "   - L'URL du webhook est-elle correcte ?"
  echo "   - Le header X-Webhook-Secret correspond-il à celui configuré dans n8n ?"
  echo "   - Le workflow n8n est-il activé ?"
  exit 1
fi

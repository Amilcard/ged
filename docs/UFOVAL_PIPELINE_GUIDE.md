# 🚀 Pipeline UFOVAL - Guide d'Installation et d'Utilisation

## 📋 Vue d'ensemble

Ce pipeline automatise l'intégration des séjours UFOVAL dans la base de données GED :

```
UFOVAL Website → n8n → GED API → Supabase → Frontend
```

### Fonctionnalités

- ✅ **Scraping automatique** des séjours UFOVAL (France, Espagne)
- ✅ **Filtrage par dates** (3 juillet - 30 août)
- ✅ **Extraction des données** :
  - Sessions (dates, durées, prix base + promo)
  - Villes de départ (avec suppléments de transport)
  - Descriptifs des séjours
- ✅ **Reformulation automatique** pour les travailleurs sociaux
- ✅ **Synchronisation** avec Supabase
- ✅ **Exclusion des séjours complets**

---

## 🛠️ Prérequis

### 1. n8n installé et configuré

```bash
# Installer n8n
npm install -g n8n

# Ou avec Docker
docker run -it --rm \
  --name n8n \
  -p 5678:5678 \
  -v ~/.n8n:/home/node/.n8n \
  n8nio/n8n
```

### 2. API Keys GED

Générer une clé API dans n8n :
1. Ouvrir n8n (http://localhost:5678)
2. Settings → Credentials → Add Credential
3. Type : "Header Auth"
4. Name : "GED API Auth"
5. Header Name : "Authorization"
6. Header Value : `Bearer <VOTRE_TOKEN_GED>`

### 3. Clé API Supabase (optionnelle)

Si vous utilisez Supabase directement :

```env
SUPABASE_URL=votre_url_supabase
SUPABASE_ANON_KEY=votre_clé_anon
SUPABASE_SERVICE_ROLE_KEY=votre_clé_service
```

---

## 📦 Installation du Workflow

### Étape 1 : Importer le workflow n8n

1. Copier le contenu de `n8n-workflows/ufoval-scraper-workflow.json`
2. Dans n8n : **Workflows** → **Import from File/URL**
3. Coller le contenu JSON
4. Sauvegarder le workflow

### Étape 2 : Configurer les credentials

Dans le workflow importé, configurer :

1. **GED API Auth** (Header Auth)
   - Name : `Authorization`
   - Value : `Bearer VOTRE_JWT_TOKEN`

### Étape 3 : Activer le workflow

1. Cliquer sur **"Inactive"** pour le rendre **"Active"**
2. Le scheduler s'exécutera tous les jours à 2h du matin

---

## 🗄️ Structure des Données

### Format JSON d'entrée (n8n → API)

```json
{
  "source_url": "https://ufoval.fol74.org/sejours-colonies-de-vacances-a-la-mer/destination-soleil",
  "title": "Destination Soleil",
  "description": "Vitesse, sensations fortes et super moments entre amis...",
  "category": "Mer",
  "filtered_sessions": [
    {
      "start_date": "2026-07-04",
      "end_date": "2026-07-17",
      "duration_days": 14,
      "base_price_eur": 1095,
      "promo_price_eur": 1007,
      "has_promo": true
    }
  ],
  "departures": [
    {
      "city": "annecy",
      "city_label": "Annecy",
      "extra_eur": 170,
      "transport_id": "14750"
    }
  ],
  "scraped_at": "2025-01-29T10:00:00.000Z"
}
```

### Format en base de données (Prisma/Supabase)

```sql
-- Table stays
id              UUID PRIMARY KEY
title           TEXT
slug            TEXT UNIQUE
sourceUrl       TEXT
contentKids     JSONB
priceFrom       INTEGER
published       BOOLEAN
lastSyncAt      TIMESTAMP

-- Table stay_sessions
id              UUID PRIMARY KEY
stayId          UUID REFERENCES stays(id)
startDate       TIMESTAMP
endDate         TIMESTAMP
basePrice       INTEGER
promoPrice      INTEGER
seats           INTEGER
availableSeats  INTEGER
```

---

## 🔌 Endpoints API

### POST /api/admin/stays

Créer un nouveau séjour depuis n8n.

**Headers :**
```
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json
```

**Body :**
```json
{
  "title": "Destination Soleil",
  "description": "Description...",
  "sourceUrl": "https://ufoval.fol74.org/...",
  "priceFrom": 1007,
  "contentKids": {
    "sessions": [...],
    "departures": [...]
  },
  "published": true
}
```

### POST /api/admin/sessions/bulk-sync

Synchroniser en masse les sessions.

**Body :**
```json
{
  "sessions": [
    {
      "start_date": "2026-07-04",
      "end_date": "2026-07-17",
      "base_price_eur": 1095,
      "promo_price_eur": 1007
    }
  ],
  "source_url": "https://ufoval.fol74.org/..."
}
```

### GET /api/ufoval-enrichment

Récupérer toutes les données d'enrichment (merge UFOVAL).

---

## 🤖 Script de Reformulation

### Utiliser le script de reformulation

```bash
# Exécuter après un scraping n8n
npx ts-node scripts/n8n/refactor-ufoval-content.ts
```

Le script génère : `out/ufoval/ufoval_refactored.json`

### Format de sortie

```json
{
  "original_title": "Destination Soleil !",
  "refactored_title": "Séjour éducatif - Destination Soleil",
  "refactored_description": "Ce séjour éducatif proposé par notre partenaire UFOVAL...",
  "key_points": [
    "Séance de scrambler",
    "Sortie voilier",
    "Parc aquatique"
  ],
  "educational_value": "Développement de la confiance en soi, autonomie",
  "sessions_formatted": "Du 4 juillet au 17 juillet (14 jours) - 1007€",
  "departures_formatted": "Annecy (+170€), Chambéry (+150€)",
  "price_range": "À partir de 1007€",
  "duration_range": "7 à 14 jours"
}
```

---

## 🔄 Workflow Complet

### 1. Scraping (n8n)

```
Schedule (2h du mat)
  ↓
Fetch Homepage UFOVAL
  ↓
Extract Categories (Mer, Montagne, Océan, Étranger)
  ↓
Fetch Category Pages
  ↓
Extract Stay Links
  ↓
Fetch Stay Details
  ↓
Parse Sessions + Departures
  ↓
Filter Valid Stays (3 juil - 30 août, pas complets)
```

### 2. Intégration (API)

```
Check if Stay Exists
  ↓
CREATE or UPDATE Stay in Supabase
  ↓
Bulk Sync Sessions
  ↓
Update ufoval_enrichment_full.json
  ↓
Webhook Notification
```

### 3. Reformulation (Script)

```
ufoval_enrichment_full.json
  ↓
refactor-ufoval-content.ts
  ↓
ufoval_refactored.json
  ↓
API Update (descriptions reformulées)
```

---

## 🧪 Tests

### Tester manuellement le scraping

```bash
# Tester un seul séjour
curl -X POST http://localhost:3000/api/admin/stays \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Destination Soleil",
    "description": "Test description",
    "sourceUrl": "https://ufoval.fol74.org/sejours-colonies-de-vacances-a-la-mer/destination-soleil",
    "priceFrom": 1007,
    "contentKids": {},
    "published": true
  }'
```

### Tester la synchronisation des sessions

```bash
curl -X POST http://localhost:3000/api/admin/sessions/bulk-sync \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "sessions": [{
      "start_date": "2026-07-04",
      "end_date": "2026-07-17",
      "base_price_eur": 1095,
      "promo_price_eur": 1007
    }],
    "source_url": "https://ufoval.fol74.org/sejours-colonies-de-vacances-a-la-mer/destination-soleil"
  }'
```

---

## 🐛 Dépannage

### Le workflow ne s'exécute pas

- Vérifier que le workflow est **"Active"** (toggle en haut à droite)
- Vérifier les logs n8n : **Executions** → voir les erreurs

### Erreur 401 Unauthorized

- Vérifier que le JWT token est valide
- Générer un nouveau token depuis `/api/auth/login`

### Les séjours ne s'affichent pas

- Vérifier que `published: true` dans la base
- Vider le cache et rafraîchir la page

### Les prix sont incorrects

- Vérifier le parsing dans le noeud "Parser Sessions + Départs"
- Les prix UFOVAL utilisent des espaces insécables (`\u00A0`)

---

## 📊 Monitoring

### Logs n8n

Dans n8n : **Executions** → voir l'historique des runs

### Logs API

```bash
# Suivre les logs en temps réel
tail -f logs/ufoval-scraper.log

# Voir les erreurs
grep ERROR logs/ufoval-scraper.log
```

### Statistiques

```sql
-- Nombre de séjours UFOVAL importés
SELECT COUNT(*) FROM stays WHERE "sourceUrl" LIKE '%ufoval.fol74.org%';

-- Sessions à venir
SELECT COUNT(*) FROM stay_sessions WHERE startDate > NOW();

-- Prix moyens
SELECT AVG(basePrice) FROM stay_sessions;
```

---

## 🚀 Next Steps

1. **Importer le workflow n8n** → `n8n-workflows/ufoval-scraper-workflow.json`
2. **Configurer les credentials** → JWT token GED
3. **Activer le workflow**
4. **Tester manuellement** → "Execute Workflow" dans n8n
5. **Vérifier les données** dans Supabase
6. **Lancer la reformulation** → `npm run refactor:ufoval`

---

## 📞 Support

- **n8n Community** : https://community.n8n.io
- **n8n Docs** : https://docs.n8n.io
- **GED Project** : Voir `CLAUDE.md`

---

**Sources :**

- [n8n-mcp GitHub](https://github.com/czlonkowski/n8n-mcp) - Model Context Protocol pour n8n
- [n8n-skills GitHub](https://github.com/czlonkowski/n8n-skills) - Workflow templates
- [Ultimate Scraper Workflow n8n](https://n8n.io/workflows/2431-ultimate-scraper-workflow-for-n8n/) - Template scraping
- [n8n-nodes-mcp Integration Guide](https://www.leanware.co/insights/n8n-nodes-mcp-guide) - Guide complet MCP 2025

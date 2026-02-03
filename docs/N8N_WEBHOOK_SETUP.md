# Configuration Webhook n8n pour UFOVAL

**Date** : 31 janvier 2026
**Objectif** : Recevoir les données UFOVAL via webhook et les envoyer dans Supabase

---

## 🎯 Vue d'ensemble

```
┌─────────────────────────────────────────────────────────────────┐
│  Ordinateur local                                             │
│  - Script : ./scripts/ufoval/send-to-n8n.sh                    │
│  - Envoie : out/ufoval/rewrite_ready_final.json                │
└─────────────────────────────────────────────────────────────────┘
                          │
                          │ curl POST (webhook)
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│  n8n (Hostinger)                                              │
│  - Webhook reçoit les données                                 │
│  - Vérifie le secret                                          │
│  - Envoie à Supabase                                          │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔧 Étape 1 : Créer le Webhook dans n8n

### 1. Ouvrir le workflow
https://n8n.srv1307641.hstgr.cloud/workflow/kG6OASM4PxZaBt9H

### 2. Ajouter un nœud **Webhook**
- Cliquer sur le **+** pour ajouter un nœud
- Rechercher **"Webhook"**
- Cliquer sur **"Create"** pour créer un nouveau webhook

### 3. Configuration du Webhook
| Champ | Valeur |
|-------|--------|
| **HTTP Method** | POST |
| **Path** | `ufoval-import` |
| **Authentication** | None (on utilise un paramètre secret) |
| **Response Mode** | "On last node" (répond après tout le workflow) |

L'URL finale sera :
```
https://n8n.srv1307641.hstgr.cloud/webhook/ufoval-import
```

### 4. Activer le Webhook
- Cliquer sur **"Listen for Test Event"** → mode test
- Ou **"Save and Activate"** → mode production

---

## 🔒 Étape 2 : Sécuriser le Webhook

### Méthode recommandée : Vérifier un header (meilleure pratique)

Dans le script d'envoi, le secret est envoyé dans un header :
```bash
-H "X-Webhook-Secret: ged-ufoval-2026"
```

Dans n8n, ajouter un nœud **IF** juste après le Webhook :

```javascript
// Condition du nœud IF
{{ $json.headers["x-webhook-secret"] === "ged-ufoval-2026" }}
```

**Connexions :**
- ✅ **TRUE** → Continue vers FILTER__ARTICLES_VALIDES
- ❌ **FALSE** → Nœud "Stop" (arrête le workflow)

### Alternative : Vérifier un paramètre URL (moins sécurisé)

```javascript
// Dans l'URL : ?secret=ged-ufoval-2026
{{ $json.query.secret === "ged-ufoval-2026" }}
```

**Note :** Le header est préférable car le secret n'apparaît pas dans les logs d'accès.

---

## 🔗 Étape 3 : Connecter le workflow

### Nouvelle topologie

```
[WEBHOOK] → [IF (vérifier secret)]
                │
                ├─── TRUE ──→ [FILTER__ARTICLES_VALIDES] → [HTTP__UPSERT_GD_STAYS]
                │                                                              │
                │                                                              ▼
                │                                                    [TRANSFORM__SESSIONS_TO_ROWS]
                │                                                              │
                │                                                              ▼
                │                                                    [HTTP__UPSERT_GD_STAY_SESSIONS]
                │
                └─── FALSE ──→ [STOP (ou réponse d'erreur)]
```

### Modifications des connexions

1. **Déconnecter** l'ancienne connexion "Calculer le prix du GED" → FILTER
2. **Connecter** WEBHOOK → IF (vérifier secret)
3. **Connecter** IF (TRUE) → FILTER__ARTICLES_VALIDES
4. **Garder** les connexions existantes FILTER → HTTP__UPSERT → etc.

---

## 🧪 Étape 4 : Tester

### 1. Depuis le poste local

```bash
cd /Users/laidhamoudi/groupe-et-decouverte/dev-ged
./scripts/ufoval/send-to-n8n.sh
```

**Résultat attendu :**
```
🔍 Vérifications...
📊 18 séjours trouvés dans le JSON

📤 Envoi vers n8n...
   URL: https://n8n.srv1307641.hstgr.cloud/webhook/ufoval-import
   Secret: ged-ufoval-2026 (dans header X-Webhook-Secret)
   Fichier: out/ufoval/rewrite_ready_final.json

✅ Succès ! Données envoyées à n8n (HTTP 200)
```

### 2. Vérifier dans n8n

- Ouvrir le workflow
- Vérifier que le nœud Webhook a reçu des données
- Vérifier que tous les nœuds passent en vert

### 3. Vérifier dans Supabase

```sql
-- Compter les séjours importés
SELECT COUNT(*) FROM gd_stays
WHERE import_batch_ts >= NOW() - INTERVAL '5 minutes';

-- Vérifier les données
SELECT source_url, title_kids, slug
FROM gd_stays
WHERE import_batch_ts >= NOW() - INTERVAL '5 minutes'
ORDER BY created_at DESC
LIMIT 5;

-- Compter les sessions importées
SELECT COUNT(*) FROM gd_stay_sessions
WHERE import_batch_ts >= NOW() - INTERVAL '5 minutes';
```

---

## 📝 Étape 5 : Mode Production vs Test

### Mode Test (développement)
- Utiliser **"Listen for Test Event"** dans n8n
- Le webhook écoute uniquement quand la page n8n est ouverte
- Pratique pour débugger

### Mode Production
- Utiliser **"Save and Activate"** dans n8n
- Le webhook est toujours actif
- Fonctionne même si n8n est fermé

---

## 🔧 Configuration du nœud HTTP__UPSERT_GD_STAYS

Le nœud HTTP doit être configuré pour recevoir les données du webhook :

```javascript
// Body de la requête HTTP
={{ $input.all().map(item => ({
  source_url: item.json.source_url,
  slug: item.json.slug || item.json.source_url.split('/').pop().replace(/[^a-z0-9-]/gi, '-').toLowerCase(),
  title_pro: item.json.pro?.title_pro,
  title_kids: item.json.kids?.title_kids,
  description_pro: item.json.pro?.description_pro || null,
  description_kids: item.json.kids?.description_kids || null,
  sessions_json: typeof item.json.sessions_json === 'string'
    ? item.json.sessions_json
    : JSON.stringify(item.json.sessions_json),
  published: true,
  import_batch_ts: new Date().toISOString()
})) }}
```

---

## 🚀 Workflow complet

```bash
# 1. Scraper UFOVAL (si les données ne sont pas à jour)
npm run scrape:ufoval

# 2. Envoyer à n8n
./scripts/ufoval/send-to-n8n.sh

# 3. Vérifier dans Supabase
# (aller sur le dashboard Supabase et vérifier les tables)
```

---

## ⚠️ Sécurité

### Méthode actuelle (header)
```bash
# Script envoie le secret dans un header
-H "X-Webhook-Secret: ged-ufoval-2026"

# n8n vérifie le header
{{ $json.headers["x-webhook-secret"] === "ged-ufoval-2026" }}
```
✅ **Meilleure pratique** : Le secret n'apparaît pas dans les logs d'accès

### Pour la production
- Utiliser un **secret plus fort** (généré aléatoirement, 32+ caractères)
- Ajouter une **vérification d'IP** (si possible)
- Limiter la **fréquence d'appel** (rate limiting)
- Roter le **secret régulièrement**

---

## 📋 Checklist

- [ ] Webhook créé dans n8n (path: ufoval-import)
- [ ] Secret configuré dans le script (ged-ufoval-2026)
- [ ] Nœud IF ajouté pour vérifier le header X-Webhook-Secret
- [ ] Workflow reconnecté (WEBHOOK → IF → FILTER → etc.)
- [ ] Script testé localement
- [ ] Données vérifiées dans Supabase
- [ ] Mode production activé (Save and Activate)

---

**Document créé pour** : Configuration du webhook n8n pour recevoir les données UFOVAL
**Script associé** : `scripts/ufoval/send-to-n8n.sh`

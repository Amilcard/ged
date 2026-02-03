# Problématique n8n - Workflow UFOVAL vers Supabase

**Date** : 31 janvier 2026
**Workflow** : GED__UFOVAL__SCRAPE_SEED_STAYS__v1
**URL** : https://n8n.srv1307641.hstgr.cloud/workflow/kG6OASM4PxZaBt9H

---

## 🔴 Problème identifié

**La branche d'écriture Supabase existe mais n'est pas connectée au flux principal.**

### État actuel

Les 4 nœuds Supabase sont créés et configurés :
- ✅ `FILTER__ARTICLES_VALIDES_POUR_BASE_DE...`
- ✅ `HTTP__UPSERT_GD_STAYS`
- ✅ `Code en JavaScript1` (TRANSFORM__SESSIONS_TO_ROWS)
- ✅ `Requête HTTP 1` (UPSERT__GD_STAY_SESSIONS)

**MAIS** ils ne reçoivent aucune donnée car **le nœud FILTER n'a pas de connexion d'entrée**.

### Schéma actuel ( cassé )

```
[Scraping UFOVAL]
       │
       ▼
[Calculer le prix du GED]
       │
       ▼
[Autres nœuds...]
       │
       X──────────────────────────────┐
                                      │
                                      ▼
                            [FILTER__ARTICLES_VALIDES] ──► [HTTP__UPSERT] ──► [Code] ──► [HTTP Sessions]
                                  ↑
                            Pas d'entrée !
```

### Schéma corrigé (à faire)

```
[Scraping UFOVAL]
       │
       ▼
[Calculer le prix du GED]
       │
       ├───► [Autres nœuds...]
       │
       └───► [FILTER__ARTICLES_VALIDES] ──► [HTTP__UPSERT] ──► [Code] ──► [HTTP Sessions]
                    │
                    └─── FAUX ──► (fin de branche)
```

---

## 🎯 Solution

### Action requise dans n8n

**Connecter le nœud "Calculer le prix du GED" vers FILTER__ARTICLES_VALIDES**

1. Ouvrir le workflow dans n8n
2. Localiser le nœud **"Calculer le prix du GED"**
3. Cliquer-glisser depuis son point de sortie (cercle à droite)
4. Relier au point d'entrée (cercle à gauche) de **FILTER__ARTICLES_VALIDES_POUR_BASE_DE...**
5. Sauvegarder (automatique)
6. Tester avec "Exécuter le flux de travail"

### Vérification

Après connexion, tester :
- Des chiffres doivent apparaître sur chaque nœud (nombre d'items traités)
- Vérifier dans Supabase :
  ```sql
  SELECT * FROM gd_stays ORDER BY import_batch_ts DESC LIMIT 10;
  SELECT * FROM gd_stay_sessions ORDER BY import_batch_ts DESC LIMIT 10;
  ```

---

## 📋 Contexte technique

### Données traitées

Le workflow scrape des séjours depuis UFOVAL (organisateur de colonies de vacances) et doit les écrire dans Supabase.

**Flux de données :**
1. **Scraping UFOVAL** → Récupère les séjours
2. **Calculer le prix du GED** → Enrichit avec les prix
3. **FILTER** → Filtre les articles valides pour la base
4. **HTTP__UPSERT_GD_STAYS** → Écrit les stays dans Supabase
5. **Code JavaScript** → Transforme sessions_json en lignes
6. **HTTP Sessions** → Écrit les sessions dans Supabase

### Tables Supabase

**gd_stays**
- Clé unique : `source_url`
- Colonnes : title_pro, title_kids, description_pro, description_kids, sessions_json, etc.
- Upsert sur : `source_url`

**gd_stay_sessions**
- Clé unique composite : `(stay_slug, start_date, end_date)`
- Colonnes : stay_slug, start_date, end_date, seats_left, city_departure, price, age_min, age_max
- Upsert sur : `stay_slug, start_date, end_date`

### Configuration HTTP

**Headers requis (pour les 2 requêtes Supabase) :**
```
apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlpcmZ2bmRnenV0Ynh3ZmR3YXd1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkyNzI4MDksImV4cCI6MjA4NDg0ODgwOX0.GDBh-u9DEfy-w2btzNTZGm6T2npFlbdX3XK-h-rsUQw
Authorization: Bearer [même clé]
Content-Type: application/json
Prefer: resolution=merge-duplicates,return=representation
```

**URLs :**
- gd_stays : `https://iirfvndgzutbxwfdwawu.supabase.co/rest/v1/gd_stays?on_conflict=source_url`
- gd_stay_sessions : `https://iirfvndgzutbxwfdwawu.supabase.co/rest/v1/gd_stay_sessions?on_conflict=stay_slug,start_date,end_date`

---

## 📝 Code du nœud TRANSFORM__SESSIONS_TO_ROWS

Déjà configuré dans le nœud "Code en JavaScript1" :

```javascript
const output = [];

for (const item of $input.all()) {
  const stay = item.json;
  let sessions = [];

  try {
    if (Array.isArray(stay.sessions_json)) {
      sessions = stay.sessions_json;
    } else if (typeof stay.sessions_json === 'string') {
      sessions = JSON.parse(stay.sessions_json);
    } else if (stay.sessions_json && typeof stay.sessions_json === 'object') {
      sessions = [stay.sessions_json];
    }
  } catch (e) {
    continue;
  }

  const staySlug = stay.slug || (stay.source_url ? stay.source_url.split('/').pop().replace(/[^a-z0-9-]/gi, '-').toLowerCase() : null);

  if (!staySlug) continue;

  for (const session of sessions) {
    const startDate = session.start_date || session.date_debut || session.dateDebut || null;
    const endDate = session.end_date || session.date_fin || session.dateFin || null;

    if (!startDate || !endDate) continue;

    output.push({
      json: {
        stay_slug: staySlug,
        start_date: startDate,
        end_date: endDate,
        seats_left: session.seats_left || session.places_restantes || null,
        city_departure: session.city_departure || session.ville_depart || null,
        price: session.price || session.tarif || null,
        age_min: session.age_min || null,
        age_max: session.age_max || null,
        import_batch_ts: new Date().toISOString()
      }
    });
  }
}

return output;
```

---

## ⚠️ Pièges à éviter

1. **Se connecter au mauvais nœud**
   - Vérifier l'INPUT du nœud FILTER pour confirmer la source
   - Si l'input montre `<!doctype html>...`, c'est du HTML → mauvaise connexion
   - L'input doit montrer du JSON avec des champs `title`, `source_url`, etc.

2. **Confondre les 2 workflows**
   - Il existe un autre workflow "Grattoir UFOVAL - Production GED" (ID: SqjOjFYjQfc9y2PD)
   - Le workflow à corriger est "GED__UFOVAL__SCRAPE_SEED_STAYS__v1" (ID: kG6OASM4PxZaBt9H)

3. **Oublier de tester**
   - Après connexion, tester avec "Exécuter le flux de travail"
   - Vérifier les chiffres sur chaque nœud
   - Vérifier les données dans Supabase

---

## ✅ Checklist de validation

- [ ] Le nœud "Calculer le prix du GED" est connecté à FILTER__ARTICLES_VALIDES
- [ ] Le workflow s'exécute sans erreur
- [ ] Des chiffres apparaissent sur tous les nœuds de la branche Supabase
- [ ] Des données sont insérées dans gd_stays
- [ ] Des données sont insérées dans gd_stay_sessions
- [ ] Les données sont cohérentes (pas de doublons grâce aux index UNIQUE)

---

## 📚 Documents de référence

| Document | Contenu |
|----------|---------|
| `AUDIT_WORKFLOW_N8N_UFOVAL.md` | Audit complet du workflow |
| `CONSOLIDATED_COLUMNS_ALL.sql` | Script SQL pour créer les colonnes manquantes |
| `WORKFLOW_CHANGES_EXPLAINED.md` | Explication des modifications pour aligner app et workflow |
| `N8N_INTEGRATION_GUIDE.md` | Guide d'intégration n8n |
| `N8N_4_NODES_CONFIG_READY_TO_PASTE.json` | Configuration des 4 nœuds |

---

## 🚀 Prochaines étapes après correction

1. **Tester le workflow** et vérifier l'écriture dans Supabase
2. **Exécuter CONSOLIDATED_COLUMNS_ALL.sql** pour ajouter les colonnes manquantes
3. **Modifier le workflow** pour extraire les nouveaux champs (season, location, duration_days, etc.)
4. **Mettre à jour l'app** pour utiliser les nouvelles colonnes

---

**Document créé pour :** Permettre à une autre IA de comprendre et résoudre le problème de connexion du workflow n8n
**Problème :** La branche d'écriture Supabase existe mais n'est pas connectée au flux principal
**Solution :** Connecter "Calculer le prix du GED" vers FILTER__ARTICLES_VALIDES

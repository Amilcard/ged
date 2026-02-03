# AUDIT COMPLET - Workflow n8n GED__UFOVAL__SCRAPE_SEED_STAYS__v1

**Date :** 31 janvier 2026
**Objectif :** Finaliser 4 nœuds pour écrire les données scrapées UFOVAL vers Supabase (tables gd_stays et gd_stay_sessions)

---

## 🔗 URLs & ACCÈS

### n8n
- **URL Workflow :** https://n8n.srv1307641.hstgr.cloud/workflow/kG6OASM4PxZaBt9H
- **Hébergeur :** Hostinger

### Supabase
- **Dashboard :** https://supabase.com/dashboard/project/iirfvndgzutbxwfdwawu
- **Project ID :** iirfvndgzutbxwfdwawu
- **API Base URL :** https://iirfvndgzutbxwfdwawu.supabase.co/rest/v1/

### Clé API (anon key)
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlpcmZ2bmRnenV0Ynh3ZmR3YXd1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkyNzI4MDksImV4cCI6MjA4NDg0ODgwOX0.GDBh-u9DEfy-w2btzNTZGm6T2npFlbdX3XK-h-rsUQw
```

---

## ✅ TÂCHES TERMINÉES

### 1. Tables SQL Supabase - FAIT
Les tables sont créées et OK sur Supabase :
- **gd_stays** : Table principale des séjours
- **gd_stay_sessions** : Table des sessions/dates de chaque séjour

### 2. Nœud FILTER__ARTICLES_VALIDES_POUR_BASE_DE... - EXISTAIT
- Filtre les articles valides avant insertion

### 3. Nœud HTTP__UPSERT_GD_STAYS - EXISTAIT
- **URL :** `https://iirfvndgzutbxwfdwawu.supabase.co/rest/v1/gd_stays?on_conflict=source_url`
- **Méthode :** POST
- Upsert vers la table gd_stays

### 4. Nœud Code en JavaScript1 (TRANSFORM__SESSIONS_TO_ROWS) - FAIT ✅
- **Position :** Après HTTP__UPSERT_GD_STAYS
- **Code JavaScript :** Transforme sessions_json en lignes individuelles pour gd_stay_sessions

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

### 5. Nœud Requête HTTP 1 (pour gd_stay_sessions) - FAIT ✅
- **Position :** Après Code en JavaScript1
- **Méthode :** POST
- **URL :** `https://iirfvndgzutbxwfdwawu.supabase.co/rest/v1/gd_stay_sessions?on_conflict=stay_slug,start_date,end_date`

**Headers configurés :**
| Nom | Valeur |
|-----|--------|
| apikey | eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9... (clé complète ci-dessus) |
| Authorization | Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9... (clé complète) |
| Content-Type | application/json |
| Prefer | resolution=merge-duplicates,return=representation |

**Body :** "Using Fields Below" (n8n envoie auto les champs JSON)

---

## ❌ TÂCHE RESTANTE - CRITIQUE

### Connexion manquante : FILTER n'est pas connecté au flux !

**PROBLÈME IDENTIFIÉ :**
La branche du bas (FILTER → HTTP__UPSERT → Code → HTTP Request) **n'a pas de connexion d'entrée**.

Les nœuds sont créés et configurés mais ne reçoivent pas de données car ils ne sont pas connectés au flux principal du workflow.

**ACTION REQUISE :**
1. Identifier le nœud source qui doit alimenter FILTER__ARTICLES_VALIDES
2. Probablement **"Calculer le prix du GED"** ou un nœud en amont
3. Connecter la sortie de ce nœud vers l'entrée de FILTER__ARTICLES_VALIDES

**Pour connecter dans n8n :**
- Cliquer-glisser depuis le point de sortie (droite) du nœud source
- Vers le point d'entrée (gauche) de FILTER__ARTICLES_VALIDES

---

## ⚠️ DIFFICULTÉS RENCONTRÉES & PIÈGES À ÉVITER

### 1. Automatisation de l'éditeur de code n8n
- **Problème :** L'éditeur Monaco/CodeMirror de n8n ne répond pas aux raccourcis Ctrl+A, Delete via automatisation navigateur
- **Solution :** Demander à l'utilisateur de copier-coller le code manuellement
- **Piège :** Le code peut se mélanger au code existant au lieu de le remplacer

### 2. Menu d'ajout de nœuds
- **Problème :** Cliquer sur "Cœur" crée parfois un Webhook au lieu d'ouvrir le sous-menu
- **Solution :** Utiliser la barre de recherche et taper directement le nom du nœud (ex: "Code", "HTTP Request")
- **Méthode :** Utiliser `form_input` sur le champ de recherche au lieu de `type`

### 3. Connexion des nœuds mal positionnée
- **Problème :** Des nœuds ont été créés dans la mauvaise branche (recevant du HTML au lieu des données stays)
- **Solution :** Toujours vérifier INPUT dans le panneau du nœud pour confirmer la source des données
- **Symptôme :** Si l'input montre `<!doctype html>...`, le nœud est connecté au mauvais endroit

### 4. Erreur "Requête incorrecte"
- **Cause :** Le nœud recevait du HTML au lieu de JSON
- **Message :** "Impossible de trouver la colonne '' de 'gd_stay_sessions' dans le cache du schéma"
- **Solution :** S'assurer que le nœud Code reçoit bien les données de HTTP__UPSERT_GD_STAYS

---

## 📋 STRUCTURE DU WORKFLOW

```
[Flux principal du scraping UFOVAL]
         │
         ▼
   [Calculer le prix du GED]  ←── Probablement le nœud source
         │
         ▼  (CONNEXION MANQUANTE ICI)
   [FILTER__ARTICLES_VALIDES_POUR_BASE_DE...]
         │
         ├─── vrai ───▶ [HTTP__UPSERT_GD_STAYS] ──▶ [Code en JavaScript1] ──▶ [Requête HTTP 1]
         │                    (gd_stays)              (TRANSFORM)              (gd_stay_sessions)
         │
         └─── FAUX ───▶ (ignoré)
```

---

## 🔧 CONFIGURATION DÉTAILLÉE DES NŒUDS

### HTTP__UPSERT_GD_STAYS (existant)
- URL : `https://iirfvndgzutbxwfdwawu.supabase.co/rest/v1/gd_stays?on_conflict=source_url`
- Méthode : POST
- Headers : apikey, Authorization, Content-Type, Prefer

### Code en JavaScript1 (nouveau)
- Mode : Run Once for All Items
- Langage : JavaScript
- Entrée : Reçoit les stays de HTTP__UPSERT_GD_STAYS
- Sortie : Array d'objets session pour gd_stay_sessions

### Requête HTTP 1 (nouveau)
- URL : `https://iirfvndgzutbxwfdwawu.supabase.co/rest/v1/gd_stay_sessions?on_conflict=stay_slug,start_date,end_date`
- Méthode : POST
- Headers : 4 headers (voir section ci-dessus)
- Body : Using Fields Below, Type JSON

---

## 📊 TABLES SUPABASE

### gd_stays
- Clé unique : `source_url`
- Contient : titre, description, prix, sessions_json, etc.

### gd_stay_sessions
- Clé unique composite : `(stay_slug, start_date, end_date)`
- Colonnes : stay_slug, start_date, end_date, seats_left, city_departure, price, age_min, age_max, import_batch_ts

---

## 🎯 PROCHAINES ÉTAPES POUR FINALISER

1. **Identifier le nœud source** qui doit alimenter FILTER
   - Regarder le flux principal, trouver où les données stays sont prêtes

2. **Connecter** ce nœud vers FILTER__ARTICLES_VALIDES
   - Glisser-déposer la connexion dans n8n

3. **Tester** avec "Exécuter le flux de travail"
   - Vérifier que des chiffres apparaissent sur chaque nœud
   - Vérifier dans Supabase que les données sont insérées

4. **Vérifier les données** dans Supabase
   - Table gd_stays : SELECT * FROM gd_stays LIMIT 10;
   - Table gd_stay_sessions : SELECT * FROM gd_stay_sessions LIMIT 10;

---

## 📝 NOTES ADDITIONNELLES

- Le workflow scrape des séjours depuis UFOVAL (organisateur de colonies de vacances)
- L'utilisateur préfère des instructions directes et concises
- n8n sauvegarde automatiquement les modifications
- L'interface est en français

---

*Document généré pour passation de relais - Session du 31/01/2026*

# n8n - Ajout rapide des 4 nœuds DB (Mode Speed Run)

**Workflow** : `GED__UFOVAL__SCRAPE_SEED_STAYS__v1`
**Point d'insertion** : Après `Enrichissement JSON de Sauvegarder`

---

## ⚡ NŒUD 1 : IF (Filter) - FILTER__VALID_ITEMS_FOR_DB

1. **Cliquer sur** `Enrichissement JSON de Sauvegarder` pour le sélectionner
2. **Appuyer sur Tab** OU cliquer sur le **+** qui apparaît à droite du nœud
3. **Chercher** : `IF`
4. **Sélectionner** : `IF` node
5. **Renommer** le nœud : `FILTER__VALID_ITEMS_FOR_DB`
6. **Configuration** :
   - Mode : **All conditions must be true**
   - Condition 1 : `{{ $json.source_url }}` → `is not empty`
   - Condition 2 : `{{ $json.pro.title_pro }}` → `is not empty`
   - Condition 3 : `{{ $json.kids.title_kids }}` → `is not empty`
   - Condition 4 : `{{ $json.sessions_json }}` → `is not empty`
7. **Cliquer** : `Back to canvas`

---

## ⚡ NŒUD 2 : HTTP Request - HTTP__UPSERT_GD_STAYS

1. **Depuis FILTER node**, cliquer sur le **+** de la sortie **TRUE**
2. **Chercher** : `HTTP Request`
3. **Sélectionner** : `HTTP Request`
4. **Renommer** : `HTTP__UPSERT_GD_STAYS`
5. **Configuration** :

   **Authentication** :
   - Predefined Credential Type : `Supabase API`
   - Credential : `[Sélectionner votre credential Supabase]`

   **Method** : `POST`

   **URL** : `https://iirfvndgzutbxwfdwawu.supabase.co/rest/v1/gd_stays?on_conflict=source_url`

   **Headers** :
   ```
   Name: Prefer
   Value: resolution=merge-duplicates,return=representation
   ```

   **Body** :
   - Send Body : `Yes`
   - Body Content Type : `JSON`
   - Specify Body : `Using Expression`
   - Expression :
   ```javascript
   {{ $input.all().map(item => ({
     source_url: item.json.source_url,
     slug: item.json.slug || item.json.source_url.split('/').pop().replace(/[^a-z0-9-]/gi, '-').toLowerCase(),
     title: item.json.pro?.title_pro || item.json.kids?.title_kids || 'Sans titre',
     title_pro: item.json.pro?.title_pro,
     title_kids: item.json.kids?.title_kids,
     description_pro: item.json.pro?.description_pro || null,
     description_kids: item.json.kids?.description_kids || null,
     sessions_json: typeof item.json.sessions_json === 'string' ? item.json.sessions_json : JSON.stringify(item.json.sessions_json),
     published: true,
     import_batch_ts: new Date().toISOString()
   })) }}
   ```

6. **Options** :
   - Split Into Items : `No`

7. **Cliquer** : `Back to canvas`

---

## ⚡ NŒUD 3 : Function - TRANSFORM__SESSIONS_TO_ROWS

1. **Depuis HTTP__UPSERT_GD_STAYS**, cliquer sur le **+**
2. **Chercher** : `Code` OU `Function`
3. **Sélectionner** : `Code` node (ou `Function` selon version n8n)
4. **Renommer** : `TRANSFORM__SESSIONS_TO_ROWS`
5. **Configuration** :
   - Language : `JavaScript`
   - Mode : `Run Once for All Items`

6. **Code** : Copier-coller le code ci-dessous (TOUT remplacer) :

```javascript
// Transformation sessions_json → lignes DB
const output = [];

for (const item of $input.all()) {
  const stay = item.json;

  // Parse sessions_json (peut être string ou array ou object)
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
    console.error(`[TRANSFORM] Failed to parse sessions_json for stay ${stay.slug}:`, e);
    continue;
  }

  // Générer le slug si manquant
  const staySlug = stay.slug || (stay.source_url ?
    stay.source_url.split('/').pop().replace(/[^a-z0-9-]/gi, '-').toLowerCase() :
    null
  );

  if (!staySlug) {
    console.error('[TRANSFORM] Missing slug and source_url for stay:', stay);
    continue;
  }

  // Créer une ligne par session
  for (const session of sessions) {
    // Vérifier que start_date et end_date existent
    const startDate = session.start_date || session.date_debut || session.dateDebut || null;
    const endDate = session.end_date || session.date_fin || session.dateFin || null;

    if (!startDate || !endDate) {
      console.warn('[TRANSFORM] Missing dates for session:', session);
      continue;
    }

    output.push({
      json: {
        stay_slug: staySlug,
        start_date: startDate,
        end_date: endDate,
        seats_left: session.seats_left ?? session.places_restantes ?? session.placesRestantes ?? null,
        city_departure: session.city_departure ?? session.ville_depart ?? session.villeDepart ?? null,
        price: session.price ?? session.tarif ?? session.prix ?? null,
        age_min: session.age_min ?? session.ageMin ?? null,
        age_max: session.age_max ?? session.ageMax ?? null,
        import_batch_ts: new Date().toISOString()
      }
    });
  }
}

if (output.length === 0) {
  console.warn('[TRANSFORM] No sessions produced. Check input data.');
}

return output;
```

7. **Cliquer** : `Back to canvas`

---

## ⚡ NŒUD 4 : HTTP Request - HTTP__UPSERT_GD_STAY_SESSIONS

1. **Depuis TRANSFORM node**, cliquer sur le **+**
2. **Chercher** : `HTTP Request`
3. **Sélectionner** : `HTTP Request`
4. **Renommer** : `HTTP__UPSERT_GD_STAY_SESSIONS`
5. **Configuration** :

   **Authentication** :
   - Predefined Credential Type : `Supabase API`
   - Credential : `[Même credential qu'avant]`

   **Method** : `POST`

   **URL** : `https://iirfvndgzutbxwfdwawu.supabase.co/rest/v1/gd_stay_sessions?on_conflict=stay_slug,start_date,end_date`

   **Headers** :
   ```
   Name: Prefer
   Value: resolution=merge-duplicates,return=representation
   ```

   **Body** :
   - Send Body : `Yes`
   - Body Content Type : `JSON`
   - Specify Body : `Using Expression`
   - Expression :
   ```javascript
   {{ $input.all().map(item => ({
     stay_slug: item.json.stay_slug,
     start_date: item.json.start_date,
     end_date: item.json.end_date,
     seats_left: item.json.seats_left,
     city_departure: item.json.city_departure,
     price: item.json.price,
     age_min: item.json.age_min,
     age_max: item.json.age_max,
     import_batch_ts: item.json.import_batch_ts
   })) }}
   ```

6. **Options** :
   - Split Into Items : `No`

7. **Cliquer** : `Back to canvas`

---

## ✅ FINALISATION

1. **Sauvegarder** le workflow : `Ctrl+S` ou bouton `Save` en haut à droite
2. **Vérifier** visuellement les connexions :
   ```
   Enrichissement JSON de Sauvegarder
           ↓
   FILTER__VALID_ITEMS_FOR_DB
           ↓ (TRUE)
   HTTP__UPSERT_GD_STAYS
           ↓
   TRANSFORM__SESSIONS_TO_ROWS
           ↓
   HTTP__UPSERT_GD_STAY_SESSIONS
   ```
3. **Important** : L'ancienne connexion `Enrichissement JSON → Notifier Fin` doit **rester intacte** !

---

## 🧪 TEST MANUEL

1. **Cliquer** sur `Execute Workflow` (bouton Play en haut à droite)
2. **Attendre** l'exécution complète
3. **Vérifier** :
   - ✅ Tous les nœuds sont verts (success)
   - ✅ Le nœud FILTER affiche combien d'items passent en TRUE
   - ✅ Les 2 HTTP nodes affichent des réponses 2xx
   - ✅ Le fichier JSON est bien créé (comportement existant préservé)
4. **Aller dans Supabase** et exécuter :
   ```sql
   SELECT count(*) FROM gd_stays WHERE import_batch_ts >= now() - interval '5 minutes';
   SELECT count(*) FROM gd_stay_sessions WHERE import_batch_ts >= now() - interval '5 minutes';
   ```
5. **Résultat attendu** : ~30 stays + N sessions

---

## 🔴 ROLLBACK (en cas de problème)

1. **Désactiver les 4 nouveaux nœuds** :
   - Cliquer sur chaque nœud → Toggle OFF
2. **Sauvegarder**
3. **Le workflow revient au comportement d'avant** (JSON export uniquement)

---

**Temps estimé d'ajout** : 10-15 minutes
**Difficulté** : Moyenne (copier-coller requis)

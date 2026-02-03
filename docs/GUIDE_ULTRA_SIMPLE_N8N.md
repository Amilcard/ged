# 🚀 Guide ULTRA SIMPLE - Ajouter 4 nœuds dans n8n

**Pour** : Projet Flooow UFOVAL
**Temps** : 10 minutes max
**Difficulté** : Facile (copier-coller)

---

## 📍 TU ES ICI

Tu as ton workflow n8n ouvert : **"Grattoir UFOVAL - Production GED"**

Tu vois plusieurs petits carrés (nœuds) connectés.

---

## 🎯 CE QU'ON VA FAIRE

**Ajouter 4 NOUVEAUX carrés (nœuds)** après le carré VERT avec l'icône de fichier.

---

## ✋ ÉTAPE 1 : Trouve le nœud "Enrichissement JSON de Sauvegarder"

**C'est le carré VERT avec une icône de FICHIER/DOCUMENT.**

Il est vers la DROITE de ton écran.

**Repéré ? OK, continue.**

---

## ✋ ÉTAPE 2 : Ouvre le menu d'ajout

**MÉTHODE A (simple)** :
- Fais un **CLIC DROIT** sur le canvas (la zone grise)
- Dans le menu, clique sur **"Ajouter un nœud"** ou **"Add node"**

**OU MÉTHODE B** :
- En HAUT à gauche, clique sur le bouton **"+"** (plus)
- Sélectionne **"Node"** ou **"Nœud"**

**Un panneau s'ouvre sur le CÔTÉ avec une liste de nœuds.**

---

## ✋ ÉTAPE 3 : Ajoute le NŒUD 1 - IF

1. Dans la barre de recherche du panneau, **tape** : `IF`
2. **Clique sur** le nœud qui s'appelle **"IF"**
3. Le nœud apparaît sur le canvas

### Configure le nœud IF :

**En haut du nœud** :
- Change le nom en : `FILTER__VALID_ITEMS_FOR_DB`

**Dans les paramètres** :
- Mode : **All conditions must be true**

**Ajoute 4 conditions** :

**Condition 1** :
- Value 1 : `{{ $json.source_url }}`
- Operation : **is not empty**

**Condition 2** :
- Value 1 : `{{ $json.pro.title_pro }}`
- Operation : **is not empty**

**Condition 3** :
- Value 1 : `{{ $json.kids.title_kids }}`
- Operation : **is not empty**

**Condition 4** :
- Value 1 : `{{ $json.sessions_json }}`
- Operation : **is not empty**

**Clique sur "Back to canvas"**

---

## ✋ ÉTAPE 4 : Connecte les nœuds

**Tire une ligne** depuis le nœud VERT "Enrichissement JSON" **vers** ton nouveau nœud IF.

**Comment ?**
- Clique sur le **petit rond** à droite du nœud vert
- GLISSE jusqu'au **petit rond** à gauche du nœud IF
- Lâche

---

## ✋ ÉTAPE 5 : Ajoute le NŒUD 2 - HTTP Request

1. Ouvre le menu d'ajout (comme à l'étape 2)
2. **Tape** : `HTTP Request`
3. **Clique sur** le nœud **"HTTP Request"**
4. Change le nom en : `HTTP__UPSERT_GD_STAYS`

### Configure le nœud HTTP Request :

**Method** : `POST`

**URL** :
```
https://iirfvndgzutbxwfdwawu.supabase.co/rest/v1/gd_stays?on_conflict=source_url
```

**Authentication** :
- Type : `Generic Credential Type`
- Credential Type : `Supabase API`
- [Sélectionne ton credential Supabase existant]

**Headers** - Clique sur "Add Header" :
- Name : `Prefer`
- Value : `resolution=merge-duplicates,return=representation`

**Body** :
- Send Body : `Yes`
- Body Content Type : `JSON`
- Specify Body : `Using Expression`

**Expression (COPIE-COLLE TOUT ÇA)** :
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

**Options** :
- Split Into Items : `No`

**Clique sur "Back to canvas"**

---

## ✋ ÉTAPE 6 : Connecte le nœud IF au nœud HTTP

**Tire une ligne** depuis la sortie **TRUE** du nœud IF **vers** le nœud HTTP.

---

## ✋ ÉTAPE 7 : Ajoute le NŒUD 3 - Code (Function)

1. Ouvre le menu d'ajout
2. **Tape** : `Code`
3. **Clique sur** le nœud **"Code"** (ou **"Function"** selon ta version)
4. Change le nom en : `TRANSFORM__SESSIONS_TO_ROWS`

### Configure le nœud Code :

**Mode** : `Run Once for All Items`

**Code (COPIE-COLLE TOUT ÇA)** :

```javascript
// Transformation sessions_json → lignes DB
const output = [];

for (const item of $input.all()) {
  const stay = item.json;

  // Parse sessions_json
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
    console.error(`Failed to parse sessions_json for stay ${stay.slug}:`, e);
    continue;
  }

  const staySlug = stay.slug || (stay.source_url ?
    stay.source_url.split('/').pop().replace(/[^a-z0-9-]/gi, '-').toLowerCase() :
    null
  );

  if (!staySlug) {
    console.error('Missing slug and source_url for stay:', stay);
    continue;
  }

  // Créer une ligne par session
  for (const session of sessions) {
    const startDate = session.start_date || session.date_debut || session.dateDebut || null;
    const endDate = session.end_date || session.date_fin || session.dateFin || null;

    if (!startDate || !endDate) {
      console.warn('Missing dates for session:', session);
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
  console.warn('No sessions produced. Check input data.');
}

return output;
```

**Clique sur "Back to canvas"**

---

## ✋ ÉTAPE 8 : Connecte le nœud HTTP au nœud Code

**Tire une ligne** depuis le nœud HTTP **vers** le nœud Code.

---

## ✋ ÉTAPE 9 : Ajoute le NŒUD 4 - HTTP Request (sessions)

1. Ouvre le menu d'ajout
2. **Tape** : `HTTP Request`
3. **Clique sur** le nœud **"HTTP Request"**
4. Change le nom en : `HTTP__UPSERT_GD_STAY_SESSIONS`

### Configure le nœud HTTP Request :

**Method** : `POST`

**URL** :
```
https://iirfvndgzutbxwfdwawu.supabase.co/rest/v1/gd_stay_sessions?on_conflict=stay_slug,start_date,end_date
```

**Authentication** :
- Type : `Generic Credential Type`
- Credential Type : `Supabase API`
- [Même credential qu'avant]

**Headers** - Ajoute :
- Name : `Prefer`
- Value : `resolution=merge-duplicates,return=representation`

**Body** :
- Send Body : `Yes`
- Body Content Type : `JSON`
- Specify Body : `Using Expression`

**Expression (COPIE-COLLE)** :
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

**Options** :
- Split Into Items : `No`

**Clique sur "Back to canvas"**

---

## ✋ ÉTAPE 10 : Connecte le nœud Code au nœud HTTP (sessions)

**Tire une ligne** depuis le nœud Code **vers** ce dernier nœud HTTP.

---

## ✅ ÉTAPE 11 : SAUVEGARDE !

**En haut à droite** : Clique sur **"Save"** (Sauvegarder)

---

## 🧪 ÉTAPE 12 : TEST !

1. **En haut à droite** : Clique sur **"Execute Workflow"** (Exécuter)
2. **Attends** que tout devienne VERT
3. **Si ça marche** → Va dans Supabase et exécute :

```sql
SELECT count(*) FROM gd_stays WHERE import_batch_ts >= now() - interval '5 minutes';
SELECT count(*) FROM gd_stay_sessions WHERE import_batch_ts >= now() - interval '5 minutes';
```

**Tu devrais voir ~30 stays et plein de sessions !**

---

## ❌ SI PROBLÈME

**Désactive les 4 nouveaux nœuds** :
- Clique sur chaque nœud
- Toggle OFF (bouton désactiver)
- Sauvegarde

**Le workflow revient à l'état d'avant.**

---

## 🎉 C'EST FINI !

Ton workflow n8n écrit maintenant AUTOMATIQUEMENT dans Supabase ! 🚀

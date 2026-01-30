# ÉTAT DES LIEUX - Workflow N8N UFOVAL Scraper

**Date** : 29 janvier 2026
**Projet** : GED (Gestion Électronique de Documents)
**Objectif** : Scraper le site UFOVAL pour importer les séjours de colonies dans la base de données

---

## 📍 CONTEXTE

### Ce que fait le workflow
Ce workflow n8n doit :
1. Scraper le site **UFOVAL** (https://ufoval.fol74.org/)
2. Extraire les séjours de colonies de vacances par catégorie (Mer, Montagne, Océan, Étranger, Baroudeurs)
3. Parser les sessions, prix, villes de départ pour chaque séjour
4. **Reformuler les contenus** pour les travailleurs sociaux (étape cruciale)
5. Envoyer les données vers l'API locale (`http://localhost:3000`)
6. Sauvegarder un JSON de backup

---

## 🔗 LIENS IMPORTANTS

### n8n
- **Instance n8n** : https://n8n.srv1307641.hstgr.cloud
- **Workflow ID** : `SqjOjFYjQfc9y2PD`
- **URL directe** : https://n8n.srv1307641.hstgr.cloud/workflow/SqjOjFYjQfc9y2PD
- **Statut** : Inactif (à activer après correction)

### Application GED
- **API locale** : http://localhost:3000
- **Endpoints utilisés** :
  - `POST /api/admin/stays` - Créer un séjour
  - `POST /api/admin/sessions/bulk-sync` - Synchroniser les sessions
  - `POST /api/webhook/ufoval-scraper-complete` - Notification de fin

### Site cible
- **UFOVAL** : https://ufoval.fol74.org/

---

## 📁 EMPLACEMENT DES DOSSIERS

### Projet principal
```
/Users/laidhamoudi/groupe-et-decouverte/dev-ged/
```

### Sortie du workflow (JSON backup)
```
/Users/laidhamoudi/groupe-et-decouverte/dev-ged/out/ufoval/ufoval_enrichment_full.json
```

### À créer
```bash
mkdir -p /Users/laidhamoudi/groupe-et-decouverte/dev-ged/out/ufoval
```

---

## 🏗️ STRUCTURE DU WORKFLOW (13 noeuds)

| # | Nom | Type | État |
|---|-----|------|------|
| 1 | Tous les jours à 2h du matin | Schedule Trigger | ✅ OK |
| 2 | Fetch Homepage UFOVAL | HTTP Request | ✅ OK |
| 3 | Extraire Catégories | Code | ✅ Corrigé (renvoie 5 catégories fixes) |
| 4 | Fetch Page Catégorie | HTTP Request | ⚠️ À vérifier |
| 5 | Extraire Liens Séjours | Code | ⚠️ Corrigé (avec fallback test) |
| 6 | Fetch Page Détail Séjour | HTTP Request | ⚠️ À vérifier |
| 7 | Parser Sessions + Départs | Code | ⚠️ Regex à vérifier |
| 8 | 🔄 REFORMULER Contenu (CRUCIAL) | Code | ⚠️ À vérifier |
| 9 | Filtrer Séjours Valides | IF | ✅ OK |
| 10 | Créer Séjour AVEC Contenu Reformulé | HTTP Request | ⚠️ Authentification ? |
| 11 | Synchroniser Sessions en Bulk | HTTP Request | ⚠️ Authentification ? |
| 12 | Sauvegarder JSON Enrichment | Read/Write File | ✅ Corrigé |
| 13 | Notifier Fin du Sync | HTTP Request | ⚠️ Authentification ? |

---

## 🐛 DIFFICULTÉS RENCONTRÉES

### 1. Type de noeud inexistant ❌
**Problème** : `n8n-nodes-base.writeFile` n'existe pas dans cette version de n8n
**Solution** : Remplacé par `n8n-nodes-base.readWriteFile` avec opération "write"
**État** : ✅ Résolu

### 2. Cheerio non disponible ❌
**Problème** : `cheerio` n'est pas disponible dans les noeuds Code n8n
**Solution testée 1** : DOMParser → Non disponible dans Node.js
**Solution testée 2** : Regex vanilla JavaScript
**État** : ⚠️ Partiellement résolu (les regex sont complexes et fragiles)

### 3. Accès aux données du noeud HTTP ⚠️
**Problème** : Les données du noeud HTTP Request sont accessibles via `$json.data` ou `$json.body`
**Solution** : Utiliser `$json.data || $json.body || $input.item.json.data`
**État** : ⚠️ À vérifier pour chaque noeud

### 4. Noeud 5 - Extraire Liens Séjours ❌
**Problème** : Le noeud ne renvoie aucune donnée ("Aucune donnée de sortie")
**Cause** : Les regex ne matchent pas les liens UFOVAL
**Solution** : Ajouté un fallback qui renvoie un séjour de test si aucun trouvé
**État** : ⚠️ À tester avec des vraies données UFOVAL

### 5. Authentification API ❓
**Problème** : L'application est en mode production, locale seulement
**Question** : L'API `http://localhost:3000` nécessite-t-elle une authentification ?
**Credential configuré** : "Header Auth account" (ID: DMAMpZycj9mgH5fu)
**État** : ❓ À configurer si nécessaire

---

## 🎯 ÉTAT ACTUEL

### Ce qui fonctionne
- ✅ Noeud 1-2-3 : Le workflow récupère la homepage et extrait les 5 catégories
- ✅ Noeud 12 : Écriture fichier corrigée

### Ce qui bloque
- ⚠️ **Noeud 5** : Ne produit aucune donnée (regex ne matchent pas les liens UFOVAL)
- ⚠️ **Noeuds 4-6-7** : À vérifier avec des vraies données
- ⚠️ **Noeud 8** : Reformulation du contenu (à vérifier)
- ⚠️ **Noeuds 10-11-13** : Authentification API à configurer

### Dernier test
- **Résultat** : Le noeud 3 est vert et produit les 5 catégories
- **Blocage** : Le noeud 5 ne renvoie aucune donnée

---

## 🔧 PROCHAINES ÉTAPES (PAR ORDRE DE PRIORITÉ)

### 1. Corriger le noeud 5 (URGENT)
Le noeud "Extraire Liens Séjours" ne trouve aucun lien.

**Action** :
- Récupérer le HTML d'une vraie page catégorie UFOVAL
- Analyser le format exact des liens vers les séjours
- Ajuster les regex pour matcher ce format
- Tester avec plusieurs pages catégories

**Pages à tester** :
- https://ufoval.fol74.org/sejours-colonies-de-vacances-a-la-mer
- https://ufoval.fol74.org/sejours-colonies-de-vacances-a-la-montagne

### 2. Vérifier les noeuds 4, 6, 7
Une fois le noeud 5 corrigé, vérifier que :
- Le noeud 4 peut fetcher les pages catégories
- Le noeud 6 peut fetcher les pages détail séjours
- Le noeud 7 peut parser les sessions/tarifs/départs

### 3. Configurer l'authentification (si nécessaire)
Si l'API localhost nécessite une auth :
- Obtenir le JWT token depuis l'application
- Configurer le credential "Header Auth account"
- L'attacher aux noeuds 10, 11, 13

### 4. Tester le workflow complet
- Exécuter le workflow en entier
- Vérifier que les données arrivent dans la base
- Corriger les erreurs au fur et à mesure

### 5. Activer le workflow
- Une fois tout testé et fonctionnel
- Activer le workflow dans n8n
- Il s'exécutera tous les jours à 2h du matin

---

## 📝 NOTES IMPORTANTES

### Noeud 8 - REFORMULATION (CRUCIAL)
Ce noeud est **CRUCIAL** car il transforme les descriptions marketing UFOVAL en contenus adaptés aux travailleurs sociaux :
- Titres reformulés
- Descriptions structurées (activités, objectifs éducatifs, public cible)
- Informations clés mises en avant

**Ne pas modifier sans comprendre l'impact sur les utilisateurs finaux !**

### Structure des données attendues par l'API
```json
{
  "title": "Titre reformulé",
  "description": "Description reformulée pour travailleurs sociaux",
  "sourceUrl": "https://ufoval.fol74.org/...",
  "category": "Montagne",
  "priceFrom": 639,
  "durationDays": 7,
  "contentKids": {
    "sessions": "[...]", // JSON stringifié
    "sessions_formatted": "Du 10 juillet au 17 juillet...",
    "departures": "[...]", // JSON stringifié
    "departures_formatted": "Paris (+50€), Lyon (+30€)",
    "price_range": "À partir de 639€",
    "duration_range": "7 à 14 jours"
  },
  "published": false,
  "importedAt": "2026-01-29T...",
  "lastSyncAt": "2026-01-29T..."
}
```

---

## 🛠️ POUR LA PROCHAINE IA

### Commandes utiles n8n-mcp
```bash
# Lister les workflows
n8n_list_workflows

# Récupérer un workflow
n8n_get_workflow --id SqjOjFYjQfc9y2PD --mode full

# Mettre à jour un noeud
n8n_update_partial_workflow --id SqjOjFYjQfc9y2PD --operations [...]

# Valider un workflow
n8n_validate_workflow --id SqjOjFYjQfc9y2PD
```

### Conseils
1. **Tester petit à petit** : Valider chaque noeud individuellement
2. **Utiliser des données de test** : Créer des noeuds qui renvoient des données fixes pour tester la chaîne
3. **Logger les données** : Ajouter des noeuds qui loggent les données intermédiaires
4. **Regex sont fragiles** : Préférer utiliser les noeuds natifs n8n pour le parsing HTML si disponibles

### Contact
- **Utilisateur** : Laid HAMOUDI
- **Email** : hamoudi.laid@gmail.com
- **Projet** : GED - Groupe et Découverte

---

**Document généré le 29/01/2026 pour relais IA**

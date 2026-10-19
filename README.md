# Plateforme de veille ISO/IEC 17025

Application web de veille normative, réglementaire, scientifique, environnementale et d’accréditation destinée à un laboratoire d’analyses.

L’objectif est de couvrir tout le cycle de veille :

```text
Sources
  ↓
Collecte
  ↓
Normalisation
  ↓
Traduction éventuelle
  ↓
Filtrage / déduplication
  ↓
Qualification
  ↓
Validation / rejet
  ↓
Publication
  ↓
Notifications / abonnements
  ↓
Actions de suivi
  ↓
Rapports / audit
```

Ce README permet de **recréer et lancer le projet complet de A à Z à partir d’un poste vierge**.

---

## 1. Stack technique

### Backend

- NestJS 12
- TypeScript
- TypeORM
- PostgreSQL
- Passport / JWT
- bcrypt
- class-validator
- @nestjs/schedule
- @nestjs/event-emitter
- @nestjs/throttler
- Helmet
- rss-parser
- ExcelJS
- PDFKit
- Nodemailer
- OpenAI API (analyse des veilles, facultative)
- Vitest / Supertest

### Frontend

- Vue 3
- TypeScript
- Vite 8
- Vue Router
- Pinia
- Axios
- PrimeVue 4
- PrimeIcons
- Tailwind CSS 4
- Vitest

---

## 2. Fonctionnalités principales

La plateforme comprend notamment :

- authentification ;
- gestion des utilisateurs et des rôles ;
- création et administration des sources ;
- connecteurs RSS / Atom ;
- API Crossref et autres API JSON compatibles ;
- import manuel CSV / XLSX ;
- collecte manuelle et automatique ;
- journal des collectes ;
- normalisation ;
- traduction automatique vers le français avec l’API DeepL ;
- analyse IA de la pertinence, résumé et impacts potentiels, avec relecture humaine facultative ;
- analyse assistée par IA des informations (pertinence, résumé et impacts potentiels), avec relecture humaine facultative ;
- filtrage par sujets à surveiller ;
- déduplication ;
- gestion des éléments de veille ;
- qualification ;
- validation, rejet, publication et archivage ;
- taxonomie ;
- recherche ;
- favoris ;
- vues enregistrées ;
- abonnements ;
- notifications internes ;
- alertes e-mail ;
- actions de suivi ;
- rapports PDF / XLSX / CSV ;
- journal d’audit ;
- santé du système ;
- tableau de bord et KPI.

---

## 3. Rôles

Les rôles initialisés automatiquement sont :

- `ADMIN`
- `RESPONSABLE_VEILLE`
- `OPERATEUR_VEILLE`
- `REFERENT_LABORATOIRE`
- `LECTEUR`

Le backend reste l’autorité de sécurité. Le frontend masque aussi les actions qui ne correspondent pas au rôle connecté.

---

## 4. Structure du dépôt

```text
plateforme_veille/
├── backend/
│   ├── src/
│   │   ├── actions/
│   │   ├── ai/
│   │   ├── audit/
│   │   ├── auth/
│   │   ├── collection/
│   │   ├── common/
│   │   ├── connectors/
│   │   ├── dashboard/
│   │   ├── database/
│   │   │   ├── data-source.ts
│   │   │   ├── database-seed.service.ts
│   │   │   └── migrations/
│   │   ├── favorites/
│   │   ├── health/
│   │   ├── notifications/
│   │   ├── permissions/
│   │   ├── qualification/
│   │   ├── reports/
│   │   ├── roles/
│   │   ├── saved-views/
│   │   ├── search/
│   │   ├── sources/
│   │   ├── subscriptions/
│   │   ├── taxonomy/
│   │   ├── users/
│   │   ├── validation/
│   │   └── watch-items/
│   ├── storage/
│   ├── test/
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── layouts/
│   │   ├── router/
│   │   ├── services/
│   │   ├── stores/
│   │   ├── utils/
│   │   └── views/
│   ├── vite.config.ts
│   └── package.json
│
└── README.md
```

---

# Installation complète de A à Z

## 5. Prérequis

Installer avant de commencer :

1. **Git**
2. **Node.js** et **npm**
3. **PostgreSQL**
4. Un navigateur récent

Vérification :

```bash
git --version
node --version
npm --version
psql --version
python --version
```

Node.js 20 ou plus récent est recommandé pour les versions de NestJS/Vite utilisées dans ce dépôt.

---

## 6. Cloner le dépôt

Le dépôt est public : sa consultation et son clonage ne nécessitent pas d’autorisation préalable. Pour envoyer des modifications, authentifiez votre compte GitHub et vérifiez que vous disposez des droits de contribution.

```bash
git clone https://github.com/koffiP24/plateforme_veille.git
cd plateforme_veille
```

Vérifier :

```bash
git status
```

---

## 7. Créer la base PostgreSQL

Le projet utilise par défaut une base appelée :

```text
veille
```

### Avec psql

Se connecter :

```bash
psql -U postgres
```

Créer la base :

```sql
CREATE DATABASE veille;
```

Puis quitter :

```sql
\q
```

### Avec pgAdmin

1. Ouvrir pgAdmin.
2. Se connecter au serveur PostgreSQL.
3. Clic droit sur **Databases**.
4. Choisir **Create > Database**.
5. Nom : `veille`.
6. Enregistrer.

---

## 8. Installer le backend

```bash
cd backend
npm ci
```

Si `npm ci` échoue à cause d’un lock file localement modifié :

```bash
npm install
```

---

## 9. Créer backend/.env

Créer le fichier :

```text
backend/.env
```

Exemple minimal :

```dotenv
PORT=3000
NODE_ENV=development

FRONTEND_URL=http://localhost:5173

DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=VOTRE_MOT_DE_PASSE_POSTGRESQL
DB_NAME=veille

JWT_SECRET=REMPLACER_PAR_UN_SECRET_LONG_ET_ALEATOIRE
JWT_EXPIRES_IN=8h
JWT_REFRESH_SECRET=REMPLACER_PAR_UN_AUTRE_SECRET_LONG_ET_ALEATOIRE
JWT_REFRESH_EXPIRES_IN=7d

RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=200
AUTH_RATE_LIMIT_MAX=20

SEED_ADMIN_EMAIL=admin@veille.local
SEED_ADMIN_PASSWORD=Admin123!
```

### Générer les secrets JWT

Depuis un terminal avec Node.js :

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Exécuter cette commande **deux fois** et placer deux valeurs différentes dans :

```dotenv
JWT_SECRET=...
JWT_REFRESH_SECRET=...
```

### Important

Le compte administrateur est créé automatiquement au premier démarrage si :

```dotenv
SEED_ADMIN_EMAIL=...
SEED_ADMIN_PASSWORD=...
```

sont renseignées.

Le service de seed crée également les cinq rôles de l’application.

Si le compte administrateur existe déjà, modifier `SEED_ADMIN_PASSWORD` dans `.env` **ne change pas son mot de passe en base**.

---

## 10. Exécuter les migrations

Le projet utilise :

```text
synchronize: false
```

Il faut donc exécuter les migrations avant le premier démarrage.

Depuis `backend/` :

```bash
npx typeorm-ts-node-commonjs migration:run -d src/database/data-source.ts
```

Vérifier leur état :

```bash
npx typeorm-ts-node-commonjs migration:show -d src/database/data-source.ts
```

Si toutes les migrations attendues apparaissent comme exécutées, la base est prête.

---

## 11. Configurer la traduction DeepL — facultatif

Créer un compte avec un **forfait DeepL API** et récupérer la clé dans **Compte → API Keys & Limits**. L’essai du traducteur web ne suffit pas : il faut une clé API. Le forfait API Developer offre un quota total de caractères ; vérifier le quota disponible dans le compte avant des collectes volumineuses.

Dans **`backend/.env`**, renseigner exactement la ligne suivante avec sa propre clé :

```dotenv
DEEPL_API_KEY=VOTRE_CLE_API_DEEPL
```

Ne pas mettre cette clé dans `frontend/.env`, dans le code source ou dans Git. Redémarrer le backend après modification du fichier. Les clés API Free terminées par `:fx` utilisent automatiquement `https://api-free.deepl.com` ; les autres utilisent `https://api.deepl.com`.

Après le filtrage des sujets, chaque veille nouvelle ou modifiée (RSS, Atom, API ou import manuel) est envoyée à DeepL avec son titre et son résumé. Les doublons inchangés sont ignorés avant l’appel pour préserver le quota. DeepL détecte la langue et traduit en français si nécessaire ; l’empreinte du contenu original reste inchangée pour la déduplication. Les veilles déjà enregistrées ne sont pas retraduites automatiquement.

Si la clé est absente, invalide, si le quota est épuisé ou si DeepL est indisponible, la collecte continue avec le texte d’origine. Une indisponibilité temporaire suspend les nouveaux appels pendant une minute ; une clé refusée ou un quota épuisé suspend les appels jusqu’au redémarrage du backend.

Documentation : [clé et endpoints DeepL](https://developers.deepl.com/docs/getting-started/auth), [forfaits API](https://support.deepl.com/hc/en-us/articles/360021200939-DeepL-API-plans).

---

## Analyse assistée par IA — facultative

Le module propose un score de pertinence sur 100, une justification, un résumé en français, des processus potentiellement concernés, des vérifications à envisager et une classification suggérée (type de veille, thèmes, domaines, mots-clés et laboratoire/service). Ces résultats restent des propositions distinctes de la qualification métier : un utilisateur habilité les relit, les corrige et les enregistre. La relecture est conservée dans l’historique et inscrite au journal d’audit. L’IA ne statue jamais sur la conformité du laboratoire.

Les appels externes sont désactivés par défaut. Pour les activer, copier les variables de `backend/.env.example` dans `backend/.env`, renseigner `OPENAI_API_KEY`, puis définir `AI_ENABLED=true` et `AI_ALLOW_EXTERNAL_PROCESSING=true`. L’analyse automatique après collecte reste facultative (`AI_AUTO_ANALYZE=true`) ; sinon, l’analyse peut être lancée depuis l’écran de qualification. `OPENAI_MODEL` et `AI_LABORATORY_CONTEXT` sont configurables.

L’analyse envoie au fournisseur le titre, le résumé disponibles, la langue d’origine, la catégorie de la source, les sujets configurés et le contexte de laboratoire. Le catalogue interne des thèmes, domaines, mots-clés et laboratoires reste local ; l’IA suggère des libellés textuels qui peuvent être rapprochés des options existantes dans l’écran. Les URL et les données de compte ne sont pas transmises. L’application demande une réponse sans conservation applicative (`store: false`), mais l’envoi reste un traitement externe : activer ces options seulement après validation des règles de confidentialité applicables. Les migrations `AddWatchItemAiAnalyses` et `AddAiClassification` créent les tables et champs nécessaires ; les exécuter avant le démarrage.

---

## 12. Configurer les alertes Gmail — facultatif

Les notifications internes fonctionnent sans Gmail.

Pour envoyer aussi une alerte e-mail lors d’une publication correspondant à un abonnement, ajouter :

```dotenv
SMTP_USER=votre-adresse@gmail.com
SMTP_APP_PASSWORD=VOTRE_MOT_DE_PASSE_APPLICATION
```

Pour Gmail :

1. activer la validation en deux étapes du compte Google ;
2. créer un **mot de passe d’application** ;
3. placer ce mot de passe dans `SMTP_APP_PASSWORD` ;
4. ne jamais mettre ce secret dans Git.

Le backend utilise Nodemailer avec le service Gmail. Cette configuration est également nécessaire pour envoyer les liens « Mot de passe oublié » et la confirmation par e-mail après un changement de mot de passe : vérifier `FRONTEND_URL`, qui sert à construire l'adresse de la page de réinitialisation.

---

## 13. Démarrer le backend

Depuis `backend/` :

```bash
npm run start:dev
```

Résultat attendu :

```text
Backend disponible sur http://localhost:3000
```

Ne lancer qu’une seule instance du backend sur le port 3000.

Sous Windows, si PowerShell bloque `npm.ps1`, utiliser :

```bash
npm.cmd run start:dev
```

---

## 14. Installer le frontend

Ouvrir un deuxième terminal :

```bash
cd plateforme_veille/frontend
npm ci
```

---

## 15. Créer frontend/.env

Créer :

```text
frontend/.env
```

Contenu :

```dotenv
VITE_API_URL=/api/v1
```

En développement, Vite proxifie les requêtes `/api` vers :

```text
http://localhost:3000
```

Le fichier `frontend/vite.config.ts` contient déjà cette configuration.

---

## 16. Démarrer le frontend

Depuis `frontend/` :

```bash
npm run dev
```

Ouvrir :

```text
http://localhost:5173
```

---

# Première utilisation

## 17. Se connecter en administrateur

Utiliser les valeurs placées dans `backend/.env` :

```text
Email : valeur de SEED_ADMIN_EMAIL
Mot de passe : valeur de SEED_ADMIN_PASSWORD
```

Exemple :

```text
admin@veille.local
Admin12345
```

L’authentification utilise deux cookies HTTP-only : `access_token` (8 h par défaut) et `refresh_token` (7 jours par défaut). Le frontend renouvelle automatiquement l’accès après une réponse 401. Chaque renouvellement remplace le jeton de rafraîchissement et sa session en base ; la déconnexion révoque la session du navigateur. Les durées se règlent avec `JWT_EXPIRES_IN` et `JWT_REFRESH_EXPIRES_IN` (unités `s`, `m`, `h` ou `d`). Une connexion antérieure à l’activation de cette fonction doit être refaite une fois.

La limitation des requêtes utilise une fenêtre de 15 minutes (`RATE_LIMIT_WINDOW_MS=900000`) : 200 requêtes par adresse IP et par route (`RATE_LIMIT_MAX`), 20 tentatives par IP sur la connexion et le rafraîchissement (`AUTH_RATE_LIMIT_MAX`), et au plus 5 tentatives de connexion par adresse e-mail. Un dépassement renvoie HTTP 429. Le stockage du throttler est en mémoire : pour plusieurs instances du backend, prévoir un stockage partagé. Derrière un proxy, configurer correctement l’adresse IP cliente sans faire confiance à des en-têtes transmis directement par les visiteurs.

Le frontend et le backend doivent donc être utilisés avec les cookies autorisés.

---

## 18. Créer les utilisateurs

Depuis **Utilisateurs**, l’administrateur peut créer les comptes et leur attribuer un ou plusieurs rôles.

Exemples :

- administrateur ;
- responsable de veille ;
- opérateur de veille ;
- référent laboratoire ;
- lecteur.

---

# Utiliser la veille

## 19. Créer une source

Une source représente l’endroit depuis lequel les informations seront collectées.

Types utilisés par le projet :

- RSS ;
- Atom ;
- API ;
- import manuel.

Lors de la création, renseigner notamment :

- nom ;
- organisation ;
- pays ;
- catégorie ;
- type ;
- URL ;
- fréquence ;
- sujet à surveiller ;
- statut actif/inactif.

---

## 20. Sujet à surveiller

Le champ accepte une liste séparée par des virgules.

Exemple :

```text
ISO/IEC 17025, accreditation, laboratory, calibration
```

Chaque morceau entre deux virgules est traité comme un sujet.

Le filtrage local utilise une logique **OU** :

```text
sujet 1 OU sujet 2 OU sujet 3
```

Un élément est retenu si son titre ou son résumé contient au moins un sujet.

La recherche ignore la casse et les accents.

Laisser le champ vide désactive ce filtre.

---

## 21. Tester une source RSS / Atom

Exemple public :

```text
Nom : arXiv - Environmental monitoring
Type : Atom
URL :
https://export.arxiv.org/api/query?search_query=all%3A%22environmental%20monitoring%22&start=0&max_results=20&sortBy=submittedDate&sortOrder=descending

Sujet :
environmental monitoring, water, pollution, soil, laboratory
```

Après création :

1. aller dans **Administration et santé des sources** ;
2. tester le connecteur ;
3. lancer la collecte ;
4. vérifier le journal de collecte ;
5. aller dans **Veilles**.

---

## 22. Tester Crossref

Configuration :

```text
Type : API
URL : https://api.crossref.org/works

Sujet :
ISO/IEC 17025, laboratory accreditation, conformity assessment
```

Le même endpoint Crossref peut servir à plusieurs sources avec des sujets différents.

Les autres sources de type **API** doivent être publiques et renvoyer directement du JSON. Le connecteur accepte une liste à la racine ou une liste placée dans `items`, `entries`, `results`, `articles`, `records`, `docs`, `value` ou `hydra:member`. Il recherche aussi ces listes dans les enveloppes `data`, `result` ou `response`. Les champs usuels `title`, `name`, `headline`, `summary`, `description`, `abstract`, `url`, `link`, `date` et `language` sont reconnus. Une page HTML, une API nécessitant une clé ou une configuration spéciale, ainsi qu’une API paginée qui exige plusieurs appels ne sont pas prises en charge par ce connecteur générique.

---

## 23. Import manuel CSV / XLSX

L’import manuel accepte :

- CSV ;
- XLSX ;
- jusqu’à 5 Mo ;
- jusqu’à 5 000 lignes.

Une colonne `titre` ou `title` est obligatoire.

Exemple CSV :

```csv
title,summary,url
Nouvelle exigence ISO 17025,Résumé de test,https://example.org/1
Nouvelle méthode laboratoire,Résumé scientifique,https://example.org/2
```

---

# Cycle métier

## 24. Cycle d’un élément de veille

Le fonctionnement général est :

```text
NOUVEAU
   ↓
Qualification
   ↓
A_QUALIFIER
   ↓
Validation
   ├── REJETE
   ↓
VALIDE
   ↓
Publication
   ↓
PUBLIE
   ↓
Archivage éventuel
   ↓
ARCHIVE
```

### Qualification

La qualification permet de déterminer notamment :

- le type de veille ;
- la pertinence ;
- l’importance ;
- les thèmes ;
- domaines ;
- laboratoires ;
- mots-clés.

### Validation

Une personne autorisée vérifie l’information avant diffusion.

### Publication

Une veille validée devient visible aux utilisateurs concernés.

### Action

Une veille peut déboucher sur une tâche concrète :

- mettre à jour une procédure ;
- former une personne ;
- vérifier une méthode ;
- faire une étude d’impact ;
- adapter un document qualité.

---

# Collecte automatique

## 25. Scheduler

Le scheduler contrôle les connecteurs chaque minute.

Les fréquences reconnues comprennent notamment :

```text
30m
6h
12h
1j
```

En cas d’erreur, le système évite les tentatives en boucle et peut reporter une nouvelle tentative.

Exemple :

```text
HTTP 402
→ collecte échouée
→ journalisation
→ attente
→ nouvelle tentative automatique
```

---

## 26. Déduplication

Le backend essaie d’éviter de créer plusieurs fois la même information.

La déduplication peut s’appuyer notamment sur :

- DOI ;
- identifiant externe ;
- URL canonique ;
- empreinte calculée.

Une collecte peut donc produire :

```text
reçus = créés + mis à jour + doublons + ignorés + erreurs
```

Exemple :

```text
10 reçus
0 créés
0 mis à jour
8 doublons
2 ignorés
0 erreur
```

---

# Notifications et abonnements

## 27. Abonnements

Un utilisateur peut s’abonner à certains critères, par exemple :

- source ;
- thème ;
- domaine ;
- mot-clé.

Lorsqu’une veille publiée correspond à l’abonnement :

- une notification interne est créée ;
- une alerte e-mail peut être envoyée si Gmail est configuré.

---

# Rapports

## 28. Rapports

Les rapports peuvent être générés sur une période :

- hebdomadaire ;
- mensuelle ;
- personnalisée.

Formats disponibles :

- PDF ;
- XLSX ;
- CSV.

Les fichiers sont enregistrés sous :

```text
backend/storage/reports/
```

---

# Audit et santé

## 29. Journal d’audit

Le journal permet de tracer les opérations importantes de l’application :

- création ;
- modification ;
- qualification ;
- validation ;
- publication ;
- collecte ;
- changements d’état.

Il conserve les informations utiles pour comprendre qui a fait quoi et quand.

---

## 30. Santé du système

La page de santé permet notamment de vérifier :

- PostgreSQL ;
- les sources/connecteurs ;
- les dernières collectes ;
- les collectes en erreur.

---

# Routes principales

## 31. Authentification

| Méthode | Route | Description |
|---|---|---|
| POST | `/api/v1/auth/login` | Connexion |
| POST | `/api/v1/auth/forgot-password` | Demander un lien de réinitialisation par e-mail |
| POST | `/api/v1/auth/reset-password` | Définir un nouveau mot de passe avec le lien reçu |
| POST | `/api/v1/auth/refresh` | Renouveler les cookies de session |
| POST | `/api/v1/auth/logout` | Déconnexion |
| GET | `/api/v1/auth/me` | Profil connecté |

Le lien de réinitialisation expire après 15 minutes et ne peut être utilisé qu'une fois. Seule l'empreinte SHA-256 du jeton est enregistrée en base. La réponse à la demande de lien est identique pour une adresse connue ou inconnue. Après le changement de mot de passe, les sessions de rafraîchissement existantes sont supprimées, une entrée sans donnée secrète est ajoutée au journal d'audit et un e-mail de confirmation est envoyé sans inclure le mot de passe. L'échec de l'envoi est journalisé sans annuler le changement déjà enregistré. Exécuter la migration `AddPasswordResetTokens` avant de déployer cette fonction. Si SMTP est absent ou en erreur lors de la demande de lien, le backend journalise l'échec sans révéler l'existence du compte à l'appelant.

## 32. Utilisateurs / rôles

| Méthode | Route | Description |
|---|---|---|
| GET | `/api/v1/users` | Liste |
| POST | `/api/v1/users` | Création |
| PATCH | `/api/v1/users/:id/status` | Activation/désactivation |
| PATCH | `/api/v1/users/:id/roles` | Rôles |
| GET | `/api/v1/roles` | Liste des rôles |

## 33. Sources / connecteurs / collecte

| Méthode | Route | Description |
|---|---|---|
| GET | `/api/v1/sources` | Sources |
| POST | `/api/v1/sources` | Créer une source |
| PATCH | `/api/v1/sources/:id` | Modifier |
| PATCH | `/api/v1/sources/:id/status` | Activer/désactiver |
| GET | `/api/v1/connectors` | Connecteurs |
| POST | `/api/v1/connectors` | Créer un connecteur |
| POST | `/api/v1/connectors/:id/test` | Tester |
| POST | `/api/v1/connectors/:id/run` | Collecter |
| POST | `/api/v1/connectors/:id/retry` | Réessayer |
| POST | `/api/v1/sources/:id/import` | Import manuel |
| GET | `/api/v1/collection-runs` | Journaux de collecte |

## 34. Veilles

| Méthode | Route | Description |
|---|---|---|
| GET | `/api/v1/watch-items` | Liste |
| GET | `/api/v1/watch-items/:id` | Détail |
| GET | `/api/v1/watch-items/:id/qualification` | Qualification |

Les modules de validation, actions, abonnements, notifications, rapports, audit, santé et dashboard exposent également leurs routes sous `/api/v1`.

---

# Test avec Postman

## 35. Connexion

Requête :

```http
POST http://localhost:3000/api/v1/auth/login
Content-Type: application/json
```

Corps :

```json
{
  "email": "admin@veille.local",
  "password": "Admin12345"
}
```

La réponse renvoie l’utilisateur et pose deux cookies HTTP-only :

```text
access_token
refresh_token
```

Pour les requêtes suivantes dans Postman, conserver ces cookies. Lorsque `access_token` expire, appeler `POST /api/v1/auth/refresh` avec `refresh_token` ; le navigateur le fait automatiquement.

Exemple :

```http
GET http://localhost:3000/api/v1/auth/me
```

---

# Tests et vérifications

## 36. Backend

Depuis `backend/` :

```bash
npm run build
npm run lint
npm test
npm run test:e2e
npm run test:cov
```

## 37. Frontend

Depuis `frontend/` :

```bash
npm run build
npm test
npm run preview
```

## Vérification locale de sécurité

Démarrer le backend, puis lancer cette commande depuis la racine du dépôt :

```bash
npm run security:scan
```

Le testeur `security-agent.mjs` vérifie les en-têtes, CORS et l’authentification sur des routes de lecture locales. La configuration fournie n’envoie aucune requête d’écriture et ne contient aucun jeton ni mot de passe. L’absence de HSTS sur `localhost` en HTTP est attendue ; vérifie cet en-tête sur le point d’accès HTTPS de production.

---

# Build production

## 38. Backend

```bash
cd backend
npm run build
npm run start:prod
```

Le backend exécute alors :

```text
dist/main
```

## 39. Frontend

```bash
cd frontend
npm run build
```

Les fichiers générés sont placés dans :

```text
frontend/dist/
```

Ils doivent être servis en HTTPS en production. Un exemple de reverse proxy et d'en-têtes de sécurité se trouve dans `deploy/nginx.conf.example`.

---

# Dépannage

## 40. Erreurs fréquentes

| Problème | Cause probable | Solution |
|---|---|---|
| `EADDRINUSE :::3000` | Backend déjà lancé | Fermer l’ancienne instance |
| PostgreSQL inaccessible | Service arrêté ou mauvais identifiants | Vérifier PostgreSQL et `.env` |
| Table/colonne inexistante | Migration non exécutée | Lancer `migration:run` |
| 401 | Session absente/expirée | Se reconnecter |
| 403 | Rôle insuffisant | Vérifier les rôles |
| CORS | Mauvaise valeur FRONTEND_URL | Utiliser l’URL exacte de Vite |
| RSS/API échoue | URL externe indisponible | Tester l’URL et le connecteur |
| HTTP 402 | Service distant exige paiement/quota | Vérifier le fournisseur |
| Traduction absente | Clé DeepL absente, invalide, quota épuisé ou API indisponible | Vérifier `DEEPL_API_KEY`, le forfait API et son quota, puis redémarrer le backend |
| Gmail n’envoie pas | Mot de passe application absent | Vérifier SMTP_USER / SMTP_APP_PASSWORD |
| Changement .env ignoré | Processus non redémarré | Redémarrer backend/frontend |

---

# Sécurité

## 41. Ne jamais versionner

Ne jamais pousser dans Git :

- `backend/.env` ;
- `frontend/.env` si des secrets y sont ajoutés ;
- mot de passe PostgreSQL ;
- `JWT_SECRET` ;
- `JWT_REFRESH_SECRET` ;
- mot de passe Gmail d’application ;
- clés API ;
- jetons d’accès.

Vérifier avant chaque commit :

```bash
git status
git diff
git diff --check
```

### Déploiement sécurisé

- Configurer un certificat TLS valide et un reverse proxy HTTPS. Adapter `deploy/nginx.conf.example` au domaine, aux certificats et au chemin `frontend/dist`, puis tester la configuration Nginx avant de l'activer. Le port 80 ne sert qu'à rediriger vers HTTPS.
- Démarrer le backend avec `NODE_ENV=production`, `FRONTEND_URL=https://votre-domaine` (origine exacte, sans slash final) et `BIND_HOST=127.0.0.1` lorsque Nginx est sur la même machine. Utiliser `VITE_API_URL=/api/v1` pour garder l'API sur le même domaine. Si l'API est dans un conteneur, n'exposer le port backend qu'au reverse proxy.
- Les cookies de session ont `HttpOnly`, `SameSite=Lax` et `Secure` en production. Helmet ajoute HSTS côté API ; Nginx l'ajoute aussi sur le frontend. Vérifier ces en-têtes sur le domaine HTTPS réel avant ouverture publique. Ne pas activer HSTS sans certificat et renouvellement TLS opérationnels.
- La CSP de l'exemple autorise uniquement les scripts du même domaine. PrimeVue nécessite actuellement `style-src 'unsafe-inline'` pour ses styles générés ; resserrer cette directive si le système de styles le permet. Adapter `connect-src` si l'API est volontairement sur un autre domaine, ainsi que `FRONTEND_URL` côté backend.
- Les rôles sont vérifiés sur les routes API. Les actions d'un référent restent limitées à ses propres affectations ; les favoris d'un lecteur ne révèlent pas de veilles non publiées. Les URL issues des flux sont limitées aux schémas HTTP/HTTPS avant stockage et avant affichage.

### Dépendances, sauvegardes et surveillance

- Le workflow `.github/workflows/security-audit.yml` contrôle chaque semaine et à chaque demande de fusion les vulnérabilités de niveau élevé de toutes les dépendances, y compris les outils de développement. Examiner les alertes et mettre à jour les dépendances et fichiers `package-lock.json` après validation des builds et des tests. Localement : `npm audit --audit-level=high` dans la racine, `backend/` et `frontend/`.
- Planifier `scripts/backup-postgres.ps1` avec le Planificateur de tâches Windows. Définir `PGHOST`, `PGPORT`, `PGUSER` et `PGDATABASE` dans l'environnement de la tâche, puis fournir le mot de passe par un mécanisme PostgreSQL protégé (par exemple `pgpass`), sans l'écrire dans la commande. Exemple : `powershell -File scripts/backup-postgres.ps1 -BackupDirectory D:\Sauvegardes\Veille`.
- Stocker les fichiers de sauvegarde hors de la racine web, avec permissions limitées, chiffrement du volume et copie externe. Vérifier périodiquement la restauration dans une base isolée avec `pg_restore`. Les sauvegardes et `backend/storage/reports/` sont ignorés par Git.
- Le journal d'audit enregistre désormais aussi les échecs de connexion. Le service de santé émet un avertissement dans les logs si une IP cumule au moins cinq échecs en quinze minutes ou si des collectes échouent. Acheminer ces logs vers un système de supervision qui notifie l'administrateur ; les avertissements locaux seuls ne constituent pas une alerte externe.

---

# Commandes Git utiles

## 42. Récupérer les dernières modifications

```bash
git pull origin main
```

## 43. Enregistrer ses modifications

```bash
git add .
git commit -m "Description des modifications"
git push origin main
```

## 44. Revenir exactement au dernier état distant

Attention : cette commande supprime les modifications locales non enregistrées.

```bash
git fetch origin
git reset --hard origin/main
```

---

# Résumé de démarrage rapide

Sur un poste déjà équipé de Git, Node et PostgreSQL :

```bash
git clone https://github.com/koffiP24/plateforme_veille.git
cd plateforme_veille

cd backend
npm ci
# créer backend/.env
# créer la base PostgreSQL "veille"
npx typeorm-ts-node-commonjs migration:run -d src/database/data-source.ts
npm run start:dev
```

Dans un autre terminal :

```bash
cd plateforme_veille/frontend
npm ci
# créer frontend/.env avec VITE_API_URL=/api/v1
npm run dev
```

Puis ouvrir :

```text
http://localhost:5173
```

---

# Ordre conseillé pour tester tout le projet

1. Créer la base PostgreSQL.
2. Installer les dépendances backend.
3. Créer `backend/.env`.
4. Exécuter les migrations.
5. Démarrer le backend.
6. Installer les dépendances frontend.
7. Créer `frontend/.env`.
8. Démarrer le frontend.
9. Se connecter avec l’administrateur seedé.
10. Créer les utilisateurs et attribuer les rôles.
11. Créer une source.
12. Créer/configurer son connecteur.
13. Tester le connecteur.
14. Lancer une collecte.
15. Vérifier le journal de collecte.
16. Ouvrir les éléments dans **Veilles**.
17. Qualifier un élément.
18. Le valider ou le rejeter.
19. Publier un élément validé.
20. Vérifier les abonnements et notifications.
21. Créer une action si l’information nécessite un suivi.
22. Générer un rapport.
23. Vérifier le journal d’audit.
24. Vérifier la santé du système.
25. Exécuter les tests automatisés.

---

## Objectif métier

La plateforme sert à **ne pas rater les informations importantes pour le laboratoire**, à les centraliser et à les transformer, lorsque nécessaire, en décisions et actions traçables.

> Elle centralise tout le cycle de veille du laboratoire, depuis la collecte de l’information jusqu’à sa qualification, sa validation, sa diffusion et son suivi.

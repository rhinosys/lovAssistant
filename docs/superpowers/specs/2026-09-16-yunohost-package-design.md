# Package YunoHost pour l'Assistant IA Fablab (AdminLova)

Date : 2026-09-16
Statut : Approuvé (en attente de relecture finale par l'utilisateur)

## Contexte

AdminLova est une app Next.js 15 (React 19) exposant un chat IA (assistant-ui)
adossé à Postgres (threads/messages), un moteur LLM (Ollama local et/ou
Mistral AI Cloud), et un pipeline RAG (scraping DokuWiki → chunking →
embeddings Mistral → vector store JSON local) branché sur l'API `/api/chat`.
Objectif : packager cette app pour une installation en un clic sur un serveur
YunoHost (auto-hébergement du LOV ou d'autres FabLabs).

## Décisions de cadrage

- **Auth** : intégration au SSO YunoHost (SSOwat), en s'appuyant sur le
  mécanisme de headers déjà présent dans `TokenAuthService.authenticateRequest`.
- **LLM** : les deux moteurs supportés — Mistral Cloud par défaut (clé API
  demandée à l'installation), Ollama optionnel via une URL LAN configurable.
  Pas d'installation d'un service Ollama local par le package (trop lourd pour
  un serveur mutualisé).
- **RAG** : scrapé et indexé pendant l'installation (`rag:crawl` puis
  `rag:index`), avec un rafraîchissement automatique hebdomadaire via cron
  YunoHost.
- **Routage** : support à la fois d'un (sous-)domaine dédié et d'une
  installation en sous-chemin (ex: `mondomaine.fr/assistant`).
- **Dépôt** : nouveau repo dédié `admin_lova_ynh` (convention YunoHost),
  créé localement dans `/Users/nrineau/Projects/admin_lova_ynh`, qui
  référence les sources d'AdminLova via `ynh_setup_source`. Portée : usage
  perso/LOV, pas de visée immédiate pour le catalogue officiel YunoHost (donc
  pas de CI YunoHost obligatoire ni de tests multi-arch à ce stade).

## Architecture

```
[Navigateur] --https--> [nginx YunoHost] --http(s)--> [Next.js (systemd, port local)]
                              |                              |
                       SSOwat (headers                       +--> Postgres (ynh_psql, DB dédiée)
                       Remote-User)                           +--> Mistral AI Cloud (API externe)
                                                               +--> Ollama LAN (optionnel, API externe)
                                                               +--> wiki-old/ (fichiers locaux : markdown + vector-index.json)
```

Le service Next.js tourne nativement (pas de Docker) via
`ynh_install_nodejs` + un service systemd, conformément aux conventions
YunoHost. Le Dockerfile/docker-compose.yml existants dans AdminLova restent
inchangés et servent au dev/déploiement conteneurisé indépendant — ils ne
sont pas réutilisés par le package YunoHost.

## Correctifs sur AdminLova (repo applicatif)

Trois changements ciblés, indépendants de YunoHost et rétrocompatibles avec
l'usage actuel (dev local, Docker) :

1. **Auth SSO** — dans `src/server/auth/session.ts`,
   `TokenAuthService.authenticateRequest` lit en priorité les headers
   `Remote-User` (et `Auth-User` en repli) envoyés par SSOwat, avant le
   fallback existant `x-user-id`/`x-username`. Comportement inchangé si ces
   headers sont absents (dev local, Docker).
2. **basePath dynamique** — `next.config.ts` lit `process.env.NEXT_BASE_PATH`
   (vide par défaut) et le passe à `basePath`. Un petit helper
   `src/lib/api-url.ts` exporte `apiUrl(path: string)` qui préfixe avec ce
   basePath (exposé côté client via `NEXT_PUBLIC_BASE_PATH`, injecté au
   build). Les 5 appels `fetch("/api/...")` dans `src/app/chat/page.tsx`
   passent par ce helper.
3. **Script de migration explicite** — nouveau `scripts/migrate.ts` qui
   appelle `runMigrations()` (`src/server/persistence/migrate.ts`, jusqu'ici
   jamais invoqué automatiquement). Exposé comme `npm run db:migrate` dans
   `package.json`.

Ces correctifs sont mergés dans le repo AdminLova existant (pas de fork).

## Repo de packaging `admin_lova_ynh`

Structure conforme aux conventions YunoHost :

```
admin_lova_ynh/
├── manifest.toml
├── conf/
│   ├── nginx.conf              # template, gère domaine racine ET sous-chemin
│   ├── systemd.service         # service Node.js
│   ├── .env.template           # variables injectées par les scripts install/upgrade
│   └── cron_rag_refresh        # cron hebdomadaire (rag:crawl + rag:index)
├── scripts/
│   ├── install
│   ├── upgrade
│   ├── remove
│   ├── backup
│   ├── restore
│   └── change_url
└── doc/
    ├── DESCRIPTION.md
    └── screenshots/
```

### manifest.toml (champs clés)

- `id = "admin_lova"`, `packaging_format = 2`
- `integration.yunohost = ">= 11.2"`
- `install.domain`, `install.path` (défaut `/`, mais modifiable → sous-chemin
  supporté), `install.admin`, `install.is_public`
- `install.mistral_api_key` (question de type `string`, requise)
- `install.ollama_base_url` (question optionnelle, vide par défaut)
- `resources.ports` (port interne réservé), `resources.system_user`,
  `resources.install_dir`, `resources.database` (type `postgresql`)

### install (étapes)

1. `ynh_setup_source` — récupère AdminLova à un tag/commit figé.
2. `ynh_install_nodejs --nodejs_version=22`
3. `ynh_add_psql_db` — crée base + utilisateur Postgres dédiés à l'app.
4. Génère `.env` depuis `conf/.env.template` : `DATABASE_URL` (Postgres
   dédié), `SESSION_SECRET` (généré aléatoirement), `MISTRAL_API_KEY`
   (saisie install), `OLLAMA_BASE_URL` (saisie install, optionnelle),
   `NEXT_BASE_PATH`/`NEXT_PUBLIC_BASE_PATH` (déduits de `install.path`),
   `PORT` (port réservé YunoHost).
5. `npm ci && npm run build` (basePath figé au build, donc build fait à
   l'installation et à chaque upgrade/change_url).
6. `npm run db:migrate`
7. `npm run rag:crawl && npm run rag:index` (première indexation ; log
   avertissement non bloquant si Mistral API indisponible — l'app reste
   utilisable sans RAG, dégradé).
8. `ynh_add_systemd_config` + `ynh_use_logrotate`
9. `ynh_add_nginx_config` (template gérant domaine racine ou sous-chemin)
10. `ynh_add_config` du fichier cron (`conf/cron_rag_refresh`, hebdomadaire)
11. SSOwat activé par défaut (`ynh_permission_update` sur le rôle
    utilisateurs connectés) ; `is_public` configurable à l'install.

### upgrade

Re-`ynh_setup_source`, régénère `.env` si des variables ont changé,
`npm ci && npm run build`, `npm run db:migrate` (idempotent — la table
`_schema_migrations` empêche les ré-applications), redémarre le service.
Ne touche pas aux données Postgres ni à `wiki-old/`.

### remove

Arrête et supprime le service systemd, la conf nginx, la base Postgres
(`ynh_psql_remove_db`), le répertoire d'installation, le cron.

### backup / restore

`backup` sauvegarde : dump Postgres (`ynh_psql_dump_db`), `wiki-old/`
(markdown + `vector-index.json` + `manifest.json`), `.env`, conf
nginx/systemd. `restore` fait l'inverse puis relance le service.

### change_url

Régénère `NEXT_BASE_PATH`/`NEXT_PUBLIC_BASE_PATH` selon la nouvelle URL,
relance `npm run build` (obligatoire car basePath est figé au build), puis
`ynh_add_nginx_config`.

### Cron RAG (rafraîchissement hebdomadaire)

`conf/cron_rag_refresh` (installé dans `/etc/cron.weekly/` ou via
`ynh_add_config` sur une entrée crontab dédiée) exécute, en tant
qu'utilisateur système de l'app :
`npm run rag:crawl && npm run rag:index`, avec log vers
`/var/log/admin_lova/rag-refresh.log`. Échec non bloquant : en cas d'erreur
(ex. DokuWiki source injoignable), le RAG existant reste utilisé tel quel.

## Gestion des erreurs

- **Mistral API indisponible pendant l'install/le cron RAG** : log
  d'avertissement, l'installation se termine quand même (RAG non indexé ou
  périmé mais app fonctionnelle en mode chat simple).
- **Postgres indisponible** : `ynh_add_psql_db` fait échouer l'installation
  immédiatement (comportement standard YunoHost, pas de mode dégradé — la DB
  est requise pour les threads/messages).
- **Migration DB qui échoue** : `npm run db:migrate` retourne un code
  d'erreur non nul, ce qui fait échouer explicitement le script
  install/upgrade (évite de démarrer l'app sur un schéma incomplet).
- **basePath mal formé** (ex. slash final) : normalisé côté script bash
  (strip du slash final) avant injection dans `.env`.

## Tests / validation

Pas de CI YunoHost formelle vu la portée perso. Validation manuelle prévue :
- Install propre sur une instance YunoHost de test (VM ou serveur dédié),
  en sous-domaine puis en sous-chemin, avec et sans `OLLAMA_BASE_URL`.
- Upgrade depuis une version antérieure (vérifie non-régression des
  données Postgres et `wiki-old/`).
- Backup puis restore sur une nouvelle instance.
- Vérification manuelle du chat (envoi d'un message, citation RAG) et de
  l'auth SSO (connexion via SSOwat, `Remote-User` bien pris en compte).

## Hors périmètre (explicitement exclu)

- Service Ollama installé/managé par le package (cf. décision LLM).
- Publication au catalogue officiel YunoHost (CI, lint strict, multi-arch).
- Migration du vector store JSON local vers pgvector (mentionné dans
  `docker-compose.yml` mais non utilisé actuellement par le code RAG) — reste
  un JSON local (`wiki-old/vector-index.json`) tel quel.

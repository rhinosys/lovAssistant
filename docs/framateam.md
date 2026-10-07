# Intégration Framateam (Mattermost)

L'assistant peut (1) indexer des canaux **publics** de l'équipe Framateam du LOV
comme source RAG, citée par permalien, et (2) répondre dans Framateam quand un
membre l'interpelle. L'instance framateam.org est mutualisée et nous n'en sommes
pas administrateurs : tout passe par un compte utilisateur ordinaire, avec des
appels espacés.

## Configuration

Page **Administration › Framateam** (`/admin/framateam`, lien « Admin » en bas
de la barre latérale du chat, visible des seuls administrateurs) :

1. Saisir l'URL (`https://framateam.org`), l'équipe (nom dans l'URL, ex.
   `labolov`), l'identifiant et le mot de passe, puis **Enregistrer**.
2. **Tester la connexion** : affiche le compte connecté et l'équipe.
3. Dans **Canaux publics**, cocher « Indexer » pour chaque canal à ajouter au
   RAG, « Bot » pour chaque canal où l'assistant peut répondre. Tout est
   désactivé par défaut.
4. **Synchroniser maintenant** pour le chargement initial ; ensuite la
   synchronisation est automatique (intervalle réglable, 15 min minimum).

Le mot de passe est chiffré en base (AES-256-GCM) avec `APP_ENCRYPTION_KEY`
(32 octets, `openssl rand -base64 32`) et n'est jamais renvoyé par l'API. Si la
clé change, ressaisir le mot de passe.

Sans réglage en base, les variables `FRAMATEAM_URL`, `FRAMATEAM_TEAM`,
`FRAMATEAM_LOGIN_ID`, `FRAMATEAM_PASSWORD`, `FRAMATEAM_TRIGGER`,
`FRAMATEAM_ACCEPT_MENTIONS`, `FRAMATEAM_SYNC_INTERVAL_MIN` du `.env` sont
utilisées (mode développement ou CLI). En mode `.env`,
`FRAMATEAM_INDEX_CHANNELS` / `FRAMATEAM_LISTEN_CHANNELS` (noms de canaux séparés
par des virgules) activent les canaux à la synchronisation.

### Compte à utiliser

Un **compte dédié** (ex. `assistant-lov`) sans double authentification est
recommandé : les réponses du bot sont publiées sous ce nom. Avec un compte
personnel, laisser « Répondre aussi aux @mentions » décoché, sinon chaque
mention de la personne déclencherait le bot ; seul le mot-clé (`!lov` par
défaut) le déclenche alors. Un compte avec MFA ne peut pas se connecter via
l'API (erreur explicite au test de connexion).

## Accès administrateur

- **YunoHost** : permission `admin` du paquet (URL `/admin` et `/api/admin`,
  groupe `admins` par défaut, modifiable dans le panneau YunoHost). nginx
  ajoute l'en-tête `X-Lov-Admin: 1` uniquement sur ces chemins protégés par
  SSOwat et le supprime partout ailleurs ; l'application ne lui fait confiance
  que si `TRUST_PROXY_ADMIN_HEADER=true` (posé par le paquet).
- **Développement** : `ADMIN_USERS=nom1,nom2` (ignoré quand
  `NODE_ENV=production`). Sans en-tête d'identité, le navigateur local est
  l'utilisateur `fablab_member`.

Les routes `/api/admin/*` vérifient le rôle côté serveur et refusent les
modifications intersites (contrôle Origin/Host).

## Services et commandes

| Commande | Rôle |
|---|---|
| `npm run framateam:bot` | Service longue durée : websocket, réponses, synchronisation périodique. Recharge la configuration à chaque enregistrement admin (`LISTEN framateam_config`). En YunoHost : unité systemd `admin_lova-framateam`. |
| `npm run framateam:sync` | Synchronisation manuelle (`-- --channel <id>` pour un canal). |
| `npm run framateam:forget -- --post <id\|permalien>` | Retire un message de l'index, définitivement. |
| `npm run framateam:forget -- --channel <nom\|id>` | Retire tout un canal et désactive son indexation. |
| `npm run framateam:forget -- --list` | Canaux connus, états et nombre de fils indexés. |

Une seule synchronisation tourne à la fois (verrou consultatif PostgreSQL
partagé entre l'admin, le CLI et le bot ; une seconde demande reçoit 409).

## Ingestion

- Chargement initial paginé (200 messages par page), repris à la dernière page
  en cas d'interruption ; puis incrémental avec `since` (créations,
  modifications et suppressions), repli sur la pagination si la limite de 1000
  résultats est atteinte.
- Un document par **fil** (message racine + réponses), dans l'ordre. Sont
  exclus : messages système, supprimés, retirés (RGPD), réponses du bot
  (marquées `from_lov_assistant`), accusés de réception (« merci », « +1 »…), et fils trop courts.
- **Aucun nom d'auteur** n'est indexé ; les `@mentions` deviennent `@membre`.
  Le texte libre n'est pas analysé : un nom écrit en toutes lettres dans un
  message reste présent (utiliser le retrait RGPD si nécessaire).
- Métadonnées : canal, date, permalien `https://framateam.org/<équipe>/pl/<id>`.
- Un fil inchangé (empreinte SHA-256) n'est pas ré-embarqué.
- Appels API sérialisés et espacés (250 ms), `Retry-After` respecté sur 429,
  backoff exponentiel sur 5xx/réseau, re-login unique sur 401.

Stockage : tables `framateam_*` (migration `002_framateam.sql`). Les embeddings
`mistral-embed` sont en `REAL[]` et la similarité est calculée dans l'application,
comme pour le wiki : pas besoin de l'extension pgvector. Si le volume devient
important, migrer la colonne vers `vector(1024)` avec un index HNSW.

## Réponses

Les fils indexés s'ajoutent aux sources YesWiki/DokuWiki (4 fils au plus),
titrés « Discussion Framateam ~canal (date) » et cités par permalien. Le prompt
les présente comme des retours de membres, jamais comme des consignes
officielles : le wiki prime en cas de contradiction, notamment pour la sécurité.

Dans Framateam, un message commençant par le mot-clé dans un canal public où le
bot est activé reçoit la réaction 👀, puis une réponse dans le fil (même
pipeline que le chat web, avec les questions précédentes du fil comme contexte),
puis la réaction est retirée. Les canaux privés et messages directs sont
ignorés, ainsi que les réponses du bot lui-même ; avec un compte personnel, les
questions de la personne titulaire du compte sont bien traitées. Le service
doit tourner (`npm run framateam:bot` en local) et la case « Bot » du canal
être cochée. Après une coupure, le bot se reconnecte (backoff 2 s → 5 min avec
gigue) et traite les déclenchements manqués des 15 dernières minutes.

## RGPD

- Seuls les canaux publics cochés sont indexés ; décocher « Indexer » supprime
  immédiatement le contenu du canal.
- **Retirer un message** : admin (champ permalien) ou `framateam:forget --post`.
  Le fil est retiré de l'index immédiatement puis réindexé sans le message ;
  l'identifiant est conservé dans `framateam_forgotten` pour qu'il ne soit plus
  jamais indexé, y compris après un rechargement complet.
- **Retirer un canal** : bouton « Retirer de l'index » ou
  `framateam:forget --channel`.
- Les messages supprimés dans Framateam disparaissent de l'index à la
  synchronisation suivante.
- Les journaux contiennent des identifiants (messages, canaux, admin), jamais le
  contenu des messages ni le mot de passe.

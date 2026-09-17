# Statut et mise à jour du RAG

Le panneau du chat interroge `GET /api/rag` (sans cache) toutes les quatre
secondes. Il affiche le nombre de documentId distincts réellement indexés,
le nombre de fragments, la date du dernier index et la phase de maintenance.

`POST /api/rag/refresh` démarre la collecte puis l'indexation sans bloquer la
requête HTTP. `npm run rag:refresh` utilise le même orchestrateur pour cron.
Un verrou filesystem contient le PID propriétaire ; une tâche concurrente
est refusée (409). Après arrêt du propriétaire, le statut devient interrompu
et un prochain lancement peut reprendre. Chaque sous-processus est limité à
30 minutes et utilise le chemin absolu du Node du service.

Les fichiers sont générés dans un répertoire temporaire sous `wiki-old`.
Un index vide n'est pas publié. Après succès, le fichier vectoriel remplace
atomiquement le précédent. Le chat recharge son cache quand le fichier change.
Les erreurs détaillées restent dans les logs serveur, sans exposer de secrets
via l'API. Une collecte partielle non vide reste possible si certaines pages
wiki ne répondent pas : le compteur décrit les documents effectivement indexés.

## Accès

L'API de lancement est désactivée sauf si `RAG_REFRESH_ENABLED=true`.
En YunoHost, le package l'active et réserve `/api/rag/refresh` à la permission
`rag` du groupe `admins`. Se connecter au portail YunoHost comme administrateur
avant d'utiliser le bouton. Les visiteurs peuvent lire le statut.
Un contrôle Origin/Host refuse les requêtes intersites. Hors YunoHost, mettre
un contrôle d'accès équivalent devant cette route avant de l'activer :
l'authentification prototype du chat accepte les visiteurs et ne suffit pas.

Cette exécution en arrière-plan cible Next.js natif sous systemd, pas une
fonction serverless. Les commandes historiques `rag:crawl` et `rag:index`
restent disponibles pour le diagnostic, mais ne partagent pas le verrou :
utiliser `rag:refresh` en exploitation.

## Validation

Tests : compteur distinct, index absent, exclusion concurrente, tâche
interrompue, conservation de l'index en cas d'échec et publication réussie.
`npm test`, `npx tsc --noEmit`, puis build sous Node 22.

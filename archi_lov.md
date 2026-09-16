Tu es architecte logiciel spécialisé dans les assistants IA auto-hébergés,
Ollama, la recherche documentaire (RAG) et le protocole MCP.

MISSION

Réalise une étude technique pour sélectionner la meilleure configuration
d’un assistant IA pour notre fablab. Nous voulons une recommandation
argumentée, réalisable et maintenable par une petite équipe.

L’objectif est de choisir une architecture avant de commencer le développement.

CONTEXTE

- Nous disposons déjà d’Ollama sur un PC au fablab.
- Nous souhaitons construire l’interface web avec assistant-ui :
  https://github.com/assistant-ui/assistant-ui
- Nous possédons plusieurs wikis hébergés sur des serveurs distants.
- L’assistant devra répondre en français à partir de ces wikis et citer
  les pages utilisées avec des liens cliquables.
- À terme, nous développerons des serveurs MCP pour automatiser des tâches
  administratives du fablab.
- Nous souhaitons privilégier l’auto-hébergement, les logiciels open source,
  des coûts faibles et une maintenance simple.
- L’inférence doit utiliser notre Ollama local. Ne prévois aucun recours
  automatique à un modèle cloud.
- L’accès aux wikis distants reste nécessaire : ne confonds pas inférence
  locale et fonctionnement entièrement hors ligne.
- assistant-ui est le choix d’interface de référence. Tu peux signaler une
  alternative pertinente comme point de comparaison, sans remplacer ce choix
  sans justification.

INFORMATIONS ENCORE INCONNUES

- Matériel du PC : CPU, RAM, GPU, VRAM, disque et système d’exploitation.
- Version d’Ollama et modèles déjà installés.
- Technologies, URL, volumes, formats et authentification des wikis.
- Présence de pages privées ou de droits différents selon les utilisateurs.
- Nombre d’utilisateurs et nombre de conversations simultanées.
- Accès souhaité : réseau du fablab uniquement ou également depuis Internet.
- Compétences de l’équipe : TypeScript, Python, Docker, administration système.
- Applications concernées par les futures tâches administratives.

Commence par les questions qui peuvent réellement modifier l’architecture,
avec un maximum de huit questions regroupées. Si les réponses ne sont pas
disponibles, poursuis l’étude avec des hypothèses explicites et plusieurs
scénarios de dimensionnement. Ne demande aucun secret.

1. VÉRIFIER LES COMPATIBILITÉS ACTUELLES

Consulte le dépôt GitHub, les exemples et la documentation officielle
d’assistant-ui, d’Ollama et des composants envisagés.

Vérifie notamment :
- les runtimes et backends compatibles avec assistant-ui ;
- les possibilités d’intégration d’Ollama ;
- le streaming des réponses et des appels d’outils ;
- la gestion des conversations et leur persistance locale ;
- l’affichage des sources et des demandes de confirmation ;
- la connexion du backend à de futurs serveurs MCP ;
- les éventuelles dépendances à un service cloud et comment s’en passer.

Distingue clairement :
- une fonction fournie par assistant-ui ;
- une fonction du backend ;
- une capacité du modèle ;
- une fonction nécessitant du développement.

Vérifie les versions, licences et limites. Ne considère pas la compatibilité
avec une API « OpenAI-compatible » comme une preuve que toutes les fonctions
sont prises en charge.

2. COMPARER TROIS ARCHITECTURES MAXIMUM

Étudie au minimum :
A. assistant-ui + backend TypeScript avec AI SDK + Ollama.
B. assistant-ui + backend Python, par exemple FastAPI, avec une bibliothèque
   de RAG ou d’orchestration si elle apporte un bénéfice concret.
C. Une autre architecture uniquement si elle simplifie réellement le projet.

Pour chaque option, précise :
- les composants et leur rôle ;
- leur emplacement : navigateur, PC local, éventuel autre serveur ;
- les flux réseau ;
- la gestion du RAG, des utilisateurs, des conversations et de MCP ;
- la complexité de développement et d’exploitation ;
- les dépendances, licences et coûts ;
- les limites et les risques d’intégration.

Privilégie Docker Compose si cela convient au contexte.
Ne propose Kubernetes que si une contrainte démontrée le justifie.

Ne présuppose pas que le navigateur doit accéder directement à Ollama.
Étudie le passage par un backend qui centralise les accès et les permissions.

3. DÉFINIR L’ACCÈS AUX WIKIS

Compare :
- recherche directe via les API des wikis ;
- synchronisation et indexation locale pour le RAG ;
- approche hybride.

Explique :
- comment récupérer les pages : API, exports ou crawl autorisé ;
- comment traiter les pièces jointes si elles sont nécessaires ;
- comment découper les documents en conservant titres, sections et URL ;
- comment synchroniser créations, modifications et suppressions ;
- comment gérer les erreurs réseau et la fraîcheur des données ;
- comment respecter les droits des utilisateurs dans la recherche,
  les extraits, les citations et les caches ;
- comment éviter de diffuser une page privée via un index partagé.

Compare une recherche lexicale, vectorielle et hybride.
N’ajoute un reranker que si son apport justifie son coût sur le matériel local.

Compare un stockage simple et une solution vectorielle dédiée, en tenant compte
de ce qui est déjà installé. Ne multiplie pas les bases sans nécessité.

Prévois :
- des réponses avec sources vérifiables ;
- un refus de conclure lorsque les sources sont insuffisantes ;
- la gestion de pages contradictoires ou obsolètes ;
- un fonctionnement dégradé si les wikis sont indisponibles.

Explique si un fine-tuning est utile ou inutile pour ce besoin.

4. CHOISIR LES MODÈLES ET DIMENSIONNER

Propose une courte sélection actuelle :
- modèle conversationnel adapté au français ;
- modèle capable d’appels d’outils fiables ;
- modèle d’embeddings adapté aux documents français et multilingues.

Ils peuvent être distincts ou partagés selon les besoins.
Vérifie leur disponibilité dans Ollama et leurs licences.

Prévois trois scénarios :
- CPU seul ;
- GPU avec environ 8 à 12 Go de VRAM ;
- GPU avec environ 16 à 24 Go de VRAM.

Pour chaque scénario, indique :
- modèle et quantification envisageables ;
- RAM et VRAM nécessaires, sous forme d’estimations ;
- contexte raisonnable et impact du cache KV ;
- concurrence possible et besoin d’une file d’attente ;
- compromis entre qualité, latence et consommation mémoire.

Tiens compte de la concurrence entre génération, embeddings et indexation.
Ne présente aucune performance estimée comme un benchmark mesuré.

5. PRÉPARER L’ÉVOLUTION VERS MCP

Explique où se situe le client MCP et comment les outils sont présentés
au modèle via le backend. Ne suppose pas qu’Ollama se connecte directement
aux serveurs MCP.

Vérifie les transports MCP pertinents pour :
- des serveurs locaux ;
- des serveurs distants.

Propose une progression :
- première étape : consultation et outils en lecture seule ;
- deuxième étape : préparation d’une action avec aperçu ;
- troisième étape : exécution après confirmation explicite.

Les exemples possibles sont : préparer un courriel, mettre à jour une fiche
adhérent ou enregistrer une demande administrative. Ce sont des exemples,
pas des applications dont nous avons confirmé l’existence.

Précise :
- l’identité de l’utilisateur et ses permissions ;
- le stockage des credentials côté serveur ;
- la validation des paramètres ;
- les confirmations liées à une action et à ses paramètres exacts ;
- les délais d’expiration, erreurs et tentatives répétées ;
- l’idempotence pour éviter les doubles opérations ;
- la journalisation de qui a exécuté quelle action et de son résultat.

Explique comment empêcher qu’une instruction présente dans un wiki ou dans
une réponse d’outil déclenche une action administrative non autorisée.
Les contrôles d’autorisation doivent être appliqués par le backend ou
le service cible, indépendamment des décisions du modèle.

6. EXPLOITATION ET ACCÈS

Propose une configuration adaptée à une petite équipe :
- authentification et séparation des conversations ;
- accès local et option d’accès distant sécurisé ;
- protection d’Ollama sans exposition publique directe ;
- sauvegarde et restauration des données persistantes ;
- redémarrage automatique et comportement si le PC est éteint ;
- logs utiles, rétention et limitation des données personnelles ;
- mises à jour, versions figées et retour arrière.

Distingue les données à sauvegarder des index qui peuvent être reconstruits.

7. PLAN DE VALIDATION

Définis un protocole de PoC reproductible comprenant :
- questions en français avec réponses connues dans les wikis ;
- questions sans réponse documentaire ;
- vérification des citations ;
- prise en compte d’une page modifiée puis supprimée ;
- test de séparation des droits entre deux utilisateurs ;
- plusieurs conversations simultanées ;
- indisponibilité d’Ollama ou d’un wiki ;
- appel d’un outil MCP de test en lecture seule ;
- simulation d’une écriture avec confirmation puis annulation ;
- injection d’instructions dans une page de test ;
- tentative répétée d’une même action.

Mesure notamment :
- qualité des réponses et fidélité aux sources ;
- temps jusqu’au premier token et temps total ;
- RAM et VRAM utilisées ;
- fiabilité des appels d’outils ;
- complexité d’installation et de maintenance.

Propose des critères d’acceptation explicites et ajustables.
Sépare strictement tests réalisés, tests proposés et résultats attendus.
Si tu n’as pas accès au PC, ne prétends avoir effectué aucun benchmark.

LIVRABLES

Rédige l’étude en français avec :

1. Une recommandation principale dès le début, accompagnée des conditions
   matérielles ou fonctionnelles qui pourraient la modifier.
2. Un tableau comparatif pondéré :
   - qualité des réponses documentaires : 25 % ;
   - simplicité de maintenance : 25 % ;
   - compatibilité assistant-ui, Ollama et MCP : 20 % ;
   - adéquation au matériel et performances : 15 % ;
   - sécurité et gestion des accès : 10 % ;
   - coûts et licences : 5 %.
3. Une architecture cible avec les composants, leurs emplacements et les flux.
4. La liste précise des logiciels, versions et modèles recommandés.
5. Un plan de réalisation en trois étapes :
   chat local → wikis et citations → outils MCP administratifs.
6. Une estimation de l’effort et des coûts récurrents, avec hypothèses.
7. Le protocole de PoC et les critères de décision.
8. Les questions restant à trancher.
9. Les sources officielles datées et les liens vers les exemples pertinents.

Ne produis pas seulement un catalogue de technologies : tranche.
Si des informations manquent, fournis un choix provisoire et indique
précisément ce qui permettrait de le confirmer ou de le changer.

Ne développe et ne déploie rien pendant cette étude.
# Accompagnement à partir des documents, puis du web

Le chat reformule les documents en réponses naturelles : étapes, explications,
questions utiles. Il ne juxtapose plus des citations littérales. Aucune question
ou catégorie de matériel ne dispose d’une réponse ou d’un compteur codé en dur.
Les documents retrouvés sont développés dans leur ordre de pertinence pour
conserver autant que possible les procédures et listes complètes.

## Sources et comportement

Les faits concernant le LOV viennent des documents récupérés. Une provenance
DokuWiki ne signifie pas qu’une machine est retirée. Une affirmation utilisateur
ou une réponse antérieure ne constitue pas une preuve. Les informations absentes
sont signalées ; les étapes déjà documentées restent expliquées.

Si une aide technique manque, le modèle propose une requête autonome et le serveur
exécute une recherche via Mistral Conversations et son outil web_search. La réponse
externe est identifiée explicitement et accompagnée des références renvoyées par
l’outil. Une réponse sans exécution de recherche ou sans références est refusée.
Une indisponibilité est annoncée, sans prétendre avoir trouvé une procédure.
Le web ne sert pas à supposer la disponibilité ou les règles locales du LOV.

## Protections et limites

- Aucun faux inventaire de secours YesWiki ni état disponible par défaut.
- Les messages système provenant du navigateur sont refusés.
- Une seconde passe retire les précisions non étayées tout en gardant une aide
  pédagogique. La validation sémantique par modèle n’est pas une garantie absolue.
- Les liens RAG sont issus des identifiants validés ; les liens web proviennent
  des références de l’outil, pas des URL écrites librement dans la réponse.
- Les documents peuvent être incomplets ou obsolètes ; les nombres décrivent
  les entrées documentées et ne prouvent pas l’inventaire opérationnel actuel.
- La recherche web nécessite la clé Mistral et utilise ce service cloud même si
  le modèle de conversation choisi est Ollama. Seule la requête technique est
  envoyée, avec consigne d’exclure données personnelles et contenu interne.
- La relecture et le web ajoutent de la latence et des appels facturables.
  Le compteur de tokens du chat inclut la relecture, pas la recherche web.

## Vérification

Tests de reformulation, références invalides, Markdown, absence de faux inventaire,
décision de recherche et provenance web. Validation réelle avec les modèles et
le service Next.js dans le conteneur YunoHost : procédure documentée, synthèse
d’un inventaire et aide technique absente du RAG. Les formulations des questions
sont des scénarios de test, jamais des branches dans le code de production.

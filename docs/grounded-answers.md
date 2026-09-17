# Réponses factuelles vérifiables

## Incident corrigé

Le client YesWiki renvoyait un faux inventaire Laser/Prusa quand BazarAPI ne
répondait pas ou renvoyait du HTML. Ces fixtures étaient présentées au modèle
comme de vraies sources. La disponibilité, les matériaux et les liens des
machines inconnues étaient aussi inventés. Tous ces fallbacks ont été retirés.
Les fixtures n'existent désormais que dans les tests.

## Contrat de réponse

Le modèle sélectionne des extraits sous forme JSON. Le serveur vérifie chaque
identifiant de source et chaque citation exacte, puis compose la réponse à
partir de ces citations et des URLs récupérées. La prose générée n'est jamais
affichée comme un fait. Une citation invalide, une sortie non structurée ou
une sélection vide conduit à une réponse d'abstention. Les citations sont
échappées comme texte Markdown ; les liens sont construits côté serveur.

Le navigateur ne peut pas transmettre de message system. Le prompt serveur
est toujours présent et les réponses assistant passées ne sont pas utilisées
comme preuves. Les messages utilisateur récents servent seulement à retrouver
le sujet d'une question de suivi.

Les demandes d'imprimantes parcourent les documents d'impression 3D de l'index,
regroupés par document, au lieu des trois seuls fragments les plus similaires.
Les liens vers les pages YesWiki complémentaires proviennent des pages lues.

## Limites explicites

Cette sélection de documents n'est pas un inventaire exhaustif. Une page
DokuWiki n'indique pas que sa machine est historique, retirée ou indisponible.
Une mention ne confirme pas un état actuel. Le contenu du wiki peut lui-même
être obsolète ou faux ; vérifier l'état auprès des référents. La pertinence de
la sélection reste dépendante du modèle. Les réponses sont désormais des
extraits sourcés plutôt qu'une synthèse libre ; l'affichage attend leur validation
au lieu de diffuser des tokens non contrôlés.

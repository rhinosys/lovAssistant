# Bambu Studio
[Bambu Studio](https://bambulab.com/en/download/studio) est le logiciel utilisé pour préparer les modèles 3D et les envoyer aux imprimantes Bambu Lab du LOV. Il transforme un fichier 3D en instructions d'impression : cette étape s'appelle le **tranchage**.

![image](https://user-images.githubusercontent.com/110661856/207830904-6c5ed9f0-b237-445b-aae0-7b57751b4b90.PNG)
*Capture d'écran de Bambu Studio en anglais.*

## Avant de commencer
  - Utiliser la session et la configuration mises à disposition au LOV.
  - Vérifier le modèle, le filament disponible et l'imprimante à utiliser avant de préparer le fichier.
  - Ne pas modifier les profils système ou les paramètres de maintenance sans l'accord d'un référent.

## Créer ou ouvrir un projet
  1. Ouvrir Bambu Studio.
  1. Choisir l'imprimante dans la liste : [Bambu Lab P1S](https://labovilleurbanne.fr/dokuwiki/equipement:impression_3d:bambu_lab_p1s) ou [Bambu Lab A1 mini](https://labovilleurbanne.fr/dokuwiki/equipement:impression_3d:bambu_lab_a1_mini).
  1. Vérifier le type de plateau installé et sélectionner le même dans le logiciel.
  1. Importer le modèle (formats courants : STL, 3MF ou OBJ) avec **Importer** ou par glisser-déposer.
  1. Vérifier que la pièce tient dans le volume d'impression. L'A1 mini est destinée aux pièces plus petites.

## Préparer le plateau
  1. Sélectionner le bon filament : matière, couleur et profil doivent correspondre à la bobine réellement chargée.
  1. Placer le modèle à plat sur le plateau. Utiliser les outils de déplacement, rotation et échelle seulement si nécessaire.
  1. Contrôler que les pièces ne se chevauchent pas et qu'elles restent entièrement dans la zone imprimable.
  1. Ajouter des supports uniquement si la géométrie le nécessite. Préférer les réglages simples et documenter les exceptions.

## Trancher et contrôler
  1. Cliquer sur **Trancher le plateau**.
  1. Lire le temps estimé et la quantité de filament.
  1. Ouvrir l'aperçu couche par couche : vérifier la première couche, les parois, les supports et les déplacements de la buse.
  1. Si le résultat est incohérent, revenir à la préparation du plateau plutôt que de lancer l'impression.

## Envoyer l'impression
  1. Vérifier une dernière fois le nom de l'imprimante destinataire, le plateau et le filament.
  1. Cliquer sur **Imprimer le plateau** pour envoyer le fichier à l'imprimante connectée, ou exporter le fichier pour l'utiliser par carte microSD.
  1. Se rendre devant l'imprimante et surveiller la première couche.
  1. Si l'impression échoue, l'arrêter depuis l'imprimante et noter le problème.

## Impression de démonstration : 3D Benchy
Le **3D Benchy** est un petit bateau de référence qui permet de découvrir le flux complet et d'observer la qualité de l'impression.

  1. Ouvrir un modèle Benchy approuvé par le LOV dans Bambu Studio.
  1. Sélectionner la P1S ou l'A1 mini, le plateau réel et un profil PLA correspondant au filament chargé.
  1. Placer le modèle à plat, cliquer sur **Trancher le plateau** puis vérifier l'aperçu.
  1. Vérifier le temps, la quantité de filament et le nom de l'imprimante.
  1. Cliquer sur **Imprimer le plateau**, puis suivre la première couche devant la machine.
  1. À la fin, laisser refroidir le plateau, récupérer le Benchy et noter les éventuels défauts.

## Erreurs fréquentes
  - **La pièce ne colle pas** : nettoyer le plateau, vérifier le profil choisi et relancer seulement après avoir retiré les résidus.
  - **Le mauvais filament est sélectionné** : annuler avant l'envoi et aligner le profil avec la bobine chargée.
  - **La pièce dépasse du plateau** : réduire, repositionner ou utiliser l'autre imprimante si le volume est insuffisant.
  - **Le fichier part vers la mauvaise machine** : vérifier l'imprimante affichée juste avant l'envoi.
Ressources pour apprendre à utiliser kiri:moto :
  - (en) https://www.youtube.com/watch?v=nQUvXOjDib4

## Configuration de Kiri:Moto
URL: https://grid.space/kiri/

Si vous utilisez l'ordinateur de la CNC, la configuration de l'[ID CNC PRO](https://labovilleurbanne.fr/dokuwiki/equipement:cnc:idcncpro) est déjà stocké dans le cache du navigateur.

Si vous utilisez votre ordinateur, *importez* les fichiers de l'archive suivante : ![image](:equipement:cnc:id-cnc-pro_kiri-moro.zip)
  - id_cnc_pro.km : configuration de la machine
  - tools.km : configuration des têtes de fraisage

## Préparation du GCode avec Kiri:Moto
  1. Avant tout, vérifier que le bon *device* est sélectionné (en haut à droite)
  1. *Importer* vos fichiers STL

  1. Configurer le *Stock* (matériau qui sera travaillé) et l'origine (qui correspondra au 0,0,0 sur la machine) selon votre projet (voir ci-dessous)
    1. Activer le mode *Offset*
    1. Configurer *Width* et *Depth* à une valeur supérieur au diamètre de l'outil

  1. Configurer l'origine 
    1. //Limits/Z Anchor//: Bottom

  1. Créer les opérations nécessaires (*Operation List* à droite), **en sélectionnant l'outil monté**  (https://docs.grid.space/kiri-moto/CAM/ops)
    1. Pour creuser les formes internes:
      1. pour les opérations qui vont jusqu'en bas du matériau: utiliser *outline* en mode *Inside Only* (besoin de décocher *Outside Only*)
      1. pour les autres: utiliser *pocket* et sélectionner les faces concernées
    1. Pour séparer l'objet du reste du matériau, utiliser *outline* en mode *Outside Only*
    1. Pour des formes complexes, utiliser *rough* (grossier) puis *contour*
    1. Pour des trous à la taille de l'outil monté, utiliser *drill*

  1. Adapter la vitesse des opérations
    1. *Plunge rate*: 10 (valeur conseillée)
    1. *Feed rate*: 500 (valeur conseillé pour du bois tendre)

  1. Cliquer sur Slice pour calculer le chemin de l'outil
  1. Vérifier le résultat avec *Prévisualiser* et *Animer*
  1. *Exporter* le GCode

Objet à découper dans le matériau:
- Objet déjà au format:
- *Stock*
  - *Offset* coché
  - *Width*, *Depth* et *Height* à 0
- *Limits*
  - *Z Anchor*: bottom
- *Outline*
  - *Origin Top* coché
  - *Offset* à zéro (les 3)
# Gravure du circuit (en chantier) =
![image](:projets:gravure_circuit_imprime_moyen.jpg)

Ceci est une page de prise de notes pour de premiers essais de réalisation de circuits imprimés à l'aide de la CNC en simple face.\\

Ce document est **à compléter**, **à illustrer** au fil nos réalisations.\\
Ce document ne permet pas de faire des essais avec la CNC, en solo, sans avoir eu une démonstration au préalable.\\

Le typon est réalisé à l'aide de l'outil Kicad qui va créer les fichiers de fabrication (pistes, perçage et découpe).\\
Ces fichiers seront ensuite mise en forme pour la CNC en utilisant le logiciel Flatcam.\\
La CNC "grave" une plaque de circuit imprimé simple face.\\
La plaque époxy fait 16/10 mm d'épaisseur.\\
Le cuivre fait 35 µm d'épaisseur.\\

Les tests sont effectués sur un PC portable avec Xubuntu 20.04 installé.\\

**Ressources glanées au fil du wiki :**

R1 : [tuto-flatcam-fabrication-circuit-imprime-gerber-flatcam](https://dirtymarmotte.net/tuto-flatcam-fabrication-circuit-imprime-gerber-flatcam)\\
R2 : [Outil pointe javelot](https://bitbucket.org/jpcgt/flatcam/wiki/V-Shaped_bits__Groove_Dimension_Tables)\\

## 1.Export de fichiers à partir de KICAD
version Kicad utilisée : 5.1.5 installé à partir des paquets de la distribution\\

**Important :**\\
Fixer le point origine dans le coin bas gauche de la carte.\\
Avant de "tracer", cocher "utiliser axe auxiliaire comme origine" (fichiers/tracer/tracer).\\

**Dessin des pistes :**\\
toto-Bottom.gbr => format gerber\\

**perçage :**\\
toto-PTH.drl => format excellon (pastille)\\
toto-NPTH.drl => format excellon (mecanique)\\

**contour de la carte :**\\
toto-Edge-Cuts.gbr => format gerber\\

**remarque :**\\
selon la ressource R1, la symétrie mirroir est réalisée avec l'outil FLATCAM.\\

## 2.Flatcam
version FLATCAM utilisée : beta_8.993 (python3)\\

Attention il n'y a pas de "undo" !!\\

FLATCAM fonctionne en 3 étapes.\\

**Chargement du fichier Gerber ou Excellon.**\\
Régler la grille automatique : edit/preference grille 0.254 mm\\
Double clic sur un fichier puis appliquer une transformation : mirror (flip) / Flip on X\\
Recaler les différents fichiers si besoin\\

**Creation d'une géométrie en choisissant la largeur de l'isolation d'une piste.**\\
isolation des pistes : à partir du fichier toto-bottom.gbr\\
Isolation Routing/Tools Table => 0,15 mm (dia=largeur) forme en V en créant un outil (cut Z=0,05 mm et Tool dia =0,15mm) 
puis Generate Isolation Geometry.\\
V-Tip Dia : 0 mm. C'est le diamètre au bout du javelot (0 mm s'il est parfait !) voir ressource R2.\\
Un fichier toto-Bottom.gbr_0.1500_iso est créé.\\

**Creation d'une géométrie en choisissant la largeur du contour de la découpe.**\\
détourage : à partir du fichier toto-edge_cuts.gbr\\
Cutout Tool => Tool diameter : 1,5 mm ; Cut Z : -1,8 mm ; en 3 passes de 0,6 mm\\
B. Manual Bridge Gap puis Generate Manual Geometry\\
Un fichier toto-Edge-cuts.gbr_cutout est créé.\\

**Génération des fichiers GCODE.**\\
Un double clic sur chaque géométrie en vérifiant les paramètres proposés.\\
Pour le perçage un double clic sur chaque fichier "Excellon" en vérifiant les paramètres.\\
Cut Z : -1,8 mm ; Travel Z : 2 mm ; Feedrate Z : 100 mm/min

## = 3.CNC avec Mach3
version MACH3 installée : voir PC du LOV

**Réglage du zéro de la machine en X et Y (pas en Z) :**\\

Fixer la carte (essai avec 4 vis) sans faire dépasser la tête des vis.\\
La carte doit être parfaitement plaquée.\\
Déplacer la tête de la CNC avec le logiciel MACH3 avec les flèches du clavier.\\
Initialiser les zero en X et Y dans MACH3.

**Isolation des pistes (1 passe) :**\\

outil : pointe javelot 30° carbure (boite jaune, repérée PCB)\\

**Perçage (1 passe) :**\\

outil : foret 0,8 mm carbure (boite jaune, repérée PCB)\\

**Détourage de la carte (3 passes) :**\\

outil : fraise ? 1,5 mm carbure (boite jaune)\\

**A chaque étape :**
  -mettre les lunettes de protection
  -activer arrêt urgence (logiciel)
  -changer de l'outil d'usinage
  -désactiver arrêt urgence (logiciel)
  -réglage du zéro en Z avec le palpeur de la CNC
  -ouvrir le fichier .nc (gcode)
  -mettre en marche l'aspirateur
  -mettre en marche la broche à 20000 tr/mn
  -régler le facteur d'échelle sur 10%
  -lancer en appuyant sur "départ"
  -être prêt à cliquer sur le bouton arrêt d'urgence !
  -si tout se passe bien augmenter progressivement le facteur jusqu'à 100%
  -éteindre l'aspirateur
  -arrêter la broche
  -activer arrêt urgence (logiciel)

**Problèmes rencontrés :**\\
La machine s'arrête car les limites de la zone de travail de la CNC sont atteintes\\
Désactiver "limites" pour pouvoir terminer la gravure en cours, ce n'est pas une solution !\\

A suivre ...
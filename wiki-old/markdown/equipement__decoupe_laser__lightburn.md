# LightBurn
LightBurn est un logiciel de pilotage et de conception pour graveuses/découpeuses laser. Il permet de créer des projets directement dans le logiciel ou d'importer des fichiers vectoriels et bitmap, puis de les envoyer à la machine.

**Licence :** Payante (essai gratuit 30 jours). Deux versions disponibles : DSP (lasers CO2 haut de gamme) et GCode (machines GRBL comme le LM2 Pro S2).\\
**Plateformes :** Windows, macOS, Linux.\\
**Site officiel :** [https://lightburnsoftware.com](https://lightburnsoftware.com)\\
**Documentation :** [https://docs.lightburnsoftware.com](https://docs.lightburnsoftware.com)

## Installation
  1. Télécharger LightBurn depuis [la page d'essai officielle](https://lightburnsoftware.com/pages/trial-version-try-before-you-buy)
  1. Installer le logiciel (installeur standard Windows/macOS/Linux)
  1. Au premier lancement, LightBurn propose d'ajouter une machine

## Configuration pour le Laser Master 2 Pro S2
### Ajouter la machine
  1. Aller dans *Devices* (bouton en bas à droite de la fenêtre Laser)
  1. Cliquer sur **Find my Laser** (si connecté en USB) ou **Create Manually**
  1. Sélectionner le profil : **GRBL** (pas GRBL-M3)
  1. Choisir le port série (ex : COM3 sur Windows, /dev/ttyUSB0 sur Linux/macOS)
  1. Baud rate : **115200**
  1. Nom de la machine : *Laser Master 2 Pro S2*
  1. Zone de travail : **400 x 400 mm**
  1. Origine : **Bas gauche** (Front-left)
  1. Cliquer sur Finish

### Paramètres GRBL importants
Dans la console LightBurn (bouton Console), envoyer ces commandes pour vérifier/configurer :

```
$$              → affiche tous les paramètres GRBL
$32=1           → active le mode laser (indispensable)
$110=15000      → vitesse max axe X (mm/min)
$111=15000      → vitesse max axe Y (mm/min)
$130=400        → limite de déplacement axe X (mm)
$131=400        → limite de déplacement axe Y (mm)
```

<WRAP important>
Le paramètre **$32=1** (Laser Mode) est obligatoire. Sans lui, la machine fait des pauses entre chaque changement de puissance, ce qui produit des points de brûlure sur le matériau.
</WRAP>

![Fenêtre Laser de LightBurn](https://labovilleurbanne.fr/dokuwiki/lib/exe/fetch.php?media=equipement%3Adecoupe_laser%3Alightburn_laser_window.png)

Cette fenêtre **Laser** (en bas à droite de l'écran) est le tableau de bord de connexion à la machine :
  - Le bouton **Start / Pause / Stop** lance, met en pause ou arrête le travail en cours
  - **Frame** trace le contour du projet sans activer le laser, pour vérifier le positionnement
  - Le champ **État** affiche Ready (prêt), Run (en cours) ou Alarm (erreur à acquitter)
  - Les coordonnées X/Y/Z affichent la position courante de la tête laser
  - Le bouton **Console** ouvre la ligne de commande GRBL, utile pour envoyer les réglages $ ci-dessus

### Vérifier la connexion
  1. La fenêtre **Laser** (en bas à droite) doit afficher **Ready** en vert
  1. Si elle affiche **Disconnected**, vérifier le port COM et le câble USB
  1. Tester avec le bouton **Frame** (cadrage) pour vérifier que la machine répond

## Utilisation de base
![Zone de travail LightBurn](https://labovilleurbanne.fr/dokuwiki/lib/exe/fetch.php?media=equipement%3Adecoupe_laser%3Alightburn_workspace.png)

La zone de travail (au centre) représente le plateau de la machine à l'échelle réelle (400x400 mm pour le LM2 Pro S2) :
  - La barre d'outils du haut permet de dessiner formes, textes, et d'importer des fichiers
  - Le panneau de droite regroupe les calques **Cuts / Layers** (couleurs = réglages différents) et les propriétés de l'objet sélectionné
  - Le panneau **Laser** en bas à droite affiche l'état de connexion et les commandes Start/Frame
  - Chaque couleur de tracé correspond à un calque avec ses propres réglages de vitesse/puissance (voir capture Cuts/Layers ci-dessous)

### Importer un fichier
  - **SVG / DXF** (vectoriel) : File > Import → les tracés apparaissent directement comme des calques de découpe ou gravure
  - **Image bitmap (PNG, JPG)** : File > Import → l'image est traitée en mode gravure (tramage ou niveaux de gris)
  - **Créer directement** dans LightBurn : outils texte, formes géométriques, importation de polices

### Régler la vitesse et la puissance
![Fenêtre Cuts/Layers – réglage vitesse et puissance](https://labovilleurbanne.fr/dokuwiki/lib/exe/fetch.php?media=equipement%3Adecoupe_laser%3Alightburn_cuts_layers.png)

Chaque ligne de cette fenêtre est un **calque** (Layer), identifié par une couleur, correspondant à un ensemble de tracés dans le dessin :
  - **Mode** : Line (découpe/trait), Fill (remplissage plein), Grayscale ou Image (gravure photo)
  - **Speed** : vitesse de déplacement en mm/min (plus lent = plus profond/marqué)
  - **Max Power / Min Power** : puissance du laser en %, le min sert pour les dégradés en mode Grayscale
  - **Passes** : nombre de répétitions du même tracé (utile pour découper des matériaux épais sans monter la puissance)
  - Double-cliquer sur une couleur permet de modifier tous ces réglages pour le calque correspondant

Les paramètres se règlent dans la fenêtre **Cuts / Layers** (à droite) :

^ Matériau         ^ Mode        ^ Vitesse (mm/min) ^ Puissance min (%) ^ Puissance max (%) ^ Passes ^
| MDF (gravure)    | Grayscale   | 10 000           | 0                 | 100               | 1      |
| Contreplaqué (gravure) | Grayscale | 15 000      | 0                 | 100               | 1      |
| MDF 3mm (découpe) | Line       | 250              | 100               | 100               | 2      |
| Contreplaqué 3mm (découpe) | Line | 400           | 100               | 100               | 2      |
| Carton (découpe) | Line        | 9 000            | 0                 | 100               | 1      |
| Cuir (gravure)   | Grayscale   | 10 000           | 0                 | 100               | 1      |

*Ces valeurs sont indicatives pour le module LU2-10A (10W). Ajuster selon le matériau et son épaisseur.*\\
Source : [Ortur LightBurn Settings](https://www.orturlaser.com/pages/ortur-lightburn-settings)

### Lancer une gravure / découpe
  1. Positionner le matériau sur le plateau
  1. Dans LightBurn, placer le design sur la zone de travail
  1. Cliquer sur **Frame** pour vérifier le cadrage (la machine trace le contour sans laser)
  1. Vérifier la mise au point (distance module laser / matériau = 50 mm)
  1. Cliquer sur **Start** pour lancer

### Utiliser le cadrage (Framing)
Le cadrage est essentiel avant toute découpe :
  - **Frame** : trace le contour du projet à vitesse rapide, laser éteint
  - **Cut selected shapes** : ne lance que les calques sélectionnés
  - Permet de s'assurer que le design rentre bien dans la zone du matériau

## Premier projet pas à pas
Pour prendre en main LightBurn, voici un exemple complet de gravure d'un motif simple sur une chute de contreplaqué :

  1. **Créer ou importer le design** : utiliser l'outil texte (T) ou forme, ou importer un SVG via File > Import
  1. **Positionner le design** sur la zone de travail à l'endroit correspondant à la position réelle du matériau sur le plateau
  1. **Choisir un calque** dans la fenêtre Cuts/Layers, et sélectionner le mode adapté (Line pour un contour, Fill pour du plein, Grayscale pour une image)
  1. **Régler vitesse et puissance** en s'appuyant sur le tableau de réglages ci-dessus, ou sur un réglage plus prudent pour un premier essai (ex : 10 000 mm/min, 30% de puissance)
  1. **Vérifier le cadrage** avec le bouton **Frame** : la tête laser trace le contour du projet sans tirer, ce qui permet de vérifier l'emplacement sur le matériau
  1. **Faire un test sur une chute** avant de lancer sur la pièce finale, en particulier pour une nouvelle combinaison matériau/module
  1. **Lancer le travail** avec le bouton **Start**, rester à proximité de la machine pendant toute la durée de la gravure/découpe
  1. **Ajuster si besoin** : si le résultat est trop clair, augmenter la puissance ou réduire la vitesse ; si le matériau brûle trop, inverser

<WRAP tip>
Pour un même motif, il vaut mieux commencer par une puissance basse et l'augmenter progressivement (essais successifs sur chutes) plutôt que l'inverse : un excès de puissance peut abîmer irrémédiablement la pièce ou provoquer des flammes.
</WRAP>

## Conseils et bonnes pratiques
  - Toujours tester sur un coin du matériau avant la découpe finale
  - Pour les images photos, utiliser le mode **Newsprint** ou **Stucki** pour un meilleur rendu sur bois
  - Augmenter le nombre de passes plutôt que la puissance pour la découpe, afin de réduire les brûlures
  - Activer la pompe à air (OAP1.0) pour les découpes : moins de flammes, traits plus nets
  - Sauvegarder les paramètres de chaque matériau dans une bibliothèque LightBurn (*Library*)

## Ressources
  - [Documentation officielle LightBurn](https://docs.lightburnsoftware.com)
  - [Forum LightBurn](https://forum.lightburnsoftware.com)
  - [Paramètres matériaux Ortur pour LightBurn](https://www.orturlaser.com/pages/ortur-lightburn-settings)
  - [Page machine – Laser Master 2 Pro S2](https://labovilleurbanne.fr/dokuwiki/equipement:decoupe_laser:laser_master_2_pro_s2)
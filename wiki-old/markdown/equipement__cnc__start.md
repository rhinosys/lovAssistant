## Commande numérique par ordinateur (CNC)
![image](https://labovilleurbanne.fr/blog/wp-content/uploads/2023/06/LOV_OUTI_Cnc2_Moyen.jpg)

### Modèles
  - [ID CNC PRO](https://labovilleurbanne.fr/dokuwiki/equipement:cnc:idcncpro)

### Accessoires
Dans le petit meuble blanc marqué CNC, vous trouverez:
1. les mèches
1. les vis de fixation

### Principe de fonctionnement
![image](equipement:cnc:process.jpg)

1 préparer le dessin pour qu'il soit lisible par cam bam en résumé simplifier au possible
cam bam peut lire du format DXF pour la 2D et du STL pour la 3D

2 préparation du dessin dans cam bam
cam bam c'est basique au niveau dessin on peut s'en contenter mais d'autres outils graphiques fonctionnent mieux. une fois le dessin importé il va falloir sélectionner des traits qui seront les guides des opérations d'usinage. Vous trouverez la doc de cam bam en francais ici : http://www.atelier-des-fougeres.fr/Cambam/Aide_V1/Contents.htm

3 on passe ici du dessin au fraisage. on définit différentes opérations a partir des éléments du dessin. c'est a ce stade qu'on définit des paramètres physique comme la profondeur de passe, l'avance, la vitesse de rotation de la broche ainsi que les points de départ  et d'arrivée théoriques de l'outil. 

4 les opérations d'usinage sont converties en Gcode qui définit des mouvements de la machine.
Après une mise a zéro des axe par rapport au bâti, on définit une nouvelle mise à zéro par rapport au point de départ de l'usinage de la pièce brute. 
ensuite mach 3 exécute le Gcode en envoyant des information de mouvement interprétés par l'électronique de la fraiseuse.
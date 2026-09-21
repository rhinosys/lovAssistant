## = Comment utiliser le polargraph du LOV ?
![image](https://labovilleurbanne.fr/dokuwiki/lib/exe/fetch.php?media=projets%3Apolargraph%3Avue-ensemble.jpg)
![image](https://labovilleurbanne.fr/dokuwiki/lib/exe/fetch.php?media=projets%3Apolargraph%3Agondole.jpg)\\
### Vous avez besoin de :
  *1 planche de 120 cm x 90 cm au minimum,
  *1 kit polargraph :
    *2 moteurs pas à pas montés sur une petite planche,
    *1 carte Arduino avec le firmware,
    *1 shield "motorshield DK electronics",
    *1 chargeur de téléphone portable (USB 5V/2A);
  *1 gondole fixée sur sa courroie,
  *2 contrepoids (couvercle de disque dur par exemple),
  *4 pinces,
  *2 aimants de disque dur pour guider les fils reliés à la gondole (pratique avec un tableau blanc),
  *du papier,
  *des feutres,
  *un PC sous Linux de préférence,
  *de la patience.
### 1- Assemblage du polargraph
  *Fixer les deux moteurs (gauche et droite) sur le haut de la planche à l'aide des pinces.
![image](https://labovilleurbanne.fr/dokuwiki/lib/exe/fetch.php?media=projets%3Apolargraph%3Amoteur-gauche.jpg)
![image](https://labovilleurbanne.fr/dokuwiki/lib/exe/fetch.php?media=projets%3Apolargraph%3Amoteur-droit.jpg)
  *Positionner la gondole au milieu de la planche en passant les courroies autour des poulies.
  *Accrocher les deux contrepoids pour tendre les courroies.
![image](https://labovilleurbanne.fr/dokuwiki/lib/exe/fetch.php?media=projets%3Apolargraph%3Acontrepoids-gauche.jpg)
![image](https://labovilleurbanne.fr/dokuwiki/lib/exe/fetch.php?media=projets%3Apolargraph%3Acontrepoids-droit.jpg)
### 2- Câblage du polargraph
Penser à bien respecter la couleur des fils.
    *du moteur gauche à la carte Arduino
![image](https://labovilleurbanne.fr/dokuwiki/lib/exe/fetch.php?media=projets%3Apolargraph%3Acablage-moteur-gauche-2.jpg)
![image](https://labovilleurbanne.fr/dokuwiki/lib/exe/fetch.php?media=projets%3Apolargraph%3Acablage-moteur-gauche-1.jpg)
    *du moteur droit à la carte Arduino
![image](https://labovilleurbanne.fr/dokuwiki/lib/exe/fetch.php?media=projets%3Apolargraph%3Acablage-moteur-droit-3.jpg)
![image](https://labovilleurbanne.fr/dokuwiki/lib/exe/fetch.php?media=projets%3Apolargraph%3Acablage-moteur-droit-2.jpg)
    *du servomoteur (doigt pour lever le crayon) à la carte Arduino.
Faire passer les fils au centre de la planche en utilisant les aimants comme guide.\\
![image](https://labovilleurbanne.fr/dokuwiki/lib/exe/fetch.php?media=projets%3Apolargraph%3Acablage-servo-1.jpg)
![image](https://labovilleurbanne.fr/dokuwiki/lib/exe/fetch.php?media=projets%3Apolargraph%3Aguidage-fils-servo.jpg)
### 3- Soft Polargraph sous Processing.
lien pour téléchargement => processing 2.2 et polargraph à partir des sources d'Euphy.
[outils du lov Ubuntu 18.04.1 LTS](https://labovilleurbanne.fr/nextcloud/index.php/s/2LwBHE8yHgSKpid)
### 4- Propriétés de la machine.
[propriétés de la machine selon Euphy](http://www.polargraph.co.uk/wp-content/uploads/2012/07/marking-diagram.jpg)

![image](https://labovilleurbanne.fr/dokuwiki/lib/exe/fetch.php?media=projets%3Apolargraph%3Amarking-diagram.jpg)

    *circonférence de la poulie = mm per rev => 109mm
    *nombre de pas du moteur = steps per rev => 200
    *incrément de la commande = steps multiplier => 2

    *largeur de la machine = machine width => 708 mm entre les bords des 2 poulies
    *hauteur de la machine = machine height => 1097 mm

    *largeur de la page => page width
    *hauteur de la page => page height
    *le bouton center page permet de centrer la page automatiquement, c'est pratique !!!

    *position en x du home = home pos x => position de reference en haut de la page
    *position en y du home = home pos y
    *le bouton center page permet de centrer le home en x !!!

    *levée (lift) du crayon = pen up => 13 angle du doigt
    *appui (drop) du crayon = pen down => 97 angle du doigt

    *vitesse de rotation max = motor max speed => 500 pas par seconde
    *acceleration max = motor acceleration => 250 pas par seconde

![?600](https://labovilleurbanne.fr/dokuwiki/lib/exe/fetch.php?media=projets%3Apolargraph%3Aparametre-polar.png)

##### principaux paramètres à prendre en compte pour dessiner un dessin vectoriel (svg)
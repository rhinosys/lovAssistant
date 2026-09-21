## Découpeuse laser K40
//Ce tutoriel est actuellement en cours de rédaction, de nombreuses sections sont encore manquantes, c'est normal, ne vous inquiétez pas.8-)

N'hésitez pas à y participer ou à commenter ce qui est déjà rédigé. 
Ou si des choses ne sont pas claires, n'hésitez pas à le mettre en avant pour les modifier.//

La découpeuse laser K40 est basée sur un tube CO<sub>2</sub> de 40W.
Elle est prévue pour graver/découper des matériaux rigides sur une surface d'environ 20x30cm (taille d'une feuille A4).

### Préparation de la découpe
La découpeuse laser ne doit pas être encore allumée ! 

** Préparation sous Inkscape **

Avant d'utiliser directement la K40, il vous faudra préparer votre découpe sous [Inkscape](https://inkscape.org/fr/).

![image](https://labovilleurbanne.fr/dokuwiki/lib/exe/fetch.php?media=youtube%3EaDp5x59pu24)

Une bonne playlist de vidéos pour apprendre Inkscape sur la chaîne du blog du TIM [la chaîne du prof du TIM](https://www.youtube.com/playlist?list=PLT22zthn8ytwA4vOHYDTjxwIrK63sGkMa).

**Couleurs**

La découpeuse laser ne considère que trois couleurs : 

  - Le rouge pour la découpe
  - Le bleu pour la gravure
  - Le noir (et autre nuance de gris) pour la gravure bitmap

![image](https://www.scorchworks.com/K40whisperer/k40_whisperer_test.svg)

De ce fait, sur votre fichier Inkscape, assurez-vous que celui-ci ne comporte bien que trois couleurs.

![image](https://labovilleurbanne.fr/dokuwiki/lib/exe/fetch.php?media=youtube%3E9wYvbenigtk)
Avec une petite vidéo, c'est plus simple à comprendre.

** Mise en route **

Une fois votre fichier Inkscape prêt, vous pouvez allumer la multiprise pour mettre en route le PC relié à la découpeuse laser. 
Une fois le PC démarré, ouvrez le navigateur de fichier en cliquant sur l'icône suivante : ***TODO :** Mettre l'icone*. Rendez-vous ensuite dans le dossier `/home/lov3/K40/` et créé votre dossier personnel. Ensuite, copier votre fichier Inkscape en SVG dans votre dossier personnel.
Vous pouvez maintenant fermer l'explorateur de fichier.

Après avoir vérifier les points présentés aux sections *(**TODO :** Mettre les liens vers les sections Précaution_generale, avant_usage et pendant_usage)* vous pouvez ensuite ouvrir le logiciel de gestion de la K40 en cliquant sur l'icone suivante *(** TODO :** Mettre l'icone)*.

** Le logiciel K40 Whisperer **

Une fois le logiciel [K40 Whisperer](https://www.scorchworks.com/K40whisperer/k40whisperer.html) ouvert, vous pouvez ouvrir votre fichier en cliquant sur 'File->**TODO**'

Normalement, votre image devrait apparaître dans la partie de droite du logiciel 

Vous pouvez maintenant allumer la découpeuse laser (mais pas le laser pour l'instant) en appuyant sur le bouton principal

Cliquez ensuite sur "Initialise Laser Cutter".

![image](https://labovilleurbanne.fr/dokuwiki/lib/exe/fetch.php?media=youtube%3EwdRsg4wllmo)
Le fabricant propose une [playlist complète](https://youtu.be/PEUJQFAEDcE?si=EY8fJBk-rvqnKSxY) de vidéos en ligne.

Il y a aussi un [manuel de référence](https://www.scorchworks.com/K40whisperer/k40w_manual.html) (en anglais).

Des conseils d'utilisation, améliorations : https://k40laser.se/

### Précautions générales =
La découpeuse K40 est un outil à la fois fragile et dangereux !
Des consignes de sécurités sont donc à respecter.

  - Ne Jamais ouvrir aucun capot quand le bouton *laser switch* est enfoncé !
  - Lors d'une découpe ou d'une gravure, rester près de la découpeuse et contrôler l'état de la découpe, notamment si des flammes apparaissent.

En cas de problème, comme un feu sur le matériaux en découpe : appuyer sur le bouton "laser switch" pour couper le laser

Emplacement du bouton laser switch
*(**TODO :** Mettre l'image du bouton)*

**Avant usage**

Avant l'usage de la découpeuse laser, il faut s'assurer des points suivants : 

  - Il y a assez d'eau dans le sceau sous la découpeuse pour assurer le refroidissement du laser *(**TODO :** Mettre l'image sceau_eau)*
  - Quand vous allumez la multiprise, appuyez ensuite sur le bouton principale de la découpeuse *(mais pas le laser, cf **TODO :** mettre l'image bouton_principal*), assurez-vous que la pompe fonctionne. Normalement, cela devrait s'entendre.
  - De plus assurez-vous que l'eau circule dans la pompe, pour cela, soulever le tuyau de sortie d'eau. Normalement de l'eau devrait couler *(** TODO :** mettre le gif circulation_eau.gif)*.
  - Assurez-vous que le laser est bien immergé. Pour cela, il faut que la bulle située au bout du laser, soit la plus petite possible *(** TODO : ** Mettre les images location_laser et bulle_laser)*. Si celle-ci est plus grande que sur l'image, soulevez délicatement le coin gauche de la découpeuse laser pour évacuer le surplus d'air du laser //(**TODO : ** Mettre l'image/gif evacuation_eau)//.
  - Les fumées générées sont aspirées et filtrées par l'unité de filtration SFM410. Le filtre doit être en marche et son voyant indiquant l'état de colmatage des filtres éteint. ![image](https://labovilleurbanne.fr/dokuwiki/lib/exe/fetch.php?media=equipement%3Adecoupe_laser%3Aunite_de_filtration_sfm410_notice.pdf)

Ces points peuvent se récapituler comme suit : 

  - Contrôle de l'eau dans le sceau
  - Contrôle de la pompe
    - Contrôle audio
    - Contrôle de la sortie d'eau
  - Contrôle de la bulle dans le laser
  - Filtre en fonctionnement et voyant de colmatage éteint.

**Pendant usage**

Lorsque vous utiliser la découpeuse laser, les consignes suivantes sont toujours à respecter : 

  - Ne jamais ouvrir aucun capot quand le bouton *laser switch* est enfoncé *(**TODO :** Mettre l'image laser_switch)*.
  - Lors d'une découpe ou d'une gravure, rester prsè de la découpeuse et contrôler l'état de la découpe, notamment si des flammes apparaissent.
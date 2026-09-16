## Anet A8
### Utilisation
Pour utiliser l'anet A8, il faut avoir un dessin 3D (typiquement stl) de ce qu'on veut imprimer.
Il faudra bien sûr prendre en compte la technologie de l'impression dans la conception du modèle.

On va ensuite passer le dessin au logiciel Cura (installé sur l'ordinateur attenant).

![image](equipement:impression_3d:cura.png)

Les paramètres enregistrés sont adaptés à la machine (on vérifiera tout de même que c'est bien la machine "Anet A8" qui est sélectionnée). Il faut aussi sélectionner le matériau utilisé (de base PLA, facile de mise en oeuvre).

Cura nous montre alors le plateau de la machine, on peut y placer le(s) objet(s) à imprimer. On peut au besoin modifier les paramètres d'impression à droite : plusieurs profils, correspondants à différentes épaisseurs de couches sont enregistrés, soit différentes finesses de rendu. Si une boite de dialoge
Pour une utilisation avancée, on peut modifier le détails des paramètres, mais on n'enregistrera JAMAIS sur les anciens (on peut exporter ses paramètres personnalisés pour les conserver au besoin).

On clique ensuite sur "Préparer" en bas à droite, Cura va alors préparer le G-code pour la machine (= suite d'instructions précises et détaillées que suivra l'imprimante 3D). On peut vérifier le travail que fera l'imprimante ("solid view" => "layer view" par exemple) et sauvegarder le fichier (oin placera celui-ci dans un dossier à son nom, dans le dossier "Documents").

On va ensuite dans le navigateur internet, on ouvre la page http://octopi/ (il y a normalement un marque page). Dans "Connection" en haut à gauche, on sélectionne "aneta8" et on connecte.
Si tout s'est bien passé, on peut ensuite charger le g-code en bas à gauche (on fera bien attention à placer celui-ci dans un dossier à son nom).

On peut ensuite sélectionner le fichier g-code et l'ouvrir. OctoPrint le charge alors en mémoire et permet de vérifier de nouveau le travail faire (onglet "GCode viewer"). On n'a normalement plus qu'à appuyer sur "Print".
On surveillera attentivement les premières étapes (prises de positions du lit notamment, premières couches) qui sont les plus sujettes à problèmes. On surveille ensuite bien entendu l'impression régulièrement.

### Maintenance
La machine est équipée du firmware Marlin (marlinfw.org).
Quelques paramètres ne sont pas par défaut. On se référera pour la msie à jour à la page [firmware](https://labovilleurbanne.fr/dokuwiki/.aneta8:fimware_aneta8).

Pour le réglage de l'offset de la sonde (Z-obe offset), on se référera à [Réglage z-probe offset](https://labovilleurbanne.fr/dokuwiki/equipement:impression_3d:aneta8:z_probe_offset).
## Wanhao Duplicator 4
*Imprimante 3D en stock mais pas en fonctionnement au LOV. Plutôt adaptée pour de l'expérimentation sur la machine elle-même.*

### Paramétrage de Cura
  - Largeur du plateau: 220mm
  - Profondeur du plateau: 160mm
  - Hauteur : 145mm
  - Lit chauffant: oui
  - Nombre d'extrudeurs: 2
  - Type de Gcode: RepRap
  - Diamètre extrudeur: 0.4 mm
  - Diamètre filament: 1.75mm

Super important !!! Gcode initial:

```
G28 ;Home ; attention, à ce stade, l'imprimante semble ne pas savoir o\`u elle est !!!
G92 F3000 X220 Y140 Z0  ; on lui dit à quel endroit elle se trouve
;Prime the extruder
G92 E0
G1 F200 E3
G92 E0
```

### Impression
Important: cette imprimante ne parle pas le Gcode, elle accepte un format beaucoup plus primitif le GPX (instructions avec les pas des moteurs). Heureusement il existe un plugin nommé "GPX" pour Octoprint qui fait la conversion de Gcode vers GPX à la volée. Il faut donc absolument passer par Octoprint pour utiliser cette imprimante.

  - se connecter sur http://octopiw
  - charger son fichier et lancer l'impression
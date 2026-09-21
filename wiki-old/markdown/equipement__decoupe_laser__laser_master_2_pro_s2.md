# Laser Master 2 Pro S2
*Cette page est en cours de rédaction. N'hésitez pas à y contribuer ou à corriger ce qui est déjà rédigé.*

![Ortur Laser Master 2 Pro S2](https://labovilleurbanne.fr/dokuwiki/lib/exe/fetch.php?media=equipement%3Adecoupe_laser%3Alm2_pro_s2_main.jpg)

Le Laser Master 2 Pro S2 (Ortur) est une graveuse/découpeuse laser diode à cadre ouvert. Elle est prévue pour graver et découper des matériaux variés sur une surface de 400x400mm.

## Caractéristiques techniques
^ Caractéristique          ^ Valeur                          ^
| Carte mère               | OLM-PRO-V10 – 32 bits MCU       |
| Firmware                 | OLF-V1.5                        |
| Moteurs                  | NEMA 17 Stepper Motors          |
| Précision mécanique      | X : 12,5 µm / Y : 12,5 µm      |
| Zone de travail          | 400 x 400 mm                    |
| Vitesse max              | 15 000 mm/min                   |
| Longueur d'onde          | 445 ± 5 nm (laser bleu)         |
| Distance focale par défaut | 50 mm (depuis le dissipateur)  |
| Mode de contrôle         | PWM (S0–S1000)                  |
| Baud rate                | 115200 (défaut) – 921600        |
| Alimentation             | 110V–220V / Sortie : 24V/2A    |
| Température de fonctionnement | -20°C à 50°C              |
| OS compatibles           | Windows XP/7/8/10, macOS, Linux |
| Logiciels                | [LightBurn](https://labovilleurbanne.fr/dokuwiki/equipement:decoupe_laser:lightburn) (payant), LaserGRBL (gratuit) |
| Formats de fichier       | JPG, PNG, BMP, SVG, DXF, etc.  |

![Dimensions et fonctions de sécurité](https://labovilleurbanne.fr/dokuwiki/lib/exe/fetch.php?media=equipement%3Adecoupe_laser%3Alm2_pro_s2_size.jpg)

## Fonctionnalités de sécurité
**⚠ Dispositifs de sécurité actifs :**
  - Protection de position active (détection d'inclinaison)
  - Limitation de la durée d'exposition laser
  - Garde de sécurité du faisceau laser
  - Détecteur de flammes
  - Bouton d'arrêt d'urgence

**⚠ Consignes obligatoires avant toute utilisation :**
  - Porter des lunettes de protection adaptées aux lasers de classe 4 (longueur d'onde 445 nm)
  - Assurer une ventilation suffisante ou utiliser une pompe à air + extraction des fumées
  - Ne jamais laisser la machine fonctionner sans surveillance
  - Ne jamais regarder directement le faisceau laser, même réfléchi
  - Matériaux **interdits** : PVC, polycarbonate, matériaux contenant du chlore (dégagent des gaz toxiques)
## Matériaux compatibles
### Gravure
Bois, carton, acrylique noir, cuir, aliments, acier inoxydable (traité), métal laqué.

### Découpe
Bois (fines épaisseurs), carton, acrylique noir, cuir, feutrine, plastique de couleur foncée (par fusion).

## Mise en marche
**⚠ Avant de lancer la machine, l'extraction des fumées doit être active. Suivre l'ordre ci-dessous.**

  1. **Allumer la barre d'alimentation** du poste (multiprise sous le bureau).\\ ![Barre d'alimentation](https://labovilleurbanne.fr/dokuwiki/lib/exe/fetch.php?media=equipement%3Adecoupe_laser%3Amultiprise.jpg)
  1. **Ouvrir la vanne de ventilation** sur le tuyau d'extraction : tourner le clapet vert pour l'aligner dans le sens du tuyau (position ouverte). Perpendiculaire au tuyau = fermée.\\ ![Vanne ouverte](https://labovilleurbanne.fr/dokuwiki/lib/exe/fetch.php?media=equipement%3Adecoupe_laser%3Avanne_ouverte.jpg)
  1. **Démarrer le ventilateur d'extraction** en tournant la molette noire sur le côté du caisson.\\ ![Molette de démarrage du ventilateur](https://labovilleurbanne.fr/dokuwiki/lib/exe/fetch.php?media=equipement%3Adecoupe_laser%3Amolette.jpg)
  1. Allumer la machine via son interrupteur
  1. Connecter le câble USB à l'ordinateur si ce n'est pas déjà fait
  1. Ouvrir LightBurn et vérifier la connexion (port COM dans la fenêtre Laser)
  1. Effectuer une mise au point : positionner l'objet à graver, régler la hauteur du module laser à 50 mm de la surface

## Arrêt
  1. Couper le ventilateur d'extraction (molette)
  1. Fermer la vanne de ventilation
  1. Éteindre la machine
  1. **Couper la barre d'alimentation** avant de quitter le poste — même si un voyant reste allumé, il ne s'agit que d'un témoin partageant la même multiprise que le reste du matériel

## Accessoires
### Kit d'extension d'origine (pour LM2 Pro S2 & LM2 S2)
Le kit d'extension permet d'augmenter la zone de travail de la machine au-delà des 400x400mm d'origine.

**Contenu du kit :**
  - Profilés aluminium supplémentaires pour l'axe Y
  - Vis et pièces de fixation

**Installation :**
  1. Éteindre et débrancher la machine
  1. Démonter les profilés Y d'origine en desserrant les vis d'extrémité
  1. Insérer les rallonges fournies et revisser
  1. Mettre à jour la zone de travail dans LightBurn : *Edit > Device Settings* → modifier la hauteur Y

### Pompe à air Ortur (OAP1.0)
Compatible avec les modules : LU3-40A, LU3-20A, LU2-10A, LU2-4 LF.

La pompe à air souffle de l'air comprimé sur la zone de découpe, ce qui permet de :
  - Réduire les flammes et les brûlures sur le bois
  - Évacuer les fumées du point de coupe
  - Améliorer la qualité de découpe et réduire les traces noires

![Pompe OAP1.0 connectée au LM2 Pro S2](https://labovilleurbanne.fr/dokuwiki/lib/exe/fetch.php?media=equipement%3Adecoupe_laser%3Aoap1_air_pump_machines.jpg)

![Comparaison avec et sans air assist](https://labovilleurbanne.fr/dokuwiki/lib/exe/fetch.php?media=equipement%3Adecoupe_laser%3Aoap1_air_assist_compare.jpg)

**Branchement :**
  1. Connecter le câble de la pompe sur le port dédié de la carte mère (marqué **AIR**)
  1. La pompe se déclenche automatiquement au lancement d'une gravure/découpe
  1. Positionner le tube soufflant à proximité du module laser, orienté vers la zone de travail

**Paramétrage dans LightBurn :**
Dans *Edit > Device Settings*, activer **"Air Assist"** si disponible, ou utiliser la commande M8 (air on) / M9 (air off) en début/fin de programme G-code.

## Maintenance
  - **Lentille du module laser** : nettoyer avec un coton-tige imbibé d'alcool isopropylique si des traces apparaissent sur les gravures
  - **Rails et chariots** : lubrifier légèrement avec de la graisse silicone toutes les 20h d'utilisation
  - **Vis** : vérifier le serrage régulièrement, les vibrations peuvent les desserrer
  - **Firmware** : maintenir le firmware à jour via le logiciel Ortur ou LightBurn

## Ressources
  - [Page de support officielle Ortur](https://www.orturlaser.com/pages/ortur-laser-master-2-pro-s2-support)
  - [Paramètres LightBurn recommandés par Ortur](https://www.orturlaser.com/pages/ortur-lightburn-settings)
  - [Page LightBurn – Configuration et utilisation](https://labovilleurbanne.fr/dokuwiki/equipement:decoupe_laser:lightburn)
  - [Documentation LightBurn](https://docs.lightburnsoftware.com)
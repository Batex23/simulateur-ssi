# Simulateur SSI

Simulateur pédagogique de système de sécurité incendie, pour la formation des préventionnistes, des agents SSIAP et des sapeurs-pompiers.

- **À gauche**, la façade du SSI : ECS, CMSI (UGA, UCMC, US), ventilateurs, clé de niveau d'accès — ou, en catégorie C, UGA 2 + DCS.
- **À droite**, le bâtiment virtuel : feu, fumée, portes coupe-feu, volets, ouvrants, exutoires, clapets, CTA, occupants.
- **En bas**, le fil « Comprendre » qui explique chaque réaction, le journal, le tableau de correspondance en direct et le suivi des occupants.

## Bâtiments

| Bâtiment | SSI | Ce qu'on y apprend |
|---|---|---|
| Collège Jean Moulin (type R, R+1) | Catégorie C, EA 2a | Alarme sur DM, DAD autonomes, désenfumage naturel **manuel** |
| Hôtel des Quais (type O, R+2) | Catégorie A, EA 1 | ECS / CMSI, temporisation, levée de doute, désenfumage naturel automatique |
| Tour Garonne (type W, R+3) | Catégorie A, EA 1 | Désenfumage **mécanique**, arrêt pompiers, CTA et clapets, UGCIS |

Six missions guidées avec objectifs et bilan, un mode libre et un **mode formateur** (pannes de DAS, porte calée, DI encrassé ou masqué, coupure secteur / AES, UGA en veille restreinte, zones hors service).

## Lancer

Aucune installation : ouvrir `index.html` dans un navigateur, ou publier le dépôt avec GitHub Pages (Settings → Pages → branche `main`, dossier `/`).

## Structure

- `js/buildings.js` — les bâtiments (plans, équipements, zones, tableau de correspondance). Ajouter un bâtiment = ajouter un bloc ici.
- `js/engine.js` — moteur : feu, fumée, désenfumage, logique ECS / CMSI / UGA / DAS.
- `js/panel.js` — façade SSI. `js/plan.js` — plans SVG. `js/app.js` — interface, menus, missions, formateur.
- `js/missions.js` — missions guidées. `js/fiches.js` — fiches pédagogiques des équipements.

## Avertissement

Outil pédagogique : bâtiments et comportements simplifiés, niveaux d'accès indicatifs. Il ne remplace ni les textes ni une étude réglementaire. Rédigé d'après le *Guide des systèmes de sécurité incendie* (éd. 2025), le règlement de sécurité ERP, l'IT 246 et les normes NF S 61-930 à 61-970. Contenus à faire valider par un préventionniste.

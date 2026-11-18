/* =====================================================================
   FICHES PÉDAGOGIQUES
   Textes rédigés pour la formation, d'après le Guide des SSI (éd. 2025)
   et les normes de la série NF S 61-93x. À faire valider par un
   préventionniste avant diffusion.
   ===================================================================== */
window.SSI_FICHES = {
  ECS: {
    t: 'ECS — Équipement de contrôle et de signalisation',
    role: 'Le cerveau de la détection : il reçoit les détecteurs et les déclencheurs, localise l\'alarme et la transmet au CMSI.',
    pts: [
      'Il signale l\'alarme feu par zone de détection (ZD) avec un voyant rouge et un buzzer : c\'est l\'alarme restreinte, destinée au personnel.',
      'Il distingue les zones de détection automatique (ZDA) des zones de déclencheurs manuels (ZDM).',
      'Arrêter le buzzer (niveau 1) ne supprime pas l\'alarme. Le réarmement (niveau 2) n\'est possible que si la cause a disparu.',
      'Dérangement, hors service, défaut d\'alimentation : voyants jaunes, à traiter sans attendre.'
    ],
    ref: 'NF EN 54-2, NF S 61-970'
  },
  CMSI: {
    t: 'CMSI — Centralisateur de mise en sécurité incendie',
    role: 'Il exécute les mises en sécurité : compartimentage, désenfumage, évacuation, selon le tableau de correspondance.',
    pts: [
      'UGA : gère l\'alarme générale (temporisation, diffusion, arrêt).',
      'UCMC : commandes manuelles centralisées de chaque zone de mise en sécurité.',
      'US : signalisations par zone — position de sécurité, défaut, hors service (voyants jaunes).',
      'Il contrôle la position des DAS quand c\'est exigé : un DAS qui n\'atteint pas sa position de sécurité provoque un défaut.',
      'Catégorie A = SDI + CMSI de type A. Catégorie B = déclencheurs manuels + CMSI de type B.'
    ],
    ref: 'NF S 61-934, NF S 61-935, NF S 61-932'
  },
  UGA: {
    t: 'UGA — Unité de gestion d\'alarme',
    role: 'Elle lance le processus d\'alarme puis l\'alarme générale d\'évacuation.',
    pts: [
      'Sur détection, le processus démarre par l\'alarme restreinte et une temporisation (5 minutes au maximum), le temps de faire la levée de doute.',
      'À la fin de la temporisation, l\'alarme générale part automatiquement.',
      'L\'opérateur peut lancer l\'évacuation tout de suite (commande manuelle) ou arrêter le processus si la levée de doute est négative.',
      'En veille restreinte, l\'alarme générale ne part pas automatiquement : interdit en présence du public.',
      'Avec un EA 1, les issues de secours verrouillées se déverrouillent dès la détection, sans temporisation.'
    ],
    ref: 'NF S 61-936, MS 60, MS 61, MS 62'
  },
  UGA2: {
    t: 'UGA 2 — Équipement d\'alarme de type 2a',
    role: 'Centralise les déclencheurs manuels et diffuse l\'alarme générale.',
    pts: [
      'Pas de détection automatique générale : l\'alarme dépend d\'une personne qui actionne un déclencheur manuel.',
      'L\'alarme générale est en principe immédiate.',
      'L\'UGA 2 ne localise pas le déclencheur actionné : il faut le chercher (vitre brisée).',
      'Un contact de l\'UGA peut commander par rupture de courant les portes à fermeture automatique.'
    ],
    ref: 'NF S 61-936, EL 11'
  },
  DCS: {
    t: 'DCS — Dispositif centralisé de sécurité',
    role: 'Dans un SSI de catégorie C, il regroupe les commandes des DAS et leurs signalisations.',
    pts: [
      'Il commande les portes à fermeture automatique (compartimentage).',
      'Ces portes peuvent aussi être commandées par des détecteurs autonomes déclencheurs (DAD) placés à proximité.',
      'Le désenfumage se commande par des dispositifs de commande manuelle (DCM) placés dans le bâtiment.'
    ],
    ref: 'NF S 61-931, NF S 61-938'
  },
  FAN: {
    t: 'Ventilateurs de désenfumage',
    role: 'Extraction de la fumée et soufflage d\'air neuf dans les conduits collectifs.',
    pts: [
      'Commandés par un coffret de relayage, ils démarrent 30 secondes au maximum après l\'ordre, le temps que les volets s\'ouvrent.',
      '« Arrêt pompiers » : commande de niveau 2, à côté du CMSI, distincte des commandes de mise en sécurité et du réarmement.',
      'Sans amenée d\'air (soufflage), l\'extraction met le volume en dépression : débit réduit et portes difficiles à ouvrir.'
    ],
    ref: 'IT 246, NF S 61-932 § 9.3.2.2'
  },
  DI: {
    t: 'DI — Détecteur automatique d\'incendie',
    role: 'Il détecte la fumée (ici un détecteur optique) et transmet l\'alarme à l\'ECS.',
    pts: [
      'Son voyant (indicateur d\'action) s\'allume en alarme. Un indicateur déporté signale souvent un DI caché (faux plafond, local fermé).',
      'Il reste en alarme tant que l\'ECS n\'est pas réarmé, et repasse en alarme s\'il voit encore de la fumée.',
      'Essai : générateur d\'aérosol. Encrassé, il peut provoquer de fausses alarmes ; masqué, il ne voit plus rien.'
    ],
    ref: 'NF EN 54-7, NF S 61-970'
  },
  SDAD: {
    t: 'DAD autonome déclencheur',
    role: 'Détecteur qui commande directement des DAS, sans passer par un ECS.',
    pts: [
      'Placé de part et d\'autre d\'une porte asservie, il la fait fermer dès qu\'il voit de la fumée.',
      'Il ne déclenche pas l\'alarme générale.'
    ],
    ref: 'NF S 61-961'
  },
  DM: {
    t: 'DM — Déclencheur manuel d\'alarme',
    role: 'Boîtier rouge à vitre ou membrane : toute personne qui voit un feu l\'actionne.',
    pts: [
      'Placé près des escaliers et des sorties, à hauteur d\'homme.',
      'Une fois actionné, il reste en alarme : il faut le réarmer avec sa clé avant de réarmer l\'ECS ou l\'UGA.'
    ],
    ref: 'NF EN 54-11'
  },
  DMV: {
    t: 'Déclencheur manuel vert',
    role: 'Placé près d\'une issue de secours verrouillée, il la déverrouille immédiatement.',
    pts: ['Il coupe l\'alimentation du verrou électromagnétique.', 'Il ne déclenche pas l\'alarme feu.'],
    ref: 'CO 46, NF S 61-937-13'
  },
  DS: {
    t: 'Diffuseurs d\'évacuation',
    role: 'Diffuseurs sonores et lumineux de l\'alarme générale.',
    pts: ['Son normalisé NF S 32-001, complété par un signal lumineux pour les personnes malentendantes.', 'Autonomie minimale de 5 minutes.'],
    ref: 'NF EN 54-3, NF EN 54-23'
  },
  VD: {
    t: 'Volet de désenfumage (évacuation)',
    role: 'Bouche en partie haute de la circulation, raccordée à un conduit d\'évacuation des fumées.',
    pts: [
      'Naturel : la fumée chaude monte par tirage. Mécanique : un extracteur aspire.',
      'Télécommande à émission de courant ; contrôle de position obligatoire.',
      'Réarmement à distance par le CMSI (volets motorisés).'
    ],
    ref: 'NF S 61-937-5, IT 246'
  },
  VA: {
    t: 'Volet d\'amenée d\'air',
    role: 'Bouche en partie basse qui laisse entrer l\'air neuf.',
    pts: [
      'Indispensable : sans amenée d\'air, l\'évacuation des fumées ne fonctionne pas.',
      'Naturel ou par soufflage mécanique.',
      'L\'air entre en bas, la fumée sort en haut : on maintient une couche d\'air libre pour évacuer.'
    ],
    ref: 'IT 246'
  },
  OUV: {
    t: 'Ouvrant de désenfumage en façade',
    role: 'Fenêtre motorisée ou à treuil : en partie haute pour évacuer, en partie basse pour l\'amenée d\'air.',
    pts: ['Commandé par un DCM ou par le CMSI.', 'Les ouvrants d\'amenée d\'air sont placés le plus bas possible.'],
    ref: 'NF S 61-937-8'
  },
  EXU: {
    t: 'Exutoire de désenfumage',
    role: 'Trappe en partie haute (sommet d\'escalier, toiture) qui évacue fumée et chaleur.',
    pts: ['L\'escalier se désenfume par l\'exutoire en haut et une amenée d\'air en bas.', 'Commande manuelle au niveau d\'accès des secours.'],
    ref: 'NF EN 12101-2, IT 246'
  },
  CLAPET: {
    t: 'Clapet coupe-feu',
    role: 'Obturateur placé dans un conduit de ventilation à la traversée d\'une paroi coupe-feu.',
    pts: [
      'Il empêche le feu et la fumée de passer d\'un étage à l\'autre par les gaines.',
      'Fermé, il isole l\'étage du réseau de ventilation de confort.',
      'Souvent à réarmement manuel, sur place.'
    ],
    ref: 'NF S 61-937-4'
  },
  DCM: {
    t: 'DCM — Dispositif de commande manuelle',
    role: 'Boîtier jaune qui commande sur place la mise en sécurité d\'une zone (désenfumage le plus souvent).',
    pts: [
      'Organe de sécurité placé entre 0,90 m et 1,30 m du sol, près de l\'accès du volume concerné.',
      'Il reste actionné tant qu\'on ne le réarme pas sur place.'
    ],
    ref: 'NF S 61-938'
  },
  door: {
    t: 'Porte coupe-feu à fermeture automatique',
    role: 'Maintenue ouverte par une ventouse, elle se ferme quand l\'alimentation de la ventouse est coupée.',
    pts: [
      'Commande à rupture de courant : sécurité positive. Sans énergie, la porte se ferme d\'elle-même.',
      'Pas toujours de contrôle de position : une porte calée peut ne PAS être signalée au CMSI.',
      'Réarmement sur place : on rouvre la porte et on la plaque sur sa ventouse.'
    ],
    ref: 'NF S 61-937-2, CO 47'
  },
  exit: {
    t: 'Issue de secours',
    role: 'Porte donnant vers l\'extérieur.',
    pts: [
      'Verrouillée, elle doit se déverrouiller au déclenchement de l\'alarme générale, ou dès la détection avec un EA 1.',
      'Un déclencheur manuel vert à côté permet de la déverrouiller localement.'
    ],
    ref: 'CO 46, MS 60, NF S 61-934 (UGCIS)'
  },
  CTA: {
    t: 'CTA — Centrale de traitement d\'air (confort)',
    role: 'Ventilation des bureaux en temps normal.',
    pts: [
      'En cas de feu, elle brasse la fumée et la répand dans tous les étages raccordés.',
      'Le CMSI l\'arrête et les clapets coupe-feu isolent les étages.'
    ],
    ref: 'DF 3 § 5, CH 41'
  },
  ZONES: {
    t: 'Les zones du SSI',
    role: 'Le bâtiment est découpé en volumes qui servent à détecter et à mettre en sécurité.',
    pts: [
      'ZD — zone de détection : un ensemble de détecteurs (ZDA) ou de déclencheurs (ZDM) avec une signalisation commune.',
      'ZC — zone de compartimentage : là où l\'on ferme portes et clapets.',
      'ZF — zone de désenfumage : toujours comprise dans une ZC.',
      'ZA — zone de diffusion d\'alarme : en général tout le bâtiment.',
      'Emboîtement : une ZA contient une ou plusieurs zones de mise en sécurité, qui contiennent une ou plusieurs ZD.'
    ],
    ref: 'MS 55, NF S 61-931 § 5.5'
  },
  CORR: {
    t: 'Le tableau de correspondance',
    role: 'Il dit, pour chaque zone de détection, quelles zones le CMSI met en sécurité.',
    pts: [
      'Il est établi par le coordinateur SSI et validé par la commission de sécurité.',
      'Le désenfumage automatique ne vise que la zone sinistrée : la première ZF sollicitée est prioritaire.',
      'Les déclencheurs manuels ne commandent jamais le désenfumage.'
    ],
    ref: 'NF S 61-932, IT 246'
  },
  NIVEAUX: {
    t: 'Niveaux d\'accès',
    role: 'Chaque commande est protégée selon la responsabilité de la personne.',
    pts: [
      'Niveau 0 : le public (déclencheur manuel).',
      'Niveau 1 : personnel de surveillance (arrêt du buzzer, lecture).',
      'Niveau 2 : personnel habilité, avec clé ou code (réarmement, mise hors service, arrêt pompiers).',
      'Niveau 3 : maintenance. Ici, les niveaux sont indicatifs pour la formation.'
    ],
    ref: 'NF S 61-931, NF EN 54-2 annexe A'
  }
};

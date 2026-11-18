/* =====================================================================
   MISSIONS GUIDÉES
   Chaque mission prépare la situation, liste des objectifs vérifiés en
   direct et se termine par un bilan.
   ===================================================================== */
(function () {
  'use strict';
  const F = (s, f) => f in s.flags;
  const allPA = (s, zs) => s.zs[zs].das.every(id => s.das[id].state === 'PA');

  const M = {};

  /* ----------------------------- COLLÈGE ----------------------------- */
  M.college_feu_classe = {
    building: 'college',
    title: 'Feu dans le labo de SVT',
    level: 'Débutant',
    brief: [
      'Mardi, 10 h 20. Un feu de poubelle se déclare dans une salle du R+1. L\'enseignant fait sortir ses élèves en laissant la porte ouverte.',
      'Ici, pas de détection automatique : c\'est à toi de donner l\'alarme, d\'alerter les secours et de désenfumer à la main.'
    ],
    setup(s) {
      s.ignite('L1_S2', { t: 60 });
      s.openings['L1_dS2'].open = true;
    },
    objectives: [
      { text: 'Donner l\'alarme : actionner un déclencheur manuel', done: s => F(s, 'dmPressed') },
      { text: 'Appeler les sapeurs-pompiers', done: s => F(s, 'called18') },
      { text: 'Désenfumer la circulation du R+1 (DCM jaune au bout du couloir)', done: s => F(s, 'dcm:L1_DCM') },
      { text: 'Désenfumer l\'escalier (DCM au RDC)', done: s => F(s, 'dcm:L0_DCME') },
      { text: 'Évacuation complète, personne en danger', done: s => { const t = s.stats(); return t.inside === 0; } },
      { text: 'Après l\'extinction : réarmer les DCM et l\'UGA', done: s => F(s, 'fireOut') && F(s, 'ugaReset') }
    ],
    end: s => (F(s, 'fireOut') && F(s, 'ugaReset')) || s.t > 2400,
    lessons: [
      'En catégorie C, tout repose sur l\'humain : sans déclencheur manuel, pas d\'alarme.',
      'Le désenfumage naturel est un couple : ouvrants hauts pour évacuer, ouvrants bas pour l\'air neuf.',
      'Une porte laissée ouverte sur le local en feu remplit la circulation de fumée en quelques minutes.'
    ]
  };

  /* ------------------------------ HÔTEL ------------------------------ */
  M.hotel_feu_chambre = {
    building: 'hotel',
    title: 'Feu de chambre, 3 h du matin',
    level: 'Intermédiaire',
    brief: [
      'Tu es agent de sécurité de nuit au poste de sécurité. L\'hôtel est presque complet.',
      'Un client s\'endort en fumant dans la chambre 104. Gère l\'alarme du début à la fin : levée de doute, alerte, évacuation, accueil des secours, remise en état.'
    ],
    setup(s) {
      s.ignite('H1_N3', { t: 30 });
      s.mission._fled = false;
    },
    tick(s) {
      const m = s.mission;
      if (!m._fled && s.rooms['H1_N3'].s > 0.45) {
        m._fled = true;
        s.openings['H1_dN3'].open = true;
        s.journal('Le client de la chambre 104 s\'enfuit et laisse la porte ouverte', 'warn');
        s.explain('🏃 Le client de la chambre 104 s\'enfuit en laissant sa porte ouverte : la fumée envahit la circulation. Le détecteur du couloir va la voir, et le CMSI désenfumera cette zone.', 'warn');
      }
    },
    objectives: [
      { text: 'Arrêter le buzzer et lire la zone sur l\'ECS', done: s => F(s, 'ecsAck') },
      { text: 'Envoyer un agent faire la levée de doute (clique sur la chambre en alarme)', done: s => F(s, 'agentSent') },
      { text: 'Appeler les sapeurs-pompiers', done: s => F(s, 'called18') },
      { text: 'L\'alarme générale est diffusée', done: s => F(s, 'ag') },
      { text: 'La circulation du R+1 est désenfumée (ZF1)', done: s => F(s, 'zsCmd:ZF1') },
      { text: 'Tous les clients sont sortis', done: s => s.stats().inside === 0 },
      { text: 'Remise en état : réarmer l\'ECS, la ZC1, la ZF1 puis l\'UGA', done: s => F(s, 'ecsReset') && F(s, 'zsReset:ZC1') && F(s, 'zsReset:ZF1') && F(s, 'ugaReset') }
    ],
    end: s => (F(s, 'fireOut') && F(s, 'ugaReset') && F(s, 'zsReset:ZC1')) || s.t > 3000,
    lessons: [
      'Arrêter le buzzer ne traite pas l\'alarme : la temporisation sert à lever le doute, pas à attendre.',
      'Feu confirmé ? On n\'attend pas la fin de la temporisation : évacuation générale tout de suite.',
      'Le réarmement suit un ordre : cause supprimée → ECS → zones de mise en sécurité → DAS sur place → UGA.'
    ]
  };

  M.hotel_fausse_alarme = {
    building: 'hotel',
    title: 'Fausse alarme au R+2',
    level: 'Intermédiaire',
    brief: [
      '22 h. Un détecteur encrassé d\'une chambre du R+2 passe en alarme. Il n\'y a pas de feu.',
      'Évite une évacuation inutile, sans prendre de risque : la levée de doute doit être faite avant toute décision.'
    ],
    setup(s) { s.setFault('di', 'H2_DI_N5', 'encrasse'); },
    objectives: [
      { text: 'Arrêter le buzzer et identifier la zone', done: s => F(s, 'ecsAck') },
      { text: 'Faire la levée de doute sur place', done: s => F(s, 'agentReport') },
      { text: 'Levée de doute négative : arrêter le processus avant la fin de la temporisation', done: s => F(s, 'processStopped') && !F(s, 'ag'), fail: s => F(s, 'agAuto') },
      { text: 'Le DI repart en alarme au réarmement : mettre sa zone hors service (niveau 2)', done: s => F(s, 'zdHs:ZD2L') },
      { text: 'Réarmer l\'ECS, la ZC1 et l\'UGA', done: s => F(s, 'ecsReset') && F(s, 'zsReset:ZC1') && F(s, 'ugaReset') },
      { text: 'Remettre les portes coupe-feu sur leurs ventouses (sur place)', done: s => F(s, 'zsReset:ZC1') && allPA(s, 'ZC1') }
    ],
    end: s => (F(s, 'ugaReset') && F(s, 'zsReset:ZC1') && allPA(s, 'ZC1') && F(s, 'zdHs:ZD2L')) || s.t > 1500,
    lessons: [
      'On n\'arrête un processus d\'alarme qu\'après une levée de doute négative.',
      'Une zone hors service n\'est plus protégée : surveillance renforcée et appel du mainteneur immédiat.',
      'Les portes à ventouse se réarment à la main : il faut faire le tour du bâtiment.'
    ]
  };

  M.hotel_porte_calee = {
    building: 'hotel',
    title: 'La porte calée',
    level: 'Avancé',
    brief: [
      'Une femme de chambre a calé la porte de recoupement du R+1 avec un chariot pour gagner du temps.',
      'Un feu démarre dans la chambre 102 du R+1, porte ouverte. Observe ce que le CMSI te dit, et surtout ce qu\'il ne te dit pas.'
    ],
    setup(s) {
      s.wedgeDoor('H1_dRec', true);
      s.ignite('H1_N1', { t: 40 });
      s.openings['H1_dN1'].open = true;
    },
    objectives: [
      { text: 'Prendre en compte l\'alarme et appeler les secours', done: s => F(s, 'ecsAck') && F(s, 'called18') },
      { text: 'Lancer l\'évacuation générale', done: s => F(s, 'ag') },
      { text: 'Trouver la porte qui ne s\'est pas fermée et retirer la cale', done: s => F(s, 'unwedge') },
      { text: 'La circulation est du R+1 reste praticable', done: s => F(s, 'unwedge') && s.rooms['H1_C2'].s < 0.4 }
    ],
    end: s => (F(s, 'unwedge') && F(s, 'ag') && s.t - s.flags['unwedge'] > 120) || s.t > 1800,
    lessons: [
      'Les portes à fermeture automatique simples n\'ont pas de contrôle de position : le CMSI ne voit pas une porte calée.',
      'Un compartimentage rompu laisse la fumée envahir toute la circulation.',
      'Les rondes et la sensibilisation du personnel sont aussi importantes que le matériel.'
    ]
  };

  /* ------------------------------ BUREAUX ---------------------------- */
  M.bureaux_feu_plateau = {
    building: 'bureaux',
    title: 'Feu de plateau au R+2',
    level: 'Avancé',
    brief: [
      '14 h. Un onduleur prend feu sur le plateau A du R+2. 200 personnes sont dans l\'immeuble.',
      'Suis le désenfumage mécanique, vérifie que la ventilation de confort s\'arrête, puis assiste les sapeurs-pompiers.'
    ],
    setup(s) {
      s.ignite('B2_N0', { t: 30 });
      s.openings['B2_dN0'].open = true;
      s.mission._asked = false;
    },
    tick(s) {
      const m = s.mission;
      if (!m._asked && s.firemen.onSite && s.t - s.flags.firemenOnSite > 40) {
        m._asked = true;
        s.journal('Le chef d\'agrès demande l\'arrêt de l\'extraction', 'alarm');
        s.explain('🧑‍🚒 Le chef d\'agrès : « On engage le binôme au R+2. Coupez-moi l\'extraction le temps de l\'attaque. » → utilise l\'arrêt pompiers de VE1 (niveau 2).', 'alarm');
        s.emit('request', 'Le chef d\'agrès demande l\'arrêt de l\'extraction VE1 (arrêt pompiers, niveau 2).');
      }
    },
    objectives: [
      { text: 'Prendre en compte l\'alarme, lever le doute, appeler les secours', done: s => F(s, 'ecsAck') && F(s, 'agentSent') && F(s, 'called18') },
      { text: 'Vérifier : la ZF2 est en sécurité et les ventilateurs tournent', done: s => F(s, 'zsCmd:ZF2') && s.fans.VE1.run && s.fans.VS1.run },
      { text: 'La ventilation de confort est arrêtée et les clapets fermés', done: s => s.cta && !s.cta.on && s.das['DAS_B3_CL'].state === 'PS' },
      { text: 'Évacuation complète', done: s => F(s, 'ag') && s.stats().inside === 0 },
      { text: 'À la demande des secours : arrêt pompiers de l\'extracteur VE1', done: s => F(s, 'pompier:VE1') },
      { text: 'Feu éteint : remettre en marche puis réarmer le SSI', done: s => F(s, 'fireOut') && F(s, 'ecsReset') && F(s, 'zsReset:ZF2') && F(s, 'ugaReset') }
    ],
    end: s => (F(s, 'fireOut') && F(s, 'ugaReset') && F(s, 'zsReset:ZF2')) || s.t > 3600,
    lessons: [
      'Le désenfumage mécanique ne vise que la zone sinistrée : la première ZF est prioritaire.',
      'La ventilation de confort doit s\'arrêter, sinon elle répand la fumée dans tout l\'immeuble.',
      'L\'arrêt pompiers est une commande de niveau 2, distincte du réarmement.'
    ]
  };

  M.bureaux_panne_soufflage = {
    building: 'bureaux',
    title: 'Le soufflage ne démarre pas',
    level: 'Avancé',
    brief: [
      'Un feu démarre dans la salle de réunion du R+1. Le ventilateur de soufflage VS1 est en panne depuis ce matin, sans que personne ne l\'ait signalé.',
      'Repère le défaut, comprends ses conséquences et protège l\'évacuation.'
    ],
    setup(s) {
      s.setFault('fan', 'VS1', 'panne');
      s.ignite('B1_S2', { t: 40 });
      s.openings['B1_dS2'].open = true;
    },
    objectives: [
      { text: 'Prendre en compte l\'alarme et appeler les secours', done: s => F(s, 'ecsAck') && F(s, 'called18') },
      { text: 'Repérer le défaut au CMSI, puis aller voir le ventilateur VS1 en toiture', done: s => F(s, 'inspect:VS1') },
      { text: 'Lancer l\'évacuation sans attendre', done: s => F(s, 'agManual') },
      { text: 'Désenfumer manuellement un escalier pour protéger la descente', done: s => F(s, 'zsCmd:ZFEW') || F(s, 'zsCmd:ZFEE') },
      { text: 'Évacuation complète', done: s => s.stats().inside === 0 }
    ],
    end: s => (s.stats().inside === 0 && F(s, 'inspect:VS1')) || s.t > 2400,
    lessons: [
      'Un défaut au CMSI n\'est jamais anodin : sans soufflage, l\'extraction est moins efficace et met la circulation en dépression.',
      'Les vérifications périodiques (DF 10, NF S 61-933) servent à découvrir ces pannes AVANT le sinistre.'
    ]
  };

  window.SSI_MISSIONS = M;
})();

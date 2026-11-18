/* =====================================================================
   ESSAIS EN COMMISSION DE SÉCURITÉ
   Des anomalies sont tirées au sort et cachées. Le stagiaire fait
   procéder aux essais, coche conforme / non conforme, puis rend son avis.
   D'après « SSI en opération : vérifications et essais en CDS » (ENSOSP)
   et la NF S 61-933.
   ===================================================================== */
(function () {
  'use strict';
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const shuffle = a => a.map(x => [Math.random(), x]).sort((p, q) => p[0] - q[0]).map(x => x[1]);
  const cat = (b, list) => list.includes(b.category);

  /* ------------------------------- ESSAIS ------------------------------ */
  const ITEMS = [
    { id: 'veille', title: 'État de veille du SSI', applies: b => b.category !== 'E',
      how: 'Avant tout essai, regarde la façade.',
      see: 'Voyants « sous tension » allumés, aucun dérangement, aucune zone hors service, pas de veille restreinte, pas de défaut d\'alimentation.',
      done: s => true },
    { id: 'di', title: 'Essai d\'un détecteur automatique', applies: b => b.category === 'A',
      how: 'Fais procéder à un essai au générateur d\'aérosol sur un DI d\'un local à risques (cuisine, archives, local technique, réserve) : clic sur le détecteur → Essai.',
      see: 'Alarme restreinte, bonne zone affichée à l\'ECS, ordres du CMSI conformes au tableau de correspondance.',
      done: s => 'diTest' in s.flags },
    { id: 'dm', title: 'Essai d\'un déclencheur manuel', applies: b => cat(b, ['A', 'B', 'C', 'D']),
      how: 'Fais actionner un déclencheur manuel à chaque niveau, celui près de l\'escalier (clic sur le DM rouge → Briser la vitre), puis fais-le réarmer.',
      see: 'Catégories A et B : la bonne zone s\'affiche. Catégories C et D : alarme générale immédiate.',
      done: s => 'dmPressed' in s.flags },
    { id: 'baas', title: 'Essai du BAAS Ma', applies: b => b.category === 'E',
      how: 'Fais actionner un BAAS Ma (clic sur le boîtier « Ma »).',
      see: 'Signal d\'évacuation audible dans tout l\'établissement.',
      done: s => 'dmPressed' in s.flags },
    { id: 'process', title: 'Processus d\'alarme temporisé', applies: b => b.tempo > 0,
      how: 'Après l\'essai du DI, laisse courir la temporisation jusqu\'au bout.',
      see: 'Temporisation de 5 minutes au maximum, puis alarme générale automatique.',
      done: s => 'agAuto' in s.flags },
    { id: 'evac', title: 'Audibilité de l\'alarme générale', applies: b => true,
      how: 'Pendant l\'alarme générale, fais faire une ronde à chaque niveau (clic sur un local → Ronde du niveau).',
      see: 'Le signal est audible partout : tous les diffuseurs fonctionnent.',
      done: s => 'ag' in s.flags && 'patrolReport' in s.flags },
    { id: 'compart', title: 'Compartimentage', applies: b => b.zs.some(z => z.kind === 'ZC'),
      how: 'Commande la zone de compartimentage (ou laisse l\'essai la déclencher), puis fais vérifier chaque porte et clapet sur place.',
      see: 'Toutes les portes coupe-feu fermées, clapets fermés, ventilation de confort arrêtée, report correct au tableau.',
      done: s => 'zsCmd:ZC1' in s.flags },
    { id: 'desenf', title: 'Désenfumage d\'une zone', applies: b => b.zs.some(z => z.kind === 'ZF'),
      how: 'Fais commander chaque zone de désenfumage l\'une après l\'autre (CMSI, DCMR ou DCM), escaliers compris. Vérifie les ouvertures, puis fais réarmer avant la suivante.',
      see: 'Évacuation et amenée d\'air ouvertes, ventilateurs en marche, aucun défaut.',
      done: s => Object.keys(s.flags).some(f => f.startsWith('zsCmd:ZF')) },
    { id: 'pompier', title: 'Arrêt pompiers', applies: b => b.fans.length > 0,
      how: 'Ventilateurs en marche, fais actionner l\'arrêt pompiers (niveau 2), puis la remise en marche.',
      see: 'Le ventilateur s\'arrête, la zone reste en sécurité.',
      done: s => Object.keys(s.flags).some(f => f.startsWith('pompier:')) },
    { id: 'ugcis', title: 'Issues de secours verrouillées', applies: b => b.openings.some(o => o.locked),
      how: 'À l\'alarme générale (ou dès la détection en EA 1), fais vérifier le déverrouillage de chaque issue (clic sur la porte → envoyer un agent).',
      see: 'Toutes les issues se déverrouillent ; le déclencheur manuel vert fonctionne.',
      done: s => 'ag' in s.flags },
    { id: 'alim', title: 'Alimentation électrique', applies: b => b.category !== 'E',
      how: 'Fais couper le secteur (bouton plus bas), observe, puis fais-le rétablir.',
      see: 'Bascule sur batteries, voyant « défaut alimentation », système toujours opérationnel.',
      done: s => 'secteurTest' in s.flags },
    { id: 'rearm', title: 'Retour à l\'état de veille', applies: b => true,
      how: 'Fais réarmer l\'ensemble : déclencheurs, ECS, zones de mise en sécurité, DAS sur place, UGA.',
      see: 'Plus aucune alarme, tous les DAS en position d\'attente, portes sur ventouses.',
      done: s => 'ugaReset' in s.flags }
  ];

  /* ------------------------------ ANOMALIES ---------------------------- */
  const ANOM = [
    { id: 'vr', item: 'veille', major: true, applies: (b, s) => b.category !== 'E',
      apply: s => { s.uga.veilleRestreinte = true; return 'UGA laissée en veille restreinte : l\'alarme générale ne partirait pas automatiquement.'; } },
    { id: 'zdhs', item: 'veille', major: true, applies: (b, s) => b.zd.length > 0,
      apply: s => { const z = pick(s.b.zd); s.zd[z.id].hs = true; return 'Zone ' + z.id + ' (' + z.name + ') laissée hors service sans mesure compensatoire.'; } },
    { id: 'secteur', item: 'veille', major: false, applies: (b, s) => b.category !== 'E',
      apply: s => { s.power.secteur = false; return 'Défaut d\'alimentation secteur non traité : le SSI tourne sur batteries.'; } },
    { id: 'tempo', item: 'process', major: true, applies: (b, s) => b.tempo > 0,
      apply: s => { s.tempo = 480; return 'Temporisation réglée à 8 minutes, au-delà des 5 minutes maximum.'; } },
    { id: 'di', item: 'di', major: true, applies: (b, s) => b.category === 'A',
      apply: s => {
        const risk = Object.values(s.devices).filter(d => d.def.type === 'DI' && !d.def.sdad && ['tech'].includes(s.rooms[d.def.room].def.kind) || (d.def.type === 'DI' && (s.rooms[d.def.room].def.fuel || 0) >= 600));
        const d = pick(risk.length ? risk : Object.values(s.devices).filter(x => x.def.type === 'DI'));
        d.fault = 'masque';
        return 'Détecteur ' + d.def.id + ' (' + s.rooms[d.def.room].def.name + ') masqué par un capot de protection oublié après travaux.';
      } },
    { id: 'dm', item: 'dm', major: true, applies: (b, s) => cat(b, ['A', 'B', 'C', 'D']),
      apply: s => { const first = {}; Object.values(s.devices).filter(x => x.def.type === 'DM').forEach(x => { const li = s.levelOf[x.def.room]; if (!first[li]) first[li] = x; }); const d = pick(Object.values(first)); d.fault = 'hs'; return 'Déclencheur manuel ' + d.def.id + ' (' + s.roomName(d.def.room) + ') hors d\'usage.'; } },
    { id: 'porte', item: 'compart', major: true, applies: (b, s) => b.openings.some(o => o.kind === 'cf_auto'),
      apply: s => { const o = pick(Object.values(s.openings).filter(x => x.def.kind === 'cf_auto')); o.wedged = true; o.open = true; return 'Porte coupe-feu ' + o.def.id + ' calée ouverte (' + s.roomName(o.def.a) + ').'; } },
    { id: 'clapet', item: 'compart', major: true, applies: (b, s) => Object.values(s.das).some(d => d.kind === 'CLAPET'),
      apply: s => { const d = pick(Object.values(s.das).filter(x => x.kind === 'CLAPET')); d.fault = 'bloque'; return d.label + ' bloqué ouvert.'; } },
    { id: 'das', item: 'desenf', major: true, applies: (b, s) => Object.values(s.das).some(d => ['VD', 'VA', 'OUV', 'EXU'].includes(d.kind)),
      apply: s => { const d = pick(Object.values(s.das).filter(x => ['VD', 'VA', 'OUV', 'EXU'].includes(x.kind))); d.fault = 'bloque'; return d.label + ' ' + d.ref + ' bloqué (zone ' + d.zs + ').'; } },
    { id: 'fan', item: 'desenf', major: true, applies: (b, s) => b.fans.length > 0,
      apply: s => { const f = pick(Object.values(s.fans)); f.fault = 'panne'; return f.def.name + ' en panne.'; } },
    { id: 'ds', item: 'evac', major: true, applies: (b, s) => b.levels.length > 1,
      apply: s => {
        const li = Math.floor(Math.random() * s.b.levels.length);
        Object.values(s.devices).filter(d => d.def.type === 'DS' && s.levelOf[d.def.room] === li).forEach(d => { d.fault = 'muet'; });
        return 'Diffuseurs du ' + s.b.levels[li].name + ' muets (ligne coupée) : l\'alarme n\'y est pas audible.';
      } },
    { id: 'exit', item: 'ugcis', major: true, applies: (b, s) => b.openings.some(o => o.locked),
      apply: s => { const o = pick(Object.values(s.openings).filter(x => x.def.locked)); o.stuck = true; return 'Issue de secours ' + o.def.id + ' : ne se déverrouille pas à l\'alarme.'; } }
  ];

  function setup(sim) {
    const b = sim.b;
    const pool = shuffle(ANOM.filter(a => a.applies(b, sim)));
    const r = Math.random();
    const n = r < 0.12 ? 0 : r < 0.45 ? 1 : r < 0.85 ? 2 : 3;
    const chosen = [];
    for (const a of pool) {
      if (chosen.length >= n) break;
      if (chosen.some(c => c.item === a.item && a.item !== 'veille')) continue;
      chosen.push({ id: a.id, item: a.item, major: a.major, text: a.apply(sim) });
    }
    return { items: ITEMS.filter(i => i.applies(b)), anomalies: chosen, marks: {}, notes: {}, avis: null };
  }

  function evaluate(state) {
    const found = state.anomalies.map(a => ({ ...a, found: state.marks[a.item] === 'nc' }));
    const itemsWithAnom = new Set(state.anomalies.map(a => a.item));
    const falseNc = state.items.filter(i => state.marks[i.id] === 'nc' && !itemsWithAnom.has(i.id));
    const notDone = state.items.filter(i => !state.marks[i.id]);
    const expected = state.anomalies.some(a => a.major) ? 'défavorable' : 'favorable';
    return { found, falseNc, notDone, expected, avisOk: state.avis === expected };
  }

  window.SSI_CDS = { setup, evaluate, ITEMS };
})();

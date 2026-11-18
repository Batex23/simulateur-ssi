/* =====================================================================
   BÂTIMENTS VIRTUELS
   Coordonnées en mètres. Chaque niveau est un plan (x vers la droite,
   y vers le bas). Les escaliers d'un même "groupe" sont reliés d'un
   niveau à l'autre.

   Exemples PÉDAGOGIQUES : les choix d'équipement sont plausibles mais
   simplifiés. Ils ne valent pas étude réglementaire.
   ===================================================================== */
(function () {
  'use strict';

  /* ---------- petits constructeurs ---------- */
  const R = (id, name, x, y, w, h, kind, extra = {}) => ({ id, name, x, y, w, h, kind, ...extra });
  // ouverture sur une paroi verticale (o:'v', x fixe) ou horizontale (o:'h', y fixe)
  const O = (id, a, b, x, y, o, kind, extra = {}) => ({ id, a, b, x, y, o, len: extra.len || 1.6, kind, ...extra });
  const D = (id, type, room, x, y, extra = {}) => ({ id, type, room, x, y, ...extra });

  const BUILDINGS = [];

  /* =====================================================================
     1. COLLÈGE — SSI de catégorie C, désenfumage naturel MANUEL
     ===================================================================== */
  (function college() {
    const levels = [], openings = [], devices = [];
    const names = ['RDC', 'R+1'];
    for (let n = 0; n < 2; n++) {
      const p = 'L' + n, rooms = [];
      rooms.push(R(p + '_ESC', 'Escalier encloisonné', 0, 0, 4, 16, 'stair', { group: 'ESC', zd: null }));
      rooms.push(R(p + '_C1', 'Circulation ouest', 4, 0, 20, 3, 'circ', { zd: 'ZDM' + n }));
      rooms.push(R(p + '_C2', 'Circulation est', 24, 0, 20, 3, 'circ', { zd: 'ZDM' + n }));
      const salles = n === 0
        ? [['CDI', 4, 9], ['Salle 01', 13, 9], ['Hall', 22, 9], ['Salle 02', 31, 9], ['Sanitaires', 40, 4]]
        : [['Salle 11', 4, 9], ['Salle 12', 13, 9], ['Labo SVT', 22, 9], ['Salle 13', 31, 9], ['Sanitaires', 40, 4]];
      salles.forEach(([nm, x, w], i) => {
        const id = p + '_S' + i;
        const occ = nm === 'Sanitaires' ? 2 : nm === 'Hall' ? 8 : 26;
        rooms.push(R(id, nm, x, 3, w, 13, nm === 'Hall' ? 'hall' : 'local', { occ, fuel: nm.startsWith('Labo') ? 600 : 420 }));
        const corridor = x + w / 2 < 24 ? p + '_C1' : p + '_C2';
        openings.push(O(p + '_dS' + i, id, corridor, x + 1.2, 3, 'h', nm === 'Hall' ? 'door' : 'door', { open: nm === 'Hall' || nm === 'Sanitaires' }));
      });
      levels.push({ id: p, name: names[n], w: 44, h: 16, rooms });

      openings.push(O(p + '_dESC', p + '_ESC', p + '_C1', 4, 0.7, 'v', 'cf_auto', { zs: 'ZC1', len: 1.6 }));
      openings.push(O(p + '_dRec', p + '_C1', p + '_C2', 24, 0.7, 'v', 'cf_auto', { zs: 'ZC1', len: 1.6 }));

      devices.push(D(p + '_DM1', 'DM', p + '_C1', 5.2, 2.3, { zd: 'ZDM' + n }));
      devices.push(D(p + '_DM2', 'DM', p + '_C2', 42.5, 2.3, { zd: 'ZDM' + n }));
      devices.push(D(p + '_DS1', 'DS', p + '_C1', 14, 1.5, { za: 'ZA1' }));
      devices.push(D(p + '_DS2', 'DS', p + '_C2', 34, 1.5, { za: 'ZA1' }));
      // détecteurs autonomes déclencheurs (SDAD) de part et d'autre des portes asservies
      devices.push(D(p + '_SDAD1', 'DI', p + '_C1', 22.5, 1.5, { sdad: 'ZC1', label: 'DAD autonome' }));
      devices.push(D(p + '_SDAD2', 'DI', p + '_C2', 25.5, 1.5, { sdad: 'ZC1', label: 'DAD autonome' }));
      // désenfumage naturel de la circulation : ouvrants en façade nord
      devices.push(D(p + '_OH1', 'OUV', p + '_C1', 12, 0, { zs: 'ZF' + n, role: 'evac', label: 'Ouvrant haut' }));
      devices.push(D(p + '_OH2', 'OUV', p + '_C2', 36, 0, { zs: 'ZF' + n, role: 'evac', label: 'Ouvrant haut' }));
      devices.push(D(p + '_OB1', 'OUV', p + '_C1', 18, 0, { zs: 'ZF' + n, role: 'amenee', label: 'Ouvrant bas (amenée d\'air)' }));
      devices.push(D(p + '_OB2', 'OUV', p + '_C2', 30, 0, { zs: 'ZF' + n, role: 'amenee', label: 'Ouvrant bas (amenée d\'air)' }));
      devices.push(D(p + '_DCM', 'DCM', p + '_C2', 43, 0.8, { zs: ['ZF' + n], label: 'Désenfumage circulation ' + names[n] }));
    }
    // escalier : exutoire en partie haute, amenée d'air par la porte du RDC
    devices.push(D('L1_EXU', 'EXU', 'L1_ESC', 2, 8, { zs: 'ZFE', label: 'Exutoire d\'escalier' }));
    devices.push(D('L0_OAE', 'OUV', 'L0_ESC', 0, 12, { zs: 'ZFE', role: 'amenee', label: 'Ouvrant d\'amenée d\'air' }));
    devices.push(D('L0_DCME', 'DCM', 'L0_ESC', 3.4, 14.5, { zs: ['ZFE'], label: 'Désenfumage escalier' }));
    openings.push(O('L0_xESC', 'L0_ESC', 'EXT', 0, 6, 'v', 'exit', { len: 1.8 }));
    openings.push(O('L0_xHall', 'L0_S2', 'EXT', 25, 16, 'h', 'exit', { len: 2.4 }));

    BUILDINGS.push({
      id: 'college', name: 'Collège Jean Moulin', type: 'ERP type R — 3e catégorie',
      category: 'C', ea: 'EA 2a',
      difficulty: 1,
      summary: 'SSI de catégorie C : pas de détection automatique générale. L\'alarme dépend d\'un déclencheur manuel. Désenfumage naturel commandé à la main.',
      teaches: ['Alarme générale immédiate sur DM', 'Portes asservies par DAD autonomes', 'Désenfumage naturel manuel (DCM)', 'Amenée d\'air / évacuation'],
      tempo: 0, dmTempo: false,
      levels, openings, devices,
      zd: [
        { id: 'ZDM0', name: 'DM RDC', kind: 'ZDM' },
        { id: 'ZDM1', name: 'DM R+1', kind: 'ZDM' }
      ],
      zs: [
        { id: 'ZC1', kind: 'ZC', name: 'Portes asservies' },
        { id: 'ZF0', kind: 'ZF', name: 'Circulation RDC', manualOnly: true },
        { id: 'ZF1', kind: 'ZF', name: 'Circulation R+1', manualOnly: true },
        { id: 'ZFE', kind: 'ZF', name: 'Escalier', manualOnly: true },
        { id: 'ZA1', kind: 'ZA', name: 'Tout le bâtiment' }
      ],
      corr: [
        { zd: 'ZDM0', zs: ['ZC1', 'ZA1'] },
        { zd: 'ZDM1', zs: ['ZC1', 'ZA1'] }
      ],
      fans: [], cta: null,
      missions: ['college_feu_classe']
    });
  })();

  /* =====================================================================
     2. HÔTEL — SSI de catégorie A, EA1, désenfumage naturel automatique
     ===================================================================== */
  (function hotel() {
    const levels = [], openings = [], devices = [];
    const names = ['RDC', 'R+1', 'R+2'];
    for (let n = 0; n < 3; n++) {
      const p = 'H' + n, rooms = [];
      rooms.push(R(p + '_EW', 'Escalier ouest', 0, 0, 4, 14, 'stair', { group: 'EW' }));
      rooms.push(R(p + '_EE', 'Escalier est', 36, 0, 4, 14, 'stair', { group: 'EE' }));
      rooms.push(R(p + '_C1', 'Circulation ouest', 4, 5, 16, 3, 'circ', { zd: 'ZD' + n + 'C' }));
      rooms.push(R(p + '_C2', 'Circulation est', 20, 5, 16, 3, 'circ', { zd: 'ZD' + n + 'C' }));
      let north, south;
      if (n === 0) {
        north = [['Bureau', 4, 6, 1], ['Poste de sécurité', 10, 5, 1], ['Bagagerie', 15, 5, 0], ['Cuisine', 20, 10, 3], ['Réserve', 30, 6, 0]];
        south = [['Hall d\'accueil', 4, 16, 12], ['Restaurant', 20, 16, 30]];
      } else {
        north = []; south = [];
        for (let i = 0; i < 8; i++) north.push(['Ch. ' + n + '0' + (i + 1), 4 + 4 * i, 4, 2]);
        for (let i = 0; i < 8; i++) south.push(['Ch. ' + n + (i + 9 < 10 ? '0' : '') + (i + 9), 4 + 4 * i, 4, 2]);
      }
      north.forEach(([nm, x, w, occ], i) => {
        const id = p + '_N' + i;
        rooms.push(R(id, nm, x, 0, w, 5, 'local', { zd: 'ZD' + n + 'L', occ, fuel: nm === 'Cuisine' ? 700 : 500 }));
        const c = x + w / 2 < 20 ? p + '_C1' : p + '_C2';
        openings.push(O(p + '_dN' + i, id, c, x + w / 2 - 0.5, 5, 'h', 'door', { len: 1 }));
      });
      south.forEach(([nm, x, w, occ], i) => {
        const id = p + '_S' + i;
        rooms.push(R(id, nm, x, 8, w, 6, n === 0 && i === 0 ? 'hall' : 'local', { zd: 'ZD' + n + 'L', occ, fuel: nm === 'Restaurant' ? 550 : 500 }));
        const c = x + w / 2 < 20 ? p + '_C1' : p + '_C2';
        const wide = n === 0;
        openings.push(O(p + '_dS' + i, id, c, x + (wide ? 3 : w / 2 - 0.5), 8, 'h', 'door', { len: wide ? 2.2 : 1, open: wide }));
      });
      levels.push({ id: p, name: names[n], w: 40, h: 14, rooms });

      openings.push(O(p + '_dEW', p + '_EW', p + '_C1', 4, 5.7, 'v', 'cf_auto', { zs: 'ZC1' }));
      openings.push(O(p + '_dEE', p + '_C2', p + '_EE', 36, 5.7, 'v', 'cf_auto', { zs: 'ZC1' }));
      openings.push(O(p + '_dRec', p + '_C1', p + '_C2', 20, 5.7, 'v', 'cf_auto', { zs: 'ZC1' }));

      // détection automatique dans tous les locaux et circulations
      rooms.forEach(r => {
        if (r.kind === 'stair') return;
        devices.push(D(p + '_DI_' + r.id.split('_')[1], 'DI', r.id, r.x + r.w / 2, r.y + r.h / 2, { zd: r.zd }));
      });
      devices.push(D(p + '_DM1', 'DM', p + '_C1', 5, 7.4, { zd: 'ZD' + n + 'M' }));
      devices.push(D(p + '_DM2', 'DM', p + '_C2', 35, 7.4, { zd: 'ZD' + n + 'M' }));
      devices.push(D(p + '_DS1', 'DS', p + '_C1', 9, 5.6, { za: 'ZA1' }));
      devices.push(D(p + '_DS2', 'DS', p + '_C2', 31, 5.6, { za: 'ZA1' }));
      // désenfumage naturel des circulations : bouches sur conduits verticaux
      devices.push(D(p + '_VD1', 'VD', p + '_C1', 14, 5, { zs: 'ZF' + n, mode: 'nat', label: 'Volet d\'évacuation (haut)' }));
      devices.push(D(p + '_VD2', 'VD', p + '_C2', 26, 5, { zs: 'ZF' + n, mode: 'nat', label: 'Volet d\'évacuation (haut)' }));
      devices.push(D(p + '_VA1', 'VA', p + '_C1', 7, 8, { zs: 'ZF' + n, mode: 'nat', label: 'Volet d\'amenée d\'air (bas)' }));
      devices.push(D(p + '_VA2', 'VA', p + '_C2', 33, 8, { zs: 'ZF' + n, mode: 'nat', label: 'Volet d\'amenée d\'air (bas)' }));
    }
    devices.push(D('H2_EXUW', 'EXU', 'H2_EW', 2, 7, { zs: 'ZFEW', label: 'Exutoire escalier ouest' }));
    devices.push(D('H2_EXUE', 'EXU', 'H2_EE', 38, 7, { zs: 'ZFEE', label: 'Exutoire escalier est' }));
    devices.push(D('H0_OAW', 'OUV', 'H0_EW', 0, 3, { zs: 'ZFEW', role: 'amenee', label: 'Amenée d\'air escalier' }));
    devices.push(D('H0_OAE', 'OUV', 'H0_EE', 40, 3, { zs: 'ZFEE', role: 'amenee', label: 'Amenée d\'air escalier' }));
    devices.push(D('H0_DCMW', 'DCM', 'H0_EW', 3.3, 12.5, { zs: ['ZFEW'], label: 'Désenfumage escalier ouest' }));
    devices.push(D('H0_DCME', 'DCM', 'H0_EE', 36.7, 12.5, { zs: ['ZFEE'], label: 'Désenfumage escalier est' }));
    openings.push(O('H0_xEW', 'H0_EW', 'EXT', 0, 10, 'v', 'exit', { len: 1.6 }));
    openings.push(O('H0_xEE', 'H0_EE', 'EXT', 40, 10, 'v', 'exit', { len: 1.6 }));
    openings.push(O('H0_xHall', 'H0_S0', 'EXT', 9, 14, 'h', 'exit', { len: 2.6 }));

    const zd = [], corr = [];
    for (let n = 0; n < 3; n++) {
      zd.push({ id: 'ZD' + n + 'C', name: 'Circulations ' + names[n], kind: 'ZDA' });
      zd.push({ id: 'ZD' + n + 'L', name: (n ? 'Chambres ' : 'Locaux ') + names[n], kind: 'ZDA' });
      zd.push({ id: 'ZD' + n + 'M', name: 'DM ' + names[n], kind: 'ZDM' });
      corr.push({ zd: 'ZD' + n + 'C', zs: ['ZC1', 'ZF' + n, 'ZA1'] });
      corr.push({ zd: 'ZD' + n + 'L', zs: ['ZC1', 'ZA1'] });
      corr.push({ zd: 'ZD' + n + 'M', zs: ['ZC1', 'ZA1'] });
    }
    BUILDINGS.push({
      id: 'hotel', name: 'Hôtel des Quais', type: 'ERP type O — 3e catégorie, R+2',
      category: 'A', ea: 'EA 1', difficulty: 2,
      summary: 'Détection automatique dans tous les locaux. Le CMSI ferme les portes, désenfume la circulation sinistrée et lance le processus d\'alarme temporisé.',
      teaches: ['ECS / CMSI / UGA', 'Temporisation et levée de doute', 'Désenfumage naturel automatique', 'Tableau de correspondance'],
      tempo: 120, dmTempo: true,
      levels, openings, devices, zd,
      zs: [
        { id: 'ZC1', kind: 'ZC', name: 'Compartimentage général' },
        { id: 'ZF0', kind: 'ZF', name: 'Circulations RDC' },
        { id: 'ZF1', kind: 'ZF', name: 'Circulations R+1' },
        { id: 'ZF2', kind: 'ZF', name: 'Circulations R+2' },
        { id: 'ZFEW', kind: 'ZF', name: 'Escalier ouest', manualOnly: true },
        { id: 'ZFEE', kind: 'ZF', name: 'Escalier est', manualOnly: true },
        { id: 'ZA1', kind: 'ZA', name: 'Tout l\'hôtel' }
      ],
      corr, fans: [], cta: null,
      missions: ['hotel_feu_chambre', 'hotel_fausse_alarme', 'hotel_porte_calee']
    });
  })();

  /* =====================================================================
     3. IMMEUBLE DE BUREAUX — SSI A complexe, désenfumage MÉCANIQUE
     ===================================================================== */
  (function bureaux() {
    const levels = [], openings = [], devices = [];
    const names = ['RDC', 'R+1', 'R+2', 'R+3'];
    for (let n = 0; n < 4; n++) {
      const p = 'B' + n, rooms = [];
      rooms.push(R(p + '_EW', 'Escalier ouest', 0, 0, 4, 16, 'stair', { group: 'EW' }));
      rooms.push(R(p + '_EE', 'Escalier est', 40, 0, 4, 16, 'stair', { group: 'EE' }));
      rooms.push(R(p + '_C', 'Circulation', 4, 6, 36, 3, 'circ', { zd: 'ZD' + n + 'C' }));
      let north, south;
      if (n === 0) {
        north = [['Hall d\'accueil', 4, 18, 15, 'hall'], ['Local SSI', 22, 6, 1, 'tech'], ['Archives', 28, 12, 0, 'local']];
        south = [['Cafétéria', 4, 18, 25, 'local'], ['Local CTA', 22, 9, 0, 'tech'], ['Salle de réunion', 31, 9, 10, 'local']];
      } else {
        north = [['Plateau A', 4, 18, 20, 'local'], ['Plateau B', 22, 18, 20, 'local']];
        south = [['Bureau ' + n + '01', 4, 9, 4, 'local'], ['Bureau ' + n + '02', 13, 9, 4, 'local'], ['Réunion ' + n, 22, 9, 6, 'local'], ['Reprographie', 31, 9, 1, 'local']];
      }
      north.forEach(([nm, x, w, occ, kind], i) => {
        const id = p + '_N' + i;
        rooms.push(R(id, nm, x, 0, w, 6, kind, { zd: 'ZD' + n + 'L', occ, fuel: nm === 'Archives' ? 900 : 520, cta: kind !== 'tech' }));
        openings.push(O(p + '_dN' + i, id, p + '_C', x + w / 2 - 0.7, 6, 'h', 'door', { len: kind === 'hall' ? 2.4 : 1.2, open: kind === 'hall' }));
      });
      south.forEach(([nm, x, w, occ, kind], i) => {
        const id = p + '_S' + i;
        rooms.push(R(id, nm, x, 9, w, 7, kind, { zd: 'ZD' + n + 'L', occ, fuel: 500, cta: kind !== 'tech' }));
        openings.push(O(p + '_dS' + i, id, p + '_C', x + w / 2 - 0.6, 9, 'h', 'door', { len: 1.2, open: nm === 'Cafétéria' }));
      });
      levels.push({ id: p, name: names[n], w: 44, h: 16, rooms });

      openings.push(O(p + '_dEW', p + '_EW', p + '_C', 4, 6.7, 'v', 'cf_auto', { zs: 'ZC1' }));
      openings.push(O(p + '_dEE', p + '_C', p + '_EE', 40, 6.7, 'v', 'cf_auto', { zs: 'ZC1' }));

      rooms.forEach(r => {
        if (r.kind === 'stair') return;
        devices.push(D(p + '_DI_' + r.id.split('_')[1], 'DI', r.id, r.x + r.w / 2, r.y + r.h / 2, { zd: r.zd }));
      });
      devices.push(D(p + '_DM1', 'DM', p + '_C', 5, 8.4, { zd: 'ZD' + n + 'M' }));
      devices.push(D(p + '_DM2', 'DM', p + '_C', 39, 8.4, { zd: 'ZD' + n + 'M' }));
      devices.push(D(p + '_DS1', 'DS', p + '_C', 12, 6.6, { za: 'ZA1' }));
      devices.push(D(p + '_DS2', 'DS', p + '_C', 32, 6.6, { za: 'ZA1' }));
      // désenfumage mécanique de la circulation (conduits collectifs)
      devices.push(D(p + '_VD', 'VD', p + '_C', 25, 6, { zs: 'ZF' + n, mode: 'meca', label: 'Volet d\'extraction' }));
      devices.push(D(p + '_VA', 'VA', p + '_C', 18, 9, { zs: 'ZF' + n, mode: 'meca', label: 'Volet de soufflage' }));
      // clapet coupe-feu sur le réseau de ventilation de confort, à la traversée de la gaine
      devices.push(D(p + '_CL', 'CLAPET', p + '_C', 21, 6, { zs: 'ZC1', level: p, label: 'Clapet coupe-feu ' + names[n] }));
    }
    devices.push(D('B3_EXUW', 'EXU', 'B3_EW', 2, 8, { zs: 'ZFEW', label: 'Exutoire escalier ouest' }));
    devices.push(D('B3_EXUE', 'EXU', 'B3_EE', 42, 8, { zs: 'ZFEE', label: 'Exutoire escalier est' }));
    devices.push(D('B0_OAW', 'OUV', 'B0_EW', 0, 3, { zs: 'ZFEW', role: 'amenee', label: 'Amenée d\'air escalier' }));
    devices.push(D('B0_OAE', 'OUV', 'B0_EE', 44, 3, { zs: 'ZFEE', role: 'amenee', label: 'Amenée d\'air escalier' }));
    devices.push(D('B0_DCMW', 'DCM', 'B0_EW', 3.3, 14.5, { zs: ['ZFEW'], label: 'Désenfumage escalier ouest' }));
    devices.push(D('B0_DCME', 'DCM', 'B0_EE', 40.7, 14.5, { zs: ['ZFEE'], label: 'Désenfumage escalier est' }));
    // issues de secours verrouillées (UGCIS) avec déclencheur manuel vert
    openings.push(O('B0_xEW', 'B0_EW', 'EXT', 0, 11, 'v', 'exit', { len: 1.6, locked: true }));
    openings.push(O('B0_xEE', 'B0_EE', 'EXT', 44, 11, 'v', 'exit', { len: 1.6, locked: true }));
    openings.push(O('B0_xHall', 'B0_N0', 'EXT', 11, 0, 'h', 'exit', { len: 3, locked: true }));
    devices.push(D('B0_DMV1', 'DMV', 'B0_EW', 0.7, 12.9, { opening: 'B0_xEW' }));
    devices.push(D('B0_DMV2', 'DMV', 'B0_EE', 43.3, 12.9, { opening: 'B0_xEE' }));
    devices.push(D('B0_DMV3', 'DMV', 'B0_N0', 14, 0.6, { opening: 'B0_xHall' }));

    const zd = [], corr = [];
    for (let n = 0; n < 4; n++) {
      zd.push({ id: 'ZD' + n + 'C', name: 'Circulation ' + names[n], kind: 'ZDA' });
      zd.push({ id: 'ZD' + n + 'L', name: 'Locaux ' + names[n], kind: 'ZDA' });
      zd.push({ id: 'ZD' + n + 'M', name: 'DM ' + names[n], kind: 'ZDM' });
      corr.push({ zd: 'ZD' + n + 'C', zs: ['ZC1', 'ZF' + n, 'ZA1'] });
      corr.push({ zd: 'ZD' + n + 'L', zs: ['ZC1', 'ZA1'] });
      corr.push({ zd: 'ZD' + n + 'M', zs: ['ZC1', 'ZA1'] });
    }
    BUILDINGS.push({
      id: 'bureaux', name: 'Tour Garonne', type: 'ERP type W — 2e catégorie, R+3',
      category: 'A', ea: 'EA 1', difficulty: 3,
      summary: 'Désenfumage mécanique des circulations (extraction + soufflage sur conduits collectifs), ventilation de confort avec clapets coupe-feu, issues de secours verrouillées gérées par UGCIS.',
      teaches: ['Désenfumage mécanique', 'Ventilateurs et arrêt pompiers', 'Clapets coupe-feu et arrêt CTA', 'Issues de secours verrouillées (UGCIS)', 'Priorité de la première ZF'],
      tempo: 180, dmTempo: true,
      levels, openings, devices, zd,
      zs: [
        { id: 'ZC1', kind: 'ZC', name: 'Compartimentage général' },
        { id: 'ZF0', kind: 'ZF', name: 'Circulation RDC' },
        { id: 'ZF1', kind: 'ZF', name: 'Circulation R+1' },
        { id: 'ZF2', kind: 'ZF', name: 'Circulation R+2' },
        { id: 'ZF3', kind: 'ZF', name: 'Circulation R+3' },
        { id: 'ZFEW', kind: 'ZF', name: 'Escalier ouest', manualOnly: true },
        { id: 'ZFEE', kind: 'ZF', name: 'Escalier est', manualOnly: true },
        { id: 'ZA1', kind: 'ZA', name: 'Tout l\'immeuble' }
      ],
      corr,
      fans: [
        { id: 'VE1', name: 'Extracteur VE1', role: 'extraction', zfs: ['ZF0', 'ZF1', 'ZF2', 'ZF3'], flow: 5.0 },
        { id: 'VS1', name: 'Ventilateur de soufflage VS1', role: 'soufflage', zfs: ['ZF0', 'ZF1', 'ZF2', 'ZF3'], flow: 3.8 }
      ],
      cta: { id: 'CTA1', name: 'CTA de confort', zs: 'ZC1' },
      ugcis: true,
      missions: ['bureaux_feu_plateau', 'bureaux_panne_soufflage']
    });
  })();


  /* =====================================================================
     4. MÉDIATHÈQUE — SSI de catégorie B (DM + CMSI de type B)
     ===================================================================== */
  (function mediatheque() {
    const levels = [], openings = [], devices = [];
    const names = ['RDC', 'R+1'];
    for (let n = 0; n < 2; n++) {
      const p = 'M' + n, rooms = [];
      rooms.push(R(p + '_ESC', 'Escalier', 0, 0, 4, 16, 'stair', { group: 'ESC' }));
      if (n === 0) {
        rooms.push(R(p + '_HALL', 'Hall d\'accueil', 4, 0, 10, 16, 'hall', { zd: 'ZDM0', occ: 15, fuel: 300 }));
        rooms.push(R(p + '_LECT', 'Salle de lecture', 14, 0, 20, 16, 'local', { zd: 'ZDM0', occ: 60, fuel: 700 }));
        rooms.push(R(p + '_BUR', 'Bureaux', 34, 0, 6, 8, 'local', { zd: 'ZDM0', occ: 4 }));
        rooms.push(R(p + '_TECH', 'Local technique', 34, 8, 6, 8, 'tech', { zd: 'ZDM0' }));
        openings.push(O(p + '_dLect', p + '_HALL', p + '_LECT', 14, 6, 'v', 'cf_auto', { zs: 'ZC1', len: 3 }));
        openings.push(O(p + '_dBur', p + '_LECT', p + '_BUR', 34, 3, 'v', 'door', { len: 1 }));
        openings.push(O(p + '_dTech', p + '_LECT', p + '_TECH', 34, 12, 'v', 'door', { len: 1 }));
        openings.push(O('M0_xHall', p + '_HALL', 'EXT', 7, 16, 'h', 'exit', { len: 2.6, open: true }));
        openings.push(O('M0_xLect', p + '_LECT', 'EXT', 30, 16, 'h', 'exit', { len: 1.8 }));
      } else {
        rooms.push(R(p + '_PAL', 'Palier', 4, 0, 8, 16, 'circ', { zd: 'ZDM1', fuel: 80 }));
        rooms.push(R(p + '_MULTI', 'Espace multimédia', 12, 0, 14, 16, 'local', { zd: 'ZDM1', occ: 30, fuel: 550 }));
        rooms.push(R(p + '_ETUDE', 'Salle d\'étude', 26, 0, 8, 16, 'local', { zd: 'ZDM1', occ: 20 }));
        rooms.push(R(p + '_RES', 'Réserve de livres', 34, 0, 6, 16, 'local', { zd: 'ZDM1', occ: 1, fuel: 1200 }));
        openings.push(O(p + '_dMulti', p + '_PAL', p + '_MULTI', 12, 6, 'v', 'door', { len: 1.8, open: true }));
        openings.push(O(p + '_dEtude', p + '_MULTI', p + '_ETUDE', 26, 6, 'v', 'door', { len: 1.2, open: true }));
        openings.push(O(p + '_dRes', p + '_ETUDE', p + '_RES', 34, 6, 'v', 'door', { len: 1 }));
      }
      levels.push({ id: p, name: names[n], w: 40, h: 16, rooms });
      openings.push(O(p + '_dESC', p + '_ESC', n === 0 ? p + '_HALL' : p + '_PAL', 4, 10, 'v', 'cf_auto', { zs: 'ZC1', len: 1.6 }));
      devices.push(D(p + '_DM1', 'DM', n === 0 ? p + '_HALL' : p + '_PAL', 5, 9, { zd: 'ZDM' + n }));
      devices.push(D(p + '_DM2', 'DM', n === 0 ? p + '_LECT' : p + '_ETUDE', n === 0 ? 33 : 33, 14.6, { zd: 'ZDM' + n }));
      devices.push(D(p + '_DS1', 'DS', n === 0 ? p + '_HALL' : p + '_PAL', 9, 1.2, { za: 'ZA1' }));
      devices.push(D(p + '_DS2', 'DS', n === 0 ? p + '_LECT' : p + '_MULTI', 20, 1.2, { za: 'ZA1' }));
    }
    // désenfumage naturel des salles : ouvrants en façade, commandés depuis le CMSI B ou un DCM
    devices.push(D('M0_OH1', 'OUV', 'M0_LECT', 18, 0, { zs: 'ZF0', role: 'evac', label: 'Ouvrant haut' }));
    devices.push(D('M0_OH2', 'OUV', 'M0_LECT', 28, 0, { zs: 'ZF0', role: 'evac', label: 'Ouvrant haut' }));
    devices.push(D('M0_OB1', 'OUV', 'M0_LECT', 22, 16, { zs: 'ZF0', role: 'amenee', label: 'Ouvrant bas (amenée d\'air)' }));
    devices.push(D('M0_DCM', 'DCM', 'M0_HALL', 12.5, 14.6, { zs: ['ZF0'], label: 'Désenfumage salle de lecture' }));
    devices.push(D('M1_OH1', 'OUV', 'M1_MULTI', 16, 0, { zs: 'ZF1', role: 'evac', label: 'Ouvrant haut' }));
    devices.push(D('M1_OH2', 'OUV', 'M1_MULTI', 23, 0, { zs: 'ZF1', role: 'evac', label: 'Ouvrant haut' }));
    devices.push(D('M1_OB1', 'OUV', 'M1_MULTI', 19, 16, { zs: 'ZF1', role: 'amenee', label: 'Ouvrant bas (amenée d\'air)' }));
    devices.push(D('M1_EXU', 'EXU', 'M1_ESC', 2, 8, { zs: 'ZFE', label: 'Exutoire d\'escalier' }));
    devices.push(D('M0_OAE', 'OUV', 'M0_ESC', 0, 12, { zs: 'ZFE', role: 'amenee', label: 'Amenée d\'air escalier' }));
    openings.push(O('M0_xESC', 'M0_ESC', 'EXT', 0, 4, 'v', 'exit', { len: 1.6 }));

    BUILDINGS.push({
      id: 'mediatheque', name: 'Médiathèque Montaigne', type: 'ERP type S — 3e catégorie, R+1',
      category: 'B', ea: 'EA 2a', difficulty: 2,
      summary: 'Pas de détection automatique : les déclencheurs manuels sont reliés à un CMSI de type B, qui localise la zone, ferme les portes et lance l\'alarme. Le désenfumage se commande à la main, au CMSI ou sur place.',
      teaches: ['CMSI de type B', 'Zones de déclencheurs manuels', 'Désenfumage commandé à l\'UCMC', 'Grand volume : ouvrants haut et bas'],
      tempo: 0, dmTempo: false,
      levels, openings, devices,
      zd: [{ id: 'ZDM0', name: 'DM RDC', kind: 'ZDM' }, { id: 'ZDM1', name: 'DM R+1', kind: 'ZDM' }],
      zs: [
        { id: 'ZC1', kind: 'ZC', name: 'Portes asservies' },
        { id: 'ZF0', kind: 'ZF', name: 'Salle de lecture', manualOnly: true },
        { id: 'ZF1', kind: 'ZF', name: 'Espace multimédia', manualOnly: true },
        { id: 'ZFE', kind: 'ZF', name: 'Escalier', manualOnly: true },
        { id: 'ZA1', kind: 'ZA', name: 'Toute la médiathèque' }
      ],
      corr: [{ zd: 'ZDM0', zs: ['ZC1', 'ZA1'] }, { zd: 'ZDM1', zs: ['ZC1', 'ZA1'] }],
      fans: [], cta: null,
      missions: []
    });
  })();

  /* =====================================================================
     5. RESTAURANT — SSI de catégorie D (DCMR + BAAS Pr / Sa)
     ===================================================================== */
  (function restaurant() {
    const levels = [], openings = [], devices = [];
    // RDC
    let rooms = [];
    rooms.push(R('N0_ESC', 'Escalier', 0, 0, 3, 6, 'stair', { group: 'ESC' }));
    rooms.push(R('N0_VEST', 'Sanitaires', 3, 0, 7, 6, 'local', { occ: 2 }));
    rooms.push(R('N0_BAR', 'Entrée / bar', 0, 6, 10, 8, 'hall', { occ: 12, fuel: 400 }));
    rooms.push(R('N0_SALLE', 'Salle de restaurant', 10, 0, 12, 14, 'local', { occ: 45, fuel: 450 }));
    rooms.push(R('N0_CUIS', 'Cuisine', 22, 0, 8, 8, 'local', { occ: 5, fuel: 800 }));
    rooms.push(R('N0_RES', 'Réserve', 22, 8, 8, 6, 'local', { occ: 0, fuel: 900 }));
    levels.push({ id: 'N0', name: 'RDC', w: 30, h: 14, rooms });
    rooms = [];
    rooms.push(R('N1_ESC', 'Escalier', 0, 0, 3, 6, 'stair', { group: 'ESC' }));
    rooms.push(R('N1_SAN', 'Sanitaires', 0, 6, 3, 8, 'local', { occ: 1 }));
    rooms.push(R('N1_REC', 'Salle de réception', 3, 0, 19, 14, 'local', { occ: 50, fuel: 450 }));
    rooms.push(R('N1_OFF', 'Office', 22, 0, 8, 14, 'local', { occ: 3, fuel: 500 }));
    levels.push({ id: 'N1', name: 'R+1', w: 30, h: 14, rooms });

    openings.push(O('N0_dEsc', 'N0_ESC', 'N0_BAR', 1, 6, 'h', 'cf_auto', { zs: 'ZC1', len: 1.2 }));
    openings.push(O('N0_dVest', 'N0_VEST', 'N0_BAR', 6, 6, 'h', 'door', { len: 1 }));
    openings.push(O('N0_dSalle', 'N0_BAR', 'N0_SALLE', 10, 9, 'v', 'door', { len: 2.4, open: true }));
    openings.push(O('N0_dCuis', 'N0_SALLE', 'N0_CUIS', 22, 3, 'v', 'cf_auto', { zs: 'ZC1', len: 1.4 }));
    openings.push(O('N0_dRes', 'N0_CUIS', 'N0_RES', 25, 8, 'h', 'door', { len: 1 }));
    openings.push(O('N0_xBar', 'N0_BAR', 'EXT', 4, 14, 'h', 'exit', { len: 2.2, open: true }));
    openings.push(O('N0_xSalle', 'N0_SALLE', 'EXT', 17, 14, 'h', 'exit', { len: 1.6 }));
    openings.push(O('N1_dEsc', 'N1_ESC', 'N1_REC', 3, 2, 'v', 'cf_auto', { zs: 'ZC1', len: 1.4 }));
    openings.push(O('N1_dSan', 'N1_SAN', 'N1_REC', 3, 10, 'v', 'door', { len: 1 }));
    openings.push(O('N1_dOff', 'N1_REC', 'N1_OFF', 22, 6, 'v', 'door', { len: 1.2, open: true }));

    devices.push(D('N0_DM1', 'DM', 'N0_BAR', 1, 12.8));
    devices.push(D('N0_DM2', 'DM', 'N0_CUIS', 29, 1));
    devices.push(D('N1_DM1', 'DM', 'N1_REC', 4, 1));
    devices.push(D('N0_DS1', 'DS', 'N0_SALLE', 16, 0.9, { za: 'ZA1', label: 'BAAS Sa' }));
    devices.push(D('N0_DS2', 'DS', 'N0_CUIS', 26, 7.1, { za: 'ZA1', label: 'BAAS Sa' }));
    devices.push(D('N0_PR', 'DS', 'N0_BAR', 8.5, 7, { za: 'ZA1', label: 'BAAS Pr (principal)' }));
    devices.push(D('N1_DS1', 'DS', 'N1_REC', 12, 0.9, { za: 'ZA1', label: 'BAAS Sa' }));
    devices.push(D('N0_OH', 'OUV', 'N0_SALLE', 16, 0, { zs: 'ZF0', role: 'evac', label: 'Ouvrant haut' }));
    devices.push(D('N0_OB', 'OUV', 'N0_SALLE', 13, 14, { zs: 'ZF0', role: 'amenee', label: 'Ouvrant bas (amenée d\'air)' }));
    devices.push(D('N1_EXU1', 'EXU', 'N1_REC', 8, 7, { zs: 'ZF1', label: 'Exutoire' }));
    devices.push(D('N1_EXU2', 'EXU', 'N1_REC', 17, 7, { zs: 'ZF1', label: 'Exutoire' }));
    devices.push(D('N1_OB', 'OUV', 'N1_REC', 12, 14, { zs: 'ZF1', role: 'amenee', label: 'Ouvrant bas (amenée d\'air)' }));

    BUILDINGS.push({
      id: 'restaurant', name: 'Le Comptoir des Chartrons', type: 'ERP type N — 4e catégorie, R+1',
      category: 'D', ea: 'EA 2b', difficulty: 1,
      summary: 'Déclencheurs manuels reliés à un BAAS principal (Pr) qui commande des BAAS satellites. Les portes et le désenfumage se commandent à la main, depuis un dispositif de commande manuelle regroupé (DCMR) près de l\'entrée.',
      teaches: ['BAAS Pr et Sa (EA 2b)', 'DCMR : commandes regroupées', 'Aucune mise en sécurité automatique', 'Désenfumage d\'une salle à l\'étage'],
      tempo: 0, dmTempo: false,
      levels, openings, devices,
      zd: [],
      zs: [
        { id: 'ZC1', kind: 'ZC', name: 'Portes cuisine et escalier' },
        { id: 'ZF0', kind: 'ZF', name: 'Salle de restaurant', manualOnly: true },
        { id: 'ZF1', kind: 'ZF', name: 'Salle de réception', manualOnly: true },
        { id: 'ZA1', kind: 'ZA', name: 'Tout le restaurant' }
      ],
      corr: [], fans: [], cta: null,
      missions: []
    });
  })();

  /* =====================================================================
     6. SALLE POLYVALENTE — SSI de catégorie E (DCM + BAAS Ma)
     ===================================================================== */
  (function salle() {
    const openings = [], devices = [];
    const rooms = [
      R('E0_HALL', 'Hall', 0, 0, 8, 16, 'hall', { occ: 10, fuel: 250 }),
      R('E0_SALLE', 'Grande salle', 8, 0, 18, 16, 'local', { occ: 80, fuel: 380 }),
      R('E0_OFF', 'Office', 26, 0, 6, 8, 'local', { occ: 3, fuel: 600 }),
      R('E0_RANG', 'Rangement', 26, 8, 6, 8, 'local', { occ: 0, fuel: 900 })
    ];
    openings.push(O('E0_dSalle', 'E0_HALL', 'E0_SALLE', 8, 6, 'v', 'door', { len: 3, open: true }));
    openings.push(O('E0_dOff', 'E0_SALLE', 'E0_OFF', 26, 3, 'v', 'door', { len: 1 }));
    openings.push(O('E0_dRang', 'E0_SALLE', 'E0_RANG', 26, 12, 'v', 'door', { len: 1 }));
    openings.push(O('E0_xHall', 'E0_HALL', 'EXT', 3, 16, 'h', 'exit', { len: 2.4, open: true }));
    openings.push(O('E0_xSalle', 'E0_SALLE', 'EXT', 20, 16, 'h', 'exit', { len: 1.8 }));
    devices.push(D('E0_MA1', 'BAASMA', 'E0_HALL', 1, 13));
    devices.push(D('E0_MA2', 'BAASMA', 'E0_SALLE', 25, 15));
    devices.push(D('E0_DS1', 'DS', 'E0_HALL', 4, 0.9, { za: 'ZA1', label: 'BAAS Ma' }));
    devices.push(D('E0_DS2', 'DS', 'E0_SALLE', 17, 0.9, { za: 'ZA1', label: 'BAAS Ma' }));
    devices.push(D('E0_EXU1', 'EXU', 'E0_SALLE', 13, 8, { zs: 'ZF1', label: 'Exutoire' }));
    devices.push(D('E0_EXU2', 'EXU', 'E0_SALLE', 21, 8, { zs: 'ZF1', label: 'Exutoire' }));
    devices.push(D('E0_OB', 'OUV', 'E0_SALLE', 11, 16, { zs: 'ZF1', role: 'amenee', label: 'Ouvrant bas (amenée d\'air)' }));
    devices.push(D('E0_DCM', 'DCM', 'E0_HALL', 7, 13.5, { zs: ['ZF1'], label: 'Désenfumage grande salle (treuil)' }));
    BUILDINGS.push({
      id: 'salle', name: 'Salle polyvalente des Pins', type: 'ERP type L — 5e catégorie, plain-pied',
      category: 'E', ea: 'EA 3', difficulty: 1,
      summary: 'Le SSI le plus simple : aucun tableau. L\'alarme se donne avec un bloc autonome manuel (BAAS Ma), le désenfumage avec un dispositif de commande manuelle sur place.',
      teaches: ['Équipement d\'alarme type 3 (BAAS Ma)', 'DCM : commande manuelle locale', 'Exutoires et amenée d\'air', 'Pas de centralisation'],
      tempo: 0, dmTempo: false,
      levels: [{ id: 'E0', name: 'RDC', w: 32, h: 16, rooms }], openings, devices,
      zd: [],
      zs: [{ id: 'ZF1', kind: 'ZF', name: 'Grande salle', manualOnly: true }, { id: 'ZA1', kind: 'ZA', name: 'Toute la salle' }],
      corr: [], fans: [], cta: null,
      missions: []
    });
  })();

  const ORDER = { E: 0, D: 1, C: 2, B: 3, A: 4 };
  BUILDINGS.sort((a, b) => ORDER[a.category] - ORDER[b.category] || a.difficulty - b.difficulty);

  window.SSI_BUILDINGS = BUILDINGS;
})();

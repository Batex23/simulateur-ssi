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

  window.SSI_BUILDINGS = BUILDINGS;
})();

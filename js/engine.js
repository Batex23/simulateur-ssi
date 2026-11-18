/* =====================================================================
   MOTEUR DE SIMULATION
   - physique simplifiée : feu (croissance t²), fumée (modèle de zones),
     propagation par les ouvertures, désenfumage, ventilation de confort
   - logique SSI : SDI / ECS, CMSI (UGA, UCMC, US), DAS, DCM, UGCIS
   Tout est volontairement simplifié pour la pédagogie.
   ===================================================================== */
(function () {
  'use strict';

  const H = 2.7;               // hauteur sous plafond (m)
  const STEP = 0.25;           // pas de calcul (s simulées)
  const DI_SEUIL = 0.07;       // seuil de fumée d'un DI optique
  const DAS_TRANSIT = { door: 4, VD: 6, VA: 6, OUV: 10, EXU: 12, CLAPET: 2, fan: 1, cta: 1 };

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function fmt(t) {
    t = Math.max(0, Math.floor(t));
    const h = Math.floor(t / 3600), m = Math.floor(t / 60) % 60, s = t % 60;
    return (h ? String(h).padStart(2, '0') + ':' : '') + String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
  }

  class Sim {
    constructor(building) {
      this.b = building;
      this.listeners = {};
      this.reset();
    }

    on(ev, fn) { (this.listeners[ev] = this.listeners[ev] || []).push(fn); }
    emit(ev, d) { (this.listeners[ev] || []).forEach(f => f(d)); }

    /* ------------------------------------------------------------------ */
    reset() {
      const b = this.b;
      this.t = 0; this.acc = 0;
      this.access = 1;
      this.log = []; this.explains = []; this.flags = {}; this._once = {};
      this.power = { secteur: true, aes: true };
      this.rooms = {}; this.openings = {}; this.devices = {}; this.zd = {}; this.zs = {}; this.das = {}; this.fans = {};
      this.levelOf = {};
      b.levels.forEach((L, li) => L.rooms.forEach(r => {
        const vol = r.w * r.h * H;
        this.rooms[r.id] = { def: r, level: li, s: 0, T: 20, fire: null, vol, occ: r.occ || 0, occ0: r.occ || 0, evac: 0, evacStart: null, burnt: false };
        this.levelOf[r.id] = li;
      }));
      b.openings.forEach(o => {
        this.openings[o.id] = { def: o, open: !!o.open || o.kind === 'cf_auto', wedged: false, locked: !!o.locked, exposure: 0, burnt: false, das: null };
      });
      // liaisons verticales des escaliers
      this.vlinks = [];
      const groups = {};
      Object.values(this.rooms).forEach(r => { if (r.def.group) (groups[r.def.group] = groups[r.def.group] || []).push(r); });
      Object.values(groups).forEach(list => {
        list.sort((a, c) => a.level - c.level);
        for (let i = 0; i < list.length - 1; i++) this.vlinks.push([list[i].def.id, list[i + 1].def.id]);
      });

      b.zd.forEach(z => { this.zd[z.id] = { def: z, feu: false, hs: false, first: null, src: null }; });
      b.zs.forEach(z => { this.zs[z.id] = { def: z, ordre: false, by: null, t: 0, hs: false, das: [], defaut: false, ps: false }; });

      b.devices.forEach(d => {
        const st = { def: d, state: 'veille', fault: null, t: 0 };
        this.devices[d.id] = st;
      });

      // ---- DAS ----
      const addDas = (id, label, kind, zsId, extra) => {
        const das = { id, label, kind, zs: zsId, state: 'PA', t: 0, fault: null, ordered: false, defaut: false, orderT: 0,
          remote: true, posCtl: true, energy: 'emission', ...extra };
        this.das[id] = das;
        if (this.zs[zsId]) this.zs[zsId].das.push(id);
        return das;
      };
      Object.values(this.openings).forEach(o => {
        if (o.def.kind === 'cf_auto') {
          o.das = addDas('DAS_' + o.def.id, 'Porte CF à fermeture automatique', 'door', o.def.zs, { remote: false, posCtl: false, energy: 'rupture', ref: o.def.id });
        }
      });
      b.devices.forEach(d => {
        if (['VD', 'VA', 'OUV', 'EXU', 'CLAPET'].includes(d.type)) {
          const das = addDas('DAS_' + d.id, d.label || d.type, d.type, d.zs, {
            ref: d.id, remote: d.type !== 'CLAPET', energy: d.type === 'CLAPET' ? 'rupture' : 'emission'
          });
          this.devices[d.id].das = das;
        }
      });
      (b.fans || []).forEach(f => {
        this.fans[f.id] = { def: f, run: false, pompier: false, fault: null, startT: null };
      });
      this.cta = b.cta ? { def: b.cta, on: true, das: addDas('DAS_' + b.cta.id, 'Arrêt ' + b.cta.name, 'cta', b.cta.zs, { ref: b.cta.id }) } : null;

      // ---- tableaux de bord ----
      this.ecs = { buzzer: false, events: [], cursor: 0, ack: false, testLamps: 0 };
      this.uga = { state: 'veille', remain: 0, buzzer: false, veilleRestreinte: false, agT: null, src: null };
      this.cmsi = { buzzer: false };
      this.firstZF = null;
      this.agent = null;          // agent de sécurité en levée de doute
      this.firemen = { called: null, arrive: null, onSite: false };
      this.dcs = {};
      this.mission = null;
    }

    /* ------------------------------------------------------------------ */
    /* journaux                                                           */
    /* ------------------------------------------------------------------ */
    journal(text, kind = 'info') {
      const e = { t: this.t, time: fmt(this.t), text, kind };
      this.log.push(e);
      this.emit('log', e);
    }
    explain(text, kind = 'info', key = null) {
      if (key) { if (this._once[key]) return; this._once[key] = true; }
      const e = { t: this.t, time: fmt(this.t), text, kind };
      this.explains.push(e);
      this.emit('explain', e);
    }
    flag(name) { if (!(name in this.flags)) { this.flags[name] = this.t; this.emit('flag', name); } }

    hasPower() { return this.power.secteur || this.power.aes; }
    roomName(id) { return id === 'EXT' ? 'extérieur' : (this.rooms[id] ? this.rooms[id].def.name + ' (' + this.b.levels[this.rooms[id].level].name + ')' : id); }
    zsName(id) { const z = this.zs[id]; return z ? id + ' « ' + z.def.name + ' »' : id; }

    /* ------------------------------------------------------------------ */
    /* boucle                                                             */
    /* ------------------------------------------------------------------ */
    advance(realDt, speed) {
      this.acc += realDt * speed;
      let n = 0;
      while (this.acc >= STEP && n < 400) { this.step(STEP); this.acc -= STEP; n++; }
    }

    step(dt) {
      this.t += dt;
      this.stepFire(dt);
      this.stepSmoke(dt);
      this.stepDetection(dt);
      this.stepDas(dt);
      this.stepFans(dt);
      this.stepUga(dt);
      this.stepOccupants(dt);
      this.stepAgents(dt);
      this.stepSignals();
      if (this.mission && this.mission.tick) this.mission.tick(this, dt);
    }

    /* ------------------------------ FEU ------------------------------- */
    ignite(roomId, opts = {}) {
      const r = this.rooms[roomId];
      if (!r || r.fire || r.def.kind === 'stair') return false;
      const fuel = (r.def.fuel || (r.def.kind === 'circ' ? 60 : 400)) * r.def.w * r.def.h; // MJ
      r.fire = { Q: opts.Q || 5, t: opts.t || 0, E: 0, fuel, stage: 'croissance', alpha: opts.alpha || 0.0117 };
      if (!opts.silent) {
        this.journal('Départ de feu : ' + this.roomName(roomId), 'fire');
        this.explain('🔥 Un feu démarre dans ' + this.roomName(roomId) + '. Il grandit selon une courbe t² : lent au début, puis très rapide.', 'fire');
      }
      this.emit('fire', roomId);
      return true;
    }

    roomVentilated(r) {
      // le feu a-t-il de l'air ? (au moins une ouverture ouverte)
      return Object.values(this.openings).some(o => (o.def.a === r.def.id || o.def.b === r.def.id) && (o.open || o.burnt));
    }

    stepFire(dt) {
      Object.values(this.rooms).forEach(r => {
        const f = r.fire;
        if (!f || f.stage === 'éteint') { if (r.T > 20) r.T += (20 - r.T) * 0.004 * dt; return; }
        f.t += dt;
        const area = r.def.w * r.def.h;
        const ventil = this.roomVentilated(r);
        const Qmax = Math.min(area * 150, 3000) * (ventil ? 1 : 0.08) + (ventil ? 0 : 150);
        if ((f.stage === 'croissance' || f.stage === 'développé') && !f.attack) {
          f.Q = Math.min(f.alpha * f.t * f.t + 5, Qmax);
        }
        if (f.stage === 'croissance' && ventil && f.Q >= 0.9 * Qmax && Qmax > 700 && r.T > 450) {
          f.stage = 'développé';
          this.journal('Embrasement généralisé : ' + this.roomName(r.def.id), 'fire');
          this.explain('💥 Embrasement généralisé dans ' + this.roomName(r.def.id) + ' : tout le local brûle. Le feu peut maintenant passer dans les volumes voisins par les portes ouvertes.', 'fire');
        }
        if (!ventil && f.stage === 'croissance' && f.t > 120) {
          this.explain('🚪 Le feu de ' + this.roomName(r.def.id) + ' manque d\'air : toutes ses portes sont fermées. Il couve et produit beaucoup de fumée, mais sa puissance reste limitée.', 'tip', 'confine_' + r.def.id);
        }
        f.E += f.Q * dt / 1000;
        if (f.E > 0.7 * f.fuel && f.stage !== 'déclin') { f.stage = 'déclin'; f.decayQ = f.Q; }
        if (f.stage === 'déclin') {
          f.Q = Math.max(0, f.Q - f.decayQ * dt / 240);
          if (f.Q <= 1) this.extinguish(r.def.id, 'combustible épuisé');
        }
        if (!f.attack && this.firemen.onSite) f.attack = 'sapeurs-pompiers';
        if (f.attack) {
          f.Q = Math.max(0, f.Q * (1 - (f.attack === 'extincteur' ? 0.15 : 0.035) * dt) - 2 * dt);
          if (f.Q < 3) this.extinguish(r.def.id, f.attack);
        }
        // température du local
        r.T += (f.Q * 0.6 / r.vol - 0.01 * (r.T - 20)) * dt;
        r.T = clamp(r.T, 20, f.stage === 'développé' ? 950 : 700);
        // propagation par les ouvertures
        if (f.stage === 'développé') {
          Object.values(this.openings).forEach(o => {
            const other = o.def.a === r.def.id ? o.def.b : o.def.b === r.def.id ? o.def.a : null;
            if (!other || other === 'EXT') return;
            const ro = this.rooms[other];
            if (!ro || ro.fire || ro.def.kind === 'stair') return;
            o.exposure += dt;
            const passage = o.open || o.burnt;
            const limit = passage ? 60 : o.def.kind === 'cf_auto' ? 1800 : 720;
            if (!passage && o.exposure > limit * 0.8) this.explain('⏱ La porte entre ' + this.roomName(r.def.id) + ' et ' + this.roomName(other) + ' est exposée au feu depuis longtemps. Une porte coupe-feu tient un temps limité (ex. EI 30 = 30 min).', 'warn', 'expo_' + o.def.id);
            if (o.exposure > limit) {
              if (!passage) { o.burnt = true; this.journal('Ruine de la porte ' + o.def.id, 'fire'); }
              this.ignite(other, { silent: true });
              this.journal('Propagation du feu vers ' + this.roomName(other), 'fire');
              this.explain('🔥 Le feu se propage vers ' + this.roomName(other) + (passage ? ' par une porte restée ouverte.' : ' : la porte a cédé.'), 'fire');
            }
          });
        }
      });
    }

    extinguish(roomId, how) {
      const r = this.rooms[roomId];
      if (!r || !r.fire || r.fire.stage === 'éteint') return;
      r.fire.stage = 'éteint'; r.fire.Q = 0;
      this.journal('Feu éteint : ' + this.roomName(roomId) + (how ? ' (' + how + ')' : ''), 'ok');
      this.explain('✅ Feu éteint dans ' + this.roomName(roomId) + '. La fumée reste : il faudra désenfumer avant de pouvoir réarmer les détecteurs.', 'ok');
      if (!Object.values(this.rooms).some(x => x.fire && x.fire.stage !== 'éteint')) this.flag('fireOut');
    }

    /* ----------------------------- FUMÉE ------------------------------ */
    openingArea(o) {
      const d = o.def;
      if (o.burnt) return 3;
      if (o.open) return d.len * 2.05;
      return d.kind === 'cf_auto' ? 0.004 : 0.02;
    }

    stepSmoke(dt) {
      const rooms = this.rooms;
      const ds = {};
      Object.keys(rooms).forEach(k => ds[k] = 0);

      // production
      Object.values(rooms).forEach(r => {
        if (r.fire && r.fire.Q > 0) ds[r.def.id] += r.fire.Q * 0.0028 / r.vol * dt * (r.fire.stage === 'éteint' ? 0 : 1);
      });

      // échanges par les ouvertures horizontales
      Object.values(this.openings).forEach(o => {
        const a = rooms[o.def.a], bId = o.def.b;
        const A = this.openingArea(o);
        if (bId === 'EXT') {
          const F = 0.8 * A * a.s;
          ds[a.def.id] -= F * dt / a.vol;
          return;
        }
        const b = rooms[bId];
        const diff = a.s - b.s;
        const F = 0.8 * A * Math.abs(diff);
        const from = diff > 0 ? a : b, to = diff > 0 ? b : a;
        ds[from.def.id] -= F * dt / from.vol;
        ds[to.def.id] += F * dt / to.vol;
        // la fumée transporte la chaleur
        if (from.T > to.T) to.T += (from.T - to.T) * Math.min(1, F * dt / to.vol) * 0.5;
      });

      // cages d'escalier : la fumée monte
      this.vlinks.forEach(([lo, up]) => {
        const a = rooms[lo], b = rooms[up];
        const diff = a.s - b.s;
        const F = diff > 0 ? 1.6 * 8 * diff : 0.15 * 8 * diff;
        ds[lo] -= F * dt / a.vol;
        ds[up] += F * dt / b.vol;
      });

      // désenfumage
      this.smokeControl(ds, dt);

      // ventilation de confort : mélange par les gaines
      if (this.cta) {
        const on = this.cta.on && this.power.secteur;
        this.cta.running = on;
        if (on) {
          const net = Object.values(rooms).filter(r => r.def.cta && !this.levelIsolated(r));
          if (net.length) {
            const pool = net.reduce((s, r) => s + r.s * r.vol, 0) / net.reduce((s, r) => s + r.vol, 0);
            net.forEach(r => { ds[r.def.id] += (pool - r.s) * 0.012 * dt; });
            if (pool > 0.02) this.explain('🌀 La ventilation de confort (CTA) brasse de l\'air enfumé dans les gaines : la fumée gagne d\'autres étages. Il faut arrêter la CTA et fermer les clapets coupe-feu.', 'warn', 'cta_spread');
          }
        }
      }

      // ventilation opérationnelle par les secours après extinction
      const ventOps = this.firemen.onSite && this.flags.fireOut !== undefined;
      if (ventOps) this.explain('🌬 Feu éteint : les sapeurs-pompiers ventilent le bâtiment (ouverture des fenêtres, ventilateurs mobiles). Quand les détecteurs ne voient plus de fumée, tu pourras réarmer.', 'ok', 'ventops');
      Object.values(rooms).forEach(r => {
        const extra = (ventOps ? 0.012 : 0) + (r.aired ? 0.01 : 0);
        r.s = clamp(r.s + ds[r.def.id] - (0.0004 + extra) * r.s * dt, 0, 1);
        if (!r.fire || r.fire.stage === 'éteint') r.T += (20 - r.T) * 0.002 * dt;
      });
    }

    levelIsolated(room) {
      const p = this.b.levels[room.level].id;
      const cl = Object.values(this.devices).find(d => d.def.type === 'CLAPET' && d.def.level === p);
      return cl && cl.das && cl.das.state === 'PS';
    }

    // amenée d'air disponible pour une zone de désenfumage ?
    airInlet(zsId) {
      const z = this.zs[zsId];
      if (!z) return false;
      for (const id of z.das) {
        const d = this.das[id];
        if (d.state !== 'PS') continue;
        if (d.kind === 'VA') {
          const dev = this.devices[d.ref].def;
          if (dev.mode === 'nat') return true;
          if (Object.values(this.fans).some(f => f.def.role === 'soufflage' && f.run && f.def.zfs.includes(zsId))) return true;
        }
        if (d.kind === 'OUV' && this.devices[d.ref].def.role === 'amenee') return true;
      }
      // une porte vers l'extérieur ouverte dans la zone fait office d'amenée d'air
      const roomsOfZ = new Set(z.das.map(id => this.das[id]).filter(d => d.ref && this.devices[d.ref]).map(d => this.devices[d.ref].def.room));
      return Object.values(this.openings).some(o => o.def.b === 'EXT' && o.open && roomsOfZ.has(o.def.a));
    }

    smokeControl(ds, dt) {
      this.extractionState = {};
      Object.values(this.das).forEach(d => {
        if (d.state !== 'PS' || !d.ref || !this.devices[d.ref]) return;
        const dev = this.devices[d.ref].def;
        const r = this.rooms[dev.room];
        if (!r) return;
        let flow = 0, nat = true;
        if (d.kind === 'VD') {
          if (dev.mode === 'meca') {
            nat = false;
            const fan = Object.values(this.fans).find(f => f.def.role === 'extraction' && f.run && f.def.zfs.includes(d.zs));
            if (fan) {
              const open = Object.values(this.das).filter(x => x.kind === 'VD' && x.state === 'PS' && fan.def.zfs.includes(x.zs)).length || 1;
              flow = fan.def.flow / open;
            }
          } else flow = 1.7;
        } else if (d.kind === 'EXU') flow = 2.6;
        else if (d.kind === 'OUV' && dev.role === 'evac') flow = 2.0;
        if (!flow) return;
        const inlet = this.airInlet(d.zs);
        const eff = inlet ? 1 : (nat ? 0.25 : 0.4);
        this.extractionState[d.zs] = { inlet, nat };
        ds[r.def.id] -= flow * eff * r.s * dt / r.vol;
        if (!inlet && r.s > 0.15) {
          if (nat) this.explain('🌬 ' + this.zsName(d.zs) + ' : les évacuations de fumée sont ouvertes mais SANS amenée d\'air. Le tirage naturel ne fonctionne presque pas. Le désenfumage, c\'est toujours un couple évacuation + amenée d\'air.', 'warn', 'noinlet_' + d.zs);
          else this.explain('🌬 ' + this.zsName(d.zs) + ' : l\'extraction tourne mais l\'amenée d\'air manque. La circulation se met en dépression : débit réduit et portes difficiles à ouvrir pour les occupants.', 'warn', 'noinlet_' + d.zs);
        }
      });
    }

    /* --------------------------- DÉTECTION ---------------------------- */
    stepDetection(dt) {
      Object.values(this.devices).forEach(d => {
        if (d.def.type !== 'DI') return;
        if (d.test && this.t > d.testUntil) d.test = false;
        if (d.fault === 'masque' || d.fault === 'absent') return;
        if (d.def.zd && this.zd[d.def.zd] && this.zd[d.def.zd].hs) { d.t = 0; return; }
        const r = this.rooms[d.def.room];
        const sensing = r.s >= DI_SEUIL || d.test || d.fault === 'encrasse';
        d.sensing = sensing;
        if (d.state === 'veille') {
          d.t = sensing ? d.t + dt : 0;
          if (d.t >= 4) this.diAlarm(d);
        }
      });
      // DM vert d'issue de secours
    }

    diAlarm(d) {
      d.state = 'alarme';
      if (d.def.sdad) {
        // détecteur autonome déclencheur : commande directe des DAS, pas d'alarme
        this.journal('DAD autonome ' + d.def.id + ' sollicité → fermeture des portes', 'cmd');
        this.explain('🔴 Le détecteur autonome déclencheur (' + this.roomName(d.def.room) + ') a vu de la fumée. Il commande directement la fermeture des portes asservies. Il ne déclenche PAS l\'alarme : en catégorie C, ce sont les déclencheurs manuels qui le font.', 'detect');
        this.command(d.def.sdad, 'SDAD ' + d.def.id);
        return;
      }
      this.zoneFire(d.def.zd, 'DI', d);
    }

    zoneFire(zdId, srcType, dev) {
      const z = this.zd[zdId];
      if (!z) {
        // catégorie C : DM sans ECS, directement vers l'UGA 2
        if (srcType === 'DM') this.ugaTrigger('DM');
        return;
      }
      if (z.hs) {
        this.journal('Information de ' + zdId + ' ignorée : zone hors service', 'warn');
        this.explain('⚠️ ' + zdId + ' est hors service : l\'alarme n\'est pas prise en compte ! Une zone mise hors service doit rester l\'exception et être surveillée.', 'warn');
        return;
      }
      const isNew = !z.feu;
      z.feu = true;
      if (!z.first) z.first = this.t;
      z.src = dev ? dev.def.id : null;
      if (this.b.category === 'C' || this.b.category === 'D' || this.b.category === 'E') {
        if (srcType === 'DM') this.ugaTrigger('DM');
        return;
      }
      this.ecs.events.push({ zd: zdId, t: this.t, dev: dev ? dev.def.id : null, room: dev ? dev.def.room : null, type: srcType });
      this.ecs.cursor = 0;
      this.ecs.buzzer = true; this.ecs.ack = false;
      if (isNew) {
        this.journal('ECS : FEU ' + zdId + ' (' + z.def.name + ') — ' + (srcType === 'DM' ? 'déclencheur manuel' : 'détecteur automatique'), 'fire');
        this.explain('🔴 L\'ECS reçoit une alarme feu de la zone ' + zdId + ' « ' + z.def.name + ' » (' + (srcType === 'DM' ? 'déclencheur manuel actionné' : 'détecteur automatique') + '). Le buzzer d\'alarme restreinte sonne pour prévenir le personnel. L\'ECS transmet l\'information au CMSI.', 'detect');
        this.cmsiProcess(zdId, srcType);
      }
    }

    /* ------------------------- CMSI : TRAITEMENT ---------------------- */
    cmsiProcess(zdId, srcType) {
      const rows = this.b.corr.filter(c => c.zd === zdId);
      const targets = [];
      rows.forEach(row => row.zs.forEach(zsId => {
        const z = this.zs[zsId];
        if (!z) return;
        if (z.def.kind === 'ZA') { this.ugaTrigger(srcType); return; }
        if (z.def.kind === 'ZF') {
          if (z.def.manualOnly) return;
          if (this.firstZF && this.firstZF !== zsId) {
            this.journal('CMSI : ' + zsId + ' non commandée automatiquement (' + this.firstZF + ' déjà en sécurité)', 'warn');
            this.explain('🧭 La fumée atteint une autre zone (' + zdId + '), mais le CMSI ne désenfume pas automatiquement ' + zsId + ' : seule la PREMIÈRE zone sinistrée est désenfumée automatiquement, pour ne pas disperser les débits. L\'opérateur peut la commander à la main s\'il le juge utile.', 'tip');
            return;
          }
          this.firstZF = this.firstZF || zsId;
        }
        targets.push(zsId);
      }));
      if (targets.length) {
        this.explain('📋 Tableau de correspondance : ' + zdId + ' → ' + targets.join(', ') + '. Le CMSI envoie les ordres de mise en sécurité aux DAS de ces zones.', 'cmd');
        targets.forEach(zsId => this.command(zsId, 'auto (' + zdId + ')'));
      }
      if (this.b.category === 'A' && this.b.ea === 'EA 1' && srcType === 'DI') this.unlockExits('détection automatique (EA 1)');
    }

    command(zsId, by) {
      const z = this.zs[zsId];
      if (!z) return;
      if (z.hs) { this.journal(zsId + ' hors service : ordre non transmis', 'warn'); this.explain('⚠️ ' + this.zsName(zsId) + ' est hors service : l\'ordre de mise en sécurité n\'est pas transmis !', 'warn'); return; }
      if (!this.hasPower()) { this.journal('Plus d\'énergie de sécurité : ordre ' + zsId + ' impossible', 'warn'); return; }
      if (z.ordre) return;
      z.ordre = true; z.by = by; z.t = this.t;
      this.flag('zsCmd:' + zsId);
      z.das.forEach(id => { const d = this.das[id]; d.ordered = true; d.orderT = this.t; });
      this.journal('Mise en sécurité ' + zsId + ' (' + z.def.name + ') — ' + by, 'cmd');
      const k = z.def.kind;
      if (k === 'ZC') this.explain('🚪 ' + this.zsName(zsId) + ' : les portes coupe-feu se ferment (leurs ventouses ne sont plus alimentées)' + (this.cta ? ', les clapets coupe-feu se ferment et la ventilation de confort s\'arrête' : '') + '. Objectif : enfermer le feu et la fumée dans un volume limité.', 'cmd');
      if (k === 'ZF') {
        const meca = z.das.some(id => this.das[id].kind === 'VD' && this.devices[this.das[id].ref].def.mode === 'meca');
        this.explain('💨 ' + this.zsName(zsId) + ' : ' + (meca ? 'les volets d\'extraction et de soufflage s\'ouvrent, puis les ventilateurs démarrent (30 s maximum après la commande).' : 'les évacuations de fumée (haut) et les amenées d\'air (bas) s\'ouvrent. La fumée chaude sort par le haut, l\'air frais entre par le bas.'), 'cmd');
      }
    }

    canReset(zsId) {
      const z = this.zs[zsId];
      // la cause doit avoir disparu
      const zds = this.b.corr.filter(c => c.zs.includes(zsId)).map(c => c.zd);
      const fire = zds.find(id => this.zd[id] && this.zd[id].feu);
      if (fire) return 'La zone ' + fire + ' est toujours en alarme feu à l\'ECS. Réarme d\'abord l\'ECS (la cause doit avoir disparu).';
      const dcm = Object.values(this.devices).find(d => d.def.type === 'DCM' && d.state === 'actionne' && d.def.zs.includes(zsId));
      if (dcm) return 'Le dispositif de commande manuelle « ' + dcm.def.label + ' » est encore actionné. Réarme-le sur place.';
      const sdad = Object.values(this.devices).find(d => d.def.sdad === zsId && d.state === 'alarme');
      if (sdad) return 'Un détecteur autonome déclencheur est encore en alarme.';
      if (this.uga.state === 'ag' && z.def.kind === 'ZC' && this.b.category === 'C') return 'L\'alarme générale est en cours.';
      return null;
    }

    resetZs(zsId, by = 'opérateur') {
      const z = this.zs[zsId];
      if (!z || !z.ordre) return { ok: false, msg: 'Aucun ordre de mise en sécurité en cours sur cette zone.' };
      const why = this.canReset(zsId);
      if (why) return { ok: false, msg: why };
      z.ordre = false;
      if (this.firstZF === zsId) this.firstZF = null;
      z.das.forEach(id => {
        const d = this.das[id];
        d.ordered = false; d.defaut = false;
        if (d.state !== 'PA' && d.remote && this.hasPower() && !d.fault) { d.state = 'TR'; d.t = DAS_TRANSIT[d.kind] || 4; d.back = true; }
      });
      this.flag('zsReset:' + zsId);
      this.journal('Réarmement ' + zsId + ' (' + by + ')', 'ok');
      const local = z.das.map(id => this.das[id]).filter(d => !d.remote && d.state === 'PS');
      if (local.length) this.explain('🔧 ' + this.zsName(zsId) + ' réarmée. ' + local.length + ' DAS ne se réarme(nt) pas à distance (' + [...new Set(local.map(d => d.label))].join(', ') + ') : il faut aller les remettre en position d\'attente sur place. Clique dessus dans le bâtiment.', 'tip');
      else this.explain('🔧 ' + this.zsName(zsId) + ' réarmée : les DAS motorisés retournent en position d\'attente.', 'ok');
      return { ok: true };
    }

    /* ------------------------------ DAS ------------------------------- */
    stepDas(dt) {
      const noPower = !this.hasPower();
      Object.values(this.das).forEach(d => {
        // sécurité positive : un DAS à rupture de courant passe en sécurité sans énergie
        if (noPower && d.energy === 'rupture' && d.state === 'PA' && !d.fault) {
          if (!(d.kind === 'door' && this.openings[d.ref].wedged)) { d.state = 'TR'; d.t = DAS_TRANSIT[d.kind] || 3; d.fromPower = true; }
        }
        if (d.ordered && d.state === 'PA') {
          const blocked = d.fault === 'bloque' || (d.kind === 'door' && this.openings[d.ref].wedged);
          if (!blocked && (this.hasPower() || d.energy === 'rupture')) { d.state = 'TR'; d.t = DAS_TRANSIT[d.kind] || 4; d.back = false; }
          if (blocked && this.t - d.orderT > 12) {
            if (!d.defaut) {
              d.defaut = true;
              if (d.posCtl) this.journal('Défaut de position de sécurité : ' + d.label + ' (' + d.id + ')', 'warn');
              if (d.kind === 'door') this.explain('🚪 La porte ' + d.ref + ' ne s\'est pas fermée : elle est calée ou bloquée. Cette porte n\'a pas de contrôle de position : le CMSI ne signale AUCUN défaut. Seule une ronde permet de le voir. Le compartimentage est rompu.', 'warn', 'doorwedge_' + d.ref);
              else this.explain('⚠️ ' + d.label + ' n\'a pas atteint sa position de sécurité. Grâce au contrôle de position, le CMSI affiche un DÉFAUT sur ' + this.zsName(d.zs) + '.', 'warn', 'dasfault_' + d.id);
            }
          }
        }
        if (d.state === 'TR') {
          d.t -= dt;
          if (d.t <= 0) {
            d.state = d.back ? 'PA' : 'PS';
            if (d.kind === 'door') {
              const o = this.openings[d.ref];
              o.open = d.state === 'PA';
            }
            if (d.kind === 'cta' && this.cta) this.cta.on = d.state === 'PA';
          }
        }
        if (d.kind === 'door' && d.state === 'TR' && !d.back) this.openings[d.ref].open = false;
      });
    }

    localResetDas(dasId) {
      const d = this.das[dasId];
      if (!d) return { ok: false, msg: 'DAS inconnu' };
      if (d.state !== 'PS') return { ok: false, msg: 'Ce DAS est déjà en position d\'attente.' };
      if (d.ordered) return { ok: false, msg: 'L\'ordre de mise en sécurité est toujours actif. Réarme d\'abord la zone au CMSI.' };
      if (d.energy === 'rupture' && !this.hasPower()) return { ok: false, msg: 'Pas d\'alimentation : la ventouse ne peut pas retenir la porte.' };
      d.state = 'PA';
      if (d.kind === 'door') this.openings[d.ref].open = true;
      if (d.kind === 'cta' && this.cta) this.cta.on = true;
      this.journal('Réarmement local : ' + d.label + ' (' + (d.ref || d.id) + ')', 'ok');
      this.flag('localReset:' + d.id);
      return { ok: true };
    }

    /* --------------------------- VENTILATEURS ------------------------- */
    stepFans(dt) {
      Object.values(this.fans).forEach(f => {
        const zf = f.def.zfs.find(z => this.zs[z] && this.zs[z].ordre);
        let want = false;
        if (zf) {
          const volets = this.zs[zf].das.map(id => this.das[id]).filter(d => d.kind === (f.def.role === 'extraction' ? 'VD' : 'VA'));
          const ready = volets.some(d => d.state === 'PS');
          if (ready) { if (f.startT === null) f.startT = this.t; } else f.startT = null;
          want = ready && this.t - f.startT >= 5;
        } else f.startT = null;
        const prev = f.run;
        f.run = want && !f.pompier && !f.fault && this.hasPower();
        if (want && f.fault && !f.faultSaid) {
          f.faultSaid = true;
          this.journal('Défaut ' + f.def.name, 'warn');
          this.explain('⚠️ ' + f.def.name + ' est en panne : il ne démarre pas. Le CMSI signale le défaut. ' + (f.def.role === 'soufflage' ? 'Sans soufflage, l\'extraction met la circulation en dépression et perd en efficacité.' : 'Sans extraction, la circulation ne se désenfume pas.'), 'warn');
        }
        if (f.run && !prev) { this.journal(f.def.name + ' en marche (' + zf + ')', 'cmd'); }
        if (!f.run && prev) { this.journal(f.def.name + ' à l\'arrêt', 'info'); }
      });
    }

    setPompier(fanId, on) {
      const f = this.fans[fanId];
      if (!f) return;
      f.pompier = on;
      this.flag((on ? 'pompier:' : 'pompierOff:') + fanId);
      this.journal((on ? 'Arrêt pompiers : ' : 'Remise en marche autorisée : ') + f.def.name, on ? 'warn' : 'ok');
      if (on) this.explain('🧑‍🚒 « Arrêt pompiers » sur ' + f.def.name + ' : le ventilateur s\'arrête même si la zone reste en sécurité. Les secours l\'utilisent par exemple pour ne pas attiser le feu pendant l\'attaque.', 'cmd');
    }

    /* -------------------------------- UGA ----------------------------- */
    ugaTrigger(src) {
      const u = this.uga;
      const tempo = this.b.tempo;
      if (u.state === 'veille' || u.state === 'arretProcessus') {
        if (tempo > 0 && (src === 'DI' || this.b.dmTempo)) {
          u.state = 'tempo'; u.remain = tempo; u.buzzer = true; u.src = src;
          this.journal('UGA : processus d\'alarme lancé — temporisation ' + Math.round(tempo / 60) + ' min', 'alarm');
          this.explain('⏳ Le processus d\'alarme démarre : temporisation de ' + Math.round(tempo / 60) + ' min (5 min maximum). Pendant ce temps, le personnel fait la LEVÉE DE DOUTE. Sans action, l\'alarme générale d\'évacuation partira automatiquement à la fin du décompte.', 'alarm');
        } else this.startAG(src === 'DM' ? 'déclencheur manuel' : 'automatique');
      } else if (u.state === 'tempo' && src === 'DM' && !this.b.dmTempo) this.startAG('déclencheur manuel');
    }

    startAG(why) {
      const u = this.uga;
      if (u.state === 'ag') return;
      if (u.veilleRestreinte && why !== 'commande manuelle') {
        u.state = 'bloquee';
        this.journal('UGA en VEILLE RESTREINTE : alarme générale non diffusée', 'warn');
        this.explain('🚫 L\'UGA est en veille restreinte : l\'alarme générale ne part PAS automatiquement ! Seule une commande manuelle peut la lancer. En présence du public, c\'est un motif d\'avis défavorable.', 'warn');
        return;
      }
      u.state = 'ag'; u.agT = this.t; u.buzzer = false;
      this.flag(why === 'commande manuelle' ? 'agManual' : 'agAuto');
      this.flag('ag');
      this.journal('ALARME GÉNÉRALE D\'ÉVACUATION (' + why + ')', 'alarm');
      this.explain('📢 Alarme générale : les diffuseurs sonores et lumineux émettent le signal d\'évacuation (son normalisé NF S 32-001). Les occupants évacuent. Les issues de secours verrouillées se déverrouillent.', 'alarm');
      this.emit('ag', true);
      this.unlockExits('alarme générale');
      if (this.b.category === 'C') {
        this.explain('🔗 En catégorie C, un contact de l\'UGA 2 commande la fermeture des portes asservies au déclenchement de l\'alarme générale.', 'cmd');
        this.command('ZC1', 'UGA 2 (alarme générale)');
      }
    }

    stepUga(dt) {
      const u = this.uga;
      if (u.state === 'tempo') {
        u.remain -= dt;
        if (u.remain <= 0) { u.remain = 0; this.startAG('fin de temporisation'); }
      }
    }

    ugaStopProcess() {
      if (this.uga.state !== 'tempo') return { ok: false, msg: 'Aucun processus d\'alarme en cours.' };
      this.uga.state = 'arretProcessus'; this.uga.buzzer = false;
      this.flag('processStopped');
      this.journal('UGA : processus d\'alarme ARRÊTÉ par l\'opérateur', 'warn');
      this.explain('✋ Le processus d\'alarme est interrompu : l\'évacuation n\'aura pas lieu. À ne faire QUE si la levée de doute prouve qu\'il n\'y a pas de feu.', 'warn');
      return { ok: true };
    }

    ugaStopAG() {
      if (this.uga.state !== 'ag') return { ok: false, msg: 'Pas d\'alarme générale en cours.' };
      this.uga.state = 'arretAG';
      this.flag('agStopped');
      this.journal('Arrêt du signal d\'alarme générale', 'info');
      this.emit('ag', false);
      return { ok: true };
    }

    ugaReset() {
      const fire = Object.values(this.zd).find(z => z.feu);
      if (fire) return { ok: false, msg: 'La zone ' + fire.def.id + ' est toujours en alarme feu. Réarme d\'abord l\'ECS.' };
      if (this.b.category === 'C' && Object.values(this.devices).some(d => d.def.type === 'DM' && d.state === 'actionne')) return { ok: false, msg: 'Un déclencheur manuel est encore actionné. Réarme-le avec sa clé.' };
      if (this.uga.state === 'ag') this.emit('ag', false);
      this.uga.state = 'veille'; this.uga.buzzer = false; this.uga.remain = 0;
      Object.values(this.openings).forEach(o => { if (o.def.locked) o.locked = true; });
      this.flag('ugaReset');
      this.journal('UGA réarmée — retour en veille', 'ok');
      return { ok: true };
    }

    unlockExits(why) {
      let n = 0;
      Object.values(this.openings).forEach(o => { if (o.def.locked && o.locked) { o.locked = false; n++; } });
      if (n) {
        this.journal('Déverrouillage des issues de secours (' + why + ')', 'cmd');
        this.explain('🟩 Les ' + n + ' issues de secours verrouillées sont déverrouillées (' + why + ').' + (why.includes('EA 1') ? ' Avec un équipement d\'alarme de type 1, c\'est immédiat dès la détection, sans attendre la fin de la temporisation.' : ''), 'cmd');
      }
    }

    /* -------------------------------- ECS ----------------------------- */
    ecsAck() {
      if (!this.ecs.buzzer && !this.uga.buzzer) return;
      this.ecs.buzzer = false; this.ecs.ack = true;
      this.flag('ecsAck');
      this.journal('Arrêt du signal sonore (buzzer)', 'info');
      this.explain('🔕 Buzzer arrêté. Attention : arrêter le buzzer ne règle rien ! L\'alarme feu reste affichée et la temporisation continue. Lis la zone sur l\'afficheur et lance la levée de doute.', 'tip', 'ack_tip');
    }

    ecsReset() {
      const fires = Object.values(this.zd).filter(z => z.feu);
      if (!fires.length && !this.ecs.events.length) return { ok: false, msg: 'Aucune alarme à réarmer.' };
      const still = [];
      // les DI encore sollicités repartent en alarme
      Object.values(this.devices).forEach(d => {
        if (d.def.type === 'DI' && d.state === 'alarme') {
          const r = this.rooms[d.def.room];
          const sensing = r.s >= DI_SEUIL * 0.8 || d.test || d.fault === 'encrasse';
          const zoneHs = d.def.zd && this.zd[d.def.zd] && this.zd[d.def.zd].hs;
          if (sensing && !zoneHs) still.push(d);  else { d.state = 'veille'; d.t = 0; }
        }
      });
      const dms = Object.values(this.devices).filter(d => d.def.type === 'DM' && d.state === 'actionne');
      fires.forEach(z => { z.feu = false; z.first = null; });
      this.ecs.events = []; this.ecs.buzzer = false;
      this.journal('Réarmement de l\'ECS', 'ok');
      if (dms.length || still.length) {
        still.forEach(d => this.diAlarm(d));
        dms.forEach(d => this.zoneFire(d.def.zd, 'DM', d));
        this.explain('🔁 Réarmement refusé en pratique : ' + (dms.length ? 'un déclencheur manuel est toujours actionné (il faut le réarmer avec sa clé). ' : '') + (still.length ? 'un détecteur voit encore de la fumée. ' : '') + 'L\'alarme revient aussitôt. La cause doit avoir disparu avant le réarmement.', 'warn');
        return { ok: false, msg: 'L\'alarme est revenue : la cause est toujours présente.' };
      }
      this.flag('ecsReset');
      this.explain('✅ ECS réarmé : les détecteurs repassent en veille. Tu peux maintenant réarmer les zones de mise en sécurité au CMSI, puis l\'UGA.', 'ok', 'ecsreset_tip');
      return { ok: true };
    }

    setZdHs(zdId, hs) {
      const z = this.zd[zdId];
      if (!z) return;
      z.hs = hs;
      if (hs) this.flag('zdHs:' + zdId);
      this.journal((hs ? 'Mise hors service ' : 'Remise en service ') + zdId, 'warn');
      if (hs) this.explain('🟨 ' + zdId + ' mise hors service : ses détecteurs ne déclencheront plus rien. Le voyant « Hors service » reste allumé à l\'ECS.', 'warn');
    }

    /* ----------------------- ACTIONS DANS LE BÂTIMENT ----------------- */
    pressDM(id) {
      const d = this.devices[id];
      if (!d || d.state === 'actionne') return;
      d.state = 'actionne';
      this.flag('dmPressed');
      this.journal('Déclencheur manuel actionné : ' + id + ' — ' + this.roomName(d.def.room), 'alarm');
      if (this.b.category === 'C') {
        this.explain('🟥 Un déclencheur manuel est actionné. En catégorie C, il est relié à l\'UGA 2 qui lance immédiatement l\'alarme générale. L\'UGA 2 ne dit pas QUEL déclencheur a été actionné : il faut chercher la vitre brisée.', 'detect');
        this.ugaTrigger('DM');
        return;
      }
      this.zoneFire(d.def.zd, 'DM', d);
    }
    resetDM(id) {
      const d = this.devices[id];
      if (!d || d.state !== 'actionne') return;
      d.state = 'veille';
      this.journal('Réarmement du déclencheur manuel ' + id + ' (clé)', 'ok');
      this.flag('dmReset');
    }
    pressDMV(id) {
      const d = this.devices[id];
      const o = this.openings[d.def.opening];
      if (!o) return;
      o.locked = false;
      this.journal('DM vert actionné : déverrouillage local de ' + o.def.id, 'cmd');
      this.explain('🟩 Le déclencheur manuel vert coupe l\'alimentation de la ventouse de l\'issue de secours : la porte se déverrouille immédiatement, sans déclencher l\'alarme feu.', 'tip', 'dmv');
    }
    pressDCM(id) {
      const d = this.devices[id];
      if (!d || d.state === 'actionne') return;
      d.state = 'actionne';
      this.flag('dcm:' + id);
      this.journal('Commande manuelle actionnée : ' + d.def.label, 'cmd');
      this.explain('🟨 Dispositif de commande manuelle (DCM) actionné sur place : ' + d.def.label + '. Il envoie l\'ordre de mise en sécurité aux DAS de sa zone, comme le ferait le CMSI.', 'cmd');
      d.def.zs.forEach(z => this.command(z, 'DCM ' + id));
    }
    resetDCM(id) {
      const d = this.devices[id];
      if (!d || d.state !== 'actionne') return;
      d.state = 'veille';
      this.journal('Réarmement du DCM ' + id, 'ok');
      if (this.b.category !== 'A') d.def.zs.forEach(z => this.resetZs(z, 'DCM local'));
      else this.explain('🔧 DCM réarmé. Pense à réarmer aussi la zone ' + d.def.zs.join(', ') + ' au CMSI.', 'tip');
    }
    toggleDoor(id) {
      const o = this.openings[id];
      if (!o) return;
      if (o.def.locked && o.locked && !o.open) return { ok: false, msg: 'Issue de secours verrouillée. Utilise le déclencheur manuel vert à côté.' };
      if (o.das && o.das.state === 'PS' && !o.open && !o.das.ordered) {
        return this.localResetDas(o.das.id);
      }
      o.open = !o.open;
      if (o.das && !o.open && o.das.state === 'PA') { o.das.state = 'PS'; }
      this.journal((o.open ? 'Ouverture' : 'Fermeture') + ' manuelle de la porte ' + id, 'info');
      return { ok: true };
    }
    wedgeDoor(id, on) {
      const o = this.openings[id];
      if (!o) return;
      o.wedged = on;
      if (on) o.open = true;
      if (!on) { this.flag('unwedge'); this.explain('✅ Cale retirée : la porte peut à nouveau se fermer. Si l\'ordre de compartimentage est toujours actif, elle se ferme maintenant.', 'ok'); }
      this.journal((on ? 'Porte calée : ' : 'Cale retirée : ') + id, 'warn');
    }
    testDI(id) {
      const d = this.devices[id];
      d.test = true;
      d.testUntil = this.t + 8;
      this.journal('Essai aérosol sur ' + id, 'info');
      this.explain('🧪 Essai au générateur d\'aérosol : on simule de la fumée sur le détecteur ' + id + '. Il doit passer en alarme et l\'ECS doit afficher la bonne zone.', 'tip', 'aerosol');
    }

    callFiremen() {
      if (this.firemen.called !== null) return;
      this.firemen.called = this.t;
      this.firemen.arrive = this.t + 480;
      this.flag('called18');
      this.journal('Appel des sapeurs-pompiers (18 / 112)', 'alarm');
      this.explain('☎️ Les secours sont appelés. Arrivée estimée dans 8 minutes. Prépare l\'accueil : point de rassemblement, plans, accès, état du SSI.', 'tip');
    }

    sendAgent(roomId) {
      if (this.agent && !this.agent.done) return { ok: false, msg: 'Un agent est déjà en reconnaissance.' };
      const r = this.rooms[roomId];
      const dist = 20 + r.level * 15;
      this.agent = { room: roomId, eta: this.t + dist, done: false };
      this.flag('agentSent');
      this.journal('Agent envoyé en levée de doute : ' + this.roomName(roomId), 'info');
      return { ok: true, eta: dist };
    }

    stepAgents() {
      const a = this.agent;
      if (a && !a.done && this.t >= a.eta) {
        a.done = true;
        const r = this.rooms[a.room];
        let msg;
        if (r.fire && r.fire.stage !== 'éteint') { msg = 'FEU CONFIRMÉ dans ' + this.roomName(a.room) + ' (' + (r.fire.Q < 250 ? 'feu naissant' : r.fire.Q < 1000 ? 'feu bien installé' : 'feu violent') + ')'; this.flag('fireConfirmed'); a.fire = true; }
        else if (r.s > 0.07) { msg = 'Fumée sans feu visible dans ' + this.roomName(a.room); this.flag('smokeOnly'); }
        else { msg = 'Rien à signaler dans ' + this.roomName(a.room) + ' : pas de fumée, pas de feu'; this.flag('noFire'); a.fire = false; }
        this.flag('agentReport');
        this.journal('Levée de doute : ' + msg, a.fire ? 'fire' : 'ok');
        this.emit('agent', { msg, fire: a.fire, room: a.room });
      }
      // arrivée des secours
      const fm = this.firemen;
      if (fm.arrive !== null && !fm.onSite && this.t >= fm.arrive) {
        fm.onSite = true;
        this.flag('firemenOnSite');
        this.journal('Arrivée des sapeurs-pompiers', 'ok');
        this.explain('🚒 Les sapeurs-pompiers arrivent et attaquent le feu. Ils peuvent te demander l\'état du SSI, l\'arrêt d\'un ventilateur (arrêt pompiers) ou la commande d\'une zone de désenfumage.', 'ok');
        Object.values(this.rooms).forEach(r => { if (r.fire && r.fire.stage !== 'éteint') r.fire.attack = 'sapeurs-pompiers'; });
      }
    }

    agentExtinguisher() {
      const a = this.agent;
      if (!a || !a.done || !a.fire) return { ok: false, msg: 'L\'agent doit d\'abord avoir trouvé le feu.' };
      const r = this.rooms[a.room];
      if (!r.fire || r.fire.stage === 'éteint') return { ok: false, msg: 'Le feu est déjà éteint.' };
      this.flag('extinguisherTried');
      if (r.fire.Q < 250) {
        r.fire.attack = 'extincteur';
        this.flag('extinguisherOk');
        this.journal('Attaque du feu à l\'extincteur : efficace', 'ok');
        this.explain('🧯 Feu naissant : l\'extincteur suffit. C\'est tout l\'intérêt d\'une détection précoce et d\'une levée de doute rapide.', 'ok');
        return { ok: true };
      }
      this.journal('Attaque à l\'extincteur : feu trop développé, l\'agent se replie', 'warn');
      this.explain('🧯 Le feu est trop développé (' + Math.round(r.fire.Q) + ' kW) pour un extincteur. L\'agent referme la porte du local et se replie : fermer la porte limite l\'apport d\'air et la propagation.', 'warn');
      Object.values(this.openings).forEach(o => { if ((o.def.a === a.room || o.def.b === a.room) && o.def.kind === 'door') o.open = false; });
      return { ok: false, msg: 'Feu trop développé : l\'agent referme la porte et se replie.' };
    }

    /* ---------------------------- OCCUPANTS --------------------------- */
    exitPathSmoke(r) {
      // fumée sur le chemin : circulation desservant le local + meilleur escalier
      let corr = 0;
      if (r.def.kind === 'local') {
        Object.values(this.openings).forEach(o => {
          const other = o.def.a === r.def.id ? o.def.b : o.def.b === r.def.id ? o.def.a : null;
          if (other && other !== 'EXT' && this.rooms[other] && ['circ', 'hall'].includes(this.rooms[other].def.kind)) corr = Math.max(corr, this.rooms[other].s);
        });
      } else corr = r.s;
      if (r.level > 0) {
        const stairs = Object.values(this.rooms).filter(x => x.level === r.level && x.def.kind === 'stair');
        if (stairs.length) corr = Math.max(corr, Math.min(...stairs.map(s => s.s)));
      }
      return corr;
    }

    stepOccupants(dt) {
      const ag = this.uga.state === 'ag' || this.uga.state === 'arretAG';
      const exitsLocked = this.b.ugcis && Object.values(this.openings).every(o => !o.def.locked || o.locked);
      Object.values(this.rooms).forEach(r => {
        if (r.occ <= 0) return;
        const alerted = ag || r.s > 0.2 || (r.fire && r.fire.Q > 40 && r.fire.stage !== 'éteint');
        if (!alerted) return;
        if (r.evacStart === null) r.evacStart = this.t + 15 + ((r.def.id.length * 7) % 45);
        if (this.t < r.evacStart) return;
        const path = this.exitPathSmoke(r);
        r.blocked = path > 0.55 && r.def.kind === 'local';
        if (r.blocked) {
          this.explain('🧍 Des occupants de ' + this.roomName(r.def.id) + ' ne peuvent plus évacuer : le chemin est enfumé. Ils restent dans leur local, porte fermée, en attendant les secours.', 'warn', 'blocked_' + r.def.id);
          return;
        }
        let rate = 0.6;
        if (exitsLocked && r.level === 0) {
          rate = 0.08;
          this.explain('🔒 Les issues de secours sont encore verrouillées : l\'évacuation du RDC est ralentie !', 'warn', 'exitslocked');
        }
        const out = Math.min(r.occ, rate * dt);
        r.occ -= out; r.evac += out;
      });
    }

    /* -------------------------- SIGNALISATIONS ------------------------ */
    stepSignals() {
      Object.values(this.zs).forEach(z => {
        const das = z.das.map(id => this.das[id]);
        const ctl = das.filter(d => d.posCtl);
        z.defaut = das.some(d => d.defaut && d.posCtl) || (z.def.kind === 'ZF' && Object.values(this.fans).some(f => f.fault && f.def.zfs.includes(z.def.id) && z.ordre));
        z.ps = z.ordre ? (ctl.length ? ctl.every(d => d.state === 'PS') : true) : (ctl.length > 0 && ctl.some(d => d.state === 'PS'));
        z.anyPS = das.some(d => d.state === 'PS');
      });
    }

    /* --------------------------- FORMATEUR ---------------------------- */
    setFault(kind, id, value) {
      if (kind === 'das') { const d = this.das[id]; if (d) d.fault = value; }
      if (kind === 'di') { const d = this.devices[id]; if (d) d.fault = value; }
      if (kind === 'fan') { const f = this.fans[id]; if (f) { f.fault = value; f.faultSaid = false; } }
      if (kind === 'secteur') {
        this.power.secteur = !value;
        this.journal(value ? 'Coupure de l\'alimentation secteur' : 'Retour secteur', 'warn');
        if (value) this.explain('🔋 Coupure secteur : l\'ECS et le CMSI passent sur leurs batteries. Le voyant « Défaut alimentation » s\'allume. Le système reste opérationnel.', 'warn');
      }
      if (kind === 'aes') {
        this.power.aes = !value;
        this.journal(value ? 'Coupure de l\'alimentation de sécurité (AES)' : 'Retour AES', 'warn');
        if (value && !this.power.secteur) this.explain('⚡ Plus aucune énergie : les DAS à rupture de courant (portes sur ventouses) passent d\'eux-mêmes en position de sécurité. C\'est le principe de la SÉCURITÉ POSITIVE. Les DAS à émission de courant (volets, ouvrants) ne bougent plus.', 'warn');
      }
      if (kind === 'veilleRestreinte') {
        this.uga.veilleRestreinte = value;
        this.journal(value ? 'UGA placée en veille restreinte' : 'UGA en veille générale', 'warn');
      }
      if (kind === 'zs_hs') { const z = this.zs[id]; if (z) { z.hs = value; this.journal((value ? 'Mise HS ' : 'Remise en service ') + id, 'warn'); } }
    }

    /* ------------------------------- BILAN ---------------------------- */
    stats() {
      let occ0 = 0, evac = 0, inside = 0, danger = 0;
      Object.values(this.rooms).forEach(r => {
        occ0 += r.occ0; evac += r.evac; inside += r.occ;
        if (r.occ > 0 && r.s > 0.6) danger += r.occ;
      });
      return { occ0: Math.round(occ0), evac: Math.round(evac), inside: Math.round(inside), danger: Math.round(danger) };
    }
  }

  window.SSISim = Sim;
  window.SSIfmt = fmt;
})();

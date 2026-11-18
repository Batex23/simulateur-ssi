/* =====================================================================
   FAÇADE SSI — rendu réaliste
   Coffret fixé au mur, membranes imprimées, voyants, afficheur LCD,
   capots de protection, étiquettes de zones manuscrites.
   Le DOM est construit une fois, puis mis à jour à chaque image.
   ===================================================================== */
(function () {
  'use strict';
  const h = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };
  const CODE_N2 = '1234';

  // voyant + légende imprimée
  const led = (color, label, key, big) => `<div class="lp" data-led="${key}"><span class="led ${color}${big ? ' big' : ''}"></span><span class="lp-t">${label}</span></div>`;
  // touche membrane
  const key = (label, action, level = 1, cls = '', icon = '') =>
    `<button class="mk ${cls}" data-action="${action}" data-level="${level}"><span class="mk-i">${icon}</span><span class="mk-t">${label}</span>${level > 1 ? '<i class="lvl">N' + level + '</i>' : ''}</button>`;
  // bouton sous capot transparent (il faut soulever le capot)
  const covered = (label, action, level = 1, color = 'red', size = '') =>
    `<div class="guard ${size}"><button class="gbtn ${color}" data-action="${action}" data-level="${level}" data-guard="1"><span>${label}</span>${level > 1 ? '<i class="lvl">N' + level + '</i>' : ''}</button><span class="flap" aria-hidden="true"></span></div>`;
  const screws = '<i class="screw tl"></i><i class="screw tr"></i><i class="screw bl"></i><i class="screw br"></i>';

  class Panel {
    constructor(root, sim, ui) {
      this.root = root; this.sim = sim; this.ui = ui;
      this.selZd = null; this.code = '';
      this.build();
    }

    build() {
      const s = this.sim, b = s.b;
      this.root.innerHTML = '';
      const wall = h('div', 'ssi-wall');
      const cab = h('div', 'cab cat-' + b.category);
      const brand = { A: 'SSI de catégorie A · ' + b.ea, B: 'SSI de catégorie B · ' + b.ea, C: 'SSI de catégorie C · ' + b.ea, D: 'SSI de catégorie D · ' + b.ea, E: 'SSI de catégorie E · ' + b.ea }[b.category];
      cab.innerHTML = screws + `<div class="cab-brand"><b>SÉCURIS</b><span>${brand}</span><em>${b.category === 'A' || b.category === 'B' ? 'NF S 61-934 · NF S 61-935' : b.category === 'E' ? '' : 'NF S 61-936'}</em></div>`;
      const body = h('div', 'cab-body');
      if (b.category === 'A') { body.appendChild(this.buildECS()); body.appendChild(this.buildCMSI()); }
      else if (b.category === 'B') { body.appendChild(this.buildECS(true)); body.appendChild(this.buildCMSI()); }
      else if (b.category === 'C') { body.appendChild(this.buildUGA2()); body.appendChild(this.buildDCS()); }
      else if (b.category === 'D') { body.appendChild(this.buildUGA2('D')); body.appendChild(this.buildDCMR()); }
      else body.appendChild(this.buildNone());
      cab.appendChild(body);
      wall.appendChild(cab);
      if (b.category !== 'E') wall.appendChild(this.buildWallItems());
      this.root.appendChild(wall);
      this.root.onclick = e => this.onClick(e);
    }

    /* ------------------------------- ECS ------------------------------ */
    buildECS(catB) {
      const s = this.sim;
      const m = h('section', 'mod ecs');
      m.innerHTML = `
        <div class="mod-h"><b>${catB ? 'SIGNALISATION DES DÉCLENCHEURS MANUELS' : 'ÉQUIPEMENT DE CONTRÔLE ET DE SIGNALISATION'}</b><span>${catB ? 'intégrée au CMSI de type B' : 'ECS · détection incendie'}</span><button class="info" data-fiche="${catB ? 'CMSIB' : 'ECS'}" title="Comprendre">?</button></div>
        <div class="ecs-top">
          <div class="leds-col">
            ${led('green', 'SOUS TENSION', 'ecs.tension')}
            ${led('red', 'FEU', 'ecs.feu', true)}
            ${led('yellow', 'DÉRANGEMENT', 'ecs.dera')}
            ${led('yellow', 'HORS SERVICE', 'ecs.hs')}
            ${led('yellow', 'DÉFAUT ALIMENTATION', 'ecs.alim')}
          </div>
          <div class="lcd-bezel"><div class="lcd" data-lcd="ecs"><div class="lcd-line"></div><div class="lcd-line"></div><div class="lcd-line"></div><div class="lcd-line"></div></div></div>
        </div>
        <div class="ecs-keys">
          <div class="keyrow">
            ${key('ARRÊT SIGNAL SONORE', 'ecs.ack', 1, 'amber', '🔕')}
            ${key('RÉARMEMENT', 'ecs.reset', 2, '', '↺')}
            ${key('HS / ES ZONE', 'ecs.hs', 2, '', '⊘')}
            ${key('', 'ecs.prev', 1, 'arrow', '◀')}
            ${key('', 'ecs.next', 1, 'arrow', '▶')}
            ${key('TEST VOYANTS', 'test', 1, '', '◎')}
          </div>
          <div class="pad" aria-label="Clavier de code d'accès">
            <div class="pad-disp" data-code>ACCÈS N1</div>
            ${[1, 2, 3, 4, 5, 6, 7, 8, 9, 'C', 0, 'OK'].map(k => `<button class="pk${k === 'OK' ? ' ok' : k === 'C' ? ' clr' : ''}" data-pad="${k}">${k}</button>`).join('')}
          </div>
        </div>
        <div class="syn">
          <div class="syn-h"><span>ZONES DE DÉTECTION</span><span class="syn-leg"><i class="led red mini"></i>feu <i class="led yellow mini"></i>HS</span></div>
          <div class="syn-grid" data-zones></div>
        </div>`;
      const z = m.querySelector('[data-zones]');
      s.b.zd.forEach(zd => {
        const c = h('button', 'syn-z', `<span class="led red sm" data-zfeu="${zd.id}"></span><span class="led yellow sm" data-zhs="${zd.id}"></span><span class="tag"><b>${zd.id}</b> ${zd.name}</span>`);
        c.dataset.zd = zd.id;
        c.title = (zd.kind === 'ZDM' ? 'Zone de déclencheurs manuels' : 'Zone de détection automatique') + ' — cliquer pour sélectionner';
        z.appendChild(c);
      });
      return m;
    }

    /* ------------------------------- CMSI ----------------------------- */
    buildCMSI() {
      const s = this.sim, b = s.b;
      const m = h('section', 'mod cmsi');
      m.innerHTML = `
        <div class="mod-h red"><b>CENTRALISATEUR DE MISE EN SÉCURITÉ INCENDIE</b><span>CMSI de type ${b.category} · UGA · UCMC · US</span><button class="info" data-fiche="CMSI" title="Comprendre">?</button></div>
        <div class="cmsi-gen">
          ${led('green', 'SOUS TENSION', 'cmsi.tension')}
          ${led('yellow', 'DÉFAUT ALIM.', 'cmsi.alim')}
          ${led('yellow', 'DÉFAUT', 'cmsi.defaut')}
          ${led('yellow', 'HORS SERVICE', 'cmsi.hs')}
          ${led('yellow', 'VEILLE RESTREINTE', 'cmsi.vr')}
        </div>
        <div class="uga">
          <div class="uga-l">
            <div class="uga-t">UGA <small>unité de gestion d'alarme</small><button class="info" data-fiche="UGA">?</button></div>
            <div class="seg-wrap"><span class="seg-lab">TEMPORISATION</span><div class="seg" data-seg>--:--</div></div>
            <div class="uga-leds">
              ${led('red', 'PROCESSUS D\'ALARME', 'uga.tempo')}
              ${led('red', 'ALARME GÉNÉRALE', 'uga.ag')}
              ${led('yellow', 'ARRÊT ALARME', 'uga.arret')}
            </div>
          </div>
          <div class="uga-r">
            ${covered('ÉVACUATION<br>GÉNÉRALE', 'uga.ag', 1, 'red', 'big')}
            <div class="uga-keys">
              ${key('ARRÊT PROCESSUS', 'uga.stop', 2)}
              ${key('ARRÊT SIGNAL ÉVAC.', 'uga.stopag', 2)}
              ${key('RÉARMEMENT UGA', 'uga.reset', 2, '', '↺')}
            </div>
          </div>
        </div>
        <div class="ucmc-h"><span>UCMC · US</span><small>une colonne par zone de mise en sécurité</small></div>
        <div class="ucmc" data-zsrows></div>
        <div data-fans></div>
        <div class="cmsi-foot">${key('ARRÊT SIGNAL SONORE', 'cmsi.ack', 1, 'amber', '🔕')}${key('TEST VOYANTS', 'test', 1, '', '◎')}</div>`;
      const rows = m.querySelector('[data-zsrows]');
      b.zs.filter(z => z.kind !== 'ZA').forEach(z => rows.appendChild(this.zsModule(z)));
      const fans = m.querySelector('[data-fans]');
      if (Object.keys(s.fans).length) {
        fans.className = 'fanbar';
        fans.innerHTML = '<div class="ucmc-h"><span>VENTILATEURS DE DÉSENFUMAGE</span><button class="info" data-fiche="FAN">?</button></div><div class="ucmc"></div>';
        const g = fans.querySelector('.ucmc');
        Object.values(s.fans).forEach(f => {
          const c = h('div', 'zmod fan');
          c.innerHTML = `<div class="zlab"><b>${f.def.id}</b><span>${f.def.role}</span></div>
            ${led('green', 'MARCHE', 'fan.run:' + f.def.id)}${led('yellow', 'DÉFAUT', 'fan.def:' + f.def.id)}${led('yellow', 'ARRÊT POMP.', 'fan.pomp:' + f.def.id)}
            ${covered('ARRÊT<br>POMPIERS', 'fan.pomp:' + f.def.id, 2, 'amber')}`;
          g.appendChild(c);
        });
      }
      return m;
    }

    zsModule(z, opts = {}) {
      const c = h('div', 'zmod k-' + z.kind);
      c.dataset.zs = z.id;
      c.innerHTML = `<div class="zlab"><b>${z.id}</b><span>${z.name}</span>${z.manualOnly && !opts.noManual ? '<em>manuel</em>' : ''}</div>
        <div class="zleds">
          <div class="lp"><span class="led yellow" data-zps="${z.id}"></span><span class="lp-t">POSITION DE SÉCURITÉ</span></div>
          ${opts.noDef ? '' : `<div class="lp"><span class="led yellow" data-zdef="${z.id}"></span><span class="lp-t">DÉFAUT</span></div>`}
          ${opts.noHs ? '' : `<div class="lp"><span class="led yellow" data-zhs2="${z.id}"></span><span class="lp-t">HORS SERVICE</span></div>`}
        </div>
        ${covered('COMMANDE', 'zs.cmd:' + z.id, 1, 'red')}
        ${key('RÉARM.', 'zs.reset:' + z.id, opts.resetLevel || 2, 'small', '↺')}`;
      return c;
    }

    /* ------------------------ CATÉGORIES C ET D ----------------------- */
    buildUGA2(cat) {
      const D = cat === 'D';
      const m = h('section', 'mod ' + (D ? 'baas' : 'uga2'));
      m.innerHTML = `
        <div class="mod-h red"><b>${D ? 'BAAS Pr — BLOC AUTONOME D\'ALARME SONORE PRINCIPAL' : 'UGA 2 — UNITÉ DE GESTION D\'ALARME'}</b><span>équipement d'alarme ${this.sim.b.ea}</span><button class="info" data-fiche="${D ? 'BAASPR' : 'UGA2'}">?</button></div>
        <div class="uga2-body">
          <div class="uga-leds">
            ${led('green', 'SOUS TENSION', 'ecs.tension')}
            ${led('red', 'ALARME GÉNÉRALE', 'uga.ag', true)}
            ${led('yellow', 'ARRÊT ALARME', 'uga.arret')}
            ${led('yellow', 'DÉRANGEMENT', 'ecs.alim')}
          </div>
          ${covered('ALARME<br>GÉNÉRALE', 'uga.ag', 1, 'red', 'big')}
          <div class="uga-keys">${key('ARRÊT SIGNAL', 'uga.stopag', 2)}${key('RÉARMEMENT', 'uga.reset', 2, '', '↺')}</div>
        </div>
        <p class="printed">${D ? 'Reçoit les déclencheurs manuels et commande les BAAS satellites. N\'indique pas quel déclencheur a été actionné.' : 'Reçoit les déclencheurs manuels et diffuse l\'alarme générale. N\'indique pas quel déclencheur a été actionné.'}</p>`;
      return m;
    }
    buildDCS() {
      const m = h('section', 'mod cmsi');
      m.innerHTML = `
        <div class="mod-h"><b>DCS — DISPOSITIF CENTRALISÉ DE SÉCURITÉ</b><span>portes asservies</span><button class="info" data-fiche="DCS">?</button></div>
        <div class="ucmc" data-zsrows></div>
        <div class="ucmc-h"><span>REPORT DES DÉSENFUMAGES</span><small>commandés sur place, aux DCM jaunes</small></div>
        <div class="report-row">${this.sim.b.zs.filter(z => z.kind === 'ZF').map(z => `<div class="lp"><span class="led yellow" data-zps="${z.id}"></span><span class="lp-t"><b>${z.id}</b> ${z.name}</span></div>`).join('')}</div>`;
      m.querySelector('[data-zsrows]').appendChild(this.zsModule(this.sim.b.zs.find(z => z.id === 'ZC1'), { noHs: true }));
      return m;
    }
    buildDCMR() {
      const s = this.sim;
      const m = h('section', 'mod dcmr');
      m.innerHTML = `
        <div class="mod-h yellow"><b>DCMR — DISPOSITIF DE COMMANDE MANUELLE REGROUPÉ</b><span>près de l'entrée</span><button class="info" data-fiche="DCMR">?</button></div>
        <p class="printed">Aucune commande automatique. Abaisse le levier pour mettre la fonction en sécurité ; relève-le pour réarmer.</p>
        <div class="levers">${s.b.zs.filter(z => z.kind !== 'ZA').map(z => `
          <div class="lever-mod" data-zs="${z.id}">
            <div class="zlab"><b>${z.id}</b><span>${z.name}</span></div>
            <span class="led yellow" data-zps="${z.id}"></span>
            <button class="lever" data-action="lever:${z.id}" data-level="1" title="Commande / réarmement"><span class="lever-arm"></span></button>
            <div class="lever-legend"><span>ATTENTE</span><span>SÉCURITÉ</span></div>
          </div>`).join('')}</div>`;
      return m;
    }
    buildNone() {
      const m = h('section', 'mod none');
      m.innerHTML = `
        <div class="mod-h"><b>CATÉGORIE E — PAS DE MATÉRIEL CENTRAL</b><button class="info" data-fiche="CATE">?</button></div>
        <div class="none-wall">
          <div class="consigne">
            <h4>CONSIGNES EN CAS D'INCENDIE</h4>
            <ol><li>Donner l'alarme : <b>BAAS Ma</b> du hall ou de la grande salle.</li>
            <li>Appeler les sapeurs-pompiers : <b>18 / 112</b>.</li>
            <li>Désenfumer la grande salle : <b>DCM à treuil</b> du hall.</li>
            <li>Évacuer et rassembler sur le parking.</li></ol>
          </div>
          <div class="none-state"><span class="led red" data-led-ag></span><span>Alarme en cours dans le bâtiment<br><small>indication pour la formation, absente sur le terrain</small></span></div>
        </div>`;
      return m;
    }

    /* ------------------- objets du poste : clé, post-it ---------------- */
    buildWallItems() {
      const w = h('div', 'wall-items');
      w.innerHTML = `
        <div class="keyswitch"><button class="key" data-action="key" title="Clé de niveau d'accès"><span class="key-slot"><span class="key-head"></span></span></button>
          <div class="kl"><span class="pos1">1</span><span class="pos2">2</span></div><b data-keylevel>Niveau 1</b></div>
        <div class="postit">Code niveau 2<br><b>${CODE_N2.split('').join(' ')}</b><small>ou clé de l'armoire</small></div>
        <button class="registre" data-fiche="NIVEAUX" title="Niveaux d'accès">Registre de sécurité</button>`;
      return w;
    }

    /* ----------------------------- ACTIONS ---------------------------- */
    onClick(e) {
      const fiche = e.target.closest('[data-fiche]');
      if (fiche) { this.ui.showFiche(fiche.dataset.fiche); return; }
      const zb = e.target.closest('[data-zd]');
      if (zb) { this.selZd = this.selZd === zb.dataset.zd ? null : zb.dataset.zd; this.ui.sound.click(); return; }
      const pk = e.target.closest('[data-pad]');
      if (pk) { this.pad(pk.dataset.pad); return; }
      const b = e.target.closest('[data-action]');
      if (!b) return;
      const s = this.sim, a = b.dataset.action, lvl = +b.dataset.level || 1;
      this.ui.sound.unlock();
      // capot de protection : le premier clic le soulève
      const guard = b.closest('.guard');
      if (guard && !guard.classList.contains('open')) {
        guard.classList.add('open');
        this.ui.sound.click(0.6);
        clearTimeout(guard._t);
        guard._t = setTimeout(() => guard.classList.remove('open'), 6000);
        return;
      }
      if (lvl > s.access) {
        b.classList.remove('denied'); void b.offsetWidth; b.classList.add('denied');
        this.ui.sound.beep(false);
        this.ui.toast('Niveau d\'accès ' + lvl + ' requis : tourne la clé ou tape le code.', 'warn');
        return;
      }
      this.ui.sound.click();
      const res = this.run(a);
      if (guard) { clearTimeout(guard._t); guard._t = setTimeout(() => guard.classList.remove('open'), 1500); }
      if (res && res.msg) this.ui.toast(res.msg, res.ok ? 'ok' : 'warn');
      this.ui.press(b);
    }

    pad(k) {
      const s = this.sim;
      this.ui.sound.unlock(); this.ui.sound.click();
      if (k === 'C') this.code = '';
      else if (k === 'OK') {
        if (this.code === CODE_N2) { s.access = 2; s.journal('Code d\'accès niveau 2 saisi', 'info'); s.flag('level2'); this.ui.sound.beep(true); }
        else if (this.code) { this.ui.sound.beep(false); this.ui.toast('Code incorrect.', 'warn'); }
        else if (s.access === 2) { s.access = 1; s.journal('Retour au niveau d\'accès 1', 'info'); }
        this.code = '';
      } else if (this.code.length < 6) this.code += k;
      this.codeShown = performance.now();
    }

    run(a) {
      const s = this.sim;
      const [cmd, arg] = a.split(':');
      switch (cmd) {
        case 'key':
          s.access = s.access === 1 ? 2 : 1;
          s.journal('Clé : niveau d\'accès ' + s.access, 'info');
          if (s.access === 2) s.flag('level2');
          return null;
        case 'test': this.testUntil = performance.now() + 2500; return null;
        case 'ecs.prev': s.ecs.cursor = Math.max(0, s.ecs.cursor - 1); return null;
        case 'ecs.next': s.ecs.cursor = Math.min(Math.max(0, s.ecs.events.length - 1), s.ecs.cursor + 1); return null;
        case 'ecs.ack': s.ecsAck(); return null;
        case 'cmsi.ack': s.uga.buzzer = false; s.cmsi.buzzer = false; s.flag('ugaAck'); s.ecsAck(); return null;
        case 'ecs.reset': return s.ecsReset();
        case 'ecs.hs':
          if (!this.selZd) return { ok: false, msg: 'Sélectionne d\'abord une zone dans le synoptique, sous l\'afficheur.' };
          s.setZdHs(this.selZd, !s.zd[this.selZd].hs); return null;
        case 'uga.ag': s.flag('agManualAsk'); s.startAG('commande manuelle'); return null;
        case 'uga.stop': return s.ugaStopProcess();
        case 'uga.stopag': return s.ugaStopAG();
        case 'uga.reset': return s.ugaReset();
        case 'zs.cmd':
          if (s.zs[arg].ordre) return { ok: false, msg: arg + ' est déjà en sécurité.' };
          s.command(arg, 'commande manuelle UCMC'); s.flag('manualCmd:' + arg); return null;
        case 'zs.reset': return s.resetZs(arg);
        case 'lever':
          if (s.zs[arg].ordre) return s.resetZs(arg, 'DCMR');
          s.command(arg, 'DCMR'); s.flag('manualCmd:' + arg); return null;
        case 'fan.pomp': s.setPompier(arg, !s.fans[arg].pompier); return null;
      }
      return null;
    }

    /* --------------------------- MISE À JOUR -------------------------- */
    update(blink) {
      const s = this.sim, root = this.root;
      const test = !!(this.testUntil && performance.now() < this.testUntil);
      const set = (sel, on, fl) => root.querySelectorAll(sel).forEach(e => { e.classList.toggle('on', !!on || test); e.classList.toggle('blink', !!fl && !test); });
      const L = k => `[data-led="${k}"] .led`;
      const anyFeu = Object.values(s.zd).some(z => z.feu);
      const anyHs = Object.values(s.zd).some(z => z.hs);
      const diFault = Object.values(s.devices).some(d => d.def.type === 'DI' && d.fault === 'absent');
      const alim = !s.power.secteur;
      set(L('ecs.tension'), s.hasPower());
      set(L('ecs.feu'), anyFeu, anyFeu && !s.ecs.ack);
      set(L('ecs.dera'), diFault || alim || anyHs);
      set(L('ecs.hs'), anyHs);
      set(L('ecs.alim'), alim);
      s.b.zd.forEach(z => {
        set(`[data-zfeu="${z.id}"]`, s.zd[z.id].feu, s.zd[z.id].feu && !s.ecs.ack);
        set(`[data-zhs="${z.id}"]`, s.zd[z.id].hs);
      });
      root.querySelectorAll('[data-zd]').forEach(e => e.classList.toggle('sel', e.dataset.zd === this.selZd));

      // afficheur LCD
      const lcd = root.querySelector('[data-lcd="ecs"]');
      if (lcd) {
        const lines = lcd.querySelectorAll('.lcd-line');
        const ev = s.ecs.events;
        let t = [];
        if (ev.length) {
          const i = Math.min(s.ecs.cursor, ev.length - 1), e = ev[i], zd = s.zd[e.zd];
          t = [
            `FEU          ${String(i + 1).padStart(2, '0')}/${String(ev.length).padStart(2, '0')}   ${window.SSIfmt(e.t)}`,
            `${e.zd} ${zd.def.name}`.toUpperCase().slice(0, 32),
            `${e.type === 'DM' ? 'DM' : 'DI'} ${e.dev || ''} ${e.room ? s.rooms[e.room].def.name : ''}`.toUpperCase().slice(0, 32),
            s.ecs.ack ? 'ACQUITTÉ' : '>> ACQUITTER : ARRÊT SIGNAL SONORE'
          ];
        } else if (anyHs || diFault || alim) {
          const msgs = [];
          if (alim) msgs.push('DÉFAUT SECTEUR - SUR BATTERIE');
          Object.values(s.zd).filter(z => z.hs).forEach(z => msgs.push('HORS SERVICE ' + z.def.id));
          Object.values(s.devices).filter(d => d.def.type === 'DI' && d.fault === 'absent').forEach(d => msgs.push('DÉRANGEMENT ' + d.def.id));
          t = ['DÉRANGEMENT', ...msgs.slice(0, 3)];
        } else {
          t = ['SYSTÈME EN VEILLE', s.b.name.toUpperCase().slice(0, 32), 'AUCUNE ALARME', 'HEURE ' + window.SSIfmt(s.t) + '   NIVEAU ' + s.access];
        }
        if (this.selZd) t[3] = '> ZONE SÉLECTIONNÉE : ' + this.selZd;
        lines.forEach((l, i) => { l.textContent = t[i] || ''; });
        lcd.classList.toggle('alarm', !!ev.length);
        lcd.classList.toggle('flash', !!ev.length && !s.ecs.ack && blink);
      }
      const cd = root.querySelector('[data-code]');
      if (cd) {
        const typing = this.code && performance.now() - (this.codeShown || 0) < 8000;
        if (!typing && this.code) this.code = '';
        cd.textContent = this.code ? '*'.repeat(this.code.length) : 'ACCÈS N' + s.access;
        cd.classList.toggle('n2', s.access === 2);
      }

      // CMSI
      const zsDef = Object.values(s.zs).some(z => z.defaut);
      const zsHs = Object.values(s.zs).some(z => z.hs);
      const fanDef = Object.values(s.fans).some(f => f.fault);
      set(L('cmsi.tension'), s.hasPower());
      set(L('cmsi.alim'), alim || !s.power.aes);
      set(L('cmsi.defaut'), zsDef || fanDef, zsDef || fanDef);
      set(L('cmsi.hs'), zsHs);
      set(L('cmsi.vr'), s.uga.veilleRestreinte);
      const u = s.uga;
      set(L('uga.tempo'), u.state === 'tempo', u.state === 'tempo');
      set(L('uga.ag'), u.state === 'ag', u.state === 'ag');
      set(L('uga.arret'), u.state === 'arretAG' || u.state === 'arretProcessus' || u.state === 'bloquee');
      const seg = root.querySelector('[data-seg]');
      if (seg) {
        seg.textContent = u.state === 'tempo' ? window.SSIfmt(u.remain) : u.state === 'ag' ? 'EVAC' : u.state === 'bloquee' ? ' VR ' : '--:--';
        seg.classList.toggle('live', u.state === 'tempo' || u.state === 'ag');
      }
      Object.values(s.zs).forEach(z => {
        const id = z.def.id;
        set(`[data-zps="${id}"]`, z.ps, z.ordre && !z.ps);
        set(`[data-zdef="${id}"]`, z.defaut, z.defaut);
        set(`[data-zhs2="${id}"]`, z.hs);
        root.querySelectorAll(`[data-zs="${id}"]`).forEach(r => r.classList.toggle('active', z.ordre));
      });
      Object.values(s.fans).forEach(f => {
        set(L('fan.run:' + f.def.id), f.run);
        set(L('fan.def:' + f.def.id), !!f.fault, !!f.fault);
        set(L('fan.pomp:' + f.def.id), f.pompier);
        const bt = root.querySelector(`[data-action="fan.pomp:${f.def.id}"] span`);
        if (bt) bt.innerHTML = f.pompier ? 'REMISE<br>EN MARCHE' : 'ARRÊT<br>POMPIERS';
      });
      const nag = root.querySelector('[data-led-ag]');
      if (nag) { nag.classList.toggle('on', s.uga.state === 'ag'); nag.classList.toggle('blink', s.uga.state === 'ag'); }
      const lv = root.querySelector('[data-keylevel]');
      if (lv) lv.textContent = 'Niveau ' + s.access;
      const k = root.querySelector('.key');
      if (k) k.classList.toggle('turned', s.access === 2);
      root.classList.toggle('lvl2', s.access === 2);
    }
  }

  window.SSIPanel = Panel;
})();

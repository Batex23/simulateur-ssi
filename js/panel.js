/* =====================================================================
   FAÇADE SSI : ECS + CMSI (catégorie A) ou UGA 2 + DCS (catégorie C)
   Le DOM est construit une fois, puis mis à jour à chaque image.
   ===================================================================== */
(function () {
  'use strict';
  const h = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };
  const led = (color, label, key) => `<div class="led-cell" data-led="${key}"><span class="led ${color}"></span><span class="led-label">${label}</span></div>`;
  const btn = (label, action, level = 1, cls = '', extra = '') =>
    `<button class="pbtn ${cls}" data-action="${action}" data-level="${level}" ${extra}><span>${label}</span>${level > 1 ? '<i class="lvl" title="Niveau d\'accès ' + level + '">N' + level + '</i>' : ''}</button>`;

  class Panel {
    constructor(root, sim, ui) {
      this.root = root; this.sim = sim; this.ui = ui;
      this.selZd = null;
      this.build();
    }

    build() {
      const s = this.sim, b = s.b;
      this.root.innerHTML = '';
      const cab = h('div', 'cabinet');
      if (b.category === 'A') {
        cab.appendChild(this.buildECS());
        cab.appendChild(this.buildCMSI());
      } else if (b.category === 'B') {
        cab.appendChild(this.buildECS(true));
        cab.appendChild(this.buildCMSI());
      } else if (b.category === 'C') {
        cab.appendChild(this.buildUGA2());
        cab.appendChild(this.buildDCS());
      } else if (b.category === 'D') {
        cab.appendChild(this.buildUGA2('D'));
        cab.appendChild(this.buildDCMR());
      } else {
        cab.appendChild(this.buildNone());
      }
      if (b.category !== 'E') cab.appendChild(this.buildKey());
      this.root.appendChild(cab);
      this.root.onclick = e => this.onClick(e);
    }

    /* ---------------------------- ECS --------------------------------- */
    buildECS(catB) {
      const s = this.sim;
      const u = h('section', 'unit ecs');
      u.innerHTML = `
        <header class="plate">${catB ? '<b>CMSI B</b><span>Signalisation des zones de déclencheurs manuels (intégrée au CMSI de type B)</span><button class="info" data-fiche="CMSIB">?</button>' : '<b>ECS</b><span>Équipement de contrôle et de signalisation · système de détection incendie</span><button class="info" data-fiche="ECS">?</button>'}</header>
        <div class="leds-row">
          ${led('green', 'Sous tension', 'ecs.tension')}
          ${led('red', 'Feu', 'ecs.feu')}
          ${led('yellow', 'Dérangement', 'ecs.dera')}
          ${led('yellow', 'Hors service', 'ecs.hs')}
          ${led('yellow', 'Défaut alim.', 'ecs.alim')}
        </div>
        <div class="lcd" data-lcd="ecs"><div class="lcd-line"></div><div class="lcd-line"></div><div class="lcd-line"></div><div class="lcd-line"></div></div>
        <div class="keys">
          ${btn('◀', 'ecs.prev', 1, 'small')}
          ${btn('▶', 'ecs.next', 1, 'small')}
          ${btn('Arrêt signal sonore', 'ecs.ack', 1)}
          ${btn('Réarmement', 'ecs.reset', 2)}
          ${btn('Hors service / en service zone', 'ecs.hs', 2)}
        </div>
        <div class="zones" data-zones></div>`;
      const z = u.querySelector('[data-zones]');
      s.b.zd.forEach(zd => {
        const c = h('button', 'zone', `<span class="led red" data-zfeu="${zd.id}"></span><span class="led yellow" data-zhs="${zd.id}"></span><b>${zd.id}</b><small>${zd.name}</small>`);
        c.dataset.zd = zd.id;
        c.title = (zd.kind === 'ZDM' ? 'Zone de déclencheurs manuels' : 'Zone de détection automatique') + ' — cliquer pour sélectionner';
        z.appendChild(c);
      });
      return u;
    }

    /* ---------------------------- CMSI -------------------------------- */
    buildCMSI() {
      const s = this.sim, b = s.b;
      const u = h('section', 'unit cmsi');
      u.innerHTML = `
        <header class="plate"><b>CMSI</b><span>Centralisateur de mise en sécurité incendie${b.category === 'B' ? ' de type B' : ' de type A'} · ${b.ea}</span><button class="info" data-fiche="CMSI">?</button></header>
        <div class="leds-row">
          ${led('green', 'Sous tension', 'cmsi.tension')}
          ${led('yellow', 'Défaut alim.', 'cmsi.alim')}
          ${led('yellow', 'Défaut', 'cmsi.defaut')}
          ${led('yellow', 'Hors service', 'cmsi.hs')}
          ${led('yellow', 'Veille restreinte', 'cmsi.vr')}
        </div>
        <div class="uga">
          <div class="uga-title">UGA · évacuation <button class="info" data-fiche="UGA">?</button></div>
          <div class="uga-body">
            <div class="seg" data-seg>--:--</div>
            <div class="uga-leds">
              ${led('red', 'Processus d\'alarme', 'uga.tempo')}
              ${led('red', 'Alarme générale', 'uga.ag')}
              ${led('yellow', 'Arrêt alarme générale', 'uga.arret')}
            </div>
          </div>
          <div class="keys">
            ${btn('Évacuation générale', 'uga.ag', 1, 'cover red')}
            ${btn('Arrêt du processus', 'uga.stop', 2)}
            ${btn('Arrêt signal évacuation', 'uga.stopag', 2)}
            ${btn('Réarmement UGA', 'uga.reset', 2)}
          </div>
        </div>
        <div class="zs-table">
          <div class="zs-head"><span>Zone de mise en sécurité</span><span>PS</span><span>Déf.</span><span>HS</span><span>UCMC</span></div>
          <div data-zsrows></div>
        </div>
        <div data-fans></div>
        <div class="keys foot">
          ${btn('Arrêt signal sonore', 'cmsi.ack', 1)}
          ${btn('Test voyants', 'test', 1)}
        </div>`;
      const rows = u.querySelector('[data-zsrows]');
      b.zs.filter(z => z.kind !== 'ZA').forEach(z => {
        const r = h('div', 'zs-row');
        r.dataset.zs = z.id;
        r.innerHTML = `<span class="zs-name"><i class="zk ${z.kind}">${z.kind === 'ZC' ? 'compart.' : 'désenf.'}</i><b>${z.id}</b> ${z.name}${z.manualOnly ? ' <em>manuel</em>' : ''}</span>
          <span class="led yellow" data-zps="${z.id}"></span><span class="led yellow" data-zdef="${z.id}"></span><span class="led yellow" data-zhs2="${z.id}"></span>
          <span class="zs-btns">${btn('Commande', 'zs.cmd:' + z.id, 1, 'cover red small')}${btn('Réarmer', 'zs.reset:' + z.id, 2, 'small')}</span>`;
        rows.appendChild(r);
      });
      const fans = u.querySelector('[data-fans]');
      if (Object.keys(s.fans).length) {
        fans.className = 'fans';
        fans.innerHTML = '<div class="uga-title">Ventilateurs de désenfumage <button class="info" data-fiche="FAN">?</button></div>';
        Object.values(s.fans).forEach(f => {
          const r = h('div', 'fan-row');
          r.innerHTML = `<span class="zs-name"><b>${f.def.id}</b> ${f.def.role}</span>
            ${led('green', 'Marche', 'fan.run:' + f.def.id)}${led('yellow', 'Défaut', 'fan.def:' + f.def.id)}${led('yellow', 'Arrêt pompiers', 'fan.pomp:' + f.def.id)}
            ${btn('Arrêt pompiers', 'fan.pomp:' + f.def.id, 2, 'small amber')}`;
          fans.appendChild(r);
        });
      }
      return u;
    }

    /* ---------------------- CATÉGORIE C : UGA 2 + DCS ------------------- */
    buildUGA2(cat) {
      const u = h('section', 'unit ecs');
      const D = cat === 'D';
      u.innerHTML = `
        <header class="plate">${D ? '<b>BAAS Pr</b><span>Bloc autonome d\'alarme sonore principal · équipement d\'alarme ' + this.sim.b.ea + '</span><button class="info" data-fiche="BAASPR">?</button>' : '<b>UGA 2</b><span>Unité de gestion d\'alarme · équipement d\'alarme ' + this.sim.b.ea + '</span><button class="info" data-fiche="UGA2">?</button>'}</header>
        <div class="leds-row">
          ${led('green', 'Sous tension', 'ecs.tension')}
          ${led('red', 'Alarme générale', 'uga.ag')}
          ${led('yellow', 'Arrêt alarme', 'uga.arret')}
          ${led('yellow', 'Dérangement', 'ecs.alim')}
        </div>
        <p class="unit-note">${D ? 'Le BAAS Pr reçoit les déclencheurs manuels et commande les BAAS satellites (Sa) de tout le bâtiment. Il n\'indique pas quel déclencheur a été actionné.' : 'L\'UGA 2 reçoit les déclencheurs manuels et diffuse l\'alarme générale. Elle n\'indique pas quel déclencheur a été actionné.'}</p>
        <div class="keys">
          ${btn('Alarme générale', 'uga.ag', 1, 'cover red')}
          ${btn('Arrêt signal', 'uga.stopag', 2)}
          ${btn('Réarmement', 'uga.reset', 2)}
        </div>`;
      return u;
    }
    buildDCS() {
      const u = h('section', 'unit cmsi');
      u.innerHTML = `
        <header class="plate"><b>DCS</b><span>Dispositif centralisé de sécurité · portes asservies</span><button class="info" data-fiche="DCS">?</button></header>
        <div class="zs-table"><div class="zs-head"><span>Fonction</span><span>PS</span><span>Déf.</span><span></span><span>Commande</span></div>
          <div class="zs-row" data-zs="ZC1"><span class="zs-name"><i class="zk ZC">compart.</i><b>ZC1</b> Portes asservies</span>
            <span class="led yellow" data-zps="ZC1"></span><span class="led yellow" data-zdef="ZC1"></span><span></span>
            <span class="zs-btns">${btn('Commande', 'zs.cmd:ZC1', 1, 'cover red small')}${btn('Réarmer', 'zs.reset:ZC1', 2, 'small')}</span></div>
        </div>
        <p class="unit-note">Le désenfumage n'est pas piloté ici : il se commande sur place, avec les dispositifs de commande manuelle (DCM) jaunes du bâtiment.</p>
        <div class="zs-table"><div class="zs-head"><span>Désenfumage (report)</span><span>PS</span><span></span><span></span><span></span></div>
          ${this.sim.b.zs.filter(z => z.kind === 'ZF').map(z => `<div class="zs-row"><span class="zs-name"><i class="zk ZF">désenf.</i><b>${z.id}</b> ${z.name}</span><span class="led yellow" data-zps="${z.id}"></span><span></span><span></span><span></span></div>`).join('')}
        </div>`;
      return u;
    }

    buildDCMR() {
      const s = this.sim;
      const u = h('section', 'unit cmsi dcmr');
      u.innerHTML = `
        <header class="plate"><b>DCMR</b><span>Dispositif de commande manuelle regroupé · près de l'entrée</span><button class="info" data-fiche="DCMR">?</button></header>
        <p class="unit-note">Aucune commande automatique : c'est toi qui décides de fermer les portes et d'ouvrir le désenfumage. Chaque commande reste enclenchée jusqu'au réarmement.</p>
        <div class="zs-table"><div class="zs-head"><span>Fonction</span><span>Cmd</span><span></span><span></span><span>Commande</span></div>
        ${s.b.zs.filter(z => z.kind !== 'ZA').map(z => `<div class="zs-row" data-zs="${z.id}"><span class="zs-name"><i class="zk ${z.kind}">${z.kind === 'ZC' ? 'compart.' : 'désenf.'}</i><b>${z.id}</b> ${z.name}</span>
          <span class="led yellow" data-zps="${z.id}"></span><span></span><span></span>
          <span class="zs-btns">${btn('Commande', 'zs.cmd:' + z.id, 1, 'cover red small')}${btn('Réarmer', 'zs.reset:' + z.id, 1, 'small')}</span></div>`).join('')}
        </div>`;
      return u;
    }
    buildNone() {
      const u = h('section', 'unit none');
      u.innerHTML = `
        <header class="plate"><b>Catégorie E</b><span>Pas de matériel central</span><button class="info" data-fiche="CATE">?</button></header>
        <p class="unit-note">Dans un SSI de catégorie E, il n'y a aucun tableau à surveiller. Tout se passe dans le bâtiment :</p>
        <ul class="none-list">
          <li><b>Alarme</b> — bloc autonome d'alarme sonore manuel (BAAS Ma), dans le hall et la grande salle. On l'actionne sur place, on l'arrête avec sa clé.</li>
          <li><b>Désenfumage</b> — dispositif de commande manuelle (DCM à treuil) dans le hall : il ouvre les exutoires et l'amenée d'air de la grande salle.</li>
          <li><b>Compartimentage</b> — portes à ferme-porte, toujours fermées : rien à commander.</li>
        </ul>
        <div class="none-state"><span class="led red" data-led-ag></span><span>Alarme en cours dans le bâtiment (indication pour la formation, pas sur le terrain)</span></div>`;
      return u;
    }

    buildKey() {
      const k = h('div', 'keyswitch');
      k.innerHTML = `<button class="key" data-action="key" title="Clé de niveau d'accès"><span class="key-slot"><span class="key-head"></span></span></button>
        <div><b data-keylevel>Niveau 1</b><small>Clé : passer au niveau 2 (personnel habilité)</small></div>`;
      return k;
    }

    /* ---------------------------- ACTIONS ----------------------------- */
    onClick(e) {
      const fiche = e.target.closest('[data-fiche]');
      if (fiche) { this.ui.showFiche(fiche.dataset.fiche); return; }
      const zb = e.target.closest('[data-zd]');
      if (zb) { this.selZd = this.selZd === zb.dataset.zd ? null : zb.dataset.zd; return; }
      const b = e.target.closest('[data-action]');
      if (!b) return;
      const s = this.sim, a = b.dataset.action, lvl = +b.dataset.level || 1;
      this.ui.sound.unlock();
      if (lvl > s.access) {
        b.classList.remove('denied'); void b.offsetWidth; b.classList.add('denied');
        this.ui.toast('Niveau d\'accès ' + lvl + ' requis : tourne la clé.', 'warn');
        return;
      }
      const res = this.run(a);
      if (res && res.msg) this.ui.toast(res.msg, res.ok ? 'ok' : 'warn');
      this.ui.press(b);
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
          if (!this.selZd) return { ok: false, msg: 'Sélectionne d\'abord une zone dans la liste sous l\'afficheur.' };
          s.setZdHs(this.selZd, !s.zd[this.selZd].hs); return null;
        case 'uga.ag':
          s.flag('agManualAsk'); s.startAG('commande manuelle'); return null;
        case 'uga.stop': return s.ugaStopProcess();
        case 'uga.stopag': return s.ugaStopAG();
        case 'uga.reset': return s.ugaReset();
        case 'zs.cmd':
          if (s.zs[arg].ordre) return { ok: false, msg: arg + ' est déjà en sécurité.' };
          s.command(arg, 'commande manuelle UCMC'); s.flag('manualCmd:' + arg); return null;
        case 'zs.reset': return s.resetZs(arg);
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

      // afficheur
      const lcd = root.querySelector('[data-lcd="ecs"]');
      if (lcd) {
        const lines = lcd.querySelectorAll('.lcd-line');
        const ev = s.ecs.events;
        let t = [];
        if (ev.length) {
          const e = ev[Math.min(s.ecs.cursor, ev.length - 1)];
          const zd = s.zd[e.zd];
          t = [
            `ALARME FEU   ${Math.min(s.ecs.cursor, ev.length - 1) + 1}/${ev.length}`,
            `${e.zd}  ${zd.def.name}`.slice(0, 34),
            `${e.type === 'DM' ? 'DM' : 'DI'} ${e.dev || ''}`.slice(0, 34) + (e.room ? '  ' + s.rooms[e.room].def.name : ''),
            `${window.SSIfmt(e.t)}   ${s.ecs.ack ? 'ACQUITTÉ' : 'NON ACQUITTÉ'}`
          ];
        } else if (anyHs || diFault || alim) {
          const msgs = [];
          if (alim) msgs.push('DÉFAUT SECTEUR');
          Object.values(s.zd).filter(z => z.hs).forEach(z => msgs.push('HORS SERVICE ' + z.def.id));
          Object.values(s.devices).filter(d => d.def.type === 'DI' && d.fault === 'absent').forEach(d => msgs.push('DÉRANGEMENT ' + d.def.id));
          t = ['DÉRANGEMENT', ...msgs.slice(0, 3)];
        } else {
          t = ['VEILLE', this.sim.b.name.toUpperCase().slice(0, 30), 'Aucune alarme', window.SSIfmt(s.t)];
        }
        if (this.selZd) t[3] = '> Zone sélectionnée : ' + this.selZd;
        lines.forEach((l, i) => { l.textContent = t[i] || ''; });
        lcd.classList.toggle('alarm', !!ev.length && blink);
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
        seg.textContent = u.state === 'tempo' ? window.SSIfmt(u.remain) : u.state === 'ag' ? 'ÉVAC' : u.state === 'bloquee' ? 'VR' : '--:--';
        seg.classList.toggle('live', u.state === 'tempo' || u.state === 'ag');
      }
      Object.values(s.zs).forEach(z => {
        const id = z.def.id;
        set(`[data-zps="${id}"]`, z.ps, z.ordre && !z.ps);
        set(`[data-zdef="${id}"]`, z.defaut, z.defaut);
        set(`[data-zhs2="${id}"]`, z.hs);
        const row = root.querySelector(`[data-zs="${id}"]`);
        if (row) row.classList.toggle('active', z.ordre);
      });
      Object.values(s.fans).forEach(f => {
        set(L('fan.run:' + f.def.id), f.run);
        set(L('fan.def:' + f.def.id), !!f.fault, !!f.fault);
        set(L('fan.pomp:' + f.def.id), f.pompier);
        const bt = root.querySelector(`[data-action="fan.pomp:${f.def.id}"] span`);
        if (bt) bt.textContent = f.pompier ? 'Remise en marche' : 'Arrêt pompiers';
      });
      const nag = root.querySelector('[data-led-ag]');
      if (nag) { nag.classList.toggle('on', s.uga.state === 'ag'); nag.classList.toggle('blink', s.uga.state === 'ag'); }
      const lv = root.querySelector('[data-keylevel]');
      if (lv) lv.textContent = 'Niveau ' + s.access;
      const key = root.querySelector('.key');
      if (key) key.classList.toggle('turned', s.access === 2);
      root.classList.toggle('lvl2', s.access === 2);
    }
  }

  window.SSIPanel = Panel;
})();

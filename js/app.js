/* =====================================================================
   APPLICATION : accueil, boucle, menus contextuels, missions, formateur
   ===================================================================== */
(function () {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fmt = t => window.SSIfmt(t);
  const B = window.SSI_BUILDINGS, MIS = window.SSI_MISSIONS, FI = window.SSI_FICHES;

  /* ------------------------- PROGRESSION (navigateur) ------------------------- */
  const GRADES = [
    { min: 0, t: 'Agent de sécurité', s: 'SSIAP 1' },
    { min: 4, t: 'Chef d\'équipe', s: 'SSIAP 2' },
    { min: 10, t: 'Chef de service', s: 'SSIAP 3' },
    { min: 18, t: 'Préventionniste', s: 'PRV' }
  ];
  const Prog = {
    load() { try { return JSON.parse(localStorage.getItem('ssi-progress') || '{}'); } catch (e) { return {}; } },
    save(p) { try { localStorage.setItem('ssi-progress', JSON.stringify(p)); } catch (e) { /* stockage indisponible */ } },
    points(p) {
      const m = Object.values(p.missions || {}).reduce((a, x) => a + (x.stars || 0), 0);
      const c = Object.values(p.cds || {}).reduce((a, x) => a + (x.best || 0), 0);
      return m + c;
    },
    grade(pts) { let g = GRADES[0]; GRADES.forEach(x => { if (pts >= x.min) g = x; }); return g; },
    next(pts) { return GRADES.find(x => x.min > pts); }
  };
  const stars = n => '★★★'.slice(0, n) + '☆☆☆'.slice(0, 3 - n);

  const App = {
    sim: null, panel: null, plan: null, speed: 1, paused: false, trainer: false,
    sound: new window.SSISound(), mission: null, missionId: null, lastUi: 0, ended: false,

    /* ----------------------------- ACCUEIL --------------------------- */
    home() {
      const wrap = $('#buildings');
      wrap.innerHTML = '';
      B.forEach(b => {
        const card = document.createElement('article');
        card.className = 'bcard cat-' + b.category;
        const levels = b.levels.length;
        const sect = Array.from({ length: levels }, (_, i) => `<rect x="10" y="${8 + (levels - 1 - i) * 18}" width="${80 + (b.fans.length ? 0 : 0)}" height="16" rx="1"/>`).join('');
        const mis = (b.missions || []).map(id => MIS[id]).filter(Boolean);
        const prog = Prog.load();
        card.innerHTML = `
          <div class="bcard-top">
            <svg class="bsect" viewBox="0 0 100 ${levels * 18 + 14}" aria-hidden="true">${sect}${b.fans.length ? '<circle cx="78" cy="3" r="3"/><circle cx="88" cy="3" r="3"/>' : ''}<line x1="0" x2="100" y1="${levels * 18 + 8}" y2="${levels * 18 + 8}"/></svg>
            <div>
              <span class="badge-cat">SSI catégorie ${b.category}</span>
              <h2>${esc(b.name)}</h2>
              <p class="btype">${esc(b.type)} · ${esc(b.ea)}</p>
            </div>
          </div>
          <p class="bsum">${esc(b.summary)}</p>
          <ul class="bteach">${b.teaches.map(t => '<li>' + esc(t) + '</li>').join('')}</ul>
          <div class="bactions">
            <button class="go free" data-b="${b.id}">Mode libre</button>
            <button class="go cds" data-b="${b.id}" data-cds="1"><b>Essais en commission de sécurité</b><small>Anomalies cachées</small></button>
            ${mis.map(m => { const id = Object.keys(MIS).find(k => MIS[k] === m); const st = (prog.missions || {})[id]; return `<button class="go mis" data-b="${b.id}" data-m="${id}"><b>${esc(m.title)}</b><small>${esc(m.level)} <span class="stars${st ? ' got' : ''}">${stars(st ? st.stars : 0)}</span></small></button>`; }).join('')}
          </div>`;
        wrap.appendChild(card);
      });
      wrap.onclick = e => {
        const g = e.target.closest('.go');
        if (!g) return;
        this.sound.unlock();
        this.start(g.dataset.b, g.dataset.m || null, { cds: !!g.dataset.cds });
      };
      const st = $('#studentMode');
      try { st.checked = localStorage.getItem('ssi-student') === '1'; } catch (e) { /* stockage indisponible */ }
      st.onchange = () => { try { localStorage.setItem('ssi-student', st.checked ? '1' : '0'); } catch (e) { /* rien */ } };
      this.renderProgress();
      $('#home').hidden = false; $('#sim').hidden = true;
      document.title = 'Simulateur SSI';
    },

    renderProgress() {
      const p = Prog.load(), pts = Prog.points(p), g = Prog.grade(pts), nx = Prog.next(pts);
      const nMis = Object.keys(MIS).length, done = Object.values(p.missions || {}).filter(x => x.stars > 0).length;
      const visits = Object.values(p.cds || {}).reduce((a, x) => a + (x.visits || 0), 0);
      const box = $('#progress');
      if (!box) return;
      box.innerHTML = `<div class="badge-card"><div class="bc-strip"><span>${g.s}</span></div><div class="bc-body"><small>Carte de progression</small><b>${g.t}</b>
          <div class="bc-bar"><i style="width:${nx ? Math.round((pts - g.min) / (nx.min - g.min) * 100) : 100}%"></i></div>
          <span>${pts} point${pts > 1 ? 's' : ''}${nx ? ' · encore ' + (nx.min - pts) + ' pour « ' + nx.t + ' »' : ' · grade maximal'}</span></div></div>
        <div class="pg-stats"><div><b>${done}/${nMis}</b><span>missions réussies</span></div><div><b>${visits}</b><span>visites de commission</span></div></div>
        <p class="pg-note">1 à 3 étoiles par mission, 1 à 3 points par bâtiment en commission de sécurité. La progression reste dans ce navigateur.</p>`;
    },

    /* ---------------------------- DÉMARRAGE -------------------------- */
    start(bid, missionId, opts = {}) {
      const b = B.find(x => x.id === bid);
      this.missionId = missionId;
      this.startOpts = opts;
      this.cdsMode = !!opts.cds;
      this.student = $('#studentMode').checked;
      this.revealed = false;
      this.marks = {};
      this.pending = [];
      this.incident = null;
      this.truth = null;
      this.sim = new window.SSISim(b);
      const s = this.sim;
      this.ended = false;
      $('#home').hidden = true; $('#sim').hidden = false;
      $('[data-bname]').textContent = b.name;
      $('[data-btype]').textContent = b.type + ' · SSI cat. ' + b.category + ' · ' + b.ea;
      document.title = b.name + ' — Simulateur SSI';
      this.panel = new window.SSIPanel($('#panel'), s, this);
      this.plan = new window.SSIPlan($('#plan'), s, {
        onRoom: (id, ev) => this.roomMenu(id, ev),
        onDevice: (id, ev) => this.deviceMenu(id, ev),
        onOpening: (id, ev) => this.openingMenu(id, ev),
        onFan: (id, kind, ev) => this.fanMenu(id, kind, ev)
      });
      this.plan.marks = this.marks;
      this.plan.showFaults = this.trainer;
      this.plan.hidden = this.student;
      this.plan.setZones(this.student);
      $('[data-zonesbtn]').classList.toggle('on', this.student);
      $('[data-tb="reveal"]').hidden = !this.student;
      $('[data-tb="reveal"]').textContent = '👁 Révéler';
      document.body.classList.toggle('student', this.student);
      this.applyStudentDrawer();
      // puces de niveaux
      const chips = $('[data-levels]');
      chips.innerHTML = b.levels.map((l, i) => `<button data-li="${i}">${l.name}</button>`).reverse().join('');
      chips.onclick = e => { const c = e.target.closest('[data-li]'); if (c) this.plan.scrollToLevel(+c.dataset.li); };
      // journaux
      ['explain', 'log'].forEach(k => { $(`[data-body="${k}"]`).innerHTML = ''; });
      s.on('explain', e => this.addExplain(e));
      s.on('log', e => { if (!(e.secret && this.isHidden())) this.addLog(e); });
      s.on('agent', d => this.agentReport(d));
      s.on('request', txt => this.toast(txt, 'alarm', 9000));
      // la première alarme amène le plan sur le niveau concerné
      s.on('log', e => {
        if ((e.kind === 'fire' || e.kind === 'alarm') && !this._focused && !(e.secret && this.isHidden())) {
          const ev = s.ecs.events[0];
          const room = ev ? ev.room : this.isHidden() ? null : Object.keys(s.rooms).find(id => s.rooms[id].fire);
          if (room) { this._focused = true; this.plan.scrollToLevel(s.rooms[room].level); }
        }
      });
      this._focused = false;
      this.buildCorr();
      this.renderTrainer();
      this.setSpeed(1);
      this.addExplain({ time: '00:00', kind: 'info', text: 'Bienvenue dans ' + b.name + '. ' + b.summary + ' Clique sur un local pour y allumer un feu, ou sur un équipement pour l\'actionner.' });
      this.cds = null;
      if (this.cdsMode) {
        this.mission = null; s.mission = null;
        this.cds = window.SSI_CDS.setup(s);
        this.renderCds();
        this.paused = true;
        this.showCdsBrief();
      } else if (missionId) {
        const m = MIS[missionId];
        this.mission = m;
        s.mission = m;
        m.done = {}; m.failed = {};
        m.setup(s);
        this.paused = true;
        this.showBrief(m);
      } else {
        this.mission = null;
        $('#mission').hidden = true;
        if (this.student) { this.paused = true; this.showStudentBrief(); }
      }
      if (!this.cds) this.renderMission();
      if (!this.loopOn) { this.loopOn = true; this.last = performance.now(); requestAnimationFrame(t => this.loop(t)); }
    },

    /* ------------------------------ BOUCLE --------------------------- */
    loop(now) {
      const dt = Math.min(0.25, (now - this.last) / 1000);
      this.last = now;
      if (this.sim && !$('#sim').hidden) {
        if (!this.paused && this.speed > 0 && !this.ended) this.sim.advance(dt, this.speed);
        if (now - this.lastUi > 70) {
          this.lastUi = now;
          const blink = Math.floor(now / 380) % 2 === 0;
          this.panel.update(blink);
          this.plan.update(blink);
          $('[data-clock]').textContent = fmt(this.sim.t);
          const s = this.sim;
          this.sound.set(s.uga.state === 'ag', (s.ecs.buzzer || s.uga.buzzer) && !this.paused);
          $('[data-tb="call"]').classList.toggle('done', s.firemen.called !== null);
          if (this.mission) this.checkMission();
          if (this.cds) this.updateCds();
          this.pending = this.pending.filter(p => { if (s.t >= p.t) { p.run(); return false; } return true; });
          if (!$('[data-body="corr"]').hidden) this.updateCorr();
          if (!$('[data-body="occ"]').hidden) this.updateOcc();
          if (this.menuRefresh) this.menuRefresh();
        }
      } else this.sound.set(false, false);
      requestAnimationFrame(t => this.loop(t));
    },

    setSpeed(v) {
      this.speed = v;
      $$('[data-speed]').forEach(b => b.classList.toggle('on', +b.dataset.speed === v));
    },

    /* --------------------------- FIL « COMPRENDRE » ------------------ */
    addExplain(e) {
      const box = $('[data-body="explain"]');
      const d = document.createElement('div');
      d.className = 'xp k-' + e.kind;
      d.innerHTML = `<time>${e.time}</time><p>${esc(e.text)}</p>`;
      box.prepend(d);
      while (box.children.length > 120) box.lastChild.remove();
      const tab = $('[data-tab="explain"]');
      if (!tab.classList.contains('on')) tab.classList.add('ping');
    },
    addLog(e) {
      const box = $('[data-body="log"]');
      const d = document.createElement('div');
      d.className = 'lg-row k-' + e.kind;
      d.innerHTML = `<time>${e.time}</time><span>${esc(e.text)}</span>`;
      box.prepend(d);
      while (box.children.length > 300) box.lastChild.remove();
    },

    /* --------------------------- CORRESPONDANCE ---------------------- */
    buildCorr() {
      const s = this.sim, b = s.b;
      const cols = b.zs;
      const html = `<div class="corr-intro">Pour chaque zone de détection (ligne), les zones que le système met en sécurité automatiquement (●). Les lignes et colonnes s'allument en direct. <button class="linkbtn" data-fiche="CORR">Le tableau de correspondance</button> · <button class="linkbtn" data-fiche="ZONES">Les zones</button></div>
        <div class="corr-scroll"><table class="corr"><thead><tr><th>Zone de détection</th>${cols.map(z => `<th data-col="${z.id}" class="ck-${z.kind}"><b>${z.id}</b><small>${esc(z.name)}</small></th>`).join('')}</tr></thead>
        <tbody>${b.zd.map(z => `<tr data-row="${z.id}"><th><b>${z.id}</b> ${esc(z.name)} <small>${z.kind}</small></th>${cols.map(c => {
          const row = b.corr.find(r => r.zd === z.id);
          const on = row && row.zs.includes(c.id) && !(c.manualOnly);
          return `<td data-col="${c.id}">${on ? '●' : ''}</td>`;
        }).join('')}</tr>`).join('')}
        <tr class="manual"><th>Commande manuelle seulement</th>${cols.map(c => `<td>${c.manualOnly ? 'DCM' : ''}</td>`).join('')}</tr>
        </tbody></table></div>`;
      $('[data-body="corr"]').innerHTML = html;
    },
    updateCorr() {
      const s = this.sim;
      $$('[data-body="corr"] [data-row]').forEach(tr => {
        const z = s.zd[tr.dataset.row];
        tr.classList.toggle('feu', !!(z && z.feu));
      });
      $$('[data-body="corr"] [data-col]').forEach(c => {
        const z = s.zs[c.dataset.col];
        c.classList.toggle('ordre', !!(z && (z.ordre || (z.def.kind === 'ZA' && s.uga.state === 'ag'))));
      });
    },
    updateOcc() {
      const s = this.sim, st = s.stats();
      if (this.isHidden()) {
        $('[data-body="occ"]').innerHTML = `<div class="occ-sum"><div><b>${st.occ0}</b><span>effectif attendu (registre)</span></div><div><b>${st.evac}</b><span>comptés au point de rassemblement</span></div><div><b>${Math.max(0, st.occ0 - st.evac)}</b><span>manquants à l'appel</span></div></div>
          <p class="note">Vue élève : tu ne sais pas où sont les personnes manquantes. Les rondes et les levées de doute te le diront.</p>`;
        return;
      }
      const rows = s.b.levels.map((L, li) => {
        const rs = Object.values(s.rooms).filter(r => r.level === li && r.occ0 > 0);
        const inside = rs.reduce((a, r) => a + r.occ, 0), out = rs.reduce((a, r) => a + r.evac, 0);
        const blocked = rs.filter(r => r.blocked && r.occ > 0.5).map(r => r.def.name);
        return `<tr><th>${L.name}</th><td>${Math.ceil(inside)}</td><td>${Math.floor(out)}</td><td>${blocked.length ? '<span class="bad">' + blocked.map(esc).join(', ') + '</span>' : '—'}</td></tr>`;
      }).reverse().join('');
      $('[data-body="occ"]').innerHTML = `<div class="occ-sum"><div><b>${st.occ0}</b><span>présents au départ</span></div><div><b>${st.evac}</b><span>évacués</span></div><div><b>${st.inside}</b><span>encore dedans</span></div><div class="${st.danger ? 'bad' : ''}"><b>${st.danger}</b><span>en atmosphère enfumée</span></div></div>
        <table class="occ-t"><thead><tr><th>Niveau</th><th>Dedans</th><th>Sortis</th><th>Bloqués</th></tr></thead><tbody>${rows}</tbody></table>
        <p class="note">Les occupants évacuent à l'alarme générale, ou plus tôt s'ils voient la fumée. Ils restent bloqués si leur chemin est trop enfumé.</p>`;
    },

    /* ----------------------------- MENUS ----------------------------- */
    openMenu(ev, title, sub, items, ficheKey, refresh) {
      const m = $('#menu');
      const render = () => {
        const it = typeof items === 'function' ? items() : items;
        m.innerHTML = `<div class="menu-h"><b>${esc(title)}</b>${sub ? `<div class="menu-sub">${typeof sub === 'function' ? sub() : sub}</div>` : ''}</div>
          <div class="menu-items">${it.map((x, i) => x.sep ? '<hr>' : `<button data-i="${i}" class="${x.cls || ''}" ${x.disabled ? 'disabled' : ''}>${esc(x.label)}${x.hint ? `<small>${esc(x.hint)}</small>` : ''}</button>`).join('')}</div>
          ${ficheKey ? `<button class="menu-fiche" data-fiche="${ficheKey}">Comprendre cet équipement</button>` : ''}`;
        m.onclick = e => {
          const f = e.target.closest('[data-fiche]');
          if (f) { this.closeMenu(); this.showFiche(f.dataset.fiche); return; }
          const b = e.target.closest('[data-i]');
          if (!b) return;
          const x = it[+b.dataset.i];
          this.sound.unlock();
          const r = x.run && x.run();
          if (r && r.msg) this.toast(r.msg, r.ok ? 'ok' : 'warn');
          if (!x.keep) this.closeMenu(); else render();
        };
      };
      render();
      m.hidden = false;
      const pad = 10, W = m.offsetWidth, Hh = m.offsetHeight;
      let x = ev.clientX + 12, y = ev.clientY + 6;
      if (x + W > innerWidth - pad) x = ev.clientX - W - 12;
      if (y + Hh > innerHeight - pad) y = innerHeight - Hh - pad;
      m.style.left = Math.max(pad, x) + 'px'; m.style.top = Math.max(pad, y) + 'px';
      this.menuRefresh = refresh ? () => { const sb = m.querySelector('.menu-sub'); if (sb && typeof sub === 'function') sb.innerHTML = sub(); } : null;
    },
    closeMenu() { $('#menu').hidden = true; this.menuRefresh = null; },

    canIgnite() { return !this.mission || this.trainer; },

    roomMenu(id, ev) {
      const s = this.sim, r = s.rooms[id];
      if (this.isHidden()) return this.roomMenuStudent(id, ev);
      const sub = () => {
        const f = r.fire;
        return `<span>Fumée <b>${Math.round(r.s * 100)} %</b></span><span>Température <b>${Math.round(r.T)} °C</b></span>` +
          (f && f.stage !== 'éteint' ? `<span class="fire-t">Feu : ${Math.round(f.Q)} kW · ${f.stage}</span>` : f ? '<span>Feu éteint</span>' : '') +
          (r.occ0 ? `<span>Occupants <b>${Math.ceil(r.occ)}</b> / ${r.occ0}</span>` : '') +
          (r.def.zd ? `<span>Zone de détection <b>${r.def.zd}</b></span>` : '');
      };
      const items = () => {
        const a = [];
        if (!r.fire && r.def.kind !== 'stair') a.push({ label: '🔥 Allumer un feu ici', hint: this.canIgnite() ? 'Feu de développement moyen' : 'En mission : active le mode formateur', disabled: !this.canIgnite(), run: () => { s.ignite(id); } });
        a.push({ label: '🧑‍🚒 Envoyer un agent (levée de doute)', hint: 'Il part du poste de sécurité', run: () => { const res = s.sendAgent(id); return res.ok ? { ok: true, msg: 'Agent en route : arrivée dans ' + res.eta + ' s.' } : res; } });
        if (s.agent && s.agent.done && s.agent.room === id && s.agent.fire) a.push({ label: '🧯 Attaquer à l\'extincteur', run: () => s.agentExtinguisher() });
        if (r.s > 0.03 && !(r.fire && r.fire.stage !== 'éteint') && r.def.kind !== 'stair') a.push({ label: r.aired ? '🪟 Fenêtres ouvertes' : '🪟 Aérer le local (ouvrir les fenêtres)', hint: 'Une fois le feu éteint', disabled: !!r.aired, run: () => { r.aired = true; s.journal('Aération de ' + s.roomName(id), 'info'); } });
        a.push({ label: '🔦 Ronde du niveau ' + s.b.levels[r.level].name, hint: 'L\'agent rend compte par radio', run: () => { const res = s.patrol(r.level); return res.ok ? { ok: true, msg: 'Ronde lancée : compte rendu dans ' + res.eta + ' s.' } : res; } });
        if (this.trainer) {
          a.push({ sep: true });
          a.push({ label: 'Ajouter de la fumée froide', hint: 'Sans feu, pour tester la détection', run: () => { r.s = Math.min(1, r.s + 0.3); } });
          if (r.fire && r.fire.stage !== 'éteint') a.push({ label: 'Éteindre le feu', run: () => s.extinguish(id, 'formateur') });
          if (r.s > 0) a.push({ label: 'Dissiper la fumée', run: () => { r.s = 0; } });
        }
        return a;
      };
      this.openMenu(ev, s.roomName(id), sub, items, null, true);
    },

    deviceMenu(id, ev) {
      const s = this.sim, d = s.devices[id], t = d.def.type;
      const fiche = t === 'DI' && d.def.sdad ? 'SDAD' : t;
      const das = d.das;
      const st = () => {
        let x = `<span>${esc(d.def.label || '')}</span>`;
        if (d.def.zd) x += `<span>Zone <b>${d.def.zd}</b></span>`;
        if (d.def.zs) x += `<span>Zone <b>${[].concat(d.def.zs).join(', ')}</b></span>`;
        if (this.isHidden()) return x + '<span>Vue élève : état inconnu depuis le poste de sécurité</span>';
        const tf = this.trainer;
        if (t === 'DI') x += `<span>État <b>${d.state === 'alarme' ? 'ALARME' : 'veille'}</b>${d.fault && tf ? ' · défaut : ' + d.fault : ''}</span>`;
        if (t === 'DM' || t === 'DCM' || t === 'BAASMA') x += `<span>État <b>${d.state === 'actionne' ? 'actionné' : 'veille'}</b>${d.fault && tf ? ' · HORS D\'USAGE' : ''}</span>`;
        if (t === 'DS' && tf && d.fault) x += '<span><b class="bad">Diffuseur muet</b></span>';
        if (das) x += `<span>Position <b>${das.state === 'PA' ? 'attente' : das.state === 'PS' ? 'sécurité' : 'en mouvement'}</b>${das.fault && tf ? ' · BLOQUÉ' : ''}${das.ordered ? ' · ordre actif' : ''}</span>`;
        return x;
      };
      const items = () => {
        const a = [];
        if (t === 'DI') {
          a.push({ label: '🧪 Essai au générateur d\'aérosol', run: () => s.testDI(id) });
          if (this.trainer) {
            a.push({ sep: true });
            a.push({ label: 'Encrasser (fausse alarme)', run: () => s.setFault('di', id, 'encrasse') });
            a.push({ label: 'Masquer (ne détecte plus, aucun signal)', run: () => s.setFault('di', id, 'masque') });
            a.push({ label: 'Débrancher (dérangement à l\'ECS)', run: () => s.setFault('di', id, 'absent') });
            if (d.fault) a.push({ label: 'Réparer', run: () => s.setFault('di', id, null) });
          }
        }
        if (t === 'DM') {
          if (d.state !== 'actionne') a.push({ label: '🟥 Briser la vitre (actionner)', cls: 'danger', run: () => s.pressDM(id) });
          else a.push({ label: '🔑 Réarmer avec la clé', run: () => s.resetDM(id) });
        }
        if (t === 'DMV') a.push({ label: '🟩 Actionner : déverrouiller l\'issue', run: () => s.pressDMV(id) });
        if (t === 'BAASMA') {
          if (s.uga.state !== 'ag') a.push({ label: '🔔 Déclencher l\'alarme', cls: 'danger', run: () => s.pressBAAS(id) });
          else a.push({ label: '🔑 Arrêter l\'alarme (clé)', run: () => s.stopBAAS(id) });
        }
        if (t === 'DS' && this.trainer) a.push(d.fault ? { label: 'Réparer le diffuseur', run: () => { d.fault = null; } } : { label: 'Rendre ce diffuseur muet', cls: 'danger', run: () => { d.fault = 'muet'; } });
        if (t === 'DM' && this.trainer) a.push(d.fault ? { label: 'Réparer le déclencheur', run: () => { d.fault = null; } } : { label: 'Mettre hors d\'usage', cls: 'danger', run: () => { d.fault = 'hs'; } });
        if (t === 'DCM') {
          if (d.state !== 'actionne') a.push({ label: '🟨 Actionner la commande', cls: 'amber', run: () => s.pressDCM(id) });
          else a.push({ label: '🔧 Réarmer sur place', run: () => s.resetDCM(id) });
        }
        if (das) {
          if (das.state === 'PS' && !das.ordered) a.push({ label: '🔧 Remettre en position d\'attente (sur place)', run: () => s.localResetDas(das.id) });
          if (this.trainer) {
            a.push({ sep: true });
            a.push(das.fault ? { label: 'Débloquer', run: () => { das.fault = null; das.defaut = false; } } : { label: 'Bloquer ce DAS (panne)', run: () => s.setFault('das', das.id, 'bloque') });
          }
        }
        if (!a.length) a.push({ label: 'Aucune action possible ici', disabled: true });
        return a;
      };
      const names = { DI: d.def.sdad ? 'Détecteur autonome déclencheur' : 'Détecteur automatique', DM: 'Déclencheur manuel', DMV: 'Déclencheur manuel vert', DS: 'Diffuseur d\'évacuation', VD: 'Volet de désenfumage', VA: 'Volet d\'amenée d\'air', OUV: 'Ouvrant de façade', EXU: 'Exutoire', CLAPET: 'Clapet coupe-feu', DCM: 'Commande manuelle (DCM)', BAASMA: 'Bloc autonome d\'alarme manuel (BAAS Ma)' };
      this.openMenu(ev, (names[t] || t) + ' · ' + id, st, items, FI[fiche] ? fiche : null, true);
    },

    openingMenu(id, ev) {
      const s = this.sim, o = s.openings[id];
      const kind = o.def.kind;
      const title = kind === 'cf_auto' ? 'Porte coupe-feu à fermeture automatique' : kind === 'exit' ? 'Issue de secours' : 'Porte';
      const hid = this.isHidden();
      if (hid) {
        return this.openMenu(ev, title + ' · ' + id, `<span>${s.roomName(o.def.a)} ↔ ${s.roomName(o.def.b)}</span><span>Vue élève : état inconnu depuis le poste</span>`,
          [{ label: '🧑‍🚒 Envoyer un agent vérifier cette porte', hint: 'Il la libère si elle est calée', run: () => { const res = s.checkDoor(id); return res.ok ? { ok: true, msg: 'Agent en route : compte rendu dans ' + res.eta + ' s.' } : res; } }],
          kind === 'cf_auto' ? 'door' : kind === 'exit' ? 'exit' : null);
      }
      const sub = () => `<span>${s.roomName(o.def.a)} ↔ ${s.roomName(o.def.b)}</span><span>État <b>${o.burnt ? 'détruite' : o.open ? 'ouverte' : 'fermée'}</b>${o.wedged ? ' · <b class="bad">CALÉE</b>' : ''}${o.def.locked ? (o.locked ? ' · verrouillée' : ' · déverrouillée') : ''}</span>${o.das ? `<span>Zone <b>${o.def.zs}</b> · ${o.das.ordered ? 'ordre de fermeture actif' : 'pas d\'ordre'}</span>` : ''}`;
      const items = () => {
        const a = [];
        if (o.wedged) a.push({ label: '✋ Retirer la cale', cls: 'ok', run: () => s.wedgeDoor(id, false) });
        if (o.das && o.das.state === 'PS' && !o.das.ordered) a.push({ label: '🔧 Réarmer : replaquer la porte sur sa ventouse', run: () => s.localResetDas(o.das.id) });
        else if (!o.burnt) a.push({ label: o.open ? 'Fermer la porte' : 'Ouvrir la porte', run: () => s.toggleDoor(id) });
        a.push({ label: '🧑‍🚒 Envoyer un agent vérifier', run: () => { const res = s.checkDoor(id); return res.ok ? { ok: true, msg: 'Agent en route : compte rendu dans ' + res.eta + ' s.' } : res; } });
        if (this.trainer && kind === 'cf_auto' && !o.wedged) { a.push({ sep: true }); a.push({ label: 'Caler la porte ouverte', cls: 'danger', run: () => s.wedgeDoor(id, true) }); }
        return a;
      };
      this.openMenu(ev, title + ' · ' + id, sub, items, kind === 'cf_auto' ? 'door' : kind === 'exit' ? 'exit' : null, true);
    },

    fanMenu(id, kind, ev) {
      const s = this.sim;
      s.flag('inspect:' + id);
      if (kind === 'cta') {
        this.openMenu(ev, s.cta.def.name, () => `<span>État <b>${s.cta.on && s.power.secteur ? 'en marche' : 'arrêtée'}</b></span><span>Arrêt commandé par <b>${s.cta.def.zs}</b></span>`, [{ label: 'Elle s\'arrête quand le CMSI met la ZC1 en sécurité', disabled: true }], 'CTA', true);
        return;
      }
      const f = s.fans[id];
      if (this.isHidden()) { this.openMenu(ev, f.def.name, '<span>En toiture : état inconnu depuis le poste. Regarde les voyants du CMSI.</span>', [{ label: 'Envoyer un technicien est hors exercice', disabled: true }], 'FAN'); return; }
      const items = () => {
        const a = [];
        if (this.trainer) a.push(f.fault ? { label: 'Réparer le ventilateur', run: () => s.setFault('fan', id, null) } : { label: 'Mettre en panne', cls: 'danger', run: () => s.setFault('fan', id, 'panne') });
        else a.push({ label: f.fault ? 'Moteur en panne : à signaler au mainteneur' : 'Commandé par le CMSI (coffret de relayage)', disabled: true });
        return a;
      };
      this.openMenu(ev, f.def.name, () => `<span>Rôle <b>${f.def.role}</b> · ${f.def.flow} m³/s</span><span>État <b>${f.fault ? 'EN PANNE' : f.pompier ? 'arrêt pompiers' : f.run ? 'en marche' : 'à l\'arrêt'}</b></span><span>Dessert ${f.def.zfs.join(', ')}</span>`, items, 'FAN', true);
    },

    /* ---------------------------- LEVÉE DE DOUTE --------------------- */
    agentReport(d) {
      const s = this.sim;
      const box = $('#modal'), mb = box.querySelector('.modal-box');
      if (d.patrol) {
        mb.className = 'modal-box report ' + (d.fire ? 'fire' : 'calm');
        mb.innerHTML = `<p class="rep-from">Radio — agent en ronde</p><h3>${esc(d.lines && d.lines.length > 1 ? 'Compte rendu ' + (d.level !== undefined ? s.b.levels[d.level].name : '') : d.msg)}</h3>
          ${d.lines && d.lines.length > 1 ? '<ul>' + d.lines.map(l => '<li>' + esc(l) + '</li>').join('') + '</ul>' : (d.lines && d.lines.length ? '' : '<p>Rien d\'anormal.</p>')}
          <div class="rep-actions"><button data-r="close" class="ghost">Fermer</button></div>`;
        box.hidden = false;
        mb.onclick = e => { if (e.target.closest('[data-r]')) box.hidden = true; };
        return;
      }
      mb.className = 'modal-box report ' + (d.fire ? 'fire' : 'calm');
      mb.innerHTML = `<p class="rep-from">Radio — agent de sécurité</p><h3>${esc(d.msg)}</h3>
        <div class="rep-actions">
          ${d.fire ? `<button data-r="ag" class="danger">Lancer l'évacuation générale</button><button data-r="call">Appeler le 18</button><button data-r="ext">Attaquer à l'extincteur</button>` : `<button data-r="stop">Arrêter le processus d'alarme (N2)</button>`}
          <button data-r="close" class="ghost">Fermer</button>
        </div>`;
      box.hidden = false;
      mb.onclick = e => {
        const b = e.target.closest('[data-r]'); if (!b) return;
        const r = b.dataset.r;
        let res = null;
        if (r === 'ag') { s.flag('agManualAsk'); s.startAG('commande manuelle'); }
        if (r === 'call') s.callFiremen();
        if (r === 'ext') res = s.agentExtinguisher();
        if (r === 'stop') {
          if (s.access < 2) { this.toast('Niveau d\'accès 2 requis : tourne la clé sur la façade.', 'warn'); return; }
          res = s.ugaStopProcess();
        }
        if (res && res.msg) this.toast(res.msg, res.ok ? 'ok' : 'warn');
        if (r === 'close' || r === 'ag' || r === 'stop' || r === 'ext') box.hidden = true;
        else b.disabled = true;
      };
    },

    /* ------------------------------ FICHES --------------------------- */
    showFiche(key) {
      const f = FI[key];
      if (!f) return;
      const box = $('#modal'), mb = box.querySelector('.modal-box');
      mb.className = 'modal-box fiche';
      mb.innerHTML = `<h3>${esc(f.t)}</h3><p class="fiche-role">${esc(f.role)}</p><ul>${f.pts.map(p => '<li>' + esc(p) + '</li>').join('')}</ul><p class="fiche-ref">Références : ${esc(f.ref)}</p><button class="ghost close" data-close>Fermer</button>`;
      box.hidden = false;
      mb.onclick = e => { if (e.target.closest('[data-close]')) box.hidden = true; };
    },

    /* ----------------------------- MISSIONS -------------------------- */
    showBrief(m) {
      const box = $('#modal'), mb = box.querySelector('.modal-box');
      mb.className = 'modal-box brief';
      mb.innerHTML = `<p class="rep-from">Mission · ${esc(m.level)}</p><h3>${esc(m.title)}</h3>${m.brief.map(p => '<p>' + esc(p) + '</p>').join('')}
        <h4>Objectifs</h4><ol>${m.objectives.map(o => '<li>' + esc(o.text) + '</li>').join('')}</ol>
        <p class="note">Astuce : accélère le temps avec ×5 ou ×15 quand il ne se passe rien. Les objectifs se cochent tout seuls.</p>
        <button class="go-big" data-go>Commencer</button>`;
      box.hidden = false;
      mb.onclick = e => { if (e.target.closest('[data-go]')) { box.hidden = true; this.paused = false; this.sound.unlock(); } };
    },
    renderMission() {
      const card = $('#mission');
      if (!this.mission) { card.hidden = true; return; }
      const m = this.mission;
      card.hidden = false;
      card.classList.remove('cds');
      card.onclick = null;
      card.innerHTML = `<button class="mc-toggle" data-mc aria-expanded="true"><b>${esc(m.title)}</b><span data-mcount></span></button>
        <ol class="mc-list">${m.objectives.map((o, i) => `<li data-oi="${i}">${esc(o.text)}</li>`).join('')}</ol>`;
      card.querySelector('[data-mc]').onclick = () => card.classList.toggle('collapsed');
    },
    checkMission() {
      const s = this.sim, m = this.mission;
      let n = 0;
      m.objectives.forEach((o, i) => {
        if (!(i in m.done) && !(i in m.failed)) {
          if (o.fail && o.fail(s)) m.failed[i] = s.t;
          else if (o.done(s)) m.done[i] = s.t;
        }
        const li = $(`[data-oi="${i}"]`);
        if (li) { li.classList.toggle('done', i in m.done); li.classList.toggle('failed', i in m.failed); }
        if (i in m.done) n++;
      });
      const c = $('[data-mcount]');
      if (c) c.textContent = n + ' / ' + m.objectives.length;
      if (!this.ended && m.end(s)) { this.ended = true; setTimeout(() => this.debrief(), 600); }
    },
    debrief() {
      const s = this.sim, m = this.mission, st = s.stats();
      const ok = Object.keys(m.done).length, tot = m.objectives.length;
      const nStars = ok === tot && st.danger === 0 ? 3 : ok / tot >= 0.7 ? 2 : ok / tot >= 0.4 ? 1 : 0;
      { const p = Prog.load(); p.missions = p.missions || {}; const prev = p.missions[this.missionId] || { stars: 0 }; const before = Prog.grade(Prog.points(p)); p.missions[this.missionId] = { stars: Math.max(prev.stars, nStars), last: nStars }; Prog.save(p); const after = Prog.grade(Prog.points(p)); this._promo = after !== before ? after : null; }
      const F = s.flags;
      const key = [
        ['Première alarme feu', Object.values(s.zd).map(z => z.first).filter(x => x !== null)[0] ?? (F.dmPressed ?? F.ag)],
        ['Levée de doute lancée', F.agentSent], ['Secours appelés', F.called18], ['Alarme générale', F.ag], ['Arrivée des secours', F.firemenOnSite], ['Feu éteint', F.fireOut]
      ].filter(k => k[1] !== undefined && k[1] !== null);
      if (this.student && !this.revealed) this.reveal(true);
      const box = $('#modal'), mb = box.querySelector('.modal-box');
      mb.className = 'modal-box debrief';
      mb.innerHTML = `<p class="rep-from">Bilan de mission</p><div class="big-stars">${stars(nStars)}</div><h3>${esc(m.title)} — ${ok} / ${tot} objectifs</h3>${this._promo ? `<p class="promo">🎖️ Promotion : tu passes <b>${esc(this._promo.t)}</b> (${this._promo.s})</p>` : ''}
        <div class="occ-sum"><div><b>${st.evac}</b><span>évacués</span></div><div><b>${st.inside}</b><span>encore dedans</span></div><div class="${st.danger ? 'bad' : ''}"><b>${st.danger}</b><span>en atmosphère enfumée</span></div><div><b>${fmt(s.t)}</b><span>durée</span></div></div>
        <div class="deb-cols"><div><h4>Objectifs</h4><ul class="deb-obj">${m.objectives.map((o, i) => `<li class="${i in m.done ? 'done' : i in m.failed ? 'failed' : 'miss'}">${esc(o.text)}${i in m.done ? ' <time>' + fmt(m.done[i]) + '</time>' : ''}</li>`).join('')}</ul></div>
        <div><h4>Chronologie</h4><ul class="deb-time">${key.map(k => `<li><time>${fmt(k[1])}</time>${k[0]}</li>`).join('')}</ul></div></div>
        ${this.student ? this.readingHtml() : ''}
        <h4>À retenir</h4><ul>${m.lessons.map(l => '<li>' + esc(l) + '</li>').join('')}</ul>
        <div class="rep-actions"><button data-d="again">Rejouer la mission</button><button data-d="free" class="ghost">Continuer en mode libre</button><button data-d="home" class="ghost">Autres bâtiments</button></div>`;
      box.hidden = false;
      mb.onclick = e => {
        const b = e.target.closest('[data-d]'); if (!b) return;
        box.hidden = true;
        if (b.dataset.d === 'again') this.start(s.b.id, this.missionId, this.startOpts);
        if (b.dataset.d === 'free') { this.ended = false; this.mission = null; s.mission = null; $('#mission').hidden = true; }
        if (b.dataset.d === 'home') this.home();
      };
    },

    /* ----------------------------- FORMATEUR ------------------------- */
    renderTrainer() {
      const s = this.sim, t = $('#trainer');
      const sw = (k, label, on, hint) => `<label class="sw"><input type="checkbox" data-tr="${k}" ${on ? 'checked' : ''}><span>${label}${hint ? '<small>' + hint + '</small>' : ''}</span></label>`;
      t.innerHTML = `<h3>Mode formateur</h3>
        <p class="note">Clique sur un équipement du bâtiment pour le mettre en panne, caler une porte, encrasser un détecteur… Tu peux aussi allumer un feu pendant une mission.</p>
        <h4>Incident surprise</h4>
        <div class="tr-btns"><button data-surprise="feu">🎲 Feu au hasard</button><button data-surprise="fausse">🎲 Fausse alarme</button><button data-surprise="calee">🎲 Feu + porte calée</button></div>
        <p class="note">Il démarre dans 20 à 90 secondes simulées, dans un local tiré au sort. Idéal en vue élève.</p>
        <h4>Alimentations</h4>
        ${sw('secteur', 'Coupure secteur', !s.power.secteur, 'ECS et CMSI passent sur batterie')}
        ${sw('aes', 'Coupure de l\'alimentation de sécurité', !s.power.aes, 'Combinée au secteur : sécurité positive')}
        <h4>Exploitation</h4>
        ${sw('vr', 'UGA en veille restreinte', s.uga.veilleRestreinte, 'L\'alarme générale ne part plus seule')}
        <h4>Zones hors service</h4>
        ${s.b.zs.filter(z => z.kind !== 'ZA').map(z => sw('zs:' + z.id, z.id + ' — ' + esc(z.name), s.zs[z.id].hs)).join('')}
        <button class="ghost close" data-trclose>Fermer</button>`;
      t.onchange = e => {
        const i = e.target.closest('[data-tr]'); if (!i) return;
        const k = i.dataset.tr, v = i.checked;
        if (k === 'secteur') s.setFault('secteur', null, v);
        else if (k === 'aes') s.setFault('aes', null, v);
        else if (k === 'vr') s.setFault('veilleRestreinte', null, v);
        else if (k.startsWith('zs:')) s.setFault('zs_hs', k.slice(3), v);
      };
      t.onclick = e => {
        if (e.target.closest('[data-trclose]')) this.toggleTrainer(false);
        const sp = e.target.closest('[data-surprise]');
        if (sp) { this.surprise(sp.dataset.surprise); this.toast('Incident programmé. Bonne chance !', 'ok'); }
      };
    },
    toggleTrainer(v) {
      this.trainer = v === undefined ? !this.trainer : v;
      $('#trainer').hidden = !this.trainer;
      $('[data-tb="trainer"]').classList.toggle('on', this.trainer);
      document.body.classList.toggle('trainer-on', this.trainer);
      if (this.plan) this.plan.showFaults = this.trainer;
      if (this.trainer) this.renderTrainer();
    },

    /* ----------------------------- VUE ÉLÈVE ------------------------- */
    isHidden() { return this.student && !this.revealed; },

    applyStudentDrawer() {
      const box = $('[data-body="explain"]');
      box.classList.toggle('locked', this.isHidden());
      // journal reconstruit sans les événements invisibles depuis le poste
      const log = $('[data-body="log"]');
      log.innerHTML = '';
      (this.sim.log || []).forEach(e => { if (!(e.secret && this.isHidden())) this.addLog(e); });
    },

    roomMenuStudent(id, ev) {
      const s = this.sim, r = s.rooms[id];
      const marks = [['🔥', 'Foyer supposé'], ['💨', 'Fumée supposée'], ['🧍', 'Personnes à secourir'], ['⚠️', 'Anomalie / à vérifier']];
      const items = [
        { label: '🧑‍🚒 Envoyer un agent (levée de doute)', hint: 'Il rend compte par radio', run: () => { const res = s.sendAgent(id); return res.ok ? { ok: true, msg: 'Agent en route : arrivée dans ' + res.eta + ' s.' } : res; } },
        { label: '🔦 Ronde du niveau ' + s.b.levels[r.level].name, hint: 'Fumée, portes, personnes bloquées', run: () => { const res = s.patrol(r.level); return res.ok ? { ok: true, msg: 'Ronde lancée : compte rendu dans ' + res.eta + ' s.' } : res; } }
      ];
      if (s.agent && s.agent.done && s.agent.room === id && s.agent.fire && !s.agent.noEntry) items.push({ label: '🧯 Attaquer à l\'extincteur', run: () => s.agentExtinguisher() });
      items.push({ sep: true });
      marks.forEach(([m, l]) => items.push({ label: m + ' Marquer : ' + l, cls: this.marks[id] === m ? 'ok' : '', run: () => { this.marks[id] = m; s.journal('Annotation : ' + l + ' — ' + s.roomName(id), 'info'); } }));
      if (this.marks[id]) items.push({ label: '✕ Effacer l\'annotation', run: () => { delete this.marks[id]; } });
      if (this.trainer) {
        items.push({ sep: true });
        items.push({ label: '🔥 Allumer un feu ici (formateur)', disabled: !!r.fire || r.def.kind === 'stair', run: () => s.ignite(id) });
      }
      this.openMenu(ev, s.roomName(id), `<span>${r.def.zd ? 'Zone de détection <b>' + r.def.zd + '</b>' : 'Pas de zone de détection'}</span><span>Vue élève : tu ne vois pas ce qui se passe dans ce local</span>`, items, null);
    },

    showStudentBrief() {
      const box = $('#modal'), mb = box.querySelector('.modal-box');
      mb.className = 'modal-box brief';
      mb.innerHTML = `<p class="rep-from">Vue élève · SSIAP 2</p><h3>Tu es chef d'équipe au poste de sécurité</h3>
        <p>Le plan est vierge : tu ne vois ni le feu, ni la fumée, ni les portes. Comme en vrai, tu dois comprendre la situation à partir de la façade du SSI, du plan des zones et des comptes rendus radio de tes agents.</p>
        <ul><li>Clique sur un local pour envoyer un agent, lancer une ronde ou annoter le plan (foyer supposé, fumée, personnes…).</li>
        <li>Le fil « Comprendre » est verrouillé jusqu'à la fin. Le bouton <b>👁 Révéler</b> compare ta lecture à la réalité.</li></ul>
        <div class="rep-actions"><button data-s="surprise" class="danger">Tirer un incident surprise</button><button data-s="trainer" class="ghost">Le formateur crée l'incident</button></div>`;
      box.hidden = false;
      mb.onclick = e => {
        const b = e.target.closest('[data-s]'); if (!b) return;
        box.hidden = true; this.paused = false; this.sound.unlock();
        if (b.dataset.s === 'surprise') this.surprise(['feu', 'feu', 'fausse', 'calee'][Math.floor(Math.random() * 4)]);
        else this.toggleTrainer(true);
      };
    },

    surprise(kind) {
      const s = this.sim;
      const rooms = Object.values(s.rooms).filter(r => r.def.kind === 'local' || r.def.kind === 'tech');
      const r = rooms[Math.floor(Math.random() * rooms.length)];
      const delay = 20 + Math.random() * 70;
      const dis = Object.values(s.devices).filter(d => d.def.type === 'DI' && !d.def.sdad);
      if (kind === 'fausse' && dis.length) {
        const d = dis[Math.floor(Math.random() * dis.length)];
        this.incident = 'Fausse alarme : détecteur ' + d.def.id + ' encrassé (' + s.roomName(d.def.room) + ')';
        this.truth = { fire: [], falseDi: d.def.room };
        this.pending.push({ t: s.t + delay, run: () => { d.fault = 'encrasse'; } });
        return;
      }
      const open = Math.random() < 0.6;
      this.incident = 'Feu dans ' + s.roomName(r.def.id) + (open ? ', porte laissée ouverte' : ', porte fermée');
      this.truth = { fire: [r.def.id] };
      this.pending.push({ t: s.t + delay, run: () => {
        s.ignite(r.def.id);
        Object.values(s.openings).forEach(o => { if ((o.def.a === r.def.id || o.def.b === r.def.id) && o.def.kind === 'door' && open) o.open = true; });
      } });
      if (kind === 'calee') {
        const doors = Object.values(s.openings).filter(o => o.def.kind === 'cf_auto' && s.levelOf[o.def.a] === s.rooms[r.def.id].level);
        const all = doors.length ? doors : Object.values(s.openings).filter(o => o.def.kind === 'cf_auto');
        if (all.length) { const o = all[Math.floor(Math.random() * all.length)]; s.wedgeDoor(o.def.id, true, true); this.incident += ' — porte coupe-feu ' + o.def.id + ' calée'; this.truth.wedged = o.def.id; }
      }
    },

    readingHtml() {
      const s = this.sim;
      const fires = Object.values(s.rooms).filter(r => r.fire).map(r => r.def.id);
      const origin = this.truth && this.truth.fire && this.truth.fire.length ? this.truth.fire : fires.slice(0, 1);
      const marked = Object.keys(this.marks).filter(k => this.marks[k] === '🔥');
      const okFoyer = origin.length ? marked.some(m => origin.includes(m)) : marked.length === 0;
      const smoky = Object.values(s.rooms).filter(r => r.s > 0.3).map(r => r.def.id);
      const markedSmoke = Object.keys(this.marks).filter(k => this.marks[k] === '💨' || this.marks[k] === '🔥');
      const smokeHit = smoky.filter(id => markedSmoke.includes(id)).length;
      return `<h4>Ta lecture de la situation</h4><ul class="deb-obj">
        <li class="${okFoyer ? 'done' : 'failed'}">Foyer : ${origin.length ? 'réel → ' + origin.map(id => esc(s.roomName(id))).join(', ') : 'aucun feu réel'} · marqué → ${marked.length ? marked.map(id => esc(s.roomName(id))).join(', ') : 'rien'}</li>
        <li class="${smoky.length && smokeHit / smoky.length >= 0.5 ? 'done' : smoky.length ? 'miss' : 'done'}">Volumes enfumés repérés : ${smokeHit} / ${smoky.length}</li>
        ${this.incident ? '<li class="miss">Incident tiré : ' + esc(this.incident) + '</li>' : ''}
      </ul>`;
    },

    revealDialog() {
      const s = this.sim, st = s.stats();
      const box = $('#modal'), mb = box.querySelector('.modal-box');
      mb.className = 'modal-box debrief';
      mb.innerHTML = `<p class="rep-from">Vue élève</p><h3>Révéler le bâtiment</h3>
        ${this.readingHtml()}
        <div class="occ-sum"><div><b>${st.evac}</b><span>évacués</span></div><div><b>${st.inside}</b><span>encore dedans</span></div><div class="${st.danger ? 'bad' : ''}"><b>${st.danger}</b><span>en atmosphère enfumée</span></div></div>
        <p class="note">Le plan réel s'affiche, le fil « Comprendre » se déverrouille. Tu peux revenir en vue élève avec le même bouton.</p>
        <div class="rep-actions"><button data-v="show">Afficher le bâtiment réel</button><button data-v="cancel" class="ghost">Continuer en vue élève</button></div>`;
      box.hidden = false;
      mb.onclick = e => {
        const b = e.target.closest('[data-v]'); if (!b) return;
        box.hidden = true;
        if (b.dataset.v === 'show') this.reveal();
      };
    },
    reveal() {
      this.revealed = true;
      this.plan.hidden = false;
      $('[data-tb="reveal"]').textContent = '🙈 Vue élève';
      this.applyStudentDrawer();
    },
    hideAgain() {
      this.revealed = false;
      this.plan.hidden = true;
      $('[data-tb="reveal"]').textContent = '👁 Révéler';
      this.applyStudentDrawer();
    },

    /* --------------------- ESSAIS EN COMMISSION DE SÉCURITÉ ------------ */
    showCdsBrief() {
      const s = this.sim, c = this.cds;
      const box = $('#modal'), mb = box.querySelector('.modal-box');
      mb.className = 'modal-box brief';
      mb.innerHTML = `<p class="rep-from">Visite périodique · ${esc(s.b.type)}</p><h3>Essais du SSI en commission de sécurité</h3>
        <p>Tu es le préventionniste de la commission. L'exploitant et son technicien sont là : tu <b>fais procéder</b> aux essais, tu observes, tu notes.</p>
        <p>Le SSI cache peut-être des anomalies… ou aucune. Pour chaque essai de la fiche, coche <b>Conforme</b> ou <b>Non conforme</b>, puis rends ton avis.</p>
        <h4>Fiche d'essais (${c.items.length} points)</h4><ol>${c.items.map(i => '<li>' + esc(i.title) + '</li>').join('')}</ol>
        <p class="note">Les commandes de niveau 2 demandent la clé. Les essais se font comme en vrai : clic sur un détecteur, un déclencheur, une porte, une commande du tableau…</p>
        <button class="go-big" data-go>Commencer la visite</button>`;
      box.hidden = false;
      mb.onclick = e => { if (e.target.closest('[data-go]')) { box.hidden = true; this.paused = false; this.sound.unlock(); } };
    },
    renderCds() {
      const c = this.cds, card = $('#mission');
      card.hidden = false;
      card.classList.add('cds');
      card.innerHTML = `<button class="mc-toggle" data-mc><b>Fiche d'essais — commission</b><span data-cdscount></span></button>
        <div class="cds-body">
          <ol class="cds-list">${c.items.map(i => `<li data-ci="${i.id}"><div class="cds-t"><b>${esc(i.title)}</b><span class="cds-done" data-cdone></span></div>
            <p class="cds-how">${esc(i.how)}</p><p class="cds-see"><i>Attendu :</i> ${esc(i.see)}</p>
            <div class="cds-btns"><button data-mark="c">Conforme</button><button data-mark="nc">Non conforme</button></div></li>`).join('')}</ol>
          ${this.sim.b.category !== 'E' ? '<button class="cds-power" data-cpower>⚡ Faire couper le secteur</button>' : ''}
          <button class="go-big cds-avis" data-cavis>Rendre l'avis</button>
        </div>`;
      card.querySelector('[data-mc]').onclick = () => card.classList.toggle('collapsed');
      card.onclick = e => {
        const m = e.target.closest('[data-mark]');
        if (m) {
          const id = m.closest('[data-ci]').dataset.ci;
          c.marks[id] = c.marks[id] === m.dataset.mark ? undefined : m.dataset.mark;
          this.updateCds(true);
          return;
        }
        if (e.target.closest('[data-cpower]')) {
          const on = this.sim.power.secteur;
          this.sim.setFault('secteur', null, on);
          e.target.closest('[data-cpower]').textContent = on ? '⚡ Faire rétablir le secteur' : '⚡ Faire couper le secteur';
          return;
        }
        if (e.target.closest('[data-cavis]')) this.cdsAvis();
      };
    },
    updateCds() {
      const c = this.cds, s = this.sim;
      let n = 0;
      c.items.forEach(i => {
        const li = $(`[data-ci="${i.id}"]`); if (!li) return;
        const done = i.done(s);
        li.querySelector('[data-cdone]').textContent = done ? 'essai réalisé' : '';
        li.classList.toggle('m-c', c.marks[i.id] === 'c');
        li.classList.toggle('m-nc', c.marks[i.id] === 'nc');
        if (c.marks[i.id]) n++;
      });
      const cnt = $('[data-cdscount]');
      if (cnt) cnt.textContent = n + ' / ' + c.items.length;
    },
    cdsAvis() {
      const c = this.cds;
      const missing = c.items.filter(i => !c.marks[i.id]).length;
      const box = $('#modal'), mb = box.querySelector('.modal-box');
      mb.className = 'modal-box brief';
      mb.innerHTML = `<p class="rep-from">Commission de sécurité</p><h3>Ton avis sur le SSI</h3>
        ${missing ? `<p class="bad">${missing} point(s) de la fiche ne sont pas renseignés.</p>` : ''}
        <p>Au vu des essais, quel avis proposes-tu pour la partie SSI ?</p>
        <div class="rep-actions"><button data-a="favorable" class="ok-btn">Avis favorable</button><button data-a="défavorable" class="danger">Avis défavorable</button><button data-a="back" class="ghost">Continuer les essais</button></div>`;
      box.hidden = false;
      mb.onclick = e => {
        const b = e.target.closest('[data-a]'); if (!b) return;
        box.hidden = true;
        if (b.dataset.a === 'back') return;
        c.avis = b.dataset.a;
        this.cdsBilan();
      };
    },
    cdsBilan() {
      const c = this.cds, s = this.sim, ev = window.SSI_CDS.evaluate(c);
      this.ended = true;
      if (this.student && !this.revealed) this.reveal();
      const nFound = ev.found.filter(a => a.found).length;
      const cdsPts = (ev.avisOk ? 1 : 0) + (c.anomalies.length ? (nFound === c.anomalies.length ? 1 : 0) : 1) + (ev.falseNc.length === 0 && ev.notDone.length === 0 ? 1 : 0);
      { const p = Prog.load(); p.cds = p.cds || {}; const prev = p.cds[s.b.id] || { best: 0, visits: 0 }; p.cds[s.b.id] = { best: Math.max(prev.best, cdsPts), visits: prev.visits + 1 }; Prog.save(p); }
      const box = $('#modal'), mb = box.querySelector('.modal-box');
      mb.className = 'modal-box debrief';
      mb.innerHTML = `<p class="rep-from">Bilan des essais</p><div class="big-stars">${stars(cdsPts)}</div><h3>${c.anomalies.length ? nFound + ' anomalie(s) trouvée(s) sur ' + c.anomalies.length : 'Aucune anomalie n\'était cachée'}</h3>
        <div class="occ-sum"><div class="${ev.avisOk ? '' : 'bad'}"><b>${ev.avisOk ? '✓' : '✗'}</b><span>avis ${esc(c.avis)} (attendu : ${ev.expected})</span></div><div><b>${ev.falseNc.length}</b><span>non-conformité(s) sans fondement</span></div><div><b>${ev.notDone.length}</b><span>point(s) non renseigné(s)</span></div><div><b>${fmt(s.t)}</b><span>durée de la visite</span></div></div>
        <h4>Anomalies cachées</h4>
        <ul class="deb-obj">${ev.found.length ? ev.found.map(a => `<li class="${a.found ? 'done' : 'failed'}">${esc(a.text)} <small>${a.major ? '— motive un avis défavorable' : '— observation'}</small></li>`).join('') : '<li class="done">Aucune : le SSI était conforme.</li>'}</ul>
        ${ev.falseNc.length ? '<h4>Non-conformités relevées à tort</h4><ul>' + ev.falseNc.map(i => '<li>' + esc(i.title) + '</li>').join('') + '</ul>' : ''}
        <h4>À retenir</h4><ul>
          <li>La commission fait procéder aux essais, elle ne les réalise pas elle-même.</li>
          <li>Commence toujours par l'état de veille : un voyant jaune allumé avant l'essai est déjà une information.</li>
          <li>Le tableau ne voit pas tout : une porte calée ou un diffuseur muet ne se découvrent que sur le terrain.</li>
        </ul>
        <div class="rep-actions"><button data-d="again">Nouvelle visite (autres anomalies)</button><button data-d="home" class="ghost">Autres bâtiments</button></div>`;
      box.hidden = false;
      mb.onclick = e => {
        const b = e.target.closest('[data-d]'); if (!b) return;
        box.hidden = true;
        if (b.dataset.d === 'again') this.start(s.b.id, null, { cds: true });
        if (b.dataset.d === 'home') this.home();
      };
    },

    /* ------------------------------ DIVERS --------------------------- */
    toast(msg, kind = 'info', ms = 3800) {
      const t = document.createElement('div');
      t.className = 'toast k-' + kind;
      t.textContent = msg;
      $('#toasts').appendChild(t);
      setTimeout(() => t.classList.add('out'), ms);
      setTimeout(() => t.remove(), ms + 400);
    },
    press(b) { b.classList.remove('pressed'); void b.offsetWidth; b.classList.add('pressed'); },

    bind() {
      document.addEventListener('click', e => {
        const tb = e.target.closest('[data-tb]');
        if (tb) {
          const k = tb.dataset.tb;
          if (k === 'home') { this.closeMenu(); this.home(); }
          if (k === 'call') this.sim.callFiremen();
          if (k === 'sound') { this.sound.muted = !this.sound.muted; tb.textContent = this.sound.muted ? '🔇' : '🔊'; this.sound.unlock(); }
          if (k === 'trainer') this.toggleTrainer();
          if (k === 'restart') this.start(this.sim.b.id, this.missionId, this.startOpts);
          if (k === 'reveal') { if (this.revealed) this.hideAgain(); else this.revealDialog(); }
          return;
        }
        const zb = e.target.closest('[data-zonesbtn]');
        if (zb) { zb.classList.toggle('on'); this.plan.setZones(zb.classList.contains('on')); return; }
        const sp = e.target.closest('[data-speed]');
        if (sp) { this.setSpeed(+sp.dataset.speed); this.sound.unlock(); return; }
        const tab = e.target.closest('[data-tab]');
        if (tab) {
          $$('[data-tab]').forEach(t => t.classList.toggle('on', t === tab));
          tab.classList.remove('ping');
          $$('[data-body]').forEach(b => { b.hidden = b.dataset.body !== tab.dataset.tab; });
          if (tab.dataset.tab === 'corr') this.updateCorr();
          if (tab.dataset.tab === 'occ') this.updateOcc();
          return;
        }
        const fi = e.target.closest('.linkbtn[data-fiche]');
        if (fi) { this.showFiche(fi.dataset.fiche); return; }
        if (!e.target.closest('#menu') && !e.target.closest('.room') && !e.target.closest('.dev') && !e.target.closest('.opening') && !e.target.closest('.roof-item')) this.closeMenu();
        if (e.target.id === 'modal' && !$('#modal .brief')) $('#modal').hidden = true;
      });
      document.addEventListener('keydown', e => {
        if (e.key === 'Escape') { this.closeMenu(); if (!$('#modal .brief')) $('#modal').hidden = true; }
        if (e.key === ' ' && !$('#sim').hidden && e.target === document.body) { e.preventDefault(); this.setSpeed(this.speed ? 0 : 1); }
      });
    }
  };

  window.SSIApp = App;
  App.bind();
  App.home();
})();

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
            ${mis.map(m => `<button class="go mis" data-b="${b.id}" data-m="${Object.keys(MIS).find(k => MIS[k] === m)}"><b>${esc(m.title)}</b><small>${esc(m.level)}</small></button>`).join('')}
          </div>`;
        wrap.appendChild(card);
      });
      wrap.onclick = e => {
        const g = e.target.closest('.go');
        if (!g) return;
        this.sound.unlock();
        this.start(g.dataset.b, g.dataset.m || null);
      };
      $('#home').hidden = false; $('#sim').hidden = true;
      document.title = 'Simulateur SSI';
    },

    /* ---------------------------- DÉMARRAGE -------------------------- */
    start(bid, missionId) {
      const b = B.find(x => x.id === bid);
      this.missionId = missionId;
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
      // puces de niveaux
      const chips = $('[data-levels]');
      chips.innerHTML = b.levels.map((l, i) => `<button data-li="${i}">${l.name}</button>`).reverse().join('');
      chips.onclick = e => { const c = e.target.closest('[data-li]'); if (c) this.plan.scrollToLevel(+c.dataset.li); };
      // journaux
      ['explain', 'log'].forEach(k => { $(`[data-body="${k}"]`).innerHTML = ''; });
      s.on('explain', e => this.addExplain(e));
      s.on('log', e => this.addLog(e));
      s.on('agent', d => this.agentReport(d));
      s.on('request', txt => this.toast(txt, 'alarm', 9000));
      // la première alarme amène le plan sur le niveau concerné
      s.on('log', e => {
        if ((e.kind === 'fire' || e.kind === 'alarm') && !this._focused) {
          const ev = s.ecs.events[0];
          const room = ev ? ev.room : Object.keys(s.rooms).find(id => s.rooms[id].fire);
          if (room) { this._focused = true; this.plan.scrollToLevel(s.rooms[room].level); }
        }
      });
      this._focused = false;
      this.buildCorr();
      this.renderTrainer();
      this.setSpeed(1);
      this.addExplain({ time: '00:00', kind: 'info', text: 'Bienvenue dans ' + b.name + '. ' + b.summary + ' Clique sur un local pour y allumer un feu, ou sur un équipement pour l\'actionner.' });
      if (missionId) {
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
      }
      this.renderMission();
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
        if (t === 'DI') x += `<span>État <b>${d.state === 'alarme' ? 'ALARME' : 'veille'}</b>${d.fault ? ' · défaut : ' + d.fault : ''}</span>`;
        if (t === 'DM' || t === 'DCM') x += `<span>État <b>${d.state === 'actionne' ? 'actionné' : 'veille'}</b></span>`;
        if (das) x += `<span>Position <b>${das.state === 'PA' ? 'attente' : das.state === 'PS' ? 'sécurité' : 'en mouvement'}</b>${das.fault ? ' · BLOQUÉ' : ''}${das.ordered ? ' · ordre actif' : ''}</span>`;
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
      const names = { DI: d.def.sdad ? 'Détecteur autonome déclencheur' : 'Détecteur automatique', DM: 'Déclencheur manuel', DMV: 'Déclencheur manuel vert', DS: 'Diffuseur d\'évacuation', VD: 'Volet de désenfumage', VA: 'Volet d\'amenée d\'air', OUV: 'Ouvrant de façade', EXU: 'Exutoire', CLAPET: 'Clapet coupe-feu', DCM: 'Commande manuelle (DCM)' };
      this.openMenu(ev, (names[t] || t) + ' · ' + id, st, items, FI[fiche] ? fiche : null, true);
    },

    openingMenu(id, ev) {
      const s = this.sim, o = s.openings[id];
      const kind = o.def.kind;
      const title = kind === 'cf_auto' ? 'Porte coupe-feu à fermeture automatique' : kind === 'exit' ? 'Issue de secours' : 'Porte';
      const sub = () => `<span>${s.roomName(o.def.a)} ↔ ${s.roomName(o.def.b)}</span><span>État <b>${o.burnt ? 'détruite' : o.open ? 'ouverte' : 'fermée'}</b>${o.wedged ? ' · <b class="bad">CALÉE</b>' : ''}${o.def.locked ? (o.locked ? ' · verrouillée' : ' · déverrouillée') : ''}</span>${o.das ? `<span>Zone <b>${o.def.zs}</b> · ${o.das.ordered ? 'ordre de fermeture actif' : 'pas d\'ordre'}</span>` : ''}`;
      const items = () => {
        const a = [];
        if (o.wedged) a.push({ label: '✋ Retirer la cale', cls: 'ok', run: () => s.wedgeDoor(id, false) });
        if (o.das && o.das.state === 'PS' && !o.das.ordered) a.push({ label: '🔧 Réarmer : replaquer la porte sur sa ventouse', run: () => s.localResetDas(o.das.id) });
        else if (!o.burnt) a.push({ label: o.open ? 'Fermer la porte' : 'Ouvrir la porte', run: () => s.toggleDoor(id) });
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
      const F = s.flags;
      const key = [
        ['Première alarme feu', Object.values(s.zd).map(z => z.first).filter(x => x !== null)[0] ?? (F.dmPressed ?? F.ag)],
        ['Levée de doute lancée', F.agentSent], ['Secours appelés', F.called18], ['Alarme générale', F.ag], ['Arrivée des secours', F.firemenOnSite], ['Feu éteint', F.fireOut]
      ].filter(k => k[1] !== undefined && k[1] !== null);
      const box = $('#modal'), mb = box.querySelector('.modal-box');
      mb.className = 'modal-box debrief';
      mb.innerHTML = `<p class="rep-from">Bilan de mission</p><h3>${esc(m.title)} — ${ok} / ${tot} objectifs</h3>
        <div class="occ-sum"><div><b>${st.evac}</b><span>évacués</span></div><div><b>${st.inside}</b><span>encore dedans</span></div><div class="${st.danger ? 'bad' : ''}"><b>${st.danger}</b><span>en atmosphère enfumée</span></div><div><b>${fmt(s.t)}</b><span>durée</span></div></div>
        <div class="deb-cols"><div><h4>Objectifs</h4><ul class="deb-obj">${m.objectives.map((o, i) => `<li class="${i in m.done ? 'done' : i in m.failed ? 'failed' : 'miss'}">${esc(o.text)}${i in m.done ? ' <time>' + fmt(m.done[i]) + '</time>' : ''}</li>`).join('')}</ul></div>
        <div><h4>Chronologie</h4><ul class="deb-time">${key.map(k => `<li><time>${fmt(k[1])}</time>${k[0]}</li>`).join('')}</ul></div></div>
        <h4>À retenir</h4><ul>${m.lessons.map(l => '<li>' + esc(l) + '</li>').join('')}</ul>
        <div class="rep-actions"><button data-d="again">Rejouer la mission</button><button data-d="free" class="ghost">Continuer en mode libre</button><button data-d="home" class="ghost">Autres bâtiments</button></div>`;
      box.hidden = false;
      mb.onclick = e => {
        const b = e.target.closest('[data-d]'); if (!b) return;
        box.hidden = true;
        if (b.dataset.d === 'again') this.start(s.b.id, this.missionId);
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
      t.onclick = e => { if (e.target.closest('[data-trclose]')) this.toggleTrainer(false); };
    },
    toggleTrainer(v) {
      this.trainer = v === undefined ? !this.trainer : v;
      $('#trainer').hidden = !this.trainer;
      $('[data-tb="trainer"]').classList.toggle('on', this.trainer);
      document.body.classList.toggle('trainer-on', this.trainer);
      if (this.trainer) this.renderTrainer();
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
          if (k === 'restart') this.start(this.sim.b.id, this.missionId);
          return;
        }
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

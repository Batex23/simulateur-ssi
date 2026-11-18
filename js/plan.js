/* =====================================================================
   BÂTIMENT VIRTUEL : plans des niveaux en SVG, empilés comme une coupe
   ===================================================================== */
(function () {
  'use strict';
  const NS = 'http://www.w3.org/2000/svg';
  const K = 20;           // px par mètre
  const GAP = 70;         // espace entre niveaux (px)
  const ROOF = 64;        // bande technique en toiture
  const PAD = 34;

  const el = (tag, attrs = {}, parent) => {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  };

  class Plan {
    constructor(root, sim, handlers) {
      this.root = root; this.sim = sim; this.h = handlers;
      this.build();
    }

    build() {
      const s = this.sim, b = s.b;
      const W = Math.max(...b.levels.map(l => l.w)) * K + PAD * 2;
      this.levelY = [];
      let y = PAD + ROOF;
      const order = b.levels.map((l, i) => i).reverse();       // niveau le plus haut en premier
      order.forEach(i => { this.levelY[i] = y; y += b.levels[i].h * K + GAP; });
      const Ht = y + 10;
      this.root.innerHTML = '';
      const svg = el('svg', { viewBox: `0 0 ${W} ${Ht}`, class: 'plan-svg', role: 'img', 'aria-label': 'Plan du bâtiment ' + b.name });
      this.svg = svg;
      const defs = el('defs', {}, svg);
      defs.innerHTML = `
        <radialGradient id="flame"><stop offset="0" stop-color="#fff6c2"/><stop offset=".35" stop-color="#ffb400"/><stop offset=".7" stop-color="#ff4b1f" stop-opacity=".85"/><stop offset="1" stop-color="#c8102e" stop-opacity="0"/></radialGradient>
        <pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="6" stroke="#9aa5ad" stroke-width="1"/></pattern>
        <linearGradient id="smk" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3b3f44"/><stop offset="1" stop-color="#5d6268"/></linearGradient>
        <filter id="smokeNoise" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.018" numOctaves="3" seed="7"/><feColorMatrix values="0 0 0 0 0.24  0 0 0 0 0.25  0 0 0 0 0.27  0 0 0 -1.1 1.15"/></filter>
        <pattern id="smokeTex" width="420" height="420" patternUnits="userSpaceOnUse"><rect width="420" height="420" fill="#4a4e54"/><rect width="420" height="420" filter="url(#smokeNoise)"/></pattern>
        ${this.sim.b.zd.map(z => `<pattern id="zh-${z.id}" width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="9" height="9" fill="${this.zoneColor(z.id)}" opacity=".10"/><line x1="0" y1="0" x2="0" y2="9" stroke="${this.zoneColor(z.id)}" stroke-width="2.2" opacity=".55"/></pattern>`).join('')}
        <marker id="arr" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="currentColor"/></marker>`;

      this.roomEls = {}; this.openEls = {}; this.devEls = {};

      // toiture technique : ventilateurs, CTA
      this.buildRoof(svg, W);

      b.levels.forEach((L, li) => {
        const g = el('g', { transform: `translate(${PAD},${this.levelY[li]})`, class: 'level' }, svg);
        const lab = el('text', { x: 0, y: -16, class: 'lvl-label' }, g);
        lab.textContent = 'NIVEAU ' + L.name;
        // cartouche, nord, échelle : comme sur un plan d'intervention
        const cw = 250, cx0 = L.w * K - cw;
        const ct = el('g', { class: 'cartouche', transform: `translate(${cx0},-46)` }, g);
        el('rect', { width: cw, height: 34 }, ct);
        el('line', { x1: 168, x2: 168, y1: 0, y2: 34 }, ct);
        el('text', { x: 6, y: 13, class: 'ct-t' }, ct).textContent = 'PLAN D\'INTERVENTION — ' + L.name;
        el('text', { x: 6, y: 27, class: 'ct-s' }, ct).textContent = b.name.toUpperCase().slice(0, 30);
        el('text', { x: 174, y: 13, class: 'ct-s' }, ct).textContent = 'Éch. 1/200';
        el('text', { x: 174, y: 27, class: 'ct-s' }, ct).textContent = 'SSI cat. ' + b.category;
        const nb = el('g', { class: 'north', transform: `translate(${cx0 - 24},-30)` }, g);
        el('path', { d: 'M0,-14 L6,6 L0,2 L-6,6 Z' }, nb);
        el('text', { x: 0, y: 17, 'text-anchor': 'middle' }, nb).textContent = 'N';
        const sb = el('g', { class: 'scalebar', transform: `translate(${cx0 - 40 - 5 * K},-24)` }, g);
        el('rect', { width: 2.5 * K, height: 4, class: 'sb-a' }, sb);
        el('rect', { x: 2.5 * K, width: 2.5 * K, height: 4, class: 'sb-b' }, sb);
        el('text', { x: 0, y: -4 }, sb).textContent = '0';
        el('text', { x: 5 * K, y: -4, 'text-anchor': 'end' }, sb).textContent = '5 m';
        el('rect', { x: -2, y: -2, width: L.w * K + 4, height: L.h * K + 4, class: 'slab' }, g);
        const gRooms = el('g', {}, g), gSmoke = el('g', { class: 'smoke-layer' }, g), gWalls = el('g', {}, g),
          gOpen = el('g', {}, g), gDev = el('g', {}, g), gTxt = el('g', {}, g);
        L.rooms.forEach(r => {
          const x = r.x * K, y0 = r.y * K, w = r.w * K, hh = r.h * K;
          const grp = el('g', { class: 'room k-' + r.kind, 'data-room': r.id }, gRooms);
          el('rect', { x, y: y0, width: w, height: hh, class: 'room-base' }, grp);
          if (r.kind === 'stair') {
            el('rect', { x, y: y0, width: w, height: hh, fill: 'url(#hatch)', opacity: .7, 'pointer-events': 'none' }, grp);
            for (let i = 1; i < 10; i++) el('line', { x1: x + 4, x2: x + w - 4, y1: y0 + hh * 0.18 + i * hh * 0.064, y2: y0 + hh * 0.18 + i * hh * 0.064, class: 'step' }, grp);
          }
          const heat = el('rect', { x, y: y0, width: w, height: hh, class: 'heat', opacity: 0 }, gSmoke);
          const smoke = el('rect', { x, y: y0, width: w, height: hh, class: 'smoke', opacity: 0 }, gSmoke);
          const fire = el('g', { class: 'fire', opacity: 0 }, gSmoke);
          const cx = x + w / 2, cy = y0 + hh / 2;
          el('circle', { cx, cy, r: 10, fill: 'url(#flame)', class: 'flame' }, fire);
          el('rect', { x, y: y0, width: w, height: hh, class: 'wall' }, gWalls);
          const circ = r.kind === 'circ' || r.kind === 'hall';
          const name = el('text', { x: circ ? x + 8 : x + w / 2, y: y0 + 13, 'text-anchor': circ ? 'start' : 'middle', class: 'room-name' + (w < 90 ? ' tiny' : '') }, gTxt);
          name.textContent = (r.kind === 'stair' ? 'ESC.' : w < 90 ? r.name.replace('Ch. ', 'CH ') : r.name).toUpperCase();
          if (r.kind === 'stair') { const ar = el('path', { d: `M${x + w / 2},${y0 + hh - 14} V${y0 + 30}`, class: 'stair-arrow', 'marker-end': 'url(#arr)' }, gTxt); }
          const occ = el('text', { x: x + w - 4, y: y0 + hh - 5, class: 'occ', 'text-anchor': 'end' }, gTxt);
          if (r.zd) {
            el('rect', { x: x + 1.5, y: y0 + 1.5, width: w - 3, height: hh - 3, class: 'zone-tint', fill: 'url(#zh-' + r.zd + ')' }, gRooms).style.pointerEvents = 'none';
            const zl = el('text', { x: x + 4, y: y0 + hh - 5, class: 'zone-label' }, gTxt);
            zl.textContent = r.zd;
          }
          const mark = el('text', { x: x + w / 2, y: y0 + hh / 2 + 9, class: 'mark', 'text-anchor': 'middle' }, gTxt);
          this.roomEls[r.id] = { grp, smoke, heat, fire, flame: fire.firstChild, occ, cx, cy, w, hh, mark };
          grp.addEventListener('click', ev => this.h.onRoom(r.id, ev));
        });
        // ouvertures
        b.openings.filter(o => s.levelOf[o.a] === li).forEach(o => this.buildOpening(gOpen, o));
        // équipements
        b.devices.filter(d => s.levelOf[d.room] === li).forEach(d => this.buildDevice(gDev, d));
      });

      // marqueurs dynamiques
      this.agentEl = el('text', { class: 'agent', opacity: 0 }, svg);
      this.agentEl.textContent = '🧑‍🚒';
      this.firemenEl = el('g', { class: 'firemen', opacity: 0 }, svg);
      const fmText = el('text', { x: PAD, y: Ht - 2, class: 'firemen-txt' }, this.firemenEl);
      fmText.textContent = '🚒 Sapeurs-pompiers sur place';
      this.root.appendChild(svg);
    }

    buildRoof(svg, W) {
      const s = this.sim, b = s.b;
      const g = el('g', { transform: `translate(${PAD},${PAD - 8})`, class: 'roof' }, svg);
      const items = [...Object.values(s.fans).map(f => ({ id: f.def.id, name: f.def.name, kind: 'fan', role: f.def.role })), ...(s.cta ? [{ id: s.cta.def.id, name: s.cta.def.name, kind: 'cta' }] : [])];
      if (!items.length) {
        const t = el('text', { x: 0, y: 30, class: 'roof-label' }, g);
        t.textContent = 'Toiture — pas de ventilation mécanique';
        return;
      }
      el('line', { x1: 0, x2: W - PAD * 2, y1: 52, y2: 52, class: 'roof-line' }, g);
      const t = el('text', { x: 0, y: 8, class: 'roof-label' }, g);
      t.textContent = 'Toiture technique';
      items.forEach((it, i) => {
        const x = 150 + i * 230;
        const grp = el('g', { class: 'roof-item ' + it.kind + ' ' + (it.role || ''), 'data-id': it.id, transform: `translate(${x},28)` }, g);
        el('circle', { cx: 0, cy: 0, r: 17, class: 'fan-ring' }, grp);
        const blades = el('g', { class: 'blades' }, grp);
        for (let k = 0; k < 4; k++) el('path', { d: 'M0,0 C4,-6 4,-12 0,-14 C-3,-10 -3,-5 0,0', transform: `rotate(${k * 90})`, class: 'blade' }, blades);
        const lab = el('text', { x: 24, y: -2, class: 'roof-name' }, grp);
        lab.textContent = it.name;
        const st = el('text', { x: 24, y: 12, class: 'roof-state' }, grp);
        this.devEls['roof:' + it.id] = { grp, st, kind: it.kind };
        grp.addEventListener('click', ev => this.h.onFan(it.id, it.kind, ev));
      });
    }

    buildOpening(g, o) {
      const x = o.x * K, y = o.y * K, L = o.len * K;
      const grp = el('g', { class: 'opening k-' + o.kind + (o.locked ? ' locked' : ''), 'data-op': o.id }, g);
      const vertical = o.o === 'v';
      // trou dans la cloison
      el('line', vertical ? { x1: x, x2: x, y1: y, y2: y + L, class: 'gap' } : { x1: x, x2: x + L, y1: y, y2: y, class: 'gap' }, grp);
      const closed = el('line', vertical ? { x1: x, x2: x, y1: y, y2: y + L, class: 'leaf-closed' } : { x1: x, x2: x + L, y1: y, y2: y, class: 'leaf-closed' }, grp);
      // vantail ouvert (perpendiculaire) + arc
      const dir = o.b === 'EXT' ? -1 : 1;
      const leaf = el('path', {
        d: vertical ? `M${x},${y} l${dir * L * 0.85},0 M${x + dir * L * 0.85},${y} A${L * 0.85},${L * 0.85} 0 0 ${dir > 0 ? 1 : 0} ${x},${y + L * 0.85}`
          : `M${x},${y} l0,${dir * L * 0.85} M${x},${y + dir * L * 0.85} A${L * 0.85},${L * 0.85} 0 0 ${dir > 0 ? 0 : 1} ${x + L * 0.85},${y}`,
        class: 'leaf-open'
      }, grp);
      let badge = null;
      if (o.kind === 'cf_auto') {
        badge = el('text', vertical ? { x: x + 4, y: y + L + 10, class: 'op-badge' } : { x: x + L + 3, y: y - 4, class: 'op-badge' }, grp);
        badge.textContent = 'CF';
      }
      const icon = el('text', vertical ? { x: x + (o.b === 'EXT' ? -14 : 4), y: y - 3, class: 'op-icon' } : { x: x + L / 2 - 6, y: y + (o.b === 'EXT' ? 14 : -4), class: 'op-icon' }, grp);
      const hit = el('rect', vertical ? { x: x - 7, y: y - 2, width: 14, height: L + 4, class: 'hit' } : { x: x - 2, y: y - 7, width: L + 4, height: 14, class: 'hit' }, grp);
      hit.addEventListener('click', ev => { ev.stopPropagation(); this.h.onOpening(o.id, ev); });
      this.openEls[o.id] = { grp, closed, leaf, icon, badge };
    }

    buildDevice(g, d) {
      const x = d.x * K, y = d.y * K;
      const grp = el('g', { class: 'dev t-' + d.type + (d.sdad ? ' sdad' : '') + (d.mode ? ' m-' + d.mode : '') + (d.role ? ' r-' + d.role : ''), 'data-dev': d.id, transform: `translate(${x},${y})` }, g);
      switch (d.type) {
        case 'DI':
          el('circle', { r: 6.5, class: 'body' }, grp);
          el('text', { y: 2.6, class: 'sym', 'text-anchor': 'middle' }, grp).textContent = d.sdad ? 'A' : 'DI';
          break;
        case 'DM':
          el('rect', { x: -6, y: -6, width: 12, height: 12, rx: 1.5, class: 'body' }, grp);
          el('circle', { r: 2.8, class: 'glass' }, grp);
          break;
        case 'DMV':
          el('rect', { x: -6, y: -6, width: 12, height: 12, rx: 1.5, class: 'body' }, grp);
          el('circle', { r: 2.8, class: 'glass' }, grp);
          break;
        case 'DS':
          el('path', { d: 'M-6,-3 h4 l5,-4 v14 l-5,-4 h-4 z', class: 'body' }, grp);
          el('path', { d: 'M5,-5 q4,5 0,10 M8,-8 q7,8 0,16', class: 'waves' }, grp);
          break;
        case 'VD': case 'VA':
          el('rect', { x: -9, y: -4, width: 18, height: 8, class: 'body' }, grp);
          el('path', { d: d.type === 'VD' ? 'M0,3 V-12' : 'M0,-3 V12', class: 'flow', 'marker-end': 'url(#arr)' }, grp);
          el('text', { y: 3, x: -6, class: 'sym small' }, grp).textContent = d.mode === 'meca' ? 'M' : 'N';
          break;
        case 'OUV':
          el('rect', { x: -9, y: -3, width: 18, height: 6, class: 'body' }, grp);
          el('line', { x1: -9, y1: 0, x2: 7, y2: -12, class: 'sash' }, grp);
          break;
        case 'EXU':
          el('rect', { x: -9, y: -9, width: 18, height: 18, class: 'body' }, grp);
          el('path', { d: 'M-9,-9 L9,9 M9,-9 L-9,9', class: 'cross' }, grp);
          break;
        case 'CLAPET':
          el('circle', { r: 7, class: 'body' }, grp);
          el('path', { d: 'M-5,-5 L5,5 M-5,5 L5,-5', class: 'cross' }, grp);
          break;
        case 'BAASMA':
          el('rect', { x: -7, y: -6, width: 14, height: 12, rx: 2, class: 'body' }, grp);
          el('text', { y: 3, class: 'sym', 'text-anchor': 'middle' }, grp).textContent = 'Ma';
          break;
        case 'DCM':
          el('rect', { x: -7, y: -6, width: 14, height: 12, rx: 1.5, class: 'body' }, grp);
          el('text', { y: 3.4, class: 'sym', 'text-anchor': 'middle' }, grp).textContent = 'D';
          break;
      }
      el('circle', { r: 11, class: 'hitc' }, grp);
      grp.addEventListener('click', ev => { ev.stopPropagation(); this.h.onDevice(d.id, ev); });
      this.devEls[d.id] = { grp };
    }

    /* ------------------------------------------------------------------ */
    zoneColor(zd) {
      const pal = ['#2f80c8', '#c8102e', '#12924a', '#b68600', '#7b3fb2', '#0f8a8a', '#d1497c', '#5a6b7a', '#e07a00', '#3f5bd1', '#6c8f1a', '#a0522d'];
      const ids = this.sim.b.zd.map(z => z.id);
      const i = ids.indexOf(zd);
      return pal[(i < 0 ? 0 : i) % pal.length];
    }
    setZones(on) { this.svg.classList.toggle('zones-on', on); }

    update(blink) {
      if (this.hidden) return this.updateHidden();
      this.svg.classList.remove('hidden-view');
      const s = this.sim;
      Object.entries(this.roomEls).forEach(([id, e]) => {
        const r = s.rooms[id];
        e.mark.textContent = this.marks && this.marks[id] ? this.marks[id] : '';
        const sm = r.s < 0.01 ? 0 : 0.1 + r.s * 0.78;
        e.smoke.setAttribute('opacity', sm.toFixed(3));
        e.heat.setAttribute('opacity', clampN((r.T - 60) / 900, 0, 0.55).toFixed(3));
        const f = r.fire;
        if (f && f.stage !== 'éteint' && f.Q > 0) {
          const rad = Math.min(Math.sqrt(f.Q) * 1.4 + 6, Math.min(e.w, e.hh) * (f.stage === 'développé' ? 0.75 : 0.45));
          e.flame.setAttribute('r', rad.toFixed(1));
          e.fire.setAttribute('opacity', 1);
          e.fire.classList.toggle('big', f.stage === 'développé');
        } else e.fire.setAttribute('opacity', 0);
        const occ = Math.ceil(r.occ - 0.01);
        e.occ.textContent = occ > 0 ? '● ' + occ : (r.occ0 > 0 ? '✓' : '');
        e.occ.classList.toggle('blocked', !!r.blocked && occ > 0);
        e.occ.classList.toggle('done', occ <= 0);
        e.grp.classList.toggle('alarm', this.roomInAlarm(id));
      });
      Object.entries(this.openEls).forEach(([id, e]) => {
        const o = s.openings[id];
        const open = o.open || o.burnt;
        e.closed.style.display = open ? 'none' : '';
        e.leaf.style.display = open ? '' : 'none';
        e.grp.classList.toggle('is-open', open);
        e.grp.classList.toggle('wedged', o.wedged);
        e.grp.classList.toggle('burnt', o.burnt);
        e.grp.classList.toggle('transit', !!(o.das && o.das.state === 'TR'));
        e.icon.textContent = o.wedged ? '▲' : (o.def.locked ? (o.locked ? '🔒' : '🔓') : '');
      });
      Object.entries(this.devEls).forEach(([id, e]) => {
        if (id.startsWith('roof:')) {
          const rid = id.slice(5);
          if (e.kind === 'fan') {
            const f = s.fans[rid];
            e.grp.classList.toggle('run', f.run);
            e.grp.classList.toggle('fault', !!f.fault && this.showFaults);
            e.st.textContent = f.fault ? 'EN PANNE' : f.pompier ? 'Arrêt pompiers' : f.run ? 'En marche' : 'À l\'arrêt';
          } else {
            const on = s.cta.on && s.power.secteur;
            e.grp.classList.toggle('run', on);
            e.st.textContent = on ? 'En marche (confort)' : 'Arrêtée';
          }
          return;
        }
        const d = s.devices[id];
        const g = e.grp;
        if (d.def.type === 'DI') {
          g.classList.toggle('alarm', d.state === 'alarme');
          g.classList.toggle('blinkon', d.state === 'alarme' && blink);
          g.classList.toggle('faulty', !!d.fault && this.showFaults);
        } else if (d.def.type === 'DM' || d.def.type === 'DCM' || d.def.type === 'BAASMA') {
          g.classList.toggle('pressed', d.state === 'actionne');
          g.classList.toggle('blinkon', d.state === 'actionne' && blink);
        } else if (d.def.type === 'DS') {
          g.classList.toggle('active', s.uga.state === 'ag' && !d.fault);
          g.classList.toggle('faulty', !!d.fault && this.showFaults);
        } else if (d.das) {
          g.classList.toggle('ps', d.das.state === 'PS');
          g.classList.toggle('tr', d.das.state === 'TR');
          g.classList.toggle('faulty', !!d.das.fault && this.showFaults);
          const fan = d.def.mode === 'meca' && Object.values(s.fans).some(f => f.run && f.def.zfs.includes(d.def.zs) && (f.def.role === 'extraction') === (d.def.type === 'VD'));
          g.classList.toggle('flowing', d.das.state === 'PS' && (d.def.mode !== 'meca' || fan));
        }
      });
      // agent en levée de doute
      const a = s.agent;
      if (a && (!a.done || s.t - a.eta < 90)) {
        const r = this.roomEls[a.room];
        const li = s.rooms[a.room].level;
        const p = a.done ? { x: r.cx, y: r.cy } : { x: 30, y: s.b.levels[li].h * K - 20 };
        this.agentEl.setAttribute('x', PAD + p.x - 8);
        this.agentEl.setAttribute('y', this.levelY[li] + p.y + 6);
        this.agentEl.setAttribute('opacity', 1);
      } else this.agentEl.setAttribute('opacity', 0);
      this.firemenEl.setAttribute('opacity', s.firemen.onSite ? 1 : 0);
    }

    updateHidden() {
      const s = this.sim;
      this.svg.classList.add('hidden-view');
      Object.entries(this.roomEls).forEach(([id, e]) => {
        e.smoke.setAttribute('opacity', 0); e.heat.setAttribute('opacity', 0); e.fire.setAttribute('opacity', 0);
        e.occ.textContent = ''; e.grp.classList.remove('alarm');
        e.mark.textContent = this.marks && this.marks[id] ? this.marks[id] : '';
      });
      Object.values(this.openEls).forEach(e => {
        e.closed.style.display = 'none'; e.leaf.style.display = 'none';
        e.grp.classList.remove('is-open', 'wedged', 'burnt', 'transit');
        e.icon.textContent = '';
      });
      Object.entries(this.devEls).forEach(([id, e]) => {
        e.grp.classList.remove('alarm', 'blinkon', 'faulty', 'pressed', 'active', 'ps', 'tr', 'flowing', 'run', 'fault');
        if (e.st) e.st.textContent = '?';
      });
      const a = s.agent;
      if (a && (!a.done || s.t - a.eta < 90)) {
        const r = this.roomEls[a.room], li = s.rooms[a.room].level;
        const p = a.done ? { x: r.cx, y: r.cy } : { x: 30, y: s.b.levels[li].h * K - 20 };
        this.agentEl.setAttribute('x', PAD + p.x - 8); this.agentEl.setAttribute('y', this.levelY[li] + p.y + 6); this.agentEl.setAttribute('opacity', 1);
      } else this.agentEl.setAttribute('opacity', 0);
      this.firemenEl.setAttribute('opacity', s.firemen.onSite ? 1 : 0);
    }

    roomInAlarm(id) {
      const s = this.sim;
      return Object.values(s.devices).some(d => d.def.type === 'DI' && d.def.room === id && d.state === 'alarme' && !d.def.sdad);
    }

    scrollToLevel(li) {
      const svg = this.svg;
      const ratio = svg.clientWidth / svg.viewBox.baseVal.width;
      this.root.scrollTo({ top: (this.levelY[li] - 40) * ratio, behavior: 'smooth' });
    }
  }
  function clampN(v, a, b) { return v < a ? a : v > b ? b : v; }

  window.SSIPlan = Plan;
})();

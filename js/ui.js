/* =========================================================
   FLAGGED – Benutzeroberfläche
   ========================================================= */
(function () {
  const { CARDS, HEROES, CLASS_INFO } = window.FX_CARDS;
  const { ICONS, SIGILS, renderText } = window.FX_ICONS;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  const COLS = 'ABCDEFGH';
  const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  /* ---------------- Sound (synthetisch, WebAudio) ---------------- */
  const SFX = {
    ctx: null, on: true, vol: 0.32,
    init() { try { this.on = localStorage.getItem('flagged.sound') !== 'off'; } catch (e) { } },
    ac() { if (!this.ctx) { try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; } } if (this.ctx.state === 'suspended') this.ctx.resume(); return this.ctx; },
    toggle() { this.on = !this.on; try { localStorage.setItem('flagged.sound', this.on ? 'on' : 'off'); } catch (e) { } return this.on; },
    noise(dur, freq, q, gain, type = 'lowpass', sweep) {
      const a = this.ac(); if (!a || !this.on) return;
      const len = Math.floor(a.sampleRate * dur); const b = a.createBuffer(1, len, a.sampleRate); const d = b.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2);
      const s = a.createBufferSource(); s.buffer = b;
      const f = a.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
      if (sweep) f.frequency.exponentialRampToValueAtTime(sweep, a.currentTime + dur);
      const g = a.createGain(); g.gain.value = gain * this.vol;
      s.connect(f); f.connect(g); g.connect(a.destination); s.start();
    },
    tone(freq, dur, type = 'sine', gain = 0.4, slide, delay = 0) {
      const a = this.ac(); if (!a || !this.on) return;
      const t = a.currentTime + delay;
      const o = a.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t);
      if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
      const g = a.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain * this.vol, t + 0.015); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(a.destination); o.start(t); o.stop(t + dur + 0.05);
    },
    play(kind) {
      if (!this.on) return;
      switch (kind) {
        case 'step': this.noise(0.12, 380, 1, 0.5); break;
        case 'wall': this.tone(70, 0.3, 'sine', 0.8, 45); this.noise(0.25, 600, 0.7, 0.6); break;
        case 'break': this.noise(0.5, 1400, 0.6, 0.9, 'lowpass', 200); this.tone(55, 0.4, 'triangle', 0.6, 30); break;
        case 'card': this.noise(0.28, 900, 0.8, 0.45, 'bandpass', 3200); break;
        case 'capture': this.tone(220, 0.5, 'square', 0.18, 110); this.tone(331, 0.45, 'triangle', 0.25, 160); this.noise(0.4, 3000, 0.5, 0.5, 'highpass'); this.tone(60, 0.6, 'sine', 0.9, 35); break;
        case 'flag': [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.5, 'sine', 0.35, null, i * 0.09)); break;
        case 'score': [392, 523, 659, 784, 1046, 1318].forEach((f, i) => this.tone(f, 0.7, 'triangle', 0.3, null, i * 0.08)); this.tone(98, 1.2, 'sine', 0.7); break;
        case 'teleport': this.tone(300, 0.45, 'sine', 0.35, 1400); this.tone(450, 0.4, 'triangle', 0.15, 2000); break;
        case 'counter': this.tone(1600, 0.25, 'sawtooth', 0.14, 200); this.noise(0.3, 2500, 1, 0.4, 'bandpass'); break;
        case 'turn': this.tone(110, 1.4, 'sine', 0.55, 104); this.tone(165, 1.2, 'sine', 0.25); break;
        case 'snare': this.tone(1800, 0.3, 'sine', 0.2, 2600); this.tone(2400, 0.3, 'sine', 0.12, 3200, 0.05); break;
        case 'trap': this.noise(0.18, 2200, 2, 0.8, 'bandpass'); this.tone(140, 0.25, 'square', 0.25, 70); break;
        case 'win': [262, 330, 392, 523, 659, 784].forEach((f, i) => this.tone(f, 1.4, 'triangle', 0.3, null, i * 0.12)); break;
        case 'lose': [220, 207, 196, 174].forEach((f, i) => this.tone(f, 1.0, 'sawtooth', 0.12, null, i * 0.25)); break;
        case 'click': this.tone(880, 0.06, 'triangle', 0.15); break;
        case 'boss': this.tone(55, 2.2, 'sawtooth', 0.25, 40); this.noise(1.6, 300, 0.7, 0.6, 'lowpass', 80); break;
      }
    }
  };
  SFX.init();

  /* ---------------- Karten-Darstellung ---------------- */
  function artSVG(art) { return SIGILS[art] || ICONS[art] || SIGILS.eye; }
  function typeEmblem(d) {
    if (d.types.includes('ultimate')) return `<div class="c-emb ult" title="Ultimate">${SIGILS.crystal}</div>`;
    if (d.types.includes('klasse')) return `<div class="c-emb kls" title="Klassenkarte"><span>K</span></div>`;
    if (d.types.includes('team')) return `<div class="c-emb team" title="Teamkarte"><span>T</span></div>`;
    return '';
  }
  function cardHTML(card, o = {}) {
    const d = card.name ? card : CARDS[card.id];
    const ci = CLASS_INFO[d.cls];
    const tags = [];
    if (d.types.includes('klasse')) tags.push('Klasse');
    if (d.types.includes('standard')) tags.push('Standard');
    if (d.types.includes('ultimate')) tags.push('Ultimate');
    if (d.types.includes('konter')) tags.push('Konter');
    if (d.types.includes('trap')) tags.push('Falle');
    const extra = [];
    if (d.trigger) extra.push(`<div class="c-trig"><b>⚡ Bedingung:</b> ${renderText(d.trigger)}</div>`);
    return `<div class="card cls-${d.cls}${d.types.includes('konter') ? ' konter' : ''}${d.types.includes('ultimate') ? ' ultimate' : ''} ${o.cls || ''}" style="--cc:${ci.color};--cc2:${ci.color2}" data-uid="${card.uid || ''}" data-id="${d.id}">
      <div class="c-frame">
        <div class="c-gem"></div>
        ${typeEmblem(d)}
        ${d.types.includes('konter') ? `<div class="c-kon" title="Konterkarte">${ICONS.MOVE ? '<svg viewBox="0 0 24 24"><path d="M13.5 2L5 13.5H11L9.5 22L19 9.5H13Z" fill="#ffe08a" stroke="#7a4b00" stroke-width="1"/></svg>' : '⚡'}</div>` : ''}
        <div class="c-art"><div class="c-art-glow"></div>${artSVG(d.art)}</div>
        <div class="c-name">${esc(d.name)}</div>
        <div class="c-text">${extra.join('')}<div class="c-eff">${renderText(d.text)}</div></div>
        <div class="c-foot"><span>${d.id}/110</span><span>${tags.join(' · ')}</span></div>
      </div>
    </div>`;
  }
  function heroCardHTML(cls, o = {}) {
    const h = HEROES[cls]; const ci = CLASS_INFO[cls];
    return `<div class="card hero cls-${cls} ${o.cls || ''}" style="--cc:${ci.color};--cc2:${ci.color2}">
      <div class="c-frame">
        <div class="c-gem"></div>
        <div class="c-art"><div class="c-art-glow"></div>${SIGILS[ci.sigil]}</div>
        <div class="c-name">${h.name}${ci.alt !== h.name ? ` <small>· ${ci.alt}</small>` : ''}</div>
        <div class="c-text"><div class="c-eff">${renderText(h.text)}</div></div>
        <div class="c-foot"><span>Held ${h.id}</span><span>Heldenkarte</span></div>
      </div>
    </div>`;
  }
  function cardBackHTML(o = {}) {
    return `<div class="card back ${o.cls || ''}"><div class="c-frame"><div class="cb-eye">${SIGILS.eye}</div><div class="cb-title">FLAGGED</div></div></div>`;
  }

  /* ---------------- UI-Objekt ---------------- */
  const UI = {
    g: null, sel: null, wallMode: false, shiftMode: null, pending: null, knownUids: new Set(),
    noAskTurn: -1, mode: 'game', puzzle: null,

    init() {
      this.board = $('#board');
      this.layers = {};
      for (const k of ['squares', 'marks', 'walls', 'figs', 'edges', 'fxl']) {
        const d = document.createElement('div'); d.className = 'layer ' + k; this.board.appendChild(d); this.layers[k] = d;
      }
      for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
        const s = document.createElement('div'); s.className = 'sq'; s.style.left = c * 12.5 + '%'; s.style.top = r * 12.5 + '%';
        s.dataset.x = c; s.dataset.y = 7 - r; this.layers.squares.appendChild(s);
      }
      const art = window.FX_BOARDART.get();
      const cv = $('#board canvas.board-art');
      cv.width = art.width; cv.height = art.height; cv.getContext('2d').drawImage(art, 0, 0);
      // Koordinaten
      const mk = (cls, arr) => { const d = $(cls); d.innerHTML = arr.map(t => `<span>${t}</span>`).join(''); };
      mk('.coords.top', [...COLS]); mk('.coords.bottom', [...COLS]);
      mk('.coords.left', [8, 7, 6, 5, 4, 3, 2, 1]); mk('.coords.right', [8, 7, 6, 5, 4, 3, 2, 1]);

      this.board.addEventListener('click', (e) => this.onBoardClick(e));
      this.board.addEventListener('mouseover', (e) => this.onBoardHover(e));
      this.board.addEventListener('mouseleave', () => this.clearPath());
      $('#my-hand').addEventListener('click', (e) => { const c = e.target.closest('.card'); if (c) this.openHandCard(c.dataset.uid); });
      $('#panel-right').addEventListener('click', (e) => this.onPanelClick(e));
      $('#panel-left').addEventListener('click', (e) => this.onPanelClick(e));
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') { if ($('#zoom').classList.contains('open')) this.closeZoom(); else { this.wallMode = false; this.shiftMode = null; this.sel = null; this.render(); } }
      });
      $('#zoom').addEventListener('click', (e) => { if (e.target.id === 'zoom' || e.target.closest('[data-act=close]')) this.closeZoom(); });
      // Tooltip für Symbole
      const tip = $('#tip');
      document.addEventListener('mouseover', (e) => {
        const t = e.target.closest('[data-tip]');
        if (!t) { tip.classList.remove('show'); return; }
        tip.textContent = t.dataset.tip; tip.classList.add('show');
        const r = t.getBoundingClientRect();
        tip.style.left = Math.min(window.innerWidth - 260, Math.max(8, r.left + r.width / 2 - 120)) + 'px';
        tip.style.top = (r.top - 40 < 8 ? r.bottom + 8 : r.top - 40) + 'px';
      });
    },

    attach(g) {
      this.g = g; this.sel = null; this.wallMode = false; this.shiftMode = null; this.pending = null; this.knownUids = new Set();
      $('#log').innerHTML = '';
      this.layers.figs.innerHTML = ''; this.layers.fxl.innerHTML = '';
      this.render();
    },

    /* ---------- Koordinaten ---------- */
    pos(x, y) { return { left: x * 12.5, top: (7 - y) * 12.5 }; },

    /* ---------- Rendering ---------- */
    render() {
      const g = this.g; if (!g) return;
      this.renderSquares(); this.renderMarks(); this.renderWalls(); this.renderFigs(); this.renderEdges();
      this.renderHands(); this.renderPanels(); this.renderPrompt();
    },
    myTurn() { const g = this.g; return g && g.cur === g.human && !g.over && !g.turn.skipped; },
    canAct() { return this.myTurn() && !this.g.busy && !this.pending; },

    renderSquares() {
      const g = this.g;
      const reach = (this.canAct() && this.sel) ? g.reachable(g.figs.find(f => f.id === this.sel && f.alive)) : null;
      this.reach = reach;
      const optSq = new Set();
      if (this.pending && (this.pending.req.kind === 'square')) for (const o of this.pending.req.options) optSq.add(`${o.x},${o.y}`);
      if (this.pending && this.pending.req.kind === 'figure') for (const o of this.pending.req.options) optSq.add(`${o.x},${o.y}`);
      for (const s of this.layers.squares.children) {
        const x = +s.dataset.x, y = +s.dataset.y, k = `${x},${y}`;
        let cls = 'sq';
        if (reach && reach.has(k)) cls += reach.get(k).capture ? ' cap' : ' reach';
        if (optSq.has(k)) cls += ' opt' + (this.pending.req.kind === 'figure' ? ' optfig' : '');
        if (y === 7) cls += ' goal-me'; if (y === 0) cls += ' goal-op';
        if (s.className !== cls) s.className = cls;
      }
    },
    clearPath() { $$('.sq.path', this.layers.squares).forEach(s => s.classList.remove('path')); },
    onBoardHover(e) {
      const s = e.target.closest('.sq'); this.clearPath();
      if (!s || !this.reach) return;
      const r = this.reach.get(`${s.dataset.x},${s.dataset.y}`);
      if (!r) return;
      for (const st of r.path) { const el = this.sqEl(st.x, st.y); el && el.classList.add('path'); }
    },
    sqEl(x, y) { return this.layers.squares.children[(7 - y) * 8 + x]; },

    renderMarks() {
      const g = this.g; const L = this.layers.marks; let h = '';
      for (const pt of g.portals) { const p = this.pos(pt.x, pt.y); h += `<div class="portal ${pt.owner === g.human ? 'mine' : 'theirs'}" style="left:${p.left}%;top:${p.top}%"><i></i><b></b></div>`; }
      for (const b of g.banners) { const p = this.pos(b.x, b.y); h += `<div class="bannermark" style="left:${p.left}%;top:${p.top}%">${SIGILS.banner}</div>`; }
      for (const bl of g.blocks) for (const s of bl.squares) { const p = this.pos(s.x, s.y); h += `<div class="blockmark ${bl.owner === g.human ? 'mine' : ''}" style="left:${p.left}%;top:${p.top}%">${SIGILS.rune}</div>`; }
      for (const t of g.traps) if (t.owner === g.human) { const p = this.pos(t.x, t.y); h += `<div class="trapmark" style="left:${p.left}%;top:${p.top}%" data-tip="Deine verdeckte Falle: ${esc(CARDS[t.card.id].name)}">${ICONS.TRAP}</div>`; }
      for (const c of g.clouds) {
        const x0 = Math.max(0, c.x - c.r), x1 = Math.min(7, c.x + c.r), y0 = Math.max(0, c.y - c.r), y1 = Math.min(7, c.y + c.r);
        const p = this.pos(x0, y1);
        h += `<div class="cloud ${c.kind}" style="left:${p.left}%;top:${p.top}%;width:${(x1 - x0 + 1) * 12.5}%;height:${(y1 - y0 + 1) * 12.5}%"><i></i><i></i><i></i></div>`;
      }
      // Flaggen an den Rändern
      const fTop = g.P(g.human).carrying, fBot = g.P(1 - g.human).carrying;
      $('#flag-top').className = 'flagpost top' + (fTop ? ' taken' : '');
      $('#flag-bottom').className = 'flagpost bottom' + (fBot ? ' taken' : '');
      if (L._h !== h) { L.innerHTML = h; L._h = h; }
    },

    renderWalls() {
      const g = this.g; const L = this.layers.walls;
      const pickWalls = this.pending && this.pending.req.kind === 'wall' ? new Set(this.pending.req.options) : null;
      const shiftable = this.shiftMode === 'pick' ? new Set([...g.walls.keys()].filter(k => g.wallShiftTargets(k, 1).length)) : null;
      let h = '';
      for (const [k, w] of g.walls) {
        const [t, xs, ys] = k.split(','); const x = +xs, y = +ys;
        let st;
        if (t === 'h') { const p = this.pos(x, y); st = `left:${p.left}%;top:${p.top - 1.3}%`; }
        else { const p = this.pos(x, y); st = `left:${p.left + 12.5 - 1.3}%;top:${p.top}%`; }
        const opt = (pickWalls && pickWalls.has(k)) || (shiftable && shiftable.has(k)) || (this.shiftMode && this.shiftMode.from === k);
        h += `<div class="wall ${t} ${w.owner === g.human ? 'mine' : 'theirs'}${opt ? ' opt' : ''}${this.shiftMode && this.shiftMode.from === k ? ' chosen' : ''}" data-key="${k}" style="${st}"></div>`;
      }
      if (L._h !== h) { L.innerHTML = h; L._h = h; }
    },

    renderEdges() {
      const g = this.g; const L = this.layers.edges;
      let keys = null, cls = 'edge';
      if (this.pending && this.pending.req.kind === 'edge') keys = this.pending.req.options;
      else if (this.shiftMode && this.shiftMode.from) keys = g.wallShiftTargets(this.shiftMode.from, 1);
      else if (this.wallMode && this.canAct() && g.turn.wallsUsed < g.turn.walls) keys = g.legalWallEdges(g.human);
      let h = '';
      if (keys) for (const k of keys) {
        const [t, xs, ys] = k.split(','); const x = +xs, y = +ys; const p = this.pos(x, y);
        const st = t === 'h' ? `left:${p.left}%;top:${p.top - 2.6}%` : `left:${p.left + 12.5 - 2.6}%;top:${p.top}%`;
        h += `<div class="${cls} ${t}" data-key="${k}" style="${st}"><i></i></div>`;
      }
      L.classList.toggle('active', !!keys);
      if (L._h !== h) { L.innerHTML = h; L._h = h; }
    },

    figVisual(f) {
      const g = this.g; const P = g.P(f.owner); const own = f.owner === g.human;
      const hidden = !own && !P.heroKnown && f.kind !== 'wolf';
      let sig, label = '', extra = '';
      if (f.kind === 'wolf') sig = ICONS.BEGLEITER;
      else if (hidden) { sig = SIGILS.hood; label = '?'; }
      else if (f.kind === 'clone') { sig = SIGILS.hood; label = 'K'; }
      else sig = SIGILS[CLASS_INFO[P.cls].sigil];
      if (f.kind === 'hero' && (own || P.heroKnown) && g.clonesOf(f.owner).length) extra += `<div class="crown">${'<svg viewBox="0 0 24 24"><path d="M3 18L5 7L9.5 12L12 5L14.5 12L19 7L21 18Z" fill="#f2c96a" stroke="#6b4300" stroke-width="1"/></svg>'}</div>`;
      if (f.kind === 'hero' && P.carrying) extra += `<div class="flagc">${ICONS.FLAG}</div>`;
      if (f.kind === 'hero' && P.wolfMode) extra += `<div class="wolfm">${ICONS.BEGLEITER}</div>`;
      return { sig, label, extra, hidden };
    },
    renderFigs() {
      const g = this.g; const L = this.layers.figs;
      const alive = new Set();
      for (const f of g.figs) {
        let el = L.querySelector(`[data-fid="${f.id}"]`);
        if (!f.alive) { if (el && !el.classList.contains('dying')) { el.classList.add('dying'); setTimeout(() => el.remove(), 900); } continue; }
        alive.add(String(f.id));
        if (!el) { el = document.createElement('div'); el.dataset.fid = f.id; L.appendChild(el); el.classList.add('spawn'); setTimeout(() => el.classList.remove('spawn'), 700); }
        const v = this.figVisual(f);
        const p = this.pos(f.x, f.y);
        el.style.left = p.left + '%'; el.style.top = p.top + '%';
        const P = g.P(f.owner);
        const movable = this.canAct() && f.owner === g.human && g.hasMovesLeft(f) && !g.isSnared(f);
        let cls = `fig p${f.owner === g.human ? 0 : 1} ${f.kind}${v.hidden ? ' hidden' : ''}${this.sel === f.id ? ' sel' : ''}${movable ? ' movable' : ''}${g.isSnared(f) || this.snaredSoon(f) ? ' snared' : ''}${g.isProtected(f) ? ' protected' : ''}${f.owner === g.human && f.kind === 'clone' ? ' ownclone' : ''}`;
        if (el.classList.contains('spawn')) cls += ' spawn';
        const html = `<div class="base"></div><div class="tok">${v.sig}${v.label ? `<em>${v.label}</em>` : ''}</div>${v.extra}`;
        if (el._html !== html) { el.innerHTML = html; el._html = html; }
        if (el.className !== cls) el.className = cls;
        el.dataset.tip = (f.owner === g.human ? 'Deine ' : 'Gegnerische ') + (f.kind === 'wolf' ? 'Wolf-Figur' : v.hidden ? 'Figur (Held oder Schattenklon?)' : f.kind === 'clone' ? 'Schattenklon' : `Heldenfigur (${HEROES[P.cls].name})`) + ` · ${g.sq(f.x, f.y)}`;
      }
      for (const el of [...L.children]) if (!alive.has(el.dataset.fid) && !el.classList.contains('dying')) { el.classList.add('dying'); setTimeout(() => el.remove(), 900); }
    },
    snaredSoon(f) { const P = this.g.P(f.owner); return f.snare.has(P.turnCount + (this.g.cur === f.owner ? 0 : 1)); },
    snapFig(f) { const el = this.layers.figs.querySelector(`[data-fid="${f.id}"]`); if (el) { el.style.transition = 'none'; const p = this.pos(f.x, f.y); el.style.left = p.left + '%'; el.style.top = p.top + '%'; el.offsetWidth; el.style.transition = ''; } },

    renderHands() {
      const g = this.g; const me = g.P(g.human); const op = g.P(1 - g.human);
      const win = (g.window && this.myTurn() && !g.busy) ? g.window.list : [];
      const html = me.hand.map(c => {
        const chk = g.canPlayCard(g.human, c);
        const isWin = win.some(w => w.card === c);
        const fresh = !this.knownUids.has(c.uid);
        return cardHTML(c, { cls: `${chk.ok && this.canAct() ? 'playable' : ''}${isWin ? ' counter-ready' : ''}${fresh ? ' fresh' : ''}` });
      }).join('');
      for (const c of me.hand) this.knownUids.add(c.uid);
      const H = $('#my-hand');
      if (H._h !== html) { H.innerHTML = html; H._h = html; H.style.setProperty('--n', me.hand.length); }
      const oh = Array.from({ length: op.hand.length }, () => cardBackHTML()).join('');
      const O = $('#opp-hand');
      if (O._h !== oh) { O.innerHTML = oh; O._h = oh; }
    },

    statsHTML(p) {
      const g = this.g; const P = g.P(p); const own = p === g.human;
      const pts = [0, 1].map(i => `<span class="pt ${i < P.points ? 'on' : ''}">${ICONS.FLAG}</span>`).join('');
      const caps = Array.from({ length: 6 }, (_, i) => `<i class="${i < P.captures ? 'on' : ''}"></i>`).join('');
      const chips = [];
      if (P.carrying) chips.push(`<span class="chip gold">${ICONS.FLAG} trägt die Flagge</span>`);
      if (P.skip > 0) chips.push(`<span class="chip red">${SIGILS.hourglass} setzt ${P.skip}× aus</span>`);
      const nk = P.next[P.turnCount + 1] || {};
      if (nk.dontplay) chips.push(`<span class="chip red">${ICONS.DONT_PLAY} nächster Zug</span>`);
      if (nk.plays) chips.push(`<span class="chip green">+${nk.plays} ${ICONS.PLAY1} nächster Zug</span>`);
      if (nk.straight) chips.push(`<span class="chip green">+${nk.straight} ${ICONS.MOVEMENT_STRAIGHT} nächster Zug</span>`);
      if (P.turnCount < P.protectUntil) chips.push(`<span class="chip gold">${SIGILS.shield} geschützt</span>`);
      if (P.wolfMode) chips.push(`<span class="chip green">${ICONS.MODE} Wolfmodus</span>`);
      if (!P.heroKnown && g.clonesOf(p).length) chips.push(`<span class="chip arc">${ICONS.CLONES} Identität verborgen</span>`);
      if (!own) { const n = g.traps.filter(t => t.owner === p).length; if (n) chips.push(`<span class="chip arc">${ICONS.TRAP} ${n} verdeckte Falle${n > 1 ? 'n' : ''}</span>`); }
      if (!g.heroOf(p) && !g.over) chips.push(`<span class="chip red">${SIGILS.hood} Held geschnappt</span>`);
      const ability = (P.cls === 'knight' || P.cls === 'ranger') ? `<div class="abil ${P.abilityUsed ? 'used' : ''}">Heldenfähigkeit: ${P.abilityUsed ? 'verbraucht' : 'bereit'}</div>` : '';
      return `
        <div class="stat-row"><label>Flaggenpunkte</label><div class="pts">${pts}</div></div>
        <div class="stat-row"><label>Geschnappt</label><div class="caps">${caps}<b>${P.captures}/6</b></div></div>
        <div class="stat-grid">
          <div data-tip="Verbleibende Wände">${ICONS.WALLS}<b>${P.wallsLeft}</b></div>
          <div data-tip="Karten im Deck">${SIGILS.deck}<b>${P.deck.length}</b></div>
          <div data-tip="Ablagestapel ansehen" data-act="discard" data-p="${p}" class="click">${ICONS.M1}<b>${P.discard.length}</b></div>
          <div data-tip="Handkarten">${SIGILS.hand}<b>${P.hand.length}</b></div>
        </div>
        ${ability}
        <div class="chips">${chips.join('')}</div>`;
    },
    renderPanels() {
      const g = this.g; const me = g.human, op = 1 - me;
      const P = g.P(me), O = g.P(op);
      const lvl = { easy: 'Leicht', medium: 'Medium', hard: 'Stark', boss: 'Endboss' }[g.level];
      const lh = `
        <div class="ptitle"><span class="who enemy">Gegner</span>${g.puzzle ? '' : `<span class="lvl ${g.level}">${lvl}</span>`}</div>
        <div class="herobox" data-act="zoomhero" data-cls="${O.cls}">${heroCardHTML(O.cls, { cls: 'mini' })}</div>
        ${this.statsHTML(op)}`;
      const L = $('#panel-left .pbody');
      if (L._h !== lh) { L.innerHTML = lh; L._h = lh; }

      const t = g.turn; const my = this.myTurn();
      const hero = g.heroOf(me);
      const av = hero ? g.availPools(hero) : { straight: 0, diag: 0, horiz: 0, all: 0 };
      const mv = [];
      if (av.straight) mv.push(`${av.straight}${ICONS.MOVEMENT_STRAIGHT}`);
      if (av.diag) mv.push(`${av.diag}${ICONS.MOVEMENT_DIAGONAL}`);
      if (av.horiz) mv.push(`${av.horiz}${ICONS.MOVEMENT_HORIZONTAL}`);
      const wolf = g.wolfOf(me);
      if (wolf) { const wa = g.availPools(wolf); mv.push(`<span class="wolfpool">${ICONS.BEGLEITER}${wa.straight + wa.diag}</span>`); }
      const noPlay = t.noPlay || t.dontPlay;
      const hs = g.heroAbilityState(me);
      const win = (g.window && my && !g.busy) ? g.window.list : [];
      const inSetup = !g.puzzle && P.turnCount === 0 && O.turnCount === 0;
      const status = g.over ? (g.over.puzzle ? 'Rätsel gelöst' : g.over.winner === me ? 'Sieg!' : 'Niederlage') : inSetup ? 'Aufstellung' : my ? 'Dein Zug' : (g.cur === me && t.skipped ? 'Du setzt aus' : 'Gegner am Zug');
      const rh = `
        <div class="ptitle"><span class="who you">Du</span><span class="turnno">${g.puzzle ? 'Rätsel' : `Zug ${P.turnCount}`}</span></div>
        <div class="herobox" data-act="zoomhero" data-cls="${P.cls}">${heroCardHTML(P.cls, { cls: 'mini' })}</div>
        ${this.statsHTML(me)}
        <div class="turnpanel ${my ? 'active' : ''}">
          <div class="tp-head">${status}</div>
          <div class="tp-draw">${SIGILS.deck}<span>${g.puzzle ? 'Kein Ziehen im Rätsel' : '1 Karte ziehen'}</span><b>✓</b></div>
          <div class="tp-sub">danach – optional, Reihenfolge frei:</div>
          <div class="tp-tiles">
            <div class="tile ${my && hero && (av.straight + av.diag + av.horiz + av.all) ? '' : 'done'}"><div class="ti">${ICONS.MOVEMENT_STRAIGHT}</div><span>Bewegen</span><b>${mv.join(' ') || '0'}</b></div>
            <div class="tile ${my && !noPlay && t.playsUsed < t.plays ? '' : 'done'}"><div class="ti">${ICONS.PLAY1}</div><span>Karte spielen</span><b>${noPlay ? '✕' : `${t.playsUsed}/${t.plays}`}</b></div>
            <div class="tile ${my && t.wallsUsed < t.walls && P.wallsLeft ? '' : 'done'}"><div class="ti">${ICONS.WALLS}</div><span>Wände setzen</span><b>${t.wallsUsed}/${t.walls}</b></div>
          </div>
          ${win.length ? `<div class="tp-counter">${win.map((w, i) => `<button class="btn konter" data-act="counter" data-i="${i}">⚡ Konter: ${esc(CARDS[w.card.id].name)}</button>`).join('')}</div>` : ''}
          <div class="tp-btns">
            <button class="btn ${this.wallMode ? 'on' : ''}" data-act="wall" ${my && !g.busy && t.wallsUsed < t.walls && P.wallsLeft ? '' : 'disabled'}>${ICONS.WALL1} Wand setzen</button>
            ${(P.cls === 'knight' || P.cls === 'ranger') ? `<button class="btn" data-act="hero" ${my && !g.busy && hs.usable ? '' : 'disabled'} data-tip="${esc(HEROES[P.cls].text.replace(/\{[A-Z0-9_]+\}/g, ''))}">${SIGILS[CLASS_INFO[P.cls].sigil]} Heldenfähigkeit</button>` : ''}
            ${t.wallShifts > t.wallShiftsUsed && my ? `<button class="btn ${this.shiftMode ? 'on' : ''}" data-act="shift">${ICONS.MOVE_STRAIGHT} Wand verschieben</button>` : ''}
            ${g.mulliganAvailable && my ? `<button class="btn" data-act="mulligan" data-tip="Ganze Hand zurückmischen und 1 Karte weniger neu ziehen">↻ Mulligan</button>` : ''}
          </div>
          <button class="btn end" data-act="end" ${my && !g.busy && !this.pending ? '' : 'disabled'}>${g.puzzle ? 'Zug beenden (aufgeben)' : 'Zug beenden'}</button>
        </div>`;
      const R = $('#panel-right .pbody');
      if (R._h !== rh) { R.innerHTML = rh; R._h = rh; }
      // Kopfzeile
      const tb = $('#turn-ind');
      const setup = !g.puzzle && P.turnCount === 0 && O.turnCount === 0;
      const txt = g.over ? (g.over.puzzle ? 'Rätsel gelöst!' : g.over.winner === me ? 'Sieg' : 'Niederlage') : setup ? 'Aufstellung' : (g.cur === me ? (t.skipped ? 'Du setzt aus' : 'Dein Zug') : (t.skipped ? 'Gegner setzt aus' : 'Der Gegner ist am Zug …'));
      tb.textContent = txt; tb.className = 'turn-ind ' + (g.cur === me ? 'me' : 'op');
      $('#screen-game').classList.toggle('my-turn', this.myTurn());
    },

    renderPrompt() {
      const el = $('#board-prompt');
      let text = '', btns = '';
      if (this.pending && ['square', 'figure', 'wall', 'edge'].includes(this.pending.req.kind)) {
        text = this.pending.req.prompt + (this.pending.req.secret ? ' <em>(geheim)</em>' : '');
        if (this.pending.req.optional) btns = `<button class="btn small" data-pr="skip">Überspringen</button>`;
      } else if (this.wallMode && this.canAct()) {
        text = 'Wähle eine Kante zwischen zwei Feldern für deine Wand';
        btns = `<button class="btn small" data-pr="cancel">Abbrechen</button>`;
      } else if (this.shiftMode && this.canAct()) {
        text = this.shiftMode.from ? 'Wähle die neue Position der Wand (1 Feld)' : 'Wähle eine Wand zum Verschieben';
        btns = `<button class="btn small" data-pr="cancel">Abbrechen</button>`;
      } else if (this.myTurn() && this.g.busy) text = '';
      el.innerHTML = text ? `<span>${text}</span>${btns}` : '';
      el.classList.toggle('show', !!text);
      el.onclick = (e) => {
        const b = e.target.closest('[data-pr]'); if (!b) return;
        if (b.dataset.pr === 'skip' && this.pending) this.resolvePick(null);
        if (b.dataset.pr === 'cancel') { this.wallMode = false; this.shiftMode = null; this.render(); }
      };
    },

    /* ---------- Interaktion ---------- */
    onBoardClick(e) {
      const g = this.g; if (!g) return;
      SFX.ac();
      const edge = e.target.closest('.edge');
      const wall = e.target.closest('.wall');
      const sq = e.target.closest('.sq');
      // laufende Auswahl
      if (this.pending) {
        const req = this.pending.req;
        if (req.kind === 'edge' && edge) return this.resolvePick(edge.dataset.key);
        if (req.kind === 'wall' && wall && req.options.includes(wall.dataset.key)) return this.resolvePick(wall.dataset.key);
        const s = sq || this.squareFromPoint(e);
        if (!s) return;
        const x = +s.dataset.x, y = +s.dataset.y;
        if (req.kind === 'square') { const o = req.options.find(q => q.x === x && q.y === y); if (o) this.resolvePick(o); }
        if (req.kind === 'figure') { const o = req.options.find(f => f.alive && f.x === x && f.y === y); if (o) this.resolvePick(o); }
        return;
      }
      if (!this.canAct()) return;
      if (this.shiftMode) {
        if (!this.shiftMode.from && wall && g.wallShiftTargets(wall.dataset.key, 1).length) { this.shiftMode.from = wall.dataset.key; this.render(); return; }
        if (this.shiftMode.from && edge) { const from = this.shiftMode.from; this.shiftMode = null; g.actWallShift(from, edge.dataset.key); return; }
        return;
      }
      if (this.wallMode && edge) {
        g.actWall(edge.dataset.key).then(() => { if (g.turn.wallsUsed >= g.turn.walls || !g.P(g.human).wallsLeft) this.wallMode = false; this.render(); });
        SFX.play('wall');
        return;
      }
      const s = sq || this.squareFromPoint(e);
      if (!s) return;
      const x = +s.dataset.x, y = +s.dataset.y;
      const f = g.figAt(x, y);
      if (this.sel && this.reach && this.reach.has(`${x},${y}`)) {
        const fig = g.figs.find(q => q.id === this.sel);
        g.actMove(fig, x, y).then(() => { if (!fig.alive || !g.hasMovesLeft(fig)) this.sel = null; this.render(); });
        return;
      }
      if (f && f.owner === g.human && g.hasMovesLeft(f) && !g.isSnared(f)) { this.sel = this.sel === f.id ? null : f.id; this.wallMode = false; this.render(); return; }
      if (f && f.owner === g.human && g.isSnared(f)) this.toast('Diese Figur ist festgesetzt.');
      this.sel = null; this.render();
    },
    squareFromPoint(e) {
      const r = this.board.getBoundingClientRect();
      const c = Math.floor((e.clientX - r.left) / r.width * 8), rr = Math.floor((e.clientY - r.top) / r.height * 8);
      if (c < 0 || c > 7 || rr < 0 || rr > 7) return null;
      return this.sqEl(c, 7 - rr);
    },
    onPanelClick(e) {
      const b = e.target.closest('[data-act]'); if (!b) return;
      const g = this.g; SFX.ac(); SFX.play('click');
      const a = b.dataset.act;
      if (a === 'end') { this.wallMode = false; this.shiftMode = null; this.sel = null; g.actEndTurn(); }
      else if (a === 'wall') { this.wallMode = !this.wallMode; this.shiftMode = null; this.sel = null; this.render(); }
      else if (a === 'shift') { this.shiftMode = this.shiftMode ? null : { from: null }; this.wallMode = false; this.render(); }
      else if (a === 'hero') g.actHero();
      else if (a === 'mulligan') g.actMulligan();
      else if (a === 'counter') { const w = g.window && g.window.list[+b.dataset.i]; if (w) g.actCounter(w); }
      else if (a === 'discard') { const p = +b.dataset.p; this.showCards(g.P(p).discard.slice().reverse(), p === g.human ? 'Dein Ablagestapel' : 'Ablagestapel des Gegners', true); }
      else if (a === 'zoomhero') this.zoom(heroCardHTML(b.dataset.cls, { cls: 'big' }), `<p class="zoom-lore">${esc(HEROES[b.dataset.cls].lore)}</p>`);
    },

    openHandCard(uid) {
      const g = this.g; const card = g.P(g.human).hand.find(c => String(c.uid) === String(uid)); if (!card) return;
      const d = CARDS[card.id];
      const chk = g.canPlayCard(g.human, card);
      const win = (g.window && this.myTurn() && !g.busy) ? g.window.list.find(w => w.card === card) : null;
      let actions = '';
      if (win) actions += `<button class="btn konter big" data-z="counter">⚡ Kontern!</button>`;
      else if (d.types.includes('konter')) actions += `<p class="zoom-why">Konterkarte – spielbar, sobald ihre Bedingung erfüllt ist${this.myTurn() ? '' : ' (auch im gegnerischen Zug)'}.</p>`;
      else if (chk.ok && this.canAct()) actions += `<button class="btn gold big" data-z="play">Karte spielen</button>`;
      else actions += `<p class="zoom-why">${esc(chk.reason || (this.myTurn() ? 'Gerade nicht spielbar.' : 'Nicht dein Zug.'))}</p>`;
      const info = [d.info && `<p><b>Info:</b> ${renderText(d.info)}</p>`, d.penalty && `<p class="pen"><b>Strafe:</b> ${renderText(d.penalty)}</p>`].filter(Boolean).join('');
      this.zoom(cardHTML(card, { cls: 'big' }), `${info}<div class="zoom-actions">${actions}</div>`);
      $('#zoom .zoom-side').onclick = (e) => {
        const b = e.target.closest('[data-z]'); if (!b) return;
        this.closeZoom();
        if (b.dataset.z === 'play') { SFX.play('card'); g.actPlay(card); }
        if (b.dataset.z === 'counter') { SFX.play('counter'); g.actCounter(win); }
      };
    },
    zoom(cardHtml, side = '') {
      const z = $('#zoom');
      z.innerHTML = `<div class="zoom-inner"><div class="zoom-card">${cardHtml}</div><div class="zoom-side">${side}<button class="btn ghost" data-act="close">Schliessen</button></div></div>`;
      z.classList.add('open');
    },
    closeZoom() { $('#zoom').classList.remove('open'); },

    /* ---------- Auswahl-Anfragen der Engine ---------- */
    pick(req) {
      return new Promise((resolve) => {
        if (req.kind === 'option') return this.modalOptions(req, resolve);
        if (req.kind === 'cards') return this.modalCards(req, resolve);
        this.pending = { req, resolve };
        this.sel = null; this.wallMode = false; this.shiftMode = null;
        this.render();
      });
    },
    resolvePick(v) {
      const p = this.pending; if (!p) return;
      this.pending = null;
      SFX.play('click');
      this.render();
      p.resolve(v);
    },
    modal(html, cls = '') {
      const m = $('#modal');
      m.className = 'modal open ' + cls;
      m.innerHTML = `<div class="modal-box">${html}</div>`;
      return m;
    },
    closeModal() { const m = $('#modal'); m.className = 'modal'; m.innerHTML = ''; },
    modalOptions(req, resolve) {
      const m = this.modal(`<h3>${esc(req.prompt)}</h3><div class="opt-list">${req.options.map((o, i) => `<button class="btn opt" data-i="${i}" ${o.disabled ? 'disabled' : ''}>${esc(o.label)}</button>`).join('')}</div>${req.optional ? '<button class="btn ghost" data-i="-1">Abbrechen</button>' : ''}`);
      m.onclick = (e) => {
        const b = e.target.closest('[data-i]'); if (!b || b.disabled) return;
        const i = +b.dataset.i; this.closeModal(); SFX.play('click');
        resolve(i < 0 ? null : req.options[i]);
      };
    },
    modalCards(req, resolve) {
      const min = req.min ?? 1, max = req.max ?? 1;
      const chosen = new Set();
      const m = this.modal(`<h3>${esc(req.prompt)}</h3><div class="sub">${min === max ? `Wähle ${min}` : `Wähle ${min}–${max}`}</div>
        <div class="card-grid">${req.options.map((c, i) => `<div class="cg" data-i="${i}">${cardHTML(c)}</div>`).join('')}</div>
        <div class="modal-btns"><button class="btn gold" data-ok ${min > 0 ? 'disabled' : ''}>Bestätigen</button></div>`, 'wide');
      const upd = () => {
        $$('.cg', m).forEach(el => el.classList.toggle('chosen', chosen.has(+el.dataset.i)));
        const ok = $('[data-ok]', m); ok.disabled = chosen.size < min || chosen.size > max;
        ok.textContent = `Bestätigen (${chosen.size})`;
      };
      m.onclick = (e) => {
        const c = e.target.closest('.cg');
        if (c) {
          const i = +c.dataset.i;
          if (chosen.has(i)) chosen.delete(i); else { if (max === 1) chosen.clear(); if (chosen.size < max) chosen.add(i); }
          SFX.play('click');
          if (min === 1 && max === 1 && !req.discard) { this.closeModal(); resolve([req.options[i]]); return; }
          upd(); return;
        }
        if (e.target.closest('[data-ok]') && !e.target.closest('[data-ok]').disabled) {
          this.closeModal(); resolve([...chosen].map(i => req.options[i]));
        }
      };
      upd();
    },
    offerCounters(q, list, ev) {
      const g = this.g;
      if (ev.type === 'enter' && this.noAskTurn === g.G) return Promise.resolve(null);
      return new Promise((resolve) => {
        let what = '';
        if (ev.type === 'enter') what = `${esc(g.figName(ev.fig))} ${ev.isMove ? 'bewegt sich' : 'erscheint'} auf ${g.sq(ev.fig.x, ev.fig.y)}.`;
        else if (ev.type === 'cardPlayed') what = ev.isTrap ? `Eine gegnerische Falle (${esc(ev.def.name)}) wird ausgelöst.` : `Der Gegner spielt <b>${esc(ev.def.name)}</b>.`;
        else if (ev.type === 'affect') what = `${esc(g.figName(ev.fig))} wird von <b>${esc(ev.info.label || 'einem Karteneffekt')}</b> betroffen.`;
        SFX.play('counter');
        const m = this.modal(`<div class="konter-head">⚡ Konter-Gelegenheit</div><p class="konter-what">${what}</p>
          <div class="card-grid">${list.map((w, i) => `<div class="cg konterable" data-i="${i}">${cardHTML(w.card)}<button class="btn konter" data-i="${i}">Kontern</button></div>`).join('')}</div>
          <div class="modal-btns"><button class="btn ghost" data-no>Nicht kontern</button>${ev.type === 'enter' ? '<label class="chk"><input type="checkbox" data-mute> In diesem Zug nicht mehr fragen</label>' : ''}</div>`, 'wide konter-modal');
        m.onclick = (e) => {
          const b = e.target.closest('button'); if (!b) return;
          const mute = $('[data-mute]', m);
          if (mute && mute.checked) this.noAskTurn = g.G;
          this.closeModal();
          if (b.hasAttribute('data-no')) return resolve(null);
          const i = +b.dataset.i; resolve(list[i]);
        };
      });
    },
    showCards(cards, title, closable) {
      return new Promise((resolve) => {
        const m = this.modal(`<h3>${esc(title)}</h3>${cards.length ? `<div class="card-grid">${cards.map(c => `<div class="cg">${cardHTML(c)}</div>`).join('')}</div>` : '<p class="sub">Keine Karten.</p>'}<div class="modal-btns"><button class="btn gold" data-ok>OK</button></div>`, 'wide');
        m.onclick = (e) => { if (e.target.closest('[data-ok]')) { this.closeModal(); resolve(); } };
      });
    },

    /* ---------- Engine-Rückmeldungen / Effekte ---------- */
    log(e) {
      const L = $('#log'); if (!L) return;
      const d = document.createElement('div'); d.className = 'le ' + e.cls; d.textContent = e.text;
      L.appendChild(d);
      while (L.children.length > 120) L.firstChild.remove();
      L.scrollTop = L.scrollHeight;
    },
    toast(msg) {
      const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg;
      $('#toasts').appendChild(t); setTimeout(() => t.classList.add('out'), 2200); setTimeout(() => t.remove(), 2800);
      return Promise.resolve();
    },
    async animateMove(f, from, to, kind) {
      this.renderFigs();
      const el = this.layers.figs.querySelector(`[data-fid="${f.id}"]`);
      if (kind === 'walk') SFX.play('step');
      if (kind === 'teleport') {
        SFX.play('teleport');
        if (el) { el.classList.add('tele'); setTimeout(() => el.classList.remove('tele'), 500); }
        await sleep(420);
      } else await sleep(kind === 'push' ? 300 : 270);
      this.render();
    },
    spawnFx(cls, x, y, html = '', dur = 1000, w = 1, h = 1) {
      const p = this.pos(x, y);
      const d = document.createElement('div'); d.className = 'fx ' + cls;
      d.style.left = p.left + '%'; d.style.top = p.top + '%'; d.style.width = 12.5 * w + '%'; d.style.height = 12.5 * h + '%';
      d.innerHTML = html;
      this.layers.fxl.appendChild(d); setTimeout(() => d.remove(), dur);
      return d;
    },
    shake(strength = 1) { const b = $('.board-frame'); b.style.setProperty('--sh', strength); b.classList.remove('shake'); b.offsetWidth; b.classList.add('shake'); },
    fx(kind, d) {
      const g = this.g;
      const at = (f) => f ? { x: f.x, y: f.y } : null;
      switch (kind) {
        case 'capture': {
          SFX.play(d.soft ? 'step' : 'capture');
          this.spawnFx('fx-capture', d.x, d.y, '<i></i><i></i><i></i><b>' + SIGILS.dagger + '</b>', 1100);
          if (!d.soft) this.shake(d.fig && d.fig.kind === 'hero' ? 1.6 : 0.7);
          break;
        }
        case 'flag': { const p = at(d.fig); SFX.play('flag'); if (p) this.spawnFx('fx-flag', p.x, p.y, ICONS.FLAG, 1500); break; }
        case 'score': { const p = at(d.fig); SFX.play('score'); if (p) this.spawnFx('fx-score', p.x, p.y, '<i></i>' + ICONS.FLAG, 1800); this.shake(0.6); break; }
        case 'wall': { const [t, xs, ys] = d.key.split(','); this.spawnFx('fx-dust ' + t, +xs, +ys, '', 700); SFX.play('wall'); break; }
        case 'wallBreak': { const [t, xs, ys] = d.key.split(','); this.spawnFx('fx-debris ' + t, +xs, +ys, '<i></i><i></i><i></i><i></i><i></i>', 900); SFX.play('break'); this.shake(0.8); break; }
        case 'teleport': { if (d.from) this.spawnFx('fx-tele', d.from.x, d.from.y, '', 700); if (d.to) this.spawnFx('fx-tele in', d.to.x, d.to.y, '', 800); break; }
        case 'snare': { const p = at(d.fig); SFX.play('snare'); if (p) this.spawnFx('fx-ice', p.x, p.y, ICONS.SNARED, 1100); break; }
        case 'trap': { SFX.play('trap'); this.spawnFx('fx-trap', d.x, d.y, ICONS.TRAP, 1000); this.shake(0.6); break; }
        case 'trapSet': { if (d.p === g.human) this.spawnFx('fx-rune', d.x, d.y, SIGILS.rune, 900); break; }
        case 'cloud': { this.spawnFx('fx-puff', d.x - d.r, d.y + d.r, '', 1200, 2 * d.r + 1, 2 * d.r + 1); SFX.play('break'); break; }
        case 'summon': case 'rebirth': { const p = at(d.fig); if (p) this.spawnFx('fx-summon', p.x, p.y, '<i></i><i></i>', 1100); SFX.play('teleport'); break; }
        case 'vanish': { const p = at(d.fig); if (p) this.spawnFx('fx-puff small', p.x, p.y, '', 900); break; }
        case 'reveal': { const p = at(d.fig); if (p) this.spawnFx('fx-rune', p.x, p.y, SIGILS.eye, 1000); break; }
        case 'banner': this.spawnFx('fx-rune', d.x, d.y, SIGILS.banner, 900); SFX.play('wall'); break;
        case 'negate': this.flash('negate'); SFX.play('counter'); break;
        case 'antikonter': this.flash('anti'); break;
        case 'astral': this.flash('arcane'); SFX.play('teleport'); break;
        case 'timeRift': this.flash('time'); SFX.play('teleport'); break;
        case 'nullpunkt': this.flash('arcane'); SFX.play('break'); break;
        case 'portal': SFX.play('teleport'); break;
        case 'skip': case 'silence': SFX.play('snare'); break;
        case 'protect': SFX.play('flag'); break;
        case 'heroPower': this.flash('gold'); SFX.play('flag'); break;
        case 'bonus': break;
      }
    },
    flash(kind) {
      const f = document.createElement('div'); f.className = 'screenflash ' + kind; document.body.appendChild(f);
      setTimeout(() => f.remove(), 900);
    },
    async announce(text, style = 'silver') {
      const a = $('#announce');
      a.className = 'announce show ' + style;
      a.innerHTML = `<div class="an-line"></div><div class="an-text">${esc(text)}</div><div class="an-line"></div>`;
      await sleep(1150);
      a.className = 'announce ' + style;
      await sleep(120);
    },
    async turnBanner(p, skipped) {
      const g = this.g; this.noAskTurn = -1;
      this.sel = null; this.wallMode = false; this.shiftMode = null;
      this.render();
      if (g.puzzle) return;
      SFX.play('turn');
      await this.announce(skipped ? (p === g.human ? 'Du setzt aus' : 'Der Gegner setzt aus') : (p === g.human ? 'Dein Zug' : 'Zug des Gegners'), p === g.human ? 'gold' : 'blood');
    },
    async cardPlayed(p, card, o = {}) {
      const g = this.g;
      SFX.play(o.counter ? 'counter' : 'card');
      const pc = $('#played');
      pc.className = 'played ' + (p === g.human ? 'from-me' : 'from-op') + (o.counter ? ' counter' : '');
      pc.innerHTML = (o.counter ? '<div class="pl-label">Konter!</div>' : '') + (o.hidden ? cardBackHTML({ cls: 'big' }) + '<div class="pl-sub">Verdeckte Karte</div>' : cardHTML(card, { cls: 'big' }));
      pc.offsetWidth; pc.classList.add('show');
      if (o.counter) this.flash('counter');
      await sleep(p === g.human ? 750 : 1700);
      pc.classList.remove('show'); pc.classList.add('hide');
      await sleep(260);
      pc.className = 'played';
    },
    async revealCard(p, card, label) {
      const pc = $('#played');
      pc.className = 'played reveal';
      pc.innerHTML = `<div class="pl-label">${esc(label)}</div>` + cardHTML(card, { cls: 'big' });
      pc.offsetWidth; pc.classList.add('show');
      await sleep(1500);
      pc.classList.remove('show'); pc.classList.add('hide');
      await sleep(260); pc.className = 'played';
    },
    async coin(heads) {
      const c = $('#coin');
      c.innerHTML = `<div class="coin-inner ${heads ? 'heads' : 'tails'}"><div class="face h">${SIGILS.coin}<b>Kopf</b></div><div class="face t">${SIGILS.eye}<b>Zahl</b></div></div>`;
      c.className = 'coin show';
      SFX.play('click');
      await sleep(1900);
      c.className = 'coin';
    },
    async rotateBoardFx(dir) {
      const f = $('.board-frame');
      f.style.setProperty('--rot', dir * 90 + 'deg');
      f.classList.add('rotating'); SFX.play('boss');
      await sleep(900);
      f.classList.remove('rotating');
      $$('.fig', this.layers.figs).forEach(el => { el.style.transition = 'none'; });
      this.render();
      requestAnimationFrame(() => $$('.fig', this.layers.figs).forEach(el => { el.style.transition = ''; }));
    },
    drawFx() { },
    gameOver(res) {
      const g = this.g;
      if (res.puzzle) return;
      const win = res.winner === g.human;
      SFX.play(win ? 'win' : 'lose');
      setTimeout(() => {
        const boss = g.level === 'boss';
        const m = this.modal(`<div class="go ${win ? 'win' : 'lose'}">
          <div class="go-sigil">${win ? ICONS.FLAG : SIGILS.dagger}</div>
          <div class="go-title">${win ? 'Sieg' : 'Niederlage'}</div>
          <div class="go-sub">${win ? (boss ? 'Der Endboss ist gefallen. Dein Name wird in Legenden besungen.' : 'Die Flaggen gehören dir.') : 'Die Schatten haben dich verschlungen.'}</div>
          <div class="go-reason">${esc(res.reason)}</div>
          <div class="go-stats"><div><b>${g.P(g.human).points}</b>Flaggenpunkte</div><div><b>${g.P(1 - g.human).captures}</b>Gegner geschnappt</div><div><b>${g.P(g.human).turnCount}</b>Züge</div></div>
          <div class="modal-btns"><button class="btn gold" data-go="again">Revanche</button><button class="btn ghost" data-go="menu">Hauptmenü</button></div>
        </div>`, 'gameover');
        m.onclick = (e) => { const b = e.target.closest('[data-go]'); if (!b) return; this.closeModal(); window.FX_MAIN && window.FX_MAIN.afterGame(b.dataset.go); };
        if (win && window.FX_MAIN) window.FX_MAIN.recordWin(g.level);
      }, 900);
    },
    puzzleSolved() { window.FX_PUZZLES && window.FX_PUZZLES.onSolved(); },
    puzzleFailed() { window.FX_PUZZLES && window.FX_PUZZLES.onFailed(); }
  };

  window.FX_UI = UI;
  window.FX_SFX = SFX;
  window.FX_RENDER = { cardHTML, heroCardHTML, cardBackHTML };
})();

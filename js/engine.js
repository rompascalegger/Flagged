/* =========================================================
   FLAGGED – Spiel-Engine (Regeln gemäss Regelbuch, 1v1 auf 8×8)
   ========================================================= */
(function () {
  const { CARDS, HEROES, DECKS, D4, D8 } = window.FX_CARDS;
  const N = 8;
  const COLS = 'ABCDEFGH';
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  const near = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
  let UID = 1;

  const START = [{ x: 3, y: 0 }, { x: 4, y: 7 }];   // D1 / E8

  function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }

  class Game {
    constructor(opts) {
      this.opts = opts;
      this.ui = opts.ui;
      this.human = 0;
      this.level = opts.level || 'medium';
      this.puzzle = opts.puzzle || null;
      this.players = [0, 1].map(i => ({
        idx: i, cls: opts.heroes[i], isAI: i !== this.human,
        deck: [], hand: [], discard: [], inPlay: [],
        wallsLeft: 10, points: 0, captures: 0, skip: 0, carrying: false,
        heroKnown: true, abilityUsed: false, turnCount: 0, next: {},
        wolfMode: false, protectUntil: -1, wolfCard: null, mulliganDone: false
      }));
      this.figs = [];
      this.walls = new Map();
      this.traps = [];
      this.clouds = [];
      this.banners = [];
      this.blocks = [];
      this.portals = [];
      this.cur = 0;
      this.turn = this.newTurn(0);
      this.over = null;
      this.logs = [];
      this.busy = false;
      this.window = null;
      this.flip = false;
      this.G = 0;
    }

    /* ---------------- Grundlagen ---------------- */
    P(p) { return this.players[p]; }
    def(ci) { return CARDS[ci.id]; }
    cardName(ci) { return CARDS[ci.id].name; }
    pname(p) { return p === this.human ? 'Du' : 'Gegner'; }
    isAI(p) { return this.players[p].isAI; }
    sq(x, y) { return COLS[x] + (y + 1); }
    inBoard(x, y) { return x >= 0 && y >= 0 && x < N && y < N; }
    homeRow(p) { return p === 0 ? 0 : N - 1; }
    goalRow(p) { return p === 0 ? N - 1 : 0; }
    inHalf(p, y) { return p === 0 ? y <= 3 : y >= 4; }
    allSquares() { const a = []; for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) a.push({ x, y }); return a; }
    allEdges() {
      const a = [];
      for (let x = 0; x < N; x++) for (let y = 0; y < N - 1; y++) a.push(`h,${x},${y}`);
      for (let x = 0; x < N - 1; x++) for (let y = 0; y < N; y++) a.push(`v,${x},${y}`);
      return a;
    }
    edgeKey(x1, y1, x2, y2) {
      if (x1 === x2) return `h,${x1},${Math.min(y1, y2)}`;
      return `v,${Math.min(x1, x2)},${y1}`;
    }
    edgeSquares(key) {
      const [t, xs, ys] = key.split(','); const x = +xs, y = +ys;
      return t === 'h' ? [{ x, y }, { x, y: y + 1 }] : [{ x, y }, { x: x + 1, y }];
    }
    validEdge(key) {
      const [t, xs, ys] = key.split(','); const x = +xs, y = +ys;
      if (t === 'h') return x >= 0 && x < N && y >= 0 && y < N - 1;
      return x >= 0 && x < N - 1 && y >= 0 && y < N;
    }
    log(text, cls = '') {
      const e = { text, cls, t: Date.now() };
      this.logs.push(e);
      if (this.logs.length > 200) this.logs.shift();
      this.ui && this.ui.log(e);
    }
    fx(kind, data) { this.ui && this.ui.fx(kind, data || {}); }
    render() { this.ui && this.ui.render(); }

    /* ---------------- Figuren ---------------- */
    figAt(x, y) { return this.figs.find(f => f.alive && f.x === x && f.y === y) || null; }
    figsOf(p) { return this.figs.filter(f => f.alive && f.owner === p); }
    heroOf(p) { return this.figs.find(f => f.alive && f.owner === p && f.kind === 'hero') || null; }
    wolfOf(p) { return this.figs.find(f => f.alive && f.owner === p && f.kind === 'wolf') || null; }
    clonesOf(p) { return this.figs.filter(f => f.alive && f.owner === p && f.kind === 'clone'); }
    figName(f) {
      if (!f) return '?';
      const own = f.owner === this.human ? 'deine' : 'gegnerische';
      if (f.kind === 'wolf') return `${own === 'deine' ? 'dein' : 'gegnerischer'} Wolf`;
      if (f.owner !== this.human && !this.P(f.owner).heroKnown && f.kind !== 'wolf') return 'eine gegnerische Schattengestalt';
      return f.kind === 'hero' ? `${own} Heldenfigur` : `${own === 'deine' ? 'dein' : 'gegnerischer'} Klon`;
    }
    newFig(owner, kind, x, y, extra = {}) {
      const f = { id: UID++, owner, kind, x, y, alive: true, snare: new Set(), ...extra };
      this.figs.push(f);
      return f;
    }
    freeAdjacent(f) {
      if (!f) return [];
      return D8.map(([dx, dy]) => ({ x: f.x + dx, y: f.y + dy })).filter(q => this.inBoard(q.x, q.y) && !this.figAt(q.x, q.y));
    }
    knownHeroes(viewer, q) {
      const h = this.heroOf(q);
      if (!h) return [];
      if (q === viewer || this.P(q).heroKnown) return [h];
      return [h, ...this.clonesOf(q)];
    }
    isProtected(f) { const P = this.P(f.owner); return P.turnCount < P.protectUntil; }
    protect(p) { this.P(p).protectUntil = this.P(p).turnCount + 1; this.log(`${this.pname(p)}: Figuren können bis zum nächsten Zug nicht geschnappt werden.`, 'good'); this.fx('protect', { p }); }
    canCapture(att, vic) {
      if (!att || !vic || !att.alive || !vic.alive || att.owner === vic.owner) return false;
      if (this.isProtected(vic)) return false;
      if (att.kind === 'hero' || att.kind === 'wolf') return true;
      return att.kind === 'clone' && this.turn.clonesEmpowered === att.owner;
    }
    isSnared(f) { return this.cur === f.owner && f.snare.has(this.P(f.owner).turnCount); }
    snare(f, mode) {
      const P = this.P(f.owner), k = P.turnCount, isCur = this.cur === f.owner;
      if (mode === 'next') f.snare.add(k + 1);
      else if (mode === 'this') { if (isCur) f.snare.add(k); }
      else if (mode === 'thisAndNext') { if (isCur) f.snare.add(k); f.snare.add(k + 1); }
      else if (mode === 'untilNextStart') { if (isCur) f.snare.add(k); }
      this.log(`${this.figName(f)} wird festgesetzt.`, 'bad');
      this.fx('snare', { fig: f });
    }
    isBlockedFor(f, x, y) { return this.blocks.some(b => b.owner !== f.owner && b.squares.some(s => s.x === x && s.y === y)); }
    bannerAt(x, y) { return this.banners.some(b => b.x === x && b.y === y); }
    trapAt(x, y) { return this.traps.find(t => t.x === x && t.y === y) || null; }
    canTrapAt(x, y) { return !this.figAt(x, y) && !this.bannerAt(x, y) && !this.trapAt(x, y); }
    portalsOf(p) { return this.portals.filter(pt => pt.owner === p); }
    inCloud(c, x, y) { return Math.max(Math.abs(c.x - x), Math.abs(c.y - y)) <= c.r; }
    smokeHolding(f) { return this.clouds.filter(c => c.kind === 'smoke' && c.owner !== f.owner && this.inCloud(c, f.x, f.y)); }

    /* ---------------- Wände ---------------- */
    hasWall(x1, y1, x2, y2) { return this.walls.has(this.edgeKey(x1, y1, x2, y2)); }
    blockedStep(x, y, nx, ny, through = false) {
      if (through) return false;
      const dx = nx - x, dy = ny - y;
      if (!dx || !dy) return this.hasWall(x, y, nx, ny);
      const a = this.hasWall(x, y, nx, y) || this.hasWall(nx, y, nx, ny);
      const b = this.hasWall(x, y, x, ny) || this.hasWall(x, ny, nx, ny);
      return a && b;
    }
    connected(walls = this.walls) {
      const seen = new Uint8Array(N * N); const st = [0]; seen[0] = 1; let n = 1;
      while (st.length) {
        const i = st.pop(), x = i % N, y = (i / N) | 0;
        for (const [dx, dy] of D4) {
          const nx = x + dx, ny = y + dy;
          if (!this.inBoard(nx, ny)) continue;
          const j = ny * N + nx; if (seen[j]) continue;
          if (walls.has(this.edgeKey(x, y, nx, ny))) continue;
          seen[j] = 1; n++; st.push(j);
        }
      }
      return n === N * N;
    }
    canPlaceWallAt(key, o = {}) {
      if (!this.validEdge(key) || this.walls.has(key)) return false;
      const [a, b] = this.edgeSquares(key);
      if (this.bannerAt(a.x, a.y) || this.bannerAt(b.x, b.y)) return false;
      if (!o.ignoreHalf && o.owner !== undefined && o.restrictHalf) {
        const [t, , ys] = key.split(','); const y = +ys;
        if (o.owner === 0) { if (t === 'h' ? y > 3 : y > 3) return false; }
        else { if (t === 'h' ? y < 3 : y < 4) return false; }
      }
      this.walls.set(key, { owner: o.owner });
      const ok = this.connected();
      this.walls.delete(key);
      return ok;
    }
    legalWallEdges(p) {
      const P = this.P(p);
      if (P.wallsLeft <= 0) return [];
      const restrictHalf = !this.puzzle && P.turnCount <= 1;
      return this.allEdges().filter(k => this.canPlaceWallAt(k, { owner: p, restrictHalf }));
    }
    placeWall(p, key, silent) {
      this.walls.set(key, { owner: p });
      this.P(p).wallsLeft--;
      if (!silent) this.log(`${this.pname(p)} ${p === this.human ? 'setzt' : 'setzt'} eine Wand.`);
      this.fx('wall', { key });
    }
    destroyWall(key) {
      if (!this.walls.has(key)) return;
      this.walls.delete(key);
      this.log('Eine Wand wird zerstört!', 'epic');
      this.fx('wallBreak', { key });
    }
    translateEdge(key, dx, dy) {
      const [t, xs, ys] = key.split(',');
      return `${t},${+xs + dx},${+ys + dy}`;
    }
    wallShiftTargets(key, maxDist, onlyDir) {
      const out = [];
      const w = this.walls.get(key); if (!w) return out;
      const dirs = onlyDir ? [onlyDir] : D4;
      this.walls.delete(key);
      for (const [dx, dy] of dirs) {
        for (let d = 1; d <= maxDist; d++) {
          const k = this.translateEdge(key, dx * d, dy * d);
          if (!this.validEdge(k)) break;
          if (this.walls.has(k)) continue;
          if (this.canPlaceWallAt(k, { owner: w.owner, ignoreHalf: true })) out.push(k);
        }
      }
      this.walls.set(key, w);
      return out;
    }
    moveWall(from, to) {
      const w = this.walls.get(from); if (!w) return;
      this.walls.delete(from); this.walls.set(to, w);
      this.log('Eine Wand wird verschoben.');
      this.fx('wall', { key: to });
    }
    wallsOnRay(o, [dx, dy]) {
      const out = []; let x = o.x, y = o.y;
      while (this.inBoard(x + dx, y + dy)) {
        const k = this.edgeKey(x, y, x + dx, y + dy);
        if (this.walls.has(k)) out.push(k);
        x += dx; y += dy;
      }
      return out;
    }

    /* ---------------- Sichtlinie ---------------- */
    inLOS(a, b) {
      if (!a || !b || (a.x === b.x && a.y === b.y)) return false;
      const dx = Math.sign(b.x - a.x), dy = Math.sign(b.y - a.y);
      const adx = Math.abs(b.x - a.x), ady = Math.abs(b.y - a.y);
      if (!(adx === 0 || ady === 0 || adx === ady)) return false;
      let x = a.x, y = a.y;
      while (true) {
        const nx = x + dx, ny = y + dy;
        if (this.blockedStep(x, y, nx, ny)) return false;
        if (nx === b.x && ny === b.y) return true;
        if (this.figAt(nx, ny)) return false;
        x = nx; y = ny;
      }
    }
    losSquares(a) {
      const out = [];
      for (const [dx, dy] of D8) {
        let x = a.x, y = a.y;
        while (this.inBoard(x + dx, y + dy)) {
          if (this.blockedStep(x, y, x + dx, y + dy)) break;
          x += dx; y += dy; out.push({ x, y });
          if (this.figAt(x, y)) break;
        }
      }
      return out;
    }
    adjacentInLOS(o) { return this.figs.filter(f => f.alive && f !== o && near(f, o) === 1 && this.inLOS(o, f)); }
    enemiesBetween(p) {
      const mine = this.figsOf(p); const res = new Set();
      for (let i = 0; i < mine.length; i++) for (let j = i + 1; j < mine.length; j++) {
        const a = mine[i], b = mine[j];
        const adx = Math.abs(a.x - b.x), ady = Math.abs(a.y - b.y);
        if (!(adx === 0 || ady === 0 || adx === ady) || Math.max(adx, ady) < 2) continue;
        const dx = Math.sign(b.x - a.x), dy = Math.sign(b.y - a.y);
        let x = a.x + dx, y = a.y + dy;
        while (x !== b.x || y !== b.y) { const f = this.figAt(x, y); if (f && f.owner !== p) res.add(f); x += dx; y += dy; }
      }
      return [...res];
    }

    /* ---------------- Zug-Status ---------------- */
    newTurn(p) {
      return {
        p, plays: 1, playsUsed: 0, walls: 2, wallsUsed: 0,
        pools: { hero: { straight: 2, diag: 0, horiz: 0, all: 0 }, wolf: { straight: 2, diag: 0, horiz: 0, all: 0 } },
        used: {}, steps: {}, moveAll: false, throughWalls: false, capPerFig: null, movedAny: false,
        clonesEmpowered: -1, antikonter: false, endRequested: false, extraTurn: false,
        wallShifts: 0, wallShiftsUsed: 0, startPos: new Map(), startCarry: [false, false],
        noPlay: false, dontPlay: false, skipped: false, heroUsed: false
      };
    }
    addPool(p, group, pool, n) {
      if (p !== this.cur) { this.addNext(p, group === 'wolf' ? 'wolfstraight' : 'straight', n); return; }
      this.turn.pools[group][pool] += n;
      const names = { straight: 'gerade', diag: 'diagonale', horiz: 'horizontale', all: 'freie' };
      this.log(`${group === 'wolf' ? 'Wolf' : this.pname(p)}: +${n} ${names[pool]} Bewegung.`, 'good');
      this.fx('bonus', { p, text: `+${n} ${group === 'wolf' ? 'Wolf' : ''}` });
    }
    addPlays(n) { this.turn.plays += n; this.log(`+${n} Karte${n > 1 ? 'n' : ''} spielbar.`, 'good'); }
    addNext(p, kind, n) {
      const P = this.P(p); const k = P.turnCount + 1;
      P.next[k] = P.next[k] || {};
      P.next[k][kind] = (P.next[k][kind] || 0) + n;
      const txt = { plays: `+${n} Karte im nächsten Zug`, straight: `+${n} Bewegung im nächsten Zug`, wolfstraight: `Wolf +${n} im nächsten Zug`, dontplay: 'darf im nächsten Zug keine Karten spielen' }[kind];
      this.log(`${this.pname(p)}: ${txt}.`, kind === 'dontplay' ? 'bad' : 'good');
      if (kind === 'dontplay') this.fx('silence', { p });
    }
    skipTurns(p, n) { this.P(p).skip += n; this.log(`${this.pname(p)} ${p === this.human ? 'setzt' : 'setzt'} ${n === 1 ? 'den nächsten Zug' : `die nächsten ${n} Züge`} aus!`, 'bad'); this.fx('skip', { p }); }
    groupOf(f) { return f.kind === 'wolf' ? 'wolf' : 'hero'; }
    availPools(f) {
      const pool = this.turn.pools[this.groupOf(f)];
      const u = this.turn.used[f.id] || { straight: 0, diag: 0, horiz: 0, all: 0 };
      return { straight: Math.max(0, pool.straight - u.straight), diag: Math.max(0, pool.diag - u.diag), horiz: Math.max(0, pool.horiz - u.horiz), all: Math.max(0, pool.all - u.all) };
    }
    usedTotal(f) { const u = this.turn.used[f.id]; return u ? u.straight + u.diag + u.horiz + u.all : 0; }

    /* ---------------- Bewegung ---------------- */
    reachable(f, o = {}) {
      const res = new Map();
      if (!f || !f.alive || f.owner !== this.cur || this.isSnared(f)) return res;
      const P = this.P(f.owner);
      const av = o.pools || this.availPools(f);
      const cap = this.turn.capPerFig != null ? this.turn.capPerFig - this.usedTotal(f) : 99;
      const through = this.turn.throughWalls && f.kind !== 'wolf';
      const moveAll = this.turn.moveAll && f.kind !== 'wolf';
      const holds = this.smokeHolding(f);
      const wolfMode = f.kind === 'hero' && P.wolfMode;
      const start = { x: f.x, y: f.y, s: av.straight, d: av.diag, h: av.horiz, a: av.all, n: 0, path: [] };
      const seen = new Set([`${f.x},${f.y},${av.straight},${av.diag},${av.horiz},${av.all}`]);
      const q = [start];
      const pick = (st, diag, horiz) => {
        if (diag) { if (st.d > 0) return 'diag'; if (moveAll && st.s > 0) return 'straight'; if (st.a > 0) return 'all'; return null; }
        if (horiz && st.h > 0) return 'horiz';
        if (st.s > 0) return 'straight'; if (st.a > 0) return 'all'; return null;
      };
      const spend = (st, pool) => ({ s: st.s - (pool === 'straight'), d: st.d - (pool === 'diag'), h: st.h - (pool === 'horiz'), a: st.a - (pool === 'all') });
      while (q.length) {
        const st = q.shift();
        if (st.n >= cap) continue;
        for (const [dx, dy] of D8) {
          const nx = st.x + dx, ny = st.y + dy;
          if (!this.inBoard(nx, ny)) continue;
          const diag = dx !== 0 && dy !== 0;
          const occ = this.figAt(nx, ny);
          const occSelf = occ && occ.id === f.id;
          // Wolfmodus: Schnappen im Umkreis 1 – auch durch Wände
          if (wolfMode && occ && !occSelf && occ.owner !== f.owner && this.canCapture(f, occ)) {
            const pool = st.s > 0 ? 'straight' : st.a > 0 ? 'all' : st.d > 0 ? 'diag' : st.h > 0 ? 'horiz' : null;
            if (pool) {
              const key = `${nx},${ny}`;
              if (!res.has(key)) res.set(key, { x: nx, y: ny, capture: true, path: [...st.path, { x: nx, y: ny, pool }] });
              continue;
            }
          }
          const pool = pick(st, diag, dy === 0);
          if (!pool) continue;
          if (this.blockedStep(st.x, st.y, nx, ny, through)) continue;
          if (holds.length && holds.some(c => !this.inCloud(c, nx, ny))) continue;
          if (this.isBlockedFor(f, nx, ny)) continue;
          const step = { x: nx, y: ny, pool };
          if (occ && !occSelf) {
            if (occ.owner === f.owner || !this.canCapture(f, occ)) continue;
            const key = `${nx},${ny}`;
            if (!res.has(key)) res.set(key, { x: nx, y: ny, capture: true, path: [...st.path, step] });
            continue;
          }
          const r = spend(st, pool);
          const sk = `${nx},${ny},${r.s},${r.d},${r.h},${r.a}`;
          if (seen.has(sk)) continue;
          seen.add(sk);
          const ns = { x: nx, y: ny, ...r, n: st.n + 1, path: [...st.path, step] };
          const key = `${nx},${ny}`;
          if (!(nx === f.x && ny === f.y) && !res.has(key)) res.set(key, { x: nx, y: ny, capture: false, path: ns.path });
          q.push(ns);
        }
      }
      return res;
    }
    hasMovesLeft(f) { const a = this.availPools(f); return a.straight + a.diag + a.horiz + a.all > 0; }

    async stepTo(f, st) {
      const u = this.turn.used[f.id] || (this.turn.used[f.id] = { straight: 0, diag: 0, horiz: 0, all: 0 });
      u[st.pool]++;
      this.turn.steps[f.id] = (this.turn.steps[f.id] || 0) + 1;
      this.turn.movedAny = true;
      const from = { x: f.x, y: f.y };
      const occ = this.figAt(st.x, st.y);
      if (occ && occ.owner !== f.owner) {
        const ok = await this.capture(occ, f.owner, 'schnappt', f);
        if (!ok) { u[st.pool]--; return false; }
      }
      f.x = st.x; f.y = st.y;
      await this.ui.animateMove(f, from, { x: f.x, y: f.y }, 'walk');
      await this.onEnter(f, from, { isMove: true, voluntary: true });
      return true;
    }
    async moveAlong(f, path) {
      const start = { x: f.x, y: f.y };
      await this.walkPath(f, path);
      if (f.alive && (f.x !== start.x || f.y !== start.y)) {
        const who = f.owner === this.human ? (f.kind === 'wolf' ? 'Dein Wolf zieht' : f.kind === 'clone' ? 'Dein Klon zieht' : 'Du ziehst')
          : (f.kind === 'wolf' ? 'Der gegnerische Wolf zieht' : (!this.P(f.owner).heroKnown ? 'Eine gegnerische Gestalt zieht' : f.kind === 'clone' ? 'Der gegnerische Klon zieht' : 'Der Gegner zieht'));
        this.log(`${who} ${this.sq(start.x, start.y)} → ${this.sq(f.x, f.y)}.`, f.owner === this.human ? '' : 'card');
      }
    }
    async walkPath(f, path) {
      for (const st of path) {
        if (!f.alive || this.over || this.turn.endRequested || this.isSnared(f)) break;
        const before = { x: f.x, y: f.y };
        const ok = await this.stepTo(f, st);
        if (!ok) break;
        if (!f.alive || (f.x !== st.x || f.y !== st.y)) break;
        void before;
      }
    }
    async forcedMove(f, x, y, o = {}) {
      if (!f.alive) return;
      const occ = this.figAt(x, y);
      if (occ) {
        if (!o.capture || occ.owner === f.owner || !this.canCapture(f, occ)) return;
        const ok = await this.capture(occ, f.owner, 'schnappt', f);
        if (!ok) return;
      }
      const from = { x: f.x, y: f.y };
      f.x = x; f.y = y;
      if (f.owner === this.cur) this.turn.steps[f.id] = (this.turn.steps[f.id] || 0) + 1;
      await this.ui.animateMove(f, from, { x, y }, 'push');
      await this.onEnter(f, from, { isMove: true, forced: true });
    }
    async teleport(f, x, y, o = {}) {
      if (!f.alive) return false;
      const occ = this.figAt(x, y);
      if (occ && occ !== f) {
        if (o.noCapture || occ.owner === f.owner || !this.canCapture(f, occ)) return false;
        const ok = await this.capture(occ, f.owner, 'schnappt', f);
        if (!ok) return false;
      }
      const from = { x: f.x, y: f.y };
      f.x = x; f.y = y;
      this.fx('teleport', { from, to: { x, y } });
      await this.ui.animateMove(f, from, { x, y }, 'teleport');
      await this.onEnter(f, from, { isMove: false, noPortal: o.noPortal, silent: o.silent });
      return true;
    }
    async swapPositions(a, b) {
      const pa = { x: a.x, y: a.y }, pb = { x: b.x, y: b.y };
      a.x = pb.x; a.y = pb.y; b.x = pa.x; b.y = pa.y;
      this.fx('teleport', { from: pa, to: pb });
      await Promise.all([this.ui.animateMove(a, pa, pb, 'teleport'), this.ui.animateMove(b, pb, pa, 'teleport')]);
      this.log('Zwei Figuren tauschen durch Teleportation die Plätze.');
      await this.onEnter(a, pa, { isMove: false, noPortal: true });
      if (b.alive) await this.onEnter(b, pb, { isMove: false, noPortal: true });
    }

    async onEnter(f, from, o = {}) {
      if (!f.alive) return;
      const P = this.P(f.owner);
      // Flagge & Punkte
      if (f.kind === 'hero') {
        if (!P.carrying && f.y === this.goalRow(f.owner)) {
          P.carrying = true;
          if (!P.heroKnown) { P.heroKnown = true; this.log(`Die Heldenfigur von ${this.pname(f.owner)} wird enthüllt.`); }
          this.log(`${this.pname(f.owner)} ${f.owner === this.human ? 'erbeutest' : 'erbeutet'} die Flagge!`, 'epic');
          this.fx('flag', { fig: f });
          await this.ui.announce(f.owner === this.human ? 'Flagge erbeutet!' : 'Der Gegner hat deine Flagge!', f.owner === this.human ? 'gold' : 'blood');
          if (this.puzzle) this.puzzleCheck('flag');
        } else if (P.carrying && f.y === this.homeRow(f.owner)) {
          P.carrying = false; P.points++;
          this.log(`${this.pname(f.owner)} ${f.owner === this.human ? 'bringst' : 'bringt'} die Flagge heim: ${P.points} Flaggenpunkt${P.points > 1 ? 'e' : ''}!`, 'epic');
          this.fx('score', { fig: f });
          await this.ui.announce(`Flaggenpunkt ${P.points} / 2`, f.owner === this.human ? 'gold' : 'blood');
          if (this.puzzle) this.puzzleCheck('score');
          this.checkWin();
          if (this.over) return;
        }
      }
      // Falle
      const tr = this.trapAt(f.x, f.y);
      if (tr && tr.owner !== f.owner) await this.triggerTrap(tr, f);
      if (!f.alive || this.over) return;
      // Portal
      if (o.voluntary && !o.noPortal) {
        const pts = this.portalsOf(f.owner);
        const here = pts.find(pt => pt.x === f.x && pt.y === f.y);
        if (here && pts.length === 2 && f.kind !== 'wolf') {
          const other = pts.find(pt => pt !== here);
          const occ = this.figAt(other.x, other.y);
          if (!occ || (occ.owner !== f.owner && this.canCapture(f, occ))) {
            this.log('Das Portal teleportiert die Figur!', 'arcane');
            await this.teleport(f, other.x, other.y, { noPortal: true });
            return;
          }
        }
      }
      await this.emitEnter({ type: 'enter', fig: f, from, isMove: !!o.isMove, silent: !!o.silent });
    }

    /* ---------------- Schnappen ---------------- */
    async capture(f, byP, how = 'schnappt', attacker = null) {
      if (!f || !f.alive) return false;
      if (this.isProtected(f)) { this.log('Diese Figur ist geschützt und kann nicht geschnappt werden.', 'bad'); return false; }
      const P = this.P(f.owner);
      if (attacker && attacker.kind === 'hero' && !this.P(attacker.owner).heroKnown) {
        this.P(attacker.owner).heroKnown = true;
        this.log(`Die Heldenfigur von ${this.pname(attacker.owner)} wird enthüllt.`);
      }
      f.alive = false;
      this.fx('capture', { fig: f, x: f.x, y: f.y });
      if (f.kind === 'hero') {
        P.captures++;
        P.heroKnown = true;
        if (P.carrying) { P.carrying = false; this.log('Die Flagge kehrt an ihren Ursprung zurück.'); }
        for (const c of this.clonesOf(f.owner)) { c.alive = false; this.fx('capture', { fig: c, x: c.x, y: c.y, soft: true }); }
        P.skip += P.captures;
        this.log(`${this.pname(byP)} ${byP === this.human ? 'schnappst' : 'schnappt'} ${f.owner === this.human ? 'deine Heldenfigur' : 'die gegnerische Heldenfigur'}! (${P.captures}/6)`, 'epic');
        await this.ui.announce(f.owner === this.human ? `Geschnappt! (${P.captures}/6)` : `Held geschnappt! (${P.captures}/6)`, f.owner === this.human ? 'blood' : 'gold');
        if (this.puzzle) this.puzzleCheck('capture');
        if (P.captures >= 6) { this.endGame(1 - f.owner, 'Sechsmal geschnappt'); }
      } else if (f.kind === 'clone') {
        this.log(`${byP === this.human ? 'Du schnappst' : 'Der Gegner schnappt'} einen Klon.`);
        if (!this.clonesOf(f.owner).length) P.heroKnown = true;
      } else if (f.kind === 'wolf') {
        this.log(`${f.owner === this.human ? 'Dein' : 'Der gegnerische'} Wolf wurde geschnappt.`, 'bad');
        if (P.wolfCard) { P.inPlay = P.inPlay.filter(c => c !== P.wolfCard); P.discard.push(P.wolfCard); P.wolfCard = null; }
      }
      this.render();
      return true;
    }

    /* ---------------- Fallen, Wolken, Banner, Bann ---------------- */
    addTrap(p, card, x, y) {
      this.traps.push({ id: UID++, owner: p, card, x, y });
      this.P(p).inPlay.push(card);
      this.log(p === this.human ? `Du legst ${this.cardName(card)} verdeckt auf ${this.sq(x, y)}.` : 'Der Gegner legt eine verdeckte Karte (Falle?).');
      this.fx('trapSet', { p, x, y });
    }
    async triggerTrap(tr, f) {
      this.traps = this.traps.filter(t => t !== tr);
      const P = this.P(tr.owner); P.inPlay = P.inPlay.filter(c => c !== tr.card);
      const def = this.def(tr.card);
      this.log(`Falle ausgelöst: ${def.name}!`, 'epic');
      this.fx('trap', { x: tr.x, y: tr.y });
      await this.ui.revealCard(tr.owner, tr.card, 'Falle ausgelöst!');
      const ev = { type: 'cardPlayed', player: tr.owner, card: tr.card, def, negated: false, isTrap: true };
      await this.emitCardPlayed(ev);
      if (!ev.negated) { try { await def.trap(this, tr, f); } catch (e) { console.error(e); } }
      else this.log(`${def.name} wurde negiert.`, 'arcane');
      P.discard.push(tr.card);
      this.render();
    }
    addCloud(p, kind, x, y, r) {
      this.clouds.push({ id: UID++, owner: p, kind, x, y, r });
      this.log(kind === 'smoke' ? `${this.pname(p)}: Rauchwolke auf ${this.sq(x, y)}.` : `${this.pname(p)}: Himmelsbruch-Wolke über ${this.sq(x, y)}.`, 'arcane');
      this.fx('cloud', { x, y, r });
    }
    addBanner(p, x, y) {
      this.banners.push({ owner: p, x, y });
      const tr = this.trapAt(x, y);
      if (tr) { this.traps = this.traps.filter(t => t !== tr); const P = this.P(tr.owner); P.inPlay = P.inPlay.filter(c => c !== tr.card); P.discard.push(tr.card); this.log('Eine Falle unter dem Banner wird zerstört!', 'epic'); }
      this.log(`${this.pname(p)} platziert ein Banner auf ${this.sq(x, y)}.`);
      this.fx('banner', { x, y });
    }
    addBlock(p, squares) {
      this.blocks.push({ owner: p, squares });
      this.log(`${this.pname(p)} bannt ${squares.map(s => this.sq(s.x, s.y)).join(', ')} für Gegner.`, 'arcane');
    }

    /* ---------------- Klone, Wolf, Portale ---------------- */
    async summonClones(p, n, origin, tag, extra = {}) {
      if (!origin) return;
      for (let i = 0; i < n; i++) {
        let cand;
        if (extra.startLine) cand = [{ x: origin.x - 1, y: origin.y }, { x: origin.x + 1, y: origin.y }].filter(q => this.inBoard(q.x, q.y) && !this.figAt(q.x, q.y));
        else cand = this.freeAdjacent(origin);
        if (!cand.length) cand = this.freeAdjacent(origin);
        if (!cand.length) break;
        const s = await this.pickSquare(p, cand, 'Wohin wird der Schattenklon beschworen?', { ai: q => window.FX_AI.cloneSquareScore(this, p, q) });
        if (!s) break;
        const c = this.newFig(p, 'clone', s.x, s.y, { tag, vanishTurn: extra.vanishTurn });
        this.fx('summon', { fig: c });
        this.log(`${this.pname(p)} ${p === this.human ? 'beschwörst' : 'beschwört'} einen Schattenklon.`, 'arcane');
        this.render();
      }
      await this.chooseHeroIdentity(p);
    }
    async chooseHeroIdentity(p) {
      const h = this.heroOf(p); const cl = this.clonesOf(p);
      if (!h || !cl.length) return;
      const all = [h, ...cl];
      const pick = await this.pickFigure(p, all, 'Bestimme geheim: Welche Figur ist deine Heldenfigur?', { secret: true, ai: f => window.FX_AI.identityScore(this, p, f) });
      if (pick && pick !== h) this.designateHero(p, pick);
      this.P(p).heroKnown = false;
      this.log(`${this.pname(p)} ${p === this.human ? 'bestimmst' : 'bestimmt'} die Heldenfigur geheim neu.`, 'arcane');
      this.render();
    }
    designateHero(p, f) {
      const h = this.heroOf(p);
      if (!h || h === f) return;
      for (const k of ['x', 'y', 'snare', 'tag', 'vanishTurn']) { const t = h[k]; h[k] = f[k]; f[k] = t; }
      if (this.turn.used[h.id] || this.turn.used[f.id]) { const t = this.turn.used[h.id]; this.turn.used[h.id] = this.turn.used[f.id]; this.turn.used[f.id] = t; }
      if (this.turn.steps[h.id] || this.turn.steps[f.id]) { const t = this.turn.steps[h.id]; this.turn.steps[h.id] = this.turn.steps[f.id]; this.turn.steps[f.id] = t; }
      this.ui.snapFig && (this.ui.snapFig(h), this.ui.snapFig(f));
    }
    revealHero(p, why) {
      if (!this.P(p).heroKnown) {
        this.P(p).heroKnown = true;
        this.log(`Die Heldenfigur von ${this.pname(p)} wird enthüllt${why ? ' (' + why + ')' : ''}.`, 'arcane');
        this.fx('reveal', { fig: this.heroOf(p) });
      }
    }
    removeClones(p) {
      const cl = this.clonesOf(p);
      for (const c of cl) { c.alive = false; this.fx('vanish', { fig: c }); }
      if (cl.length) { this.P(p).heroKnown = true; this.log(`${cl.length} Klon${cl.length > 1 ? 'e' : ''} von ${this.pname(p)} ${cl.length > 1 ? 'verschwinden' : 'verschwindet'}.`); }
      this.render();
      return cl.length;
    }
    vanishTarn(p) {
      const cl = this.clonesOf(p).filter(c => c.tag === 'tarn');
      if (!cl.length) return;
      for (const c of cl) { c.alive = false; this.fx('vanish', { fig: c }); }
      if (!this.clonesOf(p).length) this.P(p).heroKnown = true;
      this.log('Der Tarnmantel-Klon verschwindet.');
    }
    async summonWolf(p, card) {
      const h = this.heroOf(p); if (!h) return;
      const cand = this.freeAdjacent(h);
      const s = await this.pickSquare(p, cand, 'Wohin wird der Fährtenwolf beschworen?', { ai: q => -window.FX_AI.goalDistFrom(this, p, q) });
      if (!s) return;
      const w = this.newFig(p, 'wolf', s.x, s.y);
      this.P(p).wolfCard = card; this.P(p).inPlay.push(card);
      this.log(`${this.pname(p)} ${p === this.human ? 'beschwörst' : 'beschwört'} den Fährtenwolf!`, 'epic');
      this.fx('summon', { fig: w });
      this.render();
    }
    async placePortals(p) {
      const old = this.portals.filter(pt => pt.owner === p);
      this.portals = this.portals.filter(pt => pt.owner !== p);
      this.render();
      const free = this.allSquares().filter(s => !this.portals.some(pt => pt.x === s.x && pt.y === s.y) && !this.figAt(s.x, s.y));
      const a = await this.pickSquare(p, free, 'Platziere dein erstes Portal', { ai: q => window.FX_AI.portalScore(this, p, q, null) });
      if (!a) { this.portals.push(...old); return; }
      this.portals.push({ owner: p, x: a.x, y: a.y });
      this.render();
      const b = await this.pickSquare(p, free.filter(s => s.y === a.y && s.x !== a.x), 'Platziere das zweite Portal (gleiche Reihe)', { ai: q => window.FX_AI.portalScore(this, p, q, a) });
      if (b) this.portals.push({ owner: p, x: b.x, y: b.y });
      this.log(`${this.pname(p)} ${p === this.human ? 'platzierst' : 'platziert'} die Portale.`, 'arcane');
      this.fx('portal', {});
      this.render();
    }

    /* ---------------- Grosse Effekte ---------------- */
    async shiftAll([dx, dy]) {
      const figs = this.figs.filter(f => f.alive).sort((a, b) => (b.x * dx + b.y * dy) - (a.x * dx + a.y * dy));
      const moved = [];
      for (const f of figs) {
        const nx = f.x + dx, ny = f.y + dy;
        if (!this.inBoard(nx, ny) || this.figAt(nx, ny) || this.isBlockedFor(f, nx, ny)) continue;
        const from = { x: f.x, y: f.y };
        f.x = nx; f.y = ny; moved.push([f, from]);
      }
      this.fx('astral', { d: [dx, dy] });
      await Promise.all(moved.map(([f, from]) => this.ui.animateMove(f, from, { x: f.x, y: f.y }, 'teleport')));
      this.log('Astralregen: Alle Figuren werden versetzt!', 'arcane');
      for (const [f, from] of moved) await this.onEnter(f, from, { isMove: false, silent: true, noPortal: true });
    }
    async resetToStart() {
      for (const P of this.players) P.carrying = false;
      const used = new Set();
      const place = async (f, x, y) => {
        let t = { x, y };
        if (used.has(`${x},${y}`)) {
          const row = this.homeRow(f.owner);
          const c = [...Array(N).keys()].map(i => ({ x: i, y: row })).filter(q => !used.has(`${q.x},${q.y}`)).sort((a, b) => Math.abs(a.x - x) - Math.abs(b.x - x));
          if (!c.length) return; t = c[0];
        }
        used.add(`${t.x},${t.y}`);
        const from = { x: f.x, y: f.y }; f.x = t.x; f.y = t.y;
        await this.ui.animateMove(f, from, t, 'teleport');
      };
      const heroes = this.figs.filter(f => f.alive && f.kind === 'hero');
      for (const h of heroes) await place(h, START[h.owner].x, START[h.owner].y);
      for (const f of this.figs.filter(f => f.alive && f.kind !== 'hero')) {
        const s = START[f.owner];
        await place(f, s.x + (f.x < s.x ? -1 : 1), this.homeRow(f.owner));
      }
      this.fx('timeRift', {});
      this.log('Arkaner Zeitriss: Alle Figuren kehren zu ihren Startpositionen zurück!', 'epic');
      this.render();
    }
    async rewindTurn() {
      const moves = [];
      for (const f of this.figs.filter(f => f.alive)) {
        const s = this.turn.startPos.get(f.id);
        if (!s || (s.x === f.x && s.y === f.y)) continue;
        moves.push([f, { x: f.x, y: f.y }, s]);
      }
      for (const [f] of moves) { f.x = -10 - f.id; }
      for (const [f, from, s] of moves) {
        if (this.figAt(s.x, s.y)) { f.x = from.x; f.y = from.y; continue; }
        f.x = s.x; f.y = s.y;
      }
      for (const [f, from] of moves) if (f.x < 0) { f.x = from.x; f.y = from.y; }
      this.players.forEach((P, i) => { P.carrying = this.turn.startCarry[i]; });
      this.fx('timeRift', {});
      await Promise.all(moves.map(([f, from]) => this.ui.animateMove(f, from, { x: f.x, y: f.y }, 'teleport')));
      this.log('Zeitkrümmung: Alle Figuren kehren an den Zugbeginn zurück!', 'epic');
      this.render();
    }
    async rotateBoard(dir) {
      const rot = dir === 1 ? (x, y) => ({ x: y, y: N - 1 - x }) : (x, y) => ({ x: N - 1 - y, y: x });
      const nw = new Map();
      for (const [k, w] of this.walls) {
        const [a, b] = this.edgeSquares(k); const ra = rot(a.x, a.y), rb = rot(b.x, b.y);
        nw.set(this.edgeKey(ra.x, ra.y, rb.x, rb.y), w);
      }
      this.walls = nw;
      const moves = [];
      for (const f of this.figs.filter(f => f.alive)) { const from = { x: f.x, y: f.y }; const r = rot(f.x, f.y); f.x = r.x; f.y = r.y; moves.push([f, from]); }
      for (const o of [...this.traps, ...this.clouds, ...this.banners, ...this.portals]) { const r = rot(o.x, o.y); o.x = r.x; o.y = r.y; }
      for (const b of this.blocks) b.squares = b.squares.map(s => rot(s.x, s.y));
      this.fx('rotate', { dir });
      await this.ui.rotateBoardFx(dir);
      this.render();
      this.log('Finsterniswende: Das Brett dreht sich um 90°!', 'epic');
      for (const p of [this.cur, 1 - this.cur]) if (this.portalsOf(p).length) await this.placePortals(p);
    }
    async nullpunkt(p) {
      this.walls.clear();
      this.players.forEach(P => { P.wallsLeft = 10; });
      this.fx('nullpunkt', {});
      this.log('Nullpunkt: Alle Wände werden zurückgesetzt!', 'epic');
      this.render();
      for (const q of [p, 1 - p]) {
        const cand = this.allEdges().filter(k => this.canPlaceWallAt(k, { owner: q, ignoreHalf: true }));
        const k = await this.pickEdge(q, cand, 'Nullpunkt: Setze 1 Wand an eine beliebige Stelle', { ai: key => window.FX_AI.wallPlaceValue(this, q, key) });
        if (k) this.placeWall(q, k);
        this.render();
      }
    }

    /* ---------------- Karten / Hand ---------------- */
    buildDeck(cls) {
      const deck = [];
      for (const [id, n] of DECKS[cls]) for (let i = 0; i < n; i++) deck.push({ uid: UID++, id });
      return shuffle(deck);
    }
    async draw(p, n = 1, noLimit = false) {
      const P = this.P(p);
      for (let i = 0; i < n; i++) {
        if (!P.deck.length) {
          const back = P.discard.filter(c => !this.def(c).types.includes('ultimate'));
          if (!back.length) { this.log(`${this.pname(p)}: Deck und Ablagestapel sind leer.`); break; }
          P.discard = P.discard.filter(c => this.def(c).types.includes('ultimate'));
          P.deck = shuffle(back);
          this.log(`${this.pname(p)} ${p === this.human ? 'mischst' : 'mischt'} den Ablagestapel als neues Deck.`);
        }
        const c = P.deck.pop();
        P.hand.push(c);
        this.ui.drawFx && this.ui.drawFx(p, c);
      }
      this.render();
      if (!noLimit) await this.enforceHandLimit(p);
    }
    handLimit(p) { return (this.level === 'boss' && p !== this.human && !this.puzzle) ? 6 : 5; }
    async enforceHandLimit(p) {
      const P = this.P(p);
      const over = P.hand.length - this.handLimit(p);
      if (over > 0) await this.discardFromHand(p, over, `Handlimit: Wirf ${over} Karte${over > 1 ? 'n' : ''} ab`, true);
    }
    async discardFromHand(p, n, prompt, forced) {
      const P = this.P(p);
      n = Math.min(n, P.hand.length);
      if (n <= 0) return true;
      const pick = await this.pickCards(p, P.hand.slice(), prompt, { min: n, max: n, discard: true, ai: c => -window.FX_AI.cardValue(this, p, c) });
      for (const c of (pick || P.hand.slice(0, n))) this.discardSpecific(p, c);
      return true;
    }
    discardSpecific(p, c, why) {
      const P = this.P(p); const i = P.hand.indexOf(c);
      if (i < 0) return;
      P.hand.splice(i, 1); P.discard.push(c);
      this.log(`${this.pname(p)} ${p === this.human ? 'wirfst' : 'wirft'} ${this.cardName(c)} ab${why ? ' (' + why + ')' : ''}.`);
      this.render();
    }
    randomHandCards(q, n) { return shuffle(this.P(q).hand.slice()).slice(0, n); }
    async revealHandTo(viewer, q) {
      this.log(`${this.pname(q)} ${q === this.human ? 'musst' : 'muss'} die Handkarten zeigen.`);
      if (!this.isAI(viewer)) await this.ui.showCards(this.P(q).hand.slice(), 'Handkarten des Gegners');
      else if (q === this.human) await this.ui.toast('Der Gegner sieht deine Handkarten.');
    }
    async showCards(p, cards, title) { if (!this.isAI(p)) await this.ui.showCards(cards, title); }
    async reorderTopCards(viewer, q, n) {
      const D = this.P(q).deck; const top = D.slice(-n).reverse();
      if (!top.length) return;
      if (this.isAI(viewer)) { this.log('Der Gegner sieht sich deine obersten Deckkarten an.'); return; }
      const order = [];
      let rest = top.slice();
      while (rest.length) {
        const pick = await this.pickCards(viewer, rest, `Rabenfalle: Welche Karte soll als ${order.length + 1}. oben liegen?`, { min: 1, max: 1 });
        const c = pick && pick[0] ? pick[0] : rest[0];
        order.push(c); rest = rest.filter(x => x !== c);
      }
      D.splice(D.length - top.length, top.length, ...order.reverse());
      this.log('Die obersten Deckkarten des Gegners wurden neu geordnet.');
    }
    async searchDeck(p, filter, max, prompt) {
      const P = this.P(p);
      const cand = P.deck.filter(filter);
      if (!cand.length) { this.log('Keine passende Karte im Deck.'); shuffle(P.deck); return; }
      const pick = await this.pickCards(p, cand, prompt, { min: 0, max, ai: c => window.FX_AI.cardValue(this, p, c) });
      for (const c of (pick || [])) { P.deck.splice(P.deck.indexOf(c), 1); P.hand.push(c); this.log(`${this.pname(p)} ${p === this.human ? 'nimmst' : 'nimmt'} ${this.cardName(c)} auf die Hand.`); }
      shuffle(P.deck);
      this.render();
      await this.enforceHandLimit(p);
    }
    async coinFlip(heads) { await this.ui.coin(heads); }

    originCandidates(p, d) {
      const res = [];
      const h = this.heroOf(p);
      if (d.heroOrigin) return h ? [h] : [];
      if (h) res.push(h);
      for (const c of this.clonesOf(p)) {
        if (d.noClone && this.turn.clonesEmpowered !== p) continue;
        res.push(c);
      }
      return res;
    }
    canPlayCardsNow(p) {
      if (this.over) return { ok: false, reason: 'Spiel vorbei' };
      if (!this.heroOf(p) && !this.clonesOf(p).length) return { ok: false, reason: 'Keine Figur im Spiel.' };
      if (p === this.cur) {
        if (this.turn.noPlay) return { ok: false, reason: 'Im ersten Zug darfst du keine Karte spielen.' };
        if (this.turn.dontPlay) return { ok: false, reason: 'Du darfst in diesem Zug keine Karten spielen.' };
      }
      const P = this.P(p);
      if (this.figsOf(p).some(f => this.clouds.some(c => c.kind === 'smoke' && c.owner !== p && this.inCloud(c, f.x, f.y)))) return { ok: false, reason: 'Eine deiner Figuren steht in einer Rauchwolke.' };
      void P;
      return { ok: true };
    }
    canPlayCard(p, card, o = {}) {
      const d = this.def(card); const P = this.P(p);
      if (!d || d.cls === 'team') return { ok: false, reason: 'Teamkarte – nur im Team-Modus.' };
      const now = this.canPlayCardsNow(p);
      if (!now.ok) return now;
      if (!o.asCounter) {
        if (p !== this.cur || this.busy && !o.internal) return { ok: false, reason: 'Nicht dein Zug.' };
        if (d.types.includes('konter')) return { ok: false, reason: 'Konterkarte – nur spielbar, wenn ihre Bedingung erfüllt ist.' };
        if (this.turn.playsUsed >= this.turn.plays) return { ok: false, reason: 'Du hast in diesem Zug bereits deine Karte gespielt.' };
      } else if (p !== this.cur && this.turn.antikonter) return { ok: false, reason: 'Antikonter aktiv.' };
      if (d.noFlag && P.carrying) return { ok: false, reason: 'Nicht spielbar, während du die Flagge trägst.' };
      const need = d.cost && d.cost.discard !== 'X' ? d.cost.discard : 0;
      if (need && P.hand.filter(c => c !== card).length < need) return { ok: false, reason: `Du benötigst ${need} weitere Handkarte${need > 1 ? 'n' : ''} zum Abwerfen.` };
      const origins = this.originCandidates(p, d);
      if (!origins.length) return { ok: false, reason: 'Keine Figur kann diese Karte spielen.' };
      if (d.can) {
        let reason = null;
        const okO = origins.filter(o2 => { const r = d.can(this, { p, origin: o2, card }); if (r !== true) { reason = typeof r === 'string' ? r : 'Bedingung nicht erfüllt.'; return false; } return true; });
        if (!okO.length) return { ok: false, reason };
        return { ok: true, origins: okO };
      }
      return { ok: true, origins };
    }

    async playCard(p, card, o = {}) {
      const d = this.def(card); const P = this.P(p);
      const chk = this.canPlayCard(p, card, { asCounter: o.asCounter, internal: true });
      if (!chk.ok) { this.log(chk.reason, 'bad'); return false; }
      let origin = o.origin && chk.origins.includes(o.origin) ? o.origin : null;
      if (!origin) {
        const origins = chk.origins;
        if (origins.length === 1 || !(d.needsOrigin)) origin = origins.find(f => f.kind === 'hero') || origins[0];
        else origin = await this.pickFigure(p, origins, `Von welcher Figur aus spielst du ${d.name}?`, { secret: true, ai: f => window.FX_AI.originScore(this, p, d, f) });
        if (!origin) origin = origins[0];
      }
      const hi = P.hand.indexOf(card); if (hi >= 0) P.hand.splice(hi, 1);
      if (!o.asCounter) this.turn.playsUsed++;
      const isTrap = d.types.includes('trap');
      this.log(isTrap && p !== this.human ? 'Der Gegner spielt eine verdeckte Karte.' : `${this.pname(p)} ${p === this.human ? 'spielst' : 'spielt'} ${d.name}${o.asCounter ? ' (Konter!)' : ''}.`, o.asCounter ? 'counter' : 'card');
      await this.ui.cardPlayed(p, card, { hidden: isTrap && p !== this.human, counter: !!o.asCounter });
      let paidX = 0;
      if (d.cost && d.cost.discard === 'X') {
        const pick = await this.pickCards(p, P.hand.slice(), `${d.name}: Wirf beliebig viele Karten ab`, { min: 0, max: P.hand.length, discard: true, ai: c => window.FX_AI.reflexDiscard(this, p, c) });
        for (const c of (pick || [])) this.discardSpecific(p, c, d.name);
        paidX = (pick || []).length;
      } else if (d.cost && d.cost.discard) {
        await this.discardFromHand(p, d.cost.discard, `${d.name}: Wirf ${d.cost.discard} Karte${d.cost.discard > 1 ? 'n' : ''} ab (Kosten)`);
      }
      if (d.id !== 82) this.vanishTarn(p);
      if (d.antikonter && p === this.cur) { this.turn.antikonter = true; this.fx('antikonter', { p }); }
      const ev = { type: 'cardPlayed', player: p, card, def: d, negated: false };
      if (!d.antikonter && !isTrap) await this.emitCardPlayed(ev);
      const ctx = { p, card, def: d, origin, trig: o.trig, paidX, keepCard: false };
      if (!ev.negated) {
        try { await d.play(this, ctx); } catch (e) { console.error('Karteneffekt-Fehler', d.name, e); }
        if (d.endTurn) { this.turn.endRequested = true; this.log('Der Zug endet sofort.', 'bad'); }
        if (d.skipNext) this.skipTurns(p, d.skipNext);
      } else {
        this.log(`${d.name} wurde negiert!`, 'arcane');
        this.fx('negate', { p });
      }
      if (!ctx.keepCard || ev.negated) P.discard.push(card);
      this.render();
      this.checkWin();
      return true;
    }
    async playCopy(p, card, origin) {
      const d = this.def(card);
      this.log(`Transfusionsspiegel kopiert ${d.name}!`, 'arcane');
      await this.ui.revealCard(p, card, 'Kopie');
      const ctx = { p, card, def: d, origin: origin || this.heroOf(p), keepCard: true, copy: true };
      if (d.cost && d.cost.discard && d.cost.discard !== 'X') await this.discardFromHand(p, d.cost.discard, `${d.name}: Kosten`);
      try { await d.play(this, ctx); } catch (e) { console.error(e); }
      if (d.endTurn) this.turn.endRequested = true;
      if (d.skipNext) this.skipTurns(p, d.skipNext);
    }
    canResolveStolen(p, card, origin) {
      const d = this.def(card);
      if (d.needsOrigin && !origin) return false;
      const need = d.cost && d.cost.discard !== 'X' ? d.cost.discard : 0;
      if (need && this.P(p).hand.length < need) return false;
      if (d.noFlag && this.P(p).carrying) return false;
      if (d.can) { const r = d.can(this, { p, origin: origin || this.heroOf(p), card }); if (r !== true) return false; }
      return true;
    }
    async playStolen(p, card, origin) {
      const q = 1 - p; const Q = this.P(q); const d = this.def(card);
      const i = Q.hand.indexOf(card); if (i >= 0) Q.hand.splice(i, 1);
      this.log(`${this.pname(p)} ${p === this.human ? 'spielst' : 'spielt'} die gestohlene Karte ${d.name}!`, 'arcane');
      await this.ui.revealCard(p, card, 'Gestohlen!');
      if (d.cost && d.cost.discard && d.cost.discard !== 'X') await this.discardFromHand(p, d.cost.discard, `${d.name}: Kosten`);
      const ctx = { p, card, def: d, origin: origin || this.heroOf(p), keepCard: false };
      try { await d.play(this, ctx); } catch (e) { console.error(e); }
      if (d.endTurn) this.turn.endRequested = true;
      if (!ctx.keepCard) Q.discard.push(card); else if (d.types.includes('trap')) { /* Falle gehört nun dem Dieb */ }
      this.render();
    }

    /* ---------------- Konter-System ---------------- */
    eligibleCounters(q, ev) {
      const P = this.P(q);
      if (this.puzzle && this.isAI(q)) return [];
      const now = this.canPlayCardsNow(q);
      if (!now.ok) return [];
      if (q !== this.cur && this.turn.antikonter) return [];
      const out = [];
      for (const card of P.hand) {
        const d = this.def(card);
        if (!d.counter || d.counter.on !== (ev.type === 'enter' ? 'enter' : ev.type)) continue;
        const chk = this.canPlayCard(q, card, { asCounter: true, internal: true });
        if (!chk.ok) continue;
        let data = null;
        try { data = d.counter.test(this, q, ev); } catch (e) { console.error(e); }
        if (data) out.push({ card, data: { ...data, ev } });
      }
      return out;
    }
    async offerWindow(q, ev, blocking) {
      const list = this.eligibleCounters(q, ev);
      if (!list.length) return null;
      let choice = null;
      if (this.isAI(q)) choice = window.FX_AI.counterDecision(this, q, list, ev);
      else if (!blocking && q === this.cur) { this.window = { ev, list }; this.render(); return null; }
      else choice = await this.ui.offerCounters(q, list, ev);
      if (!choice) return null;
      await this.playCard(q, choice.card, { asCounter: true, trig: choice.data });
      return choice;
    }
    async emitEnter(ev) {
      if (this.over) return;
      const order = [1 - this.cur, this.cur];
      for (const q of order) {
        if (!ev.fig.alive && ev.fig.owner !== q) { /* Figur bereits weg */ }
        await this.offerWindow(q, ev, false);
        if (this.over) return;
      }
    }
    async emitCardPlayed(ev) {
      const q = 1 - ev.player;
      await this.offerWindow(q, ev, true);
    }
    async affect(src, f, info) {
      if (!f || !f.alive) return null;
      if (f.owner === src) return f;
      const ev = { type: 'affect', fig: f, src, info, result: {} };
      await this.offerWindow(f.owner, ev, true);
      if (ev.result.negate) { this.log(`${this.figName(f)} ist vom Effekt nicht betroffen.`, 'arcane'); return null; }
      if (ev.result.redirect) { this.log(`Der Effekt trifft stattdessen ${this.figName(ev.result.redirect)}.`, 'arcane'); return ev.result.redirect; }
      return f;
    }

    /* ---------------- Auswahl-Abfragen ---------------- */
    async pick(p, req) {
      if (!req.options || !req.options.length) return req.kind === 'cards' ? [] : null;
      if (this.isAI(p)) return window.FX_AI.pick(this, p, req);
      return this.ui.pick(req);
    }
    pickSquare(p, options, prompt, o = {}) { return this.pick(p, { kind: 'square', options, prompt, ...o }); }
    pickFigure(p, options, prompt, o = {}) { return this.pick(p, { kind: 'figure', options, prompt, ...o }); }
    pickWall(p, options, prompt, o = {}) { return this.pick(p, { kind: 'wall', options, prompt, ...o }); }
    pickEdge(p, options, prompt, o = {}) { return this.pick(p, { kind: 'edge', options, prompt, ...o }); }
    pickOption(p, options, prompt, o = {}) {
      return this.pick(p, { kind: 'option', options, prompt, ...o }).then(r => r && typeof r === 'object' && 'value' in r ? r.value : r);
    }
    pickCards(p, options, prompt, o = {}) { return this.pick(p, { kind: 'cards', options, prompt, min: 1, max: 1, ...o }); }

    /* ---------------- Spielablauf ---------------- */
    async setup() {
      const [c0, c1] = [this.P(0).cls, this.P(1).cls];
      this.newFig(0, 'hero', START[0].x, START[0].y);
      this.newFig(1, 'hero', START[1].x, START[1].y);
      this.P(0).deck = this.buildDeck(c0);
      this.P(1).deck = this.buildDeck(c1);
      if (this.level === 'boss') this.P(1).wallsLeft = 12;
      this.render();
      await this.ui.announce('Aufstellung', 'silver');
      for (const p of [0, 1]) {
        if (this.P(p).cls === 'assassin') await this.summonClones(p, 1, this.heroOf(p), 'shadow', { startLine: true });
      }
      for (const p of [0, 1]) if (this.P(p).cls === 'mage') await this.placePortals(p);
      for (const p of [0, 1]) {
        const cand = this.allEdges().filter(k => this.canPlaceWallAt(k, { owner: p, restrictHalf: true }));
        const k = await this.pickEdge(p, cand, 'Aufstellung: Setze 1 Wand in deiner Spielfeldhälfte', { ai: key => window.FX_AI.wallPlaceValue(this, p, key) + Math.random() * 0.3 });
        if (k) this.placeWall(p, k);
        this.render();
      }
      await this.draw(0, 2, true);
      await this.draw(1, this.level === 'boss' ? 3 : 2, true);
      this.log('Die Schlacht beginnt. Spieler D1 beginnt.', 'epic');
    }

    async run() {
      try {
        if (!this.puzzle) await this.setup();
        this.cur = this.puzzle ? 0 : 0;
        while (!this.over) {
          await this.playTurn(this.cur);
          if (this.over || this.puzzle) break;
          this.cur = this.turn.extraTurn ? this.cur : 1 - this.cur;
          if (this.turn.extraTurn) this.log(`${this.pname(this.cur)} ${this.cur === this.human ? 'spielst' : 'spielt'} einen weiteren Zug!`, 'epic');
        }
      } catch (e) {
        console.error(e);
        this.ui.toast && this.ui.toast('Fehler: ' + e.message);
      }
    }

    async startTurn(p) {
      const P = this.P(p);
      this.cur = p;
      P.turnCount++;
      this.G++;
      const k = P.turnCount;
      this.turn = this.newTurn(p);
      this.window = null;
      // eigene Effekte laufen aus
      for (const c of this.clouds.filter(c => c.owner === p)) {
        if (c.kind === 'sky') {
          const hit = new Set(this.figs.filter(f => f.alive && f.owner !== p && this.inCloud(c, f.x, f.y)).map(f => f.owner));
          for (const q of hit) { this.log('Der Himmelsbruch trifft!', 'epic'); this.skipTurns(q, 1); }
        }
      }
      this.clouds = this.clouds.filter(c => c.owner !== p);
      this.blocks = this.blocks.filter(b => b.owner !== p);
      for (const f of this.figs) if (f.alive) this.turn.startPos.set(f.id, { x: f.x, y: f.y });
      this.turn.startCarry = this.players.map(x => x.carrying);
      this.render();
      if (P.skip > 0) {
        P.skip--;
        this.turn.skipped = true;
        this.log(`${this.pname(p)} ${p === this.human ? 'setzt' : 'setzt'} diesen Zug aus.`, 'bad');
        await this.ui.turnBanner(p, true);
        return;
      }
      await this.ui.turnBanner(p, false);
      if (!this.heroOf(p)) await this.rebirth(p);
      if (this.over) return;
      if (!this.puzzle) await this.draw(p, 1);
      const nx = P.next[k] || {};
      if (nx.plays) this.turn.plays += nx.plays;
      if (nx.straight) this.turn.pools.hero.straight += nx.straight;
      if (nx.wolfstraight) this.turn.pools.wolf.straight += nx.wolfstraight;
      if (nx.dontplay) { this.turn.dontPlay = true; this.log(`${this.pname(p)} ${p === this.human ? 'darfst' : 'darf'} in diesem Zug keine Karten spielen.`, 'bad'); }
      delete P.next[k];
      if (p === 0 && k === 1 && !this.puzzle) this.turn.noPlay = true;
      if (P.wolfMode) this.turn.wallShifts = 1;
      if (this.puzzle && this.puzzle.turn) Object.assign(this.turn, JSON.parse(JSON.stringify(this.puzzle.turn)));
      this.render();
    }
    async rebirth(p) {
      const P = this.P(p);
      const row = this.homeRow(p);
      const cand = [...Array(N).keys()].map(x => ({ x, y: row })).filter(q => !this.figAt(q.x, q.y));
      if (!cand.length) return;
      const s = await this.pickSquare(p, cand, 'Wiedergeburt: Wähle ein freies Feld an deinem Spielfeldrand', { ai: q => window.FX_AI.rebirthScore(this, p, q) });
      const t = s || cand[0];
      const h = this.figs.find(f => f.owner === p && f.kind === 'hero');
      h.alive = true; h.x = t.x; h.y = t.y; h.snare = new Set();
      P.abilityUsed = false; P.wolfMode = false; P.carrying = false; P.heroKnown = true; P.protectUntil = -1;
      this.log(`${this.pname(p)}: Wiedergeburt auf ${this.sq(t.x, t.y)}.`, 'epic');
      this.fx('rebirth', { fig: h });
      this.render();
      await this.onEnter(h, { x: h.x, y: h.y }, { isMove: false, noPortal: true });
      if (P.cls === 'assassin' && h.alive) await this.summonClones(p, 1, h, 'shadow', { startLine: true });
    }
    async playTurn(p) {
      await this.startTurn(p);
      if (this.over) return;
      if (!this.turn.skipped) {
        if (this.isAI(p)) {
          await window.FX_AI.takeTurn(this, p);
        } else {
          if (!this.puzzle && this.P(p).turnCount === 1 && !this.P(p).mulliganDone) this.mulliganAvailable = true;
          this.render();
          await new Promise(res => { this._endHuman = res; if (this.turn.endRequested) res(); });
          this.mulliganAvailable = false;
        }
      }
      await this.endTurn(p);
    }
    async endTurn(p) {
      const P = this.P(p);
      for (const c of this.clonesOf(p)) if (c.tag === 'mirror' && c.vanishTurn != null && c.vanishTurn <= P.turnCount) { c.alive = false; this.fx('vanish', { fig: c }); this.log('Die Spiegelklone verblassen.'); }
      if (!this.clonesOf(p).length) P.heroKnown = true;
      this.window = null;
      this.render();
      if (this.puzzle && !this.over) this.ui.puzzleFailed && this.ui.puzzleFailed();
      await sleep(150);
    }
    checkWin() {
      if (this.over) return;
      for (const P of this.players) if (P.points >= 2) this.endGame(P.idx, 'Zwei Flaggenpunkte');
    }
    endGame(winner, reason) {
      if (this.over) return;
      this.over = { winner, reason };
      this.log(winner === this.human ? `SIEG! (${reason})` : `NIEDERLAGE. (${reason})`, 'epic');
      this._endHuman && this._endHuman();
      this.ui.gameOver(this.over);
    }
    puzzleCheck(kind) {
      const goal = this.puzzle.goal || 'capture';
      const ok = (goal === 'capture' && kind === 'capture' && !this.heroOf(1)) || (goal === kind);
      if (ok && !this.over) {
        this.over = { winner: 0, reason: 'Rätsel gelöst', puzzle: true };
        this._endHuman && this._endHuman();
        this.ui.puzzleSolved && this.ui.puzzleSolved();
      }
    }

    /* ---------------- Aktionen des Menschen ---------------- */
    async act(fn) {
      if (this.busy || this.over || this.cur !== this.human || this.turn.skipped) return;
      this.busy = true; this.window = null; this.render();
      try { await fn(); } catch (e) { console.error(e); }
      this.busy = false;
      this.checkWin();
      if (this.turn.endRequested && !this.over) this._endHuman && this._endHuman();
      this.render();
    }
    actMove(f, x, y) {
      return this.act(async () => {
        const r = this.reachable(f).get(`${x},${y}`);
        if (!r) return;
        this.mulliganAvailable = false;
        await this.moveAlong(f, r.path);
      });
    }
    actWall(key) {
      return this.act(async () => {
        if (this.turn.wallsUsed >= this.turn.walls) return;
        if (!this.legalWallEdges(this.human).includes(key)) return;
        this.mulliganAvailable = false;
        this.placeWall(this.human, key);
        this.turn.wallsUsed++;
      });
    }
    actWallShift(from, to) {
      return this.act(async () => {
        if (this.turn.wallShiftsUsed >= this.turn.wallShifts) return;
        if (!this.wallShiftTargets(from, 1).includes(to)) return;
        this.moveWall(from, to);
        this.turn.wallShiftsUsed++;
        this.turn.walls = 0;
      });
    }
    actPlay(card) {
      return this.act(async () => {
        const chk = this.canPlayCard(this.human, card, { internal: true });
        if (!chk.ok) { this.ui.toast(chk.reason); return; }
        this.mulliganAvailable = false;
        await this.playCard(this.human, card, {});
      });
    }
    actCounter(entry) {
      const w = entry;
      return this.act(async () => {
        const d = this.def(w.card);
        const data = d.counter.test(this, this.human, w.data.ev);
        if (!data) { this.ui.toast('Die Bedingung ist nicht mehr erfüllt.'); return; }
        await this.playCard(this.human, w.card, { asCounter: true, trig: { ...data, ev: w.data.ev } });
      });
    }
    heroAbilityState(p) {
      const P = this.P(p);
      if (P.cls !== 'knight' && P.cls !== 'ranger') return { usable: false, passive: true };
      if (P.abilityUsed) return { usable: false, reason: 'Bereits in diesem Leben genutzt.' };
      if (p !== this.cur || !this.heroOf(p)) return { usable: false, reason: 'Nur in deinem Zug.' };
      if (this.turn.noPlay && P.cls === 'knight') return { usable: true };
      return { usable: true };
    }
    async useHeroAbility(p) {
      const P = this.P(p);
      if (!this.heroAbilityState(p).usable) return;
      if (P.cls === 'knight') {
        const v = await this.pickOption(p, [
          { label: '+1 Karte spielen', value: 'play' }, { label: '+1 Karte ziehen', value: 'draw' }, { label: '+1 Feld gerade bewegen', value: 'move' }
        ], 'Ritter – Heldenfähigkeit (1× pro Leben)', { optional: true, ai: o => window.FX_AI.knightOption(this, p, o.value) });
        if (!v) return;
        P.abilityUsed = true;
        if (v === 'play') this.addPlays(1);
        else if (v === 'draw') await this.draw(p, 1);
        else this.addPool(p, 'hero', 'straight', 1);
        this.log(`${this.pname(p)} ${p === this.human ? 'nutzt' : 'nutzt'} die Heldenfähigkeit des Ritters.`, 'epic');
      } else if (P.cls === 'ranger') {
        P.abilityUsed = true;
        this.log(`${this.pname(p)} ${p === this.human ? 'durchsuchst' : 'durchsucht'} das Deck (Heldenfähigkeit).`, 'epic');
        await this.searchDeck(p, () => true, 1, 'Waldläufer: Wähle 1 Karte aus deinem Deck');
      }
      this.fx('heroPower', { p });
    }
    actHero() { return this.act(() => this.useHeroAbility(this.human)); }
    actMulligan() {
      return this.act(async () => {
        const P = this.P(this.human);
        if (!this.mulliganAvailable || P.mulliganDone) return;
        const n = Math.max(0, P.hand.length - 1);
        P.deck.push(...P.hand); P.hand = []; shuffle(P.deck);
        P.mulliganDone = true; this.mulliganAvailable = false;
        this.log(`Mulligan: Du ziehst ${n} neue Karten.`);
        await this.draw(this.human, n);
      });
    }
    actEndTurn() {
      if (this.busy || this.over || this.cur !== this.human) return;
      this._endHuman && this._endHuman();
    }
  }

  window.FX_ENGINE = { Game, START, N, COLS, sleep, shuffle, near };
})();

/* =========================================================
   FLAGGED – KI-Gegner (Leicht · Medium · Stark · Endboss)
   ========================================================= */
(function () {
  const N = 8;
  const D4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const D8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  const near = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));

  const LEVELS = {
    easy:   { noise: 34, cardChance: 0.35, counterChance: 0.15, counterMin: 25, wallMin: 20, wallChance: 0.25, threatExtra: 0, dangerW: 0.2, delay: 520, lookahead: false },
    medium: { noise: 9,  cardChance: 0.8, counterChance: 0.6, counterMin: 7,  wallMin: 10, wallChance: 0.8, threatExtra: 0, dangerW: 0.65, delay: 470, lookahead: false },
    hard:   { noise: 0.5, cardChance: 1, counterChance: 1, counterMin: 4, wallMin: 7, wallChance: 1, threatExtra: 0, dangerW: 0.5, delay: 430, lookahead: false },
    boss:   { noise: 0, cardChance: 1, counterChance: 1, counterMin: 3, wallMin: 7, wallChance: 1, threatExtra: 0, dangerW: 0.5, delay: 420, lookahead: false }
  };
  const L = (g) => LEVELS[g.level] || LEVELS.medium;

  /* ---------------- Distanzfelder ---------------- */
  function distField(g, row, through = false) {
    const d = new Array(N * N).fill(99); const q = [];
    for (let x = 0; x < N; x++) { d[row * N + x] = 0; q.push(row * N + x); }
    let h = 0;
    while (h < q.length) {
      const i = q[h++], x = i % N, y = (i / N) | 0;
      for (const [dx, dy] of D4) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= N || ny >= N) continue;
        const j = ny * N + nx;
        if (d[j] <= d[i] + 1) continue;
        if (!through && g.walls.has(g.edgeKey(x, y, nx, ny))) continue;
        d[j] = d[i] + 1; q.push(j);
      }
    }
    return d;
  }
  function targetRow(g, p) { return g.P(p).carrying ? g.homeRow(p) : g.goalRow(p); }
  function goalDistFrom(g, p, q) { return distField(g, targetRow(g, p))[q.y * N + q.x]; }

  // kürzeste Wege von einer Figur (orthogonal, Figuren blockieren ausser Ziel)
  function reachDist(g, from, to, maxD, ignoreFigs = false) {
    if (from.x === to.x && from.y === to.y) return 0;
    const seen = new Map([[from.y * N + from.x, 0]]); const q = [[from.x, from.y, 0]]; let h = 0;
    while (h < q.length) {
      const [x, y, d] = q[h++];
      if (d >= maxD) continue;
      for (const [dx, dy] of D4) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= N || ny >= N) continue;
        if (g.walls.has(g.edgeKey(x, y, nx, ny))) continue;
        const j = ny * N + nx; if (seen.has(j)) continue;
        if (nx === to.x && ny === to.y) return d + 1;
        if (!ignoreFigs && g.figAt(nx, ny)) continue;
        seen.set(j, d + 1); q.push([nx, ny, d + 1]);
      }
    }
    return 99;
  }

  function capturersAgainst(g, p) {
    const o = 1 - p; const res = [];
    for (const f of g.figsOf(o)) {
      if (f.kind === 'wolf') res.push(f);
      else if (f.kind === 'hero' || (f.kind === 'clone' && !g.P(o).heroKnown)) res.push(f);
    }
    return res;
  }
  function threatOn(g, p, fig, extra = 0) {
    if (!fig || g.isProtected(fig)) return false;
    const o = 1 - p; const O = g.P(o);
    const handBonus = extra > 0 && O.hand.length > 0 ? extra : 0;
    for (const c of capturersAgainst(g, p)) {
      if (c.kind === 'hero' && O.wolfMode && near(c, fig) <= 1 + 2) return true;
      const R = (c.kind === 'wolf' ? 2 : 2) + handBonus;
      if (reachDist(g, c, fig, R) <= R) return true;
    }
    return false;
  }

  /* ---------------- Bewertung ---------------- */
  function evaluate(g, p) {
    const P = g.P(p), O = g.P(1 - p), lv = L(g);
    let s = 400 * (P.points - O.points);
    const h = g.heroOf(p);
    const fMe = distField(g, targetRow(g, p));
    const fOp = distField(g, targetRow(g, 1 - p));
    // Restweg bis zum Punkt: ohne Flagge = Weg zur Flagge + Heimweg (≈ 7 Reihen)
    const remaining = (pl, f, field) => Math.min(field[f.y * N + f.x], 20) + (g.P(pl).carrying ? 0 : 7);
    const late = Math.min(1, g.G / 90);
    if (h) {
      s -= 11 * remaining(p, h, fMe);
      if (P.carrying) s += 25;
      // je länger die Partie, desto mutiger
      if (threatOn(g, p, h, lv.threatExtra)) s -= (P.carrying ? 120 : 42) * lv.dangerW * (1 - 0.55 * late);
    } else s -= 130;
    const oh = g.knownHeroes(p, 1 - p);
    if (oh.length) {
      s += 9 * Math.min(...oh.map(f => remaining(1 - p, f, fOp)));
      if (O.carrying) s -= 25;
      // Druck auf den Flaggenträger
      if (O.carrying && h && oh.some(e => reachDist(g, h, e, 2) <= 2)) s += 25;
    } else s += 130;
    // Klone: Schutzschild/Täuschung
    for (const c of g.clonesOf(p)) {
      if (threatOn(g, p, c)) s -= 3;
      s -= 0.6 * fMe[c.y * N + c.x];
    }
    const w = g.wolfOf(p);
    if (w) {
      if (threatOn(g, p, w)) s -= 10;
      if (oh.length) s -= 1.5 * Math.min(...oh.map(e => near(w, e)));
    }
    s += 3.2 * P.wallsLeft;
    s += 40 * (O.captures - P.captures);
    return s;
  }

  function simulate(g, mods, fn) {
    const undo = [];
    for (const m of mods) {
      if (m.fig) {
        undo.push(() => { m.fig.x = sx; m.fig.y = sy; m.fig.alive = sa; });
        const sx = m.fig.x, sy = m.fig.y, sa = m.fig.alive;
        if ('x' in m) { m.fig.x = m.x; m.fig.y = m.y; }
        if ('alive' in m) m.fig.alive = m.alive;
      }
      if (m.player !== undefined) {
        const P = g.P(m.player); const c = P.carrying, pt = P.points, cap = P.captures, kn = P.heroKnown;
        undo.push(() => { P.carrying = c; P.points = pt; P.captures = cap; P.heroKnown = kn; });
        if ('carrying' in m) P.carrying = m.carrying;
        if ('points' in m) P.points = m.points;
        if ('captures' in m) P.captures = m.captures;
      }
      if (m.wallAdd) { g.walls.set(m.wallAdd, { owner: m.owner }); undo.push(() => g.walls.delete(m.wallAdd)); }
      if (m.wallDel) { const w = g.walls.get(m.wallDel); g.walls.delete(m.wallDel); undo.push(() => g.walls.set(m.wallDel, w)); }
    }
    try { return fn(); } finally { for (let i = undo.length - 1; i >= 0; i--) undo[i](); }
  }

  function moveMods(g, f, entry) {
    const mods = [{ fig: f, x: entry.x, y: entry.y }];
    const P = g.P(f.owner);
    let bonus = 0;
    if (entry.capture) {
      const v = g.figAt(entry.x, entry.y);
      if (v) {
        mods.push({ fig: v, alive: false });
        if (v.kind === 'hero') {
          const O = g.P(v.owner);
          mods.push({ player: v.owner, captures: O.captures + 1, carrying: false });
          bonus += 160 + (O.carrying ? 140 : 0);
        } else if (v.kind === 'wolf') bonus += 25;
        else bonus += g.P(v.owner).heroKnown ? 6 : 40;
      }
    }
    if (f.kind === 'hero') {
      let carrying = P.carrying, points = P.points;
      for (const st of entry.path) {
        if (!carrying && st.y === g.goalRow(f.owner)) carrying = true;
        else if (carrying && st.y === g.homeRow(f.owner)) { carrying = false; points++; }
      }
      if (carrying !== P.carrying || points !== P.points) mods.push({ player: f.owner, carrying, points });
      if (points > P.points) bonus += points >= 2 ? 5000 : 100;
    }
    return { mods, bonus };
  }

  function bestMoveFor(g, p, f, opts = {}) {
    const lv = L(g);
    const reach = g.reachable(f, opts.pools ? { pools: opts.pools } : {});
    const deep = opts.deep && lv.lookahead;
    const score = deep ? () => replyMin(g, p) : () => evaluate(g, p);
    const base = score();
    let best = { gain: 0, entry: null };
    for (const e of reach.values()) {
      const { mods, bonus } = moveMods(g, f, e);
      let v = simulate(g, mods, score) + bonus - base;
      if (f.kind === 'clone') v += cloneBias(g, p, f, e);
      if (f.kind === 'wolf') v += wolfBias(g, p, f, e);
      v += (Math.random() - 0.5) * lv.noise;
      if (v > best.gain) best = { gain: v, entry: e };
    }
    return best;
  }
  // Vorausschau (Stark/Endboss): schlechteste Bewertung nach der besten gegnerischen Antwortbewegung
  function replyMin(g, p) {
    const o = 1 - p, O = g.P(o), P = g.P(p);
    let worst = evaluate(g, p);
    const nextK = O.turnCount + 1;
    const movers = g.figsOf(o).filter(f => f.kind !== 'clone' || !O.heroKnown);
    for (const f of movers) {
      if (f.snare.has(nextK)) continue;
      const canCap = f.kind === 'hero' || f.kind === 'wolf' || (f.kind === 'clone' && !O.heroKnown);
      const seen = new Set([f.y * N + f.x]); const q = [[f.x, f.y, 0, []]]; let h = 0;
      while (h < q.length) {
        const [x, y, d, path] = q[h++];
        if (d >= 2) continue;
        for (const [dx, dy] of D4) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= N || ny >= N) continue;
          if (g.walls.has(g.edgeKey(x, y, nx, ny))) continue;
          const j = ny * N + nx; if (seen.has(j)) continue; seen.add(j);
          const occ = g.figAt(nx, ny);
          const np = [...path, { x: nx, y: ny }];
          if (occ) {
            if (occ.owner === o || !canCap || g.isProtected(occ)) continue;
            const mods = [{ fig: f, x: nx, y: ny }, { fig: occ, alive: false }];
            let pen = 0;
            if (occ.kind === 'hero') { mods.push({ player: p, captures: P.captures + 1, carrying: false }); pen = 170 + (P.carrying ? 150 : 0); }
            else if (occ.kind === 'wolf') pen = 25;
            worst = Math.min(worst, simulate(g, mods, () => evaluate(g, p)) - pen);
            continue;
          }
          const mods = [{ fig: f, x: nx, y: ny }];
          if (f.kind === 'hero' || (f.kind === 'clone' && !O.heroKnown)) {
            if (!O.carrying && ny === g.goalRow(o)) mods.push({ player: o, carrying: true });
            else if (O.carrying && ny === g.homeRow(o)) mods.push({ player: o, carrying: false, points: O.points + 1 });
          }
          worst = Math.min(worst, simulate(g, mods, () => evaluate(g, p)));
          q.push([nx, ny, d + 1, np]);
        }
      }
    }
    return worst;
  }
  function cloneBias(g, p, f, e) {
    // Täuschung: Klon spiegelt den Vormarsch des Helden, meidet Gefahr
    const d0 = goalDistFrom(g, p, f), d1 = goalDistFrom(g, p, e);
    return (d0 - d1) * 2.5;
  }
  function wolfBias(g, p, f, e) {
    const oh = g.knownHeroes(p, 1 - p);
    if (!oh.length) return 0;
    const before = Math.min(...oh.map(x => near(f, x))), after = Math.min(...oh.map(x => near(e, x)));
    return (before - after) * 4;
  }

  function bestWall(g, p) {
    const edges = g.legalWallEdges(p);
    const base = evaluate(g, p);
    let best = { gain: -Infinity, key: null };
    for (const k of edges) {
      const v = simulate(g, [{ wallAdd: k, owner: p }], () => evaluate(g, p)) - base;
      if (v > best.gain) best = { gain: v, key: k };
    }
    return best;
  }

  /* ---------------- Kartenwert & Kartennutzen ---------------- */
  const BASE_VALUE = {
    17: 9, 77: 9, 39: 9, 89: 8, 94: 8, 20: 9, 22: 8, 16: 6, 78: 6, 61: 6, 88: 7, 56: 6, 106: 7,
    32: 6, 45: 6, 27: 5, 85: 5, 41: 5, 79: 5, 7: 6, 65: 4, 31: 5, 30: 7, 54: 6, 5: 5, 11: 6, 76: 6, 10: 5, 21: 4,
    23: 5, 100: 5, 97: 5, 24: 4, 19: 6, 83: 6, 8: 5, 52: 5, 35: 6, 51: 6, 38: 5, 62: 4, 26: 7, 67: 6, 48: 4, 101: 4, 98: 6, 34: 5,
    60: 4, 50: 4, 81: 4, 29: 4, 68: 6, 42: 3, 43: 3, 44: 3, 36: 4, 57: 5, 58: 5, 84: 5, 63: 6, 92: 5, 25: 5, 66: 8, 86: 6, 87: 5,
    46: 3, 47: 4, 70: 4, 71: 4, 72: 5, 73: 3, 74: 5, 49: 4, 28: 5, 95: 5, 40: 5, 53: 4, 93: 6, 64: 4, 15: 4, 105: 4, 91: 5, 90: 5, 103: 4,
    14: 3, 82: 3, 104: 3, 13: 6, 12: 3, 9: 5, 18: 3, 33: 4, 37: 6, 55: 4, 59: 2, 96: 3, 99: 5, 102: 5, 6: 5, 80: 5
  };
  function cardValue(g, p, c) {
    const v = BASE_VALUE[c.id] || 4;
    const dup = g.P(p).hand.filter(x => x.id === c.id).length;
    return v - (dup > 1 ? 1 : 0);
  }

  function urgency(g, p) {
    const O = g.P(1 - p);
    const oh = g.knownHeroes(p, 1 - p);
    if (!oh.length) return 0;
    const f = distField(g, targetRow(g, 1 - p));
    const d = Math.min(...oh.map(x => f[x.y * N + x.y * 0 + x.x]));
    let u = Math.max(0, 8 - d) * (O.carrying ? 3 : 1);
    const h = g.heroOf(p);
    if (h && threatOn(g, p, h)) u += 8;
    return u;
  }

  function moveGainWith(g, p, extra) {
    const f = g.heroOf(p); if (!f) return 0;
    const av = g.availPools(f);
    const pools = { straight: av.straight + (extra.straight || 0), diag: av.diag + (extra.diag || 0), horiz: av.horiz + (extra.horiz || 0), all: av.all + (extra.all || 0) };
    let gain = 0;
    const savedMA = g.turn.moveAll, savedTW = g.turn.throughWalls;
    if (extra.moveAll) g.turn.moveAll = true;
    if (extra.through) g.turn.throughWalls = true;
    try {
      gain = bestMoveFor(g, p, f, { pools }).gain;
      // auch Klone profitieren (Assassine)
    } finally { g.turn.moveAll = savedMA; g.turn.throughWalls = savedTW; }
    return gain;
  }
  function moveCardScore(g, p, extra) {
    if (!g.heroOf(p)) return 0;
    const without = moveGainWith(g, p, {});
    const withB = moveGainWith(g, p, extra);
    return withB - without;
  }

  function bestWallRemoval(g, p) {
    const base = evaluate(g, p); let best = 0;
    for (const k of [...g.walls.keys()]) best = Math.max(best, simulate(g, [{ wallDel: k }], () => evaluate(g, p)) - base);
    return best;
  }
  function wallRemovalValue(g, p, k) { const base = evaluate(g, p); return simulate(g, [{ wallDel: k }], () => evaluate(g, p)) - base; }
  function wallPlaceValue(g, p, k) { const base = evaluate(g, p); return simulate(g, [{ wallAdd: k, owner: p }], () => evaluate(g, p)) - base; }
  function wallMoveValue(g, p, from, to) {
    if (!to) return -99;
    const w = g.walls.get(from); const base = evaluate(g, p);
    return simulate(g, [{ wallDel: from }, { wallAdd: to, owner: w ? w.owner : p }], () => evaluate(g, p)) - base;
  }
  function wallShiftBest(g, p, key, maxDist) {
    let best = { score: -99, to: null };
    for (const t of g.wallShiftTargets(key, maxDist)) { const v = wallMoveValue(g, p, key, t); if (v > best.score) best = { score: v, to: t }; }
    return best;
  }
  function bestWallShiftAny(g, p, maxDist) {
    let best = 0;
    for (const k of [...g.walls.keys()]) best = Math.max(best, wallShiftBest(g, p, k, maxDist).score);
    return best;
  }
  function bestWallRelocationGain(g, p) {
    const base = evaluate(g, p); let best = 0;
    const keys = [...g.walls.keys()];
    const edges = g.allEdges();
    for (const k of keys) {
      const w = g.walls.get(k);
      g.walls.delete(k);
      for (const e of edges) {
        if (e === k || g.walls.has(e)) continue;
        if (!g.canPlaceWallAt(e, { owner: w.owner, ignoreHalf: true })) continue;
        g.walls.set(e, w);
        const v = evaluate(g, p) - base;
        g.walls.delete(e);
        if (v > best) best = v;
      }
      g.walls.set(k, w);
    }
    return best;
  }

  function pushGain(g, p, fig, dirs) {
    let best = 0;
    for (const [dx, dy] of dirs) {
      const nx = fig.x + dx, ny = fig.y + dy;
      if (!g.inBoard(nx, ny) || g.figAt(nx, ny) || g.blockedStep(fig.x, fig.y, nx, ny)) continue;
      best = Math.max(best, pushScore(g, p, fig, { x: nx, y: ny }));
    }
    return best;
  }
  function pushScore(g, p, fig, q) {
    const base = evaluate(g, p);
    return simulate(g, [{ fig, x: q.x, y: q.y }], () => evaluate(g, p)) - base;
  }
  function positionScore(g, p, fig, q) {
    const e = { x: q.x, y: q.y, capture: !!g.figAt(q.x, q.y), path: [q] };
    const { mods, bonus } = moveMods(g, fig, e);
    const base = evaluate(g, p);
    return simulate(g, mods, () => evaluate(g, p)) + bonus - base;
  }

  function enemyHeroGuess(g, p) {
    const oh = g.knownHeroes(p, 1 - p);
    if (!oh.length) return null;
    const f = distField(g, targetRow(g, 1 - p));
    return oh.slice().sort((a, b) => f[a.y * N + a.x] - f[b.y * N + b.x])[0];
  }
  function onEnemyPathScore(g, p, q, idealAhead = 2) {
    const e = enemyHeroGuess(g, p); if (!e) return 0;
    const fOp = distField(g, targetRow(g, 1 - p));
    const de = reachDist(g, e, q, 12, true);
    if (de >= 99) return -10;
    const onPath = de + fOp[q.y * N + q.x] === fOp[e.y * N + e.x];
    return (onPath ? 10 : 0) - Math.abs(de - idealAhead) * 1.5 - (de === 0 ? 20 : 0);
  }

  function cardScore(g, p, c) {
    const d = g.def(c); const id = c.id; const P = g.P(p); const O = g.P(1 - p);
    const h = g.heroOf(p); const u = urgency(g, p);
    const handOthers = P.hand.filter(x => x !== c);
    const hasOtherPlayable = handOthers.some(x => !g.def(x).types.includes('konter'));
    const enemyH = enemyHeroGuess(g, p);
    switch (id) {
      case 7: return moveCardScore(g, p, { straight: 1 }) + (hasOtherPlayable ? 3 : 0);
      case 27: case 85: return moveCardScore(g, p, { horiz: 2 });
      case 31: case 65: return moveCardScore(g, p, { straight: 1 });
      case 32: case 45: return moveCardScore(g, p, { straight: 2 });
      case 41: return moveCardScore(g, p, { diag: 1 });
      case 79: return moveCardScore(g, p, { diag: 1 }) + (g.wolfOf(p) ? 2 : 0);
      case 75: return moveCardScore(g, p, { straight: 1 }) + (g.wolfOf(p) ? 3 : 0);
      case 69: return moveCardScore(g, p, { straight: 1 });
      case 54: return moveCardScore(g, p, { straight: 2 }) + 2;
      case 30: return moveCardScore(g, p, { straight: 1 }) + (O.hand.length >= 2 ? 5 : 2);
      case 5: return moveCardScore(g, p, { moveAll: true });
      case 11: case 76: return moveCardScore(g, p, { through: true });
      case 10: { const cheap = handOthers.filter(x => cardValue(g, p, x) <= 3).length; return cheap ? moveCardScore(g, p, { straight: 1 + cheap }) - cheap * 1.5 : moveCardScore(g, p, { straight: 1 }); }
      case 21: { const n = g.clonesOf(p).length; return n ? moveCardScore(g, p, { straight: 1 + n }) - 4 * n : moveCardScore(g, p, { straight: 1 }); }
      case 60: return 4 - P.hand.length * 0.4;
      case 50: case 81: return 3.6 - P.hand.length * 0.3;
      case 29: return 3.5;
      case 68: return P.hand.length <= 2 ? 4 : (hasOtherPlayable ? 4.5 : 2);
      case 33: return hasOtherPlayable ? 4 : 0;
      case 37: return handOthers.filter(x => !g.def(x).types.includes('konter')).length >= 1 ? 5 : 0;
      case 18: return handOthers.length >= 2 ? 2.4 : 0;
      case 57: return P.discard.length && handOthers.length ? 3 : 0;
      case 58: return 3;
      case 84: return 3.5;
      case 23: case 100: { const t = g.figsOf(1 - p).filter(f => h && near(f, g.heroOf(p) ? h : f) <= 2); return t.some(f => g.knownHeroes(p, 1 - p).includes(f)) ? 3 + u * 1.2 : 0; }
      case 97: { const ok = h && g.figsOf(1 - p).some(e => g.inLOS(h, e) && g.knownHeroes(p, 1 - p).includes(e)); return ok ? 2 + u * 1.2 : 0; }
      case 24: return h && g.figsOf(1 - p).some(f => near(f, h) <= 2) && O.hand.length ? 3 + u * 0.5 : 0;
      case 94: { const ok = h && g.figsOf(1 - p).some(e => g.inLOS(h, e)); return ok ? 4 + u * 1.6 : 0; }
      case 52: return enemyH ? 2 + u * 0.7 : 0;
      case 8: return h && g.figsOf(1 - p).some(f => near(f, h) <= 2) ? 3 + u * 0.6 : 0;
      case 35: return h && threatOn(g, p, h, 1) ? (P.carrying ? 45 : 25) : 0;
      case 51: return h && threatOn(g, p, h, 1) ? (P.carrying ? 45 : 22) : 0;
      case 38: case 62: case 26: return bestWallRemoval(g, p) * (id === 26 ? 1.5 : 1) - (id === 62 ? 2 : 0);
      case 67: { if (!h) return 0; let b = 0; for (const dd of D4) { const ks = g.wallsOnRay(h, dd); if (!ks.length) continue; b = Math.max(b, ks.reduce((a, k) => a + wallRemovalValue(g, p, k), 0)); } return b; }
      case 48: case 101: return bestWallShiftAny(g, p, id === 101 ? 2 : 1) - (id === 48 ? 2 : 0);
      case 98: return g.level === 'easy' ? 0 : bestWallRelocationGain(g, p) * 1.4 - 2;
      case 49: { let b = 0; for (const f of g.figsOf(1 - p)) b = Math.max(b, pushGain(g, p, f, D4)); return b; }
      case 28: { let b = 0; for (const f of g.figsOf(1 - p)) b += pushGain(g, p, f, D8); return b; }
      case 40: case 53: { if (!h) return 0; let b = 0; for (const f of g.adjacentInLOS(h)) if (f.owner !== p) b = Math.max(b, pushGain(g, p, f, D8)); return b * 1.2; }
      case 39: { if (!h) return 0; let v = 0; for (const f of g.figs.filter(x => x.alive && x !== h && near(x, h) === 1 && !g.isProtected(x))) { if (f.owner !== p) v += f.kind === 'hero' ? 160 : f.kind === 'wolf' ? 25 : (O.heroKnown ? 5 : 40); else v -= f.kind === 'wolf' ? 30 : 10; } return v; }
      case 9: { const cl = g.clonesOf(p); let v = 0; for (const c2 of cl) if (g.figsOf(1 - p).some(e => reachDist(g, c2, e, 2) <= 2 && e.kind === 'hero')) v = 30; return v; }
      case 93: { if (!h) return 0; let b = 0; for (const [dx, dy] of D8) { const q = { x: h.x + 2 * dx, y: h.y + 2 * dy }; if (!g.inBoard(q.x, q.y)) continue; const o = g.figAt(q.x, q.y); if (o && (o.owner === p || !g.canCapture(h, o))) continue; b = Math.max(b, positionScore(g, p, h, q)); } return b - 2; }
      case 64: case 15: case 105: { if (!h) return 0; let b = 0; for (const f of g.figs.filter(x => x.alive && x !== h && near(x, h) <= (id === 15 ? 3 : 2) && (id !== 15 || x.owner === p))) b = Math.max(b, swapScore(g, p, h, f)); return b - (id === 64 ? 3 : 1); }
      case 91: { if (!h || P.carrying) return 0; let b = 0; for (const pt of g.portalsOf(p)) if (!g.figAt(pt.x, pt.y)) b = Math.max(b, positionScore(g, p, h, pt)); return b - 8; }
      case 90: { let b = -99; for (const dd of D8) b = Math.max(b, astralScore(g, p, dd)); return b + 2; }
      case 89: return O.carrying && enemyH && goalDistFrom(g, 1 - p, enemyH) <= 3 ? 30 : (P.carrying ? -50 : 0);
      case 99: return Math.max(rotationScore(g, p, 1), rotationScore(g, p, -1)) - 2;
      case 102: return h ? (goalDistFrom(g, p, h) - distField(g, targetRow(g, p), true)[h.y * N + h.x]) * 4 - 6 : 0;
      case 103: return 0;
      case 104: case 14: case 82: return h && threatOn(g, p, h) ? 4 : 1;
      case 12: return 0;
      case 63: return 4;
      case 92: case 25: return O.hand.length ? 3 : 0;
      case 66: return 9;
      case 86: return 5;
      case 87: return 6;
      case 96: return 1;
      case 55: return g.turn.movedAny ? 2.5 : 0;
      case 59: return 0;
      case 42: case 43: return 2 + Math.min(u, 6) * 0.5;
      case 44: case 36: return 2.5 + (id === 36 && hasOtherPlayable ? 2 : 0);
      case 46: case 47: case 70: case 71: case 72: case 73: case 74: return enemyH ? 3 + (id === 72 || id === 74 ? 1.5 : 0) + Math.min(u, 6) * 0.4 : 0;
      default: return BASE_VALUE[id] ? 1 : 0;
    }
  }

  function swapScore(g, p, a, b) {
    const base = evaluate(g, p);
    return simulate(g, [{ fig: a, x: b.x, y: b.y }, { fig: b, x: a.x, y: a.y }], () => evaluate(g, p)) - base;
  }
  function astralScore(g, p, [dx, dy]) {
    const figs = g.figs.filter(f => f.alive).sort((a, b) => (b.x * dx + b.y * dy) - (a.x * dx + a.y * dy));
    const occ = new Set(figs.map(f => `${f.x},${f.y}`));
    const mods = [];
    for (const f of figs) {
      const nx = f.x + dx, ny = f.y + dy;
      if (!g.inBoard(nx, ny) || occ.has(`${nx},${ny}`)) continue;
      occ.delete(`${f.x},${f.y}`); occ.add(`${nx},${ny}`);
      mods.push({ fig: f, x: nx, y: ny });
    }
    const base = evaluate(g, p);
    return simulate(g, mods, () => evaluate(g, p)) - base;
  }
  function rotationScore(g, p, dir) {
    const rot = dir === 1 ? (x, y) => ({ x: y, y: N - 1 - x }) : (x, y) => ({ x: N - 1 - y, y: x });
    const saved = g.walls; const nw = new Map();
    for (const [k, w] of saved) { const [a, b] = g.edgeSquares(k); const ra = rot(a.x, a.y), rb = rot(b.x, b.y); nw.set(g.edgeKey(ra.x, ra.y, rb.x, rb.y), w); }
    const base = evaluate(g, p);
    g.walls = nw;
    const mods = g.figs.filter(f => f.alive).map(f => { const r = rot(f.x, f.y); return { fig: f, x: r.x, y: r.y }; });
    let v;
    try { v = simulate(g, mods, () => evaluate(g, p)) - base; } finally { g.walls = saved; }
    return v;
  }

  /* ---------------- Konter-Entscheidung ---------------- */
  function counterValue(g, q, entry, ev) {
    const id = entry.card.id; const data = entry.data;
    const hero = g.heroOf(q);
    const O = g.P(1 - q);
    const isEnemyHero = (f) => f && g.knownHeroes(q, 1 - q).includes(f);
    switch (id) {
      case 17: case 77: {
        const ts = data.targets || [];
        let b = 0;
        for (const t of ts) b = Math.max(b, t.kind === 'hero' && O.heroKnown ? 160 + (O.carrying ? 100 : 0) : isEnemyHero(t) ? 70 : t.kind === 'wolf' ? 20 : 4);
        return b - (id === 77 ? 2 : 0);
      }
      case 19: case 83: { const t = data.enemy || (data.targets || [])[0]; return isEnemyHero(t) ? 4 + urgency(g, q) * 1.3 : 1; }
      case 20: return 30;
      case 6: return 6;
      case 13: return hero && threatOn(g, q, hero) ? 14 : 0;
      case 34: return bestWallRelocationGain(g, q);
      case 95: return data.enemy ? pushGain(g, q, data.enemy, D8) + (isEnemyHero(data.enemy) ? 3 : 0) : 0;
      case 80: { const f = (data.mine || [])[0]; return f && f.kind === 'hero' && threatOn(g, q, f) ? 12 : 0; }
      case 106: {
        const start = g.turn.startPos; let prog = 0;
        if (O.carrying && !g.turn.startCarry[1 - q]) prog += 40;
        if (O.points > 0 && g.turn.startCarry[1 - q] && !O.carrying) prog += 80;
        for (const e of g.knownHeroes(q, 1 - q)) { const s = start.get(e.id); if (s) prog += (goalDistFrom(g, 1 - q, s) - goalDistFrom(g, 1 - q, e)) * 4; }
        if (!g.heroOf(q) && g.turn.p !== q) prog += 60;
        return prog;
      }
      case 22: case 16: case 78: {
        const info = ev.info || {};
        const f = ev.fig;
        let v = info.capture ? (f.kind === 'hero' ? 150 : f.kind === 'wolf' ? 20 : 4) : info.skip ? 18 : info.snare ? 7 : info.push ? 4 : info.swap ? 5 : 3;
        if (id === 16 && info.capture && f.kind !== 'hero') v = 2;
        return v;
      }
      case 61: case 88: case 56: {
        const d = ev.def; if (!d) return 0;
        let v = (BASE_VALUE[d.id] || 4);
        if (d.types.includes('ultimate')) v += 4;
        if (ev.isTrap) v += 3;
        if ([17, 77, 39, 89, 94, 20, 106].includes(d.id)) v += 25;
        if (O.carrying) v += 4;
        return v - (id === 61 ? 4 : id === 88 ? 2 : 0);
      }
      default: return 3;
    }
  }
  function counterDecision(g, q, list, ev) {
    const lv = L(g);
    if (Math.random() > lv.counterChance) return null;
    let best = null, bv = -Infinity;
    for (const e of list) { const v = counterValue(g, q, e, ev); if (v > bv) { bv = v; best = e; } }
    if (bv < lv.counterMin) return null;
    return best;
  }

  /* ---------------- Auswahl (für Karteneffekte) ---------------- */
  function pick(g, p, req) {
    const lv = L(g);
    const opts = req.options;
    const score = (o) => {
      let v = 0;
      try { v = req.ai ? req.ai(o) : Math.random(); } catch (e) { v = Math.random(); }
      if (typeof v !== 'number' || isNaN(v)) v = 0;
      return v + (Math.random() - 0.5) * lv.noise * 0.2;
    };
    if (req.kind === 'cards') {
      const sc = opts.map(o => ({ o, v: score(o) })).sort((a, b) => b.v - a.v);
      const min = req.min ?? 1, max = req.max ?? 1;
      const out = [];
      for (const s of sc) {
        if (out.length >= max) break;
        if (out.length >= min && s.v <= 0 && req.min === 0) break;
        out.push(s.o);
      }
      return out;
    }
    let best = null, bv = -Infinity;
    for (const o of opts) {
      if (o && o.disabled) continue;
      const v = score(o);
      if (v > bv) { bv = v; best = o; }
    }
    if (req.optional && req.aiMin !== undefined && bv < req.aiMin) return null;
    if (req.kind === 'option') return best;
    return best;
  }

  /* ---------------- Zug der KI ---------------- */
  async function takeTurn(g, p) {
    const lv = L(g);
    const P = g.P(p);
    await sleep(lv.delay);
    let guard = 0;
    const tried = new Set();
    while (!g.over && !g.turn.endRequested && guard++ < 18) {
      const opts = [];
      // Karten
      const now = g.canPlayCardsNow(p);
      if (now.ok && g.turn.playsUsed < g.turn.plays) {
        for (const c of P.hand) {
          if (tried.has(c.uid)) continue;
          const d = g.def(c); if (d.types.includes('konter')) continue;
          const chk = g.canPlayCard(p, c, { internal: true }); if (!chk.ok) continue;
          let s = 0; try { s = cardScore(g, p, c); } catch (e) { console.error(e); s = 0; }
          // volle Hand: lieber spielen als später abwerfen
          if (P.hand.length >= 4 && s > 0.2) s += 1.6 + (P.hand.length - 4) * 0.8;
          if (Math.random() > lv.cardChance) s = Math.min(s, 0.5);
          s += (Math.random() - 0.5) * lv.noise * 0.3;
          if (s > 1.6) opts.push({ type: 'card', c, s });
        }
      }
      // Heldenfähigkeit
      const hs = g.heroAbilityState(p);
      if (hs.usable) {
        let s = 0;
        if (P.cls === 'knight') {
          const mv = moveCardScore(g, p, { straight: 1 });
          s = mv > 25 ? mv : 0;
        } else if (P.cls === 'ranger') s = (P.hand.length <= 1 || urgency(g, p) > 10) ? 4.5 : 0;
        if (s > 0) opts.push({ type: 'hero', s });
      }
      // Bewegung
      for (const f of g.figsOf(p)) {
        if (!g.hasMovesLeft(f) || g.isSnared(f)) continue;
        const b = bestMoveFor(g, p, f, { deep: true });
        if (b.entry && b.gain > (f.kind === 'hero' ? 0.5 : 1.5)) opts.push({ type: 'move', f, e: b.entry, s: b.gain + (f.kind === 'hero' ? 0.5 : 0) });
      }
      // Wände
      if (g.turn.wallsUsed < g.turn.walls && P.wallsLeft > 0 && Math.random() < lv.wallChance) {
        const w = bestWall(g, p);
        const oh = g.knownHeroes(p, 1 - p);
        const early = oh.length && goalDistFrom(g, 1 - p, oh[0]) > 5 && !g.P(1 - p).carrying;
        const min = lv.wallMin * (early ? 1.6 : 1);
        if (w.key && w.gain >= min) opts.push({ type: 'wall', key: w.key, s: w.gain * 0.9 });
      }
      // Wolfmodus: Wand verschieben
      if (g.turn.wallShifts > g.turn.wallShiftsUsed && g.walls.size) {
        let best = { score: 0, from: null, to: null };
        for (const k of [...g.walls.keys()]) { const b = wallShiftBest(g, p, k, 1); if (b.score > best.score) best = { score: b.score, from: k, to: b.to }; }
        if (best.from && best.score > 5) opts.push({ type: 'shift', from: best.from, to: best.to, s: best.score });
      }
      if (!opts.length) break;
      opts.sort((a, b) => b.s - a.s);
      const o = opts[0];
      if (o.type === 'card') {
        tried.add(o.c.uid);
        await g.playCard(p, o.c, {});
      } else if (o.type === 'hero') {
        await g.useHeroAbility(p);
      } else if (o.type === 'move') {
        await g.moveAlong(o.f, o.e.path);
      } else if (o.type === 'wall') {
        g.placeWall(p, o.key); g.turn.wallsUsed++;
      } else if (o.type === 'shift') {
        g.moveWall(o.from, o.to); g.turn.wallShiftsUsed++; g.turn.walls = 0;
      }
      g.render();
      await sleep(lv.delay);
    }
  }

  /* ---------------- Hilfsbewertungen für Effekte ---------------- */
  const API = {
    LEVELS, evaluate, pick, counterDecision, takeTurn, cardValue, cardScore,
    goalDistFrom, distField,
    trapSquareScore: (g, p, q) => onEnemyPathScore(g, p, q, 2) + Math.random() * 0.5,
    blockScore: (g, p, q) => onEnemyPathScore(g, p, q, 1),
    skyCloudScore: (g, p, q) => { const e = enemyHeroGuess(g, p); if (!e) return 0; return onEnemyPathScore(g, p, q, 2) - near(q, e) * 0.5; },
    bannerScore: (g, p, q) => { const h = g.heroOf(p); return h ? -Math.abs(goalDistFrom(g, p, q) - 3) - near(q, h) * 0.3 + Math.random() : Math.random(); },
    pushScore, positionScore, swapScore, astralScore, rotationScore,
    pushPriority: (g, p, f) => (f.owner !== p ? 5 : -5) + (g.knownHeroes(p, 1 - p).includes(f) ? 5 : 0) + pushGain(g, p, f, D8) * 0.3,
    escapeScore: (g, p, f, q) => { const base = evaluate(g, p); return simulate(g, [{ fig: f, x: q.x, y: q.y }], () => evaluate(g, p)) - base; },
    captureValue: (g, p, f) => (f.kind === 'hero' ? 10 : f.kind === 'wolf' ? 5 : 2) + (g.knownHeroes(p, f.owner).includes(f) ? 4 : 0),
    wallRemovalValue, wallPlaceValue, wallMoveValue, wallShiftBest, bestWallRelocationGain,
    transpositionScore: (g, p, opt) => {
      const figScore = (f) => { const nx = f.x + opt.d[0], ny = f.y + opt.d[1]; return pushScore(g, p, f, { x: nx, y: ny }); };
      const fs = Math.max(...opt.figs.map(figScore));
      return { score: fs, figScore };
    },
    sphereFirst: (g, p, f) => (f.owner === p && f.kind === 'hero' ? 3 : f.owner !== p && g.knownHeroes(p, f.owner).includes(f) ? 2 : 0) + Math.random() * 0.2,
    stolenValue: (g, p, c) => cardScore(g, p, c),
    cloneSquareScore: (g, p, q) => -goalDistFrom(g, p, q) + Math.random(),
    identityScore: (g, p, f) => {
      const lv = g.level;
      if (lv === 'boss' || lv === 'hard') return (threatOn(g, p, f) ? -5 : 0) - goalDistFrom(g, p, f) * 0.5 + Math.random() * 2;
      return Math.random();
    },
    portalScore: (g, p, q, first) => {
      const row = p === 0 ? 4 : 3;
      if (!first) return -Math.abs(q.y - row) * 3 - Math.abs(q.x - 1) + Math.random() * 0.5;
      return Math.abs(q.x - first.x) - (q.y === first.y ? 0 : 50);
    },
    originScore: (g, p, d, f) => (f.kind === 'hero' ? 1 : 0.5) + (d.id === 8 ? g.figsOf(1 - p).filter(e => near(e, f) <= 2).length * 2 : 0),
    reflexDiscard: (g, p, c) => 3.2 - cardValue(g, p, c),
    rebirthScore: (g, p, q) => -goalDistFrom(g, p, q) - (simulate(g, [], () => 0)) + Math.random() * 0.5,
    knightOption: (g, p, v) => v === 'move' ? moveCardScore(g, p, { straight: 1 }) / 5 : v === 'play' ? (g.P(p).hand.length ? 2 : 0) : 1,
    bestWallShiftAny, threatOn, reachDist, enemyHeroGuess
  };
  window.FX_AI = API;
})();

/* =========================================================
   FLAGGED – Kartendatenbank (Season 1) & Karteneffekte (1v1)
   ========================================================= */
(function () {
  const CLASS_INFO = {
    assassin: { name: 'Assassine', alt: 'Assassine', color: '#2cae95', color2: '#0f5248', sigil: 'dagger' },
    knight:   { name: 'Ritter', alt: 'Ritter', color: '#d0893a', color2: '#5a2c0c', sigil: 'helm' },
    ranger:   { name: 'Waldläufer', alt: 'Jäger', color: '#8db33f', color2: '#2f4512', sigil: 'bow' },
    mage:     { name: 'Zauberer', alt: 'Magier', color: '#4f7fe6', color2: '#16245e', sigil: 'staff' },
    neutral:  { name: 'Neutral', alt: 'Neutral', color: '#a3a8b2', color2: '#33363d', sigil: 'eye' }
  };

  const HEROES = {
    assassin: { id: 1, cls: 'assassin', name: 'Assassine',
      text: 'Zu Spielbeginn sowie bei Wiedergeburt: Beschwöre 1 {CLONE} (Schattenklon) angrenzend zu deiner Figur auf der Startlinie.',
      lore: 'Schatten und Täuschung. Niemand weiss, welche Gestalt die wahre ist.' },
    knight: { id: 2, cls: 'knight', name: 'Ritter',
      text: '1 Mal pro Leben: Du kannst in einem deiner Spielzüge eine der folgenden Aktionen zusätzlich ausführen:\n• +1 {PLAY1} (1 Karte spielen)\n• +1 {P1} (1 Karte ziehen)\n• +1 {MOVEMENT_STRAIGHT} (1 Feld in eine gerade Richtung bewegen)',
      lore: 'Stahl, Ehre und unerschütterlicher Wille.' },
    ranger: { id: 3, cls: 'ranger', name: 'Waldläufer',
      text: '1 Mal pro Leben: Du kannst in einem deiner Spielzüge dein Deck nach 1 Karte durchsuchen und sie auf die Hand nehmen. Mische dein Deck anschliessend.',
      lore: 'Fallen, Fernschüsse und ein treuer Wolf.' },
    mage: { id: 4, cls: 'mage', name: 'Zauberer',
      text: 'Zu Spielbeginn: Platziere 2 {PORTALE} auf derselben horizontalen Linie. Betrittst du ein Portal, {TELEPORT} du dich zum anderen Portal. Die Portale können nur von dir und verbündeten Spielern benutzt werden.',
      lore: 'Herr über Raum, Zeit und arkane Ströme.' }
  };

  /* ---------- kleine Hilfsfunktionen für Effekte ---------- */
  const A = () => window.FX_AI;
  const enemyFigs = (g, p) => g.figsOf(1 - p);
  const near = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));

  async function discardCost(g, c, n) {
    if (!n) return true;
    return g.discardFromHand(c.p, n, `Wirf ${n} Karte${n > 1 ? 'n' : ''} ab (Kosten)`);
  }

  async function swapFigs(g, a, b) {
    const ax = a.x, ay = a.y;
    await g.swapPositions(a, b);
    return ax !== a.x || ay !== a.y;
  }

  async function placeTrap(g, c) {
    const sq = g.allSquares().filter(s => g.canTrapAt(s.x, s.y));
    const s = await g.pickSquare(c.p, sq, 'Wähle das Feld für deine verdeckte Falle', {
      ai: q => A().trapSquareScore(g, c.p, q)
    });
    if (!s) return;
    g.addTrap(c.p, c.card, s.x, s.y);
    c.keepCard = true;
  }

  // Figur 1 Schritt in Richtung (8 oder 4) – nur freie Felder, Wände blockieren
  function stepTargets(g, fig, dirs, opts = {}) {
    const out = [];
    for (const [dx, dy] of dirs) {
      const nx = fig.x + dx, ny = fig.y + dy;
      if (!g.inBoard(nx, ny)) continue;
      if (!opts.ignoreWalls && g.blockedStep(fig.x, fig.y, nx, ny)) continue;
      if (g.figAt(nx, ny)) continue;
      if (g.isBlockedFor(fig, nx, ny)) continue;
      out.push({ x: nx, y: ny });
    }
    return out;
  }

  function teleportTargets(g, fig, dirs, dists, allowEnemy = false) {
    const out = [];
    for (const [dx, dy] of dirs) {
      for (const d of dists) {
        const nx = fig.x + dx * d, ny = fig.y + dy * d;
        if (!g.inBoard(nx, ny)) continue;
        const o = g.figAt(nx, ny);
        if (o && !(allowEnemy && o.owner !== fig.owner && g.canCapture(fig, o))) continue;
        if (g.isBlockedFor(fig, nx, ny)) continue;
        out.push({ x: nx, y: ny });
      }
    }
    return out;
  }

  const D4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const D8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
  const DIR_OPTS = [{ label: '↑ Nach oben', d: [0, 1] }, { label: '↓ Nach unten', d: [0, -1] }, { label: '← Nach links', d: [-1, 0] }, { label: '→ Nach rechts', d: [1, 0] }];

  async function pushEnemy(g, c, fig, dirs, prompt) {
    const t = await g.affect(c.p, fig, { push: true, label: c.def.name });
    if (!t) return;
    const opts = stepTargets(g, t, dirs);
    if (!opts.length) { g.log(`${g.figName(t)} kann nicht bewegt werden.`); return; }
    const s = await g.pickSquare(c.p, opts, prompt || `Wohin wird ${g.figName(t)} bewegt?`, {
      ai: q => A().pushScore(g, c.p, t, q)
    });
    if (s) await g.forcedMove(t, s.x, s.y, { by: c.p });
  }

  async function snareFigs(g, c, figs, mode) {
    for (const f of figs) {
      const t = await g.affect(c.p, f, { snare: true, label: c.def.name });
      if (t) g.snare(t, mode);
    }
  }

  async function relocateWall(g, c, prompt) {
    const keys = [...g.walls.keys()];
    if (!keys.length) return false;
    const k = await g.pickWall(c.p, keys, prompt || 'Wähle eine Wand zum Versetzen', {
      ai: key => A().wallRemovalValue(g, c.p, key)
    });
    if (!k) return false;
    const w = g.walls.get(k);
    g.walls.delete(k);
    const cands = g.allEdges().filter(e => e !== k && g.canPlaceWallAt(e, { owner: w.owner, ignoreHalf: true }));
    const e = await g.pickEdge(c.p, cands, 'Wähle den neuen Platz der Wand', {
      ai: key => A().wallPlaceValue(g, c.p, key)
    });
    g.walls.set(e || k, w);
    g.log(`Eine Wand wurde versetzt.`);
    g.fx('wall', { key: e || k });
    return true;
  }

  async function shiftWall(g, c, maxDist, prompt) {
    const keys = [...g.walls.keys()].filter(k => g.wallShiftTargets(k, maxDist).length);
    if (!keys.length) { g.log('Keine Wand kann verschoben werden.'); return; }
    const k = await g.pickWall(c.p, keys, prompt || 'Wähle eine Wand zum Verschieben', {
      ai: key => A().wallShiftBest(g, c.p, key, maxDist).score
    });
    if (!k) return;
    const targets = g.wallShiftTargets(k, maxDist);
    const e = await g.pickEdge(c.p, targets, 'Wähle die neue Position der Wand', {
      ai: key => A().wallMoveValue(g, c.p, k, key)
    });
    if (!e) return;
    g.moveWall(k, e);
  }

  async function destroyWalls(g, c, max, optionalAfterFirst = true) {
    for (let i = 0; i < max; i++) {
      const keys = [...g.walls.keys()];
      if (!keys.length) break;
      const k = await g.pickWall(c.p, keys, `Wähle eine Wand zum Zerstören (${i + 1}/${max})`, {
        optional: i > 0 && optionalAfterFirst,
        ai: key => A().wallRemovalValue(g, c.p, key),
        aiMin: i > 0 ? 0.5 : -Infinity
      });
      if (!k) break;
      g.destroyWall(k);
    }
  }

  async function bannerAt(g, c) {
    const sq = g.allSquares().filter(s => !g.bannerAt(s.x, s.y));
    const s = await g.pickSquare(c.p, sq, 'Wähle das Feld für dein Banner', {
      ai: q => A().bannerScore(g, c.p, q)
    });
    if (s) g.addBanner(c.p, s.x, s.y);
  }

  async function summonCloneNear(g, c, n, tag, extra = {}) {
    await g.summonClones(c.p, n, c.origin || g.heroOf(c.p), tag, extra);
  }

  /* ---------- Trigger-Prüfer ---------- */
  const T = {
    // gegnerische Figur betritt Feld angrenzend zu einer meiner Figuren
    enemyEntersAdjacent: (g, p, ev, moveOnly) => {
      if (ev.type !== 'enter' || ev.silent) return null;
      if (moveOnly && !ev.isMove) return null;
      if (ev.fig.owner === p) return null;
      const mine = g.figsOf(p).filter(f => f.kind !== 'wolf' && near(f, ev.fig) === 1);
      return mine.length ? { enemy: ev.fig, mine } : null;
    }
  };

  /* ---------- Kartenliste ---------- */
  const C = [];
  const def = (o) => { C.push(o); return o; };

  // ---------------- ASSASSINE ----------------
  def({ id: 5, name: 'Dämmertritt', cls: 'assassin', types: ['klasse'], art: 'MOVEMENT_ALL',
    text: 'In diesem Zug kannst du alle deine Bewegungen als {MOVEMENT_ALL} ausführen.',
    play: async (g, c) => { g.turn.moveAll = true; } });
  def({ id: 6, name: 'Echobruch', cls: 'assassin', types: ['klasse', 'konter'], art: 'MOVE',
    text: 'In deinem nächsten Zug erhältst du +2 {MOVEMENT_STRAIGHT}.',
    trigger: 'Nach einer {MOVE}: Eine gegnerische Figur bewegt sich in ihrem Zug um mehr als 2.',
    counter: { on: 'enter', test: (g, p, ev) => (ev.type === 'enter' && ev.isMove && !ev.silent && ev.fig.owner !== p && g.cur === ev.fig.owner && g.turn.steps[ev.fig.id] === 3) ? {} : null },
    play: async (g, c) => { g.addNext(c.p, 'straight', 2); } });
  def({ id: 7, name: 'Flüsterschritt', cls: 'assassin', types: ['klasse'], art: 'MOVEMENT_STRAIGHT',
    text: '+1 {MOVEMENT_STRAIGHT} und +1 {PLAY1}.',
    play: async (g, c) => { g.addPool(c.p, 'hero', 'straight', 1); g.addPlays(1); } });
  def({ id: 8, name: 'Rauchbombe', cls: 'assassin', types: ['klasse'], art: 'cloud', needsOrigin: true,
    text: 'Platziere eine Rauchwolke mit {UMFANG} 2 auf deiner Position. Gegnerische Spieler mit einer Figur in der Wolke erhalten {DONT_PLAY}. Ihre Figuren können die Wolke nicht verlassen. Sie verschwindet zu Beginn deines nächsten Zuges.',
    play: async (g, c) => { g.addCloud(c.p, 'smoke', c.origin.x, c.origin.y, 2); } });
  def({ id: 9, name: 'Schattenmanifest', cls: 'assassin', types: ['ultimate'], art: 'CLONES',
    text: 'Deine {CLONES} dürfen in diesem Zug Gegner schnappen und Karten spielen, die ein Schattenklon normalerweise nicht spielen dürfte.',
    play: async (g, c) => { g.turn.clonesEmpowered = c.p; } });
  def({ id: 10, name: 'Schattenreflexe', cls: 'assassin', types: ['ultimate'], art: 'MOVEMENT_STRAIGHT', cost: { discard: 'X' },
    text: '{MX}: +1 {MOVEMENT_STRAIGHT} und für jede durch Schattenreflexe abgeworfene Karte zusätzlich +1 {MOVEMENT_STRAIGHT}.',
    play: async (g, c) => { g.addPool(c.p, 'hero', 'straight', 1 + (c.paidX || 0)); } });
  def({ id: 11, name: 'Schattenriss', cls: 'assassin', types: ['klasse'], art: 'ALL_WALLS',
    text: 'Du kannst dich diesen Zug durch {ALL_WALLS} bewegen.',
    play: async (g, c) => { g.turn.throughWalls = true; } });
  def({ id: 12, name: 'Schattenwechsel', cls: 'assassin', types: ['ultimate'], art: 'CLONES', noFlag: true, endTurn: true,
    info: 'Nicht spielbar, während du die Flagge trägst.', penalty: 'Beende deinen Zug sofort.',
    text: 'Enthülle deine Heldenfigur. Bestimme neu, welche deiner Figuren die Heldenfigur ist.',
    can: (g, c) => g.figsOf(c.p).some(f => f.kind === 'clone') || 'Du hast keinen Schattenklon.',
    play: async (g, c) => { g.revealHero(c.p, 'Schattenwechsel'); await g.chooseHeroIdentity(c.p); } });
  def({ id: 13, name: 'Schleierflucht', cls: 'assassin', types: ['konter', 'ultimate'], art: 'TELEPORT_ALL', noFlag: true, cost: { discard: 1 },
    info: 'Nicht spielbar, während du die Flagge trägst.',
    text: '{M1}: {TELEPORT_ALL} um 1 (du kannst dadurch keine Figuren schnappen). Entferne deine {CLONES} und beschwöre 1 {CLONE}.',
    trigger: 'Nach einer {MOVE}: Ein Gegner betritt ein angrenzendes Feld zu deiner Figur.',
    counter: { on: 'enter', test: (g, p, ev) => T.enemyEntersAdjacent(g, p, ev, true) },
    play: async (g, c) => {
      const mine = (c.trig && c.trig.mine || []).filter(f => f.alive);
      let f = mine[0];
      if (mine.length > 1) f = await g.pickFigure(c.p, mine, 'Welche Figur teleportiert?', { ai: x => x.kind === 'hero' ? 2 : 1 });
      if (f) {
        const t = teleportTargets(g, f, D8, [1]);
        if (t.length) {
          const s = await g.pickSquare(c.p, t, 'Teleportiere um 1 Feld', { ai: q => A().escapeScore(g, c.p, f, q) });
          if (s) await g.teleport(f, s.x, s.y, { noCapture: true });
        }
      }
      g.removeClones(c.p);
      await summonCloneNear(g, c, 1, 'shadow');
    } });
  def({ id: 14, name: 'Schleierhülle', cls: 'assassin', types: ['klasse'], art: 'CLONE', noFlag: true, cost: { discard: 1 },
    info: 'Nicht spielbar, während du die Flagge trägst.',
    text: '{M1}: Entferne deine Klone und beschwöre 1 {CLONE}.',
    play: async (g, c) => { g.removeClones(c.p); await summonCloneNear(g, { ...c, origin: g.heroOf(c.p) }, 1, 'shadow'); } });
  def({ id: 15, name: 'Seelentausch', cls: 'assassin', types: ['klasse'], art: 'TELEPORT', replaces: 64, needsOrigin: true,
    info: 'Ersetzt die Karte Tauschkristall (Nr. 64) in deinem Deck.',
    text: 'Tausche die Position durch {TELEPORT} mit einer verbündeten Figur in {UMFANG} 3.',
    can: (g, c) => g.figsOf(c.p).some(f => f !== c.origin && near(f, c.origin) <= 3) || 'Keine verbündete Figur im Umkreis 3.',
    play: async (g, c) => {
      const cand = g.figsOf(c.p).filter(f => f !== c.origin && near(f, c.origin) <= 3);
      const f = await g.pickFigure(c.p, cand, 'Mit welcher Figur tauschen?', { ai: x => A().swapScore(g, c.p, c.origin, x) });
      if (f) await swapFigs(g, c.origin, f);
    } });
  def({ id: 16, name: 'Spiegeltausch', cls: 'assassin', types: ['klasse', 'konter'], art: 'TELEPORT',
    text: 'Tausche die Position durch {TELEPORT} mit einer verbündeten Figur in {UMFANG} 3. Die andere Figur wird nun das neue Ziel des Karteneffekts.',
    trigger: 'Eine deiner Figuren wird von einem gegnerischen Karteneffekt betroffen.',
    counter: { on: 'affect', test: (g, p, ev) => (ev.fig.owner === p && ev.src !== p && g.figsOf(p).some(f => f !== ev.fig && near(f, ev.fig) <= 3)) ? {} : null },
    play: async (g, c) => {
      const ev = c.trig.ev;
      const cand = g.figsOf(c.p).filter(f => f !== ev.fig && near(f, ev.fig) <= 3);
      const f = await g.pickFigure(c.p, cand, 'Mit welcher Figur tauschen?', { ai: x => x.kind === 'hero' ? -5 : 3 });
      if (!f) return;
      await g.swapPositions(ev.fig, f);
      ev.result.redirect = f;
    } });
  def({ id: 17, name: 'Todesstoss', cls: 'assassin', types: ['klasse', 'konter'], art: 'dagger', noClone: true,
    info: 'Kann nicht von einem Schattenklon aus gespielt werden.',
    text: 'Die gegnerische Figur wird sofort geschnappt.',
    trigger: 'In deinem Zug – nach einer {MOVE}: Eine gegnerische Figur steht angrenzend zu deiner Figur.',
    counter: { on: 'enter', test: (g, p, ev) => {
      if (ev.type !== 'enter' || !ev.isMove || ev.silent || g.cur !== p) return null;
      const capable = g.figsOf(p).filter(f => f.kind === 'hero' || (f.kind === 'clone' && g.turn.clonesEmpowered === p));
      const targets = enemyFigs(g, p).filter(e => !g.isProtected(e) && capable.some(f => near(f, e) === 1));
      return targets.length ? { targets, capable } : null;
    } },
    play: async (g, c) => {
      const targets = c.trig.targets.filter(t => t.alive);
      const e = targets.length > 1 ? await g.pickFigure(c.p, targets, 'Welche Figur wird geschnappt?', { ai: x => A().captureValue(g, c.p, x) }) : targets[0];
      if (!e) return;
      const t = await g.affect(c.p, e, { capture: true, label: 'Todesstoss' });
      if (t) await g.capture(t, c.p, 'Todesstoss');
    } });
  def({ id: 18, name: 'Tödliche Ruhe', cls: 'assassin', types: ['klasse'], art: 'PLAY1', cost: { discard: 1 },
    text: '{M1}: In deinem nächsten Zug erhältst du +1 {PLAY1}.',
    play: async (g, c) => { g.addNext(c.p, 'plays', 1); } });
  def({ id: 19, name: 'Toxinstoss', cls: 'assassin', types: ['klasse', 'konter'], art: 'SNARED',
    text: 'Die gegnerische Figur erhält bis zum Anfang ihres nächsten Zuges {SNARED}. Du erhältst in deinem nächsten Zug {DONT_PLAY}.',
    trigger: 'Eine gegnerische Figur betritt ein angrenzendes Feld zu deiner Figur.',
    counter: { on: 'enter', test: (g, p, ev) => T.enemyEntersAdjacent(g, p, ev, false) },
    play: async (g, c) => {
      const t = await g.affect(c.p, c.trig.enemy, { snare: true, label: 'Toxinstoss' });
      if (t) g.snare(t, 'untilNextStart');
      g.addNext(c.p, 'dontplay', 1);
    } });
  def({ id: 20, name: 'Umbrafaden', cls: 'assassin', types: ['ultimate', 'konter'], art: 'hourglass',
    info: 'Im Teammodus nicht erlaubt.',
    text: 'Der Besitzer der gegnerischen Figur zwischen deinen beiden Figuren setzt seine nächsten 2 Züge aus.',
    trigger: 'Nach einer {MOVE}: Eine gegnerische Figur steht auf derselben geraden Linie zwischen zwei deiner Figuren.',
    counter: { on: 'enter', test: (g, p, ev) => {
      if (ev.type !== 'enter' || !ev.isMove || ev.silent) return null;
      const between = g.enemiesBetween(p);
      return between.length ? { targets: between } : null;
    } },
    play: async (g, c) => {
      const ts = c.trig.targets.filter(f => f.alive);
      const e = ts.length > 1 ? await g.pickFigure(c.p, ts, 'Welche Figur?', { ai: x => x.kind === 'hero' ? 2 : 1 }) : ts[0];
      if (!e) return;
      const t = await g.affect(c.p, e, { skip: true, label: 'Umbrafaden' });
      if (t) g.skipTurns(t.owner, 2);
    } });
  def({ id: 21, name: 'Schattenverzehr', cls: 'assassin', types: ['klasse'], art: 'CLONES',
    text: 'Entferne deine {CLONES}. +1 {MOVEMENT_STRAIGHT} und für jeden durch Schattenverzehr entfernten {CLONE} zusätzlich +1 {MOVEMENT_STRAIGHT}.',
    play: async (g, c) => { const n = g.removeClones(c.p); g.addPool(c.p, 'hero', 'straight', 1 + n); } });

  // ---------------- RITTER ----------------
  def({ id: 22, name: 'Ätherdeflektion', cls: 'knight', types: ['ultimate', 'konter'], art: 'shield',
    text: 'Wähle eine beliebige Figur. Die gewählte Figur wird stattdessen vom Effekt betroffen.',
    trigger: 'Eine deiner Figuren wird von einem gegnerischen Karteneffekt betroffen.',
    counter: { on: 'affect', test: (g, p, ev) => (ev.fig.owner === p && ev.src !== p) ? {} : null },
    play: async (g, c) => {
      const ev = c.trig.ev;
      const f = await g.pickFigure(c.p, g.figs.filter(x => x.alive), 'Welche Figur wird stattdessen betroffen?', {
        ai: x => (x.owner !== c.p ? 5 : -5) + (x.kind === 'hero' ? 3 : 0) - (x === ev.fig ? 20 : 0)
      });
      if (f) ev.result.redirect = f;
    } });
  def({ id: 23, name: 'Donnerbrüller', cls: 'knight', types: ['klasse'], art: 'SNARED', needsOrigin: true,
    text: 'Gegnerische Figuren in {UMFANG} 2 erhalten in ihrem nächsten Zug {SNARED}.',
    play: async (g, c) => { await snareFigs(g, c, enemyFigs(g, c.p).filter(f => near(f, c.origin) <= 2), 'next'); } });
  def({ id: 24, name: 'Eisenruf', cls: 'knight', types: ['klasse'], art: 'DONT_PLAY', needsOrigin: true,
    text: 'Gegnerische Spieler mit Figuren in {UMFANG} 2 um deine Figur erhalten in ihrem nächsten Zug {DONT_PLAY}.',
    play: async (g, c) => {
      if (enemyFigs(g, c.p).some(f => near(f, c.origin) <= 2)) g.addNext(1 - c.p, 'dontplay', 1);
      else g.log('Keine gegnerische Figur im Umkreis.');
    } });
  def({ id: 25, name: 'Entwaffnungsgriff', cls: 'knight', types: ['klasse'], art: 'hand',
    text: 'Sieh dir bis zu 2 beliebige Handkarten eines Gegners an. Wähle anschliessend 1 dieser beiden Karten. Der Gegner muss die gewählte Karte ablegen.',
    play: async (g, c) => {
      const o = g.P(1 - c.p); if (!o.hand.length) { g.log('Der Gegner hat keine Handkarten.'); return; }
      const seen = g.randomHandCards(1 - c.p, 2);
      const pick = await g.pickCards(c.p, seen, 'Welche Karte muss der Gegner ablegen?', { min: 1, max: 1, ai: x => A().cardValue(g, 1 - c.p, x) });
      if (pick && pick[0]) g.discardSpecific(1 - c.p, pick[0], 'Entwaffnungsgriff');
    } });
  def({ id: 26, name: 'Festungsbrecher', cls: 'knight', types: ['ultimate'], art: 'WALL4',
    text: 'Zerstöre bis zu {WALL4} deiner Wahl.',
    can: (g) => g.walls.size > 0 || 'Keine Wände auf dem Feld.',
    play: async (g, c) => { await destroyWalls(g, c, 4); } });
  def({ id: 27, name: 'Flankenstoss', cls: 'knight', types: ['klasse'], art: 'MOVEMENT_HORIZONTAL',
    text: '+2 {MOVEMENT_HORIZONTAL}.',
    play: async (g, c) => { g.addPool(c.p, 'hero', 'horiz', 2); } });
  def({ id: 28, name: 'Herausforderung', cls: 'knight', types: ['klasse'], art: 'MOVEMENT_ALL', replaces: 49,
    info: 'Ersetzt die Karte Flüstergift (Nr. 49) in deinem Deck.',
    text: '{MOVEMENT_ALL} Bis zu 2 feindliche Figuren um 1.',
    play: async (g, c) => {
      const done = new Set();
      for (let i = 0; i < 2; i++) {
        const cand = enemyFigs(g, c.p).filter(f => !done.has(f.id) && stepTargets(g, f, D8).length);
        if (!cand.length) break;
        const f = await g.pickFigure(c.p, cand, `Wähle eine feindliche Figur (${i + 1}/2)`, { optional: i > 0, ai: x => A().pushPriority(g, c.p, x) });
        if (!f) break;
        done.add(f.id);
        await pushEnemy(g, c, f, D8);
      }
    } });
  def({ id: 29, name: 'Kampfvorbereitung', cls: 'knight', types: ['klasse'], art: 'P1',
    text: '{P1}: Du erhältst in deinem nächsten Zug +1 {PLAY1}.',
    play: async (g, c) => { await g.draw(c.p, 1); g.addNext(c.p, 'plays', 1); } });
  def({ id: 30, name: 'Königszug', cls: 'knight', types: ['ultimate'], art: 'helm', antikonter: true,
    text: '{ANTIKONTER}: +1 {MOVEMENT_STRAIGHT}. Gegner erhalten in ihrem nächsten Zug {DONT_PLAY}.',
    play: async (g, c) => { g.addPool(c.p, 'hero', 'straight', 1); g.addNext(1 - c.p, 'dontplay', 1); } });
  def({ id: 31, name: 'Letzter Stand', cls: 'knight', types: ['klasse'], art: 'ANTIKONTER', antikonter: true, max: 2,
    info: 'Diese Karte darf höchstens 2-mal in deinem Deck enthalten sein. Im Teammodus ist diese Karte nicht erlaubt.',
    text: '{ANTIKONTER}: +1 {MOVEMENT_STRAIGHT}.',
    play: async (g, c) => { g.addPool(c.p, 'hero', 'straight', 1); } });
  def({ id: 32, name: 'Ritterschritt', cls: 'knight', types: ['klasse'], art: 'MOVEMENT_STRAIGHT',
    text: '+2 {MOVEMENT_STRAIGHT}.',
    play: async (g, c) => { g.addPool(c.p, 'hero', 'straight', 2); } });
  def({ id: 33, name: 'Runenbann', cls: 'knight', types: ['klasse'], art: 'ANTIKONTER', antikonter: true, max: 2, replaces: 59,
    info: 'Ersetzt die Karte Schleierphiole (Nr. 59) in deinem Deck. Diese Karte darf höchstens 2-mal in deinem Deck enthalten sein.',
    text: '{ANTIKONTER}: +1 {PLAY1}.',
    play: async (g, c) => { g.addPlays(1); } });
  def({ id: 34, name: 'Schildkonter', cls: 'knight', types: ['klasse', 'konter'], art: 'WALL1',
    text: 'Repositioniere 1 {WALL1} auf dem Spielfeld an eine beliebige Stelle.',
    trigger: 'Ein Gegner betritt ein angrenzendes Feld zu deiner Figur.',
    counter: { on: 'enter', test: (g, p, ev) => g.walls.size ? T.enemyEntersAdjacent(g, p, ev, false) : null },
    play: async (g, c) => { await relocateWall(g, c); } });
  def({ id: 35, name: 'Schildwall', cls: 'knight', types: ['klasse'], art: 'shield',
    text: 'Nur spielbar vor {MOVE}. In diesem Zug kann jede deiner Figuren max. 2 {MOVEMENT_STRAIGHT}. Bis zu Beginn deines nächsten Zuges können deine Figuren nicht geschnappt werden.',
    can: (g, c) => (!g.turn.movedAny) || 'Nur vor deiner ersten Bewegung spielbar.',
    play: async (g, c) => { g.turn.capPerFig = 2; g.protect(c.p); } });
  def({ id: 36, name: 'Schlachtbanner', cls: 'knight', types: ['klasse'], art: 'banner', replaces: 44,
    info: 'Ersetzt die Karte Ehrenbanner (Nr. 44) in deinem Deck.',
    text: '{P1}: Platziere 1 Banner auf einem Feld. Es kann nicht mehr Ziel von {WALLS} und {TRAP} werden. Fallen darauf werden zerstört. +1 {PLAY1}.',
    play: async (g, c) => { await g.draw(c.p, 1); await bannerAt(g, c); g.addPlays(1); } });
  def({ id: 37, name: 'Klang des singenden Schwertes', cls: 'knight', types: ['ultimate'], art: 'sword',
    text: '+2 {PLAY2}',
    play: async (g, c) => { g.addPlays(2); } });
  def({ id: 38, name: 'Wandbrecher', cls: 'knight', types: ['klasse'], art: 'WALL1',
    text: 'Zerstöre {WALL1} deiner Wahl.',
    can: (g) => g.walls.size > 0 || 'Keine Wände auf dem Feld.',
    play: async (g, c) => { await destroyWalls(g, c, 1, false); } });
  def({ id: 39, name: 'Wirbelklinge', cls: 'knight', types: ['ultimate'], art: 'sword', noClone: true, heroOrigin: true,
    info: 'Kann nicht von einem Schattenklon aus gespielt werden.',
    text: 'Alle Figuren (inkl. verbündete) in {UMFANG} 1 um deine Heldenfigur werden geschnappt – auch durch {WALLS}.',
    can: (g, c) => !!g.heroOf(c.p) || 'Deine Heldenfigur ist nicht im Spiel.',
    play: async (g, c) => {
      const h = g.heroOf(c.p); g.revealHero(c.p);
      const victims = g.figs.filter(f => f.alive && f !== h && near(f, h) === 1);
      for (const v of victims) {
        if (!v.alive) continue;
        if (v.owner !== c.p) { const t = await g.affect(c.p, v, { capture: true, label: 'Wirbelklinge' }); if (t && t.alive) await g.capture(t, c.p, 'Wirbelklinge'); }
        else await g.capture(v, c.p, 'Wirbelklinge');
      }
    } });
  def({ id: 40, name: 'Katapultgriff', cls: 'knight', types: ['klasse'], art: 'TELEPORT_STRAIGHT', replaces: 53, needsOrigin: true,
    info: 'Ersetzt die Karte Wirbelwurf (Nr. 53) in deinem Deck.',
    text: 'Wähle eine angrenzende Figur in {LOS}: {TELEPORT_STRAIGHT} sie um bis zu 2 in eine Richtung.',
    can: (g, c) => g.adjacentInLOS(c.origin).length > 0 || 'Keine angrenzende Figur in Sichtlinie.',
    play: async (g, c) => {
      const cand = g.adjacentInLOS(c.origin);
      let f = await g.pickFigure(c.p, cand, 'Wähle die Figur', { ai: x => A().pushPriority(g, c.p, x) });
      if (!f) return;
      if (f.owner !== c.p) { f = await g.affect(c.p, f, { push: true, label: 'Katapultgriff' }); if (!f) return; }
      const t = teleportTargets(g, f, D4, [1, 2]);
      if (!t.length) return;
      const s = await g.pickSquare(c.p, t, 'Wohin teleportieren?', { ai: q => A().pushScore(g, c.p, f, q) });
      if (s) await g.teleport(f, s.x, s.y, { noCapture: true });
    } });

  // ---------------- NEUTRAL ----------------
  def({ id: 41, name: 'Ausweichrolle', cls: 'neutral', types: ['standard'], art: 'MOVEMENT_DIAGONAL',
    text: '+1 {MOVEMENT_DIAGONAL}.', play: async (g, c) => { g.addPool(c.p, 'hero', 'diag', 1); } });
  def({ id: 42, name: 'Bannkreis', cls: 'neutral', types: ['standard'], art: 'rune',
    text: '{P1}: Wähle 1 Feld. Gegner können es bis zu deinem nächsten Zug nicht betreten.',
    play: async (g, c) => {
      await g.draw(c.p, 1);
      const s = await g.pickSquare(c.p, g.allSquares().filter(q => !g.figAt(q.x, q.y)), 'Wähle das gebannte Feld', { ai: q => A().blockScore(g, c.p, q) });
      if (s) g.addBlock(c.p, [s]);
    } });
  def({ id: 43, name: 'Blockstellung', cls: 'neutral', types: ['standard'], art: 'rune', needsOrigin: true,
    text: '{P1}: Wähle 2 angrenzende Felder. Gegner können diese Felder bis zu deinem nächsten Zug nicht betreten.',
    play: async (g, c) => {
      await g.draw(c.p, 1);
      const chosen = [];
      for (let i = 0; i < 2; i++) {
        const cand = D8.map(([dx, dy]) => ({ x: c.origin.x + dx, y: c.origin.y + dy }))
          .filter(q => g.inBoard(q.x, q.y) && !g.figAt(q.x, q.y) && !chosen.some(z => z.x === q.x && z.y === q.y));
        if (!cand.length) break;
        const s = await g.pickSquare(c.p, cand, `Wähle angrenzendes Feld (${i + 1}/2)`, { ai: q => A().blockScore(g, c.p, q) });
        if (s) chosen.push(s);
      }
      if (chosen.length) g.addBlock(c.p, chosen);
    } });
  def({ id: 44, name: 'Ehrenbanner', cls: 'neutral', types: ['standard'], art: 'banner',
    text: '{P1}: Platziere 1 Banner auf einem Feld. Es kann nicht mehr Ziel von {WALLS} und {TRAP} werden. Fallen darauf werden zerstört.',
    play: async (g, c) => { await g.draw(c.p, 1); await bannerAt(g, c); } });
  def({ id: 45, name: 'Elixier der Geschwindigkeit', cls: 'neutral', types: ['standard'], art: 'crystal',
    text: '+2 {MOVEMENT_STRAIGHT}.', play: async (g, c) => { g.addPool(c.p, 'hero', 'straight', 2); } });
  const TRAPINFO = 'Du kannst maximal 5 Fallen in deinem Deck besitzen. Diese Karte darf höchstens 1-mal in deinem Deck enthalten sein.';
  def({ id: 46, name: 'Auge des Raben', cls: 'neutral', types: ['standard', 'trap'], art: 'eye', max: 1, info: TRAPINFO,
    text: 'Lege diese {TRAP}: Betritt eine gegnerische Figur das Feld, muss dessen Besitzer dir seine Handkarten zeigen.',
    play: placeTrap,
    trap: async (g, tr, fig) => { await g.revealHandTo(tr.owner, fig.owner); } });
  def({ id: 47, name: 'Fangeisen', cls: 'neutral', types: ['standard', 'trap'], art: 'TRAP', max: 1, info: TRAPINFO,
    text: 'Lege diese {TRAP}: Betritt eine gegnerische Figur das Feld, erhält sie in diesem Zug {SNARED} und dessen Besitzer -{M1}.',
    play: placeTrap,
    trap: async (g, tr, fig) => {
      const t = await g.affect(tr.owner, fig, { snare: true, label: 'Fangeisen' });
      if (t) g.snare(t, 'this');
      await g.discardFromHand(fig.owner, 1, 'Fangeisen: Wirf 1 Karte ab', true);
    } });
  def({ id: 48, name: 'Felsverschiebung', cls: 'neutral', types: ['standard'], art: 'MOVE_STRAIGHT', max: 2, cost: { discard: 1 },
    info: 'Diese Karte darf höchstens 2-mal in deinem Deck enthalten sein.',
    text: '{M1}: Verschiebe {WALL1} um 1 Feld.',
    can: (g) => g.walls.size > 0 || 'Keine Wände auf dem Feld.',
    play: async (g, c) => { await shiftWall(g, c, 1); } });
  def({ id: 49, name: 'Flüstergift', cls: 'neutral', types: ['standard'], art: 'MOVEMENT_STRAIGHT',
    text: 'Bewege 1 feindliche Figur um 1 {MOVEMENT_STRAIGHT}.',
    can: (g, c) => enemyFigs(g, c.p).some(f => stepTargets(g, f, D4).length) || 'Keine feindliche Figur kann bewegt werden.',
    play: async (g, c) => {
      const cand = enemyFigs(g, c.p).filter(f => stepTargets(g, f, D4).length);
      const f = await g.pickFigure(c.p, cand, 'Wähle eine feindliche Figur', { ai: x => A().pushPriority(g, c.p, x) });
      if (f) await pushEnemy(g, c, f, D4);
    } });
  def({ id: 50, name: 'Gedankenentfaltung', cls: 'neutral', types: ['standard'], art: 'P3', max: 2,
    info: 'Diese Karte darf höchstens 2-mal in deinem Deck enthalten sein.',
    text: '{P3}, dann -{M2}.',
    play: async (g, c) => { await g.draw(c.p, 3, true); await g.discardFromHand(c.p, 2, 'Gedankenentfaltung: Wirf 2 Karten ab'); await g.enforceHandLimit(c.p); } });
  def({ id: 51, name: 'Gorgonen-Trank', cls: 'neutral', types: ['standard'], art: 'crystal', max: 2,
    info: 'Diese Karte darf höchstens 2-mal in deinem Deck enthalten sein.',
    text: 'Bis zu deinem nächsten Zug können deine Figuren nicht geschnappt werden.',
    play: async (g, c) => { g.protect(c.p); } });
  def({ id: 52, name: 'Himmelsbruch', cls: 'neutral', types: ['standard'], art: 'cloud', max: 2,
    info: 'Diese Karte darf höchstens 2-mal in deinem Deck enthalten sein.',
    text: 'Platziere eine Wolke mit {UMFANG} 1 auf ein beliebiges Feld. Sie verschwindet zu Beginn deines nächsten Zuges. Befindet sich in diesem Moment eine gegnerische Figur darin, setzt dessen Besitzer seinen nächsten Zug aus.',
    play: async (g, c) => {
      const s = await g.pickSquare(c.p, g.allSquares(), 'Wähle das Zentrum der Wolke', { ai: q => A().skyCloudScore(g, c.p, q) });
      if (s) g.addCloud(c.p, 'sky', s.x, s.y, 1);
    } });
  def({ id: 53, name: 'Wirbelwurf', cls: 'neutral', types: ['standard'], art: 'TELEPORT_ALL', needsOrigin: true,
    text: 'Wähle eine angrenzende Figur in {LOS}: {TELEPORT_ALL} sie um 1.',
    can: (g, c) => g.adjacentInLOS(c.origin).length > 0 || 'Keine angrenzende Figur in Sichtlinie.',
    play: async (g, c) => {
      let f = await g.pickFigure(c.p, g.adjacentInLOS(c.origin), 'Wähle die Figur', { ai: x => A().pushPriority(g, c.p, x) });
      if (!f) return;
      if (f.owner !== c.p) { f = await g.affect(c.p, f, { push: true, label: 'Wirbelwurf' }); if (!f) return; }
      const t = teleportTargets(g, f, D8, [1]);
      const s = t.length ? await g.pickSquare(c.p, t, 'Wohin teleportieren?', { ai: q => A().pushScore(g, c.p, f, q) }) : null;
      if (s) await g.teleport(f, s.x, s.y, { noCapture: true });
    } });
  def({ id: 54, name: 'Eilsamensaat', cls: 'neutral', types: ['ultimate'], art: 'BEGLEITER',
    text: '{P1}: Du und dein {BEGLEITER} erhalten +2 {MOVEMENT_STRAIGHT}. Alle verbündeten Spieler und ihre {BEGLEITER} erhalten in ihrem nächsten Zug +1 {MOVEMENT_STRAIGHT}.',
    play: async (g, c) => { await g.draw(c.p, 1); g.addPool(c.p, 'hero', 'straight', 2); g.addPool(c.p, 'wolf', 'straight', 2); } });
  def({ id: 55, name: 'Resonanzkristall', cls: 'neutral', types: ['ultimate'], art: 'coin',
    text: 'Wirf 1 Münze. Kopf: Spiele nach diesem Zug anschliessend 1 weiteren Zug. Zahl: Beende deinen Zug sofort.',
    play: async (g, c) => {
      const heads = Math.random() < 0.5;
      await g.coinFlip(heads);
      if (heads) { g.turn.extraTurn = true; g.log('Kopf! Du spielst anschliessend einen weiteren Zug.', 'good'); }
      else { g.turn.endRequested = true; g.log('Zahl! Der Zug endet sofort.', 'bad'); }
    } });
  def({ id: 56, name: 'Riftklingen-Resonanz', cls: 'neutral', types: ['ultimate', 'konter'], art: 'sword',
    text: 'Negiere den Effekt und lege die Karte auf den Ablagestapel.',
    trigger: 'In deinem Zug: Gegner spielt eine Konterkarte.',
    counter: { on: 'cardPlayed', test: (g, p, ev) => (g.cur === p && ev.player !== p && ev.def.types.includes('konter')) ? {} : null },
    play: async (g, c) => { c.trig.ev.negated = true; } });
  def({ id: 57, name: 'Impuls des Ring des Äon', cls: 'neutral', types: ['ultimate'], art: 'rune', cost: { discard: 1 },
    text: '{M1}: Wähle 1 Karte aus deinem Ablagestapel, zeige sie und nimm sie auf die Hand.',
    can: (g, c) => g.P(c.p).discard.length > 0 || 'Dein Ablagestapel ist leer.',
    play: async (g, c) => {
      const P = g.P(c.p);
      const pick = await g.pickCards(c.p, P.discard.slice(), 'Wähle 1 Karte aus deinem Ablagestapel', { min: 1, max: 1, ai: x => A().cardValue(g, c.p, x) });
      if (pick && pick[0]) { P.discard.splice(P.discard.indexOf(pick[0]), 1); P.hand.push(pick[0]); g.log(`${g.pname(c.p)} nimmt ${g.cardName(pick[0])} aus dem Ablagestapel.`); await g.enforceHandLimit(c.p); }
    } });
  def({ id: 58, name: 'Eilsamenbeutel', cls: 'neutral', types: ['ultimate'], art: 'BEGLEITER',
    text: 'Suche in deinem Deck nach bis zu 3 Karten mit „Eilsamen“ im Namen. Zeige sie offen vor und nimm sie auf die Hand. Mische dein Deck. +1 {PLAY1}.',
    play: async (g, c) => {
      await g.searchDeck(c.p, ci => /eil?samen/i.test(g.def(ci).name), 3, 'Wähle bis zu 3 Eilsamen-Karten');
      g.addPlays(1);
    } });
  def({ id: 59, name: 'Schleierphiole', cls: 'neutral', types: ['standard'], art: 'ANTIKONTER', antikonter: true, max: 2,
    info: 'Diese Karte darf höchstens 2-mal in deinem Deck enthalten sein.',
    text: '{ANTIKONTER}.',
    play: async (g, c) => { g.log('Für den Rest des Zuges kann nicht gekontert werden.'); } });
  def({ id: 60, name: 'Seelenkompass', cls: 'neutral', types: ['standard'], art: 'P2',
    text: '{P2}.', play: async (g, c) => { await g.draw(c.p, 2); } });
  def({ id: 61, name: 'Siegel des Bannamulets', cls: 'neutral', types: ['standard', 'konter'], art: 'shield', max: 2, cost: { discard: 2 },
    info: 'Diese Karte darf höchstens 2-mal in deinem Deck enthalten sein.',
    text: '{M2}: Negiere den Effekt und lege die Karte auf den Ablagestapel.',
    trigger: 'Gegner spielt eine Klassenkarte oder eine gegnerische {TRAP} des Typs Klassenkarte wird ausgelöst.',
    counter: { on: 'cardPlayed', test: (g, p, ev) => (ev.player !== p && ev.def.types.includes('klasse')) ? {} : null },
    play: async (g, c) => { c.trig.ev.negated = true; } });
  def({ id: 62, name: 'Sprengladung', cls: 'neutral', types: ['standard'], art: 'WALL1', max: 2, cost: { discard: 1 },
    info: 'Diese Karte darf höchstens 2-mal in deinem Deck enthalten sein.',
    text: '{M1}: Zerstöre {WALL1}.',
    can: (g) => g.walls.size > 0 || 'Keine Wände auf dem Feld.',
    play: async (g, c) => { await destroyWalls(g, c, 1, false); } });
  def({ id: 63, name: 'Transfusionsspiegel', cls: 'neutral', types: ['ultimate'], art: 'eye',
    text: 'Wähle 1 Ultimate-Karte im gegnerischen Ablagestapel. Es darf keine Konterkarte sein. Spiele diese Karte sofort als Kopie der gewählten Karte.',
    can: (g, c) => g.P(1 - c.p).discard.some(x => { const d = g.def(x); return d.types.includes('ultimate') && !d.types.includes('konter') && d.id !== 63; }) || 'Keine passende Ultimate-Karte beim Gegner.',
    play: async (g, c) => {
      const cand = g.P(1 - c.p).discard.filter(x => { const d = g.def(x); return d.types.includes('ultimate') && !d.types.includes('konter') && d.id !== 63; });
      const pick = await g.pickCards(c.p, cand, 'Welche Ultimate-Karte kopierst du?', { min: 1, max: 1, ai: x => A().cardValue(g, c.p, x) });
      if (pick && pick[0]) await g.playCopy(c.p, pick[0], c.origin);
    } });
  def({ id: 64, name: 'Tauschkristall', cls: 'neutral', types: ['standard'], art: 'crystal', max: 2, cost: { discard: 2 }, needsOrigin: true,
    info: 'Diese Karte darf höchstens 2-mal in deinem Deck enthalten sein.',
    text: '{M2}: Tausche deine Position durch Teleportation mit einer Figur in {UMFANG} 2.',
    can: (g, c) => g.figs.some(f => f.alive && f !== c.origin && near(f, c.origin) <= 2) || 'Keine Figur im Umkreis 2.',
    play: async (g, c) => {
      const cand = g.figs.filter(f => f.alive && f !== c.origin && near(f, c.origin) <= 2);
      let f = await g.pickFigure(c.p, cand, 'Mit welcher Figur tauschen?', { ai: x => A().swapScore(g, c.p, c.origin, x) });
      if (!f) return;
      if (f.owner !== c.p) { f = await g.affect(c.p, f, { swap: true, label: 'Tauschkristall' }); if (!f) return; }
      await swapFigs(g, c.origin, f);
    } });
  def({ id: 65, name: 'Winziger Eisamen', cls: 'neutral', types: ['standard'], art: 'MOVEMENT_STRAIGHT',
    text: '+1 {MOVEMENT_STRAIGHT}.', play: async (g, c) => { g.addPool(c.p, 'hero', 'straight', 1); } });

  // ---------------- WALDLÄUFER ----------------
  def({ id: 66, name: 'Fährtenwolf', cls: 'ranger', types: ['ultimate'], art: 'BEGLEITER', heroOrigin: true,
    info: 'Du kannst maximal 1 Begleiter in deinem Deck haben.',
    text: 'Beschwöre den {BEGLEITER} Fährtenwolf. Eigenschaften: 2 {MOVEMENT_STRAIGHT} pro eigenem Zug.',
    can: (g, c) => (!g.wolfOf(c.p) && g.heroOf(c.p) && g.freeAdjacent(g.heroOf(c.p)).length > 0) || 'Kein freies Feld neben deinem Helden.',
    play: async (g, c) => { await g.summonWolf(c.p, c.card); c.keepCard = true; } });
  def({ id: 67, name: 'Bruchschuss', cls: 'ranger', types: ['ultimate'], art: 'bow', needsOrigin: true,
    text: 'Zerstöre {ALL_WALLS}, die deine {LOS} blockieren, in einer geraden Richtung von deiner Figur aus.',
    can: (g, c) => D4.some(d => g.wallsOnRay(c.origin, d).length) || 'Keine Wand in gerader Richtung.',
    play: async (g, c) => {
      const opts = D4.map(d => ({ d, walls: g.wallsOnRay(c.origin, d) })).filter(o => o.walls.length);
      const sq = opts.map(o => ({ x: c.origin.x + o.d[0], y: c.origin.y + o.d[1], o }));
      const s = await g.pickSquare(c.p, sq, 'Wähle die Schussrichtung', { ai: q => q.o.walls.reduce((a, k) => a + A().wallRemovalValue(g, c.p, k), 0) });
      if (s) for (const k of s.o.walls) g.destroyWall(k);
    } });
  def({ id: 68, name: 'Doppelschuss', cls: 'ranger', types: ['ultimate'], art: 'bow',
    text: '+1 {PLAY2} oder +2 {P2}.',
    play: async (g, c) => {
      const v = await g.pickOption(c.p, [{ label: '+1 Karte spielen', value: 'play' }, { label: '+2 Karten ziehen', value: 'draw' }], 'Doppelschuss: Wähle', { ai: o => o.value === 'draw' ? (g.P(c.p).hand.length <= 2 ? 3 : 1) : (g.P(c.p).hand.length >= 2 ? 2 : 0) });
      if (v === 'play') g.addPlays(1); else await g.draw(c.p, 2);
    } });
  def({ id: 69, name: 'Eilsamen', cls: 'ranger', types: ['klasse'], art: 'BEGLEITER',
    text: 'Wähle eines:\n• Du oder dein {BEGLEITER} erhält +1 {MOVEMENT_STRAIGHT}.\n• Ein verbündeter Spieler oder ein {BEGLEITER} nach Wahl erhält in seinem nächsten Zug +1 {MOVEMENT_STRAIGHT}.',
    play: async (g, c) => {
      const opts = [{ label: 'Du: +1 gerade Bewegung', value: 'me' }];
      if (g.wolfOf(c.p)) { opts.push({ label: 'Wolf: +1 gerade Bewegung', value: 'wolf' }); opts.push({ label: 'Wolf: im nächsten Zug +1', value: 'wolfnext' }); }
      const v = opts.length > 1 ? await g.pickOption(c.p, opts, 'Eilsamen: Wähle', { ai: o => o.value === 'me' ? 2 : 1 }) : 'me';
      if (v === 'me') g.addPool(c.p, 'hero', 'straight', 1);
      else if (v === 'wolf') g.addPool(c.p, 'wolf', 'straight', 1);
      else g.addNext(c.p, 'wolfstraight', 1);
    } });
  def({ id: 70, name: 'Ätherfalle', cls: 'ranger', types: ['klasse', 'trap'], art: 'TRAP', max: 1, info: TRAPINFO,
    text: 'Lege diese {TRAP}: Betritt eine gegnerische Figur das Feld, muss dessen Besitzer {M3}.',
    play: placeTrap,
    trap: async (g, tr, fig) => { await g.discardFromHand(fig.owner, 3, 'Ätherfalle: Wirf 3 Karten ab', true); } });
  def({ id: 71, name: 'Explosivfalle', cls: 'ranger', types: ['klasse', 'trap'], art: 'TRAP', max: 1, info: TRAPINFO,
    text: 'Lege diese {TRAP}: Betritt eine gegnerische Figur das Feld, teleportiere sie mit {TELEPORT_ALL} um bis zu 2 Felder in eine Richtung.',
    play: placeTrap,
    trap: async (g, tr, fig) => {
      const t = await g.affect(tr.owner, fig, { push: true, label: 'Explosivfalle' }); if (!t) return;
      const opts = teleportTargets(g, t, D8, [1, 2]);
      const s = opts.length ? await g.pickSquare(tr.owner, opts, 'Explosivfalle: Wohin wird die Figur geschleudert?', { ai: q => A().pushScore(g, tr.owner, t, q) }) : null;
      if (s) await g.teleport(t, s.x, s.y, { noCapture: true });
    } });
  def({ id: 72, name: 'Frostfalle', cls: 'ranger', types: ['klasse', 'trap'], art: 'SNARED', max: 1, info: TRAPINFO,
    text: 'Lege diese {TRAP}: Betritt eine gegnerische Figur das Feld, setzt dessen Besitzer seinen nächsten Zug aus.',
    play: placeTrap,
    trap: async (g, tr, fig) => { const t = await g.affect(tr.owner, fig, { skip: true, label: 'Frostfalle' }); if (t) g.skipTurns(t.owner, 1); } });
  def({ id: 73, name: 'Rabenfalle', cls: 'ranger', types: ['klasse', 'trap'], art: 'eye', max: 1, replaces: 46,
    info: 'Ersetzt die Karte Auge des Raben (Nr. 46) in deinem Deck. ' + TRAPINFO,
    text: 'Lege diese {TRAP}: Betritt eine gegnerische Figur das Feld, wähle eines: Dessen Besitzer muss dir seine Handkarten zeigen. Oder sieh dir die obersten 3 Karten seines Decks an und lege sie in eine beliebige Reihenfolge zurück.',
    play: placeTrap,
    trap: async (g, tr, fig) => {
      const v = await g.pickOption(tr.owner, [{ label: 'Handkarten zeigen lassen', value: 'hand' }, { label: 'Oberste 3 Deckkarten ansehen & ordnen', value: 'deck' }], 'Rabenfalle: Wähle', { ai: o => o.value === 'deck' ? 2 : 1 });
      if (v === 'deck') await g.reorderTopCards(tr.owner, fig.owner, 3); else await g.revealHandTo(tr.owner, fig.owner);
    } });
  def({ id: 74, name: 'Wurzelfalle', cls: 'ranger', types: ['klasse', 'trap'], art: 'SNARED', max: 1, replaces: 47,
    info: 'Ersetzt die Karte Fangeisen (Nr. 47) in deinem Deck. ' + TRAPINFO,
    text: 'Lege diese {TRAP}: Betritt eine gegnerische Figur das Feld, erhält sie in diesem und in ihrem nächsten Zug {SNARED}.',
    play: placeTrap,
    trap: async (g, tr, fig) => { const t = await g.affect(tr.owner, fig, { snare: true, label: 'Wurzelfalle' }); if (t) g.snare(t, 'thisAndNext'); } });
  def({ id: 75, name: 'Fass!', cls: 'ranger', types: ['klasse'], art: 'BEGLEITER',
    text: 'Du und dein Wolf erhalten +1 {MOVEMENT_STRAIGHT}.',
    play: async (g, c) => { g.addPool(c.p, 'hero', 'straight', 1); g.addPool(c.p, 'wolf', 'straight', 1); } });
  def({ id: 76, name: 'Felsensprung', cls: 'ranger', types: ['klasse'], art: 'ALL_WALLS',
    text: 'Du kannst dich diesen Zug durch {ALL_WALLS} bewegen.',
    play: async (g, c) => { g.turn.throughWalls = true; } });
  def({ id: 77, name: 'Fernschuss', cls: 'ranger', types: ['klasse', 'konter'], art: 'bow', noClone: true, max: 2, cost: { discard: 1 },
    info: 'Kann nicht von einem Schattenklon aus gespielt werden. Diese Karte darf höchstens 2-mal in deinem Deck enthalten sein.',
    text: '{M1}: Die gegnerische Figur wird geschnappt.',
    trigger: 'Nach einer {MOVE}: Eine gegnerische Figur befindet sich in {ABSTAND2} = 3 und {LOS}.',
    counter: { on: 'enter', test: (g, p, ev) => {
      if (ev.type !== 'enter' || !ev.isMove || ev.silent) return null;
      const shooters = g.figsOf(p).filter(f => f.kind === 'hero' || (f.kind === 'clone' && g.turn.clonesEmpowered === p));
      const targets = enemyFigs(g, p).filter(e => !g.isProtected(e) && shooters.some(s => near(s, e) === 3 && g.inLOS(s, e)));
      return targets.length ? { targets } : null;
    } },
    play: async (g, c) => {
      const ts = c.trig.targets.filter(f => f.alive);
      const e = ts.length > 1 ? await g.pickFigure(c.p, ts, 'Welche Figur wird geschnappt?', { ai: x => A().captureValue(g, c.p, x) }) : ts[0];
      if (!e) return;
      const t = await g.affect(c.p, e, { capture: true, label: 'Fernschuss' });
      if (t) await g.capture(t, c.p, 'Fernschuss');
    } });
  def({ id: 78, name: 'Fesselsprung', cls: 'ranger', types: ['klasse', 'konter'], art: 'SNARED',
    text: 'Deine Figur wird von dem Effekt nicht betroffen.',
    trigger: 'Deine Figur wird von einem gegnerischen Karteneffekt betroffen, der {SNARED} verursacht oder dich min. 1 Zug aussetzen lässt.',
    counter: { on: 'affect', test: (g, p, ev) => (ev.fig.owner === p && ev.src !== p && (ev.info.snare || ev.info.skip)) ? {} : null },
    play: async (g, c) => { c.trig.ev.result.negate = true; } });
  def({ id: 79, name: 'Gleitschritt', cls: 'ranger', types: ['klasse'], art: 'MOVEMENT_DIAGONAL',
    text: 'Du und dein Wolf erhalten +1 {MOVEMENT_DIAGONAL}.',
    play: async (g, c) => { g.addPool(c.p, 'hero', 'diag', 1); g.addPool(c.p, 'wolf', 'diag', 1); } });
  def({ id: 80, name: 'Rückschritt', cls: 'ranger', types: ['klasse', 'konter'], art: 'MOVEMENT_ALL', max: 2, cost: { discard: 1 },
    info: 'Diese Karte darf höchstens 2-mal in deinem Deck enthalten sein.',
    text: '{M1}: Bewege dich um 1 {MOVEMENT_ALL}. Mit dieser Bewegung kannst du keine Gegner schnappen.',
    trigger: 'Nach einer {MOVE}: Eine gegnerische Figur befindet sich in {LOS}.',
    counter: { on: 'enter', test: (g, p, ev) => {
      if (ev.type !== 'enter' || !ev.isMove || ev.silent) return null;
      const mine = g.figsOf(p).filter(f => f.kind !== 'wolf' && enemyFigs(g, p).some(e => g.inLOS(f, e)) && stepTargets(g, f, D8).length);
      return mine.length ? { mine } : null;
    } },
    play: async (g, c) => {
      const mine = c.trig.mine.filter(f => f.alive);
      const f = mine.length > 1 ? await g.pickFigure(c.p, mine, 'Welche Figur weicht aus?', { ai: x => x.kind === 'hero' ? 2 : 1 }) : mine[0];
      if (!f) return;
      const opts = stepTargets(g, f, D8);
      const s = opts.length ? await g.pickSquare(c.p, opts, 'Rückschritt: Wohin?', { ai: q => A().escapeScore(g, c.p, f, q) }) : null;
      if (s) await g.forcedMove(f, s.x, s.y, { by: c.p, own: true });
    } });
  def({ id: 81, name: 'Spurenleser', cls: 'ranger', types: ['klasse'], art: 'P3', max: 2, replaces: 50,
    info: 'Ersetzt die Karte Gedankenentfaltung (Nr. 50) in deinem Deck. Diese Karte darf höchstens 2-mal in deinem Deck enthalten sein.',
    text: '{P3}, dann -1 {M1}.',
    play: async (g, c) => { await g.draw(c.p, 3, true); await g.discardFromHand(c.p, 1, 'Spurenleser: Wirf 1 Karte ab'); await g.enforceHandLimit(c.p); } });
  def({ id: 82, name: 'Tarnmantel', cls: 'ranger', types: ['klasse'], art: 'CLONE', noFlag: true, max: 2, cost: { discard: 1 }, needsOrigin: true,
    info: 'Nicht spielbar, während du die Flagge trägst. Diese Karte darf höchstens 2-mal in deinem Deck enthalten sein.',
    text: '{M1}: Beschwöre 1 {CLONE}. Er verschwindet, nachdem du eine Karte gespielt hast.',
    can: (g, c) => g.freeAdjacent(c.origin).length > 0 || 'Kein freies Feld neben deiner Figur.',
    play: async (g, c) => { await summonCloneNear(g, c, 1, 'tarn'); } });
  def({ id: 83, name: 'Toxinschuss', cls: 'ranger', types: ['klasse', 'konter'], art: 'SNARED',
    text: 'Die gegnerische Figur erhält in diesem und in ihrem nächsten Zug {SNARED}.',
    trigger: 'Nach einer {MOVE}: Eine gegnerische Figur befindet sich in {ABSTAND2} ≥ 3 und {LOS}.',
    counter: { on: 'enter', test: (g, p, ev) => {
      if (ev.type !== 'enter' || !ev.isMove || ev.silent) return null;
      const mine = g.figsOf(p).filter(f => f.kind !== 'wolf');
      const targets = enemyFigs(g, p).filter(e => mine.some(s => near(s, e) >= 3 && g.inLOS(s, e)));
      return targets.length ? { targets } : null;
    } },
    play: async (g, c) => {
      const ts = c.trig.targets.filter(f => f.alive);
      const e = ts.length > 1 ? await g.pickFigure(c.p, ts, 'Welche Figur wird festgesetzt?', { ai: x => A().captureValue(g, c.p, x) }) : ts[0];
      if (e) await snareFigs(g, c, [e], 'thisAndNext');
    } });
  def({ id: 84, name: 'Waffenarsenal', cls: 'ranger', types: ['klasse'], art: 'TRAP',
    text: 'Suche in deinem Deck nach 1 {TRAP}: Zeige sie und nimm sie auf die Hand. Mische dein Deck. +1 {PLAY1}.',
    play: async (g, c) => { await g.searchDeck(c.p, ci => g.def(ci).types.includes('trap'), 1, 'Wähle 1 Falle'); g.addPlays(1); } });
  def({ id: 85, name: 'Waldsegen', cls: 'ranger', types: ['klasse'], art: 'MOVEMENT_HORIZONTAL',
    text: 'Wähle eines: Du erhältst +2 {MOVEMENT_HORIZONTAL}. Ein verbündeter Spieler deiner Wahl erhält in seinem nächsten Zug +2 {MOVEMENT_HORIZONTAL}.',
    play: async (g, c) => { g.addPool(c.p, 'hero', 'horiz', 2); } });
  def({ id: 86, name: 'Wolfmodus', cls: 'ranger', types: ['ultimate'], art: 'MODE', max: 2,
    info: 'Diese Karte darf höchstens 2-mal in deinem Deck enthalten sein.',
    text: 'Aktiviere den Wolf – {MODE}: +1 {MOVE_STRAIGHT} pro eigenem Zug. Du bist in {UMFANG} 1 schnappbar – auch durch {WALLS}.',
    can: (g, c) => !g.P(c.p).wolfMode || 'Der Wolfmodus ist bereits aktiv.',
    play: async (g, c) => { g.P(c.p).wolfMode = true; g.turn.wallShifts += 1; g.log(`${g.pname(c.p)} aktiviert den Wolfmodus!`, 'epic'); } });
  def({ id: 87, name: 'Zweite Jagd', cls: 'ranger', types: ['ultimate'], art: 'BEGLEITER', cost: { discard: 1 },
    text: '{M1}: Beschwöre einen {BEGLEITER} aus deinem Ablagestapel.',
    can: (g, c) => (!g.wolfOf(c.p) && g.P(c.p).discard.some(x => x.id === 66) && g.heroOf(c.p) && g.freeAdjacent(g.heroOf(c.p)).length) || 'Kein Begleiter im Ablagestapel.',
    play: async (g, c) => {
      const P = g.P(c.p); const w = P.discard.find(x => x.id === 66);
      if (!w) return; P.discard.splice(P.discard.indexOf(w), 1);
      await g.summonWolf(c.p, w);
    } });

  // ---------------- ZAUBERER ----------------
  def({ id: 88, name: 'Arkane Sperre', cls: 'mage', types: ['klasse', 'konter'], art: 'shield', max: 2, cost: { discard: 1 }, replaces: 61,
    info: 'Ersetzt die Karte Siegel des Bannamulets (Nr. 61) in deinem Deck. Diese Karte darf höchstens 2-mal in deinem Deck enthalten sein.',
    text: '{M1}: Negiere den Effekt und lege die Karte auf den Ablagestapel.',
    trigger: 'Ein Gegner spielt eine Klassenkarte oder eine gegnerische {TRAP} des Typs Klassenkarte wird ausgelöst.',
    counter: { on: 'cardPlayed', test: (g, p, ev) => (ev.player !== p && ev.def.types.includes('klasse')) ? {} : null },
    play: async (g, c) => { c.trig.ev.negated = true; } });
  def({ id: 89, name: 'Arkaner Zeitriss', cls: 'mage', types: ['ultimate'], art: 'hourglass', antikonter: true, endTurn: true, skipNext: 1,
    penalty: 'Der Zug wird sofort beendet. Setze deinen nächsten Zug aus.',
    text: '{ANTIKONTER}: Setze alle Figuren und die {FLAG} im Spiel durch {TELEPORT_ALL} auf ihre Startpositionen zurück. Erzielte Punkte bleiben jedoch bestehen.',
    play: async (g, c) => { await g.resetToStart(); } });
  def({ id: 90, name: 'Astralregen', cls: 'mage', types: ['klasse'], art: 'TELEPORT_ALL',
    text: '{TELEPORT_ALL} Alle Figuren um 1 in dieselbe Richtung bewegen. Bereits angrenzende Figuren gelten nicht als neu angrenzend. +1 {PLAY1}.',
    play: async (g, c) => {
      const v = await g.pickOption(c.p, DIR_OPTS.map((o, i) => ({ label: o.label, value: i })), 'Astralregen: Wähle eine gerade Richtung', { ai: o => A().astralScore(g, c.p, DIR_OPTS[o.value].d) });
      await g.shiftAll(DIR_OPTS[v == null ? 0 : v].d);
      g.addPlays(1);
    } });
  def({ id: 91, name: 'Astralreise', cls: 'mage', types: ['ultimate'], art: 'PORTALE', noFlag: true, cost: { discard: 2 }, endTurn: true, needsOrigin: true,
    info: 'Nicht spielbar, während du die Flagge trägst.', penalty: 'Beende deinen Zug sofort.',
    text: '{M2}: {TELEPORT} dich auf ein verbündetes {PORTALE}.',
    can: (g, c) => g.portalsOf(c.p).some(pt => !g.figAt(pt.x, pt.y)) || 'Kein freies eigenes Portal.',
    play: async (g, c) => {
      const t = g.portalsOf(c.p).filter(pt => !g.figAt(pt.x, pt.y));
      const s = await g.pickSquare(c.p, t, 'Auf welches Portal?', { ai: q => -A().goalDistFrom(g, c.p, q) });
      if (s) await g.teleport(c.origin, s.x, s.y, { noPortal: true });
    } });
  def({ id: 92, name: 'Ätherraub', cls: 'mage', types: ['klasse'], art: 'hand',
    text: 'Sieh dir bis zu 2 beliebige Handkarten deines Gegners an. Wähle davon eine Klassenkarte (es darf keine Konterkarte sein): Du darfst sie in diesem Zug spielen, als wäre sie deine eigene, oder sie abwerfen.',
    play: async (g, c) => {
      if (!g.P(1 - c.p).hand.length) { g.log('Der Gegner hat keine Handkarten.'); return; }
      const seen = g.randomHandCards(1 - c.p, 2);
      await g.showCards(c.p, seen, 'Ätherraub: Diese Karten hält dein Gegner');
      const ok = seen.filter(x => { const d = g.def(x); return d.types.includes('klasse') && !d.types.includes('konter'); });
      if (!ok.length) { g.log('Keine stehlbare Klassenkarte dabei.'); return; }
      const pick = await g.pickCards(c.p, ok, 'Wähle eine Klassenkarte', { min: 1, max: 1, ai: x => A().cardValue(g, 1 - c.p, x) });
      if (!pick || !pick[0]) return;
      const card = pick[0];
      const canUse = g.canResolveStolen(c.p, card, c.origin);
      const v = await g.pickOption(c.p, [{ label: 'Sofort spielen', value: 'play', disabled: !canUse }, { label: 'Abwerfen', value: 'discard' }], `${g.cardName(card)}: spielen oder abwerfen?`, { ai: o => o.value === 'play' && canUse ? A().stolenValue(g, c.p, card) : 1 });
      if (v === 'play' && canUse) await g.playStolen(c.p, card, c.origin);
      else g.discardSpecific(1 - c.p, card, 'Ätherraub');
    } });
  def({ id: 93, name: 'Äthersprung', cls: 'mage', types: ['klasse'], art: 'TELEPORT_ALL', cost: { discard: 1 }, needsOrigin: true,
    text: '{M1}: {TELEPORT_ALL} um 2 in eine Richtung.',
    can: (g, c) => teleportTargets(g, c.origin, D8, [2], true).length > 0 || 'Kein Zielfeld frei.',
    play: async (g, c) => {
      const t = teleportTargets(g, c.origin, D8, [2], true);
      const s = await g.pickSquare(c.p, t, 'Äthersprung: Zielfeld wählen', { ai: q => A().positionScore(g, c.p, c.origin, q) });
      if (s) await g.teleport(c.origin, s.x, s.y, {});
    } });
  def({ id: 94, name: 'Ätherstoss', cls: 'mage', types: ['ultimate'], art: 'staff', cost: { discard: 1 }, needsOrigin: true,
    text: '{M1}: Wähle eine gegnerische Figur in {LOS}. Der Besitzer der Figur setzt seinen nächsten Zug aus.',
    can: (g, c) => enemyFigs(g, c.p).some(e => g.inLOS(c.origin, e)) || 'Keine gegnerische Figur in Sichtlinie.',
    play: async (g, c) => {
      const cand = enemyFigs(g, c.p).filter(e => g.inLOS(c.origin, e));
      const e = await g.pickFigure(c.p, cand, 'Wähle eine gegnerische Figur', { ai: x => x.kind === 'hero' ? 2 : 1 });
      if (!e) return;
      const t = await g.affect(c.p, e, { skip: true, label: 'Ätherstoss' });
      if (t) g.skipTurns(t.owner, 1);
    } });
  def({ id: 95, name: 'Blitzstoss', cls: 'mage', types: ['klasse', 'konter'], art: 'MOVEMENT_ALL',
    text: '{MOVEMENT_ALL} Die gegnerische Figur um 1.',
    trigger: 'Gegnerische Figur betritt ein Feld in {LOS}.',
    counter: { on: 'enter', test: (g, p, ev) => {
      if (ev.type !== 'enter' || ev.silent || ev.fig.owner === p || !ev.fig.alive) return null;
      return g.figsOf(p).some(f => f.kind !== 'wolf' && g.inLOS(f, ev.fig)) && stepTargets(g, ev.fig, D8).length ? { enemy: ev.fig } : null;
    } },
    play: async (g, c) => { if (c.trig.enemy.alive) await pushEnemy(g, c, c.trig.enemy, D8); } });
  def({ id: 96, name: 'Dimensionstor', cls: 'mage', types: ['ultimate'], art: 'PORTALE',
    text: 'Platziere deine {PORTALE} neu – sie müssen horizontal zueinander ausgerichtet sein.',
    play: async (g, c) => { await g.placePortals(c.p); } });
  def({ id: 97, name: 'Eisfessel', cls: 'mage', types: ['klasse'], art: 'SNARED', needsOrigin: true,
    text: 'Wähle eine gegnerische Figur in {LOS}. Sie erhält in ihrem nächsten Zug {SNARED}.',
    can: (g, c) => enemyFigs(g, c.p).some(e => g.inLOS(c.origin, e)) || 'Keine gegnerische Figur in Sichtlinie.',
    play: async (g, c) => {
      const cand = enemyFigs(g, c.p).filter(e => g.inLOS(c.origin, e));
      const e = await g.pickFigure(c.p, cand, 'Wähle eine gegnerische Figur', { ai: x => A().captureValue(g, c.p, x) });
      if (e) await snareFigs(g, c, [e], 'next');
    } });
  def({ id: 98, name: 'Eiswall', cls: 'mage', types: ['ultimate'], art: 'WALL3', cost: { discard: 1 },
    text: '{M1}: Du kannst bis zu {WALL3} auf dem Spielfeld repositionieren.',
    can: (g) => g.walls.size > 0 || 'Keine Wände auf dem Feld.',
    play: async (g, c) => {
      for (let i = 0; i < 3; i++) {
        if (i > 0) {
          const more = await g.pickOption(c.p, [{ label: 'Weitere Wand versetzen', value: 'y' }, { label: 'Fertig', value: 'n' }], `Eiswall (${i}/3)`, { ai: o => o.value === 'y' ? (A().bestWallRelocationGain(g, c.p) > 0 ? 2 : 0) : 1 });
          if (more !== 'y') break;
        }
        await relocateWall(g, c, `Eiswall: Wähle eine Wand (${i + 1}/3)`);
      }
    } });
  def({ id: 99, name: 'Finsterniswende', cls: 'mage', types: ['ultimate'], art: 'rotate', cost: { discard: 1 },
    info: 'Nicht spielbar, wenn dein Team eine Flagge trägt.',
    text: '{M1}: Drehe das Brett um 90° in eine beliebige Richtung. Die Start- und Ziellinien bleiben auf der jeweiligen Spielerseite. {PORTALE} müssen neu positioniert werden – horizontal zueinander ausgerichtet.',
    can: (g, c) => !g.P(c.p).carrying || 'Nicht spielbar, während du die Flagge trägst.',
    play: async (g, c) => {
      const v = await g.pickOption(c.p, [{ label: '↻ 90° im Uhrzeigersinn', value: 1 }, { label: '↺ 90° gegen den Uhrzeigersinn', value: -1 }], 'Finsterniswende: Drehrichtung', { ai: o => A().rotationScore(g, c.p, o.value) });
      await g.rotateBoard(v === -1 ? -1 : 1);
    } });
  def({ id: 100, name: 'Frostzirkel', cls: 'mage', types: ['klasse'], art: 'SNARED', needsOrigin: true,
    text: 'Gegnerische Figuren in {UMFANG} 2 erhalten in ihrem nächsten Zug {SNARED}.',
    play: async (g, c) => { await snareFigs(g, c, enemyFigs(g, c.p).filter(f => near(f, c.origin) <= 2), 'next'); } });
  def({ id: 101, name: 'Magischer Impuls', cls: 'mage', types: ['klasse'], art: 'MOVE_STRAIGHT',
    text: '{WALL1} bis zu 2 Felder in eine Richtung platzieren.',
    can: (g) => g.walls.size > 0 || 'Keine Wände auf dem Feld.',
    play: async (g, c) => { await shiftWall(g, c, 2); } });
  def({ id: 102, name: 'Nullpunkt', cls: 'mage', types: ['ultimate'], art: 'ALL_WALLS', endTurn: true,
    penalty: 'Beende deinen Zug sofort.',
    text: '{ALL_WALLS} werden zurückgesetzt (auch zerstörte). Jeder Spieler setzt anschliessend {WALL1} an eine beliebige Stelle.',
    play: async (g, c) => { await g.nullpunkt(c.p); } });
  def({ id: 103, name: 'Spiegeltransposition', cls: 'mage', types: ['klasse'], art: 'MOVE_STRAIGHT',
    text: '{MOVEMENT_STRAIGHT} Eine beliebige Figur und {MOVE_STRAIGHT} eine beliebige Wand gleichzeitig um 1 Feld in dieselbe Richtung.',
    play: async (g, c) => {
      // Figuren, die sich gleichzeitig mit der verschobenen Wand bewegen können
      const movers = (d, wk, to) => {
        const w = g.walls.get(wk); g.walls.delete(wk); g.walls.set(to, w);
        const res = g.figs.filter(f => {
          if (!f.alive) return false;
          const nx = f.x + d[0], ny = f.y + d[1];
          if (!g.inBoard(nx, ny) || g.blockedStep(f.x, f.y, nx, ny) || g.isBlockedFor(f, nx, ny)) return false;
          const o = g.figAt(nx, ny);
          if (!o) return true;
          return o.owner !== f.owner && f.owner === c.p && g.canCapture(f, o);
        });
        g.walls.delete(to); g.walls.set(wk, w);
        return res;
      };
      const opts = [];
      DIR_OPTS.forEach((o, i) => {
        const walls = [...g.walls.keys()].filter(k => { const t = g.wallShiftTargets(k, 1, o.d)[0]; return t && movers(o.d, k, t).length; });
        if (walls.length) opts.push({ d: o.d, label: o.label, walls, i });
      });
      if (!opts.length) { g.log('Keine gültige Spiegeltransposition möglich.'); return; }
      const v = await g.pickOption(c.p, opts.map((o, i) => ({ label: o.label, value: i })), 'Spiegeltransposition: Wähle eine gerade Richtung', { ai: o => A().transpositionScore(g, c.p, { d: opts[o.value].d, figs: g.figs.filter(f => f.alive && stepTargets(g, f, [opts[o.value].d]).length) }).score });
      const o = opts[v == null ? 0 : v];
      const k = await g.pickWall(c.p, o.walls, 'Wähle die Wand, die sich mitbewegt', { ai: key => A().wallMoveValue(g, c.p, key, g.wallShiftTargets(key, 1, o.d)[0]) });
      if (!k) return;
      const tgt = g.wallShiftTargets(k, 1, o.d)[0];
      const figs = movers(o.d, k, tgt);
      let f = await g.pickFigure(c.p, figs, 'Wähle die Figur, die sich gleichzeitig bewegt', { ai: x => A().pushScore(g, c.p, x, { x: x.x + o.d[0], y: x.y + o.d[1] }) + (g.figAt(x.x + o.d[0], x.y + o.d[1]) ? 200 : 0) });
      g.moveWall(k, tgt);
      if (f && f.owner !== c.p) f = await g.affect(c.p, f, { push: true, label: 'Spiegeltransposition' });
      if (f && f.alive) {
        const nx = f.x + o.d[0], ny = f.y + o.d[1];
        if (g.inBoard(nx, ny) && !g.blockedStep(f.x, f.y, nx, ny)) await g.forcedMove(f, nx, ny, { by: c.p, capture: f.owner === c.p });
      }
    } });
  def({ id: 104, name: 'Spiegelverdoppelung', cls: 'mage', types: ['klasse'], art: 'CLONES', max: 2, noFlag: true, cost: { discard: 1 }, needsOrigin: true,
    info: 'Diese Karte darf höchstens 2 mal in deinem Deck enthalten sein. Nicht spielbar, während du die Flagge trägst.',
    text: '{M1}: Beschwöre 2 {CLONES}. Sie verschwinden am Ende deines nächsten Zuges.',
    can: (g, c) => g.freeAdjacent(c.origin).length > 0 || 'Kein freies Feld neben deiner Figur.',
    play: async (g, c) => { await summonCloneNear(g, c, 2, 'mirror', { vanishTurn: g.P(c.p).turnCount + 1 }); } });
  def({ id: 105, name: 'Umkehrsphäre', cls: 'mage', types: ['klasse'], art: 'TELEPORT', cost: { discard: 1 }, replaces: 64,
    info: 'Ersetzt die Karte Tauschkristall (Nr. 64) in deinem Deck.',
    text: '{M1}: Wähle 2 beliebige Figuren innerhalb von {UMFANG} 2 zueinander. Tausche ihre Positionen durch {TELEPORT}.',
    can: (g) => g.figs.some(a => a.alive && g.figs.some(b => b.alive && b !== a && near(a, b) <= 2)) || 'Keine zwei Figuren nah genug.',
    play: async (g, c) => {
      const all = g.figs.filter(a => a.alive && g.figs.some(b => b.alive && b !== a && near(a, b) <= 2));
      let a = await g.pickFigure(c.p, all, 'Wähle die erste Figur', { ai: x => A().sphereFirst(g, c.p, x) });
      if (!a) return;
      let b = await g.pickFigure(c.p, g.figs.filter(x => x.alive && x !== a && near(a, x) <= 2), 'Wähle die zweite Figur', { ai: x => A().swapScore(g, c.p, a, x) });
      if (!b) return;
      if (a.owner !== c.p) { a = await g.affect(c.p, a, { swap: true, label: 'Umkehrsphäre' }); if (!a) return; }
      if (b.owner !== c.p) { b = await g.affect(c.p, b, { swap: true, label: 'Umkehrsphäre' }); if (!b) return; }
      if (a !== b) await swapFigs(g, a, b);
    } });
  def({ id: 106, name: 'Zeitkrümmung', cls: 'mage', types: ['klasse', 'konter'], art: 'hourglass', antikonter: true,
    text: '{ANTIKONTER}: Setze alle Figuren durch {TELEPORT} auf das Feld zurück, auf dem sie zu Beginn des Zuges standen. Erzielte Punkte bleiben jedoch bestehen. Der Zug wird sofort beendet.',
    trigger: 'Gegner betritt ein angrenzendes Feld zu deiner Figur.',
    counter: { on: 'enter', test: (g, p, ev) => T.enemyEntersAdjacent(g, p, ev, false) },
    play: async (g, c) => { await g.rewindTurn(); g.turn.endRequested = true; } });

  // ---------------- TEAM (nur Anzeige, im 1v1 nicht im Deck) ----------------
  def({ id: 107, name: 'Flaggenwechsel', cls: 'team', types: ['team'], art: 'FLAG', text: 'Wähle eine angrenzende verbündete Heldenfigur in {LOS}: Übernimm ihre {FLAG}, oder übergib ihr die {FLAG}, falls du sie trägst.', play: async () => {} });
  def({ id: 108, name: 'Göttliches Eingreifen', cls: 'team', types: ['team', 'ultimate', 'konter'], art: 'shield', text: 'Die verbündete Figur kann bis zu ihrem nächsten Zug nicht geschnappt werden.', trigger: 'Gegnerische Figur betritt ein angrenzendes Feld zu einer verbündeten Figur.', play: async () => {} });
  def({ id: 109, name: 'Hand des Ätherschöpfers', cls: 'team', types: ['team', 'ultimate'], art: 'hand', text: 'Wähle einen verbündeten Spieler. Dieser darf in diesem Zug ebenfalls 1 Karte spielen. Du erhältst +1 {PLAY1}.', play: async () => {} });
  def({ id: 110, name: 'Klingenpakt', cls: 'team', types: ['team'], art: 'sword', text: '{P1}: Wähle einen verbündeten Spieler. Du und der gewählte Spieler wählen jeweils 1 eigene Handkarte. Tauscht diese Handkarten aus.', play: async () => {} });

  const CARDS = {};
  for (const c of C) CARDS[c.id] = c;
  CLASS_INFO.team = { name: 'Team', alt: 'Team', color: '#38a6d8', color2: '#0d3550', sigil: 'banner' };

  /* ---------- Starterdecks (je 40 Karten) ---------- */
  const DECKS = {
    knight: [[23, 2], [24, 2], [25, 2], [27, 2], [28, 2], [29, 2], [31, 2], [32, 3], [33, 2], [34, 2], [35, 2], [38, 2], [40, 2], [36, 1],
      [30, 1], [39, 1], [26, 1],
      [45, 2], [41, 2], [51, 1], [61, 2], [60, 1], [65, 1]],
    ranger: [[69, 3], [70, 1], [71, 1], [72, 1], [73, 1], [74, 1], [75, 2], [76, 2], [77, 2], [78, 2], [79, 2], [80, 2], [81, 2], [82, 2], [83, 2], [84, 2], [85, 2],
      [66, 1], [68, 1], [67, 1],
      [45, 2], [41, 1], [61, 2], [65, 2]],
    mage: [[88, 2], [90, 2], [92, 2], [93, 3], [95, 2], [97, 3], [100, 2], [101, 2], [103, 2], [104, 2], [105, 2], [106, 2],
      [94, 1], [89, 1], [91, 1],
      [45, 3], [41, 2], [60, 2], [65, 2], [62, 2]],
    assassin: [[5, 2], [6, 2], [7, 3], [8, 2], [11, 2], [14, 2], [15, 2], [16, 2], [17, 3], [18, 2], [19, 2], [21, 2],
      [9, 1], [12, 1], [20, 1],
      [45, 3], [41, 2], [61, 2], [51, 1], [60, 1], [65, 2]]
  };
  for (const k in DECKS) {
    const n = DECKS[k].reduce((a, [, c]) => a + c, 0);
    if (n !== 40) console.warn('Deck', k, 'hat', n, 'Karten');
  }

  window.FX_CARDS = { CARDS, HEROES, CLASS_INFO, DECKS, D4, D8 };
})();

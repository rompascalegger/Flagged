// Headless-Simulation: KI gegen KI, prüft Regelverletzungen & Fehler
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = process.argv[2];
const GAMES = +(process.argv[3] || 8);
const LEVEL = process.argv[4] || 'mixed';

const ctx = { console, Math, Date, JSON, Promise, Set, Map, Array, Object, String, Number, Uint8Array, Float32Array, isNaN, performance: { now: () => Date.now() } };
ctx.window = ctx;
ctx.setTimeout = (fn, ms) => { setImmediate(fn); return 0; };
ctx.localStorage = { getItem: () => null, setItem: () => {} };
vm.createContext(ctx);
for (const f of ['icons.js', 'cards.js', 'engine.js', 'ai.js']) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', f), 'utf8'), ctx, { filename: f });
}
const { Game } = ctx.FX_ENGINE;
for (const k in ctx.FX_AI.LEVELS) ctx.FX_AI.LEVELS[k].delay = 0;

const stub = { log() {}, fx() {}, render() {}, animateMove: async () => {}, announce: async () => {}, cardPlayed: async () => {}, revealCard: async () => {},
  pick: async () => null, offerCounters: async () => null, showCards: async () => {}, coin: async () => {}, toast: async () => {}, turnBanner: async () => {},
  gameOver() {}, rotateBoardFx: async () => {}, drawFx() {}, snapFig() {} };

const heroes = ['assassin', 'knight', 'ranger', 'mage'];
const levels = ['easy', 'medium', 'hard', 'boss'];
(async () => {
  const summary = { wins: [0, 0, 0], reasons: {}, cardsPlayed: {}, errors: [], viol: [] };
  for (let t = 0; t < GAMES; t++) {
    const h0 = heroes[t % 4], h1 = heroes[Math.floor(t / 4) % 4];
    const lvl = LEVEL === 'mixed' ? levels[t % 4] : LEVEL;
    const g = new Game({ ui: stub, heroes: [h0, h1], level: lvl });
    g.players[0].isAI = true;
    const errs = [];
    const oe = console.error; console.error = (...a) => errs.push(a.map(x => x && x.stack ? x.stack.split('\n').slice(0, 4).join(' | ') : String(x)).join(' '));
    const os = g.stepTo.bind(g);
    g.stepTo = async (f, st) => {
      const r = await os(f, st);
      const tot = g.usedTotal(f); const pool = g.turn.pools[g.groupOf(f)];
      const max = pool.straight + pool.diag + pool.horiz + pool.all;
      if (tot > max) summary.viol.push(`${g.P(f.owner).cls} ${f.kind} ${tot}>${max} G${g.G}`);
      // zwei Figuren auf einem Feld?
      const seen = new Set();
      for (const x of g.figs) if (x.alive) { const k = x.x + ',' + x.y; if (seen.has(k)) summary.viol.push('Doppelbelegung ' + k + ' G' + g.G); seen.add(k); }
      return r;
    };
    const opc = g.playCard.bind(g);
    g.playCard = async (p, c, o) => { const n = g.def(c).name; summary.cardsPlayed[n] = (summary.cardsPlayed[n] || 0) + 1; return opc(p, c, o); };
    const ost = g.startTurn.bind(g);
    g.startTurn = async (p) => { if (g.G > 160) { g.over = { winner: -1, reason: 'Zuglimit' }; return; } return ost(p); };
    const t0 = Date.now();
    let to;
    const timeout = new Promise(r => { to = setTimeout(() => r('TIMEOUT'), 60000); });
    const res = await Promise.race([g.run().then(() => 'ok'), timeout]);
    clearTimeout(to);
    console.error = oe;
    if (res === 'TIMEOUT') { errs.push('TIMEOUT at G' + g.G + ' cur ' + g.cur + ' busy turn ' + JSON.stringify({ pu: g.turn.playsUsed, w: g.turn.wallsUsed })); g.over = g.over || { winner: -1, reason: 'timeout' }; }
    const w = g.over ? g.over.winner : -1;
    summary.wins[w === -1 ? 2 : w]++;
    const rs = g.over ? g.over.reason : '?'; summary.reasons[rs] = (summary.reasons[rs] || 0) + 1;
    console.log(`#${t} ${h0} vs ${h1} [${lvl}] -> ${rs} winner=${w} G=${g.G} pts=${g.players.map(p => p.points)} caps=${g.players.map(p => p.captures)} walls=${g.players.map(p => p.wallsLeft)} ${Date.now() - t0}ms`);
    for (const e of errs.slice(0, 3)) console.log('   ERR ' + e.slice(0, 400));
    if (errs.length) summary.errors.push(...errs.slice(0, 3));
  }
  console.log('wins P0/P1/none', summary.wins, JSON.stringify(summary.reasons));
  console.log('violations', summary.viol.slice(0, 10));
  const cp = Object.entries(summary.cardsPlayed).sort((a, b) => b[1] - a[1]);
  console.log('cards played', cp.map(([n, c]) => `${n}:${c}`).join(', '));
  process.exit(0);
})();

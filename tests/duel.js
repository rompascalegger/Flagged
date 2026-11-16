const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = process.argv[2]; const A = process.argv[3], B = process.argv[4]; const N = +(process.argv[5] || 8);
const ctx = { console, Math, Date, JSON, Promise, Set, Map, Array, Object, String, Number, Uint8Array, Float32Array, isNaN, performance: { now: () => Date.now() } };
ctx.window = ctx; ctx.setTimeout = (fn) => { setImmediate(fn); return 0; }; ctx.localStorage = { getItem: () => null, setItem: () => {} };
vm.createContext(ctx);
for (const f of ['icons.js', 'cards.js', 'engine.js', 'ai.js']) vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', f), 'utf8'), ctx, { filename: f });
for (const k in ctx.FX_AI.LEVELS) ctx.FX_AI.LEVELS[k].delay = 0; if (process.env.OVR) { const o = JSON.parse(process.env.OVR); for (const k in o) Object.assign(ctx.FX_AI.LEVELS[k], o[k]); }
const stub = { log() {}, fx() {}, render() {}, animateMove: async () => {}, announce: async () => {}, cardPlayed: async () => {}, revealCard: async () => {}, pick: async () => null, offerCounters: async () => null, showCards: async () => {}, coin: async () => {}, toast: async () => {}, turnBanner: async () => {}, gameOver() {}, rotateBoardFx: async () => {}, drawFx() {}, snapFig() {} };
const heroes = ['assassin', 'knight', 'ranger', 'mage'];
(async () => {
  const score = { [A]: 0, [B]: 0, none: 0 }; let ms = 0, maxTurnMs = 0;
  for (let t = 0; t < N; t++) {
    const lv = t % 2 ? [B, A] : [A, B];
    const g = new ctx.FX_ENGINE.Game({ ui: stub, heroes: [heroes[t % 4], heroes[(t * 3 + 1) % 4]], level: lv[1] });
    g.players[0].isAI = true;
    const ost = g.startTurn.bind(g);
    let ts = Date.now();
    g.startTurn = async (p) => { const n = Date.now(); maxTurnMs = Math.max(maxTurnMs, n - ts); ts = n; g.level = lv[p]; if (g.G > 160) { g.over = { winner: -1 }; return; } return ost(p); };
    const t0 = Date.now();
    await g.run();
    ms += Date.now() - t0;
    const w = g.over ? g.over.winner : -1;
    if (w === -1) score.none++; else score[lv[w]]++;
  }
  console.log(`${A} vs ${B}: ${JSON.stringify(score)}  avg ${Math.round(ms / N)}ms/game, slowest turn ${maxTurnMs}ms`);
  process.exit(0);
})();

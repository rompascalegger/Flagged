// Prüft alle Rätsel: vorgesehene Lösung muss funktionieren (normal & gespiegelt)
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = process.argv[2];
const ctx = { console, Math, Date, JSON, Promise, Set, Map, Array, Object, String, Number, Uint8Array, Float32Array, isNaN, performance: { now: () => Date.now() } };
ctx.window = ctx; ctx.setTimeout = (fn) => { setImmediate(fn); return 0; }; ctx.localStorage = { getItem: () => null, setItem: () => {} };
vm.createContext(ctx);
for (const f of ['icons.js', 'cards.js', 'engine.js', 'ai.js', 'puzzles.js']) vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', f), 'utf8'), ctx, { filename: f });
const COLS = 'ABCDEFGH';
const sq = (s, mir) => ({ x: mir ? 7 - COLS.indexOf(s[0]) : COLS.indexOf(s[0]), y: +s.slice(1) - 1 });

// Lösungsskripte (unverspiegelte Notation)
const SOL = [
  [['move', 'hero', 'G4'], ['move', 'hero', 'B5'], ['play', 90], ['opt', 'links'], ['play', 103], ['opt', 'oben'], ['wall', 'A5|A6'], ['fig', 'A5']],
  [['move', 'hero', 'D3'], ['play', 41], ['move', 'hero', 'E4']],
  [['play', 76], ['move', 'hero', 'D6']],
  [['play', 75], ['move', 'wolf', 'F6']],
  [['play', 15], ['fig', 'B2'], ['fig', 'E4'], ['move', 'hero', 'E6']],
  [['move', 'hero', 'D4'], ['counter', 17]],
  [['play', 93], ['cards', [97]], ['sq', 'E5']],
  [['play', 49], ['fig', 'E5'], ['sq', 'D5'], ['move', 'hero', 'D5']],
  [['play', 38], ['wall', 'G6|G7'], ['move', 'hero', 'G7']],
  [['play', 7], ['play', 11], ['move', 'hero', 'C8']],
  [['play', 64], ['cards', [45, 60]], ['fig', 'D2'], ['move', 'hero', 'D1']],
  [['play', 28], ['fig', 'F6'], ['sq', 'E5'], ['move', 'hero', 'E5']],
  [['play', 105], ['cards', [97]], ['fig', 'D4'], ['fig', 'F5'], ['move', 'hero', 'F7']],
  [['play', 7], ['play', 5], ['move', 'hero', 'E6']],
  [['move', 'hero', 'C1'], ['counter', 77], ['cards', [45]]],
  [['play', 9], ['move', 'clone', 'F7']]
];
// Gegenprobe: naheliegende Fehlversuche dürfen NICHT lösen
const WRONG = {
  1: [['play', 65], ['move', 'hero', 'D4']],
  2: [['play', 45], ['move', 'hero', 'D6']],
  8: [['play', 32], ['move', 'hero', 'G7']],
  9: [['play', 11], ['play', 7], ['move', 'hero', 'C8']],
  13: [['play', 5], ['move', 'hero', 'E6']]
};

(async () => {
  let ok = 0, fail = 0;
  for (let i = 0; i < ctx.FX_PUZZLES.PUZZLES.length; i++) {
    for (const mir of [false, true]) {
      for (const kind of ['sol', 'wrong']) {
        const script = kind === 'sol' ? SOL[i] : WRONG[i];
        if (!script) continue;
        const pz = ctx.FX_PUZZLES.variant(ctx.FX_PUZZLES.PUZZLES[i], mir);
        const queue = script.filter(s => !['move', 'play', 'counter'].includes(s[0]));
        let qi = 0; const log = [];
        const ui = {
          log(e) { log.push(e.text); }, fx() {}, render() {}, animateMove: async () => {}, announce: async () => {}, cardPlayed: async () => {}, revealCard: async () => {},
          showCards: async () => {}, coin: async () => {}, toast: async (m) => { log.push('TOAST ' + m); }, turnBanner: async () => {}, gameOver() {}, rotateBoardFx: async () => {}, drawFx() {}, snapFig() {},
          offerCounters: async () => null, puzzleSolved() {}, puzzleFailed() {},
          pick: async (req) => {
            const a = queue[qi++];
            if (!a) { log.push('PICK? ' + req.prompt); return req.kind === 'cards' ? [] : null; }
            const [t, v] = a;
            if (t === 'opt') { const want = mir ? ({ links: 'rechts', rechts: 'links' }[v] || v) : v; return req.options.find(o => o.label.includes(want)) || null; }
            if (t === 'sq' || t === 'fig') { const q = sq(v, mir); return req.options.find(o => o.x === q.x && o.y === q.y) || (log.push('NO OPT ' + v + ' for ' + req.prompt), null); }
            if (t === 'wall') { const [p1, p2] = v.split('|').map(s => sq(s, mir)); const k = g.edgeKey(p1.x, p1.y, p2.x, p2.y); return req.options.includes(k) ? k : (log.push('NO WALL ' + k), null); }
            if (t === 'cards') { const out = []; for (const id of v) { const c = req.options.find(o => o.id === id && !out.includes(o)); if (c) out.push(c); } return out; }
            return null;
          }
        };
        const g = new ctx.FX_ENGINE.Game({ ui, heroes: [pz.me, pz.op], level: 'medium', puzzle: pz });
        ctx.FX_PUZZLES.build(g, pz);
        g.run();
        for (let k = 0; k < 50 && !g._endHuman; k++) await new Promise(r => setImmediate(r));
        for (const step of script) {
          if (g.over) break;
          if (step[0] === 'move') {
            const f = g.figs.find(x => x.alive && x.owner === 0 && x.kind === step[1]);
            const q = sq(step[2], mir);
            if (!g.reachable(f).has(`${q.x},${q.y}`)) log.push(`UNREACHABLE ${step[2]}`);
            await g.actMove(f, q.x, q.y);
          } else if (step[0] === 'play') {
            const c = g.P(0).hand.find(x => x.id === step[1]);
            if (!c) { log.push('NO CARD ' + step[1]); continue; }
            const chk = g.canPlayCard(0, c); if (!chk.ok) log.push('CANNOT PLAY ' + step[1] + ': ' + chk.reason);
            await g.actPlay(c);
          } else if (step[0] === 'counter') {
            const w = g.window && g.window.list.find(e => e.card.id === step[1]);
            if (!w) { log.push('NO WINDOW for ' + step[1]); continue; }
            await g.actCounter(w);
          }
        }
        const solved = !!(g.over && g.over.puzzle);
        const good = kind === 'sol' ? solved : !solved;
        if (good) ok++; else fail++;
        console.log(`${good ? 'OK  ' : 'FAIL'} #${i} ${pz.title}${mir ? ' (gespiegelt)' : ''} [${kind}] solved=${solved}` + (good ? '' : '\n      ' + log.slice(-8).join('\n      ')));
      }
    }
  }
  console.log(`\n${ok} ok, ${fail} fail`);
  process.exit(0);
})();

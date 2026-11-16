/* =========================================================
   FLAGGED – Tägliche Rätsel mit Kalender
   ========================================================= */
(function () {
  const COLS = 'ABCDEFGH';
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const MONTHS = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];

  /* Notation: Felder wie im Regelbuch (A–H, 1–8); Wände als "A5|A6" (zwischen zwei Feldern).
     In Lösungstexten werden [B4] und {L}/{R} beim Spiegeln automatisch angepasst. */
  const PUZZLES = [
    { title: 'Das erste Rätsel', diff: 3, goal: 'capture', me: 'mage', op: 'knight', opCarrying: true,
      figs: [['me', 'hero', 'G5'], ['op', 'hero', 'A6']], portals: ['G4', 'B4'],
      walls: ['A5|A6', 'A6|B6', 'D6|E6', 'F7|F8', 'C3|D3'], hand: [90, 103],
      story: 'Der Ritter hat deine Flagge geraubt und sich hinter Steinmauern verschanzt. Die blauen Tore sind deine Portale.',
      hint: 'Der Spielfeldrand ist eine Wand, die niemand verschieben kann. Und Astralregen gibt dir eine weitere Karte.',
      solution: 'Ziehe 1 Feld nach unten auf dein Portal [G4] – du erscheinst sofort auf [B4]. Ziehe 1 Feld nach oben auf [B5]. Spiele Astralregen nach {L}: Der Ritter steht am Rand und kann nicht mitziehen, du landest auf [A5]. Mit der zusätzlichen Karte spielst du Spiegeltransposition nach oben: Die Wand zwischen [A5] und [A6] rückt nach oben, gleichzeitig ziehst du auf [A6] und schnappst den Ritter.' },
    { title: 'Schräger Schnitt', diff: 1, goal: 'capture', me: 'knight', op: 'ranger', abilityUsed: true,
      figs: [['me', 'hero', 'C2'], ['op', 'hero', 'E4']], walls: ['E3|E4', 'B4|C4'], hand: [41, 65],
      story: 'Der Waldläufer glaubt sich hinter einer einzelnen Mauer sicher.',
      hint: 'Eine einzelne Wand blockiert keinen diagonalen Schritt.',
      solution: 'Ziehe 2 Felder gerade nach [D2] und [D3]. Spiele Ausweichrolle und schlage diagonal auf [E4] zu – für eine diagonale Bewegung braucht es zwei Wände, um sie zu blockieren.' },
    { title: 'Felsensprung', diff: 1, goal: 'capture', me: 'ranger', op: 'mage', abilityUsed: true,
      figs: [['me', 'hero', 'D4'], ['op', 'hero', 'D6']], walls: ['D5|D6', 'C6|D6', 'D6|E6'], hand: [45, 76, 60],
      story: 'Der Zauberer hat sich in eine Nische aus Wänden zurückgezogen.',
      hint: 'Der Umweg ist viel zu weit – also geht es mitten durch.',
      solution: 'Spiele Felsensprung und ziehe [D5] → [D6] direkt durch die Wand. Der Zauberer ist geschnappt.' },
    { title: 'Die Meute', diff: 1, goal: 'capture', me: 'ranger', op: 'knight', abilityUsed: true, opCarrying: true, wolf: 'F3',
      figs: [['me', 'hero', 'B2'], ['op', 'hero', 'F6']], walls: ['E5|F5', 'C3|C4'], hand: [75, 41],
      story: 'Der Ritter flieht mit deiner Flagge. Dein Fährtenwolf hat die Witterung aufgenommen.',
      hint: 'Der Wolf hat seine eigenen 2 Bewegungen – und manche Karten stärken auch ihn.',
      solution: 'Spiele Fass!: Der Wolf erhält +1 Bewegung. Ziehe den Wolf [F3] → [F4] → [F5] → [F6] und schnappe den Ritter.' },
    { title: 'Seelentausch', diff: 2, goal: 'capture', me: 'assassin', op: 'ranger',
      figs: [['me', 'hero', 'B2'], ['me', 'clone', 'E4'], ['op', 'hero', 'E6']], walls: ['D5|E5', 'F6|F7'], hand: [15, 5],
      story: 'Dein Schattenklon steht nah am Feind – doch nur deine Heldenfigur darf schnappen.',
      hint: 'Was der Klon nicht kann, kann der Held – wenn er an seiner Stelle steht.',
      solution: 'Spiele Seelentausch: Deine Heldenfigur tauscht durch Teleportation mit dem Klon auf [E4]. Ziehe [E5] → [E6] und schnappe den Waldläufer.' },
    { title: 'Todesstoss', diff: 2, goal: 'capture', me: 'assassin', op: 'knight',
      figs: [['me', 'hero', 'D2'], ['me', 'clone', 'H1'], ['op', 'hero', 'D5']], walls: ['D4|D5', 'C5|D5', 'D5|E5'], hand: [17, 45],
      story: 'Der Ritter steht hinter drei Wänden. Er wähnt sich unangreifbar.',
      hint: 'Konterkarten zählen nicht als gespielte Karte – und „angrenzend“ gilt auch durch Wände.',
      solution: 'Ziehe [D3] → [D4]. Jetzt steht der Ritter angrenzend zu dir: Die Bedingung von Todesstoss ist erfüllt. Spiele Todesstoss als Konter – der Ritter wird sofort geschnappt.' },
    { title: 'Äthersprung', diff: 2, goal: 'capture', me: 'mage', op: 'knight', portals: ['A8', 'H8'],
      figs: [['me', 'hero', 'C3'], ['op', 'hero', 'E5']], walls: ['E4|E5', 'D5|E5', 'E5|F5'], hand: [93, 97, 65],
      story: 'Eine Festung aus Stein – aber Teleportation ignoriert Wände.',
      hint: 'Teleportation ist auch ein Betreten. Wer auf einem Gegner landet, schnappt ihn.',
      solution: 'Spiele Äthersprung, wirf eine Karte ab und teleportiere dich diagonal 2 Felder von [C3] auf [E5]. Der Ritter ist geschnappt.' },
    { title: 'Flüstergift', diff: 1, goal: 'capture', me: 'knight', op: 'mage', abilityUsed: true,
      figs: [['me', 'hero', 'B5'], ['op', 'hero', 'E5']], walls: ['B6|B7', 'E6|E7'], hand: [49, 59],
      story: 'Drei Felder trennen dich vom Zauberer – eines zu viel.',
      hint: 'Du kannst auch den Gegner bewegen.',
      solution: 'Spiele Flüstergift und bewege den Zauberer 1 Feld nach {L} auf [D5]. Ziehe [C5] → [D5] und schnappe ihn.' },
    { title: 'Wandbrecher', diff: 2, goal: 'capture', me: 'knight', op: 'ranger', abilityUsed: true,
      figs: [['me', 'hero', 'G5'], ['op', 'hero', 'G7']], walls: ['G6|G7', 'F7|G7', 'H6|H7'], hand: [38, 32],
      story: 'Der Waldläufer hat sich eingemauert. Ritterschritt allein reicht nicht für den Umweg.',
      hint: 'Zähle den Umweg nach. Manchmal ist der kürzeste Weg der durch die Wand.',
      solution: 'Spiele Wandbrecher und zerstöre die Wand zwischen [G6] und [G7]. Ziehe [G6] → [G7] und schnappe den Waldläufer.' },
    { title: 'Griff nach der Flagge', diff: 2, goal: 'flag', me: 'assassin', op: 'knight',
      figs: [['me', 'hero', 'C5'], ['me', 'clone', 'H1'], ['op', 'hero', 'F2']], walls: ['B6|B7', 'C6|C7', 'D6|D7'], hand: [7, 11],
      story: 'Mauern versperren den direkten Weg zum gegnerischen Rand (Reihe 8) – und der Umweg ist zu weit.',
      hint: 'Die Reihenfolge entscheidet: Nur eine der beiden Karten erlaubt dir, danach noch eine Karte zu spielen.',
      solution: 'Spiele zuerst Flüsterschritt (+1 Bewegung, +1 Karte), dann Schattenriss. Ziehe [C6] → [C7] → [C8] direkt durch die Wand und erbeute die Flagge.' },
    { title: 'Heimweg', diff: 3, goal: 'score', me: 'knight', op: 'ranger', abilityUsed: true, meCarrying: true, opWolf: 'D2',
      figs: [['me', 'hero', 'E4'], ['op', 'hero', 'G7']], walls: ['C2|C3', 'D2|D3', 'E2|E3', 'F2|F3', 'G2|G3'], hand: [64, 45, 60, 65],
      story: 'Du trägst die gegnerische Flagge – doch eine Mauer trennt dich von deinem Rand (Reihe 1).',
      hint: 'Auch gegnerische Figuren können dir als Sprungbrett dienen.',
      solution: 'Spiele Tauschkristall (2 Karten abwerfen) und tausche die Position mit dem gegnerischen Wolf auf [D2]. Ziehe nach [D1] – Flaggenpunkt!' },
    { title: 'Herausforderung', diff: 2, goal: 'capture', me: 'knight', op: 'mage', abilityUsed: true,
      figs: [['me', 'hero', 'D4'], ['op', 'hero', 'F6']], walls: ['F5|F6', 'G6|G7'], hand: [28, 65],
      story: 'Der Zauberer ist vier Schritte entfernt. Fordere ihn heraus!',
      hint: 'Herausforderung bewegt Gegner in alle Richtungen – auch diagonal.',
      solution: 'Spiele Herausforderung und bewege den Zauberer diagonal nach [E5]. Ziehe [E4] → [E5] und schnappe ihn.' },
    { title: 'Umkehrsphäre', diff: 3, goal: 'capture', me: 'mage', op: 'assassin', portals: ['A1', 'B1'],
      figs: [['me', 'hero', 'D4'], ['op', 'hero', 'F7'], ['op', 'clone', 'F5']], walls: ['E6|E7', 'C5|C6'], hand: [105, 97],
      story: 'Die Assassine hat ihre Heldenfigur enthüllt. Ihr Schattenklon steht wie ein Wächter vor ihr.',
      hint: 'Umkehrsphäre tauscht zwei beliebige Figuren – auch eine eigene mit einer gegnerischen.',
      solution: 'Spiele Umkehrsphäre (Eisfessel abwerfen) und tausche deine Heldenfigur [D4] mit dem Schattenklon auf [F5]. Ziehe [F6] → [F7] und schnappe die Assassine.' },
    { title: 'Dämmerklinge', diff: 3, goal: 'capture', me: 'assassin', op: 'ranger',
      figs: [['me', 'hero', 'C5'], ['me', 'clone', 'A1'], ['op', 'hero', 'E6']], walls: ['E5|E6', 'D6|E6', 'E6|F6'], hand: [7, 5],
      story: 'Der Waldläufer hat sich von drei Seiten verbarrikadiert.',
      hint: 'Diagonal kommst du an den Ecken vorbei – aber zwei Schritte reichen nicht.',
      solution: 'Spiele Flüsterschritt (+1 Bewegung, +1 Karte), dann Dämmertritt. Ziehe diagonal nach [D6], gerade nach [D7] und diagonal auf [E6].' },
    { title: 'Fernschuss', diff: 2, goal: 'capture', me: 'ranger', op: 'mage', abilityUsed: true,
      figs: [['me', 'hero', 'A1'], ['op', 'hero', 'F4']], walls: ['F4|F5', 'F4|G4', 'B3|B4'], hand: [77, 45],
      story: 'Der Zauberer ist weit weg – doch dein Bogen reicht genau 3 Felder.',
      hint: 'Fernschuss braucht exakt 3 Felder Abstand und freie Sichtlinie – und eine Karte zum Abwerfen.',
      solution: 'Ziehe [B1] → [C1]. Der Zauberer steht nun exakt 3 Felder diagonal entfernt in deiner Sichtlinie. Spiele Fernschuss als Konter und wirf Elixier ab – geschnappt!' },
    { title: 'Schattenmanifest', diff: 1, goal: 'capture', me: 'assassin', op: 'knight',
      figs: [['me', 'hero', 'B2'], ['me', 'clone', 'F5'], ['op', 'hero', 'F7']], walls: ['E7|F7', 'G7|G8'], hand: [9, 41],
      story: 'Dein Klon steht dem Ritter gegenüber – doch Klone dürfen normalerweise nicht schnappen.',
      hint: 'Manchmal wird der Schatten selbst zur Klinge.',
      solution: 'Spiele Schattenmanifest. Ziehe den Klon [F6] → [F7] und schnappe den Ritter.' }
  ];

  const sqParse = (s) => ({ x: COLS.indexOf(s[0]), y: +s.slice(1) - 1 });
  const sqMirror = (s) => COLS[7 - COLS.indexOf(s[0])] + s.slice(1);

  function variant(pz, mirror) {
    if (!mirror) return pz;
    const m = JSON.parse(JSON.stringify(pz));
    m.figs = m.figs.map(([o, k, s]) => [o, k, sqMirror(s)]);
    m.walls = m.walls.map(w => w.split('|').map(sqMirror).join('|'));
    if (m.portals) m.portals = m.portals.map(sqMirror);
    if (m.wolf) m.wolf = sqMirror(m.wolf);
    if (m.opWolf) m.opWolf = sqMirror(m.opWolf);
    m.mirror = true;
    return m;
  }
  function textFor(pz, t) {
    return t.replace(/\[([A-H][1-8])\]/g, (_, s) => `<b class="sqn">${pz.mirror ? sqMirror(s) : s}</b>`)
      .replace(/\{L\}/g, pz.mirror ? 'rechts' : 'links').replace(/\{R\}/g, pz.mirror ? 'links' : 'rechts');
  }

  /* ---------- Kalender-Logik ---------- */
  const EPOCH = Date.UTC(2026, 0, 1);
  const dayIndex = (d) => Math.floor((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - EPOCH) / 86400000);
  const keyOf = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  function puzzleForDate(d) {
    const n = PUZZLES.length;
    const i = dayIndex(d);
    const idx = (((i * 7) % n) + n) % n;
    const mirror = Math.floor(i / n) % 2 !== 0;
    return { base: idx, pz: variant(PUZZLES[idx], mirror), no: i + 1 };
  }
  function load() { try { return JSON.parse(localStorage.getItem('flagged.puzzles.v1')) || { solved: {} }; } catch (e) { return { solved: {} }; } }
  function save(s) { try { localStorage.setItem('flagged.puzzles.v1', JSON.stringify(s)); } catch (e) { } }
  function streaks(st) {
    const today = new Date(); let cur = 0; let d = new Date(today);
    if (!st.solved[keyOf(d)]) d.setDate(d.getDate() - 1);
    while (st.solved[keyOf(d)]) { cur++; d.setDate(d.getDate() - 1); }
    const keys = Object.keys(st.solved).sort(); let best = 0, run = 0, prev = null;
    for (const k of keys) { const t = new Date(k + 'T12:00:00'); if (prev && Math.round((t - prev) / 86400000) === 1) run++; else run = 1; best = Math.max(best, run); prev = t; }
    return { cur, best, total: keys.length };
  }

  const PZ = {
    view: new Date(), current: null, currentDate: null,
    stars(n) { return '<span class="stars">' + [1, 2, 3].map(i => `<i class="${i <= n ? 'on' : ''}">✦</i>`).join('') + '</span>'; },
    goalText(pz) { return { capture: 'Schnappe die gegnerische Heldenfigur in diesem Zug.', flag: 'Erbeute die gegnerische Flagge in diesem Zug.', score: 'Bringe die Flagge in diesem Zug heim.' }[pz.goal]; },

    renderCalendar() {
      const st = load(); const s = streaks(st);
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const v = this.view; const y = v.getFullYear(), m = v.getMonth();
      const first = new Date(y, m, 1); const startDow = (first.getDay() + 6) % 7;
      const days = new Date(y, m + 1, 0).getDate();
      let cells = '';
      for (let i = 0; i < startDow; i++) cells += '<div class="cal-cell empty"></div>';
      for (let d = 1; d <= days; d++) {
        const date = new Date(y, m, d);
        const k = keyOf(date); const { pz } = puzzleForDate(date);
        const future = date > today; const isToday = date.getTime() === today.getTime();
        const solved = !!st.solved[k];
        cells += `<button class="cal-cell${future ? ' future' : ''}${isToday ? ' today' : ''}${solved ? ' solved' : ''}" data-date="${k}" ${future ? 'disabled' : ''}>
          <span class="cd">${d}</span>${future ? '<span class="lock">✧</span>' : this.stars(pz.diff)}${solved ? `<span class="done">${window.FX_ICONS.ICONS.FLAG}</span>` : ''}</button>`;
      }
      const td = puzzleForDate(today);
      const tSolved = !!st.solved[keyOf(today)];
      $('#cal').innerHTML = `
        <div class="cal-today">
          <div class="ct-label">Rätsel des Tages · ${today.getDate()}. ${MONTHS[today.getMonth()]} ${today.getFullYear()}</div>
          <div class="ct-title">${esc(td.pz.title)}</div>
          <div class="ct-meta">${this.stars(td.pz.diff)} <span>#${td.no}</span> <span>${window.FX_CARDS.HEROES[td.pz.me].name} gegen ${window.FX_CARDS.HEROES[td.pz.op].name}</span></div>
          <p class="ct-goal">${this.goalText(td.pz)}</p>
          <button class="btn gold big" data-date="${keyOf(today)}">${tSolved ? 'Nochmals spielen' : 'Jetzt lösen'}</button>
          <div class="cal-stats"><div><b>${s.cur}</b>Serie</div><div><b>${s.best}</b>Beste Serie</div><div><b>${s.total}</b>Gelöst</div></div>
        </div>
        <div class="cal-month">
          <div class="cal-head"><button class="btn small ghost" data-nav="-1">‹</button><h3>${MONTHS[m]} ${y}</h3><button class="btn small ghost" data-nav="1" ${y > today.getFullYear() || (y === today.getFullYear() && m >= today.getMonth()) ? 'disabled' : ''}>›</button></div>
          <div class="cal-grid"><div class="cal-dow">Mo</div><div class="cal-dow">Di</div><div class="cal-dow">Mi</div><div class="cal-dow">Do</div><div class="cal-dow">Fr</div><div class="cal-dow">Sa</div><div class="cal-dow">So</div>${cells}</div>
        </div>`;
      $('#cal').onclick = (e) => {
        const n = e.target.closest('[data-nav]');
        if (n && !n.disabled) { this.view = new Date(y, m + (+n.dataset.nav), 1); this.renderCalendar(); return; }
        const b = e.target.closest('[data-date]');
        if (b && !b.disabled) { window.FX_SFX.play('click'); this.start(new Date(b.dataset.date + 'T12:00:00')); }
      };
    },

    start(date) {
      const { pz, no } = puzzleForDate(date);
      this.current = pz; this.currentDate = date; this.no = no;
      window.FX_MAIN.show('game');
      document.body.classList.add('puzzle-mode');
      const g = new window.FX_ENGINE.Game({ ui: window.FX_UI, heroes: [pz.me, pz.op], level: 'medium', puzzle: pz });
      this.build(g, pz);
      window.FX_UI.attach(g);
      window.FX_MAIN.game = g;
      $('#pz-bar').innerHTML = `
        <div class="pz-info"><div class="pz-t">${esc(pz.title)} ${this.stars(pz.diff)}</div><div class="pz-d">Rätsel #${no} · ${date.getDate()}. ${MONTHS[date.getMonth()]} ${date.getFullYear()}</div></div>
        <div class="pz-goal"><b>Ziel:</b> ${this.goalText(pz)}<br><span>${esc(pz.story)}</span><br><small>Dein Zug: bis zu 2 Felder gerade bewegen · 1 Karte spielen · bis zu 2 Wände setzen.</small></div>
        <div class="pz-btns"><button class="btn small" data-pz="restart">↻ Neu</button><button class="btn small" data-pz="hint">Tipp</button><button class="btn small" data-pz="solution">Lösung</button><button class="btn small ghost" data-pz="cal">Kalender</button></div>`;
      $('#pz-bar').onclick = (e) => {
        const b = e.target.closest('[data-pz]'); if (!b) return;
        window.FX_SFX.play('click');
        const a = b.dataset.pz;
        if (a === 'restart') this.start(this.currentDate);
        if (a === 'hint') this.info('Tipp', textFor(pz, pz.hint));
        if (a === 'solution') this.info('Lösung', textFor(pz, pz.solution));
        if (a === 'cal') this.back();
      };
      g.log(`Rätsel: ${pz.title}. ${this.goalText(pz)}`, 'epic');
      g.run();
    },
    build(g, pz) {
      const P0 = g.P(0), P1 = g.P(1);
      for (const [o, k, s] of pz.figs) { const q = sqParse(s); g.newFig(o === 'me' ? 0 : 1, k, q.x, q.y, k === 'clone' ? { tag: 'shadow' } : {}); }
      if (pz.wolf) { const q = sqParse(pz.wolf); g.newFig(0, 'wolf', q.x, q.y); }
      if (pz.opWolf) { const q = sqParse(pz.opWolf); g.newFig(1, 'wolf', q.x, q.y); }
      for (const w of pz.walls) { const [a, b] = w.split('|').map(sqParse); g.walls.set(g.edgeKey(a.x, a.y, b.x, b.y), { owner: 1 }); }
      for (const s of (pz.portals || [])) { const q = sqParse(s); g.portals.push({ owner: 0, x: q.x, y: q.y }); }
      let uid = 9000;
      P0.hand = pz.hand.map(id => ({ uid: uid++, id }));
      P0.deck = []; P1.deck = []; P1.hand = [];
      P0.carrying = !!pz.meCarrying; P1.carrying = !!pz.opCarrying;
      P0.abilityUsed = !!pz.abilityUsed;
      P0.heroKnown = true; P1.heroKnown = true;
      P0.wallsLeft = 2; P1.wallsLeft = 0;
    },
    info(title, html) {
      const m = window.FX_UI.modal(`<h3>${esc(title)}</h3><div class="pz-text">${html}</div><div class="modal-btns"><button class="btn gold" data-ok>OK</button></div>`);
      m.onclick = (e) => { if (e.target.closest('[data-ok]')) window.FX_UI.closeModal(); };
    },
    onSolved() {
      const st = load(); const k = keyOf(this.currentDate);
      const first = !st.solved[k];
      st.solved[k] = Date.now(); save(st);
      const s = streaks(st);
      window.FX_SFX.play('win');
      setTimeout(() => {
        const m = window.FX_UI.modal(`<div class="go win">
          <div class="go-sigil">${window.FX_ICONS.ICONS.FLAG}</div>
          <div class="go-title">Gelöst!</div>
          <div class="go-sub">${esc(this.current.title)} ${this.stars(this.current.diff)}</div>
          <div class="go-stats"><div><b>${s.cur}</b>Serie</div><div><b>${s.best}</b>Beste Serie</div><div><b>${s.total}</b>Gelöst</div></div>
          ${first ? '' : '<div class="go-reason">Bereits zuvor gelöst</div>'}
          <div class="modal-btns"><button class="btn gold" data-x="cal">Zum Kalender</button><button class="btn ghost" data-x="again">Nochmals</button></div></div>`, 'gameover');
        m.onclick = (e) => { const b = e.target.closest('[data-x]'); if (!b) return; window.FX_UI.closeModal(); if (b.dataset.x === 'cal') this.back(); else this.start(this.currentDate); };
      }, 900);
    },
    onFailed() {
      setTimeout(() => {
        const m = window.FX_UI.modal(`<div class="go lose">
          <div class="go-sigil">${window.FX_ICONS.SIGILS.hourglass}</div>
          <div class="go-title">Nicht gelöst</div>
          <div class="go-sub">Der Zug ist vorbei. Versuch es noch einmal!</div>
          <div class="modal-btns"><button class="btn gold" data-x="again">Erneut versuchen</button><button class="btn" data-x="hint">Tipp</button><button class="btn ghost" data-x="cal">Kalender</button></div></div>`, 'gameover');
        m.onclick = (e) => {
          const b = e.target.closest('[data-x]'); if (!b) return; window.FX_UI.closeModal();
          if (b.dataset.x === 'again') this.start(this.currentDate);
          else if (b.dataset.x === 'hint') { this.start(this.currentDate); this.info('Tipp', textFor(this.current, this.current.hint)); }
          else this.back();
        };
      }, 300);
    },
    back() {
      document.body.classList.remove('puzzle-mode');
      const g = window.FX_MAIN.game; if (g) { g.over = g.over || { winner: -1, reason: 'abgebrochen' }; g._endHuman && g._endHuman(); }
      window.FX_MAIN.show('puzzles');
      this.renderCalendar();
    }
  };

  window.FX_PUZZLES = Object.assign(PZ, { PUZZLES, puzzleForDate, variant, sqParse });
})();

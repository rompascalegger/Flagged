/* =========================================================
   FLAGGED – Hauptmenü, Setup, Bildschirme
   ========================================================= */
(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const { HEROES, CLASS_INFO, CARDS } = window.FX_CARDS;
  const { heroCardHTML, cardHTML } = window.FX_RENDER;
  const { ICONS, LABELS, SIGILS } = window.FX_ICONS;

  const LEVELS = [
    { id: 'easy', name: 'Leicht', desc: 'Ein Rekrut. Macht Fehler, kontert selten.', icon: '✦' },
    { id: 'medium', name: 'Medium', desc: 'Ein erfahrener Krieger mit solider Taktik.', icon: '✦✦' },
    { id: 'hard', name: 'Stark', desc: 'Ein Veteran. Liest Bedrohungen, setzt Wände klug, kontert gnadenlos.', icon: '✦✦✦' },
    { id: 'boss', name: 'Endboss', desc: 'Der Schattenfürst. Kein Zufall, keine Gnade – 3 Startkarten, 12 Wände, Handlimit 6.', icon: '☠' }
  ];

  const M = {
    sel: { me: 'knight', op: 'random', level: 'medium' },
    game: null, smokeBack: null, smokeFront: null,

    init() {
      window.FX_UI.init();
      try { const s = JSON.parse(localStorage.getItem('flagged.setup')); if (s) Object.assign(this.sel, s); } catch (e) { }
      // Logo-Buchstaben
      const word = 'FLAGGED';
      $('#logo-word').innerHTML = [...word].map((c, i) => `<span style="--i:${i}">${c}</span>`).join('');
      $('#logo-word').dataset.text = word;
      this.smokeBack = window.FX_SMOKE.create($('#smoke-back'), { logoRect: () => $('#logo-word').getBoundingClientRect(), density: 1 });
      this.smokeFront = window.FX_SMOKE.create($('#smoke-front'), { front: true, embers: false, density: 1, alpha: 0.75 });
      this.ambient = window.FX_SMOKE.create($('#smoke-game'), { density: 0.35, embers: true, alpha: 0.4, rise: 0.6 });
      document.addEventListener('click', (e) => {
        const b = e.target.closest('[data-nav]'); if (!b || b.closest('#cal')) return;
        window.FX_SFX.ac(); window.FX_SFX.play('click');
        this.nav(b.dataset.nav);
      });
      $('#sound-btn').addEventListener('click', () => { const on = window.FX_SFX.toggle(); $('#sound-btn').classList.toggle('off', !on); });
      $('#sound-btn').classList.toggle('off', !window.FX_SFX.on);
      // Musik: startet mit der ersten Benutzeraktion (Autoplay-Regeln der Browser)
      const MU = window.FX_MUSIC;
      const syncMusicBtns = () => $$('.music-btn').forEach(b => b.classList.toggle('off', !MU.on));
      $$('.music-btn').forEach(b => b.addEventListener('click', (e) => {
        e.stopPropagation();
        if (Date.now() - (this.unlockedAt || 0) < 500 && MU.on) { syncMusicBtns(); return; } // der erste Klick hat die Musik bereits gestartet
        MU.toggle(); if (MU.on) MU.play(this.musicMode); syncMusicBtns();
      }));
      syncMusicBtns();
      const unlock = () => {
        this.unlockedAt = Date.now();
        document.body.classList.add('audio-ok');
        window.FX_SFX.ac();
        if (MU.on) MU.play(this.musicMode || 'title');
        window.removeEventListener('pointerdown', unlock, true); window.removeEventListener('keydown', unlock, true);
      };
      window.addEventListener('pointerdown', unlock, true); window.addEventListener('keydown', unlock, true);
      this.buildSetup();
      this.buildRules();
      this.show('title');
      this.intro();
      this.renderTrophies();
    },
    intro() {
      const t = $('#screen-title');
      t.classList.remove('intro-done');
      t.classList.add('intro');
      setTimeout(() => {
        const r = $('#logo-word').getBoundingClientRect();
        this.smokeBack.burst(r.left + r.width / 2, r.top + r.height / 2, 90, 3.4);
        window.FX_SFX.play('boss');
      }, 350);
      setTimeout(() => t.classList.add('intro-done'), 2600);
    },
    show(id) {
      $$('.screen').forEach(s => s.classList.toggle('active', s.id === 'screen-' + id));
      const title = id === 'title';
      title ? (this.smokeBack.start(), this.smokeFront.start()) : (this.smokeBack.stop(), this.smokeFront.stop());
      id === 'game' ? this.ambient.start() : this.ambient.stop();
      if (id !== 'game') document.body.classList.remove('puzzle-mode');
      this.screen = id;
      this.musicMode = id === 'game' ? (this.nextMusic || 'battle') : 'title';
      this.nextMusic = null;
      if (document.body.classList.contains('audio-ok') && window.FX_MUSIC.on) window.FX_MUSIC.play(this.musicMode);
    },
    nav(where) {
      if (where === 'title') { this.abortGame(); this.show('title'); this.renderTrophies(); }
      else if (where === 'setup') { this.abortGame(); this.show('setup'); this.renderSetup(); }
      else if (where === 'puzzles') { this.abortGame(); this.show('puzzles'); window.FX_PUZZLES.view = new Date(); window.FX_PUZZLES.renderCalendar(); }
      else if (where === 'rules') $('#rules').classList.add('open');
      else if (where === 'rules-close') $('#rules').classList.remove('open');
      else if (where === 'cards') { this.renderCompendium('all'); $('#compendium').classList.add('open'); }
      else if (where === 'cards-close') $('#compendium').classList.remove('open');
      else if (where === 'start') this.startGame();
      else if (where === 'menu') {
        const m = window.FX_UI.modal(`<h3>Menü</h3><div class="opt-list">
          <button class="btn opt" data-m="rules">Regeln</button><button class="btn opt" data-m="cards">Kartenkompendium</button>
          <button class="btn opt" data-m="restart">${document.body.classList.contains('puzzle-mode') ? 'Rätsel neu starten' : 'Neues Spiel'}</button>
          <button class="btn opt" data-m="title">Hauptmenü</button></div><button class="btn ghost" data-m="x">Zurück</button>`);
        m.onclick = (e) => {
          const b = e.target.closest('[data-m]'); if (!b) return; window.FX_UI.closeModal();
          const a = b.dataset.m;
          if (a === 'rules') $('#rules').classList.add('open');
          if (a === 'cards') { this.renderCompendium('all'); $('#compendium').classList.add('open'); }
          if (a === 'restart') { if (document.body.classList.contains('puzzle-mode')) window.FX_PUZZLES.start(window.FX_PUZZLES.currentDate); else this.startGame(); }
          if (a === 'title') this.nav('title');
        };
      }
    },
    abortGame() {
      const g = this.game;
      if (g && !g.over) { g.over = { winner: -1, reason: 'abgebrochen' }; g._endHuman && g._endHuman(); }
      window.FX_UI.closeModal();
    },

    /* ---------- Setup ---------- */
    buildSetup() {
      const order = ['assassin', 'knight', 'ranger', 'mage'];
      $('#pick-me').innerHTML = order.map(c => `<button class="hero-pick" data-me="${c}">${heroCardHTML(c)}</button>`).join('');
      $('#pick-op').innerHTML = order.map(c => `<button class="op-pick" data-op="${c}" style="--cc:${CLASS_INFO[c].color}"><span class="op-sig">${SIGILS[CLASS_INFO[c].sigil]}</span><b>${CLASS_INFO[c].alt}</b><small>${HEROES[c].name}</small></button>`).join('')
        + `<button class="op-pick" data-op="random" style="--cc:#c9c9d6"><span class="op-sig">?</span><b>Zufall</b><small>Überraschung</small></button>`;
      $('#pick-lvl').innerHTML = LEVELS.map(l => `<button class="lvl-pick ${l.id}" data-lvl="${l.id}"><span class="li">${l.icon}</span><b>${l.name}</b><small>${l.desc}</small></button>`).join('');
      $('#screen-setup').addEventListener('click', (e) => {
        const a = e.target.closest('[data-me]'), b = e.target.closest('[data-op]'), c = e.target.closest('[data-lvl]');
        if (a) this.sel.me = a.dataset.me;
        if (b) this.sel.op = b.dataset.op;
        if (c) { this.sel.level = c.dataset.lvl; if (this.sel.level === 'boss') window.FX_SFX.play('boss'); }
        if (a || b || c) { window.FX_SFX.play('click'); this.renderSetup(); }
      });
    },
    renderSetup() {
      $$('[data-me]').forEach(e => e.classList.toggle('on', e.dataset.me === this.sel.me));
      $$('[data-op]').forEach(e => e.classList.toggle('on', e.dataset.op === this.sel.op));
      $$('[data-lvl]').forEach(e => e.classList.toggle('on', e.dataset.lvl === this.sel.level));
      $('#screen-setup').classList.toggle('boss', this.sel.level === 'boss');
      const h = HEROES[this.sel.me];
      $('#setup-summary').innerHTML = `<b>${h.name}</b> gegen <b>${this.sel.op === 'random' ? 'einen zufälligen Gegner' : CLASS_INFO[this.sel.op].alt}</b> · Stufe <b>${LEVELS.find(l => l.id === this.sel.level).name}</b>`;
    },
    startGame() {
      this.abortGame();
      try { localStorage.setItem('flagged.setup', JSON.stringify(this.sel)); } catch (e) { }
      const order = ['assassin', 'knight', 'ranger', 'mage'];
      const op = this.sel.op === 'random' ? order[Math.floor(Math.random() * 4)] : this.sel.op;
      this.nextMusic = this.sel.level === 'boss' ? 'boss' : 'battle';
      this.show('game');
      document.body.classList.remove('puzzle-mode');
      $('#screen-game').classList.toggle('bossfight', this.sel.level === 'boss');
      const g = new window.FX_ENGINE.Game({ ui: window.FX_UI, heroes: [this.sel.me, op], level: this.sel.level });
      this.game = g;
      window.FX_UI.attach(g);
      const intro = async () => {
        if (this.sel.level === 'boss') { window.FX_SFX.play('boss'); await window.FX_UI.announce('Der Schattenfürst erwacht', 'blood'); }
        await window.FX_UI.announce(`${HEROES[this.sel.me].name} gegen ${CLASS_INFO[op].alt}`, 'silver');
        g.run();
      };
      intro();
    },
    afterGame(what) { if (what === 'again') this.startGame(); else this.nav('title'); },
    recordWin(level) {
      try { const w = JSON.parse(localStorage.getItem('flagged.wins') || '{}'); w[level] = (w[level] || 0) + 1; localStorage.setItem('flagged.wins', JSON.stringify(w)); } catch (e) { }
    },
    renderTrophies() {
      let w = {}; try { w = JSON.parse(localStorage.getItem('flagged.wins') || '{}'); } catch (e) { }
      const el = $('#trophies');
      const items = LEVELS.filter(l => w[l.id]).map(l => `<span class="tro ${l.id}" data-tip="${w[l.id]}× gegen ${l.name} gewonnen">${l.icon} ${l.name} ×${w[l.id]}</span>`);
      el.innerHTML = items.join('');
    },

    /* ---------- Regeln & Kompendium ---------- */
    buildRules() {
      const legend = Object.keys(LABELS).filter(k => !['PLAY2', 'M2', 'M3', 'P2', 'P3', 'WALL3', 'WALL4', 'ADDITIONAL'].includes(k))
        .map(k => `<div class="lg"><span class="ic">${ICONS[k]}</span><span>${LABELS[k]}</span></div>`).join('');
      $('#rules-legend').innerHTML = legend;
    },
    renderCompendium(filter) {
      const classes = ['all', 'assassin', 'knight', 'ranger', 'mage', 'neutral', 'team'];
      const names = { all: 'Alle', assassin: 'Assassine', knight: 'Ritter', ranger: 'Waldläufer', mage: 'Zauberer', neutral: 'Neutral', team: 'Team' };
      $('#comp-filter').innerHTML = classes.map(c => `<button class="btn small ${c === filter ? 'on' : ''}" data-f="${c}">${names[c]}</button>`).join('');
      const list = Object.values(CARDS).filter(c => filter === 'all' || c.cls === filter).sort((a, b) => a.id - b.id);
      const heroes = (filter === 'all' || ['assassin', 'knight', 'ranger', 'mage'].includes(filter)) ? Object.keys(HEROES).filter(h => filter === 'all' || h === filter).map(h => `<div class="cg">${heroCardHTML(h)}</div>`).join('') : '';
      $('#comp-grid').innerHTML = heroes + list.map(c => `<div class="cg">${cardHTML(c)}</div>`).join('');
      $('#comp-filter').onclick = (e) => { const b = e.target.closest('[data-f]'); if (b) this.renderCompendium(b.dataset.f); };
    }
  };

  window.FX_MAIN = M;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => M.init()); else M.init();
})();

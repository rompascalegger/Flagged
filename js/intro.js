/* =========================================================
   FLAGGED – Mysteriöses Intro „Das Auge erwacht“
   ========================================================= */
(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const LINES = [
    'Jenseits der Nebel …',
    '… wo Mauern aus Schatten wachsen …',
    '… und Flaggen mit Blut erkauft werden …',
    '… wacht ein Auge, das niemals schläft.'
  ];

  /* ---------- Klang (eigene kleine Synthese) ---------- */
  const SND = {
    a: null, out: null,
    init() {
      if (!window.FX_SFX || !window.FX_SFX.on) return false;
      this.a = window.FX_SFX.ac(); if (!this.a) return false;
      const a = this.a;
      this.out = a.createGain(); this.out.gain.value = 0.9;
      // dunkler Hall über Rückkopplungs-Delays
      const d1 = a.createDelay(1), d2 = a.createDelay(1), fb = a.createGain(), lp = a.createBiquadFilter();
      d1.delayTime.value = 0.23; d2.delayTime.value = 0.37; fb.gain.value = 0.45; lp.type = 'lowpass'; lp.frequency.value = 1800;
      this.out.connect(a.destination);
      this.wet = a.createGain(); this.wet.gain.value = 0.55;
      this.wet.connect(d1); d1.connect(lp); lp.connect(d2); d2.connect(fb); fb.connect(d1); lp.connect(a.destination); d2.connect(a.destination);
      return true;
    },
    noise(sec) {
      const a = this.a; const len = Math.floor(a.sampleRate * sec); const b = a.createBuffer(1, len, a.sampleRate); const d = b.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      const s = a.createBufferSource(); s.buffer = b; return s;
    },
    send(node, wet = 0.4) { node.connect(this.out); if (wet) { const g = this.a.createGain(); g.gain.value = wet; node.connect(g); g.connect(this.wet); } },
    drone(dur) {
      const a = this.a; const t = a.currentTime;
      const lp = a.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 4; lp.frequency.setValueAtTime(70, t); lp.frequency.exponentialRampToValueAtTime(520, t + dur * 0.85);
      const g = a.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.32, t + dur * 0.55); g.gain.linearRampToValueAtTime(0.0001, t + dur);
      for (const [f, det] of [[36.7, -7], [36.7, 6], [55, 0], [73.4, 3], [77.8, -4]]) {
        const o = a.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = det;
        o.connect(lp); o.start(t); o.stop(t + dur + 0.1);
      }
      lp.connect(g); this.send(g, 0.3);
    },
    whisper(at, dur, pan = 0) {
      const a = this.a; const t = a.currentTime + at;
      const n = this.noise(dur + 0.2);
      const bp = a.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 9;
      for (let k = 0; k < dur * 9; k++) bp.frequency.setValueAtTime(700 + Math.random() * 2200, t + k / 9);
      const bp2 = a.createBiquadFilter(); bp2.type = 'bandpass'; bp2.Q.value = 5; bp2.frequency.value = 2600;
      const g = a.createGain(); g.gain.setValueAtTime(0.0001, t);
      for (let k = 0; k < dur * 5; k++) g.gain.setTargetAtTime(Math.random() < 0.65 ? 0.09 + Math.random() * 0.08 : 0.004, t + k / 5, 0.04);
      g.gain.setTargetAtTime(0.0001, t + dur, 0.1);
      const p = a.createStereoPanner(); p.pan.value = pan;
      n.connect(bp); bp.connect(bp2); bp2.connect(g); g.connect(p); this.send(p, 0.7);
      n.start(t); n.stop(t + dur + 0.2);
    },
    heart(at) {
      const a = this.a;
      for (const [off, v] of [[0, 0.9], [0.26, 0.6]]) {
        const t = a.currentTime + at + off;
        const o = a.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(70, t); o.frequency.exponentialRampToValueAtTime(36, t + 0.2);
        const g = a.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.015); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.38);
        o.connect(g); this.send(g, 0.15); o.start(t); o.stop(t + 0.4);
      }
    },
    open(at) {
      const a = this.a; const t = a.currentTime + at;
      const n = this.noise(1.8); const hp = a.createBiquadFilter(); hp.type = 'bandpass'; hp.Q.value = 2;
      hp.frequency.setValueAtTime(180, t); hp.frequency.exponentialRampToValueAtTime(5200, t + 1.5);
      const g = a.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.25, t + 1.3); g.gain.linearRampToValueAtTime(0.0001, t + 1.7);
      n.connect(hp); hp.connect(g); this.send(g, 0.6); n.start(t); n.stop(t + 1.8);
      [1174.7, 1396.9, 1760, 2349.3].forEach((f, i) => {
        const o = a.createOscillator(); o.type = 'sine'; o.frequency.value = f; o.detune.value = (Math.random() - 0.5) * 14;
        const og = a.createGain(); const tt = t + 0.6 + i * 0.14;
        og.gain.setValueAtTime(0.0001, tt); og.gain.exponentialRampToValueAtTime(0.06, tt + 0.05); og.gain.exponentialRampToValueAtTime(0.0001, tt + 2.6);
        o.connect(og); this.send(og, 0.9); o.start(tt); o.stop(tt + 2.7);
      });
    },
    boom(at) {
      const a = this.a; const t = a.currentTime + at;
      const o = a.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(62, t); o.frequency.exponentialRampToValueAtTime(24, t + 2.2);
      const g = a.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(1.1, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 3.2);
      o.connect(g); this.send(g, 0.25); o.start(t); o.stop(t + 3.3);
      const n = this.noise(3); const lp = a.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(5000, t); lp.frequency.exponentialRampToValueAtTime(300, t + 2.5);
      const ng = a.createGain(); ng.gain.setValueAtTime(0.5, t); ng.gain.exponentialRampToValueAtTime(0.0001, t + 2.8);
      n.connect(lp); lp.connect(ng); this.send(ng, 0.5); n.start(t); n.stop(t + 3);
    },
    fadeOut() { if (!this.out) return; const t = this.a.currentTime; this.out.gain.cancelScheduledValues(t); this.out.gain.setValueAtTime(this.out.gain.value, t); this.out.gain.linearRampToValueAtTime(0.0001, t + 0.6); }
  };

  const IN = {
    active: false, done: null, skipped: false, motes: null,

    run(onDone) {
      const el = $('#intro');
      // läuft bei jedem Laden der Seite
      if (!el) { onDone && onDone(false); return; }
      this.active = true; this.done = onDone;
      document.documentElement.classList.add('intro-lock');
      $('#intro-lines').innerHTML = LINES.map((t, i) => `<p class="il" data-i="${i}">${[...t].map((ch, k) => ch === ' ' ? ' ' : `<span style="--d:${k}">${ch}</span>`).join('')}</p>`).join('');
      el.classList.add('show', 'gate');
      this.motes = window.FX_SMOKE.create($('#intro-canvas'), { density: 0.45, embers: true, alpha: 0.42, rise: 0.5 });
      this.motes.start();
      const begin = (e) => {
        if (!el.classList.contains('gate')) return;
        e && e.stopPropagation();
        el.classList.remove('gate');
        this.sequence();
      };
      el.addEventListener('click', begin);
      try { el.focus({ preventScroll: true }); } catch (e) { }
      $('#intro-skip').addEventListener('click', (e) => { e.stopPropagation(); this.finish(true); });
      document.addEventListener('keydown', this._key = (e) => { if (!this.active) return; if (e.key === 'Escape') this.finish(true); else if (el.classList.contains('gate') && (e.key === 'Enter' || e.key === ' ')) begin(); });
    },
    wait(ms) { return new Promise(r => setTimeout(r, ms)); },
    async sequence() {
      const el = $('#intro');
      const snd = SND.init();
      if (snd) { SND.drone(15); SND.whisper(1.0, 2.2, -0.6); SND.whisper(3.6, 2.4, 0.5); SND.whisper(6.4, 2.0, -0.3); SND.whisper(8.8, 2.6, 0.6); }
      el.classList.add('play');
      const lines = [...el.querySelectorAll('.il')];
      for (let i = 0; i < lines.length; i++) {
        if (this.skipped) return;
        lines[i].classList.add('on');
        await this.wait(2300);
        lines[i].classList.add('off');
        await this.wait(1000);
      }
      if (this.skipped) return;
      el.classList.add('eye');                     // Lidspalt glimmt auf
      if (snd) { SND.heart(0.2); SND.heart(1.25); SND.heart(2.2); }
      await this.wait(2300);
      if (this.skipped) return;
      el.classList.add('open');                    // Auge öffnet sich
      if (snd) SND.open(0);
      await this.wait(2400);
      if (this.skipped) return;
      el.classList.add('focus');                   // Pupille zieht sich zusammen
      if (snd) SND.heart(0);
      await this.wait(900);
      if (this.skipped) return;
      if (snd) SND.boom(0.05);
      el.classList.add('flash');
      await this.wait(450);
      this.finish(false);
    },
    finish(skip) {
      if (!this.active) return;
      this.active = false; this.skipped = true;
      const el = $('#intro');
      if (skip) SND.fadeOut();
      el.classList.add('leave');
      document.documentElement.classList.remove('intro-lock');
      document.removeEventListener('keydown', this._key);
      const cb = this.done; this.done = null;
      cb && cb();
      setTimeout(() => { this.motes && this.motes.stop(); el.remove(); }, 1600);
    }
  };
  window.FX_INTRO = IN;
})();

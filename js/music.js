/* =========================================================
   FLAGGED – Dark-Fantasy-Soundtrack (live synthetisiert)
   Titel: „Das Auge erwacht“ · Schlacht: „Mauern aus Schatten“ · Endboss: „Der Schattenfürst“
   ========================================================= */
(function () {
  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
  const rnd = (a, b) => a + Math.random() * (b - a);

  // Akkorde in d-Moll (Tonhöhen als MIDI), Bass-Grundton
  const CH = {
    Dm: { n: [50, 53, 57], r: 38 }, Bb: { n: [46, 50, 53], r: 34 }, Gm: { n: [43, 46, 50], r: 31 },
    A: { n: [45, 49, 52], r: 33 }, F: { n: [41, 45, 48], r: 29 }, C: { n: [48, 52, 55], r: 36 },
    Eb: { n: [51, 55, 58], r: 39 }, Am: { n: [45, 48, 52], r: 33 }
  };

  const SONGS = {
    title: {
      bpm: 74, gain: 0.85, loopFrom: 1,
      sections: [
        { name: 'intro', chords: ['Dm', 'Bb', 'Gm', 'A'], drone: 1, wind: 1, choir: 'o', choirV: 0.035, bells: [0, 2] },
        { name: 'build', chords: ['Dm', 'Bb', 'Gm', 'A'], drone: 1, choir: 'a', choirV: 0.04, strings: 0.05, taiko: 'soft', swellLast: 1, timpRollLast: 1 },
        { name: 'main', chords: ['Dm', 'F', 'C', 'Bb', 'Dm', 'Bb', 'C', 'A'], drone: 1, hitFirst: 1, choir: 'a', choirV: 0.05, choirHigh: 1, strings: 0.075, brass: 'melody', bassBrass: 1, taiko: 'full', timp: 1, swellLast: 1 },
        { name: 'break', chords: ['Bb', 'Gm', 'Dm', 'A'], drone: 1, wind: 1, choir: 'u', choirV: 0.045, bells: [0, 2], strings: 0.03, stringsSparse: 1, taikoLast: 1, swellLast: 1 }
      ]
    },
    battle: {
      bpm: 82, gain: 0.5, loopFrom: 0,
      sections: [
        { name: 'pulse', chords: ['Dm', 'Dm', 'Bb', 'A', 'Dm', 'Gm', 'Bb', 'A'], drone: 1, wind: 1, choir: 'o', choirV: 0.022, strings: 0.04, pizz: 1, taiko: 'sparse' },
        { name: 'rise', chords: ['Gm', 'Bb', 'C', 'A'], drone: 1, choir: 'a', choirV: 0.03, strings: 0.05, brass: 'swell', taiko: 'soft', timp: 1, swellLast: 1 },
        { name: 'pulse2', chords: ['Dm', 'F', 'C', 'A', 'Dm', 'Bb', 'Gm', 'A'], drone: 1, choir: 'u', choirV: 0.025, strings: 0.045, pizz: 1, bells: [0], taiko: 'sparse' }
      ]
    },
    boss: {
      bpm: 96, gain: 0.62, loopFrom: 0,
      sections: [
        { name: 'doom', chords: ['Dm', 'Eb', 'Dm', 'A', 'Bb', 'Eb', 'Gm', 'A'], drone: 1, hitFirst: 1, choir: 'a', choirV: 0.035, chant: 1, strings: 0.06, sixteenth: 1, brass: 'stabs', taiko: 'drive', timp: 1, bells: [0] },
        { name: 'chant', chords: ['Dm', 'Eb', 'Bb', 'A'], drone: 1, choir: 'a', choirV: 0.06, choirHigh: 1, strings: 0.05, brass: 'melody2', taiko: 'full', timpRollLast: 1, swellLast: 1 }
      ]
    }
  };

  // Melodien: [Schlag, MIDI, Dauer in Schlägen] pro Takt
  const MELODY = [
    [[0, 62, 2], [2, 65, 1], [3, 64, 1]], [[0, 65, 2], [2, 69, 2]], [[0, 67, 3], [3, 64, 1]], [[0, 62, 4]],
    [[0, 69, 2], [2, 70, 1], [3, 69, 1]], [[0, 65, 2], [2, 62, 2]], [[0, 64, 2], [2, 67, 2]], [[0, 61, 2], [2, 64, 1], [3, 69, 1]]
  ];
  const MELODY2 = [[[0, 62, 1.5], [1.5, 63, 0.5], [2, 62, 2]], [[0, 70, 2], [2, 69, 2]], [[0, 65, 1], [1, 67, 1], [2, 70, 2]], [[0, 69, 3], [3, 61, 1]]];

  const M = {
    ctx: null, on: true, vol: 0.55, mode: null, playing: false, timer: 0,
    nextBar: 0, sec: 0, bar: 0, song: null, nodes: [],

    // Musik ist bei jedem Laden an; der Musik-Knopf schaltet sie für die laufende Sitzung ab
    init() { this.on = true; try { localStorage.removeItem('flagged.music'); } catch (e) { } },
    setup() {
      if (this.ctx) return true;
      const a = window.FX_SFX && window.FX_SFX.ac();
      if (!a) return false;
      this.ctx = a;
      this.out = a.createGain(); this.out.gain.value = 0;
      const comp = a.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 3.2; comp.attack.value = 0.01; comp.release.value = 0.35;
      const warm = a.createBiquadFilter(); warm.type = 'lowshelf'; warm.frequency.value = 180; warm.gain.value = 3;
      this.out.connect(warm); warm.connect(comp); comp.connect(a.destination);
      this.dry = a.createGain(); this.dry.connect(this.out);
      this.verb = a.createConvolver(); this.verb.buffer = this.impulse(4.6);
      this.verbIn = a.createGain(); this.verbIn.gain.value = 1;
      const verbOut = a.createGain(); verbOut.gain.value = 0.85;
      this.verbIn.connect(this.verb); this.verb.connect(verbOut); verbOut.connect(this.out);
      this.noiseBuf = this.makeNoise(2.5);
      return true;
    },
    impulse(sec) {
      const a = this.ctx; const len = Math.floor(a.sampleRate * sec); const b = a.createBuffer(2, len, a.sampleRate);
      for (let c = 0; c < 2; c++) {
        const d = b.getChannelData(c); let lp = 0;
        for (let i = 0; i < len; i++) {
          const t = i / len;
          const early = i < a.sampleRate * 0.08 && Math.random() < 0.004 ? (Math.random() * 2 - 1) * 0.8 : 0;
          const n = (Math.random() * 2 - 1);
          lp = lp + (n - lp) * (0.55 - 0.45 * t);      // wird nach hinten dunkler
          d[i] = (lp * Math.pow(1 - t, 2.6) + early) * 0.9;
        }
      }
      return b;
    },
    makeNoise(sec) {
      const a = this.ctx; const len = Math.floor(a.sampleRate * sec); const b = a.createBuffer(1, len, a.sampleRate); const d = b.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      return b;
    },
    route(node, pan = 0, send = 0.3, level = 1) {
      const a = this.ctx;
      const p = a.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan));
      const g = a.createGain(); g.gain.value = level;
      node.connect(g); g.connect(p); p.connect(this.dry);
      if (send > 0) { const s = a.createGain(); s.gain.value = send; p.connect(s); s.connect(this.verbIn); }
    },

    /* ---------------- Instrumente ---------------- */
    strings(t, m, d, v, pan = 0, pizz = false) {
      const a = this.ctx; const f = mtof(m);
      const g = a.createGain(); const vv = v * rnd(0.85, 1.1);
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vv, t + (pizz ? 0.004 : 0.014));
      if (pizz) g.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
      else { g.gain.exponentialRampToValueAtTime(vv * 0.5, t + 0.14); g.gain.setValueAtTime(vv * 0.5, t + d); g.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.2); }
      const lp = a.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 0.7;
      lp.frequency.setValueAtTime(pizz ? 2600 : 3800, t); lp.frequency.exponentialRampToValueAtTime(pizz ? 700 : 1700, t + (pizz ? 0.25 : 0.16));
      for (const det of [-10, -2, 9]) {
        const o = a.createOscillator(); o.type = pizz ? 'triangle' : 'sawtooth'; o.frequency.value = f; o.detune.value = det + rnd(-3, 3);
        o.connect(lp); o.start(t); o.stop(t + d + 0.5);
      }
      lp.connect(g); this.route(g, pan, pizz ? 0.45 : 0.3);
    },
    choir(t, notes, d, v, vowel = 'a') {
      const a = this.ctx;
      const F = { a: [[800, 1], [1150, 0.5], [2900, 0.12]], o: [[480, 1], [820, 0.4], [2830, 0.06]], u: [[330, 1], [700, 0.3], [2500, 0.04]] }[vowel];
      notes.forEach((m, i) => {
        const f = mtof(m);
        const env = a.createGain();
        env.gain.setValueAtTime(0.0001, t); env.gain.linearRampToValueAtTime(v, t + Math.min(1.3, d * 0.4));
        env.gain.setValueAtTime(v, t + d); env.gain.linearRampToValueAtTime(0.0001, t + d + 1.6);
        const lfo = a.createOscillator(); lfo.frequency.value = rnd(4.6, 5.6); const lg = a.createGain(); lg.gain.value = 7; lfo.connect(lg);
        lfo.start(t); lfo.stop(t + d + 1.8);
        for (const det of [-14, -3, 6, 15]) {
          const o = a.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = det + rnd(-4, 4);
          lg.connect(o.detune);
          o.connect(env); o.start(t); o.stop(t + d + 1.8);
        }
        const sum = a.createGain(); sum.gain.value = 1;
        for (const [ff, gg] of F) {
          const bp = a.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = ff * (m > 60 ? 1.06 : 1); bp.Q.value = 7;
          const bg = a.createGain(); bg.gain.value = gg * 2.2;
          env.connect(bp); bp.connect(bg); bg.connect(sum);
        }
        this.route(sum, (i - (notes.length - 1) / 2) * 0.45, 0.75);
      });
    },
    brass(t, m, d, v, pan = 0) {
      const a = this.ctx; const f = mtof(m);
      const lp = a.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 1.2;
      lp.frequency.setValueAtTime(240, t); lp.frequency.exponentialRampToValueAtTime(1900, t + 0.2); lp.frequency.exponentialRampToValueAtTime(1100, t + Math.max(0.3, d));
      const g = a.createGain();
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.07); g.gain.setValueAtTime(v * 0.85, t + d); g.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.35);
      const vib = a.createOscillator(); vib.frequency.value = 5; const vg = a.createGain(); vg.gain.setValueAtTime(0, t); vg.gain.linearRampToValueAtTime(6, t + 0.5); vib.connect(vg); vib.start(t); vib.stop(t + d + 0.4);
      for (const [mul, det, type] of [[1, -6, 'sawtooth'], [1, 6, 'sawtooth'], [0.5, 0, 'sawtooth'], [1, 0, 'square']]) {
        const o = a.createOscillator(); o.type = type; o.frequency.value = f * mul; o.detune.value = det; vg.connect(o.detune);
        const og = a.createGain(); og.gain.value = type === 'square' ? 0.25 : 0.5;
        o.connect(og); og.connect(lp); o.start(t); o.stop(t + d + 0.4);
      }
      lp.connect(g); this.route(g, pan, 0.4);
    },
    taiko(t, v = 0.8, pitch = 1, pan = 0) {
      const a = this.ctx;
      const o = a.createOscillator(); o.type = 'sine';
      o.frequency.setValueAtTime(130 * pitch, t); o.frequency.exponentialRampToValueAtTime(44 * pitch, t + 0.32);
      const g = a.createGain(); g.gain.setValueAtTime(v * 1.2, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.0);
      o.connect(g); o.start(t); o.stop(t + 1.1);
      const n = a.createBufferSource(); n.buffer = this.noiseBuf;
      const lp = a.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1100;
      const ng = a.createGain(); ng.gain.setValueAtTime(v * 0.55, t); ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
      n.connect(lp); lp.connect(ng); n.start(t, rnd(0, 1.5)); n.stop(t + 0.25);
      const mix = a.createGain(); g.connect(mix); ng.connect(mix);
      this.route(mix, pan, 0.42);
    },
    timp(t, m, v = 0.5) {
      const a = this.ctx; const f = mtof(m);
      const mix = a.createGain();
      for (const [mul, gv, dec] of [[1, 1, 2.2], [1.5, 0.35, 1.2], [1.98, 0.2, 0.8]]) {
        const o = a.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(f * mul * 1.02, t); o.frequency.exponentialRampToValueAtTime(f * mul, t + 0.15);
        const g = a.createGain(); g.gain.setValueAtTime(v * gv, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dec);
        o.connect(g); g.connect(mix); o.start(t); o.stop(t + dec + 0.1);
      }
      const n = a.createBufferSource(); n.buffer = this.noiseBuf; const bp = a.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 600; bp.Q.value = 0.8;
      const ng = a.createGain(); ng.gain.setValueAtTime(v * 0.3, t); ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
      n.connect(bp); bp.connect(ng); ng.connect(mix); n.start(t, rnd(0, 2)); n.stop(t + 0.1);
      this.route(mix, -0.15, 0.45);
    },
    bell(t, m, v = 0.12) {
      const a = this.ctx; const f = mtof(m); const mix = a.createGain();
      for (const [mul, gv, dec] of [[0.5, 0.6, 6], [1, 1, 5], [2.0, 0.5, 3], [2.76, 0.45, 2.4], [5.4, 0.22, 1.4], [8.93, 0.1, 0.9]]) {
        const o = a.createOscillator(); o.type = 'sine'; o.frequency.value = f * mul;
        const g = a.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v * gv, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t + dec);
        o.connect(g); g.connect(mix); o.start(t); o.stop(t + dec + 0.1);
      }
      this.route(mix, 0.25, 0.9);
    },
    swell(t, dur, v = 0.12) {
      const a = this.ctx;
      const n = a.createBufferSource(); n.buffer = this.noiseBuf; n.loop = true;
      const hp = a.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.setValueAtTime(5000, t); hp.frequency.exponentialRampToValueAtTime(900, t + dur);
      const g = a.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + dur * 0.97); g.gain.linearRampToValueAtTime(0.0001, t + dur);
      n.connect(hp); hp.connect(g); n.start(t); n.stop(t + dur + 0.05);
      this.route(g, 0, 0.6);
    },
    hit(t, v = 0.9) {
      const a = this.ctx;
      this.taiko(t, v, 0.8); this.taiko(t + 0.012, v * 0.7, 1.15, 0.3);
      const o = a.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(58, t); o.frequency.exponentialRampToValueAtTime(29, t + 1.4);
      const g = a.createGain(); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 2.4);
      o.connect(g); o.start(t); o.stop(t + 2.5); this.route(g, 0, 0.3);
      const n = a.createBufferSource(); n.buffer = this.noiseBuf; const hp = a.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 2500;
      const ng = a.createGain(); ng.gain.setValueAtTime(v * 0.22, t); ng.gain.exponentialRampToValueAtTime(0.0001, t + 2.8);
      n.connect(hp); hp.connect(ng); n.start(t); n.stop(t + 2.9); this.route(ng, 0, 0.9);
    },
    drone(t, d, root, v = 0.07) {
      const a = this.ctx;
      const lp = a.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 170; lp.Q.value = 0.9;
      const g = a.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + Math.min(2, d * 0.4)); g.gain.setValueAtTime(v, t + d); g.gain.linearRampToValueAtTime(0.0001, t + d + 1.5);
      for (const [m, type, gv] of [[root - 12, 'sawtooth', 0.7], [root, 'sawtooth', 0.5], [root - 12, 'sine', 1], [root + 7 - 12, 'sawtooth', 0.25]]) {
        const o = a.createOscillator(); o.type = type; o.frequency.value = mtof(m); o.detune.value = rnd(-6, 6);
        const og = a.createGain(); og.gain.value = gv; o.connect(og); og.connect(lp); o.start(t); o.stop(t + d + 1.6);
      }
      lp.connect(g); this.route(g, 0, 0.25);
    },
    wind(t, d, v = 0.03) {
      const a = this.ctx;
      const n = a.createBufferSource(); n.buffer = this.noiseBuf; n.loop = true;
      const bp = a.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 0.9; bp.frequency.value = 520;
      const lfo = a.createOscillator(); lfo.frequency.value = rnd(0.06, 0.12); const lg = a.createGain(); lg.gain.value = 320; lfo.connect(lg); lg.connect(bp.frequency);
      const g = a.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + 2.5); g.gain.setValueAtTime(v, t + d); g.gain.linearRampToValueAtTime(0.0001, t + d + 2);
      n.connect(bp); bp.connect(g); n.start(t); n.stop(t + d + 2.1); lfo.start(t); lfo.stop(t + d + 2.1);
      this.route(g, rnd(-0.5, 0.5), 0.4);
    },

    /* ---------------- Sequenzer ---------------- */
    scheduleBar(t0, sec, bi) {
      const S = this.song; const beat = 60 / S.bpm; const barDur = beat * 4;
      const ch = CH[sec.chords[bi]]; const last = bi === sec.chords.length - 1;
      const hum = () => rnd(-0.008, 0.008);
      if (sec.drone && bi % 2 === 0) this.drone(t0, barDur * 2 - 0.2, ch.r + 12 > 45 ? ch.r : ch.r + 12, 0.06);
      if (sec.wind && bi === 0) this.wind(t0, barDur * sec.chords.length);
      if (sec.hitFirst && bi === 0) this.hit(t0, 0.85);
      if (sec.bells && sec.bells.includes(bi)) { this.bell(t0, ch.r + 12, 0.11); this.bell(t0 + beat * 2, ch.r + 19, 0.07); }
      if (sec.choir) {
        const notes = sec.choirHigh ? ch.n.map(m => m + 12) : ch.n;
        if (sec.chant) { this.choir(t0, notes, beat * 1.2, sec.choirV, 'a'); this.choir(t0 + beat * 2, notes, beat * 1.2, sec.choirV * 0.8, 'o'); }
        else this.choir(t0, notes, barDur * 0.98, sec.choirV, sec.choir);
      }
      if (sec.strings) {
        const tones = ch.n.map(m => m + 12);
        const pat = sec.sixteenth ? [0, 0, 2, 0, 1, 0, 2, 0, 0, 0, 2, 0, 1, 0, 2, 1] : [0, 0, 2, 0, 1, 0, 2, 1];
        const step = barDur / pat.length;
        pat.forEach((k, i) => {
          if (sec.stringsSparse && i % 2) return;
          const acc = i % (pat.length / 2) === 0 ? 1.35 : 1;
          this.strings(t0 + i * step + hum(), tones[k] + (k === 0 && i % 4 === 2 ? 12 : 0), step * 0.85, sec.strings * acc, (k - 1) * 0.35, !!sec.pizz);
        });
        // Celli/Bässe
        this.strings(t0 + hum(), ch.r + 12, barDur * 0.48, sec.strings * 0.9, -0.2, !!sec.pizz);
        this.strings(t0 + barDur / 2 + hum(), ch.r + 12, barDur * 0.48, sec.strings * 0.75, -0.2, !!sec.pizz);
      }
      if (sec.brass === 'melody' || sec.brass === 'melody2') {
        const mel = sec.brass === 'melody' ? MELODY : MELODY2;
        for (const [b, m, d] of mel[bi % mel.length]) {
          this.brass(t0 + b * beat + hum(), m - 12, d * beat * 0.95, 0.07, 0.15);
          this.brass(t0 + b * beat + hum(), m, d * beat * 0.95, 0.035, -0.15);
        }
      } else if (sec.brass === 'swell') {
        this.brass(t0, ch.r + 12, barDur * 0.9, 0.06, 0);
        this.brass(t0, ch.n[2] - 12, barDur * 0.9, 0.04, 0.2);
      } else if (sec.brass === 'stabs') {
        for (const b of [0, 1.5, 3]) this.brass(t0 + b * beat, ch.r + 12, beat * 0.6, 0.08, 0);
      }
      if (sec.bassBrass) { this.brass(t0, ch.r, beat * 1.9, 0.07, 0); this.brass(t0 + beat * 2, ch.r, beat * 1.9, 0.06, 0); }
      const tk = sec.taiko;
      if (tk === 'soft') { this.taiko(t0, 0.5); this.taiko(t0 + beat * 2, 0.4, 1.1, 0.2); }
      else if (tk === 'sparse') { if (bi % 2 === 0) this.taiko(t0, 0.45); if (bi % 4 === 3) this.taiko(t0 + beat * 3.5, 0.3, 1.2, 0.3); }
      else if (tk === 'full') { [[0, 0.95], [1.5, 0.5], [2, 0.8], [3, 0.6], [3.5, 0.4], [3.75, 0.35]].forEach(([b, v], i) => this.taiko(t0 + b * beat + hum(), v, i % 2 ? 1.25 : 1, i % 2 ? 0.35 : -0.25)); }
      else if (tk === 'drive') { for (let i = 0; i < 8; i++) this.taiko(t0 + i * beat / 2 + hum(), i % 4 === 0 ? 0.95 : i % 2 ? 0.35 : 0.55, i % 2 ? 1.3 : 1, i % 2 ? 0.3 : -0.3); }
      if (sec.taikoLast && last) { this.taiko(t0 + beat * 2, 0.8); this.taiko(t0 + beat * 3, 0.9, 0.9); }
      if (sec.timp) this.timp(t0, ch.r, 0.42);
      if (sec.timpRollLast && last) for (let i = 0; i < 16; i++) this.timp(t0 + i * beat / 4, 38, 0.1 + i * 0.025);
      if (sec.swellLast && last) this.swell(t0 + beat, barDur - beat, 0.1);
    },
    tick() {
      if (!this.playing || !this.ctx) return;
      const now = this.ctx.currentTime;
      while (this.nextBar < now + 1.2) {
        const S = this.song; const sec = S.sections[this.sec];
        this.scheduleBar(this.nextBar, sec, this.bar);
        this.nextBar += 60 / S.bpm * 4;
        this.bar++;
        if (this.bar >= sec.chords.length) { this.bar = 0; this.sec++; if (this.sec >= S.sections.length) this.sec = S.loopFrom; }
      }
    },
    play(mode) {
      if (!this.on) { this.mode = mode; return; }
      if (!this.setup()) return;
      const a = this.ctx;
      if (this.playing && this.mode === mode) return;
      const fadeOut = this.playing;
      this.mode = mode; this.song = SONGS[mode];
      const t = a.currentTime;
      this.out.gain.cancelScheduledValues(t);
      if (fadeOut) {
        this.out.gain.setValueAtTime(this.out.gain.value, t); this.out.gain.linearRampToValueAtTime(0.0001, t + 1.2);
        this.nextBar = t + 1.3;
        this.out.gain.linearRampToValueAtTime(this.vol * this.song.gain, t + 3);
      } else {
        this.out.gain.setValueAtTime(0.0001, t); this.out.gain.linearRampToValueAtTime(this.vol * this.song.gain, t + 2.5);
        this.nextBar = t + 0.15;
      }
      this.sec = 0; this.bar = 0; this.playing = true;
      clearInterval(this.timer);
      this.timer = setInterval(() => this.tick(), 250);
      this.tick();
    },
    stop() {
      if (!this.ctx) return;
      const t = this.ctx.currentTime;
      this.out.gain.cancelScheduledValues(t); this.out.gain.setValueAtTime(this.out.gain.value, t); this.out.gain.linearRampToValueAtTime(0.0001, t + 1);
      this.playing = false; clearInterval(this.timer);
    },
    toggle() {
      this.on = !this.on;
      if (this.on) { const m = this.mode || 'title'; this.mode = null; this.play(m); } else this.stop();
      return this.on;
    }
  };
  M.init();
  window.FX_MUSIC = M;
})();

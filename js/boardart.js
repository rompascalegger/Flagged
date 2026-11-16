/* =========================================================
   FLAGGED – prozedural gemaltes Schlachtfeld
   ========================================================= */
(function () {
  // Gradient-Noise
  function makeNoise(seed) {
    const perm = new Uint8Array(512);
    const p = new Uint8Array(256);
    let s = seed >>> 0;
    const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
    for (let i = 0; i < 256; i++) p[i] = i;
    for (let i = 255; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; }
    for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
    const grad = (h, x, y) => { const g = h & 7; const u = g < 4 ? x : y, v = g < 4 ? y : x; return ((g & 1) ? -u : u) + ((g & 2) ? -2 * v : 2 * v); };
    const fade = t => t * t * t * (t * (t * 6 - 15) + 10);
    function noise(x, y) {
      const X = Math.floor(x) & 255, Y = Math.floor(y) & 255;
      x -= Math.floor(x); y -= Math.floor(y);
      const u = fade(x), v = fade(y);
      const a = perm[X] + Y, b = perm[X + 1] + Y;
      const l1 = grad(perm[a], x, y) + u * (grad(perm[b], x - 1, y) - grad(perm[a], x, y));
      const l2 = grad(perm[a + 1], x, y - 1) + u * (grad(perm[b + 1], x - 1, y - 1) - grad(perm[a + 1], x, y - 1));
      return (l1 + v * (l2 - l1)) * 0.25;
    }
    function fbm(x, y, oct = 5) { let a = 0, f = 1, amp = 0.5; for (let i = 0; i < oct; i++) { a += amp * noise(x * f, y * f); f *= 2.03; amp *= 0.5; } return a; }
    return { noise, fbm, rnd };
  }

  const mix = (a, b, t) => a + (b - a) * t;
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  const smooth = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0)); return t * t * (3 - 2 * t); };

  function paint(size = 900, seed = 7) {
    const cv = document.createElement('canvas');
    cv.width = cv.height = size;
    const ctx = cv.getContext('2d');
    const img = ctx.createImageData(size, size);
    const { fbm, noise } = makeNoise(seed);
    const S = size;
    // Bachverlauf: Kurve von oben rechts nach unten links
    const river = (t) => ({ x: mix(0.86, 0.1, t) + 0.07 * Math.sin(t * 6.2 + 1.3), y: mix(-0.05, 1.05, t) + 0.03 * Math.sin(t * 9) });
    const riverPts = []; for (let i = 0; i <= 200; i++) riverPts.push(river(i / 200));
    const pathPts = []; for (let i = 0; i <= 200; i++) { const t = i / 200; pathPts.push({ x: 0.5 + 0.12 * Math.sin(t * 5.2 + 0.4) + 0.05 * Math.sin(t * 13), y: t }); }
    const distTo = (pts, x, y) => { let m = 9; for (let i = 0; i < pts.length; i += 2) { const dx = pts[i].x - x, dy = pts[i].y - y; const d = dx * dx + dy * dy; if (d < m) m = d; } return Math.sqrt(m); };
    // grobe Distanz-Lookup-Tabelle für Geschwindigkeit
    const G = 160, rD = new Float32Array(G * G), pD = new Float32Array(G * G);
    for (let j = 0; j < G; j++) for (let i = 0; i < G; i++) { rD[j * G + i] = distTo(riverPts, i / G, j / G); pD[j * G + i] = distTo(pathPts, i / G, j / G); }
    const look = (arr, x, y) => { const i = clamp(Math.floor(x * G), 0, G - 1), j = clamp(Math.floor(y * G), 0, G - 1); return arr[j * G + i]; };

    for (let py = 0; py < S; py++) {
      for (let px = 0; px < S; px++) {
        const x = px / S, y = py / S;
        const n = fbm(x * 6, y * 6);
        const n2 = fbm(x * 22 + 10, y * 22 + 5, 3);
        const n3 = noise(x * 70, y * 70);
        // Grundboden: Moos & Erde
        const moss = smooth(-0.15, 0.35, n + 0.1);
        let r = mix(58, 46, moss), g = mix(46, 66, moss), b = mix(30, 28, moss);
        // helle Grasflecken
        const grass = smooth(0.15, 0.45, n2);
        r = mix(r, 92, grass * 0.35); g = mix(g, 104, grass * 0.45); b = mix(b, 44, grass * 0.3);
        // Steinpfad
        const pd = look(pD, x, y) + n * 0.03;
        const path = 1 - smooth(0.035, 0.07, pd);
        if (path > 0) {
          const cob = 0.5 + 0.5 * Math.sin(px * 0.21 + n3 * 3) * Math.sin(py * 0.19 + n2 * 4);
          const sr = mix(92, 128, cob), sg = mix(88, 120, cob), sb = mix(80, 106, cob);
          r = mix(r, sr, path); g = mix(g, sg, path); b = mix(b, sb, path);
        }
        // Bach
        const rd = look(rD, x, y) + n * 0.035;
        const water = 1 - smooth(0.03, 0.055, rd);
        const bank = (1 - smooth(0.05, 0.085, rd)) - water;
        if (bank > 0) { r = mix(r, 70, bank * 0.6); g = mix(g, 70, bank * 0.6); b = mix(b, 66, bank * 0.6); }
        if (water > 0) {
          const foam = smooth(0.55, 0.9, noise(x * 40 + y * 30, y * 12) * 0.5 + 0.5 + n3 * 0.3);
          const wr = mix(28, 170, foam), wg = mix(52, 200, foam), wb = mix(70, 215, foam);
          r = mix(r, wr, water); g = mix(g, wg, water); b = mix(b, wb, water);
        }
        // feine Körnung
        const grain = n3 * 14;
        r += grain; g += grain; b += grain * 0.8;
        // Schachbrettschattierung
        const cx = Math.floor(x * 8), cy = Math.floor(y * 8);
        const dark = ((cx + cy) & 1) ? 0.86 : 1.0;
        r *= dark; g *= dark; b *= dark;
        // Vignette & Nebelrand
        const vx = x - 0.5, vy = y - 0.5;
        const vig = 1 - smooth(0.36, 0.72, Math.sqrt(vx * vx + vy * vy));
        r *= mix(0.55, 1.05, vig); g *= mix(0.55, 1.05, vig); b *= mix(0.6, 1.05, vig);
        const edge = Math.min(x, y, 1 - x, 1 - y);
        const fog = edge < 0.07 ? (1 - smooth(0, 0.07, edge)) * (0.55 + 0.45 * smooth(-0.2, 0.4, fbm(x * 8 + 3, y * 8, 3))) : 0;
        r = mix(r, 150, fog * 0.55); g = mix(g, 152, fog * 0.55); b = mix(b, 160, fog * 0.55);
        const i = (py * S + px) * 4;
        img.data[i] = clamp(r, 0, 255); img.data[i + 1] = clamp(g, 0, 255); img.data[i + 2] = clamp(b, 0, 255); img.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);

    // Felsbrocken & Ruinenreste
    const { rnd } = makeNoise(seed + 99);
    for (let k = 0; k < 46; k++) {
      const x = rnd() * S, y = rnd() * S, rr = 3 + rnd() * 9;
      const gr = ctx.createRadialGradient(x - rr * 0.3, y - rr * 0.4, 1, x, y, rr);
      gr.addColorStop(0, 'rgba(170,168,160,0.9)'); gr.addColorStop(0.6, 'rgba(90,88,82,0.9)'); gr.addColorStop(1, 'rgba(20,20,18,0)');
      ctx.fillStyle = gr; ctx.beginPath(); ctx.ellipse(x, y, rr, rr * 0.75, rnd() * 3, 0, Math.PI * 2); ctx.fill();
    }
    // Lagerfeuer-Glühen
    for (let k = 0; k < 7; k++) {
      const x = (0.08 + rnd() * 0.84) * S, y = (0.08 + rnd() * 0.84) * S;
      const gr = ctx.createRadialGradient(x, y, 0, x, y, S * 0.05);
      gr.addColorStop(0, 'rgba(255,170,60,0.55)'); gr.addColorStop(0.3, 'rgba(255,110,30,0.18)'); gr.addColorStop(1, 'rgba(255,90,20,0)');
      ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = gr; ctx.fillRect(x - S * 0.06, y - S * 0.06, S * 0.12, S * 0.12);
      ctx.globalCompositeOperation = 'source-over';
    }
    // Rasterlinien mit Sternmarken (wie das Spielbrett im Regelbuch)
    const cell = S / 8;
    ctx.strokeStyle = 'rgba(255,236,200,0.16)'; ctx.lineWidth = Math.max(1, S / 700);
    for (let i = 1; i < 8; i++) {
      ctx.beginPath(); ctx.moveTo(i * cell, 0); ctx.lineTo(i * cell, S); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i * cell); ctx.lineTo(S, i * cell); ctx.stroke();
    }
    for (const [i, j] of [[2, 2], [6, 2], [2, 6], [6, 6], [4, 4]]) {
      const x = i * cell, y = j * cell, r = cell * 0.18;
      ctx.save(); ctx.translate(x, y);
      ctx.fillStyle = 'rgba(255,245,220,0.55)';
      ctx.beginPath();
      for (let a = 0; a < 8; a++) { const ang = a * Math.PI / 4; const rr = a % 2 ? r * 0.18 : r; ctx.lineTo(Math.cos(ang) * rr, Math.sin(ang) * rr); }
      ctx.closePath(); ctx.fill(); ctx.restore();
    }
    return cv;
  }

  let cached = null;
  window.FX_BOARDART = {
    get(size) { if (!cached) cached = paint(size || 760); return cached; }
  };
})();

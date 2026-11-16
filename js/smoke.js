/* =========================================================
   FLAGGED – Rauch- und Glut-Partikelsystem (Logo & Atmosphäre)
   ========================================================= */
(function () {
  const rand = (a, b) => a + Math.random() * (b - a);

  function makeSprite(tint, size = 256, seed = 1) {
    const c = document.createElement('canvas'); c.width = c.height = size;
    const x = c.getContext('2d');
    let s = seed * 9301 + 49297;
    const r = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
    for (let i = 0; i < 26; i++) {
      const px = size * (0.3 + r() * 0.4), py = size * (0.3 + r() * 0.4), rr = size * (0.12 + r() * 0.26);
      const g = x.createRadialGradient(px, py, 0, px, py, rr);
      g.addColorStop(0, `rgba(${tint},${0.10 + r() * 0.12})`);
      g.addColorStop(0.55, `rgba(${tint},${0.04 + r() * 0.05})`);
      g.addColorStop(1, `rgba(${tint},0)`);
      x.fillStyle = g; x.fillRect(0, 0, size, size);
    }
    // weiche Maske
    x.globalCompositeOperation = 'destination-in';
    const m = x.createRadialGradient(size / 2, size / 2, size * 0.1, size / 2, size / 2, size / 2);
    m.addColorStop(0, 'rgba(0,0,0,1)'); m.addColorStop(0.7, 'rgba(0,0,0,.7)'); m.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = m; x.fillRect(0, 0, size, size);
    return c;
  }
  function makeEmber() {
    const c = document.createElement('canvas'); c.width = c.height = 32;
    const x = c.getContext('2d');
    const g = x.createRadialGradient(16, 16, 0, 16, 16, 16);
    g.addColorStop(0, 'rgba(255,250,220,1)'); g.addColorStop(0.18, 'rgba(255,190,90,.95)');
    g.addColorStop(0.45, 'rgba(255,90,20,.35)'); g.addColorStop(1, 'rgba(255,60,0,0)');
    x.fillStyle = g; x.fillRect(0, 0, 32, 32);
    return c;
  }

  function create(canvas, opts = {}) {
    const ctx = canvas.getContext('2d');
    const sprites = [makeSprite('200,206,222', 256, 3), makeSprite('150,156,172', 256, 7), makeSprite('230,226,214', 256, 11)];
    const ember = makeEmber();
    const P = [], E = [];
    let W = 0, H = 0, dpr = 1, running = false, raf = 0, last = 0, t0 = performance.now();
    const mouse = { x: -9999, y: -9999 };
    const o = Object.assign({ density: 1, embers: true, rise: 1, logoRect: null, front: false, alpha: 1 }, opts);

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      W = canvas.clientWidth; H = canvas.clientHeight;
      canvas.width = Math.max(1, W * dpr); canvas.height = Math.max(1, H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    function spawn(kind, x, y, extra = {}) {
      const big = kind === 'floor' || kind === 'front';
      const p = {
        x, y, vx: rand(-0.15, 0.15) * (big ? 1.5 : 1), vy: -rand(0.15, 0.55) * o.rise,
        r: big ? rand(H * 0.12, H * 0.32) : rand(18, 60), grow: big ? rand(0.05, 0.16) : rand(0.18, 0.42),
        rot: rand(0, 6.28), vr: rand(-0.004, 0.004), life: 0, max: big ? rand(9, 16) : rand(3.5, 7.5),
        a: big ? rand(0.25, 0.55) : rand(0.35, 0.8), s: sprites[(Math.random() * sprites.length) | 0], ...extra
      };
      P.push(p);
      return p;
    }
    function spawnEmber(x, y) {
      E.push({ x, y, vx: rand(-0.3, 0.3), vy: -rand(0.4, 1.4), life: 0, max: rand(2.5, 6), s: rand(2, 5.5), ph: rand(0, 6.28), fl: rand(4, 11) });
    }
    function burst(cx, cy, n = 70, power = 3) {
      for (let i = 0; i < n; i++) {
        const a = rand(0, Math.PI * 2), sp = rand(0.4, power);
        spawn('burst', cx + Math.cos(a) * 20, cy + Math.sin(a) * 10, { vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.5 - 0.3, r: rand(30, 90), grow: rand(0.5, 1.1), max: rand(3, 6), a: rand(0.4, 0.85), drag: 0.975 });
      }
      for (let i = 0; i < n / 2; i++) spawnEmber(cx + rand(-80, 80), cy + rand(-20, 20));
    }
    function step(dt) {
      const t = (performance.now() - t0) / 1000;
      // Bodenrauch
      const target = Math.round((o.front ? 7 : 22) * o.density);
      const floorCount = P.filter(p => p.kind === 'floor').length;
      if (floorCount < target && Math.random() < 0.35) {
        const p = spawn(o.front ? 'front' : 'floor', rand(-0.1, 1.1) * W, H + rand(0, H * 0.15));
        p.kind = 'floor';
        if (o.front) { p.y = rand(0.2, 1.05) * H; p.vx = rand(0.15, 0.45) * (Math.random() < 0.5 ? -1 : 1); p.vy = -rand(0.02, 0.1); p.a *= 0.55; }
      }
      // Rauch aus dem Logo
      if (o.logoRect && !o.front) {
        const r = o.logoRect();
        if (r && r.width) {
          for (let n = 0; n < 2; n++) if (Math.random() < 0.95 * o.density) {
            const p = spawn('logo', rand(r.left + r.width * 0.02, r.right - r.width * 0.02), rand(r.top + r.height * 0.1, r.top + r.height * 0.6));
            p.vy = -rand(0.45, 1.15); p.vx = rand(-0.25, 0.25); p.r = rand(18, 56); p.grow = rand(0.3, 0.6); p.max = rand(2.8, 5.5); p.a = rand(0.28, 0.62); p.kind = 'logo';
          }
        }
        if (o.embers && Math.random() < 0.6) spawnEmber(rand(r.left, r.right), r.bottom - rand(0, r.height * 0.5));
      }
      if (o.embers && !o.logoRect && Math.random() < 0.25 * o.density) spawnEmber(rand(0, W), H + 10);
      const k = dt * 60;
      for (let i = P.length - 1; i >= 0; i--) {
        const p = P[i];
        p.life += dt;
        const sway = Math.sin(t * 0.7 + p.rot * 3) * 0.12;
        if (p.drag) { p.vx *= Math.pow(p.drag, k); p.vy = p.vy * Math.pow(p.drag, k) - 0.004 * k; }
        // Maus verdrängt den Rauch
        const dx = p.x - mouse.x, dy = p.y - mouse.y, d2 = dx * dx + dy * dy;
        if (d2 < 22000) { const f = (1 - d2 / 22000) * 0.9; p.vx += dx / Math.sqrt(d2 + 1) * f * 0.2; p.vy += dy / Math.sqrt(d2 + 1) * f * 0.2; }
        p.x += (p.vx + sway) * k; p.y += p.vy * k;
        p.r += p.grow * k; p.rot += p.vr * k;
        if (p.life > p.max) P.splice(i, 1);
      }
      for (let i = E.length - 1; i >= 0; i--) {
        const e = E[i]; e.life += dt;
        e.x += (e.vx + Math.sin(t * 2 + e.ph) * 0.35) * k; e.y += e.vy * k; e.vy -= 0.002 * k;
        if (e.life > e.max) E.splice(i, 1);
      }
    }
    function draw() {
      ctx.clearRect(0, 0, W, H);
      const t = (performance.now() - t0) / 1000;
      for (const p of P) {
        const lf = p.life / p.max;
        const fade = Math.min(1, p.life / 0.8) * (1 - lf * lf);
        ctx.globalAlpha = Math.max(0, p.a * fade * o.alpha);
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        ctx.drawImage(p.s, -p.r, -p.r, p.r * 2, p.r * 2);
        ctx.restore();
      }
      ctx.globalCompositeOperation = 'lighter';
      for (const e of E) {
        const lf = e.life / e.max;
        const fl = 0.55 + 0.45 * Math.sin(t * e.fl + e.ph);
        ctx.globalAlpha = Math.max(0, (1 - lf) * fl);
        const s = e.s * (1.4 - lf * 0.6) * 3;
        ctx.drawImage(ember, e.x - s / 2, e.y - s / 2, s, s);
      }
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
    }
    function loop(now) {
      if (!running) return;
      const dt = Math.min(0.05, (now - last) / 1000 || 0.016); last = now;
      step(dt); draw();
      raf = requestAnimationFrame(loop);
    }
    function start() {
      if (running) return; running = true; resize(); last = performance.now();
      // Vorlauf, damit sofort Rauch vorhanden ist
      if (!P.length) for (let i = 0; i < 120; i++) step(0.05);
      raf = requestAnimationFrame(loop);
    }
    function stop() { running = false; cancelAnimationFrame(raf); }
    window.addEventListener('resize', () => running && resize());
    window.addEventListener('pointermove', (e) => { const r = canvas.getBoundingClientRect(); mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top; });
    return { start, stop, burst, resize, opts: o };
  }

  window.FX_SMOKE = { create };
})();

/* CRYPTO-RUN signal arcade — no external dependencies.
 * Query params:  ?t=3.5      freeze the animation at t seconds (used by snapshots)
 *                ?limit=3    show at most N coins per light group
 *                ?compact=1  hide the summary/portfolio panels (GIF capture)
 *                ?data=sample  show the built-in SAMPLE set (all three states)
 */
(function () {
  "use strict";
  const Q = new URLSearchParams(location.search);
  const FROZEN = Q.has("t") ? parseFloat(Q.get("t")) || 0 : null;
  const DATA_FILE = Q.get("data") === "sample" ? "sample_data" : "data";
  const LIMIT = Q.has("limit") ? Math.max(1, parseInt(Q.get("limit"), 10) || 3) : null;
  if (Q.get("compact") === "1") document.documentElement.classList.add("compact");
  if (FROZEN != null || Q.has("still")) document.documentElement.classList.add("frozen");
  const REDUCED = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  const PX = 2;               // CSS pixels per "game pixel" (chunky arcade look)
  const LANE_H = 44;          // lane height in game pixels (88 CSS px)
  const C = {
    pac: "#ffff00", eye: "#ffffff", pupil: "#2121ff",
    ghosts: ["#ff0000", "#ffb8ff", "#00ffff", "#ffb852"],           // YELLOW: classic wanderers
    hunters: ["#2121ff", "#3d6bff", "#5a3dff", "#1f8fff"],         // RED: blue ghosts chasing us
    scared: "#f4f4ff", scaredAlt: "#a8ffbf", scaredFace: "#ff2a6d", // GREEN: pale scared ghosts
  };
  // per-light lane theme: maze walls, glow, dots, ticker letters
  const THEME = {
    GREEN:  { wall: "#2bff6a", glow: "rgba(43,255,106,.35)", dot: "#d8ffe0", letter: "#ffffff", eaten: "rgba(43,255,106,.7)" },
    YELLOW: { wall: "#ffd400", glow: "rgba(255,212,0,.33)",  dot: "#ffb8ae", letter: "#fff4c8", eaten: "rgba(255,190,0,.75)" },
    RED:    { wall: "#ff3b3b", glow: "rgba(255,59,59,.38)",  dot: "#ffd0c8", letter: "#ffffff", eaten: "rgba(255,80,80,.75)" },
  };
  const ORDER = { GREEN: 0, YELLOW: 1, RED: 2 };
  const STATE_TXT = { GREEN: "POWER UP! CHASE", YELLOW: "NORMAL PLAY", RED: "RUN! GHOSTS!" };
  const GROUP_TXT = { GREEN: "POWER MODE", YELLOW: "NORMAL PLAY", RED: "GHOST ATTACK" };

  // 5x7 pixel font for tickers (rows top->bottom, '#' = pellet)
  const FONT = {
    A: [".###.", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
    B: ["####.", "#...#", "#...#", "####.", "#...#", "#...#", "####."],
    C: [".###.", "#...#", "#....", "#....", "#....", "#...#", ".###."],
    D: ["####.", "#...#", "#...#", "#...#", "#...#", "#...#", "####."],
    E: ["#####", "#....", "#....", "####.", "#....", "#....", "#####"],
    F: ["#####", "#....", "#....", "####.", "#....", "#....", "#...."],
    G: [".###.", "#...#", "#....", "#.###", "#...#", "#...#", ".####"],
    H: ["#...#", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
    I: [".###.", "..#..", "..#..", "..#..", "..#..", "..#..", ".###."],
    J: ["..###", "...#.", "...#.", "...#.", "...#.", "#..#.", ".##.."],
    K: ["#...#", "#..#.", "#.#..", "##...", "#.#..", "#..#.", "#...#"],
    L: ["#....", "#....", "#....", "#....", "#....", "#....", "#####"],
    M: ["#...#", "##.##", "#.#.#", "#.#.#", "#...#", "#...#", "#...#"],
    N: ["#...#", "#...#", "##..#", "#.#.#", "#..##", "#...#", "#...#"],
    O: [".###.", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
    P: ["####.", "#...#", "#...#", "####.", "#....", "#....", "#...."],
    Q: [".###.", "#...#", "#...#", "#...#", "#.#.#", "#..#.", ".##.#"],
    R: ["####.", "#...#", "#...#", "####.", "#.#..", "#..#.", "#...#"],
    S: [".####", "#....", "#....", ".###.", "....#", "....#", "####."],
    T: ["#####", "..#..", "..#..", "..#..", "..#..", "..#..", "..#.."],
    U: ["#...#", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
    V: ["#...#", "#...#", "#...#", "#...#", "#...#", ".#.#.", "..#.."],
    W: ["#...#", "#...#", "#...#", "#.#.#", "#.#.#", "#.#.#", ".#.#."],
    X: ["#...#", "#...#", ".#.#.", "..#..", ".#.#.", "#...#", "#...#"],
    Y: ["#...#", "#...#", ".#.#.", "..#..", "..#..", "..#..", "..#.."],
    Z: ["#####", "....#", "...#.", "..#..", ".#...", "#....", "#####"],
    0: [".###.", "#...#", "#..##", "#.#.#", "##..#", "#...#", ".###."],
    1: ["..#..", ".##..", "..#..", "..#..", "..#..", "..#..", ".###."],
    2: [".###.", "#...#", "....#", "...#.", "..#..", ".#...", "#####"],
    3: ["####.", "....#", "....#", ".###.", "....#", "....#", "####."],
    4: ["...#.", "..##.", ".#.#.", "#..#.", "#####", "...#.", "...#."],
    5: ["#####", "#....", "####.", "....#", "....#", "#...#", ".###."],
    6: [".###.", "#....", "#....", "####.", "#...#", "#...#", ".###."],
    7: ["#####", "....#", "...#.", "..#..", ".#...", ".#...", ".#..."],
    8: [".###.", "#...#", "#...#", ".###.", "#...#", "#...#", ".###."],
    9: [".###.", "#...#", "#...#", ".####", "....#", "....#", ".###."],
    "-": [".....", ".....", ".....", "#####", ".....", ".....", "....."],
  };

  /* ------------------------------------------------------------ helpers */
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  function hash(str) { let h = 2166136261; for (const ch of String(str)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return (h >>> 0); }
  function fmtUSD(v, dp) {
    if (v == null || !isFinite(v)) return "—";
    return "$" + Number(v).toLocaleString("en-US", { minimumFractionDigits: dp || 0, maximumFractionDigits: dp || 0 });
  }
  function fmtPrice(v) {
    if (v == null || !isFinite(v)) return "—";
    const a = Math.abs(v);
    if (a >= 1000) return fmtUSD(v, 0);
    if (a >= 1) return fmtUSD(v, 2);
    if (a >= 0.01) return "$" + v.toFixed(4);
    return "$" + v.toPrecision(3);
  }
  function fmtQty(q) {
    if (q == null) return "—";
    const a = Math.abs(q);
    return a >= 100 ? q.toFixed(1) : a >= 1 ? q.toFixed(3) : q.toFixed(5);
  }
  function fmtPct(p, sign) {
    if (p == null || !isFinite(p)) return "—";
    return (sign && p > 0 ? "+" : "") + p.toFixed(1) + "%";
  }
  let SIGNED = false;
  function fmtScore(s) {
    if (typeof s !== "number" || !isFinite(s)) return s == null || s === "" ? "—" : esc(s);
    const t = Number.isInteger(s) ? String(s) : Math.abs(s) >= 100 ? s.toFixed(1) : s.toFixed(2);
    return (SIGNED && s > 0 ? "+" : "") + t;
  }

  /* ------------------------------------------------------------ sprites */
  function drawPac(g, x, y, r, dir, mouth) {
    const a = Math.max(0.02, mouth) * 0.3 * Math.PI;
    const base = dir < 0 ? Math.PI : 0;
    g.fillStyle = C.pac;
    g.beginPath();
    g.moveTo(x - Math.cos(base) * r * 0.25, y);
    g.arc(x, y, r, base + a, base + 2 * Math.PI - a);
    g.closePath();
    g.fill();
  }

  function ghostBody(g, x, y, s, frame) {
    const h = s / 2, L = x - h, R = x + h, B = y + h;
    g.beginPath();
    g.moveTo(L, B);
    g.lineTo(L, y);
    g.arc(x, y - s * 0.04, h, Math.PI, 0);
    g.lineTo(R, B);
    const n = 4, step = s / n, up = s * 0.17;
    for (let i = 0; i < n; i++) {
      const x0 = R - i * step;
      if (frame) { g.lineTo(x0 - step * 0.5, B - up); g.lineTo(x0 - step, B); }
      else { g.lineTo(x0 - step * 0.25, B - up); g.lineTo(x0 - step * 0.75, B - up); g.lineTo(x0 - step, B); }
    }
    g.closePath();
    g.fill();
  }

  function ghostEyes(g, x, y, s, look, pupil) {
    const ex = s * 0.2, ey = y - s * 0.1;
    for (const sx of [-1, 1]) {
      g.fillStyle = C.eye;
      g.beginPath(); g.ellipse(x + sx * ex + look * s * 0.05, ey, s * 0.14, s * 0.18, 0, 0, 7); g.fill();
      g.fillStyle = pupil || C.pupil;
      g.beginPath(); g.arc(x + sx * ex + look * s * 0.12, ey + s * 0.02, s * 0.08, 0, 7); g.fill();
    }
  }

  // modes: normal (classic colour) | hunter (RED: blue, angry red-eyed) |
  //        scared (GREEN: pale, wavy mouth) | scaredAlt (flash) | eyes
  function drawGhost(g, x, y, s, mode, color, look, frame, alpha) {
    g.save();
    if (alpha != null) g.globalAlpha = Math.max(0, Math.min(1, alpha));
    if (mode === "eyes") { ghostEyes(g, x, y, s, look); g.restore(); return; }
    const scared = mode === "scared" || mode === "scaredAlt";
    g.fillStyle = mode === "scared" ? C.scared : mode === "scaredAlt" ? C.scaredAlt : color;
    ghostBody(g, x, y, s, frame);
    if (scared) {
      g.fillStyle = C.scaredFace;
      const e = Math.max(1, Math.round(s * 0.14));
      g.fillRect(Math.round(x - s * 0.24), Math.round(y - s * 0.16), e, e);
      g.fillRect(Math.round(x + s * 0.24 - e), Math.round(y - s * 0.16), e, e);
      g.strokeStyle = C.scaredFace; g.lineWidth = 1;
      g.beginPath();
      const my = y + s * 0.2, w = s * 0.7, n = 6;
      for (let i = 0; i <= n; i++) {
        const px = x - w / 2 + (w * i) / n, py = my + (i % 2 ? -s * 0.07 : s * 0.05);
        i ? g.lineTo(px, py) : g.moveTo(px, py);
      }
      g.stroke();
    } else if (mode === "hunter") {
      ghostEyes(g, x, y, s, look, "#ff1a1a");
      // angry brows
      g.strokeStyle = "#000033"; g.lineWidth = 1.2;
      g.beginPath();
      g.moveTo(x - s * 0.38, y - s * 0.36); g.lineTo(x - s * 0.06, y - s * 0.22);
      g.moveTo(x + s * 0.38, y - s * 0.36); g.lineTo(x + s * 0.06, y - s * 0.22);
      g.stroke();
    } else {
      ghostEyes(g, x, y, s, look);
    }
    g.restore();
  }

  function roundRect(g, x0, y0, x1, y1, r) {
    g.beginPath();
    g.moveTo(x0 + r, y0); g.lineTo(x1 - r, y0); g.quadraticCurveTo(x1, y0, x1, y0 + r);
    g.lineTo(x1, y1 - r); g.quadraticCurveTo(x1, y1, x1 - r, y1);
    g.lineTo(x0 + r, y1); g.quadraticCurveTo(x0, y1, x0, y1 - r);
    g.lineTo(x0, y0 + r); g.quadraticCurveTo(x0, y0, x0 + r, y0);
    g.closePath();
  }

  /* ------------------------------------------------------------ lane sim */
  class Lane {
    constructor(canvas, coin, idx) {
      this.cv = canvas; this.g = canvas.getContext("2d");
      this.coin = coin; this.light = coin.light; this.idx = idx;
      this.label = String(coin.label != null ? coin.label : coin.ticker || coin.coin || "").toUpperCase().slice(0, 6);
      this.seed = hash(coin.ticker || coin.coin);
      this.phase = idx * 3.71 + (this.seed % 1000) / 1000 * 1.3;
      this.visible = true;
      this.resize();
    }
    resize() {
      const w = Math.max(80, Math.round(this.cv.clientWidth / PX));
      if (w !== this.cv.width || this.cv.height !== LANE_H) {
        this.cv.width = w; this.cv.height = LANE_H;
        this.W = w; this.M = 16; this.L = w + 2 * this.M;
        this.v = Math.max(20, Math.min(42, w * 0.1));
        this.blocks = this.makeBlocks();
        this.letters = this.makeLetters();
      }
    }
    makeLetters() {
      // ticker spelled in pellets, centred in the corridor
      const chars = [...this.label].filter((ch) => FONT[ch] || ch === " ");
      if (!chars.length) return { dots: [], x0: 0, x1: 0 };
      const n = chars.length;
      let p = 4;
      while (p > 2 && n * 6 * p - p > this.W * 0.62) p--;
      const d = p - 1, width = n * 6 * p - p;
      const x0 = Math.round(this.W / 2 - width / 2), y0 = Math.round(22 - (6 * p + d) / 2);
      const dots = [];
      chars.forEach((ch, i) => {
        const gl = FONT[ch]; if (!gl) return;
        gl.forEach((row, ry) => [...row].forEach((c, rx) => {
          if (c === "#") dots.push({ x: x0 + (i * 6 + rx) * p, y: y0 + ry * p, cy: y0 + ry * p + d / 2 });
        }));
      });
      return { dots, d, x0: x0 - 6, x1: x0 + width + 6 };
    }
    makeBlocks() {
      // wall blocks (double-line maze look) with gaps = corridor exits
      const W = this.W, out = { top: [], bot: [] };
      let rnd = this.seed;
      const r = () => ((rnd = (Math.imul(rnd, 1103515245) + 12345) >>> 0) / 4294967296);
      for (const key of ["top", "bot"]) {
        let x = -8 + Math.floor(r() * 30);
        out[key].push([-20, x]);
        while (x < W + 20) {
          const gap = 10, len = 40 + Math.floor(r() * 70);
          out[key].push([x + gap, x + gap + len]);
          x += gap + len;
        }
      }
      return out;
    }
    isPaused(t) {  // GREEN lanes freeze briefly when a ghost is eaten
      if (this.light !== "GREEN") return false;
      const E = 6.2 / 3, D = 0.6, tt = t + this.phase;
      return tt - Math.floor(tt / (E + D)) * (E + D) < D;
    }
    wrap(x) { const L = this.L, M = this.M; return ((((x + M) % L) + L) % L) - M; }

    draw(t) {
      const g = this.g, W = this.W, H = LANE_H, cy = 22, light = this.light, TH = THEME[light];
      t += this.phase;
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.imageSmoothingEnabled = false;
      g.clearRect(0, 0, W, H);            // lane tint comes from the CSS background behind the canvas

      // maze walls in the light's colour
      for (const [key, y0, y1] of [["top", 1.5, 6.5], ["bot", 37.5, 42.5]]) {
        for (const [a, b] of this.blocks[key]) {
          if (b < -2 || a > W + 2) continue;
          roundRect(g, a + 0.5, y0, b + 0.5, y1, 2);
          g.strokeStyle = TH.glow; g.lineWidth = 2.4; g.stroke();
          g.strokeStyle = TH.wall; g.lineWidth = 1; g.stroke();
        }
      }

      const v = this.v, L = this.L;
      let pac, pacDir, mouthRate = 7, ghosts = [], extras = [];
      let hidePac = false;
      if (light === "GREEN") {
        // Game time `tau` freezes for D seconds at every ghost-eat (like the arcade):
        // Pac-Man disappears and the score (200/400/800/1600) shows in his place.
        const K = 3, P = 6.2, E = P / K, D = 0.6, gMin = 7, vp = v * 1.05;
        const gMax = Math.min(120, 0.42 * vp * P + gMin);
        const cyc = E + D, c = Math.floor(t / cyc), r = t - c * cyc, paused = r < D;
        const tau = c * E + (paused ? 0 : r - D);
        const ke = ((-c % K) + K) % K;           // ghost eaten at the start of this cycle
        pacDir = 1; pac = vp * tau;
        for (let k = 0; k < K; k++) {
          const uu = (tau + k * E) / P, u = uu - Math.floor(uu);
          const gap = gMin + (gMax - gMin) * (1 - u);
          const near = gap < 21;
          ghosts.push({ x: pac + gap, mode: near && Math.floor(t * 8) % 2 ? "scaredAlt" : "scared", look: 1,
            alpha: paused && k === ke ? 0 : Math.min(1, u / 0.07), bob: Math.sin(t * (near ? 40 : 9) + k * 2) * (near ? 0.9 : 0.6) });
        }
        const eatX = vp * c * E + gMin, dtg = tau - c * E;
        if (paused) {
          hidePac = true;
          extras.push({ type: "pop", x: pac + gMin / 2, y: cy, txt: String([200, 400, 800, 1600][c % 4]), a: 1 });
        } else if (dtg < 1.5) {
          extras.push({ type: "eyes", x: eatX - 3.2 * v * dtg });
        }
      } else if (light === "RED") {
        pacDir = -1; mouthRate = 11; pac = -v * 1.1 * t;
        const base = [19, 38, 57, 76], amp = [2.5, 2, 2, 2];
        for (let k = 0; k < 4; k++) {
          const gap = base[k] + amp[k] * Math.sin(t * (1.7 + 0.35 * k) + k * 1.9);
          ghosts.push({ x: pac + gap, mode: "hunter", color: C.hunters[k], look: -1 });
        }
      } else {
        pacDir = 1; pac = v * 0.85 * t;
        for (let k = 0; k < 4; k++) {
          const w = 0.8 + 0.23 * k, ph = k * 2.1 + (this.seed % 7);
          const off = ((k + 1) / 5) * L + 0.07 * L * Math.sin(w * t + ph);
          const vel = v * 0.85 + 0.07 * L * w * Math.cos(w * t + ph);
          ghosts.push({ x: pac + off, mode: "normal", color: C.ghosts[k], look: vel >= 0 ? 1 : -1 });
        }
      }

      // dots, pellets & ticker letters (eaten behind Pac-Man, respawn far behind)
      const pacW = this.wrap(pac);
      const trail = light === "YELLOW" ? 0.45 : 0.55;
      const eaten = (x) => (pacDir > 0 ? (((pacW - x) % L) + L) % L : (((x - pacW) % L) + L) % L) < trail * L;
      const LT = this.letters;
      g.fillStyle = TH.dot;
      for (let x = 4; x < W; x += 8) {
        if (x > LT.x0 && x < LT.x1) continue;
        if (!eaten(x)) g.fillRect(x - 1, cy - 1, 2, 2);
      }
      if (light === "GREEN" && Math.floor(t * 4) % 2 === 0) {
        for (const f of [0.12, 0.9]) {
          const x = Math.round((f * W) / 8) * 8 + 4;
          if (x > LT.x0 && x < LT.x1) continue;
          if (!eaten(x)) { g.beginPath(); g.arc(x, cy, 3.5, 0, 7); g.fill(); }
        }
      }
      for (const dt of LT.dots) {
        const gone = Math.abs(dt.cy - cy) <= 5 && eaten(dt.x + LT.d / 2);
        g.fillStyle = gone ? TH.eaten : TH.letter;
        g.fillRect(dt.x, dt.y, LT.d, LT.d);
      }

      const S = 15, frame = Math.floor(t * 8) % 2;
      for (const e of extras) if (e.type === "eyes") drawGhost(g, this.wrap(e.x), cy, S, "eyes", null, -1, 0);
      for (const gh of ghosts) drawGhost(g, this.wrap(gh.x), cy + (gh.bob || 0), S, gh.mode, gh.color, gh.look, frame, gh.alpha);
      if (!hidePac) drawPac(g, pacW, cy, 7.5, pacDir, Math.abs(Math.sin(t * mouthRate)));
      g.font = "8px PressStart, monospace"; g.textAlign = "center"; g.textBaseline = "middle";
      for (const e of extras) if (e.type === "pop") {
        g.globalAlpha = Math.max(0, e.a); g.fillStyle = "#00ffff";
        g.fillText(e.txt, Math.max(17, Math.min(W - 17, this.wrap(e.x))), e.y); g.globalAlpha = 1;
      }
    }
  }

  /* small animated icons (summary counters + title) */
  class Icon {
    constructor(cv, kind) {
      this.cv = cv; this.kind = kind; this.g = cv.getContext("2d");
      if (kind === "TITLE") { cv.width = 40; cv.height = 20; } else { cv.width = 22; cv.height = 22; }
    }
    draw(t) {
      const g = this.g, w = this.cv.width, h = this.cv.height, c = h / 2;
      g.clearRect(0, 0, w, h);
      const f = Math.floor(t * 6) % 2;
      if (this.kind === "TITLE") {
        // Pac-Man chomping the hyphen in CRYPTO-RUN
        // pellets stream into Pac-Man's mouth, forming the hyphen
        g.fillStyle = "#ffb8ae";
        for (let k = 0; k < 4; k++) {
          const dx = 14 + ((((k * 7 - t * 14) % 28) + 28) % 28);
          if (dx < 38) g.fillRect(Math.round(dx - 2), c - 2, 4, 4);
        }
        drawPac(g, 9, c, 8, 1, Math.abs(Math.sin(t * 8)));
      } else if (this.kind === "YELLOW") drawPac(g, c, c, 9, 1, Math.abs(Math.sin(t * 6)));
      else if (this.kind === "GREEN") drawGhost(g, c, c + 1, 15, Math.floor(t * 3) % 4 === 3 ? "scaredAlt" : "scared", null, 0, f);
      else drawGhost(g, c, c + 1, 15, "hunter", C.hunters[0], Math.sin(t * 2) > 0 ? 1 : -1, f);
    }
  }

  /* ------------------------------------------------------------ render */
  let lanes = [], icons = [], demos = [], current = null;

  function render(data) {
    current = data;
    const coins = (data.coins || []).slice().sort((a, b) => (ORDER[a.light] - ORDER[b.light]) ||
      ((typeof b.score === "number" ? b.score : -1e9) - (typeof a.score === "number" ? a.score : -1e9)));
    SIGNED = coins.some((c) => typeof c.score === "number" && c.score < 0);
    const counts = { GREEN: 0, YELLOW: 0, RED: 0 };
    coins.forEach((c) => counts[c.light]++);

    $("#sample-banner").hidden = !data.is_sample;
    document.body.classList.toggle("is-sample", !!data.is_sample);
    $("#n-green").textContent = counts.GREEN;
    $("#n-yellow").textContent = counts.YELLOW;
    $("#n-red").textContent = counts.RED;
    $("#hud-date").textContent = data.is_sample ? "SAMPLE" : (data.data_date || "--");
    const top = coins.filter((c) => typeof c.score === "number").sort((a, b) => b.score - a.score)[0];
    $("#hud-high").textContent = top ? `${top.ticker} ${fmtScore(top.score)}` : "--";
    const pf = data.portfolio || {};
    $("#hud-equity").textContent = pf.available ? fmtUSD(pf.equity) : "--";

    const mode = $("#mode");
    mode.className = "mode";
    if (counts.GREEN > counts.RED) { mode.textContent = "POWER PELLET ACTIVE \u2014 CHASE THE GHOSTS!"; mode.classList.add("m-green"); }
    else if (counts.RED > counts.GREEN) { mode.textContent = "WARNING! GHOSTS ON THE LOOSE"; mode.classList.add("m-red"); }
    else { mode.textContent = "READY! NORMAL PLAY"; mode.classList.add("m-yellow"); }
    if (data.is_sample) mode.textContent += "  (SAMPLE)";

    $("#breadth").innerHTML = coins.map((c) => `<i class="${c.light}" title="${esc(c.ticker)}"></i>`).join("");
    renderPortfolio(pf, data.is_sample);

    // lanes
    const host = $("#lanes");
    host.innerHTML = "";
    lanes = [];
    if (!coins.length) host.innerHTML = '<div class="empty">INSERT COIN<br><br>run build_data.py</div>';
    let i = 0;
    for (const L of ["GREEN", "YELLOW", "RED"]) {
      let group = coins.filter((c) => c.light === L);
      if (!group.length) {
        if (coins.length) {
          const head = document.createElement("div");
          head.className = "group-head empty-group " + L;
          head.innerHTML = `<span>${L} \u00b7 ${GROUP_TXT[L]}</span><span class="cnt">\u00d70</span><span class="none">none today${L === "GREEN" ? " \u2014 see HOW TO PLAY demo above" : ""}</span><span class="rule"></span>`;
          host.appendChild(head);
        }
        continue;
      }
      const total = group.length;
      if (LIMIT) group = group.slice(0, LIMIT);
      const head = document.createElement("div");
      head.className = "group-head " + L;
      head.innerHTML = `<span>${L} \u00b7 ${GROUP_TXT[L]}</span><span class="cnt">\u00d7${total}</span><span class="rule"></span>`;
      host.appendChild(head);
      for (const c of group) {
        const row = document.createElement("article");
        row.className = "lane " + L;
        let chg = "";
        if (c.prev_light && c.prev_light !== c.light) {
          chg = `<span class="chg">${ORDER[c.light] < ORDER[c.prev_light] ? "\u25b2" : "\u25bc"} was ${esc(c.prev_light)}</span>`;
        }
        row.innerHTML =
          `<div class="info"><span class="lamp" aria-label="${L}"><i class="r"></i><i class="y"></i><i class="g"></i></span>` +
          `<span class="lword">${L}</span><span class="lname" title="${esc(c.ticker)}">${esc(c.name || c.ticker)}</span>` +
          `<span class="score">SCORE <b>${fmtScore(c.score)}</b></span>${chg}</div>` +
          `<canvas class="maze" role="img" aria-label="${esc(c.ticker)} ${L}"></canvas>` +
          `<div class="why"><div class="state"><span class="st">${STATE_TXT[L]}</span>` +
          `<span class="px">${c.price != null ? fmtPrice(c.price) : ""}${c.chg_24h_pct != null ? ` <span class="${c.chg_24h_pct >= 0 ? "up" : "dn"}">${fmtPct(c.chg_24h_pct, true)}</span>` : ""}</span></div>` +
          `<div class="reason" title="${esc(c.reasons + (c.note ? " [" + c.note + "]" : ""))}">${esc(c.reasons || "\u2014")}${c.note ? ' <span class="note" title="' + esc(c.note) + '">[i]</span>' : ""}</div></div>`;
        host.appendChild(row);
        lanes.push(new Lane(row.querySelector("canvas"), c, i++));
      }
    }
    if (LIMIT) {
      const n = document.createElement("p");
      n.className = "pf-note"; n.style.textAlign = "center";
      n.textContent = `showing top ${LIMIT} per light \u2014 open index.html for all ${coins.length} coins`;
      host.appendChild(n);
    }
    observe();

    const gen = data.generated_at ? new Date(data.generated_at) : null;
    $("#meta").textContent = (data.is_sample ? "SAMPLE DATA \u00b7 " : "") +
      `source: ${data.source || "?"} \u00b7 built ${gen ? gen.toLocaleString("en-GB", { timeZoneName: "short" }) : "?"}` +
      ` \u00b7 ${coins.length} coins`;
    const cn = $("#common-note");
    cn.hidden = !data.common_note;
    cn.textContent = data.common_note ? "NOTE: " + data.common_note : "";
    frame(true);
  }

  function renderPortfolio(pf, sample) {
    const stats = $("#pf-stats"), tbl = $("#pf-table"), note = $("#pf-note");
    if (!pf || !pf.available) {
      stats.innerHTML = ""; tbl.innerHTML = "";
      note.textContent = "account.json not found" + (pf && pf.error ? ` (${pf.error})` : "");
      return;
    }
    const pos = pf.positions || [];
    const pnlCls = (v) => (v == null ? "na" : v >= 0 ? "up" : "dn");
    const ur = pf.unrealized_pnl;
    stats.innerHTML =
      `<div class="pf-stat"><span class="k">EQUITY</span><span class="v">${fmtUSD(pf.equity)}</span><span class="s">${pf.equity_basis === "market" ? "marked to signal prices" : pf.equity_basis === "mixed" ? "part at cost" : "positions at cost"}</span></div>` +
      `<div class="pf-stat"><span class="k">CASH</span><span class="v">${fmtPct(pf.cash_pct)}</span><span class="s">${fmtUSD(pf.cash)}</span></div>` +
      `<div class="pf-stat"><span class="k">POSITIONS</span><span class="v">${pos.length}</span><span class="s ${pnlCls(ur)}">${ur != null ? "uP&amp;L " + (ur >= 0 ? "+" : "") + fmtUSD(ur) : "invested " + fmtUSD(pf.invested_cost)}</span></div>`;
    tbl.innerHTML = "<tr><th>COIN</th><th>QTY</th><th>ENTRY</th><th>PRICE</th><th>P&amp;L</th><th>STOP</th><th>TO STOP</th></tr>" +
      pos.map((p) =>
        `<tr><td class="tic"><span class="ldot ${p.light || ""}" title="${p.light || "no signal"}"></span>${esc(p.ticker)}</td>` +
        `<td>${fmtQty(p.qty)}</td><td>${fmtPrice(p.entry)}</td><td class="${p.price == null ? "na" : ""}">${fmtPrice(p.price)}</td>` +
        `<td class="${pnlCls(p.pnl)}">${p.pnl == null ? "—" : fmtPct(p.pnl_pct, true)}</td>` +
        `<td>${fmtPrice(p.stop)}</td><td>${p.stop_dist_pct == null ? "—" : "-" + Math.abs(p.stop_dist_pct).toFixed(1) + "%"}</td></tr>`).join("");
    const anyPrice = pos.some((p) => p.price != null);
    note.textContent = (anyPrice ? "P&L vs entry (avg cost incl. fees) using signal prices." :
      "No prices in the signals output yet \u2014 showing holdings at cost and stops (\u2018to stop\u2019 measured from entry).") +
      (sample ? " Light dots appear once real signals exist." : "") +
      (pf.updated ? ` Account updated ${pf.updated.replace("T", " ").slice(0, 16)}.` : "");
  }

  /* ------------------------------------------------------------ loop */
  let io = null;
  function observe() {
    if (io) io.disconnect();
    if (!("IntersectionObserver" in window)) return;
    io = new IntersectionObserver((ents) => ents.forEach((e) => { const l = lanes.find((x) => x.cv === e.target); if (l) l.visible = e.isIntersecting; }), { rootMargin: "100px" });
    lanes.forEach((l) => io.observe(l.cv));
  }
  const t0 = performance.now();
  let manualT = null;
  function now() { return manualT != null ? manualT : FROZEN != null ? FROZEN : REDUCED ? 2.2 : (performance.now() - t0) / 1000; }
  function frame(force) {
    const t = now();
    for (const l of lanes) if (force || l.visible) l.draw(t);
    for (const ic of icons) ic.draw(t);
    for (const d of demos) d.draw(t);
  }
  function loop() { frame(false); requestAnimationFrame(loop); }
  window.addEventListener("resize", () => { lanes.concat(demos).forEach((l) => l.resize()); frame(true); });
  // hooks for snapshot.py
  window.__setTime = (t) => { manualT = t; frame(true); };
  window.__pausedCount = (t) => lanes.filter((l) => l.isPaused(t)).length;
  window.__demoPaused = (t) => demos.some((l) => l.isPaused(t));
  window.__greenCount = () => lanes.filter((l) => l.light === "GREEN").length;

  /* ------------------------------------------------------------ data + polling */
  function sig(d) { try { return JSON.stringify([d.is_sample, d.data_date, d.coins, d.portfolio]); } catch (e) { return ""; } }
  function maybeRender(d) { if (d && (!current || sig(d) !== sig(current))) render(d); window.__ready = !!current; }
  function poll() {
    if (location.protocol.startsWith("http")) {
      fetch(DATA_FILE + ".json?ts=" + Date.now(), { cache: "no-store" }).then((r) => (r.ok ? r.json() : null))
        .then(maybeRender).catch(() => {});
    } else {
      const s = document.createElement("script");
      s.src = DATA_FILE + ".js?ts=" + Date.now();
      s.onload = () => { maybeRender(window.ORACLE_DATA); s.remove(); };
      s.onerror = () => s.remove();
      document.body.appendChild(s);
    }
  }

  function start() {
    icons = [...document.querySelectorAll("canvas[data-icon]")].map((c) => new Icon(c, c.dataset.icon));
    icons.push(new Icon($("#title-pac"), "TITLE"));
    demos = [...document.querySelectorAll("canvas[data-demo]")].map((c, i) =>
      new Lane(c, { ticker: "DEMO" + c.dataset.demo, label: c.dataset.label || "", light: c.dataset.demo }, 40 + i));
    if (window.ORACLE_DATA && DATA_FILE === "data") { render(window.ORACLE_DATA); window.__ready = true; }
    else poll();
    if (FROZEN == null) {
      requestAnimationFrame(loop);
      setInterval(poll, 30000);
    }
  }
  const fontsReady = document.fonts && document.fonts.load
    ? Promise.all([document.fonts.load("8px PressStart"), document.fonts.load("20px VT323")]).catch(() => {})
    : Promise.resolve();
  fontsReady.then(start);
})();

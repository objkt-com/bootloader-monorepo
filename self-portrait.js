/* 
bootloader: 
  a generative;
  self-portrait;
  as a poster;
  fully on-chain;
  edition of 1000;
*/

const { svg, rnd, seed, iterationNumber, isPreview } = BTLDR;

/* viewport */
const W = 800, H = 1200;
svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
svg.setAttribute("preserveAspectRatio", "xMidYMid meet");

/* helpers */
const NS = "http://www.w3.org/2000/svg";
const R = () => rnd();
const ir = (a, b) => Math.floor(a + R() * (b - a + 1));
const fr = (a, b) => a + R() * (b - a);
const el = (n, a = {}, kids = []) => {
  const e = document.createElementNS(NS, n);
  for (const k in a) e.setAttribute(k, String(a[k]));
  kids.forEach(c => e.appendChild(c));
  return e;
};
const article = w => (/^[aeiou]/i.test(w) ? "an" : "a");

/* type */
const HEAD = "ui-sans-serif, system-ui, -apple-system, Segoe UI, Helvetica, Arial";
const BODY = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
const CAP_FS = 25, CAP_LH = 32, CAP_WEIGHT = 600, JUSTIFY_LAST_LINE = false;

/* preview (square, solid bg, title only) */
if (isPreview) {
  const S = Math.min(W, H);
  svg.setAttribute("viewBox", `0 0 ${S} ${S}`);
  svg.setAttribute("preserveAspectRatio", "xMidYMid meet");

  const BG = "#000", FG = "#fff";
  svg.appendChild(el("rect", { x: 0, y: 0, width: S, height: S, fill: BG }));

  const meter = el("text", {
    "font-size": 10, "font-family": HEAD, "font-weight": 900,
    visibility: "hidden", "xml:space": "preserve"
  });
  svg.appendChild(meter);
  const measureHead = (str, fs) => {
    meter.setAttribute("font-size", fs);
    meter.textContent = str;
    return meter.getBBox().width || 0;
  };

  let fs = Math.floor(S * 0.22);
  while (measureHead("bootloader:", fs) > S * 0.86 && fs > 12) fs -= 2;

  svg.appendChild(el("text", {
    x: S / 2, y: S / 2, "font-size": fs, "font-family": HEAD, "font-weight": 900,
    fill: FG, "text-anchor": "middle", "dominant-baseline": "middle", "xml:space": "preserve"
  })).textContent = "bootloader:";

  svg.appendChild(el("desc")).textContent =
    "bootloader: preview — square viewBox, cream background, black title";
} else {
  /* 2-color palette */
  const PAIRS = [
    { name: "PorcelainOnCarbon", bg: "#101214", fg: "#f5f7fa", w: 26 },
    { name: "InkOnIvory",        bg: "#fffaf0", fg: "#0b0b0b", w: 26 },
    { name: "MidnightCyan",      bg: "#0b0e14", fg: "#00e5ff", w: 10 },
    { name: "WineMagenta",       bg: "#120714", fg: "#ff2ac9", w: 7  },
    { name: "ForestTeal",        bg: "#06110e", fg: "#1ee6a8", w: 5  },
    { name: "UmberAmber",        bg: "#201508", fg: "#ffbf2a", w: 3  },
  ];
  const sum = PAIRS.reduce((s, p) => s + p.w, 0);
  let r = R() * sum, PAL = PAIRS[0];
  for (const p of PAIRS) { r -= p.w; if (r <= 0) { PAL = p; break; } }
  svg.appendChild(el("rect", { x: 0, y: 0, width: W, height: H, fill: PAL.bg }));

  /* wordmark */
  const PAD = 72, HEAD_FS = 112;
  svg.appendChild(el("text", {
    x: PAD, y: PAD, "font-size": HEAD_FS, "font-family": HEAD, "font-weight": 900,
    fill: PAL.fg, "dominant-baseline": "hanging"
  })).textContent = "bootloader:";

  /* text measuring (monospace approx) */
  const measureWidth = (str, fs = CAP_FS) => str.length * (fs * 0.6);

  const wrapJustify = (group, x, y, text, maxW, fs = CAP_FS, lh = CAP_LH, weight = CAP_WEIGHT) => {
    const t = el("text", {
      x, y, "font-size": fs, "font-family": BODY, "font-weight": weight,
      fill: PAL.fg, "text-anchor": "start", "dominant-baseline": "hanging", "xml:space": "preserve"
    });
    group.appendChild(t);

    const words = text.trim().split(/\s+/);
    const lines = [];
    let line = "";
    for (let i = 0; i < words.length; i++) {
      const test = line ? line + " " + words[i] : words[i];
      if (measureWidth(test, fs) <= maxW) line = test;
      else { if (line) lines.push(line), line = words[i]; else lines.push(words[i]), line = ""; }
    }
    if (line) lines.push(line);

    let dy = 0;
    for (let i = 0; i < lines.length; i++) {
      const ts = el("tspan", { x, y: y + dy });
      ts.textContent = lines[i];
      if (i < lines.length - 1 || JUSTIFY_LAST_LINE) {
        ts.setAttribute("textLength", String(maxW));
        ts.setAttribute("lengthAdjust", "spacing");
      }
      t.appendChild(ts);
      dy += lh;
    }
    return { node: t, bottom: y + lines.length * lh, height: lines.length * lh, lines: lines.length };
  };

  const fitLine = (group, x, y, text, maxW, fsStart = 12, fsMin = 10, anchor = "start") => {
    let fs = fsStart, w = measureWidth(text, fs);
    while (w > maxW && fs > fsMin) { fs -= 1; w = measureWidth(text, fs); }
    const t = el("text", {
      x, y, "font-size": fs, "font-family": BODY, "font-weight": CAP_WEIGHT,
      fill: PAL.fg, "text-anchor": anchor, "dominant-baseline": "alphabetic", "xml:space": "preserve"
    });
    t.textContent = text;
    group.appendChild(t);
    return { x, y: y - fs, width: w, height: fs };
  };

  /* seed (fixed 64-hex, optional display) */
  const hexSeed = big => {
    try {
      let h = typeof big === "bigint" ? big.toString(16) : String(big);
      h = h.replace(/^0x/i, "").toLowerCase();
      if (h.length < 64) h = "0".repeat(64 - h.length) + h;
      if (h.length % 2) h = "0" + h;
      return "0x" + h;
    } catch { return "0x" + "0".repeat(64); }
  };
  const seed_HEX = hexSeed(seed);
  const HAS_seed = (typeof seed === "bigint") ? seed !== 0n : String(seed) !== "0";
  const showSeed = HAS_seed && R() < 0.45;

  /* edition switches */
  const aboveText = R() < 0.018;
  const wantIntersect = R() < 0.28;
  const shapeCount = R() < 0.005 ? 0 : R() < 0.6 ? 1 : 2;

  /* shapes */
  const regularPolygonPath = (cx, cy, r, sides, rot = -Math.PI / 2) => {
    let d = "";
    for (let i = 0; i < sides; i++) {
      const a = rot + i * (Math.PI * 2 / sides);
      const x = cx + r * Math.cos(a), y = cy + r * Math.sin(a);
      d += i ? ` L ${x} ${y}` : `M ${x} ${y}`;
    }
    return d + " Z";
  };

  const SH = [
    { k: "circle",  rf: 1.0, w: 10, draw: (cx, cy, s, c, style) =>
        style === "outline" ? el("circle", { cx, cy, r: s, fill: "none", stroke: c,
          "stroke-width": Math.max(8, Math.round(s * 0.14)), "vector-effect": "non-scaling-stroke" })
                            : el("circle", { cx, cy, r: s, fill: c }), anim: "spin" },
    { k: "square",  rf: 1.42, w: 10, draw: (cx, cy, s, c, style) =>
        style === "outline" ? el("rect", { x: cx - s, y: cy - s, width: 2*s, height: 2*s, fill: "none", stroke: c,
          "stroke-width": Math.max(8, Math.round(s * 0.14)), "vector-effect": "non-scaling-stroke" })
                            : el("rect", { x: cx - s, y: cy - s, width: 2*s, height: 2*s, fill: c }), anim: "tilt" },
    { k: "triangle", rf: 1.12, w: 10, draw: (cx, cy, s, c, style) => {
        const d = `M ${cx} ${cy - s} L ${cx - s * 0.9} ${cy + s * 0.65} L ${cx + s * 0.9} ${cy + s * 0.65} Z`;
        return style === "outline"
          ? el("path", { d, fill: "none", stroke: c, "stroke-width": Math.max(8, Math.round(s * 0.12)), "vector-effect": "non-scaling-stroke" })
          : el("path", { d, fill: c });
      }, anim: "spin" },
    { k: "ring",    rf: 1.1,  w: 10, draw: (cx, cy, s, c) =>
        el("circle", { cx, cy, r: s, fill: "none", stroke: c,
          "stroke-width": Math.max(8, Math.round(s * 0.16)), "vector-effect": "non-scaling-stroke" }), anim: "breath" },
    { k: "pentagon",rf: 1.0,  w: 5,  draw: (cx, cy, s, c, style) => {
        const d = regularPolygonPath(cx, cy, s, 5);
        return style === "outline"
          ? el("path", { d, fill: "none", stroke: c, "stroke-width": Math.max(8, Math.round(s * 0.12)), "vector-effect": "non-scaling-stroke" })
          : el("path", { d, fill: c });
      }, anim: "spin" },
    { k: "hexagon", rf: 1.0,  w: 3,  draw: (cx, cy, s, c, style) => {
        const d = regularPolygonPath(cx, cy, s, 6);
        return style === "outline"
          ? el("path", { d, fill: "none", stroke: c, "stroke-width": Math.max(8, Math.round(s * 0.12)), "vector-effect": "non-scaling-stroke" })
          : el("path", { d, fill: c });
      }, anim: "spin" },
  ];

  const SH_SUM = SH.reduce((s, o) => s + (o.w ?? 10), 0);
  const pickShapeWeighted = () => {
    let r = R() * SH_SUM;
    for (const s of SH) { r -= (s.w ?? 10); if (r <= 0) return s; }
    return SH[0];
  };

  const tempo = () => (R() < 0.2 ? "slow" : R() < 0.9 ? "normal" : R() < 0.99 ? "fast" : "ultra");
  const verb = (anim, tp) => {
    const base = { spin: "spins", tilt: "tilts", breath: "breathes" }[anim] || "pulses";
    const adv = tp === "slow" ? " slowly" : tp === "fast" ? " fast" : tp === "ultra" ? " ultra fast" : "";
    return base + adv;
  };
  const rate = (anim, tp) => {
    const M = {
      spin:  { slow: 14,  normal: 24, fast: 48,  ultra: 150 },
      tilt:  { slow: 0.9, normal: 1.4, fast: 2.4, ultra: 4.8 },
      breath:{ slow: 1.2, normal: 2.0, fast: 3.2, ultra: 5.8 },
      pulse: { slow: 1.2, normal: 2.2, fast: 3.4, ultra: 6.0 },
    };
    return (M[anim] || M.pulse)[tp];
  };

  const sizeWord = sz => (sz < W * 0.2 ? "small" : sz > W * 0.28 ? "big" : "medium");
  const nounPhrase = u => `${article(sizeWord(u.sz))} ${sizeWord(u.sz)} ${u.style === "outline" ? "outlined" : "solid"} ${u.sh.k}`;
  const relSize = (b, a) => (b.sz > a.sz * 1.08 ? "larger" : b.sz < a.sz * 0.92 ? "smaller" : "similar in size");

  /* choose shapes (no positions yet) */
  const baseS = fr(W * 0.18, W * 0.26);
  const chosen = [];
  for (let i = 0; i < shapeCount; i++) {
    const sh = pickShapeWeighted();
    const style = sh.k === "ring" ? "outline" : (R() < 0.35 ? "outline" : "solid");
    chosen.push({ sh, sz: baseS * fr(0.8, 1.1), style, opacity: 1, tp: tempo() });
  }

  /* caption sentence (seed mentioned only when visible) */
  const shapeClause = () => {
    if (shapeCount === 0) return "showing nothing";
    if (shapeCount === 1) {
      const a = chosen[0];
      return `showing ${nounPhrase(a)} that ${verb(a.sh.anim, a.tp)}`;
    }
    const [a, b] = chosen, sameK = a.sh.k === b.sh.k, sameS = a.style === b.style, sameV = verb(a.sh.anim, a.tp) === verb(b.sh.anim, b.tp);
    if (sameK && sameS && sameV) {
      const rel = relSize(b, a);
      return rel === "similar in size"
        ? `showing ${nounPhrase(a)} that ${verb(a.sh.anim, a.tp)} and another`
        : `showing ${nounPhrase(a)} that ${verb(a.sh.anim, a.tp)} and another, ${rel} one`;
    }
    if (sameK && sameS) return `showing ${nounPhrase(a)} that ${verb(a.sh.anim, a.tp)} and another one that ${verb(b.sh.anim, b.tp)}`;
    if (sameK) return `showing ${nounPhrase(a)} that ${verb(a.sh.anim, a.tp)} and another ${b.style === "outline" ? "outlined" : "solid"} one that ${verb(b.sh.anim, b.tp)}`;
    return `showing ${nounPhrase(a)} that ${verb(a.sh.anim, a.tp)} and ${nounPhrase(b)} that ${verb(b.sh.anim, b.tp)}`;
  };
  const placementClause = () => shapeCount === 0
    ? "only the caption is rendered"
    : (shapeCount === 1 ? (aboveText ? "it sits in front of the caption" : "it sits below the caption")
                        : (aboveText ? "they sit in front of the caption" : "they sit below the caption"));

  const parts = [
    "This poster is code rendered as SVG",
    "assembled on-chain and executed in your browser",
    HAS_seed && showSeed ? "with the seed visible" : null,
    shapeClause(),
    "in two colors",
  ].filter(Boolean);
  let CAP_SENTENCE = parts.join(", ") + "; " + placementClause() + ".";

  /* caption layout + footer, then shapes */
  const CAP_GROUP = el("g"); svg.appendChild(CAP_GROUP);
  const MAXW = W - PAD * 2, CAP_Y = PAD + HEAD_FS + 8;
  let capBottom = wrapJustify(CAP_GROUP, PAD, CAP_Y, CAP_SENTENCE, MAXW, CAP_FS, CAP_LH, CAP_WEIGHT).bottom;

  /* footer: seed (left, optional) + edition (right, always) */
  const footY = H - 22;

  let ITER_STR = "1";
  try {
    if (typeof iterationNumber === "bigint") ITER_STR = iterationNumber.toString();
    else {
      const n = Number(iterationNumber);
      if (Number.isFinite(n) && n > 0) ITER_STR = String(n);
    }
  } catch {}
  const EDITION_TEXT = `${ITER_STR} / 1000`;

  const edition = el("text", {
    x: W - PAD, y: footY, "font-size": 13, "font-family": BODY, "font-weight": CAP_WEIGHT,
    fill: PAL.fg, "text-anchor": "end", "dominant-baseline": "alphabetic", "xml:space": "preserve"
  });
  edition.textContent = EDITION_TEXT;
  svg.appendChild(edition);
  const edW = measureWidth(EDITION_TEXT, 13);
  const editionBB = { x: W - PAD - edW, y: footY - 13, width: edW, height: 13 };

  let footerTop = editionBB.y;
  if (HAS_seed && showSeed) {
    const seedGroup = el("g"); svg.appendChild(seedGroup);
    const RIGHT_RESERVE = Math.max(140, editionBB.width + 24);
    const seedMaxW = Math.max(60, W - PAD * 2 - RIGHT_RESERVE);
    const seedBB = fitLine(seedGroup, PAD, footY, `seed: ${seed_HEX}`, seedMaxW, 12, 10, "start");
    footerTop = Math.min(footerTop, seedBB.y);
  }

  /* shape band (safe area) */
  const safeTop = capBottom + 36, safeBottom = footerTop - 10;
  const xMin = PAD + 60, xMax = W - PAD - 60;
  const yMin = aboveText ? PAD + HEAD_FS : Math.max(safeTop, PAD + HEAD_FS + 20);
  const yMax = Math.max(yMin + 50, safeBottom);

  const radiusFor = u => {
    const stroke = (u.style === "outline" || u.sh.k === "ring") ? Math.max(8, Math.round(u.sz * 0.14)) : 0;
    return u.sz * u.sh.rf + stroke * 0.7;
  };

  const placed = [];
  for (let i = 0; i < chosen.length; i++) {
    const u = chosen[i], rad = radiusFor(u);
    let cx, cy, ok = false, tries = 0;
    if (chosen.length === 2 && wantIntersect && i === 1 && !aboveText) {
      const a = placed[0], rs = rad + a.rad;
      while (!ok && tries < 80) {
        tries++;
        const ang = fr(0, Math.PI * 2), d = fr(rs * 0.55, rs * 0.95);
        cx = a.cx + Math.cos(ang) * d; cy = a.cy + Math.sin(ang) * d;
        if (cx - rad < xMin || cx + rad > xMax || cy - rad < yMin || cy + rad > yMax) continue;
        ok = true;
      }
    }
    while (!ok && tries < 160) {
      tries++;
      cx = fr(xMin, xMax); cy = fr(yMin, yMax);
      if (!wantIntersect && placed.length && !aboveText) {
        const a = placed[0];
        if (Math.hypot(a.cx - cx, a.cy - cy) <= (a.rad + rad) * 0.98) continue;
      }
      if (cx - rad < xMin || cx + rad > xMax || cy - rad < yMin || cy + rad > yMax) continue;
      ok = true;
    }
    placed.push({ ...u, cx, cy, rad });
  }

  /* refine tail if 2 shapes (intersect vs distance), then re-wrap */
  if (placed.length === 2) {
    const [a, b] = placed;
    const d = Math.hypot(a.cx - b.cx, a.cy - b.cy);
    const rel = d < (a.rad + b.rad) * 0.98 ? "they intersect" : "they keep their distance";
    CAP_GROUP.textContent = "";
    const tail = `${rel}, and ${aboveText ? "they sit in front of the caption" : "they sit below the caption"}.`;
    CAP_SENTENCE = parts.join(", ") + "; " + tail;
    wrapJustify(CAP_GROUP, PAD, CAP_Y, CAP_SENTENCE, MAXW, CAP_FS, CAP_LH, CAP_WEIGHT);
  }

  /* clip so shapes don't overlap caption/footer (unless in front) */
  let clipId = null;
  if (!aboveText) {
    clipId = "clipBand";
    const defs = el("defs"), cp = el("clipPath", { id: clipId });
    cp.appendChild(el("rect", { x: 0, y: safeTop, width: W, height: Math.max(0, yMax - safeTop) }));
    defs.appendChild(cp); svg.appendChild(defs);
  }

  /* draw */
  const SG = el("g", clipId ? { "clip-path": `url(#${clipId})` } : {});
  svg.appendChild(SG);
  const nodes = [];
  for (const u of placed) {
    const n = u.sh.draw(u.cx, u.cy, u.sz, PAL.fg, u.style);
    SG.appendChild(n); nodes.push({ node: n, info: u });
  }
  if (aboveText) svg.appendChild(SG);

  /* animate (tempo matches prose) */
  (() => {
    const t0 = performance.now();
    const f = () => {
      const t = (performance.now() - t0) / 1000;
      for (const { node, info } of nodes) {
        const { cx, cy, sz } = info, a = info.sh.anim, rt = rate(a, info.tp);
        if (a === "spin") {
          node.setAttribute("transform", `rotate(${(t * rt) % 360} ${cx} ${cy})`);
        } else if (a === "tilt") {
          node.setAttribute("transform", `rotate(${Math.sin(t * rt) * 35} ${cx} ${cy})`);
        } else if (a === "breath") {
          const base = Math.max(8, Math.round(sz * 0.16));
          node.setAttribute("stroke-width", Math.round(base * (1 + 0.18 * Math.sin(t * rt))));
        } else {
          const k = 1 + 0.06 * Math.sin(t * rt);
          node.setAttribute("transform", `translate(${cx * (1 - k)} ${cy * (1 - k)}) scale(${k})`);
        }
      }
      requestAnimationFrame(f);
    };
    requestAnimationFrame(f);
  })();

  /* metadata */
  const md = {
    project: "bootloader: self-portrait",
    seed_hex: seed_HEX,
    traits: {
      palette: PAL.name,
      shapeCount: placed.length,
      shapes: placed.map(u => u.sh.k),
      styles: placed.map(u => u.style),
      tempos: placed.map(u => u.tp),
      frontOfCaption: aboveText,
      seedVisible: showSeed,
      edition: EDITION_TEXT,
    },
  };
  svg.appendChild(el("metadata")).textContent = JSON.stringify(md);
  svg.appendChild(el("desc")).textContent =
    `poster • ${PAL.name} • shapes:${placed.map(u => u.sh.k).join(", ")} • seed:${HAS_seed && showSeed ? seed_HEX : "hidden"} • edition:${EDITION_TEXT}`;
}
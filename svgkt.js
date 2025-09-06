/*
 * Hello World! 👋
 * (c) 2025 svgKT
 */

const svg = document.documentElement;
svg.setAttribute("viewBox", "0 0 400 400"),
  svg.setAttribute("preserveAspectRatio", "xMidYMid slice");
const NS = "http://www.w3.org/2000/svg",
  XLINK = "http://www.w3.org/1999/xlink",
  roll = rnd(),
  tiers = [
    { name: "APEX", key: "apex", p: 0.004 },
    { name: "RADIANT", key: "radiant", p: 0.024 },
    { name: "LUMINAR", key: "luminar", p: 0.104 },
    { name: "VECTOR", key: "vector", p: 0.324 },
    { name: "WAVE", key: "wave", p: 0.704 },
    { name: "BASE", key: "base", p: 1 },
  ],
  tier = tiers.find((t) => roll <= t.p),
  baseHue = Math.floor(360 * rnd()),
  timeScale = 0.5 + 3 * rnd(),
  energyMode = Math.floor(4 * rnd()),
  style = Math.floor(8 * rnd());
function hsl(t, e, s) {
  return `hsl(${((t % 360) + 360) % 360}, ${e}%, ${s}%)`;
}
function choice(t) {
  return t[Math.floor(rnd() * t.length)];
}
function jitter(t, e) {
  return t + (2 * rnd() - 1) * e;
}
svg.setAttribute("data-tier", tier.name),
  svg.setAttribute("data-style", String(style)),
  svg.setAttribute("data-energy", String(energyMode)),
  svg.setAttribute("data-baseHue", String(baseHue));
const palettes = [
  [
    [baseHue, 82, 16],
    [baseHue + 18, 88, 38],
    [baseHue + 36, 86, 58],
    [baseHue + 210, 78, 58],
    [baseHue + 300, 70, 62],
  ],
  [
    [baseHue, 20, 8],
    [baseHue + 160, 80, 58],
    [baseHue + 200, 80, 70],
    [baseHue + 260, 75, 66],
    [baseHue + 320, 75, 60],
  ],
  [
    [baseHue, 12, 10],
    [baseHue + 25, 30, 38],
    [baseHue + 190, 45, 50],
    [baseHue + 310, 36, 58],
    [baseHue + 90, 40, 72],
  ],
  [
    [baseHue, 75, 20],
    [baseHue + 8, 80, 36],
    [baseHue + 16, 78, 54],
    [baseHue + 190, 72, 62],
    [baseHue + 200, 70, 80],
  ],
];
function goldenPalette(t) {
  let e = [];
  for (let s = 0; s < 5; s++) {
    let l = t + 137.5 * s,
      a = 55 + (s % 2 ? 25 : 5) + 10 * rnd(),
      $ = 20 + 14 * s + 8 * rnd();
    e.push([l, a, $]);
  }
  return e;
}
let P = 0.5 > rnd() ? choice(palettes) : goldenPalette(baseHue + 360 * rnd());
if ("apex" === tier.key || ("radiant" === tier.key && 0.5 > rnd())) {
  let t = choice(P.slice(2));
  P = [
    [baseHue, 10, 8],
    [baseHue, 10, 22],
    [baseHue, 10, 42],
    [baseHue, 10, 62],
    t,
  ];
}
const defs = document.createElementNS(NS, "defs"),
  blur = document.createElementNS(NS, "feGaussianBlur");
blur.setAttribute("stdDeviation", String(3 + 5 * rnd())),
  blur.setAttribute("result", "b");
const merge = document.createElementNS(NS, "feMerge");
["b", "SourceGraphic"].forEach((t) => {
  let e = document.createElementNS(NS, "feMergeNode");
  e.setAttribute("in", t), merge.appendChild(e);
});
const fGlow = document.createElementNS(NS, "filter");
fGlow.setAttribute("id", "glow"),
  fGlow.appendChild(blur),
  fGlow.appendChild(merge),
  defs.appendChild(fGlow);
const fSurf = document.createElementNS(NS, "filter");
fSurf.setAttribute("id", "surf");
const ft = document.createElementNS(NS, "feTurbulence");
ft.setAttribute(
  "baseFrequency",
  `${0.006 + 0.016 * rnd()} ${0.006 + 0.016 * rnd()}`
),
  ft.setAttribute("numOctaves", String(2 + Math.floor(3 * rnd()))),
  ft.setAttribute("seed", String(Math.floor(1e6 * rnd()))),
  ft.setAttribute("result", "n");
const dm = document.createElementNS(NS, "feDisplacementMap");
dm.setAttribute("in", "SourceGraphic"),
  dm.setAttribute("in2", "n"),
  dm.setAttribute("scale", String(8 + 16 * rnd())),
  dm.setAttribute("xChannelSelector", "R"),
  dm.setAttribute("yChannelSelector", "G");
const morph = document.createElementNS(NS, "feMorphology");
morph.setAttribute("operator", "dilate"),
  morph.setAttribute("radius", String(0.5 > rnd() ? 0.2 : 0.6)),
  morph.setAttribute("in", "SourceGraphic"),
  morph.setAttribute("result", "m");
const comp = document.createElementNS(NS, "feComposite");
comp.setAttribute("in", "m"),
  comp.setAttribute("in2", "SourceGraphic"),
  comp.setAttribute("operator", "atop"),
  fSurf.appendChild(ft),
  fSurf.appendChild(dm),
  fSurf.appendChild(morph),
  fSurf.appendChild(comp),
  defs.appendChild(fSurf);
const marker = document.createElementNS(NS, "marker");
marker.setAttribute("id", "arrow"),
  marker.setAttribute("markerWidth", "6"),
  marker.setAttribute("markerHeight", "6"),
  marker.setAttribute("refX", "5"),
  marker.setAttribute("refY", "3"),
  marker.setAttribute("orient", "auto");
const tip = document.createElementNS(NS, "path");
tip.setAttribute("d", "M0,0 L6,3 L0,6 Z");
const tipCol = P[3] || P[1];
tip.setAttribute("fill", hsl(tipCol[0], tipCol[1], tipCol[2])),
  marker.appendChild(tip),
  defs.appendChild(marker);
const sym = document.createElementNS(NS, "symbol");
sym.setAttribute("id", "logoGlyph"), sym.setAttribute("viewBox", "0 0 100 30");
const tGlyph = document.createElementNS(NS, "text");
tGlyph.setAttribute("x", "50"),
  tGlyph.setAttribute("y", "22"),
  tGlyph.setAttribute("font-family", "monospace"),
  tGlyph.setAttribute("font-size", "22"),
  tGlyph.setAttribute("font-weight", "900"),
  tGlyph.setAttribute("text-anchor", "middle"),
  (tGlyph.textContent = "svgKT"),
  sym.appendChild(tGlyph),
  defs.appendChild(sym);
const tile = document.createElementNS(NS, "pattern");
tile.setAttribute("id", "ktTile"),
  tile.setAttribute("patternUnits", "userSpaceOnUse"),
  tile.setAttribute("width", "72"),
  tile.setAttribute("height", "40");
for (let r = 0; r < 3; r++) {
  let e = document.createElementNS(NS, "use");
  e.setAttributeNS(XLINK, "xlink:href", "#logoGlyph"),
    e.setAttribute("x", String(r % 2 == 0 ? 0 : -10)),
    e.setAttribute("y", String(8 + 12 * r));
  let s = P[(r + 2) % P.length];
  e.setAttribute("fill", hsl(s[0], s[1], s[2])),
    e.setAttribute("opacity", String(0.35 + 0.45 * rnd())),
    tile.appendChild(e);
}
defs.appendChild(tile);
const pathCircle = document.createElementNS(NS, "path"),
  circleId = "pc" + Math.floor(1e7 * rnd());
function addLemniscate() {
  let t = "lem" + Math.floor(1e7 * rnd()),
    e = document.createElementNS(NS, "path"),
    s = "";
  for (let l = -Math.PI / 2; l <= Math.PI / 2; l += 0.02) {
    let a =
        (120 * Math.sqrt(2) * Math.cos(2 * l)) /
        (Math.sin(2 * l) * Math.sin(2 * l) + 1),
      $ = 200 + a * Math.cos(l) * 0.9,
      n = 200 + a * Math.sin(l) * 0.9;
    s += (l === -Math.PI / 2 ? "M " : " L ") + $ + " " + n;
  }
  return (
    e.setAttribute("id", t),
    e.setAttribute("d", s),
    e.setAttribute("fill", "none"),
    e.setAttribute("stroke", "transparent"),
    defs.appendChild(e),
    t
  );
}
pathCircle.setAttribute("id", circleId),
  pathCircle.setAttribute(
    "d",
    "M 200,200 m -150,0 a 150,150 0 1,1 300,0 a 150,150 0 1,1 -300,0"
  ),
  pathCircle.setAttribute("fill", "none"),
  pathCircle.setAttribute("stroke", "transparent"),
  defs.appendChild(pathCircle);
const lemId = addLemniscate();
svg.appendChild(defs);
const bgGrad = document.createElementNS(NS, "linearGradient");
bgGrad.setAttribute("id", "bg"),
  bgGrad.setAttribute("x1", "0%"),
  bgGrad.setAttribute("y1", "0%"),
  bgGrad.setAttribute("x2", "100%"),
  bgGrad.setAttribute("y2", "100%");
for (let i = 0; i < 4; i++) {
  let l = document.createElementNS(NS, "stop"),
    a = P[i];
  l.setAttribute("offset", `${(i / 3) * 100}%`),
    l.setAttribute("stop-color", hsl(a[0], a[1], a[2])),
    l.setAttribute("stop-opacity", "0.9"),
    bgGrad.appendChild(l);
}
defs.appendChild(bgGrad);
const bg = document.createElementNS(NS, "rect");
if (
  (bg.setAttribute("width", "400"),
  bg.setAttribute("height", "400"),
  bg.setAttribute("fill", "url(#bg)"),
  0.75 > rnd() && bg.setAttribute("filter", "url(#surf)"),
  svg.appendChild(bg),
  0.85 > rnd())
) {
  let $ = document.createElementNS(NS, "rect");
  $.setAttribute("width", "400"),
    $.setAttribute("height", "400"),
    $.setAttribute("fill", "url(#ktTile)"),
    $.setAttribute("opacity", String(0.12 + 0.2 * rnd())),
    svg.appendChild($);
}
function contours() {
  let t = 16 + Math.floor(20 * rnd());
  for (let e = 0; e < t; e++) {
    let s = 20 + (e / (t - 1)) * 360,
      l = "M";
    for (let a = 0; a <= 400; a += 3) {
      let $ = Math.sin(0.03 * a + 0.35 * e) * (6 + 22 * rnd());
      l += (0 === a ? "" : " L") + a + " " + (s + $);
    }
    let n = document.createElementNS(NS, "path");
    n.setAttribute("d", l);
    let u = P[e % P.length];
    n.setAttribute("stroke", hsl(u[0], u[1], jitter(u[2], 4))),
      n.setAttribute("stroke-opacity", String(0.18 + 0.45 * rnd())),
      n.setAttribute("stroke-width", String(0.6 + 1.6 * rnd())),
      n.setAttribute("fill", "none"),
      svg.appendChild(n);
  }
}
function checkerWarp() {
  let t = document.createElementNS(NS, "pattern"),
    e = "chk" + Math.floor(1e7 * rnd());
  t.setAttribute("id", e),
    t.setAttribute("patternUnits", "userSpaceOnUse"),
    t.setAttribute("width", "16"),
    t.setAttribute("height", "16");
  for (let s = 0; s < 2; s++)
    for (let l = 0; l < 2; l++) {
      let a = document.createElementNS(NS, "rect");
      a.setAttribute("x", String(8 * s)),
        a.setAttribute("y", String(8 * l)),
        a.setAttribute("width", "8"),
        a.setAttribute("height", "8");
      let $ = P[(s + l) % P.length];
      a.setAttribute(
        "fill",
        hsl($[0], 0.6 * $[1], Math.min(85, $[2] + (s === l ? 10 : -5)))
      ),
        t.appendChild(a);
    }
  defs.appendChild(t);
  let n = document.createElementNS(NS, "rect");
  n.setAttribute("x", "0"),
    n.setAttribute("y", "0"),
    n.setAttribute("width", "400"),
    n.setAttribute("height", "400"),
    n.setAttribute("fill", `url(#${e})`),
    n.setAttribute("opacity", String(0.12 + 0.2 * rnd()));
  let u = document.createElementNS(NS, "animateTransform");
  u.setAttribute("attributeName", "transform"),
    u.setAttribute("type", "scale"),
    u.setAttribute("values", "1 1; 1.02 0.98; 1 1"),
    u.setAttribute("dur", `${(6 + 8 * rnd()) * timeScale}s`),
    u.setAttribute("repeatCount", "indefinite"),
    n.appendChild(u),
    svg.appendChild(n);
}
function arrowField() {
  for (let t = 30; t <= 370; t += 28)
    for (let e = 30; e <= 370; e += 28) {
      let s = Math.sin(0.02 * e) + Math.cos(0.025 * t + 0.005 * e),
        l = 10 + 8 * Math.sin(s + 0.01 * t),
        a = e + Math.cos(s) * l * 2,
        $ = t + Math.sin(s) * l * 2,
        n = document.createElementNS(NS, "line"),
        u = P[(e + t) % P.length];
      n.setAttribute("x1", e),
        n.setAttribute("y1", t),
        n.setAttribute("x2", a),
        n.setAttribute("y2", $),
        n.setAttribute("stroke", hsl(u[0], u[1], Math.max(30, u[2] - 10))),
        n.setAttribute("stroke-opacity", String(0.25 + 0.4 * rnd())),
        n.setAttribute("stroke-width", "1.4"),
        n.setAttribute("marker-end", "url(#arrow)"),
        svg.appendChild(n);
    }
}
function spokes() {
  let t = document.createElementNS(NS, "g"),
    e = 5 + Math.floor(6 * rnd());
  for (let s = 0; s < e; s++) {
    let l = 40 + 26 * s + 10 * rnd(),
      a = document.createElementNS(NS, "circle"),
      $ = P[s % P.length];
    a.setAttribute("cx", "200"),
      a.setAttribute("cy", "200"),
      a.setAttribute("r", String(l)),
      a.setAttribute("fill", "none"),
      a.setAttribute("stroke", hsl($[0], $[1], $[2])),
      a.setAttribute("stroke-opacity", "0.4"),
      a.setAttribute("stroke-dasharray", String(6 + 14 * rnd())),
      t.appendChild(a);
    let n = Math.floor(10 + l / 7);
    for (let u = 0; u < n; u++) {
      let o = (u / n) * Math.PI * 2,
        b = 200 + Math.cos(o) * l,
        p = 200 + Math.sin(o) * l,
        d = 0.25 + 0.6 * rnd(),
        c = document.createElementNS(NS, "use");
      c.setAttributeNS(XLINK, "xlink:href", "#logoGlyph"),
        c.setAttribute(
          "transform",
          `translate(${b} ${p}) rotate(${
            (180 * o) / Math.PI + 90
          }) scale(${d}) translate(-50 -15)`
        ),
        c.setAttribute("fill", hsl($[0], $[1], Math.min(88, $[2] + 10))),
        c.setAttribute("opacity", String(0.25 + 0.5 * rnd())),
        t.appendChild(c);
    }
  }
  svg.appendChild(t);
}
function textHalftone() {
  let t = document.createElementNS(NS, "mask");
  t.setAttribute("id", "textDot");
  let e = document.createElementNS(NS, "g");
  for (let s = 0; s <= 400; s += 18)
    for (let l = 0; l <= 400; l += 18) {
      let a = (Math.sin(0.02 * l) + Math.cos(0.03 * s)) * 0.5 + 0.5,
        $ = 0.3 + 1.6 * a,
        n = document.createElementNS(NS, "use");
      n.setAttributeNS(XLINK, "xlink:href", "#logoGlyph"),
        n.setAttribute(
          "transform",
          `translate(${l} ${s}) scale(${$}) translate(-50 -15)`
        ),
        n.setAttribute("fill", "white"),
        n.setAttribute("opacity", String(0.25 + 0.75 * a)),
        e.appendChild(n);
    }
  t.appendChild(e), defs.appendChild(t);
  let u = document.createElementNS(NS, "rect");
  u.setAttribute("width", "400"),
    u.setAttribute("height", "400"),
    u.setAttribute("fill", hsl(P[0][0], 18, 6)),
    u.setAttribute("mask", "url(#textDot)"),
    u.setAttribute("opacity", "0.9"),
    svg.appendChild(u);
}
function kaleido() {
  let t = 8 + Math.floor(8 * rnd()),
    e = document.createElementNS(NS, "g");
  for (let s = 0; s < t; s++) {
    let l = s * (360 / t),
      a = document.createElementNS(NS, "path"),
      $ = P[s % P.length],
      n = 40 + 30 * rnd(),
      u = 140 + 40 * rnd();
    a.setAttribute(
      "d",
      `M200,200 L ${200 + n},200 Q ${200 + (n + u) / 2},170 ${200 + u},200 Q ${
        200 + (n + u) / 2
      },230 ${200 + n},200 Z`
    ),
      a.setAttribute("fill", hsl($[0], $[1], $[2])),
      a.setAttribute("opacity", String(0.28 + 0.42 * rnd())),
      a.setAttribute("transform", `rotate(${l} 200 200)`),
      e.appendChild(a);
  }
  svg.appendChild(e);
}
function stitches() {
  let t = 8 + Math.floor(16 * rnd());
  for (let e = 0; e < t; e++) {
    let s = 400 * rnd(),
      l = 400 * rnd(),
      a = 400 * rnd(),
      $ = 400 * rnd(),
      n = 400 * rnd(),
      u = 400 * rnd(),
      o = `M${s},${l} Q${n},${u} ${a},${$}`,
      b = document.createElementNS(NS, "path"),
      p = P[e % P.length];
    b.setAttribute("d", o),
      b.setAttribute("fill", "none"),
      b.setAttribute("stroke", hsl(p[0], p[1], p[2])),
      b.setAttribute("stroke-width", String(0.7 + 1.6 * rnd())),
      b.setAttribute("stroke-dasharray", String(4 + 10 * rnd()));
    let d = document.createElementNS(NS, "animate");
    d.setAttribute("attributeName", "stroke-dashoffset"),
      d.setAttribute("from", "0"),
      d.setAttribute("to", "40"),
      d.setAttribute("dur", `${(3 + 6 * rnd()) * timeScale}s`),
      d.setAttribute("repeatCount", "indefinite"),
      b.appendChild(d),
      svg.appendChild(b);
  }
}
function glyphNoise() {
  let t = 200 + Math.floor(220 * rnd());
  for (let e = 0; e < t; e++) {
    let s = 400 * rnd(),
      l = 400 * rnd(),
      a = 0.25 + 1.7 * Math.pow(rnd(), 1.6),
      $ = 360 * rnd(),
      n = document.createElementNS(NS, "use");
    n.setAttributeNS(XLINK, "xlink:href", "#logoGlyph"),
      n.setAttribute(
        "transform",
        `translate(${s} ${l}) rotate(${$}) scale(${a}) translate(-50 -15)`
      );
    let u = P[e % P.length];
    n.setAttribute("fill", hsl(u[0], u[1], Math.min(92, u[2] + 12))),
      n.setAttribute("opacity", String(0.18 + 0.7 * rnd())),
      svg.appendChild(n);
  }
}
const blocks = [
    contours,
    checkerWarp,
    arrowField,
    spokes,
    textHalftone,
    kaleido,
    stitches,
    glyphNoise,
  ],
  picked = new Set(),
  want = 2 + Math.floor(3 * rnd());
for (; picked.size < want; ) picked.add(choice(blocks));
function textOrbit(t, e, s, l) {
  let a = document.createElementNS(NS, "text");
  a.setAttribute("font-family", "monospace"),
    a.setAttribute("font-size", String(e)),
    a.setAttribute("font-weight", String(l));
  let $ = P[4] || P[2];
  a.setAttribute("fill", hsl($[0], $[1], Math.min(92, $[2] + 15)));
  let n = document.createElementNS(NS, "textPath");
  n.setAttributeNS(XLINK, "xlink:href", "#" + t),
    n.setAttribute("startOffset", "0%");
  let u = " ",
    o = Math.floor(120 + 3 * e);
  for (let b = 0; b < o; b++) u += b % 9 == 0 ? "svgKT\xb7" : "svgKT ";
  n.textContent = u;
  let p = document.createElementNS(NS, "animate");
  p.setAttribute("attributeName", "startOffset"),
    p.setAttribute("values", "0%;100%;0%"),
    p.setAttribute("dur", `${s * timeScale}s`),
    p.setAttribute("repeatCount", "indefinite"),
    n.appendChild(p),
    a.appendChild(n),
    svg.appendChild(a);
}
picked.forEach((t) => t()),
  textOrbit(circleId, 12, 14 + 10 * rnd(), 700),
  0.9 > rnd() && textOrbit(lemId, 10, 12 + 10 * rnd(), 700);
const letters = "svgKT",
  letterSpacing = 56 + 22 * rnd(),
  startX = 40 + 20 * rnd();
for (let i = 0; i < letters.length; i++) {
  let n = startX + i * letterSpacing,
    u = 206 + (rnd() - 0.5) * 34,
    o = letters[i],
    b = 50 + 22 * rnd();
  for (let p = 0; p < 3; p++) {
    let d = document.createElementNS(NS, "text");
    (d.textContent = o),
      d.setAttribute("x", n + 2 * p),
      d.setAttribute("y", u + 1.6 * p),
      d.setAttribute("font-family", "monospace"),
      d.setAttribute("font-weight", 0 === p ? "900" : "500"),
      d.setAttribute("font-size", String(b * (1 - 0.1 * p))),
      d.setAttribute("text-anchor", "middle");
    let c = P[(i + p) % P.length];
    if (
      (d.setAttribute(
        "fill",
        hsl(c[0], c[1], Math.min(80, c[2] + (p ? 0 : -5)))
      ),
      d.setAttribute("opacity", String(0.93 - 0.25 * p)),
      0 === p && d.setAttribute("filter", "url(#glow)"),
      0 === energyMode)
    ) {
      let A = document.createElementNS(NS, "animateTransform");
      A.setAttribute("attributeName", "transform"),
        A.setAttribute("type", "translate"),
        A.setAttribute("values", `0 0; 0 ${-4 - 8 * rnd()}; 0 0`),
        A.setAttribute("dur", `${(1.6 + 2.6 * rnd()) * timeScale}s`),
        A.setAttribute("repeatCount", "indefinite"),
        d.appendChild(A);
    } else if (1 === energyMode) {
      let f = document.createElementNS(NS, "animateTransform");
      f.setAttribute("attributeName", "transform"),
        f.setAttribute("type", "rotate"),
        f.setAttribute(
          "values",
          `0 ${n} ${u}; ${360 * (rnd() - 0.5)} ${n} ${u}`
        ),
        f.setAttribute("dur", `${(7 + 12 * rnd()) * timeScale}s`),
        f.setAttribute("repeatCount", "indefinite"),
        d.appendChild(f);
    } else if (2 === energyMode) {
      let h = document.createElementNS(NS, "animateTransform");
      h.setAttribute("attributeName", "transform"),
        h.setAttribute("type", "scale"),
        h.setAttribute("values", `1; ${1.12 + 0.45 * rnd()}; 1`),
        h.setAttribute("dur", `${(1.3 + 1.9 * rnd()) * timeScale}s`),
        h.setAttribute("repeatCount", "indefinite"),
        d.appendChild(h);
    } else {
      let m = document.createElementNS(NS, "animate"),
        S = P[(i + p + 2) % P.length];
      m.setAttribute("attributeName", "fill"),
        m.setAttribute(
          "values",
          `${hsl(c[0], c[1], c[2])}; ${hsl(S[0], S[1], S[2])}; ${hsl(
            c[0],
            c[1],
            c[2]
          )}`
        ),
        m.setAttribute("dur", `${(2.4 + 3.6 * rnd()) * timeScale}s`),
        m.setAttribute("repeatCount", "indefinite"),
        d.appendChild(m);
    }
    svg.appendChild(d);
  }
}
if ("apex" === tier.key) {
  let N = document.createElementNS(NS, "mask");
  N.setAttribute("id", "apexMask");
  let _ = document.createElementNS(NS, "g"),
    g = 300 + Math.floor(260 * rnd());
  for (let y = 0; y < g; y++) {
    let C = rnd() * Math.PI * 2,
      k = 150 * Math.pow(rnd(), 0.8),
      E = 200 + Math.cos(C) * k,
      x = 200 + Math.sin(C) * k,
      v = 0.3 + 1.6 * rnd(),
      w = document.createElementNS(NS, "use");
    w.setAttributeNS(XLINK, "xlink:href", "#logoGlyph"),
      w.setAttribute(
        "transform",
        `translate(${E} ${x}) rotate(${
          (180 * C) / Math.PI
        }) scale(${v}) translate(-50 -15)`
      ),
      w.setAttribute("fill", "white"),
      w.setAttribute("opacity", String(0.25 + 0.75 * rnd())),
      _.appendChild(w);
  }
  N.appendChild(_), defs.appendChild(N);
  let G = document.createElementNS(NS, "circle");
  G.setAttribute("cx", "200"),
    G.setAttribute("cy", "200"),
    G.setAttribute("r", "150"),
    G.setAttribute("fill", "url(#bg)"),
    G.setAttribute("mask", "url(#apexMask)"),
    G.setAttribute("opacity", "0.98"),
    svg.appendChild(G);
}
function label(t, e, s) {
  let l = document.createElementNS(NS, "text");
  l.setAttribute("x", t),
    l.setAttribute("y", e),
    l.setAttribute("font-family", "monospace"),
    l.setAttribute("font-size", "8"),
    l.setAttribute("fill", hsl(P[0][0], 18, 92)),
    l.setAttribute("opacity", "0.9"),
    (l.textContent = s),
    svg.appendChild(l);
}
label(12, 388, `svgKT • ${tier.name} • style ${style} • hue ${baseHue}`);
const meta = document.createElementNS(NS, "metadata");
(meta.textContent = JSON.stringify({
  project: "svgKT — Vector Medium Study",
  seed: "undefined" != typeof SEED ? String(SEED) : "n/a",
  tier: tier.name,
  key: tier.key,
  hue: baseHue,
  style,
  energy: energyMode,
  palette: P,
  features: { picked: Array.from(picked).length },
})),
  svg.appendChild(meta);

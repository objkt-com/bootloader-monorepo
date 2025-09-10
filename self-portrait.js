/*
 * The genesis project for bootloader:.
 * A generative self-portrait
 * long form, generative, fully on-chain.
 */

const { svg, rnd, seed, iterationNumber, isPreview } = BTLDR;

/* ---------- poster viewport (portrait, fixed) ---------- */
const W = 800, H = 1200;
svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');

/* ---------- helpers ---------- */
const NS='http://www.w3.org/2000/svg';
const R=()=>rnd();
const ir=(a,b)=>Math.floor(a+R()*(b-a+1));
const fr=(a,b)=>a+R()*(b-a);
const el=(n,a={},kids=[])=>{const e=document.createElementNS(NS,n);for(const k in a)e.setAttribute(k,String(a[k]));kids.forEach(c=>e.appendChild(c));return e};
const article=(w)=>/^([aeiou])/i.test(w)?'an':'a';

/* type */
const HEAD='ui-sans-serif, system-ui, -apple-system, Segoe UI, Helvetica, Arial';
const BODY='ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
const CAP_FS=25, CAP_LH=32;         // slightly smaller
const CAP_WEIGHT=600;               // slightly lighter
const JUSTIFY_LAST_LINE=false;

/* ---------- preview mode (square viewBox, solid background, title only) ---------- */
const IS_PREVIEW = !!isPreview;
if (IS_PREVIEW) {
  // Make the viewBox square
  const S = Math.min(W, H);
  svg.setAttribute('viewBox', `0 0 ${S} ${S}`);
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');

  // Use existing "InkOnIvory" palette: bg '#fffaf0' (cream) and fg '#0b0b0b' (black-ish)
  const BG = '#fffaf0';
  const FG = '#0b0b0b';

  // Background
  svg.appendChild(el('rect', { x: 0, y: 0, width: S, height: S, fill: BG }));

  // Measure to fit the wordmark nicely
  const meter = el('text', {'font-size': 10, 'font-family': HEAD, 'font-weight': 900, visibility: 'hidden', 'xml:space':'preserve'});
  svg.appendChild(meter);
  function measureHead(str, fs){ meter.setAttribute('font-size', fs); meter.textContent = str; return (meter.getBBox().width||0); }

  let fs = Math.floor(S * 0.22);
  while (measureHead('bootloader:', fs) > S * 0.86 && fs > 12) fs -= 2;

  // Centered title
  svg.appendChild(
    el('text', {
      x: S/2, y: S/2, 'font-size': fs, 'font-family': HEAD, 'font-weight': 900,
      fill: FG, 'text-anchor': 'middle', 'dominant-baseline': 'middle', 'xml:space':'preserve'
    })
  ).textContent = 'bootloader:';

  // Minimal desc for accessibility; no generative system in preview
  svg.appendChild(el('desc')).textContent = 'bootloader: preview — square viewBox, cream background, black title';
} else {

/* ---------- palette: exactly two colors ---------- */
const PAIRS=[
  {name:'PorcelainOnCarbon', bg:'#101214', fg:'#f5f7fa', w:26},
  {name:'InkOnIvory',        bg:'#fffaf0', fg:'#0b0b0b', w:26},
  {name:'MidnightCyan',      bg:'#0b0e14', fg:'#00e5ff', w:10},
  {name:'WineMagenta',       bg:'#120714', fg:'#ff2ac9', w:7},
  {name:'ForestTeal',        bg:'#06110e', fg:'#1ee6a8', w:5},
  {name:'UmberAmber',        bg:'#201508', fg:'#ffbf2a', w:3}
];
let sum=0; for(const p of PAIRS) sum+=p.w;
let pick=R()*sum, PAL=PAIRS[0]; for(const p of PAIRS){ pick-=p.w; if(pick<=0){ PAL=p; break; } }
svg.appendChild(el('rect',{x:0,y:0,width:W,height:H,fill:PAL.bg}));

/* ---------- wordmark ---------- */
const PAD=72, HEAD_FS=112;
svg.appendChild(el('text',{x:PAD,y:PAD,'font-size':HEAD_FS,'font-family':HEAD,'font-weight':900,fill:PAL.fg,'dominant-baseline':'hanging'})).textContent='bootloader:';

/* ---------- meter + wrapping + justification ---------- */
const METER = el('text',{'font-size':CAP_FS,'font-family':BODY,'font-weight':CAP_WEIGHT,fill:PAL.fg,visibility:'hidden','xml:space':'preserve'});
svg.appendChild(METER);
function measureWidth(str, fs=CAP_FS, weight=CAP_WEIGHT){
  METER.setAttribute('font-size', fs);
  METER.setAttribute('font-weight', weight);
  METER.textContent = str;
  return (METER.getBBox().width || 0);
}
function wrapJustify(group, x, y, text, maxW, fs=CAP_FS, lh=CAP_LH, weight=CAP_WEIGHT){
  const t = el('text',{x,y,'font-size':fs,'font-family':BODY,'font-weight':weight,fill:PAL.fg,'text-anchor':'start','dominant-baseline':'hanging','xml:space':'preserve'});
  group.appendChild(t);
  const words = text.trim().split(/\s+/);
  const lines=[]; let line='';
  for(let i=0;i<words.length;i++){
    const test = line ? (line+' '+words[i]) : words[i];
    if(measureWidth(test,fs,weight) <= maxW){ line=test; }
    else { if(line){ lines.push(line); line=words[i]; } else { lines.push(words[i]); line=''; } }
  }
  if(line) lines.push(line);
  let dy=0;
  for(let i=0;i<lines.length;i++){
    const ts=el('tspan',{x,y:y+dy}); ts.textContent=lines[i];
    if(i < lines.length-1 || JUSTIFY_LAST_LINE){
      ts.setAttribute('textLength', String(maxW));
      ts.setAttribute('lengthAdjust','spacing');
    }
    t.appendChild(ts); dy+=lh;
  }
  const bb=t.getBBox(); return {node:t, bottom:bb.y+bb.height, height:bb.height, lines:lines.length};
}
function fitLine(group, x, y, text, maxW, fsStart=12, fsMin=10, anchor='start'){
  let fs=fsStart, w=measureWidth(text,fs,CAP_WEIGHT);
  while(w>maxW && fs>fsMin){ fs-=1; w=measureWidth(text,fs,CAP_WEIGHT); }
  const t = el('text',{x,y,'font-size':fs,'font-family':BODY,'font-weight':CAP_WEIGHT,fill:PAL.fg,'text-anchor':anchor,'dominant-baseline':'alphabetic','xml:space':'preserve'});
  t.textContent=text; group.appendChild(t);
  return t.getBBox();
}

/* ---------- seed: fixed 64-hex, only shown when visible ---------- */
function hexSeed(big){
  try{
    let h = (typeof big==='bigint') ? big.toString(16) : String(big);
    h = h.replace(/^0x/i,'').toLowerCase();
    if (h.length < 64) h = '0'.repeat(64 - h.length) + h;
    if (h.length % 2) h = '0' + h;
    return '0x' + h;
  }catch(_){ return '0x' + '0'.repeat(64); }
}
const seed_HEX = hexSeed(seed);
const HAS_seed = (typeof seed==='bigint') ? (seed!==0n) : (String(seed)!=='0');
const SHOW_seed_PROB = 0.45;                 // display rate when a seed exists
const showSeed = HAS_seed && (R() < SHOW_seed_PROB);

/* ---------- edition switches ---------- */
const FRONT_PROB=0.018;       // rare: shapes in front
const INTERSECT_PROB=0.28;
const ZERO_SHAPE_PROB=0.005;

const aboveText = R()<FRONT_PROB;
const wantIntersect = R()<INTERSECT_PROB;
const shapeCount = (R()<ZERO_SHAPE_PROB)? 0 : (R()<0.6? 1 : 2);

/* ---------- shapes (scale to poster, device-independent strokes) ---------- */
function regularPolygonPath(cx, cy, r, sides, rot=-Math.PI/2){
  let d='';
  for(let i=0;i<sides;i++){
    const a = rot + i*(Math.PI*2/sides);
    const x = cx + r*Math.cos(a), y = cy + r*Math.sin(a);
    d += (i===0 ? `M ${x} ${y}` : ` L ${x} ${y}`);
  }
  return d + ' Z';
}

const SH=[
  {k:'circle',   rf:1.00, w:10, draw:(cx,cy,s,c,style)=> style==='outline'
      ? el('circle',{cx,cy,r:s,fill:'none',stroke:c,'stroke-width':Math.max(8,Math.round(s*0.14)),'vector-effect':'non-scaling-stroke'})
      : el('circle',{cx,cy,r:s,fill:c}), anim:'spin'},
  {k:'square',   rf:1.42, w:10, draw:(cx,cy,s,c,style)=> style==='outline'
      ? el('rect',{x:cx-s,y:cy-s,width:s*2,height:s*2,fill:'none',stroke:c,'stroke-width':Math.max(8,Math.round(s*0.14)),'vector-effect':'non-scaling-stroke'})
      : el('rect',{x:cx-s,y:cy-s,width:s*2,height:s*2,fill:c}), anim:'tilt'},
  {k:'triangle', rf:1.12, w:10, draw:(cx,cy,s,c,style)=>{const d=`M ${cx} ${cy-s} L ${cx-s*0.9} ${cy+s*0.65} L ${cx+s*0.9} ${cy+s*0.65} Z`; return style==='outline'
      ? el('path',{d,fill:'none',stroke:c,'stroke-width':Math.max(8,Math.round(s*0.12)),'vector-effect':'non-scaling-stroke'})
      : el('path',{d,fill:c});}, anim:'spin'},
  {k:'ring',     rf:1.10, w:10, draw:(cx,cy,s,c)=> el('circle',{cx,cy,r:s,fill:'none',stroke:c,'stroke-width':Math.max(8,Math.round(s*0.16)),'vector-effect':'non-scaling-stroke'}), anim:'breath'},
  // pentagon and hexagon with different rarities
  {k:'pentagon', rf:1.00, w:5,  draw:(cx,cy,s,c,style)=>{const d=regularPolygonPath(cx,cy,s,5); return style==='outline'
      ? el('path',{d,fill:'none',stroke:c,'stroke-width':Math.max(8,Math.round(s*0.12)),'vector-effect':'non-scaling-stroke'})
      : el('path',{d,fill:c});}, anim:'spin'},
  {k:'hexagon',  rf:1.00, w:3,  draw:(cx,cy,s,c,style)=>{const d=regularPolygonPath(cx,cy,s,6); return style==='outline'
      ? el('path',{d,fill:'none',stroke:c,'stroke-width':Math.max(8,Math.round(s*0.12)),'vector-effect':'non-scaling-stroke'})
      : el('path',{d,fill:c});}, anim:'spin'},
];

// weighted picker for shapes (rarities)
let SH_SUM = 0; for(const s of SH) SH_SUM += (s.w ?? 10);

function pickShapeWeighted(){
  let r = R() * SH_SUM;
  for(const s of SH){
    r -= (s.w ?? 10);
    if(r <= 0) return s;
  }
  return SH[0];
}

function tempo(){ const t=R(); return t<0.20?'slow': t<0.90?'normal': t<0.99?'fast':'ultra'; }
function verb(anim,tp){ const base={spin:'spins',tilt:'tilts',breath:'breathes'}[anim]||'pulses'; const adv=tp==='slow'?' slowly':tp==='fast'?' fast':tp==='ultra'?' ultra fast':''; return base+adv; }
function rate(anim,tp){ const map={spin:{slow:14,normal:24,fast:48,ultra:150},tilt:{slow:0.9,normal:1.4,fast:2.4,ultra:4.8},breath:{slow:1.2,normal:2.0,fast:3.2,ultra:5.8},pulse:{slow:1.2,normal:2.2,fast:3.4,ultra:6.0}}; return (map[anim]||map.pulse)[tp]; }

function sizeWord(sz){ return sz < (W*0.20) ? 'small' : (sz > (W*0.28) ? 'big' : 'medium'); }
function nounPhrase(u){ const size=sizeWord(u.sz); const style=(u.style==='outline')?'outlined':'solid'; const a=article(size); return `${a} ${size} ${style} ${u.sh.k}`; }
function relSize(b,a){ if(b.sz>a.sz*1.08) return 'larger'; if(b.sz<a.sz*0.92) return 'smaller'; return 'similar in size'; }

/* choose shape properties (no positions yet) */
const baseS = fr(W*0.18, W*0.26);
const chosen=[];
for(let i=0;i<shapeCount;i++){
  const sh = pickShapeWeighted();
  const style=(sh.k==='ring')?'outline':(R()<0.35?'outline':'solid');
  const opacity=1; // ensure consistent lightness for all shapes
  const tp=tempo(); const sz=baseS*fr(0.8,1.1);
  chosen.push({sh,sz,style,opacity,tp});
}

/* ---------- build ONE sentence (seed mentioned only when visible) ---------- */
function shapeClause(){
  if(shapeCount===0) return 'showing nothing';
  if(shapeCount===1){ const a=chosen[0]; return `showing ${nounPhrase(a)} that ${verb(a.sh.anim,a.tp)}`; }
  const a=chosen[0], b=chosen[1];
  const sameK=a.sh.k===b.sh.k, sameS=a.style===b.style, sameV=verb(a.sh.anim,a.tp)===verb(b.sh.anim,b.tp);
  if(sameK && sameS && sameV){ const rel=relSize(b,a); return (rel==='similar in size') ? `showing ${nounPhrase(a)} that ${verb(a.sh.anim,a.tp)} and another` : `showing ${nounPhrase(a)} that ${verb(a.sh.anim,a.tp)} and another, ${rel} one`; }
  if(sameK && sameS) return `showing ${nounPhrase(a)} that ${verb(a.sh.anim,a.tp)} and another one that ${verb(b.sh.anim,b.tp)}`;
  if(sameK){ const styleWord=(b.style==='outline')?'outlined':'solid'; return `showing ${nounPhrase(a)} that ${verb(a.sh.anim,a.tp)} and another ${styleWord} one that ${verb(b.sh.anim,b.tp)}`; }
  return `showing ${nounPhrase(a)} that ${verb(a.sh.anim,a.tp)} and ${nounPhrase(b)} that ${verb(b.sh.anim,b.tp)}`;
}
function placementClause(){
  if(shapeCount===0) return 'only the caption is rendered';
  if(shapeCount===1) return aboveText ? 'it sits in front of the caption' : 'it sits below the caption';
  return aboveText ? 'they sit in front of the caption' : 'they sit below the caption';
}
const seedPhrase = (HAS_seed && showSeed) ? 'with the seed visible' : null;
const parts = [
  'This poster is code rendered as SVG',
  'assembled on-chain and executed in your browser',
  seedPhrase,
  shapeClause(),
  'in two colors'
].filter(Boolean);
let CAP_SENTENCE = parts.join(', ') + '; ' + placementClause() + '.';

/* ---------- measure caption (wrapped & justified), footer, then place shapes ---------- */
const CAP_GROUP = el('g'); svg.appendChild(CAP_GROUP);
const MAXW = W - PAD*2;
const CAP_Y = PAD + HEAD_FS + 8;
let capBottom = wrapJustify(CAP_GROUP, PAD, CAP_Y, CAP_SENTENCE, MAXW, CAP_FS, CAP_LH, CAP_WEIGHT).bottom;

/* ----- footer: seed (left, small) + edition (right, always) on same baseline ----- */
const FOOT_BOTTOM_MARGIN = 22;
const footY = H - FOOT_BOTTOM_MARGIN;

// edition first (always)
let ITER_STR='1';
try{
  if (typeof iterationNumber==='bigint') { ITER_STR = iterationNumber.toString(); }
  else if (iterationNumber!=null) { const n=Number(iterationNumber); ITER_STR = Number.isFinite(n)&&n>0 ? String(n) : '1'; }
}catch(_){}
const EDITION_TEXT = `${ITER_STR} / 1000`;
const edition = el('text',{
  x: W - PAD, y: footY, 'font-size': 13, 'font-family': BODY, 'font-weight': CAP_WEIGHT,
  fill: PAL.fg, 'text-anchor':'end', 'dominant-baseline':'alphabetic','xml:space':'preserve'
});
edition.textContent = EDITION_TEXT;
svg.appendChild(edition);
const editionBB = edition.getBBox();

// seed (optional, left-aligned & small, fitted to avoid the edition area)
let footerTop = editionBB.y;  // start with edition top
if (HAS_seed && showSeed){
  const seedGroup = el('g'); svg.appendChild(seedGroup);
  const RIGHT_RESERVE = Math.max(140, editionBB.width + 24); // keep clear of the edition block
  const seedMaxW = Math.max(60, (W - PAD*2 - RIGHT_RESERVE));
  const seedText = `seed: ${seed_HEX}`;
  const seedBB = fitLine(seedGroup, PAD, footY, seedText, seedMaxW, 12, 10, 'start');
  footerTop = Math.min(footerTop, seedBB.y);
}

/* compute shape band between caption and footer */
const safeTop = capBottom + 36;                          // extra margin below caption
const safeBottom = footerTop - 10;                       // a touch of air above footer texts
const xMin = PAD+60, xMax = W-PAD-60;                    // never cut off left/right
const yMin = aboveText ? (PAD+HEAD_FS) : Math.max(safeTop, PAD+HEAD_FS+20);
const yMax = Math.max(yMin+50, safeBottom);

/* place shapes (safe band) */
function radiusFor(u){
  const stroke = (u.style==='outline' || u.sh.k==='ring') ? Math.max(8, Math.round(u.sz*0.14)) : 0;
  return u.sz*u.sh.rf + stroke*0.7;
}
const placed=[];
for(let i=0;i<chosen.length;i++){
  const u=chosen[i], rad=radiusFor(u);
  let cx,cy,ok=false,tries=0;
  if(chosen.length===2 && wantIntersect && i===1 && !aboveText){
    const a=placed[0]; const rs=rad+a.rad;
    while(!ok && tries<80){ tries++; const ang=fr(0,Math.PI*2), d=fr(rs*0.55, rs*0.95);
      cx=a.cx+Math.cos(ang)*d; cy=a.cy+Math.sin(ang)*d;
      if(cx-rad<xMin||cx+rad>xMax||cy-rad<yMin||cy+rad>yMax) continue; ok=true;
    }
  }
  while(!ok && tries<160){
    tries++; cx=fr(xMin,xMax); cy=fr(yMin,yMax);
    if(!wantIntersect && placed.length && !aboveText){
      const a=placed[0]; if(Math.hypot(a.cx-cx,a.cy-cy) <= (a.rad+rad) * 0.98) continue;
    }
    if(cx-rad<xMin||cx+rad>xMax||cy-rad<yMin||cy+rad>yMax) continue;
    ok=true;
  }
  placed.push({...u,cx,cy,rad});
}

/* refine tail if two shapes (intersect vs distance), then re-wrap/justify */
if(placed.length===2){
  const a=placed[0], b=placed[1];
  const d=Math.hypot(a.cx-b.cx,a.cy-b.cy);
  const rel = d < (a.rad+b.rad)*0.98 ? 'they intersect' : 'they keep their distance';
  CAP_GROUP.textContent='';
  const tail = rel + ', and ' + (aboveText ? 'they sit in front of the caption' : 'they sit below the caption') + '.';
  CAP_SENTENCE = parts.join(', ') + '; ' + tail;
  wrapJustify(CAP_GROUP, PAD, CAP_Y, CAP_SENTENCE, MAXW, CAP_FS, CAP_LH, CAP_WEIGHT);
}

/* clip so shapes can’t enter caption or footer areas (unless front-mode) */
let clipId=null;
if(!aboveText){
  clipId='clipBand';
  const defs=el('defs'); const cp=el('clipPath',{id:clipId});
  cp.appendChild(el('rect',{x:0,y:safeTop,width:W,height:Math.max(0, yMax - safeTop)})); // full width to avoid left/right cutoff
  defs.appendChild(cp); svg.appendChild(defs);
}

/* draw shapes */
const SG = el('g', clipId? {'clip-path':`url(#${clipId})`}:{});
svg.appendChild(SG);
const nodes=[];
for(const u of placed){
  const n=u.sh.draw(u.cx,u.cy,u.sz,PAL.fg,u.style/* opacity always 1 */);
  SG.appendChild(n); nodes.push({node:n,info:u});
}
if(aboveText){ svg.appendChild(SG); } // z-order front if stated

/* animate (tempo matches prose) */
(function animate(){
  const t0=performance.now();
  function f(){
    const t=(performance.now()-t0)/1000;
    for(const s of nodes){
      const {node,info}=s; const cx=info.cx, cy=info.cy, w=info.sz; const a=info.sh.anim; const rt=rate(a,info.tp);
      if(a==='spin'){ node.setAttribute('transform',`rotate(${(t*rt)%360} ${cx} ${cy})`); }
      else if(a==='tilt'){ const k=Math.sin(t*rt)*35; node.setAttribute('transform',`rotate(${k} ${cx} ${cy})`); }
      else if(a==='breath'){ const base=Math.max(8,Math.round(w*0.16)); node.setAttribute('stroke-width', Math.round(base*(1+0.18*Math.sin(t*rt)))); }
      else { const k=1+0.06*Math.sin(t*rt); node.setAttribute('transform',`translate(${cx*(1-k)} ${cy*(1-k)}) scale(${k})`); }
    }
    requestAnimationFrame(f);
  }
  requestAnimationFrame(f);
})();

/* ---------- metadata ---------- */
const md={project:'bootloader: self-portrait',seed_hex:seed_HEX,traits:{
  palette:PAL.name,shapeCount:placed.length,shapes:placed.map(u=>u.sh.k),
  styles:placed.map(u=>u.style),tempos:placed.map(u=>u.tp),
  frontOfCaption: aboveText, seedVisible: showSeed, edition: EDITION_TEXT
}};
svg.appendChild(el('metadata')).textContent=JSON.stringify(md);
svg.appendChild(el('desc')).textContent=`poster • ${PAL.name} • shapes:${placed.map(u=>u.sh.k).join(', ')} • seed:${(HAS_seed&&showSeed)?seed_HEX:'hidden'} • edition:${EDITION_TEXT}`;

}
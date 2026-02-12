const periods = [];

export function getPatternsPeriod() {
  return lcm(...periods);
}

function lcm(...numbers) {
  if (numbers.length === 0) return false;
  const gcd = (a, b) => b === 0 ? a : gcd(b, a % b);
  return numbers.reduce((a, b) => Math.abs(a * b) / gcd(a, b));
}

// Bit-pack (row-major) matrices to a 6-bit alphabet (Base64 chars) using known density d.
const _B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
const _REV = (() => {
  const r = new Uint8Array(128);
  for (let i = 0; i < _B64.length; i++) r[_B64.charCodeAt(i)] = i;
  return r;
})();

function decodeMatrix(enc) {
  const { w, h, inv, data } = enc;
  const total = w * h;
  const flat = new Array(total);
  let bitIndex = 0;
  for (let i = 0; i < data.length && bitIndex < total; i++) {
    const sextet = _REV[data.charCodeAt(i)];
    for (let b = 5; b >= 0 && bitIndex < total; b--) {
      let bit = (sextet >> b) & 1;
      if (inv) bit ^= 1;
      flat[bitIndex++] = bit;
    }
  }
  return flat;
}

const encodedPatterns = (() => {
  const patterns = [
    {w:2,h:4,d:0.25,inv:0,data:"oA"},
    {w:2,h:4,d:0.25,inv:0,data:"JA"},
    {w:2,h:4,d:0.875,inv:1,data:"gA"},
    {w:2,h:4,d:0.375,inv:0,data:"sA"},
    {w:2,h:4,d:0.375,inv:0,data:"oQ"},
    {w:2,h:4,d:0.5,inv:0,data:"Wg"},
    {w:2,h:4,d:0.625,inv:1,data:"kQ"},
    {w:2,h:4,d:0.25,inv:0,data:"hA"},
    {w:4,h:4,d:0.0625,inv:0,data:"gAA"},
    {w:4,h:4,d:0.125,inv:0,data:"gCA"},
    {w:4,h:4,d:0.1875,inv:0,data:"oCA"},
    {w:4,h:4,d:0.5,inv:0,data:"RU8"},
    {w:4,h:4,d:0.5,inv:0,data:"urA"},
    {w:4,h:4,d:0.8125,inv:1,data:"goA"},
    {w:4,h:4,d:0.3125,inv:0,data:"BQc"},
    {w:4,h:4,d:0.4375,inv:0,data:"Ii8"},
    {w:4,h:4,d:0.625,inv:1,data:"IC8"},
    {w:4,h:4,d:0.5625,inv:1,data:"KC8"},
    {w:4,h:4,d:0.125,inv:0,data:"BCA"},
    {w:4,h:4,d:0.25,inv:0,data:"FKA"},
    {w:4,h:4,d:0.3125,inv:0,data:"FEU"},
    {w:4,h:4,d:0.5625,inv:1,data:"6Kg"},
    {w:4,h:4,d:0.25,inv:0,data:"Ekg"},
    {w:4,h:4,d:0.4375,inv:0,data:"iI8"},
    {w:4,h:4,d:0.875,inv:1,data:"CCA"},
    {w:4,h:4,d:0.3125,inv:0,data:"6IA"},
    {w:4,h:4,d:0.375,inv:0,data:"SlI"},
    {w:4,h:4,d:0.75,inv:1,data:"QoI"},
    {w:4,h:4,d:0.625,inv:1,data:"wRw"},
    {w:4,h:4,d:0.375,inv:0,data:"pQU"},
    {w:4,h:4,d:0.6875,inv:1,data:"yAM"},
    {w:4,h:4,d:0.625,inv:1,data:"7IA"},
    {w:4,h:4,d:0.3125,inv:0,data:"4KA"},
    {w:4,h:4,d:0.5625,inv:1,data:"8kg"},
    {w:4,h:4,d:0.4375,inv:0,data:"sOg"},
    {w:4,h:4,d:0.1875,inv:0,data:"BKA"},
    {w:4,h:4,d:0.25,inv:0,data:"tAA"},
    {w:4,h:4,d:0.75,inv:1,data:"4AQ"},
    {w:4,h:4,d:0.25,inv:0,data:"ImA"},
    {w:4,h:4,d:0.75,inv:1,data:"BEY"},
    {w:4,h:4,d:0.5,inv:0,data:"NJs"},
    {w:4,h:4,d:0.5,inv:0,data:"y2Q"},
    {w:4,h:4,d:0.6875,inv:1,data:"ywA"},
    {w:4,h:4,d:0.4375,inv:0,data:"JyU"},
    {w:4,h:4,d:0.75,inv:1,data:"RIg"},
    {w:4,h:4,d:0.625,inv:1,data:"iFU"},
    {w:4,h:4,d:0.5,inv:0,data:"qHU"},
    {w:4,h:4,d:0.5,inv:0,data:"V4o"},
    {w:4,h:4,d:0.4375,inv:0,data:"VyI"},
    {w:8,h:8,d:0.5,inv:0,data:"+gr6CvoK+go"},
    {w:8,h:8,d:0.4375,inv:0,data:"6grqCuoK6go"},
    {w:8,h:8,d:0.25,inv:0,data:"/gD4AOAAgAA"},
    {w:8,h:8,d:0.875,inv:1,data:"jgCAAIQAgAA"},
    {w:8,h:8,d:0.84375,inv:1,data:"gASEEJAEhAA"},
    {w:8,h:8,d:0.8125,inv:1,data:"4AKEEJAEggA"},
    {w:8,h:8,d:0.625,inv:1,data:"ODIhlZUhMjg"},
    {w:8,h:8,d:0.78125,inv:1,data:"AAYBVVUBBgA"},
    {w:8,h:8,d:0.875,inv:1,data:"AAAAVVUAAAA"},
    {w:8,h:8,d:0.375,inv:0,data:"AP4BVVUB/gA"},
    {w:8,h:8,d:0.765625,inv:1,data:"BHEEUQRxBAA"},
    {w:8,h:8,d:0.625,inv:1,data:"pDGkMaQxpDE"},
    {w:8,h:8,d:0.5625,inv:1,data:"JjkmOSY5Jjk"},
    {w:8,h:8,d:0.75,inv:1,data:"ADxCQkJCPAA"},
    {w:8,h:8,d:0.375,inv:0,data:"gTxCWlpCPIE"},
    {w:8,h:8,d:0.375,inv:0,data:"QsM8JCQ8w0I"},
    {w:8,h:8,d:0.5625,inv:1,data:"WsM8JSU8w0I"},
    {w:8,h:8,d:0.5,inv:0,data:"pTzDWlrDPKU"},
    {w:8,h:8,d:0.5,inv:0,data:"/8OBgYGBw/8"},
    {w:8,h:8,d:0.5,inv:0,data:"ADx+fn5+PAA"},
    {w:8,h:8,d:0.375,inv:0,data:"ABg8fn48GAA"},
    {w:8,h:8,d:0.4375,inv:0,data:"8JCQ8A8PDw8"},
    {w:8,h:8,d:0.5,inv:0,data:"Dw8rD/DU8PA"},
    {w:8,h:8,d:0.5,inv:0,data:"Dw8PF+jw8PA"},
    {w:8,h:8,d:0.5,inv:0,data:"jk0rF+jUsnE"},
    {w:8,h:8,d:0.5,inv:0,data:"D1UrVarUqvA"},
    {w:8,h:8,d:0.4375,inv:0,data:"GGZapaVaZhg"},
    {w:8,h:8,d:0.65625,inv:1,data:"vr6AKiqAgIA"},
    {w:8,h:8,d:0.609375,inv:1,data:"voC+KgCqqoA"},
    {w:8,h:8,d:0.703125,inv:1,data:"AHBXcABVVQA"},
    {w:8,h:8,d:0.734375,inv:1,data:"1BLRANAQ0AA"},
    {w:8,h:8,d:0.8125,inv:1,data:"IkSIABEiRAA"},
    {w:8,h:8,d:0.6875,inv:1,data:"qkSqAFUiVQA"},
    {w:8,h:8,d:0.6875,inv:1,data:"M0SIZhEizAA"},
    {w:8,h:8,d:0.5625,inv:1,data:"ZgD/ACJViP8"},
    {w:8,h:8,d:0.40625,inv:0,data:"IgD/ACJViP8"},
    {w:8,h:8,d:0.53125,inv:1,data:"IiL/AKpViP8"},
    {w:8,h:8,d:0.65625,inv:1,data:"AAD/AKoAiP8"},
    {w:8,h:8,d:0.859375,inv:1,data:"AACoAKgAqAA"},
    {w:8,h:8,d:0.75,inv:1,data:"oCCgIL4AqgA"},
    {w:8,h:8,d:0.53125,inv:1,data:"rqquoL6A/gA"},
    {w:8,h:8,d:0.6875,inv:1,data:"QFBUVVVUUEA"},
    {w:8,h:8,d:0.6875,inv:1,data:"AGZmGBhmZgA"},
    {w:8,h:8,d:0.4375,inv:0,data:"GGZmmZlmZhg"},
    {w:8,h:8,d:0.5,inv:0,data:"ZpmZZmaZmWY"},
    {w:8,h:8,d:0.546875,inv:1,data:"AMDPCWlvYH8"},
    {w:8,h:8,d:0.484375,inv:0,data:"/5+Q8JCQn4A"},
    {w:8,h:8,d:0.734375,inv:1,data:"AKoAqgiqAKo"},
    {w:8,h:8,d:0.625,inv:1,data:"AL6AqoKqAvo"},
    {w:8,h:8,d:0.5625,inv:1,data:"AP4C+grqKqo"},
    {w:4,h:16,d:0.15625,inv:0,data:"QEBAYCAgIGA"},
    {w:4,h:16,d:0.1875,inv:0,data:"YGBgYCAgICA"},
    {w:4,h:16,d:0.859375,inv:1,data:"YCAgICAgICA"},
    {w:16,h:4,d:0.5,inv:0,data:"zMxmZjMzmZk"},
    {w:16,h:4,d:0.6875,inv:1,data:"DDAMMMMMwww"},
    {w:16,h:4,d:0.5,inv:0,data:"4cPDh4cPHjw"},
    {w:16,h:4,d:0.390625,inv:0,data:"xjFjGDGMGMY"},
    {w:16,h:4,d:0.125,inv:0,data:"CAAiAoCIACA"},
    {w:16,h:4,d:0.5,inv:0,data:"zMyqqlVVMzM"},
    {w:16,h:4,d:0.421875,inv:0,data:"pSlSlKlKVKU"},
    {w:16,h:4,d:0.65625,inv:1,data:"JJKSSUkkpJI"},
    {w:16,h:4,d:0.625,inv:1,data:"TEwzMcTEERM"},
    {w:16,h:4,d:0.625,inv:1,data:"wADDFttWGEY"},
    {w:16,h:4,d:0.5625,inv:1,data:"BwHB+B4P4eE"},
    {w:16,h:4,d:0.5,inv:0,data:"tKxaVsssLNM"},
    {w:16,h:4,d:0.34375,inv:0,data:"kApLZaSSUAk"},
    {w:16,h:4,d:0.609375,inv:1,data:"qgJUPah6APA"},
    {w:16,h:4,d:0.734375,inv:1,data:"CSREkRJIgSQ"},
    {w:16,h:4,d:0.4375,inv:0,data:"hKlqUpFVaqo"},
    {w:16,h:4,d:0.5,inv:0,data:"cnA5O9ycDk4"},
    {w:16,h:4,d:0.40625,inv:0,data:"8AEP/vABBVQ"},
    {w:16,h:4,d:0.59375,inv:1,data:"UXpROFUaVQg"},
    {w:16,h:4,d:0.6875,inv:1,data:"UIWpSlIlBBA"},
    {w:16,h:4,d:0.703125,inv:1,data:"QQmihFRCSDE"},
    {w:16,h:4,d:0.703125,inv:1,data:"ADGqmFVMAAY"},
    {w:16,h:4,d:0.875,inv:1,data:"AACgoAoKAAA"},
    {w:16,h:4,d:0.84375,inv:1,data:"AADg4AoKAAA"},
    {w:16,h:4,d:0.8125,inv:1,data:"QECEIEpKAAQ"},
    {w:16,h:4,d:0.5625,inv:1,data:"uKCKrq4gSro"}
  ];

  const invertedPatterns = patterns.map(p => {
      const p_ = {...p};
      p_.inv = p.inv === 0 ? 1 : 0;
      p_.d = 1 - p.d;
      return p_;
  });

  return [...patterns, ...invertedPatterns];
})();

const TransformOptions = [
  {
    name: 'id',
    T: [4],
    code: (x, y, R) => `uv.${x}`
  },
  {
    name: 'log',
    T: [32],
    code: (x, y, R) => {
      const amp = R.randomUniform(5, 50).toFixed(4);
      const f = R.randomUniform(2, 16).toFixed(4);
      return `${amp}*log(uv_sym.${x} + 1.)/log(${f})`;
    }
  },
  {
    name: 'scale',
    T: [16,32],
    code: (x, y, R) => {
      const f = R.randomUniform(2, 16).toFixed(4);
      return `uv_sym.${x}/(round(uv_sym.${x}/${f}) + 1.)`;
    }
  },
  {
    name: 'sqrt',
    T: [16, 32],
    code: (x, y, R) => {
      const f = R.randomUniform(1, 10).toFixed(4);
      return `uv_sym.${x} + ${f} * sqrt(uv_sym.${y} + 1.)`;
    }
  }
];     

export const vertexSource = `#version 300 es
in vec2 a_position;
in vec2 a_texcoord; 
out vec2 v_texcoord;
void main() {
    v_texcoord = a_texcoord;
    gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

export const fragmentSource = (R, isScrolling = false) => {
  return `#version 300 es
precision highp float;

const float PI = 3.141592653589793;

const vec3 col1 = vec3(215.0/255.0, 123.0/255.0, 186.0/255.0);
const vec3 col2 = vec3( 99.0/255.0, 155.0/255.0, 255.0/255.0);
const vec3 col3 = vec3(233.0/255.0, 193.0/255.0, 159.0/255.0);

uniform vec2 uResolution;
uniform float uPixelSize;
uniform float uTime;
uniform sampler2D uTexture;

in vec2 a_texcoord;

out vec4 fragColor;

const mat4 bayerMatrix = mat4(
    1.0 / 16.0,  9.0 / 16.0,  3.0 / 16.0, 11.0 / 16.0,
    13.0 / 16.0,  5.0 / 16.0, 15.0 / 16.0,  7.0 / 16.0,
    4.0 / 16.0, 12.0 / 16.0,  2.0 / 16.0, 10.0 / 16.0,
    16.0 / 16.0,  8.0 / 16.0, 14.0 / 16.0,  6.0 / 16.0
);

float orderedDither(vec2 uv, float value) {
    int x = int(mod(uv.x, 4.0));
    int y = int(mod(uv.y, 4.0));
    float threshold = bayerMatrix[y][x];
    return value < threshold ? 0.0 : 1.0;
}

${getPatternPalette(encodedPatterns, R, isScrolling).map((p, i) => generatePatternGLSL(p, R, `P${i}`)).join("\n\n")}

void main() {
    vec2 xy = floor(gl_FragCoord.xy/uPixelSize);
    vec2 xy_sym = abs(xy  - (uResolution - 1.) / 2.);
    vec2 uv = xy/uResolution.xy;
    ${R.rb(.5) ? 'uv.y = 1.0 - uv.y;' : ''}
    vec4 c = texture(uTexture, uv);

    float e = 0.001;
    if (length(c.rgb  - col1) < e) {
        c = vec4(vec3(P0(xy,xy_sym)), 1.0);
    } else if (length(c.rgb  - col2) < e) {
        c = vec4(vec3(P1(xy,xy_sym)), 1.0);
    } else if (length(c.rgb  - col3) < e) {
        c = vec4(vec3(P2(xy,xy_sym)), 1.0);
    } else {
      c = vec4(vec3(P3(xy,xy_sym)), 1.0);
    }

    fragColor = c;
    // fragColor = c.r == 0. ? vec4(0.0, 0.0, 1.0, 1.0) : vec4(1.0, 1.0, 1.0, 1.0);
}
`
}

function getPatternPalette(patterns, R, isScrolling = false) {
    const darkPatterns = patterns.filter(p => p.d < .33);
    const mediumPatterns = patterns.filter(p => p.d < .66 && p.d >= 0.33);
    const lightPatterns = patterns.filter(p => p.d >= .66);
    let patternPalette;

    while (true) {
      patternPalette = [
            R.randomPick(darkPatterns),
            R.randomPick(mediumPatterns),
            R.randomPick(lightPatterns),
      ];
      if (
        Math.abs(patternPalette[0].d - patternPalette[1].d) > .15 &&
        Math.abs(patternPalette[1].d - patternPalette[2].d) > .15
      ) {
        break;
      }
    }

    R.shuffle(patternPalette);

    const paletteSet = new Set(patternPalette);
    while (true) {
      const patternBg = R.randomPick(patterns);
      if (!paletteSet.has(patternBg)) { patternPalette.push(patternBg); break; }
    }

    if (!isScrolling && R.rb(.5))
      patternPalette[R.randomPick([0, 1, 2]) | 0].hasTransformation = true;

    if (R.rb(0.5))
      patternPalette[3].hasTransformation = true;

    return patternPalette;
}

function generatePatternGLSL(pattern, R, name = "patternCustom") {
  const { w, h } = pattern;
  const flat = decodeMatrix(pattern);
  const arrStr = flat.map(v => v ? "1.0" : "0.0").join(", ");

  const hasTransformation = pattern.hasTransformation;
  let fx, fy, Tx, Ty;
  while (!fx && !fy) {
    [fx, fy] = [0, 0].map(() => R.randomPick([-1, 0, 1]));
  }

  let code = `
const float ${name}ncol = ${w}.;
const float ${name}nrow = ${h}.;
const float ${name}Arr[${w * h}] = float[${w * h}](${arrStr});
float ${name}(vec2 uv, vec2 uv_sym) {`;

  if (!hasTransformation) {
    [Tx, Ty] = [0, 0].map(() => R.randomPick([4, 8]));
  } else {
    const isRotated = R.rb(.1);
    const hasBulge = R.rb(.5);
    const offset = [0, 0].map(() => R.randomUniform(0, 256));
    const filteredTransformations = isRotated ? TransformOptions.filter(t => t.name !== 'sqrt') : TransformOptions;
    const transform = [0, 0].map(() => R.randomPick(filteredTransformations));
    [Tx, Ty] = transform.map(t => R.randomPick(t.T));
    if (w == 16) Tx = Math.max(Tx, 16);
    if (h == 16) Ty = Math.max(Ty, 16);

    code += `
      float d = length(uv_sym);`;

    if (hasBulge) {
      code += bulgeCodeGLSL(R);
    }

    if (isRotated){
      const a = R.randomUniform(0, Math.PI);
      code += rotationCodeGLSL(a)
    }

    code += `
      uv = vec2(
        ${transform[0].code('x', 'y', R)},
        ${transform[1].code('y', 'x', R)}
      );
      uv += vec2(${offset[0]}, ${offset[1]});`;
  }

  if (!!fx) periods.push(w*Tx);
  if (!!fy) periods.push(h*Ty);

  [fx, fy, Tx, Ty] = [fx, fy, Tx, Ty].map(v => v.toFixed(2));

  code += `
      uv += vec2(${fx},${fy})*uTime/vec2(${Tx}, ${Ty});
      float x = floor(mod(uv.x, ${name}ncol));
      float y = floor(mod(uv.y, ${name}nrow));
      int index = int(y * ${name}ncol + x);
      return ${name}Arr[index];
}`;

  return code.trim();
}

function rotationCodeGLSL(a){
  return `
      mat2 rot = ${rotationMatrix(a)};
      uv *= rot;
      uv_sym *= rot;
      uv_sym = abs(uv_sym);`;
}

function rotationMatrix(a){
  return `mat2(cos(${a}), -sin(${a}), sin(${a}), cos(${a}))`;
}

function bulgeCodeGLSL(R){
  let code = `
  float r = ${R.randomUniform(100,300)};
    // float bulge_factor = 1.0 - d*d/r/r;
    float bulge_factor = (cos(PI*d/r) + 1.) / 2.;
    if (d <= r) {
      float strength = ${R.randomUniform(.5,1)*R.randomPick([-1,1]).toFixed(2)};
      uv_sym.xy = uv_sym.xy * (1.0 + strength * bulge_factor);
    }`;
  return code.trim();
}
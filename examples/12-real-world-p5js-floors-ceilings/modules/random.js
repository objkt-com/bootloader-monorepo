// (c) loackme <loic@loack.me>; MIT License (MIT)
// v 1.4 11-11-2024

export class Random {
  constructor(r = Math.random) {
    this.random = r;
    for (let i = 0; i < 30; i++) this.random(); // burn-in
  }

  rb(p, decimal = 6) {
    const f = 10 ** decimal;
    return Math.round(this.random() * f) / f < p;
  }

  randomUniform(vmin, vmax, decimal = 6) {
    const f = 10 ** decimal;
    let r = (vmax - vmin) * this.random() + vmin;
    return Math.round(r * f) / f;
  }

  randomGauss(m, std, range = [-Infinity, Infinity], decimal = 6) {
    const f = 10 ** decimal;
    let u1 = 0, u2 = 0;
    while (u1 === 0) u1 = this.random();
    while (u2 === 0) u2 = this.random();
    const r = Math.sqrt(-2.0 * Math.log(u1));
    const theta = 2 * Math.PI * u2;
    const u = r * Math.cos(theta);
    const v = m + std * u;
    if (v < range[0] || v > range[1]) {
      return this.randomGauss(m, std, range, decimal);
    }
    return Math.round(v * f) / f;
  }

  randomPick(values, W = false, decimal = 6) {
    if (!W) return values[this.randomUniform(0, values.length - 1e-10) | 0];
    const f = 10 ** decimal;
    W = W || new Array(values.length).fill(1);
    let sum = 0;
    for (let i = 0; i < W.length; i++) sum += W[i];
    if (sum == 0) return false;
    var p = (Math.round(f * this.random()) / f) * sum;
    for (let i = 0; i < W.length; i++) {
        p -= W[i];
        if (p <= 0) return values[i];
    }
  }

  shuffle(a) {
    for (var j, i = a.length - 1; i > 0; i--) {
      j = Math.floor(this.random() * (i + 1));
      var temp = a[i];
      a[i] = a[j];
      a[j] = temp;
    }
    return a;
  }
}


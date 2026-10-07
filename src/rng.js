/* bonedraw — seeded randomness and noise */
(function () {
  'use strict';
  const BD = (globalThis.BD = globalThis.BD || {});

  // cyrb128: string -> four 32-bit hashes
  function hashString(str) {
    let h1 = 1779033703, h2 = 3144134277, h3 = 1013904242, h4 = 2773480762;
    for (let i = 0, k; i < str.length; i++) {
      k = str.charCodeAt(i);
      h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
      h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
      h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
      h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
    }
    h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
    h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
    h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
    h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
    h1 ^= h2 ^ h3 ^ h4; h2 ^= h1; h3 ^= h1; h4 ^= h1;
    return [h1 >>> 0, h2 >>> 0, h3 >>> 0, h4 >>> 0];
  }

  function sfc32(a, b, c, d) {
    return function () {
      a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0;
      let t = (a + b) | 0;
      a = b ^ (b >>> 9);
      b = (c + (c << 3)) | 0;
      c = (c << 21) | (c >>> 11);
      d = (d + 1) | 0;
      t = (t + d) | 0;
      c = (c + t) | 0;
      return (t >>> 0) / 4294967296;
    };
  }

  // Each part of the drawing forks its own stream from the seed, so tweaking one
  // parameter doesn't reshuffle the randomness of every other part.
  class Rng {
    constructor(seed) {
      this.seed = String(seed);
      const h = hashString(this.seed);
      this._next = sfc32(h[0], h[1], h[2], h[3]);
      for (let i = 0; i < 15; i++) this._next();
    }
    fork(label) { return new Rng(this.seed + '␟' + label); }
    random() { return this._next(); }
    range(a, b) { return a + (b - a) * this._next(); }
    int(a, b) { return Math.floor(a + (b - a + 1) * this._next()); }
    chance(p) { return this._next() < p; }
    pick(arr) { return arr[Math.floor(this._next() * arr.length)]; }
    sign() { return this._next() < 0.5 ? -1 : 1; }
    jitter(x, amt) { return x + (this._next() * 2 - 1) * amt; }
    weighted(weights) {
      let total = 0;
      for (const k in weights) total += weights[k];
      let r = this._next() * total;
      for (const k in weights) { r -= weights[k]; if (r <= 0) return k; }
      return Object.keys(weights)[0];
    }
    // triangular distribution with mode c
    tri(a, b, c) {
      if (c === undefined) c = (a + b) / 2;
      const u = this._next(), f = (c - a) / (b - a);
      return u < f ? a + Math.sqrt(u * (b - a) * (c - a)) : b - Math.sqrt((1 - u) * (b - a) * (b - c));
    }
    gauss(m = 0, s = 1) {
      const u = 1 - this._next(), v = this._next();
      return m + s * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    }
  }

  // Seeded 2D Perlin noise, roughly in [-1, 1]
  class Noise {
    constructor(rng) {
      const p = new Uint8Array(256);
      for (let i = 0; i < 256; i++) p[i] = i;
      for (let i = 255; i > 0; i--) {
        const j = Math.floor(rng.random() * (i + 1));
        const t = p[i]; p[i] = p[j]; p[j] = t;
      }
      this.p = new Uint8Array(512);
      for (let i = 0; i < 512; i++) this.p[i] = p[i & 255];
    }
    noise2(x, y) {
      const p = this.p;
      const X = Math.floor(x) & 255, Y = Math.floor(y) & 255;
      x -= Math.floor(x); y -= Math.floor(y);
      const u = x * x * x * (x * (x * 6 - 15) + 10), v = y * y * y * (y * (y * 6 - 15) + 10);
      const g = (h, x, y) => {
        switch (h & 7) {
          case 0: return x + y; case 1: return -x + y; case 2: return x - y; case 3: return -x - y;
          case 4: return x; case 5: return -x; case 6: return y; default: return -y;
        }
      };
      const A = p[X] + Y, B = p[X + 1] + Y;
      const l1 = g(p[A], x, y) + u * (g(p[B], x - 1, y) - g(p[A], x, y));
      const l2 = g(p[A + 1], x, y - 1) + u * (g(p[B + 1], x - 1, y - 1) - g(p[A + 1], x, y - 1));
      return l1 + v * (l2 - l1);
    }
    fbm(x, y, oct = 4) {
      let s = 0, a = 0.5, f = 1, n = 0;
      for (let i = 0; i < oct; i++) { s += a * this.noise2(x * f, y * f); n += a; a *= 0.5; f *= 2.03; }
      return s / n;
    }
  }

  function randomSeed() {
    const c = 'abcdefghijkmnopqrstuvwxyz23456789';
    let s = '';
    for (let i = 0; i < 7; i++) s += c[Math.floor(Math.random() * c.length)];
    return s;
  }

  BD.hashString = hashString;
  BD.Rng = Rng;
  BD.Noise = Noise;
  BD.randomSeed = randomSeed;
})();

/* bonedraw — post looks: X-ray and cleared & stained, composited in a WebGL2 shader */
(function () {
  'use strict';
  const BD = (globalThis.BD = globalThis.BD || {});
  const { cos, sin, max, min, abs, round } = Math;

  // Two layers are drawn with the ordinary 2D canvas every frame, then a shader combines them:
  //   bones  (full size)    R = ossified bone, G = cartilage, B = soft edges. Drawn additively, so
  //                          overlapping bones and bone rims read denser, as they do on film.
  //   flesh  (quarter size) R = a capsule of soft tissue round every bone, sized by the bone's flesh
  //                          radius; G = webs (wing and flipper membranes). Blurred by mipmapping.
  // The shader turns that into film (X-ray) or into a cleared specimen with alizarin-red bone,
  // alcian-blue cartilage and amber, see-through flesh. It is plain GLSL ES 3.0, so it can move to a
  // GLSL TOP in TouchDesigner with the two layers as inputs.

  const LOOKS = ['xray', 'cleared'];
  const isPost = (style) => LOOKS.includes(style);

  const sel = (key, label, options, labels, looks, def) => ({ key, label, type: 'select', options, labels, looks, def });
  const rng = (key, label, min, max, looks, def, title) => ({ key, label, type: 'range', min, max, step: 0.01, looks, def, title });
  const SCHEMA = [
    sel('film', 'Film', ['negative', 'positive'], { negative: 'Negative (bright bone)', positive: 'Positive (dark bone)' }, ['xray'], 'negative'),
    sel('tint', 'Tint', ['cool', 'neutral', 'sepia', 'green'], null, ['xray'], 'cool'),
    sel('ground', 'Background', ['dark', 'light'], { dark: 'Dark', light: 'Light' }, ['cleared'], 'dark'),
    rng('ossified', 'Ossified', 0, 1, ['cleared'], 0.6, 'How much of the skeleton has turned to bone (red). The rest is cartilage (blue).'),
    rng('flesh', 'Flesh', 0, 1, ['xray', 'cleared'], 0.6, 'How much soft tissue shows round the bones'),
    rng('puff', 'Plumpness', 0.2, 2.5, ['xray', 'cleared'], 1, 'How far the flesh swells out from the bones'),
    rng('exposure', 'Exposure', 0.3, 3, ['xray'], 1.2),
    rng('glow', 'Glow', 0, 1.5, ['xray', 'cleared'], 0.6),
    rng('edge', 'Edge light', 0, 1.5, ['cleared'], 0.6, 'Light caught by the rim of the clear body'),
    rng('grain', 'Grain', 0, 0.3, ['xray', 'cleared'], 0.07),
    rng('vignette', 'Vignette', 0, 1, ['xray', 'cleared'], 0.45),
  ];
  function defaults(look) {
    const o = {};
    for (const s of SCHEMA) if (s.looks.includes(look)) o[s.key] = s.def;
    o.puff = 1.5;
    o.flesh = 0.7;
    if (look === 'cleared') { o.grain = 0.03; o.glow = 0.35; o.vignette = 0.3; o.puff = 1.3; }
    return o;
  }

  const hex = (h) => [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255];
  const XRAY = {
    negative: { cool: ['#04070c', '#d6ebff'], neutral: ['#070707', '#efefef'], sepia: ['#100a05', '#f4e2c4'], green: ['#020803', '#c4ffd2'] },
    positive: { cool: ['#dfe8ee', '#16222c'], neutral: ['#e9e8e4', '#1d1d1c'], sepia: ['#e8dcc4', '#2a2017'], green: ['#dde9dc', '#14261a'] },
  };
  const CLEARED = {
    dark: { bg: '#060709', flesh: '#f7c47c', rim: '#ffe6bf', boneA: '#f2557f', boneB: '#9c0b38', cartA: '#7fd2ff', cartB: '#1c47c9', text: '#d9c9b8' },
    light: { bg: '#f3efe6', flesh: '#e9b47c', rim: '#d98a4a', boneA: '#ec7aa0', boneB: '#a3103f', cartA: '#7cc2f0', cartB: '#1b4bb3', text: '#3b2b22' },
  };
  function palette(look, p) {
    if (look === 'xray') {
      const [bg, ink] = XRAY[p.film === 'positive' ? 'positive' : 'negative'][p.tint] || XRAY.negative.cool;
      return { bg, ink, light: p.film === 'positive', text: ink };
    }
    const c = CLEARED[p.ground === 'light' ? 'light' : 'dark'];
    return Object.assign({ light: p.ground === 'light' }, c);
  }
  const textColour = (look, p) => palette(look, Object.assign(defaults(look), p)).text;
  const background = (look, p) => palette(look, Object.assign(defaults(look), p)).bg;

  // ------------------------------------------------------------ per-rig data
  // maturity: 0 ossifies first (skull, trunk), 1 last (fin rays, fingertips, carpals)
  function prepare(rig) {
    if (rig._post) return rig._post;
    const B = rig.bones, n = B.length;
    const mat = new Float32Array(n);
    const nTail = B.filter((b) => b.role === 'tail').length;
    let tailK = 0;
    for (let i = 0; i < n; i++) {
      const b = B[i], kn = b.n > 1 ? b.k / (b.n - 1) : 0;
      let m;
      switch (b.role) {
        case 'skull': m = 0.12; break;
        case 'neck': m = 0.2; break;
        case 'trunk': m = 0.1 + 0.1 * kn; break;
        case 'tail': m = 0.2 + 0.55 * (tailK++ / Math.max(1, nTail - 1)); break;
        case 'rib': m = 0.3 + 0.25 * kn; break;
        case 'girdle': m = rig.meta.disc ? 0.55 : 0.35; break;
        case 'limb': m = b.seg === 0 ? 0.3 : b.seg === 1 ? 0.42 : b.seg === 2 ? 0.75 : 0.4 + 0.4 * kn; break;
        case 'digit': m = 0.5 + 0.4 * kn; break;
        case 'ray': m = 0.66 + 0.3 * kn; break;
        case 'horn': m = 0.45; break;
        default: m = 0.5;
      }
      if (rig.meta.disc) m += 0.12;
      m += ((BD.hashString('m' + i)[0] % 1000) / 1000 - 0.5) * 0.1;
      mat[i] = m;
    }
    // webs: rest points re-expressed in their bones' frames
    const webs = (rig.meta.webs || []).map((w) => w.map(([id, p]) => {
      const b = B[id], d = BD.geom.rot([p[0] - b.h[0], p[1] - b.h[1]], -b.a);
      return [id, d[0], d[1]];
    }));
    rig._post = { mat, webs };
    return rig._post;
  }

  // ------------------------------------------------------------ the two layers
  function drawBones(ctx, rig, T, V, W, H, o, ossified) {
    const pp = prepare(rig);
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const lw = 1.2 * (o.lineWeight || 1) * (o.pxScale || 1);
    const col = (it, a) => {
      if (it.kind === 'soft') return `rgba(0,0,255,${a})`;
      return pp.mat[it.bone] > ossified ? `rgba(0,255,0,${a})` : `rgba(255,0,0,${a})`;
    };
    // fills one by one (their overlaps are what makes density); thin strokes batched by look
    let batch = null, key = '';
    const flush = () => { if (batch) { ctx.strokeStyle = batch.c; ctx.lineWidth = batch.w; ctx.stroke(batch.p); batch = null; key = ''; } };
    BD.draw.eachItem(rig, T, V, (it, w, holes) => {
      if (it.fill) {
        flush();
        const p = new Path2D();
        p.moveTo(w[0], w[1]);
        for (let j = 2; j < w.length; j += 2) p.lineTo(w[j], w[j + 1]);
        p.closePath();
        if (holes) for (const h of holes) { p.moveTo(h[0], h[1]); for (let j = 2; j < h.length; j += 2) p.lineTo(h[j], h[j + 1]); p.closePath(); }
        ctx.fillStyle = col(it, 0.42);
        ctx.fill(p, 'evenodd');
        ctx.strokeStyle = col(it, 0.85);
        ctx.lineWidth = lw * it.w;
        ctx.stroke(p);
        return;
      }
      const a = it.kind === 'ray' ? 0.9 : it.kind === 'soft' ? 0.6 : it.kind === 'shade' ? 0.22 : 0.4;
      const c = col(it, a), wd = lw * it.w * (it.kind === 'ray' ? 0.8 : 0.6), k = c + wd;
      if (k !== key) { flush(); batch = { p: new Path2D(), c, w: wd }; key = k; }
      batch.p.moveTo(w[0], w[1]);
      for (let j = 2; j < w.length; j += 2) batch.p.lineTo(w[j], w[j + 1]);
      if (it.closed) batch.p.closePath();
    });
    flush();
    ctx.globalCompositeOperation = 'source-over';
  }

  function drawFlesh(ctx, rig, T, V, W, H, k, puff) {
    const pp = prepare(rig);
    const B = rig.bones;
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    const s = V.s * k, tx = V.tx * k, ty = V.ty * k;
    // two passes: a wide, faint envelope and a denser core, so flesh is thicker over the middle of a limb
    for (const [rad, a] of [[1, 0.3], [0.55, 0.32]]) {
      ctx.strokeStyle = `rgba(255,0,0,${a})`;
      ctx.fillStyle = ctx.strokeStyle;
      for (const b of B) {
        if (!b.flesh) continue;
        const i = b.id, L = b.len * (T.S ? T.S[i] : 1);
        const x0 = T.X[i] * s + tx, y0 = T.Y[i] * s + ty;
        const x1 = x0 + cos(T.A[i]) * L * s, y1 = y0 + sin(T.A[i]) * L * s;
        const r = max(0.6, b.flesh * puff * rad * s);
        ctx.lineWidth = 2 * r;
        ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1 + 0.01, y1); ctx.stroke();
      }
    }
    // webs between bones
    ctx.fillStyle = 'rgba(0,255,0,0.55)';
    for (const web of pp.webs) {
      ctx.beginPath();
      web.forEach(([id, lx, ly], j) => {
        const S = T.S ? T.S[id] : 1, c = cos(T.A[id]), sn = sin(T.A[id]);
        const x = (T.X[id] + lx * S * c - ly * sn) * s + tx, y = (T.Y[id] + lx * S * sn + ly * c) * s + ty;
        if (j) ctx.lineTo(x, y); else ctx.moveTo(x, y);
      });
      ctx.closePath();
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  // ------------------------------------------------------------ WebGL2
  const VERT = `#version 300 es
in vec2 aPos;
out vec2 vUv;
void main() { vUv = aPos * 0.5 + 0.5; gl_Position = vec4(aPos, 0.0, 1.0); }`;

  const FRAG = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uBone;
uniform sampler2D uFlesh;
uniform vec2 uRes;
uniform float uScale;   // output width / 1000, keeps blur radii the same at any size
uniform float uTime;
uniform float uLook;    // 0 x-ray, 1 cleared & stained
uniform float uLight;   // 1: light ground (subtractive), 0: dark ground (emissive)
uniform float uFleshAmt, uGlow, uExposure, uGrain, uVignette, uEdge;
uniform vec3 uBg, uInk, uFleshCol, uRimCol, uBoneA, uBoneB, uCartA, uCartB;

float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }

void main() {
  vec2 uv = vUv;
  float lv = log2(max(1.0, uScale));
  vec4 b = texture(uBone, uv);
  vec4 g1 = textureLod(uBone, uv, 2.0 + lv);
  vec4 g2 = textureLod(uBone, uv, 4.0 + lv);
  vec2 fs = 1.0 / vec2(textureSize(uFlesh, 0));
  float fl = 1.3;
  vec4 F = textureLod(uFlesh, uv, fl);
  float f = F.r, web = F.g;
  float fx = textureLod(uFlesh, uv + vec2(3.0 * fs.x, 0.0), fl).r - textureLod(uFlesh, uv - vec2(3.0 * fs.x, 0.0), fl).r;
  float fy = textureLod(uFlesh, uv + vec2(0.0, 3.0 * fs.y), fl).r - textureLod(uFlesh, uv - vec2(0.0, 3.0 * fs.y), fl).r;
  float grad = length(vec2(fx, fy));
  vec3 col;
  if (uLook < 0.5) {
    // X-ray: everything is density; bone dense, flesh faint, a halo of scattered light round the bone
    float dens = b.r + b.g * 0.85 + b.b * 0.3;
    float flesh = (smoothstep(0.0, 0.9, f) * 0.85 + web * 0.4) * uFleshAmt;
    float halo = (g1.r + g1.g) * 0.55 + (g2.r + g2.g) * 0.45;
    float v = flesh * 0.9 + dens * 0.95 + halo * uGlow * 0.55;
    v = 1.0 - exp(-v * uExposure);
    col = mix(uBg, uInk, v);
  } else {
    // cleared & stained: a clear amber body with a lit rim, red bone, blue cartilage
    float body = smoothstep(0.05, 0.2, f + web * 0.45);
    float thick = smoothstep(0.1, 1.1, f);
    float rim = clamp(grad * 5.0, 0.0, 1.0) * body;
    // stain soaks in deepest at the dense rim of each bone; thin interiors stay see-through
    vec3 boneC = mix(uBoneA, uBoneB, smoothstep(0.35, 1.1, b.r));
    vec3 cartC = mix(uCartA, uCartB, smoothstep(0.35, 1.1, b.g));
    float ba = smoothstep(0.02, 0.45, b.r) * mix(0.62, 1.0, smoothstep(0.45, 0.95, b.r));
    float ca = smoothstep(0.02, 0.45, b.g) * mix(0.62, 1.0, smoothstep(0.45, 0.95, b.g));
    if (uLight < 0.5) {
      col = uBg;
      col = mix(col, uFleshCol, body * uFleshAmt * (0.14 + 0.4 * thick + 0.12 * web));
      col += uRimCol * rim * uEdge * 0.9;
      col = mix(col, cartC, ca * 0.9);
      col = mix(col, boneC, ba * 0.95);
      col += (uBoneB * g1.r + uCartB * g1.g) * uGlow * 0.7 + (uBoneA * g2.r + uCartA * g2.g) * uGlow * 0.35;
      col += vec3(1.0, 0.9, 0.8) * b.b * 0.12;
    } else {
      col = uBg;
      col *= mix(vec3(1.0), uFleshCol, body * uFleshAmt * (0.3 + 0.45 * thick + 0.15 * web));
      col *= mix(vec3(1.0), uRimCol, rim * uEdge * 0.45);
      col *= mix(vec3(1.0), cartC, ca * 0.9);
      col *= mix(vec3(1.0), boneC, ba * 0.95);
      col *= 1.0 - (g1.r + g1.g) * uGlow * 0.08;
    }
  }
  float gr = hash(uv * uRes + fract(uTime * 7.13) * 91.7) - 0.5;
  col += gr * uGrain;
  float d = length(uv - 0.5);
  col *= mix(1.0, 1.0 - smoothstep(0.3, 0.85, d) * 0.85, uVignette);
  outColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}`;

  class Renderer {
    constructor() {
      this.cv = document.createElement('canvas');
      const gl = this.cv.getContext('webgl2', { preserveDrawingBuffer: true, antialias: false, premultipliedAlpha: false });
      if (!gl) throw new Error('WebGL2 unavailable');
      this.gl = gl;
      const sh = (type, src) => {
        const s = gl.createShader(type);
        gl.shaderSource(s, src);
        gl.compileShader(s);
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
        return s;
      };
      const prog = gl.createProgram();
      gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT));
      gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FRAG));
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
      this.prog = prog;
      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      const loc = gl.getAttribLocation(prog, 'aPos');
      this.vao = gl.createVertexArray();
      gl.bindVertexArray(this.vao);
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      this.tex = [gl.createTexture(), gl.createTexture()];
      this.u = {};
      const n = gl.getProgramParameter(prog, gl.ACTIVE_UNIFORMS);
      for (let i = 0; i < n; i++) { const nm = gl.getActiveUniform(prog, i).name; this.u[nm] = gl.getUniformLocation(prog, nm); }
      this.bone = document.createElement('canvas');
      this.flesh = document.createElement('canvas');
    }
    upload(unit, canvas) {
      const gl = this.gl;
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, this.tex[unit]);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
      gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    }
    render(rig, T, V, W, H, look, params, o) {
      const p = Object.assign(defaults(look), params);
      const pal = palette(look, p);
      const fk = 0.25;
      const FW = max(8, round(W * fk)), FH = max(8, round(H * fk));
      for (const [c, w, h] of [[this.cv, W, H], [this.bone, W, H], [this.flesh, FW, FH]]) if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
      drawBones(this.bone.getContext('2d'), rig, T, V, W, H, o, look === 'cleared' ? p.ossified : 2);
      drawFlesh(this.flesh.getContext('2d'), rig, T, V, FW, FH, FW / W, p.puff);
      const gl = this.gl;
      gl.viewport(0, 0, W, H);
      gl.useProgram(this.prog);
      this.upload(0, this.bone);
      this.upload(1, this.flesh);
      const u = this.u;
      gl.uniform1i(u.uBone, 0);
      gl.uniform1i(u.uFlesh, 1);
      gl.uniform2f(u.uRes, W, H);
      gl.uniform1f(u.uScale, W / 1000);
      gl.uniform1f(u.uTime, o.time || 0);
      gl.uniform1f(u.uLook, look === 'xray' ? 0 : 1);
      gl.uniform1f(u.uLight, pal.light ? 1 : 0);
      gl.uniform1f(u.uFleshAmt, p.flesh);
      gl.uniform1f(u.uGlow, p.glow);
      gl.uniform1f(u.uExposure, p.exposure || 1);
      gl.uniform1f(u.uGrain, p.grain);
      gl.uniform1f(u.uVignette, p.vignette);
      gl.uniform1f(u.uEdge, p.edge || 0);
      const v3 = (name, h) => { if (u[name] && h) gl.uniform3fv(u[name], hex(h)); };
      v3('uBg', pal.bg); v3('uInk', pal.ink || '#ffffff');
      v3('uFleshCol', pal.flesh || '#000000'); v3('uRimCol', pal.rim || '#000000');
      v3('uBoneA', pal.boneA || '#ffffff'); v3('uBoneB', pal.boneB || '#ffffff');
      v3('uCartA', pal.cartA || '#ffffff'); v3('uCartB', pal.cartB || '#ffffff');
      gl.bindVertexArray(this.vao);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      return this.cv;
    }
  }

  let shared = null, failed = false;
  // draw the look into a 2D context (the visible canvas, an export canvas or a grid cell)
  function paint(ctx, rig, T, V, o) {
    if (!shared && !failed) {
      try { shared = new Renderer(); } catch (e) { failed = true; console.warn('bonedraw: post looks need WebGL2', e); }
    }
    if (!shared) return false;
    const out = shared.render(rig, T, V, o.W, o.H, o.look, o.params || {}, o);
    ctx.drawImage(out, 0, 0);
    return true;
  }

  BD.post = { LOOKS, SCHEMA, isPost, defaults, paint, textColour, background, FRAG };
})();

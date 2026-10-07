/* bonedraw — frame-exact video and GIF export: every frame is drawn at its exact time, then encoded */
(function () {
  'use strict';
  const BD = (globalThis.BD = globalThis.BD || {});

  // The two encoders ship in vendor/ and load only when someone exports. The CDN copies are a fallback.
  const LIBS = {
    mp4: [new URL('vendor/mp4-muxer.mjs', document.baseURI).href, 'https://cdn.jsdelivr.net/npm/mp4-muxer@5.2.2/build/mp4-muxer.mjs'],
    gif: [new URL('vendor/gifenc.esm.js', document.baseURI).href, 'https://cdn.jsdelivr.net/npm/gifenc@1.0.3/dist/gifenc.esm.js'],
  };
  async function load(name) {
    let err;
    for (const url of LIBS[name]) { try { return await import(url); } catch (e) { err = e; } }
    throw new Error('Could not load the ' + name + ' encoder: ' + (err && err.message ? err.message : err));
  }
  const QUALITY = { standard: 0.08, high: 0.16, max: 0.3 }; // bits per pixel per frame
  // yield to the page between frames. A message channel isn't throttled in background tabs the way
  // chained timers are, so a long render keeps going if you switch away.
  const chan = new MessageChannel(), waiting = [];
  chan.port1.onmessage = () => { const r = waiting.shift(); if (r) r(); };
  const tick = () => new Promise((r) => { waiting.push(r); chan.port2.postMessage(0); });
  const even = (n) => Math.max(2, Math.round(n / 2) * 2);

  const canMP4 = () => typeof VideoEncoder !== 'undefined' && typeof VideoFrame !== 'undefined';

  async function pickCodec(W, H, fps, bitrate) {
    // High profile first, then Main, then Baseline, at levels big enough for the frame
    for (const codec of ['avc1.640034', 'avc1.640033', 'avc1.64002A', 'avc1.4D0034', 'avc1.4D0033', 'avc1.42003E', 'avc1.42002A']) {
      try {
        const s = await VideoEncoder.isConfigSupported({ codec, width: W, height: H, bitrate, framerate: fps });
        if (s.supported) return codec;
      } catch (e) { /* try the next */ }
    }
    throw new Error('This browser cannot encode H.264 at ' + W + '×' + H + '. Try a smaller size.');
  }

  // o: { size, fps, frames, quality, draw(canvas, i), progress(f), cancelled() }
  async function mp4(o) {
    if (!canMP4()) throw new Error('This browser has no video encoder (WebCodecs).');
    const { Muxer, ArrayBufferTarget } = await load('mp4');
    const W = even(o.size), H = even(o.size), fps = o.fps;
    const bitrate = Math.min(80e6, Math.round(W * H * fps * (QUALITY[o.quality] || QUALITY.high)));
    const codec = await pickCodec(W, H, fps, bitrate);
    const muxer = new Muxer({ target: new ArrayBufferTarget(), video: { codec: 'avc', width: W, height: H, frameRate: fps }, fastStart: 'in-memory' });
    let failure = null;
    const enc = new VideoEncoder({ output: (chunk, meta) => muxer.addVideoChunk(chunk, meta), error: (e) => { failure = e; } });
    enc.configure({ codec, width: W, height: H, bitrate, framerate: fps, latencyMode: 'quality', avc: { format: 'avc' } });
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const dur = Math.round(1e6 / fps);
    try {
      for (let i = 0; i < o.frames; i++) {
        if (o.cancelled()) throw new Error('cancelled');
        if (failure) throw failure;
        o.draw(cv, i);
        const vf = new VideoFrame(cv, { timestamp: i * dur, duration: dur });
        enc.encode(vf, { keyFrame: i % (fps * 2) === 0 });
        vf.close();
        while (enc.encodeQueueSize > 4) await tick();
        o.progress((i + 1) / o.frames);
        if (i % 3 === 0) await tick();
      }
      await enc.flush();
      if (failure) throw failure;
    } finally {
      if (enc.state !== 'closed') enc.close();
    }
    muxer.finalize();
    return new Blob([muxer.target.buffer], { type: 'video/mp4' });
  }

  // GIFs get one palette for the whole loop, taken from frames across it, so colours don't flicker
  async function gif(o) {
    const { GIFEncoder, quantize, applyPalette } = await load('gif');
    const W = o.size, H = o.size;
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d', { willReadFrequently: true });
    const grab = () => ctx.getImageData(0, 0, W, H).data;
    const picks = [0, Math.floor(o.frames / 3), Math.floor((2 * o.frames) / 3)];
    const step = 3;
    const sample = new Uint8ClampedArray(Math.ceil((W * H) / step) * 4 * picks.length);
    let off = 0;
    for (const f of picks) {
      o.draw(cv, f);
      const d = grab();
      for (let p = 0; p < W * H; p += step) { sample[off++] = d[p * 4]; sample[off++] = d[p * 4 + 1]; sample[off++] = d[p * 4 + 2]; sample[off++] = 255; }
      await tick();
    }
    const palette = quantize(sample.subarray(0, off), 256, { format: 'rgb565' });
    const enc = GIFEncoder();
    const delay = Math.round(1000 / o.fps);
    for (let i = 0; i < o.frames; i++) {
      if (o.cancelled()) throw new Error('cancelled');
      o.draw(cv, i);
      const index = applyPalette(grab(), palette, 'rgb565');
      enc.writeFrame(index, W, H, i === 0 ? { palette, delay, repeat: 0 } : { delay });
      o.progress((i + 1) / o.frames);
      if (i % 2 === 0) await tick();
    }
    enc.finish();
    return new Blob([enc.bytes()], { type: 'image/gif' });
  }

  BD.exporter = { LIBS, QUALITY, canMP4, mp4, gif };
})();

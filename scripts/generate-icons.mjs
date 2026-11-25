// Gera favicon.svg e ícones PNG do ARANDU sem dependências externas (rasterização própria + zlib).
// Logotipo: "A" em forma de oca indígena, estilo flat (ver scripts/logo-geometry.mjs).
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ROOF, WINDOW, DOOR, POLE, GROUND, BG_STOPS, buildSvg } from './logo-geometry.mjs';

const pub = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');
const out = join(pub, 'icons');
mkdirSync(out, { recursive: true });

// ---------- PNG ----------
const crcTable = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => { let c = 0xffffffff; for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (type, data) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
};
const png = (size, px) => {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 6;
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) px.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
};

// ---------- Geometria → polígonos ----------
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const bez = (p0, p1, p2, p3, t) => {
  const m = 1 - t;
  return [0, 1].map((k) => m * m * m * p0[k] + 3 * m * m * t * p1[k] + 3 * m * t * t * p2[k] + t * t * t * p3[k]);
};
const right = Array.from({ length: 64 }, (_, i) => bez(ROOF.top, ROOF.c1, ROOF.c2, ROOF.base, i / 63));
const roofPoly = [...right, ...right.slice().reverse().map(([x, y]) => [100 - x, y])];
const r = (DOOR.x1 - DOOR.x0) / 2, cx = (DOOR.x0 + DOOR.x1) / 2;
const doorPoly = [[DOOR.x0, DOOR.yBase], [DOOR.x0, DOOR.yTop],
  ...Array.from({ length: 32 }, (_, i) => { const a = Math.PI - (i / 31) * Math.PI; return [cx + r * Math.cos(a), DOOR.yTop - r * Math.sin(a)]; }),
  [DOOR.x1, DOOR.yTop], [DOOR.x1, DOOR.yBase]];
const inPoly = (x, y, poly) => {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
};
const inRect = (x, y, q, rad = 0) => {
  if (x < q.x0 || x > q.x1 || y < q.y0 || y > q.y1) return false;
  if (!rad) return true;
  const qx = Math.max(q.x0 + rad - x, 0, x - (q.x1 - rad)), qy = Math.max(q.y0 + rad - y, 0, y - (q.y1 - rad));
  return qx * qx + qy * qy <= rad * rad;
};
const isWhite = (x, y) =>
  inRect(x, y, POLE, 1.4) || inRect(x, y, GROUND, 1.5) ||
  (inPoly(x, y, roofPoly) && !inPoly(x, y, WINDOW) && !inPoly(x, y, doorPoly));
const inBgRoundRect = (x, y) => inRect(x, y, { x0: 0, y0: 0, x1: 100, y1: 100 }, 22);

const [c0, c1] = BG_STOPS.map(hex);
function draw(size, { maskable = false } = {}) {
  const px = Buffer.alloc(size * size * 4);
  const ss = 4;
  const k = maskable ? 0.8 : 1; // ícone maskable: desenho dentro da zona segura
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    let R = 0, G = 0, B = 0, A = 0;
    for (let sy = 0; sy < ss; sy++) for (let sx = 0; sx < ss; sx++) {
      const u = ((x + (sx + 0.5) / ss) / size) * 100, v = ((y + (sy + 0.5) / ss) / size) * 100;
      if (!maskable && !inBgRoundRect(u, v)) continue;
      const gu = 50 + (u - 50) / k, gv = 50 + (v - 50) / k;
      const t = Math.min(1, Math.max(0, (u + v) / 200));
      let col = [0, 1, 2].map((i) => c0[i] + (c1[i] - c0[i]) * t);
      if (isWhite(gu, gv)) col = [255, 255, 255];
      R += col[0]; G += col[1]; B += col[2]; A += 1;
    }
    const n = ss * ss, i = (y * size + x) * 4;
    if (A) { px[i] = R / A; px[i + 1] = G / A; px[i + 2] = B / A; }
    px[i + 3] = (A / n) * 255;
  }
  return png(size, px);
}

for (const s of [64, 192, 512]) writeFileSync(join(out, `icon-${s}.png`), draw(s));
writeFileSync(join(out, 'maskable-512.png'), draw(512, { maskable: true }));
writeFileSync(join(out, 'apple-touch-icon.png'), draw(180, { maskable: true }));
writeFileSync(join(pub, 'favicon.svg'), buildSvg());
writeFileSync(join(pub, 'logo-mark.svg'), buildSvg({ background: false }));
console.log('[arandu] favicon.svg, logo-mark.svg e ícones PNG gerados');

// Imagem de compartilhamento (Open Graph) 1200×630 para a landing page: fundo verde com brilho
// e o logotipo ao centro.
function drawOg(W = 1200, H = 630) {
  const px = Buffer.alloc(W * H * 4);
  const S = 340, ox = (W - S) / 2, oy = (H - S) / 2;
  const ss = 3;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let R = 0, G = 0, B = 0;
    for (let sy = 0; sy < ss; sy++) for (let sx = 0; sx < ss; sx++) {
      const fx = x + (sx + 0.5) / ss, fy = y + (sy + 0.5) / ss;
      // fundo: gradiente diagonal escuro + halo esmeralda
      const t = Math.min(1, Math.max(0, (fx / W + fy / H) / 2));
      const glow = Math.max(0, 1 - Math.hypot(fx - W / 2, fy - H / 2) / 520) ** 2;
      let col = [3 + 5 * t + 30 * glow, 42 + 30 * t + 120 * glow, 33 + 20 * t + 80 * glow];
      const u = ((fx - ox) / S) * 100, v = ((fy - oy) / S) * 100;
      if (u >= 0 && u <= 100 && v >= 0 && v <= 100 && inBgRoundRect(u, v)) {
        const tt = Math.min(1, Math.max(0, (u + v) / 200));
        col = [0, 1, 2].map((i) => c0[i] + (c1[i] - c0[i]) * tt);
        if (isWhite(u, v)) col = [255, 255, 255];
      }
      R += col[0]; G += col[1]; B += col[2];
    }
    const n = ss * ss, i = (y * W + x) * 4;
    px[i] = Math.min(255, R / n); px[i + 1] = Math.min(255, G / n); px[i + 2] = Math.min(255, B / n); px[i + 3] = 255;
  }
  // PNG retangular
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 6;
  const raw = Buffer.alloc((W * 4 + 1) * H);
  for (let y = 0; y < H; y++) px.copy(raw, y * (W * 4 + 1) + 1, y * W * 4, (y + 1) * W * 4);
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}
mkdirSync(join(pub, '..', 'site', 'assets'), { recursive: true });
writeFileSync(join(pub, '..', 'site', 'assets', 'og-image.png'), drawOg());
console.log('[arandu] site/assets/og-image.png gerado');

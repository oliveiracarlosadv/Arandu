// Geometria única do logotipo ARANDU (o "A" em forma de oca indígena), num quadro 100×100.
// Usada tanto para gerar o SVG (favicon/logo) quanto para rasterizar os PNGs do PWA.
export const BG_STOPS = ['#053b2c', '#0f9f6e']; // verde profundo → esmeralda

// Cobertura ogival da oca (lado direito em Bézier cúbica; o esquerdo é espelhado).
export const ROOF = { top: [50, 22], c1: [57.5, 40], c2: [80, 57], base: [80, 78] };
// Abertura triangular (o "olho" do A / respiro da oca).
export const WINDOW = [[50, 38], [55.6, 48.5], [44.4, 48.5]];
// Porta em arco (o vão entre as "pernas" do A).
export const DOOR = { x0: 42, x1: 58, yTop: 63, yBase: 78 }; // arco de raio 8 sobre yTop
// Mastro no topo da oca.
export const POLE = { x0: 48.6, x1: 51.4, y0: 11, y1: 24 };
// Linha do chão.
export const GROUND = { x0: 15, x1: 85, y0: 81.5, y1: 84.5 };

export const svgPaths = () => {
  const { top, c1, c2, base } = ROOF;
  const roof = `M${top} C${c1} ${c2} ${base} L${100 - base[0]},${base[1]} C${100 - c2[0]},${c2[1]} ${100 - c1[0]},${c1[1]} ${top}Z`;
  const win = `M${WINDOW[0]} L${WINDOW[1]} L${WINDOW[2]}Z`;
  const r = (DOOR.x1 - DOOR.x0) / 2;
  const door = `M${DOOR.x0},${DOOR.yBase} V${DOOR.yTop} A${r},${r} 0 0 1 ${DOOR.x1},${DOOR.yTop} V${DOOR.yBase}Z`;
  return { roof, win, door };
};

export function buildSvg({ background = true } = {}) {
  const { roof, win, door } = svgPaths();
  const g = `<linearGradient id="g" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="100" y2="100"><stop offset="0" stop-color="${BG_STOPS[0]}"/><stop offset="1" stop-color="${BG_STOPS[1]}"/></linearGradient>`;
  const hole = background ? 'url(#g)' : '#053b2c';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs>${g}</defs>${background ? '<rect width="100" height="100" rx="22" fill="url(#g)"/>' : ''}<g fill="#fff"><rect x="${POLE.x0}" y="${POLE.y0}" width="${POLE.x1 - POLE.x0}" height="${POLE.y1 - POLE.y0}" rx="1.4"/><path d="${roof}"/><rect x="${GROUND.x0}" y="${GROUND.y0}" width="${GROUND.x1 - GROUND.x0}" height="${GROUND.y1 - GROUND.y0}" rx="1.5"/></g><path d="${win}" fill="${hole}"/><path d="${door}" fill="${hole}"/></svg>`;
}

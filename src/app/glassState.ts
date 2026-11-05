import { PRESETS, normalizeParams, setGridMode, type GlassParams, type PlateParams, type PresetName } from '../glass';

/** Готовые наборы в панели «Ещё». Первый — набор по умолчанию, «Классика» — стекло по сверке с кадрами. */
export const PRESET_LIST: [PresetName, string][] = [
  ['caricature', 'Карикатура'],
  ['video', 'Классика'],
  ['mosaic', 'Мозаика'],
  ['loupe', 'Лупа'],
  ['bigLenses', 'Линзы'],
  ['frosted', 'Матовое'],
  ['faceted', 'Гранёное'],
  ['kaleidoscope', 'Калейдо­скоп'],
  ['handmade', 'Ручная работа'],
];

/** Пластина по центру на долю кадра k; 1 — ровно во весь кадр. */
export function framePlate(width: number, height: number, k: number): PlateParams {
  const side = Math.min(width, height);
  return { x: 0.5, y: 0.5, width: (k * width) / side, height: (k * height) / side, rotation: 0 };
}

/** Пластина по умолчанию — во весь кадр: крупные искажения видны сразу. */
export const startPlate = (w: number, h: number) => framePlate(w, h, 1);

export function defaultParams(w: number, h: number): GlassParams {
  return { ...structuredClone(PRESETS.caricature), plate: startPlate(w, h) };
}

/** Стекло, с которым пример открывается на экране и в превью на главной. */
export function exampleParams(ex: { look: PresetName; plate?: Partial<PlateParams> }, w: number, h: number): GlassParams {
  return { ...structuredClone(PRESETS[ex.look]), plate: { ...startPlate(w, h), ...ex.plate } };
}

export function isFullFrame(p: PlateParams, w: number, h: number): boolean {
  const f = framePlate(w, h, 1);
  const near = (a: number, b: number) => Math.abs(a - b) < 1e-3;
  return near(p.x, f.x) && near(p.y, f.y) && near(p.width, f.width) && near(p.height, f.height) && near(p.rotation, 0);
}

/** Набор меняет стекло, пластина остаётся там, где её поставили. */
export function applyPreset(p: GlassParams, name: PresetName): GlassParams {
  // Набор меняет «вид» стекла; форма ячеек — отдельный выбор в доке, набор её не сбрасывает.
  const { shape, shapeSeed, stripeAngle, circleGap } = p;
  return { ...structuredClone(PRESETS[name]), shape, shapeSeed, stripeAngle, circleGap, plate: { ...p.plate } };
}

const SHAPE_KEYS: (keyof GlassParams)[] = ['shape', 'shapeSeed', 'stripeAngle', 'circleGap'];

export function samePreset(p: GlassParams, name: PresetName): boolean {
  const ref = PRESETS[name] as GlassParams;
  return (Object.keys(ref) as (keyof GlassParams)[]).every((k) => SHAPE_KEYS.includes(k) || k === 'plate' || ref[k] === p[k]);
}

const rnd = (a: number, b: number) => a + Math.random() * (b - a);

/** «Случайно»: стекло в пределах, где картинка ещё читается; пластину не трогаем. */
export function randomGlass(p: GlassParams): GlassParams {
  const base = setGridMode(p, 'size');
  return normalizeParams({
    ...base,
    cellSize: Math.exp(rnd(Math.log(0.035), Math.log(0.2))),
    zoom: rnd(0.9, 2.3),
    loupe: rnd(0, 0.6),
    squareness: rnd(0.2, 1),
    irregularity: rnd(0.1, 0.9),
    seamSoftness: rnd(0, 0.45),
    bevel: Math.random() < 0.25 ? rnd(0.06, 0.2) : 0,
    seamLight: rnd(0.2, 0.7),
    rainbow: Math.random() < 0.5 ? rnd(0.05, 0.45) : 0,
  });
}

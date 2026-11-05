/**
 * Параметры стекла. Размеры относительные (доли картинки), поэтому превью
 * и отрисовка в исходном разрешении выглядят одинаково.
 * Ячейка и пластина меряются в долях меньшей стороны картинки: квадрат остаётся квадратом
 * на любой картинке, а растянутая пластина показывает больше ячеек, а не растянутые.
 */

export interface PlateParams {
  /** Центр пластины по горизонтали, доля ширины картинки. */
  x: number;
  /** Центр пластины по вертикали, доля высоты картинки. */
  y: number;
  /** Ширина пластины, доля меньшей стороны картинки. */
  width: number;
  /** Высота пластины, доля меньшей стороны картинки. */
  height: number;
  /** Поворот, градусы. */
  rotation: number;
}

/**
 * Как задаётся сетка. size — размером ячейки: растянул пластину — ячеек стало больше.
 * count — числом столбцов и рядов: растянул пластину — ячейки растянулись вместе с ней.
 */
export type GridMode = 'size' | 'count';

/** Форма ячейки: квадраты, соты, треугольники, круги, полосы (рифлёное стекло), битое стекло. */
export type CellShape = 'squares' | 'hex' | 'triangles' | 'circles' | 'stripes' | 'shards';
export const CELL_SHAPES: CellShape[] = ['squares', 'hex', 'triangles', 'circles', 'stripes', 'shards'];

/** Что между кругами: такое же стекло (ромбы-линзы), плоское стекло (картинка как есть) или матовое (размытая картинка). */
export type CircleGap = 'glass' | 'clear' | 'frosted';
export const CIRCLE_GAPS: CircleGap[] = ['glass', 'clear', 'frosted'];

export interface GlassParams {
  shape: CellShape;
  /** Случайность битого стекла: другое число — другая раскладка осколков. */
  shapeSeed: number;
  /** Угол полос, градусы (форма «полосы»). */
  stripeAngle: number;
  circleGap: CircleGap;
  grid: GridMode;
  /** Размер ячейки, доля меньшей стороны картинки (режим size). */
  cellSize: number;
  /** Столбцов и рядов на пластине (режим count). */
  columns: number;
  rows: number;
  /** Увеличение ячейки вокруг её центра; меньше 1 — уменьшение. Больше 1 — на швах содержимое теряется. */
  zoom: number;
  /** Лупа: центр ячейки крупнее, край на месте — стыки соединяют картинку. */
  loupe: number;
  /** Квадратность: круглое в ячейке растягивается в квадрат, у края эффект сходит на нет. */
  squareness: number;
  /** Неровность: случайный сдвиг, наклон и разброс увеличения по ячейкам. */
  irregularity: number;
  /** Мягкость шва: размытие на стыке ячеек, как у стекла возле камеры. */
  seamSoftness: number;
  /** Фаска: широкий чёткий шов — скошенная грань с преломлением, без размытия. Доля ячейки. */
  bevel: number;
  /** Блик и тень граней: светлая линия по шву и затемнение у края ячейки. */
  seamLight: number;
  /** Радуга на гранях: красный и синий увеличиваются чуть по-разному, расхождение растёт к краю ячейки. */
  rainbow: number;
  /** Торец: яркость зеленоватой полосы и блика по краю пластины. */
  edge: number;
  /** Толщина торца — рамки пластины, доля её меньшей стороны; 0 — торца нет. Ячейки — внутри рамки. */
  edgeWidth: number;
  plate: PlateParams;
}

type NumberKey = Exclude<keyof GlassParams, 'plate' | 'grid' | 'shape' | 'circleGap'>;

export type ParamKey =
  | NumberKey
  | `plate.${keyof PlateParams}`;

/**
 * min/max — диапазон ползунка. hardMin/hardMax — сколько можно вписать числом:
 * у лупы и квадратности предел тот же, дальше формула ломает картинку
 * (лупа складывает изображение само на себя, квадратность выворачивает углы).
 */
export interface ParamRange {
  min: number;
  max: number;
  step: number;
  hardMin?: number;
  hardMax?: number;
}

export const PARAM_RANGES: Record<ParamKey, ParamRange> = {
  cellSize: { min: 0.005, max: 0.35, step: 0.0005, hardMin: 0.002, hardMax: 2 },
  shapeSeed: { min: 0, max: 999, step: 1, hardMax: 99999 },
  stripeAngle: { min: -90, max: 90, step: 1, hardMin: -180, hardMax: 180 },
  columns: { min: 1, max: 60, step: 1, hardMax: 300 },
  rows: { min: 1, max: 60, step: 1, hardMax: 300 },
  zoom: { min: 0.5, max: 4, step: 0.01, hardMin: 0.1, hardMax: 12 },
  loupe: { min: 0, max: 1, step: 0.01 },
  squareness: { min: 0, max: 1, step: 0.01 },
  irregularity: { min: 0, max: 1, step: 0.01, hardMax: 3 },
  seamSoftness: { min: 0, max: 1, step: 0.01, hardMax: 2 },
  bevel: { min: 0, max: 0.4, step: 0.005, hardMax: 0.5 },
  seamLight: { min: 0, max: 1, step: 0.01, hardMax: 2 },
  rainbow: { min: 0, max: 1, step: 0.01, hardMax: 4 },
  edge: { min: 0, max: 1, step: 0.01, hardMax: 1.5 },
  edgeWidth: { min: 0, max: 0.15, step: 0.001, hardMax: 0.5 },
  'plate.x': { min: 0, max: 1, step: 0.001, hardMin: -1, hardMax: 2 },
  'plate.y': { min: 0, max: 1, step: 0.001, hardMin: -1, hardMax: 2 },
  'plate.width': { min: 0.03, max: 3, step: 0.001, hardMin: 0.01, hardMax: 10 },
  'plate.height': { min: 0.03, max: 3, step: 0.001, hardMin: 0.01, hardMax: 10 },
  'plate.rotation': { min: -180, max: 180, step: 0.1 },
};

/** Сколько вообще допускает параметр (вписанное числом может выйти за ползунок). */
export function paramLimits(key: ParamKey): { min: number; max: number } {
  const r = PARAM_RANGES[key];
  return { min: r.hardMin ?? r.min, max: r.hardMax ?? r.max };
}

export const DEFAULT_PARAMS: GlassParams = {
  shape: 'squares',
  shapeSeed: 7,
  stripeAngle: 0,
  circleGap: 'glass',
  grid: 'size',
  cellSize: 0.4 / 6,
  columns: 6,
  rows: 6,
  zoom: 2,
  loupe: 0,
  squareness: 0,
  irregularity: 0.3,
  seamSoftness: 0.15,
  bevel: 0,
  seamLight: 0.5,
  rainbow: 0,
  edge: 1,
  edgeWidth: 0,
  plate: { x: 0.5, y: 0.5, width: 0.4, height: 0.4, rotation: 0 },
};

export function getParam(p: GlassParams, key: ParamKey): number {
  if (key.startsWith('plate.')) return p.plate[key.slice(6) as keyof PlateParams];
  return p[key as NumberKey];
}

export function setParam(p: GlassParams, key: ParamKey, value: number): GlassParams {
  const { min, max } = paramLimits(key);
  let v = Math.min(max, Math.max(min, value));
  if (key === 'plate.rotation') v = ((((value + 180) % 360) + 360) % 360) - 180;
  if (key === 'stripeAngle') v = ((((value + 180) % 360) + 360) % 360) - 180;
  if (key === 'columns' || key === 'rows' || key === 'shapeSeed') v = Math.round(v);
  if (key.startsWith('plate.')) {
    return { ...p, plate: { ...p.plate, [key.slice(6)]: v } };
  }
  return { ...p, [key]: v };
}

type LooseInput = Partial<Omit<GlassParams, 'plate' | 'grid' | 'shape' | 'circleGap'>> & { grid?: string; shape?: string; circleGap?: string } & { plate?: Partial<PlateParams> & { size?: number } };

/**
 * Глубокая копия с подстановкой значений по умолчанию — для JSON со стороны.
 * Понимает и первый формат (квадрат `plate.size`, ячейка в долях пластины).
 */
export function normalizeParams(input: LooseInput): GlassParams {
  const src: LooseInput = { ...input, plate: { ...input.plate } };
  const size = src.plate?.size;
  if (typeof size === 'number' && src.plate!.width === undefined && src.plate!.height === undefined) {
    src.plate!.width = size;
    src.plate!.height = size;
    if (typeof src.cellSize === 'number') src.cellSize *= size;
  }
  let out: GlassParams = { ...DEFAULT_PARAMS, plate: { ...DEFAULT_PARAMS.plate } };
  if (src.grid === 'size' || src.grid === 'count') out.grid = src.grid;
  if (CELL_SHAPES.includes(src.shape as CellShape)) out.shape = src.shape as CellShape;
  if (CIRCLE_GAPS.includes(src.circleGap as CircleGap)) out.circleGap = src.circleGap as CircleGap;
  for (const key of Object.keys(PARAM_RANGES) as ParamKey[]) {
    const v = key.startsWith('plate.')
      ? src.plate?.[key.slice(6) as keyof PlateParams]
      : (src as Record<string, unknown>)[key];
    if (typeof v === 'number' && Number.isFinite(v)) out = setParam(out, key, v);
  }
  return out;
}

/**
 * Переключить способ задания сетки, не меняя картинку: из размера считаются столбцы и ряды,
 * из столбцов и рядов — размер (для прямоугольных ячеек — средний).
 * Прежние столбцы и ряды остаются, если до подходящего числа меньше одной ячейки:
 * иначе туда-обратно сетка съезжает на округлении (6 × 6 → 7 × 5).
 */
export function setGridMode(p: GlassParams, mode: GridMode): GlassParams {
  if (mode === p.grid) return p;
  const inner = innerPlate(p);
  if (mode === 'count') {
    const fit = (span: number, kept: number) => {
      const exact = span / p.cellSize;
      return Math.abs(exact - kept) < 1 ? kept : exact;
    };
    const next = setParam(
      setParam(p, 'columns', fit(inner.width, p.columns)),
      'rows',
      fit(inner.height, p.rows),
    );
    return { ...next, grid: 'count' };
  }
  const size = Math.sqrt((inner.width / p.columns) * (inner.height / p.rows));
  return { ...setParam(p, 'cellSize', size), grid: 'size' };
}

/** Пластина без торца: где живёт сетка. В долях меньшей стороны картинки. */
export function innerPlate(p: GlassParams): { width: number; height: number; rim: number } {
  const rim = p.edgeWidth * Math.min(p.plate.width, p.plate.height);
  return { width: Math.max(p.plate.width - 2 * rim, 1e-4), height: Math.max(p.plate.height - 2 * rim, 1e-4), rim };
}

/** Размер ячейки по осям в долях меньшей стороны картинки — в обоих режимах. */
export function cellExtent(p: GlassParams): { x: number; y: number } {
  if (p.grid === 'count') {
    const inner = innerPlate(p);
    return { x: inner.width / p.columns, y: inner.height / p.rows };
  }
  return { x: p.cellSize, y: p.cellSize };
}

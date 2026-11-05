import { DEFAULT_PARAMS, type GlassParams } from './params';

const base: GlassParams = {
  ...DEFAULT_PARAMS,
  grid: 'size',
  cellSize: 0.1,
  edge: 0.8,
  edgeWidth: 0,
  plate: { x: 0.5, y: 0.5, width: 0.6, height: 0.6, rotation: 0 },
};

const preset = (p: Partial<GlassParams>): GlassParams => ({ ...base, ...p, plate: { ...base.plate, ...p.plate } });

/**
 * Готовые наборы параметров. Положение пластины в пресете — стартовое: интерфейс при выборе
 * пресета оставляет пластину там, где её поставил пользователь, и меняет только стекло.
 */
export const PRESETS = {
  default: DEFAULT_PARAMS,
  /**
   * Стекло на средней дистанции от предмета, по сверке с тремя кадрами: около шести ячеек
   * поперёк пластины, увеличение 1,8 (ближе к предмету 1,4–1,7, дальше до 2,2 — это ползунок),
   * квадратность делает круглые глаза квадратами; на швах содержимое теряется.
   */
  /** Крупные ячейки без увеличения, сильная лупа: лица и предметы выгибаются, как в кривом зеркале. Набор по умолчанию. */
  caricature: preset({
    cellSize: 0.35,
    zoom: 1,
    loupe: 0.67,
    squareness: 1,
    irregularity: 0,
    seamSoftness: 0,
    seamLight: 0.3,
    rainbow: 0.15,
  }),
  /** Портрет: узкие вертикальные рёбра рифлёного стекла, лицо плывёт полосами. */
  fluted: preset({
    shape: 'stripes',
    stripeAngle: 0,
    cellSize: 0.055,
    zoom: 2.2,
    loupe: 0.1,
    squareness: 0.5,
    irregularity: 0.5,
    seamSoftness: 0.2,
    seamLight: 0.5,
    rainbow: 0.08,
  }),
  /** Типографика: широкие горизонтальные пласты, буквы сдвинуты и окаймлены цветом. */
  slices: preset({
    shape: 'stripes',
    stripeAngle: 90,
    cellSize: 0.16,
    zoom: 1.35,
    loupe: 0.4,
    squareness: 0.3,
    irregularity: 0.15,
    seamSoftness: 0.05,
    seamLight: 0.1,
    rainbow: 0.7,
  }),
  video: preset({
    zoom: 1.8,
    loupe: 0.2,
    squareness: 0.9,
    irregularity: 0.5,
    seamSoftness: 0.15,
    seamLight: 0.3,
    rainbow: 0.15,
    edgeWidth: 0.015,
    plate: { x: 0.5, y: 0.5, width: 0.6, height: 0.6, rotation: 1 },
  }),
  /** Увеличение 1×, центр ячейки крупнее, край на месте — стыки соединяют картинку, ничего не пропадает. */
  loupe: preset({ zoom: 1, loupe: 0.75, squareness: 0.8, irregularity: 0.3, seamSoftness: 0.15, seamLight: 0.3, rainbow: 0.1 }),
  /** Мелкие ячейки с лёгкой лупой — картинка рассыпается на плитку, но читается. */
  mosaic: preset({ cellSize: 0.04, zoom: 1.7, loupe: 0.3, squareness: 0.85, irregularity: 0.3, seamSoftness: 0.05, seamLight: 0.35 }),
  /** Несколько крупных линз с радугой по краям. */
  bigLenses: preset({ cellSize: 0.22, zoom: 1.15, loupe: 0.65, squareness: 0.3, irregularity: 0.2, seamSoftness: 0.1, seamLight: 0.45, rainbow: 0.4 }),
  /** Размытые швы и блики, как у толстого стеклоблока. */
  frosted: preset({ cellSize: 0.08, zoom: 1.5, loupe: 0.3, squareness: 0.7, irregularity: 0.6, seamSoftness: 0.75, seamLight: 0.6, rainbow: 0.1, edgeWidth: 0.02 }),
  /** Широкие чёткие фаски по швам: в скошенной грани отражается соседний кусок ячейки. */
  faceted: preset({ cellSize: 0.12, zoom: 1.3, loupe: 0.3, squareness: 0.6, irregularity: 0.3, seamSoftness: 0, bevel: 0.18, seamLight: 0.5, rainbow: 0.15 }),
  /** Уменьшение вместо увеличения: в каждой ячейке своя маленькая копия куска картинки. */
  kaleidoscope: preset({ cellSize: 0.07, zoom: 0.6, loupe: 0, squareness: 0.4, irregularity: 0.2, seamSoftness: 0.1, seamLight: 0.3, rainbow: 0.2 }),
  /** Сильная неровность: ячейки смотрят чуть в разные стороны, как стекло ручной работы. */
  handmade: preset({ cellSize: 0.09, zoom: 1.6, loupe: 0.25, squareness: 0.6, irregularity: 1, seamSoftness: 0.2, seamLight: 0.35, rainbow: 0.15 }),
} satisfies Record<string, GlassParams>;

export type PresetName = keyof typeof PRESETS;

import { CELLS_GLSL } from './cells';

/** Треугольник на весь холст, без буферов: вершины из gl_VertexID. */
export const VERTEX_GLSL = /* glsl */ `#version 300 es
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}
`;

/*
 * Модель: пластина разрезана на ячейки, каждая увеличивает кусок картинки вокруг своего центра.
 * Координаты: P — пиксели картинки (y вниз), q — пластина с центром в нуле, g — сетка (q + сдвиг).
 * Пластина — прямоугольник с полуосями uPlateHalf; ячейки квадратные и от размера пластины не зависят.
 * Все длины в пикселях картинки; uViewScale — сколько пикселей картинки приходится на пиксель холста.
 */
export const FRAGMENT_GLSL = /* glsl */ `#version 300 es
precision highp float;

uniform sampler2D uImage;
uniform vec2 uImageSize;
uniform vec2 uViewOffset;
uniform float uViewScale;
uniform float uCanvasHeight;
uniform vec4 uBackground;

uniform vec2 uPlateCenter;
uniform vec2 uPlateHalf;
uniform vec2 uPlateRot;
uniform vec2 uGridOffset;

uniform vec2 uCell;
uniform float uShape;
uniform float uSeed;
uniform vec2 uStripe;
uniform float uGapMode;
uniform float uZoom;
uniform float uLoupe;
uniform float uSquare;
uniform float uIrregularity;
uniform float uSoftness;
uniform float uSeamLight;
uniform float uRainbow;
uniform float uEdge;
uniform float uRimWidth;
uniform float uBevel;
uniform vec4 uOutside;
uniform float uOutsideFill;

out vec4 outColor;

${CELLS_GLSL}

const int DISC = 12;
const vec2 TO_LIGHT = vec2(-0.5547, -0.8321); // свет сверху слева
const vec3 RIM_TINT = vec3(0.80, 0.93, 0.85);

float cellMin(Cell c) {
  return min(c.size.x, c.size.y);
}

vec2 rot(vec2 v, vec2 cs) {
  return vec2(cs.x * v.x - cs.y * v.y, cs.y * v.x + cs.x * v.y);
}

vec4 hash4(vec2 p) {
  vec4 q = fract(vec4(p.xyxy) * vec4(0.1031, 0.1030, 0.0973, 0.1099));
  q += dot(q, q.wzxy + 33.33);
  return fract((q.xxyz + q.yzzw) * q.zywx);
}

vec2 gridToImage(vec2 g) {
  return uPlateCenter + rot(g - uGridOffset, uPlateRot);
}

vec4 fetch(vec2 P, float footprint) {
  vec2 d = vec2(footprint) / uImageSize;
  return textureGrad(uImage, P / uImageSize, vec2(d.x, 0.0), vec2(0.0, d.y));
}

// Ячейка пластины в точке сетки g: сетка внутри торца или одна из четырёх трапеций торца.
// Трапеции — стороны рамки со скосами под 45° в углах; для линз и швов это такие же ячейки,
// только длинные. Край пластины и стык рамки с сеткой — обычные швы.
Cell plateCell(vec2 g) {
  vec2 q = g - uGridOffset;
  vec2 toSides = uPlateHalf - abs(q);
  float toEdge = min(toSides.x, toSides.y);
  float r = uRimWidth;
  if (r > 0.0 && toEdge < r) {
    Cell c;
    if (toSides.y <= toSides.x) {
      float s = q.y < 0.0 ? -1.0 : 1.0;
      c.id = vec2(-1000.0, s);
      c.frame = vec2(1.0, 0.0);
      c.gap = 0.0;
      c.nrm = vec2(0.0);
      c.center = vec2(0.0, s * (uPlateHalf.y - 0.5 * r)) + uGridOffset;
      c.size = vec2(2.0 * uPlateHalf.x - r, r);
    } else {
      float s = q.x < 0.0 ? -1.0 : 1.0;
      c.id = vec2(-2000.0, s);
      c.frame = vec2(1.0, 0.0);
      c.gap = 0.0;
      c.nrm = vec2(0.0);
      c.center = vec2(s * (uPlateHalf.x - 0.5 * r), 0.0) + uGridOffset;
      c.size = vec2(r, 2.0 * uPlateHalf.y - r);
    }
    float miter = abs(toSides.x - toSides.y) * 0.70710678;
    c.edge = min(min(toEdge, r - toEdge), miter);
    return c;
  }
  Cell c = cellAt(g, uCell);
  // Ближе к краю пластины, чем к шву, — направление даёт край, а не форма: нормаль считается разностью.
  if (toEdge - r < c.edge) c.nrm = vec2(0.0);
  c.edge = min(c.edge, toEdge - r);
  return c;
}

// Линза внутри ячейки, rel — от её центра. Край ячейки остаётся на месте: при увеличении 1×
// соседние ячейки стыкуются без разрыва. Обе формулы гладкие — без складок по диагоналям.
// Квадратность — квадрат ячейки смотрит в круг вокруг центра (круглое становится квадратным),
// к краю эффект сходит на нет. Лупа — по каждой оси отдельно: центр крупнее, к краю сжато,
// поэтому у соседних ячеек одного ряда или столбца края совпадают.
// stretch — местное сжатие картинки, по нему выбирается уровень mip.
vec2 lens(vec2 rel, vec2 size, out float stretch) {
  vec2 n = rel / (0.5 * size);
  vec2 n2 = n * n;
  vec2 disc = n * sqrt(max(1.0 - 0.5 * n2.yx, 0.0));
  float fade = max((1.0 - n2.x * n2.x) * (1.0 - n2.y * n2.y), 0.0);
  n = mix(n, disc, uSquare * fade);
  float s = 0.85 * uLoupe;
  vec2 m = n * (1.0 - s + s * n * n);
  vec2 d = 1.0 - s + 3.0 * s * n * n;
  stretch = max(d.x, d.y);
  return m * (0.5 * size);
}

// Направление от ближайшего края внутрь ячейки — по разности расстояний, форма ячейки не важна.
vec2 edgeNormal(vec2 g, Cell c) {
  if (c.nrm != vec2(0.0)) return c.nrm;
  float e = 0.5 * uViewScale;
  vec2 grad = vec2(
    plateCell(g + vec2(e, 0.0)).edge - plateCell(g - vec2(e, 0.0)).edge,
    plateCell(g + vec2(0.0, e)).edge - plateCell(g - vec2(0.0, e)).edge);
  return length(grad) > 0.0 ? normalize(grad) : vec2(0.0);
}

// Фаска: полоса у шва — скошенная грань. В ней видно зеркально сжатый соседний кусок ячейки:
// чётко, без размытия; на внутренней границе полосы стыкуется с остальной ячейкой без скачка.
vec2 bevel(vec2 g, Cell c) {
  float w = uBevel * cellMin(c);
  if (w <= 0.0 || c.edge >= w) return g;
  float src = min(w + (w - c.edge) * 1.5, 0.5 * cellMin(c));
  return g + edgeNormal(g, c) * (src - c.edge);
}

// Что видно сквозь ячейку c в точке сетки g. blur — дополнительное размытие, px картинки.
vec4 throughCell(vec2 g, Cell c, float blur) {
  // Между кругами стекла нет: картинка как есть или, у матового, размытая.
  if (c.gap > 0.5) {
    float soft = uGapMode > 1.5 ? 0.18 * cellMin(c) : 0.0;
    return fetch(gridToImage(g), max(max(uViewScale, blur), soft));
  }
  g = bevel(g, c);
  vec4 h = hash4(c.id);
  float irr = uIrregularity;
  float z = uZoom * (1.0 + (h.z - 0.5) * 0.24 * irr);
  float a = (h.w - 0.5) * 0.12 * irr;
  float stretch;
  vec2 rel = rot(rot(lens(rot(g - c.center, vec2(c.frame.x, -c.frame.y)), c.size, stretch), c.frame), vec2(cos(a), sin(a))) / z;
  vec2 base = c.center + (h.xy - 0.5) * 0.12 * irr * min(c.size, uCell);
  float fp = max(uViewScale * stretch / abs(z), blur);
  vec4 col = fetch(gridToImage(base + rel), fp);
  if (uRainbow > 0.0) {
    float k = 0.05 * uRainbow;
    col.r = fetch(gridToImage(base + rel * (1.0 + k)), fp).r;
    col.b = fetch(gridToImage(base + rel * (1.0 - k)), fp).b;
  }
  return col;
}

// Шов: у края ячейки точки смешиваются с соседними — диск выборок, радиус растёт к шву.
vec4 glassColor(vec2 g, Cell c0) {
  float aa = 0.75 * uViewScale;
  float rMax = uSoftness * 0.35 * cellMin(c0) + aa;
  float r = rMax - c0.edge;
  if (r <= 0.0) return throughCell(g, c0, 0.0);
  vec4 sum = vec4(0.0);
  for (int i = 0; i < DISC; i++) {
    float fi = float(i) + 0.5;
    float th = fi * 2.39996323;
    vec2 gi = g + r * sqrt(fi / float(DISC)) * vec2(cos(th), sin(th));
    sum += throughCell(gi, plateCell(gi), 0.5 * r / uZoom);
  }
  return sum / float(DISC);
}

// Грани: затемнение к краю, блик на стороне к свету, светлая линия по шву.
vec3 seamLight(vec3 col, vec2 g, Cell c0) {
  if (uSeamLight <= 0.0 || c0.gap > 0.5) return col;
  float reach = max(0.12, uBevel) * cellMin(c0);
  float lineW = max(0.010 * cellMin(c0), uViewScale);
  // Далеко от шва ни тени, ни блика, ни линии — нормаль (четыре пробы формы) не нужна.
  if (c0.edge >= max(reach, lineW)) return col;
  vec2 nOut = rot(-edgeNormal(g, c0), uPlateRot);
  float lit = dot(nOut, TO_LIGHT);
  float t = 1.0 - smoothstep(0.0, reach, c0.edge);
  float t2 = t * t;
  col *= 1.0 - uSeamLight * t2 * (0.22 - 0.14 * lit);
  col += uSeamLight * t2 * t * max(lit, 0.0) * 0.22;
  float line = 1.0 - smoothstep(0.0, lineW, c0.edge);
  return mix(col, vec3(1.0), uSeamLight * line * 0.35);
}

void main() {
  vec2 canvasPx = vec2(gl_FragCoord.x, uCanvasHeight - gl_FragCoord.y);
  vec2 P = (canvasPx - uViewOffset) * uViewScale;
  if (P.x < 0.0 || P.y < 0.0 || P.x > uImageSize.x || P.y > uImageSize.y) {
    outColor = uOutsideFill > 0.5 ? uOutside : uBackground;
    return;
  }
  // Вне пластины — картинка как есть или заливка (сохранение «только линза»).
  vec4 plain = uOutsideFill > 0.5 ? uOutside : fetch(P, uViewScale);
  vec2 q = rot(P - uPlateCenter, vec2(uPlateRot.x, -uPlateRot.y));
  float aa = 0.75 * uViewScale;
  vec2 toSides = uPlateHalf - abs(q);
  float toEdge = min(toSides.x, toSides.y);
  float halfMin = min(uPlateHalf.x, uPlateHalf.y);
  if (halfMin <= 0.0 || toEdge < -aa) {
    outColor = plain;
    return;
  }

  vec2 g = q + uGridOffset;
  Cell c0 = plateCell(g);
  vec4 col = glassColor(g, c0);
  col.rgb = seamLight(col.rgb, g, c0);

  if (uRimWidth > 0.0) {
    // Торец: поверх его линз — зеленоватый тон, блик со стороны света и светлая кромка.
    float inRim = smoothstep(-aa, aa, uRimWidth - toEdge);
    vec2 nq = toSides.x < toSides.y ? vec2(sign(q.x), 0.0) : vec2(0.0, sign(q.y));
    float lit = dot(rot(nq, uPlateRot), TO_LIGHT);
    vec3 rim = col.rgb * RIM_TINT + max(lit, 0.0) * 0.10;
    float outerLine = 1.0 - smoothstep(0.0, max(0.005 * halfMin, 1.5 * uViewScale), toEdge);
    rim = mix(rim, vec3(1.0), outerLine * (0.40 + 0.30 * max(lit, 0.0)));
    col.rgb = mix(col.rgb, rim, inRim * uEdge);
  }

  float cover = clamp(toEdge / (2.0 * aa) + 0.5, 0.0, 1.0);
  // Прозрачная заливка: край пластины гасим альфой, а не смешиванием с чёрным — без тёмной каймы.
  outColor = uOutsideFill > 0.5 && uOutside.a < 0.5 ? vec4(col.rgb, col.a * cover) : mix(plain, col, cover);
}
`;

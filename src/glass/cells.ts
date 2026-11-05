/**
 * Формы ячеек на GLSL.
 *
 * Контракт формы — функция «точка в координатах сетки → Cell»:
 *   id     — номер ячейки, из него берётся случайный разброс;
 *   center — центр ячейки, вокруг него идёт увеличение;
 *   edge   — расстояние до ближайшего края ячейки (0 на шве, растёт к центру);
 *   size   — размер ячейки по осям, к нему нормируются лупа и квадратность.
 * size на входе — квадрат, если сетка задана размером, или прямоугольник,
 * если задана столбцами и рядами и пластину растянули.
 * nrm — направление от ближайшего шва внутрь, если форма знает его сразу (иначе нули, шейдер считает разностью).
 * frame — поворот осей ячейки (у полос — вдоль полосы), gap = 1 — «между ячейками» (круги): стекла там нет.
 * Новая форма — новая функция здесь и ветка в cellAt; остальной шейдер про форму не знает.
 * Нужны uniform'ы uShape (номер формы), uSeed, uStripe (cos, sin угла полос), объявленные до этого куска.
 * Торец (трапеции по краю пластины) собирает шейдер поверх этой функции — см. plateCell.
 */
export const CELLS_GLSL = /* glsl */ `
struct Cell {
  vec2 id;
  vec2 center;
  float edge;
  vec2 size;
  vec2 frame;
  float gap;
  vec2 nrm;
};

const float SQRT3 = 1.7320508;
const float BIG = 1.0e4;

vec2 rotCs(vec2 v, vec2 cs) {
  return vec2(cs.x * v.x - cs.y * v.y, cs.y * v.x + cs.x * v.y);
}

Cell cellGrid(vec2 p, vec2 size) {
  vec2 id = floor(p / size);
  vec2 center = (id + 0.5) * size;
  vec2 d = 0.5 * size - abs(p - center);
  return Cell(id, center, min(d.x, d.y), size, vec2(1.0, 0.0), 0.0, vec2(0.0));
}

// Соты: два сдвинутых набора центров, берём ближайший. Сосед слева и справа — на расстоянии size.x.
Cell cellHex(vec2 p, vec2 size) {
  vec2 u = p / size;
  vec2 r = vec2(1.0, SQRT3);
  vec2 h = 0.5 * r;
  vec2 a = mod(u, r) - h;
  vec2 b = mod(u - h, r) - h;
  vec2 gv = dot(a, a) < dot(b, b) ? a : b;
  vec2 c = u - gv;
  float apothem = 0.5 - max(abs(gv.x), max(abs(dot(gv, vec2(0.5, 0.8660254))), abs(dot(gv, vec2(-0.5, 0.8660254)))));
  return Cell(vec2(floor(c.x * 2.0 + 0.5), floor(c.y / (0.5 * SQRT3) + 0.5)), c * size, apothem * min(size.x, size.y), size, vec2(1.0, 0.0), 0.0, vec2(0.0));
}

// Треугольники: сетка ромбов из двух правильных треугольников (стороной size.x), нижний и верхний.
Cell cellTriangles(vec2 p, vec2 size) {
  vec2 u = p / size;
  float bq = u.y / (0.5 * SQRT3);
  float aq = u.x - 0.5 * bq;
  vec2 i = floor(vec2(aq, bq));
  vec2 f = vec2(aq, bq) - i;
  float up = f.x + f.y > 1.0 ? 1.0 : 0.0;
  vec3 lam = up > 0.5 ? vec3(f.x + f.y - 1.0, 1.0 - f.x, 1.0 - f.y) : vec3(1.0 - f.x - f.y, f.x, f.y);
  vec2 cb = i + (up > 0.5 ? vec2(2.0 / 3.0) : vec2(1.0 / 3.0));
  vec2 c = vec2(cb.x + 0.5 * cb.y, cb.y * 0.5 * SQRT3);
  float edge = min(lam.x, min(lam.y, lam.z)) * 0.5 * SQRT3 * min(size.x, size.y);
  return Cell(vec2(i.x * 2.0 + up, i.y), c * size, edge, size * 0.75, vec2(1.0, 0.0), 0.0, vec2(0.0));
}

// Круги: круг в квадрате. Между кругами — ромбы вокруг углов сетки: своя ячейка со своей линзой
// (uGapMode 0) или gap — без стекла, плоское либо матовое. Шов — окружность, расстояние до неё с обеих сторон.
Cell cellCircles(vec2 p, vec2 size) {
  Cell c = cellGrid(p, size);
  float r = 0.5 * min(size.x, size.y);
  float dist = length(p - c.center);
  c.edge = abs(r - dist);
  if (dist > r) {
    if (uGapMode > 0.5) {
      c.gap = 1.0;
    } else {
      vec2 corner = floor(p / size + 0.5);
      c.id = corner + vec2(0.37, 0.61);
      c.center = corner * size;
      c.size = size * 0.7;
    }
  }
  return c;
}

// Полосы: ячейка — полоса шириной size.x, бесконечная вдоль оси, повёрнутой на угол stripeAngle.
Cell cellStripes(vec2 p, vec2 size) {
  vec2 pr = rotCs(p, vec2(uStripe.x, -uStripe.y));
  float id = floor(pr.x / size.x);
  float cx = (id + 0.5) * size.x;
  vec2 center = rotCs(vec2(cx, pr.y), uStripe);
  return Cell(vec2(id, 0.0), center, 0.5 * size.x - abs(pr.x - cx), vec2(size.x, BIG), uStripe, 0.0, vec2(0.0));
}

vec2 shardPoint(vec2 lattice) {
  vec3 h = fract(vec3(lattice.xyx + uSeed * vec3(1.0, 0.37, 0.61)) * vec3(0.1031, 0.1030, 0.0973));
  h += dot(h, h.yzx + 33.33);
  return 0.5 + (fract((h.xx + h.yz) * h.zy) - 0.5) * 0.9;
}

// Битое стекло: ближайшая из случайных точек (по одной на клетку сетки), шов — по серединному перпендикуляру.
Cell cellShards(vec2 p, vec2 size) {
  vec2 u = p / size;
  vec2 n = floor(u);
  vec2 f = u - n;
  vec2 mg = vec2(0.0);
  vec2 mr = vec2(0.0);
  float md = 8.0;
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 g = vec2(float(i), float(j));
      vec2 r = g + shardPoint(n + g) - f;
      float d = dot(r, r);
      if (d < md) { md = d; mr = r; mg = g; }
    }
  }
  float edge = 8.0;
  vec2 toward = vec2(0.0);
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 g = mg + vec2(float(i), float(j));
      vec2 r = g + shardPoint(n + g) - f;
      vec2 dr = r - mr;
      if (dot(dr, dr) > 1.0e-5) {
        float e = dot(0.5 * (mr + r), normalize(dr));
        if (e < edge) { edge = e; toward = -normalize(dr); }
      }
    }
  }
  return Cell(n + mg, (u + mr) * size, edge * min(size.x, size.y), size, vec2(1.0, 0.0), 0.0, normalize(toward / size));
}

Cell cellAt(vec2 p, vec2 size) {
  if (uShape < 0.5) return cellGrid(p, size);
  if (uShape < 1.5) return cellHex(p, size);
  if (uShape < 2.5) return cellTriangles(p, size);
  if (uShape < 3.5) return cellCircles(p, size);
  if (uShape < 4.5) return cellStripes(p, size);
  return cellShards(p, size);
}
`;

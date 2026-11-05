import {
  paramLimits,
  fromPlateLocal,
  plateCorners,
  plateFromGeometry,
  plateGeometry,
  toPlateLocal,
  type ImageInfo,
  type PlateGeometry,
  type PlateParams,
  type ViewTransform,
} from '../glass';

/*
 * Рамка пластины как у фигуры в редакторе: внутри — перенос; за угол — пропорциональное
 * увеличение от противоположного угла; чуть снаружи угла — поворот (Shift — шагом 15°);
 * за сторону — растяжение от противоположной стороны. Alt — увеличение и растяжение от центра.
 * Клик мимо пластины переносит её под указатель.
 */

type Side = 'left' | 'right' | 'top' | 'bottom';
type Hit =
  | { kind: 'move' }
  | { kind: 'rotate' }
  | { kind: 'corner'; sx: number; sy: number }
  | { kind: 'side'; side: Side }
  | { kind: 'outside' };

/** Радиус ручки угла и внешняя граница зоны поворота за углом, px экрана. */
const CORNER_GRAB = 9;
const ROTATE_OUTER = 32;
const SIDE_GRAB = 7;

const ROTATE_CURSOR =
  `url("data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24'>` +
      `<g fill='none' stroke-linecap='round' stroke-linejoin='round'>` +
      `<path d='M6 14a7 7 0 1 0 2-7' stroke='#000' stroke-width='4'/>` +
      `<path d='M5 4v4h4' stroke='#000' stroke-width='4'/>` +
      `<path d='M6 14a7 7 0 1 0 2-7' stroke='#fff' stroke-width='1.8'/>` +
      `<path d='M5 4v4h4' stroke='#fff' stroke-width='1.8'/></g></svg>`,
  )}") 12 12, alias`;

const RESIZE_CURSORS = ['ew-resize', 'nwse-resize', 'ns-resize', 'nesw-resize'];

export interface FrameOptions {
  canvas: HTMLCanvasElement;
  overlay: SVGSVGElement;
  /** Вид холста в пикселях устройства. */
  getView: () => ViewTransform;
  getImage: () => ImageInfo | null;
  getPlate: () => PlateParams;
  setPlate: (plate: PlateParams) => void;
}

export function attachFrame(o: FrameOptions) {
  let visible = true;
  let drag:
    | { hit: Hit; start: PlateGeometry; px: number; py: number; angle0: number }
    | null = null;

  const dpr = () => window.devicePixelRatio || 1;
  /** Пикселей CSS на пиксель картинки. */
  const cssScale = () => o.getView().scale / dpr();

  function toImage(e: PointerEvent): { x: number; y: number } {
    const rect = o.canvas.getBoundingClientRect();
    const v = o.getView();
    return {
      x: ((e.clientX - rect.left) * dpr() - v.x) / v.scale,
      y: ((e.clientY - rect.top) * dpr() - v.y) / v.scale,
    };
  }

  function toCss(p: { x: number; y: number }): { x: number; y: number } {
    const v = o.getView();
    return { x: (p.x * v.scale + v.x) / dpr(), y: (p.y * v.scale + v.y) / dpr() };
  }

  function geometry(): PlateGeometry | null {
    const img = o.getImage();
    return img ? plateGeometry(o.getPlate(), img.width, img.height) : null;
  }

  function hitTest(g: PlateGeometry, p: { x: number; y: number }): Hit {
    const s = cssScale();
    const l = toPlateLocal(g, p.x, p.y);
    const lx = l.x * s;
    const ly = l.y * s;
    const hx = g.hx * s;
    const hy = g.hy * s;
    const dx = Math.abs(lx) - hx;
    const dy = Math.abs(ly) - hy;
    if (Math.hypot(dx, dy) < CORNER_GRAB) return { kind: 'corner', sx: Math.sign(lx) || 1, sy: Math.sign(ly) || 1 };
    if ((dx > 0 || dy > 0) && dx > -CORNER_GRAB && dy > -CORNER_GRAB && Math.hypot(Math.max(dx, 0), Math.max(dy, 0)) < ROTATE_OUTER) {
      return { kind: 'rotate' };
    }
    if (Math.abs(dx) < SIDE_GRAB && dy < 0) return { kind: 'side', side: lx > 0 ? 'right' : 'left' };
    if (Math.abs(dy) < SIDE_GRAB && dx < 0) return { kind: 'side', side: ly > 0 ? 'bottom' : 'top' };
    if (dx <= 0 && dy <= 0) return { kind: 'move' };
    return { kind: 'outside' };
  }

  function cursorFor(hit: Hit, g: PlateGeometry): string {
    if (hit.kind === 'rotate') return ROTATE_CURSOR;
    if (hit.kind === 'move') return drag ? 'grabbing' : 'grab';
    if (hit.kind === 'outside') return 'default';
    const base =
      hit.kind === 'corner'
        ? (Math.atan2(hit.sy * g.hy, hit.sx * g.hx) * 180) / Math.PI
        : hit.side === 'left' || hit.side === 'right' ? 0 : 90;
    const deg = (((base + (g.angle * 180) / Math.PI) % 180) + 180) % 180;
    return RESIZE_CURSORS[Math.round(deg / 45) % 4];
  }

  /** Пропорционально от противоположного угла (Alt — от центра): указатель проецируется на диагональ. */
  function scaleFromCorner(start: PlateGeometry, sx: number, sy: number, p: { x: number; y: number }, fromCenter: boolean): PlateGeometry {
    const img = o.getImage()!;
    const unit = Math.min(img.width, img.height) / 2;
    const minHalf = Math.max(paramLimits('plate.width').min * unit, 6 / cssScale());
    const maxHalf = paramLimits('plate.width').max * unit;
    const kMin = Math.max(minHalf / start.hx, minHalf / start.hy);
    const kMax = Math.min(maxHalf / start.hx, maxHalf / start.hy);
    const l = toPlateLocal(start, p.x, p.y);
    const corner = { x: sx * start.hx, y: sy * start.hy };
    const anchor = fromCenter ? { x: 0, y: 0 } : { x: -corner.x, y: -corner.y };
    const d = { x: corner.x - anchor.x, y: corner.y - anchor.y };
    const raw = ((l.x - anchor.x) * d.x + (l.y - anchor.y) * d.y) / (d.x * d.x + d.y * d.y);
    const k = Math.min(kMax, Math.max(kMin, raw));
    const c = fromCenter
      ? { x: start.cx, y: start.cy }
      : fromPlateLocal(start, anchor.x + (d.x * k) / 2, anchor.y + (d.y * k) / 2);
    return { ...start, cx: c.x, cy: c.y, hx: start.hx * k, hy: start.hy * k };
  }

  function resize(start: PlateGeometry, side: Side, p: { x: number; y: number }, fromCenter: boolean): PlateGeometry {
    const img = o.getImage()!;
    const unit = Math.min(img.width, img.height) / 2;
    const horizontal = side === 'left' || side === 'right';
    const key = horizontal ? 'plate.width' : 'plate.height';
    const minHalf = Math.max(paramLimits(key).min * unit, 6 / cssScale());
    const maxHalf = paramLimits(key).max * unit;
    const l = toPlateLocal(start, p.x, p.y);
    const pos = horizontal ? l.x : l.y;
    const old = horizontal ? start.hx : start.hy;
    const sign = side === 'right' || side === 'bottom' ? 1 : -1;
    let half: number;
    let shift: number;
    if (fromCenter) {
      half = Math.min(maxHalf, Math.max(minHalf, sign * pos));
      shift = 0;
    } else {
      half = Math.min(maxHalf, Math.max(minHalf, (sign * pos + old) / 2));
      shift = sign * (half - old);
    }
    const c = horizontal ? fromPlateLocal(start, shift, 0) : fromPlateLocal(start, 0, shift);
    return horizontal
      ? { ...start, cx: c.x, cy: c.y, hx: half }
      : { ...start, cx: c.x, cy: c.y, hy: half };
  }

  function commit(g: PlateGeometry): void {
    const img = o.getImage()!;
    o.setPlate(plateFromGeometry(g, img.width, img.height));
  }

  o.canvas.addEventListener('pointerdown', (e) => {
    let g = geometry();
    if (!g) return;
    const p = toImage(e);
    let hit = hitTest(g, p);
    if (hit.kind === 'outside') {
      g = { ...g, cx: p.x, cy: p.y };
      commit(g);
      hit = { kind: 'move' };
    }
    drag = { hit, start: g, px: p.x, py: p.y, angle0: Math.atan2(p.y - g.cy, p.x - g.cx) };
    o.canvas.setPointerCapture(e.pointerId);
    o.canvas.style.cursor = cursorFor(hit, g);
  });

  o.canvas.addEventListener('pointermove', (e) => {
    const p = toImage(e);
    if (!drag) {
      const g = geometry();
      if (g) o.canvas.style.cursor = cursorFor(hitTest(g, p), g);
      return;
    }
    const { hit, start } = drag;
    if (hit.kind === 'move') {
      commit({ ...start, cx: start.cx + p.x - drag.px, cy: start.cy + p.y - drag.py });
    } else if (hit.kind === 'rotate') {
      let angle = start.angle + Math.atan2(p.y - start.cy, p.x - start.cx) - drag.angle0;
      if (e.shiftKey) angle = Math.round(angle / (Math.PI / 12)) * (Math.PI / 12);
      commit({ ...start, angle });
    } else if (hit.kind === 'side') {
      commit(resize(start, hit.side, p, e.altKey));
    } else if (hit.kind === 'corner') {
      commit(scaleFromCorner(start, hit.sx, hit.sy, p, e.altKey));
    }
  });

  const end = (e: PointerEvent) => {
    drag = null;
    const g = geometry();
    if (g) o.canvas.style.cursor = cursorFor(hitTest(g, toImage(e)), g);
  };
  o.canvas.addEventListener('pointerup', end);
  o.canvas.addEventListener('pointercancel', end);

  const NS = 'http://www.w3.org/2000/svg';
  function redraw(): void {
    const { overlay } = o;
    overlay.replaceChildren();
    const g = geometry();
    if (!visible || !g) return;
    overlay.setAttribute('viewBox', `0 0 ${o.canvas.clientWidth} ${o.canvas.clientHeight}`);
    const corners = plateCorners(g).map(toCss);
    const outline = document.createElementNS(NS, 'polygon');
    outline.setAttribute('points', corners.map((c) => `${c.x},${c.y}`).join(' '));
    outline.setAttribute('class', 'frame-outline');
    overlay.append(outline);
    const deg = (g.angle * 180) / Math.PI;
    const handle = (c: { x: number; y: number }, w: number, h: number, extra = 0) => {
      const r = document.createElementNS(NS, 'rect');
      r.setAttribute('x', String(c.x - w / 2));
      r.setAttribute('y', String(c.y - h / 2));
      r.setAttribute('width', String(w));
      r.setAttribute('height', String(h));
      r.setAttribute('rx', String(Math.min(w, h) / 2 > 3 ? 2 : 1));
      r.setAttribute('transform', `rotate(${deg + extra} ${c.x} ${c.y})`);
      r.setAttribute('class', 'frame-handle');
      overlay.append(r);
    };
    for (const c of corners) handle(c, 9, 9);
    const mid = (a: { x: number; y: number }, b: { x: number; y: number }) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
    handle(mid(corners[0], corners[1]), 16, 5);
    handle(mid(corners[2], corners[3]), 16, 5);
    handle(mid(corners[1], corners[2]), 16, 5, 90);
    handle(mid(corners[3], corners[0]), 16, 5, 90);
  }

  return {
    redraw,
    setVisible(v: boolean) {
      visible = v;
      redraw();
    },
  };
}

import { useCallback, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState, type Ref } from 'react';
import {
  GlassRenderer,
  fromPlateLocal,
  normalizeParams,
  paramLimits,
  plateCorners,
  plateFromGeometry,
  plateGeometry,
  toPlateLocal,
  type GlassParams,
  type PlateGeometry,
} from '../glass';
import { IconMove } from './icons';
import type { LoadedImage } from './load';

/*
 * Холст со стеклом и рамка пластины.
 * Один палец или мышь: внутри — перенос, угол — пропорционально от противоположного угла,
 * сторона — растяжение, ручка над пластиной — поворот (Shift — шагом 15°). Мимо пластины по картинке — перенос её туда.
 * Два пальца — щипок: размер, поворот и перенос одним жестом.
 * Холст как в Фигме: колесо — приблизить и отдалить под курсором; двигать — мышью по пустому месту вокруг картинки,
 * средней кнопкой или с зажатым пробелом. Shift+1 — вписать, Shift+0 — 100 %, + и − — шаг.
 */

interface Pt {
  x: number;
  y: number;
}
type Side = 'left' | 'right' | 'top' | 'bottom';
type Drag =
  | { kind: 'move'; id: number; start: PlateGeometry; p0: Pt }
  | { kind: 'corner'; id: number; start: PlateGeometry; sx: number; sy: number }
  | { kind: 'side'; id: number; start: PlateGeometry; side: Side }
  | { kind: 'rotate'; id: number; start: PlateGeometry; a0: number }
  | { kind: 'pinch'; start: PlateGeometry; ids: [number, number]; c0: Pt; d0: number; a0: number }
  | { kind: 'pan'; id: number; start: View; c0: Pt }
  /** Режим «Картинка» на тач-экране: два пальца масштабируют и двигают холст. */
  | { kind: 'hpinch'; ids: [number, number]; d: number; c: Pt };

/** Где картинка внутри сцены, px CSS. */
interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
  /** Отступы сцены: за них ручка поворота не выходит. */
  pad: { top: number; right: number; bottom: number; left: number };
  sw: number;
  sh: number;
}

/** Вид холста: zoom — к вписанному размеру картинки, x и y — сдвиг её центра, px CSS. */
interface View {
  zoom: number;
  x: number;
  y: number;
}
const FIT: View = { zoom: 1, x: 0, y: 0 };
/** Отдалить можно до четверти вписанного размера — чтобы достать ручки пластины за краем картинки. */
const MIN_ZOOM = 0.25;
/** Приблизить — до 3200 %: 32 px экрана на пиксель картинки. */
const MAX_SCALE = 32;
/** Сколько картинки остаётся на виду, как её ни двигай, px CSS. */
const KEEP = 48;

const clampZoom = (zoom: number, fit: Box, iw: number) => Math.min(Math.max(2, (MAX_SCALE * iw) / fit.width), Math.max(MIN_ZOOM, zoom));

function clampView(v: View, fit: Box, iw: number): View {
  const zoom = clampZoom(v.zoom, fit, iw);
  const w = fit.width * zoom;
  const h = fit.height * zoom;
  const limX = (fit.width + w) / 2 - Math.min(KEEP, w, fit.width);
  const limY = (fit.height + h) / 2 - Math.min(KEEP, h, fit.height);
  return { zoom, x: Math.min(limX, Math.max(-limX, v.x)), y: Math.min(limY, Math.max(-limY, v.y)) };
}

/** Где картинка при этом виде: вписанное место, увеличенное вокруг центра и сдвинутое. */
function placed(fit: Box, v: View): Box {
  const width = fit.width * v.zoom;
  const height = fit.height * v.zoom;
  return {
    ...fit,
    left: fit.left + fit.width / 2 + v.x - width / 2,
    top: fit.top + fit.height / 2 + v.y - height / 2,
    width,
    height,
  };
}

/** Кнопки масштаба в шапке. */
export interface StageApi {
  zoomIn: () => void;
  zoomOut: () => void;
  fit: () => void;
  actual: () => void;
}

/** Ручка поворота над пластиной, px CSS. */
const ROTATE_GAP = 30;
const RESIZE_CURSORS = ['ew-resize', 'nwse-resize', 'ns-resize', 'nesw-resize'];
const coarse = () => window.matchMedia('(pointer: coarse)').matches;

const mid = (a: Pt, b: Pt): Pt => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

interface StageProps {
  ref: Ref<StageApi>;
  image: LoadedImage;
  params: GlassParams;
  onParams: (p: GlassParams) => void;
  hint: boolean;
  /** Тач-экран: пальцы двигают и масштабируют картинку, а не стекло. */
  hand: boolean;
  onInteract: () => void;
  /** Масштаб холста, %: 100 — пиксель картинки на пиксель экрана. */
  onZoom: (percent: number) => void;
}

export function Stage({ ref, image, params, onParams, hint, hand, onInteract, onZoom }: StageProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<GlassRenderer | null>(null);
  const [fit, setFit] = useState<Box | null>(null);
  const [view, setView] = useState<View>(FIT);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const box = fit ? placed(fit, clampView(view, fit, image.width)) : null;

  // Обработчики жестов живут дольше рендера — берут свежие значения из ссылок.
  const live = useRef({ params, image, box, fit, view, hand, onParams, onInteract });
  live.current = { params, image, box, fit, view, hand, onParams, onInteract };

  /** Пикселей холста на px CSS. */
  const dpr = useRef(1);
  const raf = useRef(0);
  const draw = useCallback(() => {
    if (raf.current) return;
    raf.current = requestAnimationFrame(() => {
      raf.current = 0;
      const r = rendererRef.current;
      const b = live.current.box;
      const info = r?.imageInfo;
      if (!r || !b || !info) return;
      const k = dpr.current;
      r.render(live.current.params, { x: b.left * k, y: b.top * k, scale: (b.width * k) / info.width });
    });
  }, []);

  // ---------- масштаб холста ----------

  /** Умножить масштаб на k, не сдвинув точку под курсором (без курсора — центр места под картинку). */
  const zoomAt = useCallback((k: number, sx?: number, sy?: number, dx = 0, dy = 0) => {
    const { fit: f, image: img } = live.current;
    if (!f) return;
    setView((v) => {
      const cur = clampView(v, f, img.width);
      const b = placed(f, cur);
      const zoom = clampZoom(cur.zoom * k, f, img.width);
      const px = sx ?? f.left + f.width / 2;
      const py = sy ?? f.top + f.height / 2;
      const w = f.width * zoom;
      const h = f.height * zoom;
      const left = px - ((px - b.left) / b.width) * w;
      const top = py - ((py - b.top) / b.height) * h;
      return clampView({ zoom, x: left + dx + w / 2 - f.left - f.width / 2, y: top + dy + h / 2 - f.top - f.height / 2 }, f, img.width);
    });
  }, []);

  const api: StageApi = {
    zoomIn: () => zoomAt(1.5),
    zoomOut: () => zoomAt(1 / 1.5),
    fit: () => setView(FIT),
    actual: () => {
      const { fit: f, view: v, image: img } = live.current;
      if (f) zoomAt(img.width / f.width / clampView(v, f, img.width).zoom);
    },
  };
  useImperativeHandle(ref, () => api);
  const apiRef = useRef(api);
  apiRef.current = api;

  // Новая картинка — снова целиком.
  useEffect(() => setView(FIT), [image]);

  const percent = box ? Math.round((box.width / image.width) * 100) : 0;
  useEffect(() => {
    if (percent) onZoom(percent);
  }, [percent, onZoom]);

  // ---------- рендерер и картинка ----------

  useEffect(() => {
    const canvas = canvasRef.current!;
    const create = () => {
      try {
        const r = new GlassRenderer(canvas);
        r.setImage(live.current.image.source);
        rendererRef.current = r;
        setError(null);
        draw();
      } catch (e) {
        setError(`Не получилось включить видеокарту: ${(e as Error).message}`);
      }
    };
    const lost = (e: Event) => {
      e.preventDefault();
      rendererRef.current = null;
    };
    canvas.addEventListener('webglcontextlost', lost);
    canvas.addEventListener('webglcontextrestored', create);
    create();
    return () => {
      canvas.removeEventListener('webglcontextlost', lost);
      canvas.removeEventListener('webglcontextrestored', create);
      cancelAnimationFrame(raf.current);
      raf.current = 0;
      rendererRef.current?.dispose();
      rendererRef.current = null;
    };
  }, [draw]);

  useEffect(() => {
    rendererRef.current?.setImage(image.source);
    draw();
  }, [image, draw]);

  // ---------- раскладка: картинка вписана в сцену за вычетом отступов ----------

  const layout = useCallback(() => {
    const el = stageRef.current;
    if (!el) return;
    const cs = getComputedStyle(el);
    const pad = {
      top: parseFloat(cs.paddingTop),
      right: parseFloat(cs.paddingRight),
      bottom: parseFloat(cs.paddingBottom),
      left: parseFloat(cs.paddingLeft),
    };
    const aw = Math.max(1, el.clientWidth - pad.left - pad.right);
    const ah = Math.max(1, el.clientHeight - pad.top - pad.bottom);
    const { width: iw, height: ih } = live.current.image;
    const k = Math.min(aw / iw, ah / ih);
    const width = iw * k;
    const height = ih * k;
    setFit({
      left: pad.left + (aw - width) / 2,
      top: pad.top + (ah - height) / 2,
      width,
      height,
      pad,
      sw: el.clientWidth,
      sh: el.clientHeight,
    });
  }, []);

  useLayoutEffect(() => {
    layout();
    // Отступы сцены зависят от высоты дока, а её мерит другой наблюдатель: пересчёт — в следующем кадре, без петли.
    let frameId = 0;
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(frameId);
      frameId = requestAnimationFrame(layout);
    });
    ro.observe(stageRef.current!);
    return () => {
      cancelAnimationFrame(frameId);
      ro.disconnect();
    };
  }, [layout, image]);

  // Холст — во всю сцену: картинка при приближении уходит под шапку, док и панель, как в Фигме.
  const sw = fit?.sw ?? 0;
  const sh = fit?.sh ?? 0;
  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !sw || !sh) return;
    const k = Math.min(window.devicePixelRatio || 1, 3);
    const w = Math.max(1, Math.round(sw * k));
    const h = Math.max(1, Math.round(sh * k));
    if (canvas.width !== w) canvas.width = w;
    if (canvas.height !== h) canvas.height = h;
    dpr.current = w / sw;
    draw();
  }, [sw, sh, draw]);

  useEffect(draw, [params, fit, view, draw]);

  // ---------- жесты ----------

  useEffect(() => {
    const stage = stageRef.current!;
    const pointers = new Map<number, Pt>();
    /** Те же пальцы в координатах экрана — для жестов холста, где картинка под пальцами сама едет. */
    const client = new Map<number, Pt>();
    let drag: Drag | null = null;
    /** Зажат пробел — любое нажатие двигает холст. */
    let space = false;

    /** px CSS на px картинки. */
    const cssK = () => live.current.box!.width / live.current.image.width;
    const toImage = (e: PointerEvent | WheelEvent): Pt => {
      const r = stage.getBoundingClientRect();
      const b = live.current.box!;
      const k = cssK();
      return { x: (e.clientX - r.left - b.left) / k, y: (e.clientY - r.top - b.top) / k };
    };
    const geometry = () => {
      const { params: p, image: img } = live.current;
      return plateGeometry(p.plate, img.width, img.height);
    };
    const commit = (g: PlateGeometry) => {
      const { params: p, image: img, onParams: set } = live.current;
      set(normalizeParams({ ...p, plate: plateFromGeometry(g, img.width, img.height) }));
    };
    /** Пределы полуразмера пластины, px картинки: не мельче 12 px на экране. */
    const halfLimits = () => {
      const img = live.current.image;
      const unit = Math.min(img.width, img.height) / 2;
      const lim = paramLimits('plate.width');
      return { min: Math.max(lim.min * unit, 12 / cssK()), max: lim.max * unit };
    };
    const clampK = (start: PlateGeometry, k: number) => {
      const { min, max } = halfLimits();
      const kMin = Math.max(min / start.hx, min / start.hy);
      const kMax = Math.min(max / start.hx, max / start.hy);
      return Math.min(kMax, Math.max(kMin, k));
    };

    /** Пустое место вокруг картинки: не ручка, не картинка и не пластина. */
    const onBackground = (e: PointerEvent, p: Pt) => {
      if ((e.target as Element).closest?.('[data-h]')) return false;
      const img = live.current.image;
      if (p.x >= 0 && p.y >= 0 && p.x <= img.width && p.y <= img.height) return false;
      const g = geometry();
      const l = toPlateLocal(g, p.x, p.y);
      return Math.abs(l.x) > g.hx || Math.abs(l.y) > g.hy;
    };
    const setPan = (start: View, dx: number, dy: number) => {
      const { fit: f, image: img } = live.current;
      if (f) setView(clampView({ ...start, x: start.x + dx, y: start.y + dy }, f, img.width));
    };

    const startPinch = () => {
      const [a, b] = [...pointers.entries()];
      const pa = a[1];
      const pb = b[1];
      drag = {
        kind: 'pinch',
        start: geometry(),
        ids: [a[0], b[0]],
        c0: mid(pa, pb),
        d0: Math.max(1e-3, Math.hypot(pb.x - pa.x, pb.y - pa.y)),
        a0: Math.atan2(pb.y - pa.y, pb.x - pa.x),
      };
    };

    const startHandPinch = () => {
      const [a, b] = [...client.entries()];
      drag = { kind: 'hpinch', ids: [a[0], b[0]], d: Math.max(1e-3, Math.hypot(b[1].x - a[1].x, b[1].y - a[1].y)), c: mid(a[1], b[1]) };
    };

    const down = (e: PointerEvent) => {
      if (!live.current.box) return;
      const middle = e.pointerType === 'mouse' && e.button === 1;
      if (e.pointerType === 'mouse' && e.button !== 0 && !middle) return;
      if (pointers.size >= 2) return;
      e.preventDefault();
      stage.setPointerCapture(e.pointerId);
      const p = toImage(e);
      pointers.set(e.pointerId, p);
      client.set(e.pointerId, { x: e.clientX, y: e.clientY });
      live.current.onInteract();
      setDragging(true);
      const handTouch = live.current.hand && e.pointerType === 'touch';
      if (pointers.size === 2) {
        if (handTouch) startHandPinch();
        else startPinch();
        return;
      }
      if (handTouch) {
        drag = { kind: 'pan', id: e.pointerId, start: live.current.view, c0: { x: e.clientX, y: e.clientY } };
        return;
      }
      // Палец мимо пластины по-прежнему переносит её; мышь по пустому месту двигает холст.
      if (middle || space || (e.pointerType !== 'touch' && onBackground(e, p))) {
        drag = { kind: 'pan', id: e.pointerId, start: live.current.view, c0: { x: e.clientX, y: e.clientY } };
        stage.style.setProperty('--drag-cursor', 'grabbing');
        return;
      }
      const handleEl = (e.target as Element).closest?.('[data-h]');
      const handle = handleEl?.getAttribute('data-h') ?? '';
      let g = geometry();
      const [kind, a, b] = handle.split(':');
      // Пока тянем, курсор — как у ручки, за которую взялись, даже если указатель с неё съехал.
      const resize = (kind === 'corner' || kind === 'side') && handleEl;
      stage.style.setProperty('--drag-cursor', resize ? getComputedStyle(handleEl).cursor : 'grabbing');
      if (kind === 'corner') {
        drag = { kind: 'corner', id: e.pointerId, start: g, sx: Number(a), sy: Number(b) };
      } else if (kind === 'side') {
        drag = { kind: 'side', id: e.pointerId, start: g, side: a as Side };
      } else if (kind === 'rotate') {
        drag = { kind: 'rotate', id: e.pointerId, start: g, a0: Math.atan2(p.y - g.cy, p.x - g.cx) };
      } else {
        const l = toPlateLocal(g, p.x, p.y);
        if (Math.abs(l.x) > g.hx || Math.abs(l.y) > g.hy) {
          g = { ...g, cx: p.x, cy: p.y };
          commit(g);
        }
        drag = { kind: 'move', id: e.pointerId, start: g, p0: p };
      }
    };

    const move = (e: PointerEvent) => {
      if (!drag && e.pointerType === 'mouse' && live.current.box) {
        // Над пустым местом — рука: отсюда холст тянется.
        stage.classList.toggle('over-bg', onBackground(e, toImage(e)));
        return;
      }
      if (!pointers.has(e.pointerId) || !drag) return;
      const p = toImage(e);
      pointers.set(e.pointerId, p);
      const d = drag;
      client.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (d.kind === 'hpinch') {
        const pa = client.get(d.ids[0]);
        const pb = client.get(d.ids[1]);
        if (!pa || !pb) return;
        const c = mid(pa, pb);
        const dist = Math.max(1e-3, Math.hypot(pb.x - pa.x, pb.y - pa.y));
        const r = stage.getBoundingClientRect();
        zoomAt(dist / d.d, c.x - r.left, c.y - r.top, c.x - d.c.x, c.y - d.c.y);
        drag = { ...d, d: dist, c };
        return;
      }
      if (d.kind === 'pan') {
        if (e.pointerId === d.id) setPan(d.start, e.clientX - d.c0.x, e.clientY - d.c0.y);
        return;
      }
      if (d.kind === 'pinch') {
        const pa = pointers.get(d.ids[0]);
        const pb = pointers.get(d.ids[1]);
        if (!pa || !pb) return;
        const c = mid(pa, pb);
        const k = clampK(d.start, Math.hypot(pb.x - pa.x, pb.y - pa.y) / d.d0);
        const da = Math.atan2(pb.y - pa.y, pb.x - pa.x) - d.a0;
        // Точка под пальцами остаётся под пальцами: центр поворачивается и масштабируется вокруг их середины.
        const vx = (d.start.cx - d.c0.x) * k;
        const vy = (d.start.cy - d.c0.y) * k;
        const cos = Math.cos(da);
        const sin = Math.sin(da);
        commit({
          cx: c.x + cos * vx - sin * vy,
          cy: c.y + sin * vx + cos * vy,
          hx: d.start.hx * k,
          hy: d.start.hy * k,
          angle: d.start.angle + da,
        });
        return;
      }
      if (e.pointerId !== d.id) return;
      if (d.kind === 'move') {
        commit({ ...d.start, cx: d.start.cx + p.x - d.p0.x, cy: d.start.cy + p.y - d.p0.y });
      } else if (d.kind === 'rotate') {
        let angle = d.start.angle + Math.atan2(p.y - d.start.cy, p.x - d.start.cx) - d.a0;
        if (e.shiftKey) angle = Math.round(angle / (Math.PI / 12)) * (Math.PI / 12);
        commit({ ...d.start, angle });
      } else if (d.kind === 'corner') {
        commit(scaleFromCorner(d.start, d.sx, d.sy, p, e.altKey));
      } else {
        commit(stretch(d.start, d.side, p, e.altKey));
      }
    };

    /** Пропорционально от противоположного угла (Alt — от центра): указатель проецируется на диагональ. */
    const scaleFromCorner = (start: PlateGeometry, sx: number, sy: number, p: Pt, fromCenter: boolean): PlateGeometry => {
      const l = toPlateLocal(start, p.x, p.y);
      const corner = { x: sx * start.hx, y: sy * start.hy };
      const anchor = fromCenter ? { x: 0, y: 0 } : { x: -corner.x, y: -corner.y };
      const dx = corner.x - anchor.x;
      const dy = corner.y - anchor.y;
      const k = clampK(start, ((l.x - anchor.x) * dx + (l.y - anchor.y) * dy) / (dx * dx + dy * dy));
      const c = fromCenter ? { x: start.cx, y: start.cy } : fromPlateLocal(start, anchor.x + (dx * k) / 2, anchor.y + (dy * k) / 2);
      return { ...start, cx: c.x, cy: c.y, hx: start.hx * k, hy: start.hy * k };
    };

    const stretch = (start: PlateGeometry, side: Side, p: Pt, fromCenter: boolean): PlateGeometry => {
      const { min, max } = halfLimits();
      const horizontal = side === 'left' || side === 'right';
      const l = toPlateLocal(start, p.x, p.y);
      const pos = horizontal ? l.x : l.y;
      const old = horizontal ? start.hx : start.hy;
      const sign = side === 'right' || side === 'bottom' ? 1 : -1;
      const half = Math.min(max, Math.max(min, fromCenter ? sign * pos : (sign * pos + old) / 2));
      const shift = fromCenter ? 0 : sign * (half - old);
      const c = horizontal ? fromPlateLocal(start, shift, 0) : fromPlateLocal(start, 0, shift);
      return horizontal ? { ...start, cx: c.x, cy: c.y, hx: half } : { ...start, cx: c.x, cy: c.y, hy: half };
    };

    const up = (e: PointerEvent) => {
      if (!pointers.delete(e.pointerId)) return;
      client.delete(e.pointerId);
      if (drag?.kind === 'hpinch' && pointers.size === 1) {
        const [id, p] = [...client.entries()][0];
        drag = { kind: 'pan', id, start: live.current.view, c0: p };
        return;
      }
      if (drag?.kind === 'pinch' && pointers.size === 1) {
        // Один палец остался — дальше он просто тащит стекло.
        const [id, p] = [...pointers.entries()][0];
        drag = { kind: 'move', id, start: geometry(), p0: p };
        return;
      }
      if (pointers.size === 0) {
        drag = null;
        setDragging(false);
      }
    };

    // Колесо — масштаб холста под курсором. Щипок на тачпаде приходит колесом с Ctrl и мелким шагом — ему чувствительнее.
    const wheel = (e: WheelEvent) => {
      if (!live.current.box) return;
      e.preventDefault();
      live.current.onInteract();
      const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1;
      const dy = (e.deltaY || e.deltaX) * unit;
      const r = stage.getBoundingClientRect();
      zoomAt(Math.exp(-dy * (e.ctrlKey ? 0.01 : 0.002)), e.clientX - r.left, e.clientY - r.top);
    };

    // Средняя кнопка в Windows включает автопрокрутку — гасим, она двигает холст.
    const noAutoscroll = (e: MouseEvent) => {
      if (e.button === 1) e.preventDefault();
    };

    const typing = (t: EventTarget | null) =>
      t instanceof HTMLElement && (t.isContentEditable || t.tagName === 'TEXTAREA' || (t.tagName === 'INPUT' && (t as HTMLInputElement).type !== 'range'));
    const key = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || typing(e.target)) return;
      const api = apiRef.current;
      if (e.code === 'Space') {
        // На кнопке пробел нажимает её — не перехватываем.
        if ((e.target as HTMLElement).closest?.('button')) return;
        e.preventDefault();
        space = true;
        stage.classList.add('space');
      } else if (e.shiftKey && e.code === 'Digit1') api.fit();
      else if (e.shiftKey && e.code === 'Digit0') api.actual();
      else if (e.code === 'Equal' || e.code === 'NumpadAdd') api.zoomIn();
      else if (e.code === 'Minus' || e.code === 'NumpadSubtract') api.zoomOut();
    };
    const keyUp = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return;
      space = false;
      stage.classList.remove('space');
    };
    const blur = () => {
      space = false;
      stage.classList.remove('space');
    };

    // Safari: щипок по странице масштабирует её, даже если сам жест мы обработали.
    const block = (e: Event) => e.preventDefault();

    stage.addEventListener('pointerdown', down);
    stage.addEventListener('pointermove', move);
    stage.addEventListener('pointerup', up);
    stage.addEventListener('pointercancel', up);
    stage.addEventListener('wheel', wheel, { passive: false });
    stage.addEventListener('touchmove', block, { passive: false });
    stage.addEventListener('mousedown', noAutoscroll);
    window.addEventListener('keydown', key);
    window.addEventListener('keyup', keyUp);
    window.addEventListener('blur', blur);
    return () => {
      stage.removeEventListener('mousedown', noAutoscroll);
      window.removeEventListener('keydown', key);
      window.removeEventListener('keyup', keyUp);
      window.removeEventListener('blur', blur);
      stage.removeEventListener('pointerdown', down);
      stage.removeEventListener('pointermove', move);
      stage.removeEventListener('pointerup', up);
      stage.removeEventListener('pointercancel', up);
      stage.removeEventListener('wheel', wheel);
      stage.removeEventListener('touchmove', block);
    };
  }, [zoomAt]);

  // ---------- рамка ----------

  let frame = null;
  if (box) {
    const k = box.width / image.width;
    const g = plateGeometry(params.plate, image.width, image.height);
    const css = (p: Pt): Pt => ({ x: box.left + p.x * k, y: box.top + p.y * k });
    const corners = plateCorners(g).map(css);
    const deg = (g.angle * 180) / Math.PI;
    const big = coarse();
    const hit = big ? 44 : 22;
    const cursor = (base: number) => RESIZE_CURSORS[Math.round(((((base + deg) % 180) + 180) % 180) / 45) % 4];

    // Ручка поворота — над верхней стороной; если там край сцены, она уходит внутрь пластины.
    const out = css(fromPlateLocal(g, 0, -g.hy - ROTATE_GAP / k));
    const room = 6;
    const outside =
      out.y < box.pad.top - room || out.x < box.pad.left - room || out.x > box.sw - box.pad.right + room || out.y > box.sh - box.pad.bottom + room;
    const rot = outside && g.hy * k > ROTATE_GAP * 2.5 ? css(fromPlateLocal(g, 0, -g.hy + ROTATE_GAP / k)) : out;
    const topMid = mid(corners[0], corners[1]);

    const square = (key: string, c: Pt, size: number, cur: string, extra = 0) => (
      <g key={key} data-h={key} style={{ cursor: cur }} transform={`rotate(${deg + extra} ${c.x} ${c.y})`}>
        <rect className="hit" x={c.x - hit / 2} y={c.y - hit / 2} width={hit} height={hit} />
        <rect className="h" x={c.x - size / 2} y={c.y - size / 2} width={size} height={size} rx={4} />
      </g>
    );
    const bar = (key: string, c: Pt, extra: number, cur: string) => (
      <g key={key} data-h={key} style={{ cursor: cur }} transform={`rotate(${deg + extra} ${c.x} ${c.y})`}>
        <rect className="hit" x={c.x - hit * 0.8} y={c.y - hit / 2} width={hit * 1.6} height={hit} />
        <rect className="h" x={c.x - 9} y={c.y - 3} width={18} height={6} rx={3} />
      </g>
    );

    frame = (
      <svg className="frame" aria-hidden="true">
        <polygon data-h="move" className="plate" points={corners.map((c) => `${c.x},${c.y}`).join(' ')} />
        <line className="stem" x1={topMid.x} y1={topMid.y} x2={rot.x} y2={rot.y} />
        {bar('side:top', topMid, 0, cursor(90))}
        {bar('side:bottom', mid(corners[2], corners[3]), 0, cursor(90))}
        {bar('side:right', mid(corners[1], corners[2]), 90, cursor(0))}
        {bar('side:left', mid(corners[3], corners[0]), 90, cursor(0))}
        {/* Ось y вниз: левый верхний и правый нижний углы — на диагонали 45°, два других — на −45°. */}
        {square('corner:-1:-1', corners[0], 14, cursor(45))}
        {square('corner:1:-1', corners[1], 14, cursor(-45))}
        {square('corner:1:1', corners[2], 14, cursor(45))}
        {square('corner:-1:1', corners[3], 14, cursor(-45))}
        <g data-h="rotate" className="rot" transform={`rotate(${deg} ${rot.x} ${rot.y})`}>
          <rect className="hit" x={rot.x - hit / 2} y={rot.y - hit / 2} width={hit} height={hit} />
          <rect className="h" x={rot.x - 11} y={rot.y - 11} width={22} height={22} rx={6} />
          <path
            className="glyph"
            d={`M${rot.x + 4.5} ${rot.y - 1.5}a4.6 4.6 0 1 0 -1.2 4.6M${rot.x + 4.8} ${rot.y - 5.2}v3.8h-3.8`}
          />
        </g>
      </svg>
    );
  }

  return (
    <div className={`stage${dragging ? ' dragging' : ''}`} ref={stageRef}>
      {box && <div className="paper" style={{ left: box.left, top: box.top, width: box.width, height: box.height }} />}
      <canvas
        ref={canvasRef}
        className="glass"
        style={
          box
            ? {
                // Скругление и тень у картинки, а не у холста: холст — во всю сцену.
                clipPath: `inset(${Math.max(0, box.top)}px ${Math.max(0, box.sw - box.left - box.width)}px ${Math.max(0, box.sh - box.top - box.height)}px ${Math.max(0, box.left)}px round var(--r))`,
              }
            : { visibility: 'hidden' }
        }
      />
      {frame}
      {hint && box && (
        <div className="drag-hint" style={{ left: box.left + box.width / 2, top: box.top + box.height / 2 }}>
          <IconMove />
          Тяните стекло
        </div>
      )}
      {error && <p className="stage-error">{error}</p>}
    </div>
  );
}

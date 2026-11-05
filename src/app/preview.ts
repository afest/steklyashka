import { GlassRenderer, type GlassParams } from '../glass';
import type { ImageSource } from './load';

/**
 * Один общий рендерер на все маленькие картинки: превью наборов, примеры, карточка сохранения.
 * Рисуем сразу в canvas страницы — без data- и blob-адресов.
 */
let shared: { canvas: HTMLCanvasElement; r: GlassRenderer; src: ImageSource | null } | null = null;

function renderer() {
  if (!shared) {
    const canvas = document.createElement('canvas');
    shared = { canvas, r: new GlassRenderer(canvas, { preserveDrawingBuffer: true }), src: null };
    canvas.addEventListener('webglcontextlost', () => (shared = null));
  }
  return shared;
}

/**
 * Картинка в target (размер холста уже выставлен). cover — заполнить с обрезкой, иначе вписать.
 * params null — без стекла.
 */
export function drawPreview(target: HTMLCanvasElement, source: ImageSource, params: GlassParams | null, cover = true): void {
  const W = target.width;
  const H = target.height;
  const ctx = target.getContext('2d');
  if (!ctx || !W || !H) return;
  const sw = source instanceof HTMLImageElement ? source.naturalWidth : source.width;
  const sh = source instanceof HTMLImageElement ? source.naturalHeight : source.height;
  const k = (cover ? Math.max : Math.min)(W / sw, H / sh);
  const view = { x: (W - sw * k) / 2, y: (H - sh * k) / 2, scale: k };
  ctx.clearRect(0, 0, W, H);
  if (!params) {
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(source, view.x, view.y, sw * k, sh * k);
    return;
  }
  const s = renderer();
  if (s.src !== source) {
    s.r.setImage(source);
    s.src = source;
  }
  // Превью может быть уменьшенной копией: масштаб считаем от того, что ушло в текстуру.
  const info = s.r.imageInfo!;
  const kt = (cover ? Math.max : Math.min)(W / info.width, H / info.height);
  s.canvas.width = W;
  s.canvas.height = H;
  s.r.render(params, { x: (W - info.width * kt) / 2, y: (H - info.height * kt) / 2, scale: kt });
  ctx.drawImage(s.canvas, 0, 0);
}

/** Размер холста под элемент с учётом плотности экрана. */
export function fitCanvas(c: HTMLCanvasElement, maxDpr = 2): void {
  const dpr = Math.min(window.devicePixelRatio || 1, maxDpr);
  const w = Math.max(1, Math.round(c.clientWidth * dpr));
  const h = Math.max(1, Math.round(c.clientHeight * dpr));
  if (c.width !== w) c.width = w;
  if (c.height !== h) c.height = h;
}

import { plateCorners, plateGeometry } from './geometry';
import type { GlassParams } from './params';
import { GlassRenderer, type GlassSource, type Rgba } from './renderer';

/** full — вся картинка со стеклом; plate — прямоугольник вокруг пластины (у повёрнутой — описанный). */
export type ExportArea = 'full' | 'plate';
/** Что в прямоугольнике «plate» вокруг пластины: картинка как есть, чёрный или прозрачный. */
export type ExportOutside = 'keep' | 'black' | 'transparent';

export interface ExportOptions {
  area: ExportArea;
  outside?: ExportOutside;
}

export interface ExportResult {
  blob: Blob;
  width: number;
  height: number;
  /** Результат больше предела видеокарты и отрисован уменьшенным. */
  downscaled: boolean;
}

const FILL: Record<ExportOutside, Rgba | null> = {
  keep: null,
  black: [0, 0, 0, 1],
  transparent: [0, 0, 0, 0],
};

/** Отрисовка в исходном разрешении картинки (не снимок экрана) → PNG. */
export async function exportPng(source: GlassSource, params: GlassParams, options: ExportOptions): Promise<ExportResult> {
  const canvas = document.createElement('canvas');
  const r = new GlassRenderer(canvas, { preserveDrawingBuffer: true });
  try {
    const info = r.setImage(source);
    let x0 = 0;
    let y0 = 0;
    let w = info.width;
    let h = info.height;
    if (options.area === 'plate') {
      const corners = plateCorners(plateGeometry(params.plate, info.width, info.height));
      const xs = corners.map((c) => c.x);
      const ys = corners.map((c) => c.y);
      x0 = Math.floor(Math.min(...xs));
      y0 = Math.floor(Math.min(...ys));
      w = Math.ceil(Math.max(...xs)) - x0;
      h = Math.ceil(Math.max(...ys)) - y0;
    }
    const gl = r.gl;
    const dims = gl.getParameter(gl.MAX_VIEWPORT_DIMS) as Int32Array;
    const limit = Math.min(gl.getParameter(gl.MAX_RENDERBUFFER_SIZE) as number, dims[0], dims[1]);
    let scale = Math.min(1, limit / Math.max(w, h));
    canvas.width = Math.max(1, Math.round(w * scale));
    canvas.height = Math.max(1, Math.round(h * scale));
    // Браузер вправе выделить буфер меньше запрошенного (телефон, нехватка памяти) — рисуем в то, что дали.
    const fit = Math.min(gl.drawingBufferWidth / canvas.width, gl.drawingBufferHeight / canvas.height);
    if (fit < 1) {
      scale *= fit;
      canvas.width = Math.max(1, Math.floor(w * scale));
      canvas.height = Math.max(1, Math.floor(h * scale));
    }
    const fill = options.area === 'plate' ? FILL[options.outside ?? 'keep'] : null;
    r.background = fill ?? [0, 0, 0, 0];
    r.render(params, { x: -x0 * scale, y: -y0 * scale, scale }, fill);
    const blob = await new Promise<Blob>((ok, fail) =>
      canvas.toBlob((b) => (b ? ok(b) : fail(new Error('PNG не собрался'))), 'image/png'),
    );
    return { blob, width: canvas.width, height: canvas.height, downscaled: scale < 1 || info.downscaled };
  } finally {
    r.dispose();
    r.gl.getExtension('WEBGL_lose_context')?.loseContext();
  }
}

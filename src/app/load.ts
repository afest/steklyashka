/**
 * Открытие картинки: файл, вставка из буфера, пример. Всё в браузере, сеть не трогаем.
 * Картинка сразу уменьшается до предела видеокарты, чтобы экран и сохранение работали с одним размером.
 */

export type ImageSource = ImageBitmap | HTMLCanvasElement | HTMLImageElement;

export interface LoadedImage {
  source: ImageSource;
  /** Копия до 768 px по длинной стороне — для превью готовых наборов. */
  preview: HTMLCanvasElement;
  width: number;
  height: number;
  name: string;
  /** Исходный размер, если картинку пришлось уменьшить. */
  original?: { width: number; height: number };
}

export class LoadError extends Error {}

let cachedLimit: number | null = null;

/**
 * Самая большая сторона, которую видеокарта примет и как текстуру, и как холст для сохранения.
 * 0 — WebGL2 нет вовсе.
 */
export function gpuLimit(): number {
  if (cachedLimit !== null) return cachedLimit;
  const gl = document.createElement('canvas').getContext('webgl2');
  if (!gl) return (cachedLimit = 0);
  const dims = gl.getParameter(gl.MAX_VIEWPORT_DIMS) as Int32Array;
  cachedLimit = Math.min(
    gl.getParameter(gl.MAX_TEXTURE_SIZE) as number,
    gl.getParameter(gl.MAX_RENDERBUFFER_SIZE) as number,
    dims[0],
    dims[1],
  );
  gl.getExtension('WEBGL_lose_context')?.loseContext();
  return cachedLimit;
}

const sizeOf = (s: ImageSource) =>
  s instanceof HTMLImageElement ? { width: s.naturalWidth, height: s.naturalHeight } : { width: s.width, height: s.height };

function isHeic(file: Blob, name: string): boolean {
  return /image\/hei[cf]/i.test(file.type) || /\.hei[cf]$/i.test(name);
}

/** Через <img>: запасной путь, если createImageBitmap не понял файл. Ориентацию из EXIF браузер применяет сам. */
function decodeViaImg(file: Blob): Promise<HTMLImageElement> {
  return new Promise((ok, fail) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      ok(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      fail(new Error('decode'));
    };
    img.src = url;
  });
}

async function decode(file: Blob): Promise<ImageSource> {
  try {
    // Фото с телефона хранит поворот в EXIF: без from-image портрет ляжет на бок.
    return await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    return decodeViaImg(file);
  }
}

function scaled(source: ImageSource, width: number, height: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = width;
  c.height = height;
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source, 0, 0, width, height);
  return c;
}

function fitInto(width: number, height: number, max: number): { width: number; height: number } {
  if (Math.max(width, height) <= max) return { width, height };
  const k = max / Math.max(width, height);
  return { width: Math.max(1, Math.floor(width * k)), height: Math.max(1, Math.floor(height * k)) };
}

export async function prepare(source: ImageSource, name: string): Promise<LoadedImage> {
  const limit = gpuLimit();
  if (!limit) throw new LoadError('Браузер не поддерживает WebGL2 — стекло рисовать нечем. Откройте страницу в свежем Chrome, Safari или Firefox.');
  const size = sizeOf(source);
  if (!size.width || !size.height) throw new LoadError('Картинка пустая — нечего показывать.');
  const fit = fitInto(size.width, size.height, limit);
  const downscaled = fit.width !== size.width;
  const main = downscaled ? scaled(source, fit.width, fit.height) : source;
  const small = fitInto(fit.width, fit.height, 768);
  return {
    source: main,
    preview: scaled(main, small.width, small.height),
    width: fit.width,
    height: fit.height,
    name,
    original: downscaled ? size : undefined,
  };
}

export async function loadFile(file: Blob, name = 'картинка'): Promise<LoadedImage> {
  let source: ImageSource;
  try {
    source = await decode(file);
  } catch {
    if (isHeic(file, name)) {
      throw new LoadError(
        'Формат HEIC этот браузер не открывает. Сохраните фото как JPEG — на iPhone: Настройки → Камера → Форматы → «Наиболее совместимый» — или откройте страницу в Safari.',
      );
    }
    throw new LoadError('Не получилось открыть файл. Подойдут JPEG, PNG и WebP.');
  }
  return prepare(source, name);
}

/** Первая картинка из буфера обмена или перетаскивания. */
export function imageFromItems(items: DataTransferItemList | null | undefined): File | null {
  if (!items) return null;
  for (const item of items) {
    if (item.kind === 'file') {
      const f = item.getAsFile();
      if (f && (f.type.startsWith('image/') || /\.(hei[cf]|jpe?g|png|webp)$/i.test(f.name))) return f;
    }
  }
  return null;
}

export function describeDownscale(img: LoadedImage): string | null {
  if (!img.original) return null;
  const f = (n: number) => n.toLocaleString('ru-RU');
  return `Картинка ${f(img.original.width)} × ${f(img.original.height)} больше, чем берёт видеокарта, — уменьшили до ${f(img.width)} × ${f(img.height)}. Сохранится в этом размере.`;
}

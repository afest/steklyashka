import { exportPng, type ExportArea, type GlassParams } from '../glass';
import type { ImageSource } from './load';

export interface SavedImage {
  blob: Blob;
  file: string;
  width: number;
  height: number;
  downscaled: boolean;
  area: ExportArea;
}

const two = (n: number) => String(n).padStart(2, '0');

export function fileName(d = new Date()): string {
  return `steklyashka-${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}-${two(d.getHours())}${two(d.getMinutes())}${two(d.getSeconds())}.png`;
}

/** Отрисовка шейдером во внеэкранный холст в размере картинки — не снимок экрана. */
export async function renderPng(source: ImageSource, params: GlassParams, area: ExportArea): Promise<SavedImage> {
  const r = await exportPng(source, params, { area, outside: 'transparent' });
  return { ...r, file: fileName(), area };
}

/**
 * iPhone и iPad: скачивание по ссылке там ненадёжно, сохраняем через «Поделиться».
 * iPad с iPadOS 13 представляется Mac'ом — отличаем по сенсорному экрану.
 */
export const isAppleMobile =
  /iP(hone|od|ad)/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);

export function download(saved: SavedImage): void {
  const url = URL.createObjectURL(saved.blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = saved.file;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

export function canShare(saved: SavedImage): boolean {
  const file = new File([saved.blob], saved.file, { type: 'image/png' });
  return typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] });
}

/** true — пользователь поделился или сохранил; false — закрыл меню. */
export async function share(saved: SavedImage): Promise<boolean> {
  const file = new File([saved.blob], saved.file, { type: 'image/png' });
  try {
    await navigator.share({ files: [file] });
    return true;
  } catch (e) {
    if ((e as DOMException).name === 'AbortError') return false;
    throw e;
  }
}

/** Запасной путь для iPhone без «Поделиться»: картинка в новой вкладке, там её можно сохранить долгим нажатием. */
export function openInTab(saved: SavedImage): void {
  const url = URL.createObjectURL(saved.blob);
  window.open(url, '_blank');
  setTimeout(() => URL.revokeObjectURL(url), 120_000);
}

export const canCopy = typeof ClipboardItem !== 'undefined' && !!navigator.clipboard?.write;

export async function copy(saved: SavedImage): Promise<void> {
  await navigator.clipboard.write([new ClipboardItem({ 'image/png': saved.blob })]);
}

export function formatBytes(n: number): string {
  if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))} КБ`;
  return `${(n / 1024 / 1024).toFixed(1).replace('.', ',')} МБ`;
}

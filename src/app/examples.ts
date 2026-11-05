/**
 * Примеры на пустом экране. Кот — фото с лицензией CC BY 4.0 (подпись автора — на пустом экране),
 * плакат, пейзаж и узор рисуются здесь же на canvas: картинок со стороны за ними нет.
 */

import catUrl from './assets/cat.jpg';

export interface Example {
  id: string;
  title: string;
  /** Имя для вкладки и подписи. */
  file: string;
  make: () => Promise<HTMLCanvasElement | HTMLImageElement>;
}

const W = 1600;
const H = 1200;

function canvas(): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  return [c, c.getContext('2d')!];
}

function poster(): HTMLCanvasElement {
  const [c, ctx] = canvas();
  ctx.fillStyle = '#2140F5';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#FFD83A';
  ctx.textBaseline = 'alphabetic';
  ctx.font = '600 470px "Golos Text", system-ui, sans-serif';
  ctx.fillText('ЛИН', 70, 520);
  ctx.fillText('ЗЫ', 70, 1060);
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '600 54px "Golos Text", system-ui, sans-serif';
  ctx.fillText('29 · 10', W - 290, 1110);
  ctx.beginPath();
  ctx.arc(1240, 760, 150, 0, Math.PI * 2);
  ctx.fill();
  return c;
}

function landscape(): HTMLCanvasElement {
  const [c, ctx] = canvas();
  const sky = ctx.createLinearGradient(0, 0, 0, H * 0.62);
  sky.addColorStop(0, '#3B2A6B');
  sky.addColorStop(0.55, '#B65C8B');
  sky.addColorStop(1, '#F6B27A');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#FFE3B0';
  ctx.beginPath();
  ctx.arc(W * 0.62, H * 0.5, 110, 0, Math.PI * 2);
  ctx.fill();
  const ridge = (base: number, amp: number, seed: number, color: string) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, H);
    for (let x = 0; x <= W; x += 20) {
      const y = base - amp * (0.55 * Math.abs(Math.sin(x / 260 + seed)) + 0.45 * Math.abs(Math.sin(x / 97 + seed * 2)));
      ctx.lineTo(x, y);
    }
    ctx.lineTo(W, H);
    ctx.fill();
  };
  ridge(H * 0.62, 260, 1.3, '#7A4B86');
  ridge(H * 0.64, 170, 2.9, '#4D2F68');
  ctx.fillStyle = '#2B1F45';
  ctx.fillRect(0, H * 0.64, W, H * 0.36);
  ctx.fillStyle = 'rgba(255, 214, 160, 0.75)';
  for (let i = 0; i < 9; i++) {
    const w = 260 - i * 22;
    ctx.fillRect(W * 0.62 - w / 2, H * 0.68 + i * 34, w, 8);
  }
  return c;
}

function pattern(): HTMLCanvasElement {
  const [c, ctx] = canvas();
  const colors = ['#0F3D4C', '#F2495C', '#FFB703', '#1EC8A5', '#F4EFE3', '#2D6CDF'];
  const cell = 400;
  for (let y = 0; y < H; y += cell) {
    for (let x = 0; x < W; x += cell) {
      const k = (x / cell + (y / cell) * 3) % 6;
      ctx.fillStyle = colors[k];
      ctx.fillRect(x, y, cell, cell);
      ctx.fillStyle = colors[(k + 2) % 6];
      if (k % 3 === 0) {
        ctx.beginPath();
        ctx.arc(x + cell / 2, y + cell / 2, cell * 0.32, 0, Math.PI * 2);
        ctx.fill();
      } else if (k % 3 === 1) {
        for (let i = 0; i < 5; i++) ctx.fillRect(x + 30 + i * 74, y + 30, 36, cell - 60);
      } else {
        ctx.beginPath();
        ctx.moveTo(x, y + cell);
        ctx.lineTo(x + cell, y);
        ctx.lineTo(x + cell, y + cell);
        ctx.fill();
      }
    }
  }
  return c;
}

function photo(url: string): Promise<HTMLImageElement> {
  return new Promise((ok, fail) => {
    const img = new Image();
    img.onload = () => ok(img);
    img.onerror = () => fail(new Error('Пример не загрузился'));
    img.src = url;
  });
}

const fonts = () => document.fonts?.load('600 100px "Golos Text"').catch(() => undefined);

export const EXAMPLES: Example[] = [
  { id: 'cat', title: 'Кот', file: 'кот.jpg', make: () => photo(catUrl) },
  { id: 'poster', title: 'Плакат', file: 'плакат.png', make: async () => (await fonts(), poster()) },
  { id: 'landscape', title: 'Пейзаж', file: 'пейзаж.png', make: async () => landscape() },
  { id: 'pattern', title: 'Узор', file: 'узор.png', make: async () => pattern() },
];

export const CAT_CREDIT = {
  author: 'PantheraLeo1359531',
  license: 'CC BY 4.0',
  licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
  sourceUrl: 'https://commons.wikimedia.org/wiki/File:Katzengesicht_BKH_20201107_DSC5735.jpg',
};

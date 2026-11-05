/**
 * Примеры на пустом экране. Кот — фото с лицензией CC BY 4.0, портрет — CC0 (подписи авторов — на пустом экране),
 * плакат и пейзаж рисуются здесь же на canvas: картинок со стороны за ними нет.
 */

import type { PlateParams, PresetName } from '../glass';
import catUrl from './assets/cat.jpg';
import portraitUrl from './assets/portrait.jpg';

export interface Example {
  id: string;
  title: string;
  /** Имя для вкладки и подписи. */
  file: string;
  make: () => Promise<HTMLCanvasElement | HTMLImageElement>;
  /** Стекло, с которым пример открывается: коту, лицу и шрифту нужны разные искажения. */
  look: PresetName;
  /** Где стоит пластина (доли кадра: центр и размер в меньших сторонах); без этого — во весь кадр. */
  plate?: Pick<PlateParams, 'x' | 'y' | 'width' | 'height'>;
}

const W = 1600;
const H = 1200;

function canvas(): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  return [c, c.getContext('2d')!];
}

/** Строка, вписанная по ширине: кегль подбирается замером, а не растяжкой букв. */
function fitLine(ctx: CanvasRenderingContext2D, text: string, x: number, baseline: number, width: number) {
  ctx.font = '600 100px "Golos Text", system-ui, sans-serif';
  const size = (100 * width) / ctx.measureText(text).width;
  ctx.font = `600 ${size}px "Golos Text", system-ui, sans-serif`;
  // Лёгкая обводка утяжеляет начертание: самого жирного у шрифта в сборке нет.
  ctx.lineWidth = size * 0.035;
  ctx.lineJoin = 'round';
  ctx.strokeText(text, x, baseline);
  ctx.fillText(text, x, baseline);
  return size;
}

function poster(): HTMLCanvasElement {
  const pw = 1200;
  const ph = 1680;
  const c = document.createElement('canvas');
  c.width = pw;
  c.height = ph;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#0A0A0A';
  ctx.fillRect(0, 0, pw, ph);
  ctx.fillStyle = '#FFFFFF';
  ctx.strokeStyle = '#FFFFFF';
  ctx.textBaseline = 'alphabetic';

  const small = (text: string, x: number, y: number, align: CanvasTextAlign = 'left', size = 28) => {
    ctx.font = `500 ${size}px "Golos Text", system-ui, sans-serif`;
    ctx.textAlign = align;
    ctx.fillText(text, x, y);
  };

  // Шапка: мелкие подписи по углам.
  small('Новый', 64, 96);
  small('взгляд', 64, 130);
  small('2026', pw - 64, 118, 'right', 58);

  // Заголовок: крупные строки лесенкой, у каждой своя ширина.
  ctx.lineWidth = 0;
  ctx.textAlign = 'left';
  fitLine(ctx, 'Стекло', 64, 720, 1060);
  fitLine(ctx, 'меняет', 190, 1000, 940);
  fitLine(ctx, 'взгляд', 64, 1280, 1000);
  ctx.textAlign = 'left';

  // Колонка текста справа от верхней строки.
  const note = ['Картинка', 'распадается', 'на блоки,', 'а внутри', 'блока жива', 'вся текстура.'];
  note.forEach((line, i) => small(line, pw - 64, 214 + i * 36, 'right', 26));

  // Низ: тонкая линия и три подписи.
  ctx.fillRect(64, 1472, pw - 128, 2);
  small('Серия', 64, 1544);
  small('Стекло из ячеек', 64, 1580);
  small('Печатный', pw / 2, 1544, 'center');
  small('плакат', pw / 2, 1580, 'center');
  small('№ 07', pw - 64, 1580, 'right', 44);
  ctx.textAlign = 'left';
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
  { id: 'cat', title: 'Кот', file: 'кот.jpg', make: () => photo(catUrl), look: 'caricature' },
  { id: 'poster', title: 'Плакат', file: 'плакат.png', make: async () => (await fonts(), poster()), look: 'slices' },
  { id: 'landscape', title: 'Пейзаж', file: 'пейзаж.png', make: async () => landscape(), look: 'caricature' },
  { id: 'portrait', title: 'Портрет', file: 'портрет.jpg', make: () => photo(portraitUrl), look: 'fluted', plate: { x: 0.3, y: 0.5, width: 0.6, height: 1.5 } },
];

export const CAT_CREDIT = {
  author: 'PantheraLeo1359531',
  license: 'CC BY 4.0',
  licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
  sourceUrl: 'https://commons.wikimedia.org/wiki/File:Katzengesicht_BKH_20201107_DSC5735.jpg',
};

export const PORTRAIT_CREDIT = {
  author: 'Ilya Yakover',
  license: 'CC0',
  sourceUrl: 'https://commons.wikimedia.org/wiki/File:Ilya_Yakover_2017-05-24_(Unsplash).jpg',
};

/**
 * Примеры на пустом экране. Кот — фото с лицензией CC BY 4.0, портрет и пейзаж — CC0 (подписи авторов — на пустом экране),
 * плакат рисуется здесь же на canvas.
 */

import type { PlateParams, PresetName } from '../glass';
import catUrl from './assets/cat.jpg';
import landscapeUrl from './assets/landscape.jpg';
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

/** Кегль, при котором самая широкая из строк занимает ровно width; все строки набираются одним кеглем. */
function fitSize(ctx: CanvasRenderingContext2D, lines: string[], width: number) {
  ctx.font = '600 100px "Golos Text", system-ui, sans-serif';
  const widest = Math.max(...lines.map((t) => ctx.measureText(t).width));
  return (100 * width) / widest;
}

/** Строка заданным кеглем; лёгкая обводка утяжеляет начертание — самого жирного у шрифта в сборке нет. */
function boldLine(ctx: CanvasRenderingContext2D, text: string, x: number, baseline: number, size: number) {
  ctx.font = `600 ${size}px "Golos Text", system-ui, sans-serif`;
  ctx.lineWidth = size * 0.035;
  ctx.lineJoin = 'round';
  ctx.strokeText(text, x, baseline);
  ctx.fillText(text, x, baseline);
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

  // Заголовок: один кегль, межстрочный интервал почти нулевой — ровный плотный блок.
  const title = ['Стекло', 'меняет', 'взгляд'];
  const size = fitSize(ctx, title, 1072);
  const step = size * 0.74;
  ctx.textAlign = 'left';
  title.forEach((line, i) => boldLine(ctx, line, 64, 780 + i * step, size));

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
  { id: 'landscape', title: 'Пейзаж', file: 'пейзаж.jpg', make: () => photo(landscapeUrl), look: 'honeycomb' },
  { id: 'portrait', title: 'Портрет', file: 'портрет.jpg', make: () => photo(portraitUrl), look: 'fluted', plate: { x: 0.25, y: 0.5, width: 0.5, height: 1.5 } },
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

export const LANDSCAPE_CREDIT = {
  author: 'adrian (aows)',
  license: 'CC0',
  sourceUrl: 'https://commons.wikimedia.org/wiki/File:Sunrise_at_Peyto_Lake,_Alberta_(Unsplash).jpg',
};

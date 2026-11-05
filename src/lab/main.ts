import {
  GlassRenderer,
  PARAM_RANGES,
  PRESETS,
  exportPng,
  getParam,
  normalizeParams,
  setGridMode,
  setParam,
  type ExportArea,
  type ExportOutside,
  type GlassParams,
  type GlassSource,
  type GridMode,
  type ParamKey,
  type PresetName,
} from '../glass';
import { attachFrame } from './frame';
import './lab.css';

/** Пресеты в списке и их порядок. «Кубики» — стекло по сверке с кадрами. */
const PRESET_LIST: [PresetName, string][] = [
  ['video', 'Кубики'],
  ['loupe', 'Лупа'],
  ['mosaic', 'Мозаика'],
  ['bigLenses', 'Крупные линзы'],
  ['frosted', 'Матовый стеклоблок'],
  ['faceted', 'Гранёное стекло'],
  ['kaleidoscope', 'Калейдоскоп'],
  ['handmade', 'Ручная работа'],
];

/** Как показывать значение в поле: множитель, единица, знаков после запятой. */
interface Unit {
  scale: number;
  suffix: string;
  digits: number;
}
const PCT: Unit = { scale: 100, suffix: '%', digits: 1 };
const NUM: Unit = { scale: 1, suffix: '', digits: 2 };
const INT: Unit = { scale: 1, suffix: '', digits: 0 };

const GROUPS: { title: string; items: { key: ParamKey; label: string; unit: Unit }[] }[] = [
  {
    title: 'Ячейки',
    items: [
      { key: 'cellSize', label: 'Размер ячейки', unit: PCT },
      { key: 'columns', label: 'Столбцов', unit: INT },
      { key: 'rows', label: 'Рядов', unit: INT },
      { key: 'zoom', label: 'Увеличение', unit: { scale: 1, suffix: '×', digits: 2 } },
      { key: 'loupe', label: 'Лупа', unit: NUM },
      { key: 'squareness', label: 'Квадратность', unit: NUM },
      { key: 'irregularity', label: 'Неровность', unit: NUM },
    ],
  },
  {
    title: 'Швы',
    items: [
      { key: 'seamSoftness', label: 'Мягкость шва', unit: NUM },
      { key: 'bevel', label: 'Фаска (чёткий широкий шов)', unit: NUM },
      { key: 'seamLight', label: 'Блик и тень граней', unit: NUM },
      { key: 'rainbow', label: 'Радуга на гранях', unit: NUM },
    ],
  },
  {
    title: 'Пластина',
    items: [
      { key: 'plate.width', label: 'Ширина', unit: PCT },
      { key: 'plate.height', label: 'Высота', unit: PCT },
      { key: 'plate.rotation', label: 'Поворот', unit: { scale: 1, suffix: '°', digits: 1 } },
      { key: 'plate.x', label: 'Положение X', unit: PCT },
      { key: 'plate.y', label: 'Положение Y', unit: PCT },
      { key: 'edgeWidth', label: 'Торец: толщина (0 — нет)', unit: PCT },
      { key: 'edge', label: 'Торец: яркость', unit: NUM },
    ],
  },
];

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const canvas = $<HTMLCanvasElement>('glass');
const hud = $<HTMLElement>('hud');
const json = $<HTMLTextAreaElement>('json');

const renderer = new GlassRenderer(canvas);
renderer.background = [0.07, 0.07, 0.08, 1];
const gpu = (() => {
  const ext = renderer.gl.getExtension('WEBGL_debug_renderer_info');
  return ext ? String(renderer.gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : 'неизвестно';
})();

let params: GlassParams = structuredClone(PRESETS.video);
let source: GlassSource | null = null;
let dirty = true;
let hudImage = '';

// ---------- ползунки и поля ----------

const sliders = new Map<ParamKey, { row: HTMLElement; range: HTMLInputElement; field: HTMLInputElement; unit: Unit }>();
/** Какие ползунки сетки видны в каком режиме. */
const GRID_KEYS: Record<GridMode, ParamKey[]> = { size: ['cellSize'], count: ['columns', 'rows'] };
const GRID_HINT: Record<GridMode, string> = {
  size: 'Меняешь размер пластины — ячеек больше или меньше, их размер тот же.',
  count: 'Меняешь размер пластины — ячейки тянутся вместе с ней, их столько же.',
};
const gridButtons: HTMLButtonElement[] = [];
let gridHint: HTMLElement | null = null;

const show = (v: number, u: Unit) => String(Number((v * u.scale).toFixed(u.digits)));

function segmented(label: string, options: [string, string][], onPick: (value: string) => void): HTMLElement {
  const seg = document.createElement('div');
  seg.className = 'seg';
  seg.innerHTML = `<span class="seg-label">${label}</span>
    <div class="seg-buttons" role="radiogroup" aria-label="${label}">
      ${options.map(([v, t]) => `<button type="button" role="radio" data-value="${v}">${t}</button>`).join('')}
    </div>`;
  for (const b of seg.querySelectorAll<HTMLButtonElement>('button')) b.addEventListener('click', () => onPick(b.dataset.value!));
  return seg;
}

function markPicked(root: HTMLElement, value: string): void {
  for (const b of root.querySelectorAll<HTMLButtonElement>('button')) b.setAttribute('aria-checked', String(b.dataset.value === value));
}

const slidersRoot = $<HTMLElement>('sliders');
for (const group of GROUPS) {
  const box = document.createElement('div');
  box.className = 'group';
  box.innerHTML = `<h2>${group.title}</h2>`;
  if (group.title === 'Ячейки') {
    const seg = segmented('Сетка задаётся', [['size', 'размером'], ['count', 'количеством']], (v) =>
      update(setGridMode(params, v as GridMode)),
    );
    gridButtons.push(...seg.querySelectorAll<HTMLButtonElement>('button'));
    gridHint = document.createElement('p');
    gridHint.className = 'seg-hint';
    seg.append(gridHint);
    box.append(seg);
  }
  for (const item of group.items) {
    const { min, max, step } = PARAM_RANGES[item.key];
    const row = document.createElement('div');
    row.className = 'slider';
    row.innerHTML = `<label for="f-${item.key}">${item.label}</label>
      <span class="value"><input class="num" id="f-${item.key}" inputmode="decimal" autocomplete="off" />${
        item.unit.suffix ? `<span class="suffix">${item.unit.suffix}</span>` : ''
      }</span>
      <input type="range" min="${min}" max="${max}" step="${step}" data-key="${item.key}" aria-label="${item.label}" />`;
    const range = row.querySelector<HTMLInputElement>('input[type=range]')!;
    const field = row.querySelector<HTMLInputElement>('input.num')!;
    range.addEventListener('input', () => update(setParam(params, item.key, Number(range.value))));
    // Число вписывается и за пределы ползунка — до жёсткого предела параметра.
    field.addEventListener('change', () => {
      const cleaned = field.value.replace(',', '.').replace(/[^\d.+-]/g, '');
      const v = Number(cleaned);
      if (/\d/.test(cleaned) && Number.isFinite(v)) update(setParam(params, item.key, v / item.unit.scale));
      field.value = show(getParam(params, item.key), item.unit);
    });
    field.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') field.blur();
      if (e.key === 'Escape') {
        field.value = show(getParam(params, item.key), item.unit);
        field.blur();
      }
    });
    sliders.set(item.key, { row, range, field, unit: item.unit });
    box.append(row);
  }
  slidersRoot.append(box);
}

function syncControls(): void {
  const hidden = GRID_KEYS[params.grid === 'size' ? 'count' : 'size'];
  for (const b of gridButtons) b.setAttribute('aria-checked', String(b.dataset.value === params.grid));
  if (gridHint) gridHint.textContent = GRID_HINT[params.grid];
  for (const [key, s] of sliders) {
    s.row.hidden = hidden.includes(key);
    const v = getParam(params, key);
    s.range.value = String(v);
    if (document.activeElement !== s.field) s.field.value = show(v, s.unit);
  }
  if (document.activeElement !== json) json.value = JSON.stringify(params, null, 2);
}

function update(next: GlassParams): void {
  params = next;
  dirty = true;
  syncControls();
}

// ---------- картинки ----------

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((ok, fail) => {
    const img = new Image();
    img.onload = () => ok(img);
    img.onerror = () => fail(new Error(`не загрузилась картинка ${url}`));
    img.src = url;
  });
}

/** Запасная картинка, если папки тестовых картинок рядом нет. */
function fallbackImage(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = 1500;
  c.height = 1000;
  const ctx = c.getContext('2d')!;
  const grad = ctx.createLinearGradient(0, 0, 1500, 1000);
  grad.addColorStop(0, '#e9d8c4');
  grad.addColorStop(1, '#5b6f8a');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 1500, 1000);
  ctx.fillStyle = '#1d1d22';
  for (const [x, y, r] of [[600, 420, 55], [900, 420, 55], [750, 560, 30]]) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.font = 'bold 120px system-ui, sans-serif';
  ctx.fillText('Стекляшка', 420, 820);
  return c;
}

function setSource(src: GlassSource): void {
  source = src;
  const info = renderer.setImage(src);
  hudImage = `${info.width}×${info.height}${info.downscaled ? ' (уменьшена под видеокарту)' : ''}`;
  dirty = true;
}

async function listTestImages(): Promise<string[]> {
  try {
    const res = await fetch('/lab-assets/test/');
    if (!res.ok) return [];
    return ((await res.json()) as string[]).map((f) => `/lab-assets/test/${encodeURIComponent(f)}`);
  } catch {
    return [];
  }
}

const fileName = (url: string) => decodeURIComponent(url.split('/').pop() ?? url);

const imageSelect = $<HTMLSelectElement>('image-select');
const presetSelect = $<HTMLSelectElement>('preset-select');

async function setupPickers(): Promise<void> {
  const tests = await listTestImages();
  imageSelect.innerHTML = tests.map((u) => `<option value="${u}">${fileName(u)}</option>`).join('')
    + '<option value="">запасная картинка</option>';
  presetSelect.innerHTML = PRESET_LIST.map(([k, t]) => `<option value="${k}">${t}</option>`).join('');
  presetSelect.value = 'video';

  const first = tests.find((u) => /1500/.test(u)) ?? tests[0];
  if (first) {
    imageSelect.value = first;
    setSource(await loadImage(first));
  } else {
    imageSelect.value = '';
    setSource(fallbackImage());
  }
}

imageSelect.addEventListener('change', async () => {
  setSource(imageSelect.value ? await loadImage(imageSelect.value) : fallbackImage());
});

$<HTMLInputElement>('image-file').addEventListener('change', async (e) => {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;
  setSource(await createImageBitmap(file));
});

// Пресет меняет стекло, пластина остаётся там, где её поставили.
presetSelect.addEventListener('change', () => {
  update({ ...structuredClone(PRESETS[presetSelect.value as PresetName]), plate: { ...params.plate } });
});

// ---------- сохранение ----------

let saveArea: ExportArea = 'full';
let saveOutside: ExportOutside = 'keep';
const saveBox = $<HTMLElement>('save-options');
const areaSeg = segmented('Что сохранить', [['full', 'весь холст'], ['plate', 'только линза']], (v) => {
  saveArea = v as ExportArea;
  syncSave();
});
const outsideSeg = segmented('Вокруг линзы', [['keep', 'картинка'], ['black', 'чёрный'], ['transparent', 'прозрачный']], (v) => {
  saveOutside = v as ExportOutside;
  syncSave();
});
saveBox.append(areaSeg, outsideSeg);

function syncSave(): void {
  markPicked(areaSeg, saveArea);
  markPicked(outsideSeg, saveOutside);
  outsideSeg.hidden = saveArea !== 'plate';
}
syncSave();

async function save(): Promise<{ width: number; height: number; downscaled: boolean; file: string }> {
  if (!source) throw new Error('нет картинки');
  const result = await exportPng(source, params, { area: saveArea, outside: saveOutside });
  const d = new Date();
  const two = (n: number) => String(n).padStart(2, '0');
  const stamp = `${d.getFullYear()}${two(d.getMonth() + 1)}${two(d.getDate())}-${two(d.getHours())}${two(d.getMinutes())}${two(d.getSeconds())}`;
  const file = `стекляшка-${saveArea === 'full' ? 'холст' : 'линза'}-${stamp}.png`;
  const url = URL.createObjectURL(result.blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = file;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  $<HTMLElement>('save-status').textContent =
    `${result.width}×${result.height}${result.downscaled ? ', уменьшено под видеокарту' : ''}`;
  return { width: result.width, height: result.height, downscaled: result.downscaled, file };
}

$<HTMLButtonElement>('save').addEventListener('click', () => {
  save().catch((e) => ($<HTMLElement>('save-status').textContent = String(e.message ?? e)));
});

// ---------- JSON ----------

$<HTMLButtonElement>('copy').addEventListener('click', async () => {
  const text = JSON.stringify(params, null, 2);
  json.value = text;
  try {
    await navigator.clipboard.writeText(text);
    flash('copy', 'Скопировано');
  } catch {
    json.select();
    flash('copy', 'Выделено, Ctrl+C');
  }
});

$<HTMLButtonElement>('apply').addEventListener('click', () => {
  try {
    update(normalizeParams(JSON.parse(json.value)));
    flash('apply', 'Применено');
  } catch {
    flash('apply', 'Не JSON');
  }
});

function flash(id: string, text: string): void {
  const b = $<HTMLButtonElement>(id);
  const was = b.textContent;
  b.textContent = text;
  setTimeout(() => (b.textContent = was), 1200);
}

// ---------- холст и мышь ----------

function resize(): void {
  const dpr = window.devicePixelRatio || 1;
  const w = Math.max(1, Math.round(canvas.clientWidth * dpr));
  const h = Math.max(1, Math.round(canvas.clientHeight * dpr));
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
    dirty = true;
  }
}
new ResizeObserver(resize).observe(canvas);

const frame = attachFrame({
  canvas,
  overlay: document.getElementById('frame') as unknown as SVGSVGElement,
  getView: () => renderer.fitView(),
  getImage: () => renderer.imageInfo,
  getPlate: () => params.plate,
  setPlate: (plate) => update(normalizeParams({ ...params, plate })),
});

$<HTMLInputElement>('frame-toggle').addEventListener('change', (e) => {
  frame.setVisible((e.target as HTMLInputElement).checked);
});

// Колесо — пропорциональный размер пластины; что станет с ячейками, решает режим сетки.
canvas.addEventListener(
  'wheel',
  (e) => {
    e.preventDefault();
    if (e.shiftKey) {
      update(setParam(params, 'plate.rotation', params.plate.rotation + (e.deltaY || e.deltaX) * 0.02));
      return;
    }
    const k = Math.exp(-e.deltaY * 0.001);
    update(setParam(setParam(params, 'plate.width', params.plate.width * k), 'plate.height', params.plate.height * k));
  },
  { passive: false },
);

// ---------- цикл и счётчик кадров ----------

const frameTimes: number[] = [];
let lastFrame = 0;

function loop(now: number): void {
  if (dirty) {
    dirty = false;
    renderer.render(params);
    frame.redraw();
    if (now - lastFrame < 100) {
      frameTimes.push(now - lastFrame);
      if (frameTimes.length > 60) frameTimes.shift();
    }
    lastFrame = now;
    const avg = frameTimes.length ? frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length : 0;
    hud.textContent = `${hudImage} · ${avg ? `${(1000 / avg).toFixed(0)} к/с при движении` : 'к/с — при движении'} · ${gpu}`;
  }
  requestAnimationFrame(loop);
}

// ---------- хуки для скриптов сверки и замера ----------

/** Эталон слева, результат справа, оба в высоту эталона и в натуральных пикселях. */
async function composite(refUrl: string, caption: string): Promise<string> {
  if (!source) throw new Error('нет картинки');
  const ref = await loadImage(refUrl);
  const info = renderer.imageInfo!;
  const H = ref.naturalHeight;
  const W = Math.round((info.width * H) / info.height);
  const glass = document.createElement('canvas');
  glass.width = W;
  glass.height = H;
  const r = new GlassRenderer(glass, { preserveDrawingBuffer: true });
  r.setImage(source);
  r.render(params);

  const gap = 16;
  const cap = 44;
  const out = document.createElement('canvas');
  out.width = ref.naturalWidth + gap + W;
  out.height = cap + H;
  const ctx = out.getContext('2d')!;
  ctx.fillStyle = '#111114';
  ctx.fillRect(0, 0, out.width, out.height);
  ctx.drawImage(ref, 0, cap);
  ctx.drawImage(glass, ref.naturalWidth + gap, cap);
  ctx.fillStyle = '#e8e6e1';
  ctx.font = '600 20px system-ui, sans-serif';
  ctx.fillText(`эталон · ${caption}`, 12, 29);
  ctx.fillText('результат', ref.naturalWidth + gap + 12, 29);
  r.gl.getExtension('WEBGL_lose_context')?.loseContext();
  return out.toDataURL('image/png');
}

/** Замер: пластина ездит по картинке, считаем интервалы кадров и время кадра на видеокарте. */
async function perf(seconds = 5) {
  const start = structuredClone(params);
  const deltas: number[] = [];
  await new Promise<void>((done) => {
    const t0 = performance.now();
    let prev = t0;
    const step = (now: number) => {
      const t = (now - t0) / 1000;
      params = setParam(setParam(params, 'plate.x', 0.5 + 0.3 * Math.sin(t * 1.7)), 'plate.y', 0.5 + 0.25 * Math.sin(t * 2.3));
      renderer.render(params);
      if (now > t0) deltas.push(now - prev);
      prev = now;
      if (t < seconds) requestAnimationFrame(step);
      else done();
    };
    requestAnimationFrame(step);
  });

  const gl = renderer.gl;
  const px = new Uint8Array(4);
  const gpuMs: number[] = [];
  for (let i = 0; i < 120; i++) {
    params = setParam(params, 'plate.x', 0.2 + (0.6 * i) / 120);
    const t = performance.now();
    renderer.render(params);
    gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
    gpuMs.push(performance.now() - t);
  }
  update(start);

  const sorted = (a: number[]) => [...a].sort((x, y) => x - y);
  const q = (a: number[], p: number) => sorted(a)[Math.min(a.length - 1, Math.floor(a.length * p))];
  const total = deltas.reduce((a, b) => a + b, 0);
  return {
    gpu,
    image: renderer.imageInfo,
    canvas: { width: canvas.width, height: canvas.height },
    raf: {
      frames: deltas.length,
      fps: (deltas.length * 1000) / total,
      p95ms: q(deltas, 0.95),
      over20ms: deltas.filter((d) => d > 20).length,
    },
    gpuSynced: { medianMs: q(gpuMs, 0.5), p95ms: q(gpuMs, 0.95) },
  };
}

/** Отрисовка в исходном разрешении в data URL — для листа пресетов и проверки сохранения. */
async function renderPng(area: ExportArea = 'full', outside: ExportOutside = 'keep'): Promise<string> {
  if (!source) throw new Error('нет картинки');
  const { blob } = await exportPng(source, params, { area, outside });
  return new Promise((ok) => {
    const fr = new FileReader();
    fr.onload = () => ok(String(fr.result));
    fr.readAsDataURL(blob);
  });
}

declare global {
  interface Window {
    lab: {
      ready: Promise<void>;
      getParams: () => GlassParams;
      setParams: (p: Partial<GlassParams>) => void;
      loadImage: (url: string) => Promise<void>;
      composite: typeof composite;
      perf: typeof perf;
      renderPng: typeof renderPng;
      presets: string[];
    };
  }
}

window.lab = {
  ready: setupPickers().then(() => update(params)),
  getParams: () => structuredClone(params),
  setParams: (p) => update(normalizeParams(p)),
  loadImage: async (url) => setSource(await loadImage(url)),
  composite,
  perf,
  renderPng,
  presets: PRESET_LIST.map(([k]) => k),
};

requestAnimationFrame(loop);

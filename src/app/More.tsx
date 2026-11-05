import { useEffect, useRef } from 'react';
import {
  PARAM_RANGES,
  PRESETS,
  getParam,
  setGridMode,
  setParam,
  type ExportArea,
  type GlassParams,
  type CircleGap,
  type GridMode,
  type ParamKey,
  type PresetName,
} from '../glass';
import { Segmented, Slider, linear, logScale, type Unit } from './controls';
import { PRESET_LIST, applyPreset, framePlate, isFullFrame, samePreset } from './glassState';
import { IconClose, IconCollapse, IconDice, IconFill } from './icons';
import type { LoadedImage } from './load';
import { drawPreview, fitCanvas } from './preview';

interface Item {
  key: ParamKey;
  label: string;
  unit: Unit;
  /** Шкала ползунка; по умолчанию — линейная по диапазону параметра. */
  scale?: { toT: (v: number) => number; fromT: (t: number) => number };
}

const PCT: Unit = { scale: 100, suffix: '%', digits: 1 };
/** Доли 0–1 показываем числом 0–100. */
const X100: Unit = { scale: 100, suffix: '', digits: 0 };
const INT: Unit = { scale: 1, suffix: '', digits: 0 };

const SIZE_SCALE = logScale(0.008, 0.35);
const ZOOM_SCALE = linear(0.5, 3);

const CELLS: Item[] = [
  { key: 'cellSize', label: 'Размер ячейки', unit: PCT, scale: SIZE_SCALE },
  { key: 'columns', label: 'Столбцов', unit: INT, scale: linear(1, 40) },
  { key: 'rows', label: 'Рядов', unit: INT, scale: linear(1, 40) },
  { key: 'zoom', label: 'Увеличение', unit: { scale: 1, suffix: '×', digits: 2 }, scale: ZOOM_SCALE },
  { key: 'loupe', label: 'Лупа', unit: X100 },
  { key: 'squareness', label: 'Квадратность', unit: X100 },
  { key: 'irregularity', label: 'Неровность', unit: X100 },
];
const SEAMS: Item[] = [
  { key: 'seamSoftness', label: 'Мягкость шва', unit: X100 },
  { key: 'bevel', label: 'Фаска', unit: X100 },
  { key: 'seamLight', label: 'Блик граней', unit: X100 },
  { key: 'rainbow', label: 'Радуга на гранях', unit: X100 },
];
const PLATE: Item[] = [
  { key: 'plate.width', label: 'Ширина', unit: PCT, scale: logScale(0.03, 3) },
  { key: 'plate.height', label: 'Высота', unit: PCT, scale: logScale(0.03, 3) },
  { key: 'plate.rotation', label: 'Поворот', unit: { scale: 1, suffix: '°', digits: 1 } },
  { key: 'plate.x', label: 'Положение X', unit: PCT },
  { key: 'plate.y', label: 'Положение Y', unit: PCT },
  { key: 'edgeWidth', label: 'Торец: толщина', unit: X100 },
  { key: 'edge', label: 'Торец: яркость', unit: X100 },
];

const GRID_KEYS: Record<GridMode, ParamKey[]> = { size: ['cellSize'], count: ['columns', 'rows'] };

function Sliders({ items, params, onParams }: { items: Item[]; params: GlassParams; onParams: (p: GlassParams) => void }) {
  const hidden = GRID_KEYS[params.grid === 'size' ? 'count' : 'size'];
  return (
    <>
      {items
        .filter((it) => !hidden.includes(it.key))
        .map((it) => {
          const scale = it.scale ?? linear(PARAM_RANGES[it.key].min, PARAM_RANGES[it.key].max);
          const v = getParam(params, it.key);
          return (
            <Slider
              key={it.key}
              label={it.label}
              t={scale.toT(v)}
              onT={(t) => onParams(setParam(params, it.key, scale.fromT(t)))}
              value={v}
              unit={it.unit}
              onValue={(n) => onParams(setParam(params, it.key, n))}
            />
          );
        })}
    </>
  );
}

/** Превью набора на картинке пользователя: стекло во весь квадрат. */
function PresetThumb({ image, name }: { image: LoadedImage; name: PresetName }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current!;
    fitCanvas(c);
    const { width: w, height: h } = image.preview;
    drawPreview(c, image.preview, { ...PRESETS[name], plate: framePlate(w, h, 1) });
  }, [image, name]);
  return <canvas ref={ref} className="pre-img" />;
}

interface MoreProps {
  image: LoadedImage;
  params: GlassParams;
  onParams: (p: GlassParams) => void;
  onReset: () => void;
  onClose: () => void;
  area: ExportArea;
  onArea: (a: ExportArea) => void;
  /** Телефон: шторку тянут за ручку, доля высоты экрана. */
  onSheet: (fraction: number) => void;
}

export function More({ image, params, onParams, onReset, onClose, area, onArea, onSheet }: MoreProps) {
  const full = isFullFrame(params.plate, image.width, image.height);
  return (
    <section className="more" aria-label="Тонкая настройка">
      <div
        className="more-grip"
        role="separator"
        aria-orientation="horizontal"
        aria-label="Потяните, чтобы изменить высоту панели"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
          onSheet(Math.min(0.8, Math.max(0.25, 1 - e.clientY / window.innerHeight)));
        }}
      />
      <header className="more-head">
        <h2>Тонкая настройка</h2>
        <button type="button" className="link" onClick={onReset}>
          Сбросить
        </button>
        {/* Справа на широком экране — «свернуть», в шторке на телефоне — крестик. */}
        <button type="button" className="pill icon ghost more-collapse" aria-label="Свернуть панель" title="Свернуть панель" onClick={onClose}>
          <IconCollapse />
        </button>
        <button type="button" className="pill icon ghost more-close" aria-label="Закрыть" onClick={onClose}>
          <IconClose />
        </button>
      </header>

      <div className="more-body">
        <h3>Готовые</h3>
        <div className="presets">
          {PRESET_LIST.map(([name, title]) => (
            <button key={name} type="button" className="pre" aria-pressed={samePreset(params, name)} onClick={() => onParams(applyPreset(params, name))}>
              <PresetThumb image={image} name={name} />
              <span>{title}</span>
            </button>
          ))}
        </div>

        <h3>Ячейки</h3>
        <Segmented<GridMode>
          label="Сетка задаётся"
          value={params.grid}
          options={[
            ['size', 'размером'],
            ['count', 'количеством'],
          ]}
          onPick={(m) => onParams(setGridMode(params, m))}
        />
        <Sliders items={CELLS} params={params} onParams={onParams} />
        {params.shape === 'circles' && (
          <Segmented<CircleGap>
            label="Между кругами"
            value={params.circleGap}
            options={[
              ['glass', 'со стеклом'],
              ['clear', 'плоское'],
              ['frosted', 'матовое'],
            ]}
            onPick={(circleGap) => onParams({ ...params, circleGap })}
          />
        )}
        {params.shape === 'stripes' && (
          <Sliders items={[{ key: 'stripeAngle', label: 'Угол полос', unit: { scale: 1, suffix: '°', digits: 0 } }]} params={params} onParams={onParams} />
        )}
        {params.shape === 'shards' && (
          <button type="button" className="toggle" onClick={() => onParams({ ...params, shapeSeed: Math.floor(Math.random() * 100000) })}>
            <IconDice />
            Перемешать осколки
          </button>
        )}

        <h3>Швы</h3>
        <Sliders items={SEAMS} params={params} onParams={onParams} />

        <h3>Пластина</h3>
        <button
          type="button"
          className="toggle"
          aria-pressed={full}
          onClick={() => onParams({ ...params, plate: full ? { ...framePlate(image.width, image.height, 0.86) } : framePlate(image.width, image.height, 1) })}
        >
          <IconFill />
          Стекло во весь кадр
        </button>
        <Sliders items={PLATE} params={params} onParams={onParams} />

        <h3>Сохранение</h3>
        <Segmented<ExportArea>
          label="Что сохранить"
          value={area}
          options={[
            ['full', 'всю картинку'],
            ['plate', 'только стекло'],
          ]}
          onPick={onArea}
        />
        <p className="more-note">
          {area === 'full'
            ? `PNG ${image.width} × ${image.height} — как исходная картинка.`
            : 'PNG по размеру пластины, углы вокруг повёрнутой пластины — прозрачные.'}
        </p>
      </div>
    </section>
  );
}

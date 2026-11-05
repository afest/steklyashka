import type { Ref } from 'react';
import type { CellShape } from '../glass';
import { IconDice, IconSliders, SHAPE_ICONS } from './icons';

const SHAPES: { id: CellShape; title: string }[] = [
  { id: 'squares', title: 'Квадраты' },
  { id: 'hex', title: 'Соты' },
  { id: 'triangles', title: 'Треугольники' },
  { id: 'circles', title: 'Круги' },
  { id: 'stripes', title: 'Полосы' },
  { id: 'shards', title: 'Битое' },
];

interface DockProps {
  ref: Ref<HTMLDivElement>;
  shape: CellShape;
  onShape: (s: CellShape) => void;
  onRandom: () => void;
  more: boolean;
  onMore: () => void;
}

/** Нижний док: форма ячеек и «Случайно»; размер, увеличение и всё остальное — в боковой панели («Ещё»). */
export function Dock({ ref, shape, onShape, onRandom, more, onMore }: DockProps) {
  return (
    <div className="dock" ref={ref}>
      <div
        className="shapes"
        role="radiogroup"
        aria-label="Форма ячеек"
        // Узкое окно: формы не влезли — колёсико листает их вбок.
        onWheel={(e) => {
          const el = e.currentTarget;
          if (el.scrollWidth > el.clientWidth) el.scrollLeft += e.deltaY || e.deltaX;
        }}
      >
        {SHAPES.map((s) => (
          <button
            key={s.id}
            type="button"
            role="radio"
            className="shape"
            aria-checked={s.id === shape}
            onClick={() => onShape(s.id)}
          >
            {SHAPE_ICONS[s.id]}
            <span>{s.title}</span>
          </button>
        ))}
      </div>
      <div className="vr" />
      <div className="dock-actions">
        <button type="button" className="rbtn" onClick={onRandom}>
          <span className="rbtn-ico">
            <IconDice />
          </span>
          <span>Случайно</span>
        </button>
        <button type="button" className={`rbtn rbtn-more${more ? ' on' : ''}`} aria-expanded={more} onClick={onMore}>
          <span className="rbtn-ico">
            <IconSliders />
          </span>
          <span>Ещё</span>
        </button>
      </div>
    </div>
  );
}

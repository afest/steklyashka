import { useId, useRef, useState, type CSSProperties, type ReactNode } from 'react';

/** Как число параметра показывается в поле: множитель, единица, знаков после запятой. */
export interface Unit {
  scale: number;
  suffix: string;
  digits: number;
}

interface SliderProps {
  label: string;
  /** Положение ползунка 0–1. */
  t: number;
  onT: (t: number) => void;
  /** Значение параметра; в поле — умноженное на unit.scale. */
  value: number;
  unit: Unit;
  /** Вписанное число, уже делённое на unit.scale. Пределы держит сам параметр. */
  onValue: (v: number) => void;
}

/**
 * Ползунок и поле справа. Поле едет вместе с ползунком; нажали — можно вписать число,
 * Enter или уход из поля — принять, Esc — вернуть, стрелки — на шаг (Shift — на десять).
 */
export function Slider({ label, t, onT, value, unit, onValue }: SliderProps) {
  const id = useId();
  const [draft, setDraft] = useState<string | null>(null);
  const cancel = useRef(false);
  const shown = num(value * unit.scale, unit.digits);
  const pos = Math.min(1, Math.max(0, t));
  const commit = (text: string) => {
    const cleaned = text.replace(',', '.').replace(/[^\d.+-]/g, '');
    const n = Number(cleaned);
    if (/\d/.test(cleaned) && Number.isFinite(n)) onValue(n / unit.scale);
  };
  const step = (dir: number, big: boolean) => {
    const base = unit.digits >= 2 ? 0.1 : 1;
    const n = Number(Number(value * unit.scale + dir * base * (big ? 10 : 1)).toFixed(unit.digits));
    onValue(n / unit.scale);
  };
  return (
    <div className="slider">
      <label htmlFor={id}>{label}</label>
      <div className="slider-row">
        <input
          id={id}
          type="range"
          min={0}
          max={1000}
          step={1}
          value={Math.round(pos * 1000)}
          style={{ '--v': `${pos * 100}%` } as CSSProperties}
          onChange={(e) => onT(Number(e.target.value) / 1000)}
        />
        <span className="field">
          <input
            className="num"
            inputMode="decimal"
            autoComplete="off"
            spellCheck={false}
            aria-label={`${label}, число`}
            value={draft ?? shown}
            onFocus={(e) => {
              cancel.current = false;
              setDraft(shown);
              e.target.select();
            }}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={(e) => {
              // Число не трогали — не пересохраняем округлённое значение поверх точного.
              if (!cancel.current && e.target.value !== shown) commit(e.target.value);
              setDraft(null);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur();
              else if (e.key === 'Escape') {
                e.stopPropagation();
                cancel.current = true;
                e.currentTarget.blur();
              } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                e.preventDefault();
                step(e.key === 'ArrowUp' ? 1 : -1, e.shiftKey);
                // Поле снова показывает значение параметра, а не вписанный текст.
                setDraft(null);
              }
            }}
          />
          {unit.suffix && <span className="suffix">{unit.suffix}</span>}
        </span>
      </div>
    </div>
  );
}

/** Линейная шкала ползунка. */
export const linear = (min: number, max: number) => ({
  toT: (v: number) => (v - min) / (max - min),
  fromT: (t: number) => min + t * (max - min),
});

/** Логарифмическая: мелкие значения получают столько же хода, сколько крупные. */
export const logScale = (min: number, max: number) => ({
  toT: (v: number) => Math.log(v / min) / Math.log(max / min),
  fromT: (t: number) => min * Math.pow(max / min, t),
});

interface SegProps<T extends string> {
  label: string;
  value: T;
  options: [T, string][];
  onPick: (v: T) => void;
}

export function Segmented<T extends string>({ label, value, options, onPick }: SegProps<T>) {
  return (
    <div className="seg">
      <span className="seg-label">{label}</span>
      <div className="seg-buttons" role="radiogroup" aria-label={label}>
        {options.map(([v, text]) => (
          <button key={v} type="button" role="radio" aria-checked={v === value} onClick={() => onPick(v)}>
            {text}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Пояснение за «?» — по нажатию, не по наведению. */
export function Help({ children, label = 'Как управлять' }: { children: ReactNode; label?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="help">
      <button type="button" className="pill icon ghost" aria-expanded={open} aria-label={label} onClick={() => setOpen((o) => !o)}>
        ?
      </button>
      {open && (
        <>
          <div className="help-back" onClick={() => setOpen(false)} />
          <div className="help-pop" role="dialog" aria-label={label}>
            {children}
          </div>
        </>
      )}
    </div>
  );
}

/** Число по-русски: запятая, без хвостовых нулей. */
export const num = (v: number, digits = 1) => String(Number(v.toFixed(digits))).replace('.', ',');

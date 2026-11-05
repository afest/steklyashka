import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { Help } from './controls';
import { CAT_CREDIT, EXAMPLES, LANDSCAPE_CREDIT, PORTRAIT_CREDIT, type Example } from './examples';
import { defaultParams, exampleParams, framePlate } from './glassState';
import { IconImage } from './icons';
import type { LoadedImage } from './load';
import { drawPreview, fitCanvas } from './preview';
import { GestureHelp, Logo } from './parts';

/** Превью примера: так он откроется — со своим стеклом и своей пластиной. */
function ExThumb({ image, ex }: { image: LoadedImage; ex: Example }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current!;
    fitCanvas(c);
    const src = image.preview;
    drawPreview(c, src, exampleParams(ex, src.width, src.height));
  }, [image, ex]);
  return <canvas ref={ref} className="ex-img" />;
}

/** Большое сравнение «до и после» со шторкой. */
function Compare({ image }: { image: LoadedImage }) {
  const glass = useRef<HTMLCanvasElement>(null);
  const orig = useRef<HTMLCanvasElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState(0.42);

  useEffect(() => {
    const draw = () => {
      const g = glass.current!;
      const o = orig.current!;
      fitCanvas(g);
      fitCanvas(o);
      const src = image.preview;
      drawPreview(g, src, { ...defaultParams(src.width, src.height), plate: framePlate(src.width, src.height, 1) });
      drawPreview(o, src, null);
    };
    draw();
    const ro = new ResizeObserver(draw);
    ro.observe(box.current!);
    return () => ro.disconnect();
  }, [image]);

  const drag = (e: PointerEvent) => {
    const r = box.current!.getBoundingClientRect();
    setPos(Math.min(0.97, Math.max(0.03, (e.clientX - r.left) / r.width)));
  };

  return (
    <div
      className="cmp"
      ref={box}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        drag(e);
      }}
      onPointerMove={(e) => e.buttons && drag(e)}
    >
      <canvas ref={glass} />
      <canvas ref={orig} style={{ clipPath: `inset(0 ${(1 - pos) * 100}% 0 0)` }} />
      <span className="tag l">до</span>
      <span className="tag r">после</span>
      <div className="knob" style={{ left: `${pos * 100}%` }}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="m9 7-5 5 5 5m6-10 5 5-5 5" />
        </svg>
      </div>
    </div>
  );
}

interface EmptyProps {
  examples: (LoadedImage | null)[];
  onPick: () => void;
  onExample: (img: LoadedImage, ex: Example) => void;
  busy: boolean;
  error: string | null;
}

export function Empty({ examples, onPick, onExample, busy, error }: EmptyProps) {
  const cat = examples[0];
  return (
    <div className="empty">
      <header className="topbar">
        <Logo />
        <Help>
          <GestureHelp />
        </Help>
      </header>

      <section className="hero">
        <div className="hero-text">
          <p className="eyebrow">Работает в браузере</p>
          <h1>
            Посмотрите на картинку <span>сквозь стекло из линз</span>
          </h1>
          <p className="lead">Загрузите свою или возьмите пример ниже. Файл не покидает устройство: всё считается в браузере.</p>
          <div className="cta">
            <button type="button" className="pill pri big" onClick={onPick} disabled={busy}>
              <IconImage />
              {busy ? 'Открываю…' : 'Выбрать картинку'}
            </button>
            <span className="or desk">
              или перетащите сюда · <kbd>Ctrl</kbd> + <kbd>V</kbd>
            </span>
          </div>
          {error && (
            <p className="load-error" role="alert">
              {error}
            </p>
          )}
        </div>
        <div className="hero-cmp">{cat ? <Compare image={cat} /> : <div className="cmp cmp-wait" />}</div>
      </section>

      <section className="examples">
        <div className="ex-head">
          <b>Или возьмите пример</b>
          <small>каждый открывается со своим стеклом</small>
        </div>
        <div className="ex-grid">
          {EXAMPLES.map((ex, i) => {
            const img = examples[i];
            return (
              <button key={ex.id} type="button" className="ex-card" disabled={!img || busy} onClick={() => img && onExample(img, ex)}>
                {img ? <ExThumb image={img} ex={ex} /> : <div className="ex-img" />}
                <span>{ex.title}</span>
              </button>
            );
          })}
        </div>
      </section>

      <footer className="credit">
        Фото кота — {CAT_CREDIT.author},{' '}
        <a href={CAT_CREDIT.sourceUrl} target="_blank" rel="noreferrer">
          Wikimedia Commons
        </a>
        ,{' '}
        <a href={CAT_CREDIT.licenseUrl} target="_blank" rel="noreferrer">
          {CAT_CREDIT.license}
        </a>
        , кадрировано. Портрет — {PORTRAIT_CREDIT.author},{' '}
        <a href={PORTRAIT_CREDIT.sourceUrl} target="_blank" rel="noreferrer">
          Wikimedia Commons
        </a>
        , {PORTRAIT_CREDIT.license}. Пейзаж — {LANDSCAPE_CREDIT.author},{' '}
        <a href={LANDSCAPE_CREDIT.sourceUrl} target="_blank" rel="noreferrer">
          Wikimedia Commons
        </a>
        , {LANDSCAPE_CREDIT.license}. Плакат нарисован здесь же.
      </footer>
    </div>
  );
}

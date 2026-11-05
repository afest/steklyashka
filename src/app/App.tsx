import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { PRESETS, type ExportArea, type GlassParams } from '../glass';
import { Help } from './controls';
import { Dock } from './Dock';
import { Empty } from './Empty';
import { EXAMPLES } from './examples';
import { defaultParams, randomGlass, startPlate } from './glassState';
import { IconBack, IconClose, IconDownload } from './icons';
import { LoadError, describeDownscale, imageFromItems, loadFile, prepare, type LoadedImage } from './load';
import { More } from './More';
import { GestureHelp, Logo } from './parts';
import { renderPng, download, isAppleMobile, type SavedImage } from './save';
import { SaveCard } from './SaveCard';
import { Stage, type StageApi } from './Stage';

/** «Тонкая настройка» закреплена справа и не закрывает картинку; на телефоне — шторкой поверх. */
const PINNED = '(min-width: 861px)';
const pinned = () => window.matchMedia(PINNED).matches;
const PANEL_KEY = 'steklyashka:panel';
/** Закреплённая панель открыта, пока её не свернули, — выбор помнит браузер. Шторка всегда начинает закрытой. */
const panelDefault = () => {
  if (!pinned()) return false;
  try {
    return localStorage.getItem(PANEL_KEY) !== 'closed';
  } catch {
    return true;
  }
};

export function App() {
  const [image, setImage] = useState<LoadedImage | null>(null);
  const [params, setParams] = useState<GlassParams>(() => structuredClone(PRESETS.caricature));
  const [examples, setExamples] = useState<(LoadedImage | null)[]>(() => EXAMPLES.map(() => null));
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hand, setHand] = useState(false);
  /** Высота шторки настроек на телефоне, доля высоты экрана. */
  const [sheet, setSheet] = useState(0.46);
  const [busy, setBusy] = useState<'open' | 'save' | null>(null);
  const [more, setMore] = useState(panelDefault);
  const [zoom, setZoom] = useState(100);
  const [saved, setSaved] = useState<SavedImage | null>(null);
  const [area, setArea] = useState<ExportArea>('full');
  const [hint, setHint] = useState(true);
  const [dropping, setDropping] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const dockRef = useRef<HTMLDivElement>(null);
  const stageApi = useRef<StageApi>(null);

  // ---------- открытие ----------

  const open = useCallback(async (job: () => Promise<LoadedImage>, hasImage: boolean) => {
    setBusy('open');
    setError(null);
    try {
      const img = await job();
      setImage(img);
      // Стекло остаётся прежним, пластина встаёт почти во весь кадр новой картинки.
      setParams((p) => ({ ...p, plate: startPlate(img.width, img.height) }));
      setNotice(describeDownscale(img));
      setSaved(null);
      setMore(panelDefault());
      setHint(true);
      document.title = `Стекляшка — ${img.name}`;
    } catch (e) {
      const msg = e instanceof LoadError ? e.message : 'Не получилось открыть картинку.';
      if (hasImage) setNotice(msg);
      else setError(msg);
    } finally {
      setBusy(null);
    }
  }, []);

  const openFile = useCallback((file: File) => open(() => loadFile(file, file.name || 'картинка'), !!image), [open, image]);

  // Примеры готовятся сразу: они нужны пустому экрану для превью.
  useEffect(() => {
    EXAMPLES.forEach((ex, i) => {
      ex.make()
        .then((src) => prepare(src, ex.file))
        .then((img) => setExamples((list) => list.map((v, j) => (j === i ? img : v))))
        .catch(() => undefined);
    });
  }, []);

  // ---------- вставка, перетаскивание, клавиши ----------

  useEffect(() => {
    const paste = (e: ClipboardEvent) => {
      const file = imageFromItems(e.clipboardData?.items);
      if (file) {
        e.preventDefault();
        openFile(file);
      } else if (!saved) {
        const msg = 'В буфере нет картинки. Скопируйте саму картинку, а не ссылку на неё.';
        if (image) setNotice(msg);
        else setError(msg);
      }
    };
    const hasFiles = (e: DragEvent) => !!e.dataTransfer && [...e.dataTransfer.types].includes('Files');
    const over = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      setDropping(true);
    };
    const leave = (e: DragEvent) => {
      if (!e.relatedTarget) setDropping(false);
    };
    const drop = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      setDropping(false);
      const file = imageFromItems(e.dataTransfer?.items) ?? e.dataTransfer?.files[0];
      if (file) openFile(file);
    };
    window.addEventListener('paste', paste);
    window.addEventListener('dragover', over);
    window.addEventListener('dragleave', leave);
    window.addEventListener('drop', drop);
    return () => {
      window.removeEventListener('paste', paste);
      window.removeEventListener('dragover', over);
      window.removeEventListener('dragleave', leave);
      window.removeEventListener('drop', drop);
    };
  }, [openFile, image, saved]);

  // Кнопка после щелчка мышью не держит фокус: иначе пробел, которым двигают холст, нажмёт её ещё раз.
  // С клавиатуры (Tab) фокус остаётся — у такого клика detail = 0.
  useEffect(() => {
    const click = (e: MouseEvent) => {
      if (e.detail === 0) return;
      const b = (e.target as Element).closest?.('button');
      if (b && b === document.activeElement) b.blur();
    };
    document.addEventListener('click', click);
    return () => document.removeEventListener('click', click);
  }, []);

  // Safari масштабирует страницу щипком в обход touch-action — гасим его жесты целиком.
  useEffect(() => {
    const block = (e: Event) => e.preventDefault();
    document.addEventListener('gesturestart', block);
    document.addEventListener('gesturechange', block);
    return () => {
      document.removeEventListener('gesturestart', block);
      document.removeEventListener('gesturechange', block);
    };
  }, []);

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.key !== 'Escape') return;
      if (saved) setSaved(null);
      else if (more && !pinned()) setMore(false);
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [saved, more]);

  // Высота дока — в переменную: под ним сцена оставляет место для картинки.
  useLayoutEffect(() => {
    const dock = dockRef.current;
    const root = rootRef.current;
    if (!dock || !root) return;
    const set = () => dock.offsetHeight && root.style.setProperty('--dock-h', `${dock.offsetHeight}px`);
    set();
    // Сцена — сосед дока со своим наблюдателем: меняем её отступ в следующем кадре, иначе петля наблюдателей.
    let frameId = 0;
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(frameId);
      frameId = requestAnimationFrame(set);
    });
    ro.observe(dock);
    return () => {
      cancelAnimationFrame(frameId);
      ro.disconnect();
    };
  }, [image]);

  const showMore = (open: boolean) => {
    setMore(open);
    if (!pinned()) return;
    try {
      localStorage.setItem(PANEL_KEY, open ? 'open' : 'closed');
    } catch {
      // Хранилище закрыто (приватное окно) — просто не запомним.
    }
  };

  // Окно сузилось до шторки или расширилось до закреплённой панели — панель как по умолчанию для этой ширины.
  useEffect(() => {
    const mq = window.matchMedia(PINNED);
    const change = () => setMore(panelDefault());
    mq.addEventListener('change', change);
    return () => mq.removeEventListener('change', change);
  }, []);

  // ---------- сохранение ----------

  const save = async () => {
    if (!image || busy) return;
    setBusy('save');
    try {
      const result = await renderPng(image.source, params, area);
      if (!isAppleMobile) download(result);
      setSaved(result);
    } catch (e) {
      setNotice(`Не получилось сохранить: ${(e as Error).message}`);
    } finally {
      setBusy(null);
    }
  };

  const pick = () => fileInput.current?.click();
  const toStart = () => {
    setImage(null);
    setSaved(null);
    setMore(false);
    setHand(false);
    setNotice(null);
    document.title = 'Стекляшка — картинка сквозь стекло из линз';
  };

  return (
    <div className={`app${image ? ' has-image' : ''}${more ? ' panel' : ''}`} ref={rootRef} style={{ '--sheet': sheet } as React.CSSProperties}>
      <input
        ref={fileInput}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file) openFile(file);
        }}
      />

      {!image && <Empty examples={examples} onPick={pick} onExample={(img) => open(async () => img, false)} busy={busy === 'open'} error={error} />}

      {image && (
        <div className="work">
          <Stage
            ref={stageApi}
            image={image}
            params={params}
            onParams={setParams}
            hint={hint}
            hand={hand}
            onInteract={() => setHint(false)}
            onZoom={setZoom}
          />

          <header className="topbar">
            <button type="button" className="pill ghost back" onClick={toStart}>
              <IconBack />
              <span>Другая картинка</span>
            </button>
            <Logo />
            <div className="topr">
              <div className="zoom" role="group" aria-label="Масштаб холста">
                <button type="button" aria-label="Отдалить (−)" title="Отдалить (−)" onClick={() => stageApi.current?.zoomOut()}>
                  −
                </button>
                <button type="button" className="zoom-pct" title="Вписать картинку (Shift+1)" onClick={() => stageApi.current?.fit()}>
                  {zoom} %
                </button>
                <button type="button" aria-label="Приблизить (+)" title="Приблизить (+)" onClick={() => stageApi.current?.zoomIn()}>
                  +
                </button>
              </div>
              <div className="mode" role="radiogroup" aria-label="Что двигают пальцы">
                <button type="button" role="radio" aria-checked={!hand} onClick={() => setHand(false)}>
                  Стекло
                </button>
                <button type="button" role="radio" aria-checked={hand} onClick={() => setHand(true)}>
                  Картинка
                </button>
              </div>
              <Help>
                <GestureHelp />
              </Help>
              <button type="button" className="pill pri save-btn" aria-label="Сохранить" title="Сохранить" onClick={save} disabled={busy === 'save'}>
                <IconDownload />
                <span className="save-label">{busy === 'save' ? 'Сохраняю…' : 'Сохранить'}</span>
              </button>
            </div>
          </header>

          {notice && (
            <div className="notice" role="status">
              <span>{notice}</span>
              <button type="button" aria-label="Закрыть" onClick={() => setNotice(null)}>
                <IconClose />
              </button>
            </div>
          )}

          <Dock
            ref={dockRef}
            shape={params.shape}
            onShape={(shape) => setParams((p) => ({ ...p, shape }))}
            onRandom={() => setParams(randomGlass)}
            more={more}
            onMore={() => showMore(!more)}
          />

          {more && (
            <More
              image={image}
              params={params}
              onParams={setParams}
              onReset={() => setParams(defaultParams(image.width, image.height))}
              onClose={() => showMore(false)}
              area={area}
              onArea={setArea}
              onSheet={setSheet}
            />
          )}

          {saved && (
            <SaveCard
              saved={saved}
              image={image}
              params={params}
              onBack={() => setSaved(null)}
              onNew={() => {
                setSaved(null);
                pick();
              }}
            />
          )}
        </div>
      )}

      {dropping && (
        <div className="drop">
          <p>Отпустите — откроем картинку</p>
        </div>
      )}
    </div>
  );
}

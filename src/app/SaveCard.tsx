import { useEffect, useRef, useState } from 'react';
import type { GlassParams } from '../glass';
import { IconBack, IconCheck, IconCopy, IconImage, IconOpen, IconShare } from './icons';
import type { LoadedImage } from './load';
import { drawPreview, fitCanvas } from './preview';
import { canCopy, canShare, copy, download, formatBytes, isAppleMobile, openInTab, share, type SavedImage } from './save';

interface SaveCardProps {
  saved: SavedImage;
  image: LoadedImage;
  params: GlassParams;
  onBack: () => void;
  onNew: () => void;
}

export function SaveCard({ saved, image, params, onBack, onNew }: SaveCardProps) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState<string | null>(null);
  const shareable = isAppleMobile && canShare(saved);

  useEffect(() => {
    const c = ref.current!;
    fitCanvas(c);
    drawPreview(c, image.preview, params, false);
  }, [image, params]);

  const run = (job: () => Promise<unknown>, done: string) => {
    job()
      .then((ok) => ok !== false && setStatus(done))
      .catch((e: Error) => setStatus(`Не вышло: ${e.message}`));
  };

  return (
    <div className="modal" role="dialog" aria-modal="true" aria-labelledby="save-title" onClick={(e) => e.target === e.currentTarget && onBack()}>
      <div className="save-card">
        <canvas ref={ref} className="save-preview" />
        <div className="save-head">
          <span className="ok">
            <IconCheck />
          </span>
          <h2 id="save-title">{isAppleMobile ? 'Картинка готова' : 'Сохранено'}</h2>
          <code className="save-file">{saved.file}</code>
        </div>
        <div className="chips">
          <span>
            {saved.width} × {saved.height} px
          </span>
          <span>PNG</span>
          <span>{formatBytes(saved.blob.size)}</span>
        </div>
        <p className="save-note">
          {isAppleMobile ? (
            shareable ? (
              <>«Сохранить» откроет меню — там «Сохранить изображение» кладёт картинку в Фото.</>
            ) : (
              <>Откройте картинку и удерживайте её пальцем — появится «Сохранить в Фото».</>
            )
          ) : (
            <>
              Файл в загрузках браузера ·{' '}
              <button type="button" className="link" onClick={() => download(saved)}>
                скачать ещё раз
              </button>
            </>
          )}
          {saved.downscaled && ' Картинка больше, чем тянет видеокарта, — сохранена уменьшенной.'}
        </p>
        {status && (
          <p className="save-status" role="status">
            {status}
          </p>
        )}
        <div className="save-actions">
          {isAppleMobile && shareable && (
            <button type="button" className="pill pri" onClick={() => run(() => share(saved), 'Готово')}>
              <IconShare />
              Сохранить
            </button>
          )}
          {isAppleMobile && (
            <button type="button" className={`pill ${shareable ? 'ghost' : 'pri'}`} onClick={() => openInTab(saved)}>
              <IconOpen />
              Открыть картинку
            </button>
          )}
          {!isAppleMobile && (
            <button type="button" className="pill pri" onClick={onNew}>
              <IconImage />
              Новая картинка
            </button>
          )}
          <button type="button" className="pill ghost" onClick={onBack}>
            <IconBack />
            Вернуться к стеклу
          </button>
          {!isAppleMobile && canCopy && (
            <button type="button" className="pill ghost" onClick={() => run(() => copy(saved), 'Скопировано — вставьте куда нужно')}>
              <IconCopy />
              Скопировать
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

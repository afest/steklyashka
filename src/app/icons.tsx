import type { ReactNode } from 'react';

/** Линейные иконки 24×24, цвет — currentColor. */
function Icon({ children, size = 20 }: { children: ReactNode; size?: number }) {
  return (
    <svg className="ico" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}

export const IconImage = () => (
  <Icon>
    <rect x="3.5" y="4.5" width="17" height="15" rx="2.5" />
    <circle cx="9" cy="10" r="1.6" />
    <path d="m20.5 16-4.5-4.5-8.5 8" />
  </Icon>
);
export const IconBack = () => (
  <Icon>
    <path d="m14.5 6-6 6 6 6" />
  </Icon>
);
export const IconDownload = () => (
  <Icon>
    <path d="M12 4v11m-4.5-4.5L12 15l4.5-4.5M5 19.5h14" />
  </Icon>
);
export const IconClose = () => (
  <Icon>
    <path d="m6.5 6.5 11 11m0-11-11 11" />
  </Icon>
);
/** Свернуть панель вправо: рамка с правой колонкой и стрелка к ней. */
export const IconCollapse = () => (
  <Icon>
    <rect x="3.5" y="4.5" width="17" height="15" rx="2.5" />
    <path d="M14.5 4.5v15M7.5 9.5 10 12l-2.5 2.5" />
  </Icon>
);
export const IconDice = () => (
  <Icon size={24}>
    <rect x="4" y="4" width="16" height="16" rx="3.5" />
    <circle cx="9" cy="9" r="1.1" fill="currentColor" stroke="none" />
    <circle cx="15" cy="15" r="1.1" fill="currentColor" stroke="none" />
    <circle cx="15" cy="9" r="1.1" fill="currentColor" stroke="none" />
    <circle cx="9" cy="15" r="1.1" fill="currentColor" stroke="none" />
    <circle cx="12" cy="12" r="1.1" fill="currentColor" stroke="none" />
  </Icon>
);
export const IconSliders = () => (
  <Icon size={24}>
    <path d="M4 8h9m4 0h3M4 16h3m4 0h9" />
    <circle cx="15" cy="8" r="2" />
    <circle cx="9" cy="16" r="2" />
  </Icon>
);
export const IconCopy = () => (
  <Icon>
    <rect x="8.5" y="8.5" width="11" height="11" rx="2" />
    <path d="M15.5 8.5V6a1.5 1.5 0 0 0-1.5-1.5H6A1.5 1.5 0 0 0 4.5 6v8A1.5 1.5 0 0 0 6 15.5h2.5" />
  </Icon>
);
export const IconShare = () => (
  <Icon>
    <path d="M12 15V4m-4 4 4-4 4 4M7 11.5H6A1.5 1.5 0 0 0 4.5 13v5.5A1.5 1.5 0 0 0 6 20h12a1.5 1.5 0 0 0 1.5-1.5V13a1.5 1.5 0 0 0-1.5-1.5h-1" />
  </Icon>
);
export const IconCheck = () => (
  <Icon size={16}>
    <path d="m5.5 12.5 4 4 9-9" strokeWidth="2.4" />
  </Icon>
);
export const IconMove = () => (
  <Icon size={18}>
    <path d="M12 3.5v17M3.5 12h17M12 3.5 9.5 6M12 3.5 14.5 6M12 20.5 9.5 18M12 20.5l2.5-2.5M3.5 12 6 9.5M3.5 12 6 14.5M20.5 12 18 9.5M20.5 12 18 14.5" />
  </Icon>
);
export const IconFill = () => (
  <Icon>
    <rect x="3.5" y="3.5" width="17" height="17" rx="2" />
    <path d="M3.5 9.2h17M3.5 14.8h17M9.2 3.5v17M14.8 3.5v17" />
  </Icon>
);
export const IconOpen = () => (
  <Icon>
    <path d="M13.5 4.5h6v6M19.5 4.5l-8 8M10 5.5H6A1.5 1.5 0 0 0 4.5 7v11A1.5 1.5 0 0 0 6 19.5h11a1.5 1.5 0 0 0 1.5-1.5v-4" />
  </Icon>
);

/** Формы ячеек: силуэты различаются и без цвета. */
export const SHAPE_ICONS: Record<string, ReactNode> = {
  squares: (
    <Icon size={28}>
      <rect x="4" y="4" width="16" height="16" rx="1.5" />
      <path d="M12 4v16M4 12h16" />
    </Icon>
  ),
  hex: (
    <Icon size={28}>
      <path d="m8 3.6 3.5 2v4l-3.5 2-3.5-2v-4zM16 3.6l3.5 2v4l-3.5 2-3.5-2v-4zM12 10.4l3.5 2v4l-3.5 2-3.5-2v-4z" />
    </Icon>
  ),
  triangles: (
    <Icon size={28}>
      <path d="M12 4 20.5 19h-17zM7.75 11.5h8.5M12 19l-4.25-7.5M12 19l4.25-7.5" />
    </Icon>
  ),
  circles: (
    <Icon size={28}>
      <circle cx="8" cy="8" r="3.6" />
      <circle cx="16" cy="8" r="3.6" />
      <circle cx="8" cy="16" r="3.6" />
      <circle cx="16" cy="16" r="3.6" />
    </Icon>
  ),
  stripes: (
    <Icon size={28}>
      <rect x="4" y="4" width="3" height="16" rx="1.2" />
      <rect x="8.7" y="4" width="3" height="16" rx="1.2" />
      <rect x="13.4" y="4" width="3" height="16" rx="1.2" />
      <rect x="18.1" y="4" width="2" height="16" rx="1" />
    </Icon>
  ),
  shards: (
    <Icon size={28}>
      <rect x="4" y="4" width="16" height="16" rx="1.5" />
      <path d="M13 11 4 8.5M13 11l3-7M13 11l7 2.5M13 11l-2.5 9M13 11 4 17" />
    </Icon>
  ),
};

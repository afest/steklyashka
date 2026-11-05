import type { PlateParams } from './params';

/** Пластина в пикселях картинки. */
export interface PlateGeometry {
  cx: number;
  cy: number;
  /** Полуширина и полувысота. */
  hx: number;
  hy: number;
  /** Поворот, радианы. */
  angle: number;
}

export function plateGeometry(plate: PlateParams, width: number, height: number): PlateGeometry {
  const side = Math.min(width, height);
  return {
    cx: plate.x * width,
    cy: plate.y * height,
    hx: (plate.width * side) / 2,
    hy: (plate.height * side) / 2,
    angle: (plate.rotation * Math.PI) / 180,
  };
}

export function plateFromGeometry(g: PlateGeometry, width: number, height: number): PlateParams {
  const side = Math.min(width, height);
  return {
    x: g.cx / width,
    y: g.cy / height,
    width: (2 * g.hx) / side,
    height: (2 * g.hy) / side,
    rotation: (g.angle * 180) / Math.PI,
  };
}

/** Точка картинки → координаты пластины (центр в нуле, оси по сторонам). */
export function toPlateLocal(g: PlateGeometry, px: number, py: number): { x: number; y: number } {
  const dx = px - g.cx;
  const dy = py - g.cy;
  const c = Math.cos(g.angle);
  const s = Math.sin(g.angle);
  return { x: c * dx + s * dy, y: -s * dx + c * dy };
}

/** Координаты пластины → точка картинки. */
export function fromPlateLocal(g: PlateGeometry, lx: number, ly: number): { x: number; y: number } {
  const c = Math.cos(g.angle);
  const s = Math.sin(g.angle);
  return { x: g.cx + c * lx - s * ly, y: g.cy + s * lx + c * ly };
}

/** Углы по часовой, начиная с верхнего левого. */
export function plateCorners(g: PlateGeometry): { x: number; y: number }[] {
  return [
    fromPlateLocal(g, -g.hx, -g.hy),
    fromPlateLocal(g, g.hx, -g.hy),
    fromPlateLocal(g, g.hx, g.hy),
    fromPlateLocal(g, -g.hx, g.hy),
  ];
}

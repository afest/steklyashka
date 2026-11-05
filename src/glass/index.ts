export { GlassRenderer } from './renderer';
export type { GlassSource, ImageInfo, Rgba, ViewTransform } from './renderer';
export { exportPng } from './export';
export type { ExportArea, ExportOptions, ExportOutside, ExportResult } from './export';
export {
  DEFAULT_PARAMS,
  PARAM_RANGES,
  cellExtent,
  getParam,
  innerPlate,
  normalizeParams,
  paramLimits,
  setGridMode,
  setParam,
} from './params';
export { CELL_SHAPES, CIRCLE_GAPS } from './params';
export type { CellShape, CircleGap, GlassParams, GridMode, ParamKey, ParamRange, PlateParams } from './params';
export { fromPlateLocal, plateCorners, plateFromGeometry, plateGeometry, toPlateLocal } from './geometry';
export type { PlateGeometry } from './geometry';
export { PRESETS } from './presets';
export type { PresetName } from './presets';

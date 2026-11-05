import { plateGeometry } from './geometry';
import { CELL_SHAPES, CIRCLE_GAPS, cellExtent, type GlassParams } from './params';
import { FRAGMENT_GLSL, VERTEX_GLSL } from './shader';

/** Пиксель холста = пиксель картинки × scale + (x, y). */
export interface ViewTransform {
  x: number;
  y: number;
  scale: number;
}

export type Rgba = [number, number, number, number];

export type GlassSource = HTMLImageElement | HTMLCanvasElement | ImageBitmap | OffscreenCanvas;

export interface ImageInfo {
  width: number;
  height: number;
  /** Картинка больше предела текстуры видеокарты и была уменьшена. */
  downscaled: boolean;
}

const UNIFORMS = [
  'uImage', 'uImageSize', 'uViewOffset', 'uViewScale', 'uCanvasHeight', 'uBackground',
  'uPlateCenter', 'uPlateHalf', 'uPlateRot', 'uGridOffset',
  'uCell', 'uShape', 'uSeed', 'uStripe', 'uGapMode', 'uZoom', 'uLoupe', 'uSquare', 'uIrregularity', 'uSoftness', 'uSeamLight', 'uRainbow', 'uEdge',
  'uRimWidth', 'uBevel', 'uOutside', 'uOutsideFill',
] as const;
type UniformName = (typeof UNIFORMS)[number];

function sourceSize(src: GlassSource): { width: number; height: number } {
  if (src instanceof HTMLImageElement) return { width: src.naturalWidth, height: src.naturalHeight };
  return { width: src.width, height: src.height };
}

function compile(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type)!;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`Шейдер не собрался: ${log}`);
  }
  return shader;
}

/** Стекло поверх картинки: картинка и параметры на входе, отрисовка в canvas на выходе. */
export class GlassRenderer {
  readonly gl: WebGL2RenderingContext;
  readonly maxTextureSize: number;
  private readonly program: WebGLProgram;
  private readonly vao: WebGLVertexArrayObject;
  private readonly u: Record<UniformName, WebGLUniformLocation | null>;
  private texture: WebGLTexture | null = null;
  private image: ImageInfo | null = null;
  background: Rgba = [0, 0, 0, 0];

  constructor(canvas: HTMLCanvasElement | OffscreenCanvas, options: WebGLContextAttributes = {}) {
    const gl = canvas.getContext('webgl2', {
      antialias: false,
      premultipliedAlpha: false,
      ...options,
    }) as WebGL2RenderingContext | null;
    if (!gl) throw new Error('WebGL2 недоступен');
    this.gl = gl;
    this.maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE) as number;

    const program = gl.createProgram()!;
    gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERTEX_GLSL));
    gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, FRAGMENT_GLSL));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(`Программа не собралась: ${gl.getProgramInfoLog(program)}`);
    }
    this.program = program;
    this.vao = gl.createVertexArray()!;
    this.u = Object.fromEntries(UNIFORMS.map((n) => [n, gl.getUniformLocation(program, n)])) as Record<
      UniformName,
      WebGLUniformLocation | null
    >;
  }

  get imageInfo(): ImageInfo | null {
    return this.image;
  }

  setImage(source: GlassSource): ImageInfo {
    const gl = this.gl;
    let { width, height } = sourceSize(source);
    let upload: GlassSource = source;
    const downscaled = Math.max(width, height) > this.maxTextureSize;
    if (downscaled) {
      const k = this.maxTextureSize / Math.max(width, height);
      width = Math.floor(width * k);
      height = Math.floor(height * k);
      const c = new OffscreenCanvas(width, height);
      c.getContext('2d')!.drawImage(source, 0, 0, width, height);
      upload = c;
    }
    if (this.texture) gl.deleteTexture(this.texture);
    const tex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, upload);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    this.texture = tex;
    this.image = { width, height, downscaled };
    return this.image;
  }

  /** Картинка целиком по центру холста. */
  fitView(): ViewTransform {
    const { drawingBufferWidth: W, drawingBufferHeight: H } = this.gl;
    if (!this.image) return { x: 0, y: 0, scale: 1 };
    const scale = Math.min(W / this.image.width, H / this.image.height);
    return {
      x: (W - this.image.width * scale) / 2,
      y: (H - this.image.height * scale) / 2,
      scale,
    };
  }

  /** outside — заливка вне пластины (RGBA 0–1) вместо картинки; null — картинка как есть. */
  render(params: GlassParams, view: ViewTransform = this.fitView(), outside: Rgba | null = null): void {
    const gl = this.gl;
    const { drawingBufferWidth: W, drawingBufferHeight: H } = gl;
    gl.viewport(0, 0, W, H);
    gl.clearColor(...this.background);
    gl.clear(gl.COLOR_BUFFER_BIT);
    if (!this.texture || !this.image) return;

    const { width: iw, height: ih } = this.image;
    const plate = plateGeometry(params.plate, iw, ih);
    const ext = cellExtent(params);
    const side = Math.min(iw, ih);
    const cellX = Math.max(ext.x * side, 1e-3);
    const cellY = Math.max(ext.y * side, 1e-3);
    // Неполные ячейки делятся поровну между противоположными краями пластины.
    // Целое число ячеек (режим столбцов и рядов) не должно съехать на полъячейки из-за округления.
    const offset = (half: number, cell: number) => {
      const count = (2 * half) / cell;
      const frac = Math.abs(count - Math.round(count)) < 1e-4 ? 0 : count - Math.floor(count);
      return half - (frac * cell) / 2;
    };
    // Торец — рамка пластины; сетка выравнивается по пластине без торца.
    const rim = params.edgeWidth * 2 * Math.min(plate.hx, plate.hy);
    const innerX = Math.max(plate.hx - rim, 1e-3);
    const innerY = Math.max(plate.hy - rim, 1e-3);
    const u = this.u;

    gl.useProgram(this.program);
    gl.bindVertexArray(this.vao);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.uniform1i(u.uImage, 0);
    gl.uniform2f(u.uImageSize, iw, ih);
    gl.uniform2f(u.uViewOffset, view.x, view.y);
    gl.uniform1f(u.uViewScale, 1 / view.scale);
    gl.uniform1f(u.uCanvasHeight, H);
    gl.uniform4f(u.uBackground, ...this.background);
    gl.uniform2f(u.uPlateCenter, plate.cx, plate.cy);
    gl.uniform2f(u.uPlateHalf, plate.hx, plate.hy);
    gl.uniform2f(u.uPlateRot, Math.cos(plate.angle), Math.sin(plate.angle));
    gl.uniform2f(u.uGridOffset, offset(innerX, cellX), offset(innerY, cellY));
    gl.uniform2f(u.uCell, cellX, cellY);
    gl.uniform1f(u.uShape, CELL_SHAPES.indexOf(params.shape));
    gl.uniform1f(u.uSeed, params.shapeSeed);
    // Полосы лежат в системе пластины: угол полос отсчитывается от неё, как и сетка.
    const sa = (params.stripeAngle * Math.PI) / 180;
    gl.uniform2f(u.uStripe, Math.cos(sa), Math.sin(sa));
    gl.uniform1f(u.uGapMode, CIRCLE_GAPS.indexOf(params.circleGap));
    gl.uniform1f(u.uZoom, params.zoom);
    gl.uniform1f(u.uLoupe, params.loupe);
    gl.uniform1f(u.uSquare, params.squareness);
    gl.uniform1f(u.uIrregularity, params.irregularity);
    gl.uniform1f(u.uSoftness, params.seamSoftness);
    gl.uniform1f(u.uSeamLight, params.seamLight);
    gl.uniform1f(u.uRainbow, params.rainbow);
    gl.uniform1f(u.uEdge, params.edge);
    gl.uniform1f(u.uRimWidth, rim);
    gl.uniform1f(u.uBevel, params.bevel);
    gl.uniform4f(u.uOutside, ...(outside ?? [0, 0, 0, 0]));
    gl.uniform1f(u.uOutsideFill, outside ? 1 : 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  dispose(): void {
    const gl = this.gl;
    if (this.texture) gl.deleteTexture(this.texture);
    gl.deleteVertexArray(this.vao);
    gl.deleteProgram(this.program);
    this.texture = null;
    this.image = null;
  }
}

export type AspectRatio = 'original' | '1:1' | '4:5' | '3:2' | '16:9' | '9:16';

export interface CropSettings {
  aspect: AspectRatio;
  /** Giros de 90° en sentido horario (0..3). */
  quarterTurns: number;
  flipH: boolean;
  /** Enderezar, en grados (-45..45). */
  straighten: number;
}

/** Ocho canales de la mezcla de color (HSL). */
export const HSL_CHANNELS = [
  'rojo',
  'naranja',
  'amarillo',
  'verde',
  'aguamarina',
  'azul',
  'morado',
  'magenta',
] as const;
export type HslChannel = (typeof HSL_CHANNELS)[number];

export interface HslValues {
  hue: number[]; // 8 valores -100..100
  sat: number[];
  lum: number[];
}

export interface Adjustments {
  // Luz
  exposure: number; // -5..5 (pasos)
  contrast: number; // -100..100
  highlights: number;
  shadows: number;
  whites: number;
  blacks: number;
  // Color
  temp: number; // -100..100
  tint: number;
  vibrance: number;
  saturation: number;
  hsl: HslValues;
  // Gradación de color
  gradeShadowHue: number; // 0..360
  gradeShadowSat: number; // 0..100
  gradeHighlightHue: number;
  gradeHighlightSat: number;
  gradeBalance: number; // -100..100
  // Efectos
  texture: number;
  clarity: number;
  dehaze: number;
  vignette: number; // -100..100
  grain: number; // 0..100
  // Detalle
  sharpen: number; // 0..150
  // Geometría
  crop: CropSettings;
}

export interface Photo {
  id: string;
  /** Copia local del original (file://). */
  uri: string;
  /** Miniatura con los ajustes aplicados (file://), si existe. */
  thumbUri?: string;
  width: number;
  height: number;
  createdAt: number;
  edited: boolean;
  rating: number; // 0..5
  flagged: boolean;
  adjustments: Adjustments;
}

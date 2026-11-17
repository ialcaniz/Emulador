import type { Adjustments, HslValues } from '../types';

export const zeroHsl = (): HslValues => ({
  hue: [0, 0, 0, 0, 0, 0, 0, 0],
  sat: [0, 0, 0, 0, 0, 0, 0, 0],
  lum: [0, 0, 0, 0, 0, 0, 0, 0],
});

export const defaultAdjustments = (): Adjustments => ({
  exposure: 0,
  contrast: 0,
  highlights: 0,
  shadows: 0,
  whites: 0,
  blacks: 0,
  temp: 0,
  tint: 0,
  vibrance: 0,
  saturation: 0,
  hsl: zeroHsl(),
  gradeShadowHue: 220,
  gradeShadowSat: 0,
  gradeHighlightHue: 40,
  gradeHighlightSat: 0,
  gradeBalance: 0,
  texture: 0,
  clarity: 0,
  dehaze: 0,
  vignette: 0,
  grain: 0,
  sharpen: 0,
  crop: { aspect: 'original', quarterTurns: 0, flipH: false, straighten: 0 },
});

export const cloneAdjustments = (a: Adjustments): Adjustments => ({
  ...a,
  hsl: { hue: [...a.hsl.hue], sat: [...a.hsl.sat], lum: [...a.hsl.lum] },
  crop: { ...a.crop },
});

/** Devuelve los ajustes de tono/color por defecto, conservando el recorte. */
export const resetTone = (a: Adjustments): Adjustments => ({
  ...defaultAdjustments(),
  crop: { ...a.crop },
});

export const isEdited = (a: Adjustments): boolean =>
  JSON.stringify(a) !== JSON.stringify(defaultAdjustments());

/** Rellena con valores por defecto los campos que falten (datos antiguos). */
export const normalizeAdjustments = (a: Partial<Adjustments> | undefined): Adjustments => {
  const d = defaultAdjustments();
  if (!a) return d;
  return {
    ...d,
    ...a,
    hsl: { ...d.hsl, ...(a.hsl ?? {}) },
    crop: { ...d.crop, ...(a.crop ?? {}) },
  };
};

export type NumericKey = {
  [K in keyof Adjustments]: Adjustments[K] extends number ? K : never;
}[keyof Adjustments];

export interface SliderDef {
  key: NumericKey;
  label: string;
  min: number;
  max: number;
  step?: number;
  /** Degradado decorativo para la pista del deslizador. */
  track?: string[];
  format?: (v: number) => string;
}

const signed = (v: number) => (v > 0 ? `+${Math.round(v)}` : `${Math.round(v)}`);
const stops = (v: number) => (v > 0 ? `+${v.toFixed(2)}` : v.toFixed(2)) + ' EV';

export const LIGHT_SLIDERS: SliderDef[] = [
  { key: 'exposure', label: 'Exposición', min: -5, max: 5, step: 0.01, format: stops },
  { key: 'contrast', label: 'Contraste', min: -100, max: 100, format: signed },
  { key: 'highlights', label: 'Iluminaciones', min: -100, max: 100, format: signed },
  { key: 'shadows', label: 'Sombras', min: -100, max: 100, format: signed },
  { key: 'whites', label: 'Blancos', min: -100, max: 100, format: signed },
  { key: 'blacks', label: 'Negros', min: -100, max: 100, format: signed },
];

export const COLOR_SLIDERS: SliderDef[] = [
  {
    key: 'temp',
    label: 'Temperatura',
    min: -100,
    max: 100,
    track: ['#3b7bd9', '#d9d9d9', '#e2b13c'],
    format: signed,
  },
  {
    key: 'tint',
    label: 'Matiz',
    min: -100,
    max: 100,
    track: ['#3fbf4a', '#d9d9d9', '#d24fd0'],
    format: signed,
  },
  {
    key: 'vibrance',
    label: 'Intensidad',
    min: -100,
    max: 100,
    track: ['#8a8a8a', '#d9d9d9', '#e0457b'],
    format: signed,
  },
  {
    key: 'saturation',
    label: 'Saturación',
    min: -100,
    max: 100,
    track: ['#8a8a8a', '#d9d9d9', '#e04545'],
    format: signed,
  },
];

export const GRADING_SLIDERS: SliderDef[] = [
  {
    key: 'gradeShadowHue',
    label: 'Sombras · tono',
    min: 0,
    max: 360,
    track: ['#ff0000', '#ffff00', '#00ff00', '#00ffff', '#0000ff', '#ff00ff', '#ff0000'],
    format: (v) => `${Math.round(v)}°`,
  },
  { key: 'gradeShadowSat', label: 'Sombras · saturación', min: 0, max: 100, format: (v) => `${Math.round(v)}` },
  {
    key: 'gradeHighlightHue',
    label: 'Iluminaciones · tono',
    min: 0,
    max: 360,
    track: ['#ff0000', '#ffff00', '#00ff00', '#00ffff', '#0000ff', '#ff00ff', '#ff0000'],
    format: (v) => `${Math.round(v)}°`,
  },
  {
    key: 'gradeHighlightSat',
    label: 'Iluminaciones · saturación',
    min: 0,
    max: 100,
    format: (v) => `${Math.round(v)}`,
  },
  { key: 'gradeBalance', label: 'Equilibrio', min: -100, max: 100, format: signed },
];

export const EFFECTS_SLIDERS: SliderDef[] = [
  { key: 'texture', label: 'Textura', min: -100, max: 100, format: signed },
  { key: 'clarity', label: 'Claridad', min: -100, max: 100, format: signed },
  { key: 'dehaze', label: 'Neblina', min: -100, max: 100, format: signed },
  { key: 'vignette', label: 'Viñeta', min: -100, max: 100, format: signed },
  { key: 'grain', label: 'Granulado', min: 0, max: 100, format: (v) => `${Math.round(v)}` },
];

export const DETAIL_SLIDERS: SliderDef[] = [
  { key: 'sharpen', label: 'Enfoque', min: 0, max: 150, format: (v) => `${Math.round(v)}` },
];

export const HSL_SWATCHES = [
  '#e5383b',
  '#f28c28',
  '#f2d22e',
  '#3bb54a',
  '#2ec4c4',
  '#2f6fe0',
  '#8b4ae0',
  '#d93ec2',
];

// ---------------------------------------------------------------------------
// Ajustes preestablecidos
// ---------------------------------------------------------------------------

export interface Preset {
  name: string;
  group: string;
  values: Partial<Omit<Adjustments, 'crop'>>;
}

const hsl = (h: Partial<HslValues>): HslValues => ({ ...zeroHsl(), ...h });

export const PRESETS: Preset[] = [
  { group: 'Básicos', name: 'Ninguno', values: {} },
  {
    group: 'Básicos',
    name: 'Natural',
    values: { contrast: 10, highlights: -20, shadows: 15, vibrance: 15, clarity: 5 },
  },
  {
    group: 'Básicos',
    name: 'Vívido',
    values: { contrast: 25, highlights: -30, shadows: 20, whites: 10, blacks: -10, vibrance: 40, saturation: 10, clarity: 15 },
  },
  {
    group: 'Básicos',
    name: 'Suave',
    values: { contrast: -20, highlights: -20, shadows: 25, clarity: -15, texture: -10, vibrance: 5 },
  },
  {
    group: 'Retrato',
    name: 'Piel cálida',
    values: {
      temp: 12,
      tint: 4,
      contrast: 5,
      texture: -20,
      clarity: -10,
      hsl: hsl({ sat: [-5, -10, 0, 0, 0, 0, 0, 0], lum: [5, 12, 0, 0, 0, 0, 0, 0] }),
    },
  },
  {
    group: 'Retrato',
    name: 'Luminoso',
    values: { exposure: 0.35, contrast: -10, highlights: -35, shadows: 30, whites: 15, vibrance: 10, clarity: -10 },
  },
  {
    group: 'Paisaje',
    name: 'Cielo profundo',
    values: {
      contrast: 20,
      highlights: -45,
      dehaze: 15,
      vibrance: 25,
      hsl: hsl({ sat: [0, 0, 0, 10, 15, 25, 0, 0], lum: [0, 0, 0, 0, -10, -25, 0, 0] }),
    },
  },
  {
    group: 'Paisaje',
    name: 'Verde bosque',
    values: {
      contrast: 15,
      shadows: 20,
      clarity: 20,
      hsl: hsl({ hue: [0, 0, -15, 10, 0, 0, 0, 0], sat: [0, 0, -10, 20, 0, 0, 0, 0], lum: [0, 0, 0, -10, 0, 0, 0, 0] }),
    },
  },
  {
    group: 'Película',
    name: 'Película mate',
    values: {
      contrast: -15,
      blacks: 40,
      highlights: -20,
      saturation: -15,
      grain: 25,
      gradeShadowHue: 200,
      gradeShadowSat: 15,
      gradeHighlightHue: 45,
      gradeHighlightSat: 12,
    },
  },
  {
    group: 'Película',
    name: 'Retro cálido',
    values: {
      temp: 25,
      tint: 8,
      contrast: 10,
      blacks: 25,
      saturation: -20,
      vignette: -25,
      grain: 30,
      gradeShadowHue: 30,
      gradeShadowSat: 15,
    },
  },
  {
    group: 'Película',
    name: 'Teal & Orange',
    values: {
      contrast: 15,
      vibrance: 10,
      gradeShadowHue: 190,
      gradeShadowSat: 30,
      gradeHighlightHue: 35,
      gradeHighlightSat: 25,
      hsl: hsl({ hue: [0, -5, -20, 40, 0, -10, 0, 0], sat: [0, 10, 0, -30, 0, 0, 0, 0] }),
    },
  },
  {
    group: 'Película',
    name: 'Frío nórdico',
    values: { temp: -20, tint: -3, contrast: 10, highlights: -15, saturation: -25, clarity: 10, gradeShadowHue: 215, gradeShadowSat: 15 },
  },
  {
    group: 'Blanco y negro',
    name: 'B/N clásico',
    values: { saturation: -100, contrast: 20, clarity: 15 },
  },
  {
    group: 'Blanco y negro',
    name: 'B/N alto contraste',
    values: { saturation: -100, contrast: 50, whites: 20, blacks: -30, clarity: 30, grain: 15 },
  },
  {
    group: 'Blanco y negro',
    name: 'Sepia',
    values: {
      saturation: -100,
      contrast: 10,
      gradeShadowHue: 30,
      gradeShadowSat: 30,
      gradeHighlightHue: 40,
      gradeHighlightSat: 20,
    },
  },
  {
    group: 'Creativos',
    name: 'Dramático',
    values: { exposure: -0.3, contrast: 40, highlights: -60, shadows: 30, clarity: 40, dehaze: 15, vignette: -35, saturation: -10 },
  },
  {
    group: 'Creativos',
    name: 'Ensueño',
    values: { exposure: 0.25, contrast: -25, clarity: -40, dehaze: -15, temp: 8, vibrance: 15, gradeHighlightHue: 330, gradeHighlightSat: 15 },
  },
];

export const applyPreset = (base: Adjustments, preset: Preset): Adjustments => ({
  ...resetTone(base),
  ...preset.values,
  hsl: preset.values.hsl
    ? { hue: [...preset.values.hsl.hue], sat: [...preset.values.hsl.sat], lum: [...preset.values.hsl.lum] }
    : zeroHsl(),
});

/**
 * Ajuste automático sencillo basado en el histograma de luminancia
 * (valores 0..1 de los percentiles 1, 50 y 99).
 */
export const autoAdjust = (
  base: Adjustments,
  stats: { p01: number; p50: number; p99: number; meanR: number; meanG: number; meanB: number },
): Adjustments => {
  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
  const targetMid = 0.46;
  const exposure = clamp(Math.log2(targetMid / Math.max(stats.p50, 0.02)), -2, 2);
  const range = stats.p99 - stats.p01;
  const contrast = clamp((0.85 - range) * 60, -30, 40);
  const whites = clamp((0.97 - stats.p99) * 120, -40, 40);
  const blacks = clamp((0.03 - stats.p01) * 200, -40, 40);
  const gray = (stats.meanR + stats.meanG + stats.meanB) / 3 || 1;
  const temp = clamp(((stats.meanB - stats.meanR) / gray) * 60, -40, 40);
  const tint = clamp(((stats.meanG - (stats.meanR + stats.meanB) / 2) / gray) * -60, -30, 30);
  return {
    ...base,
    exposure: Math.round(exposure * 100) / 100,
    contrast: Math.round(contrast),
    highlights: stats.p99 > 0.92 ? -30 : -10,
    shadows: stats.p01 < 0.05 ? 25 : 10,
    whites: Math.round(whites),
    blacks: Math.round(blacks),
    temp: Math.round(temp),
    tint: Math.round(tint),
    vibrance: 20,
  };
};

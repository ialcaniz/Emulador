export type Tool = 'select' | 'pen' | 'line' | 'arrow' | 'rect' | 'marker' | 'text';

export interface Point {
  x: number;
  y: number;
}

/** Rectángulo en coordenadas de píxel de la imagen original. */
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Base {
  id: string;
  color: string;
  /** Grosor del trazo en píxeles de la imagen. */
  width: number;
}

export interface FreehandShape extends Base {
  kind: 'pen' | 'marker';
  points: Point[];
}

export interface SegmentShape extends Base {
  kind: 'line' | 'arrow' | 'rect';
  from: Point;
  to: Point;
}

export interface TextShape extends Base {
  kind: 'text';
  at: Point;
  text: string;
  /** Tamaño de letra en píxeles de la imagen. */
  size: number;
}

export type Shape = FreehandShape | SegmentShape | TextShape;

export const COLORS = [
  '#ff1a1a', // rojo (por defecto)
  '#ff8c00',
  '#ffe600',
  '#22c55e',
  '#00b7ff',
  '#2b54ff',
  '#a855f7',
  '#ff3ec8',
  '#ffffff',
  '#000000',
];

export const SIZES = [
  { key: 0, label: 'Fino', stroke: 2, text: 16 },
  { key: 1, label: 'Medio', stroke: 4, text: 24 },
  { key: 2, label: 'Grueso', stroke: 8, text: 36 },
];

/**
 * Unidad de tamaño relativa a la imagen, para que el trazo se vea igual
 * en una captura de 720 px que en una de 1440 px.
 */
export const sizeUnit = (imgW: number, imgH: number) => Math.max(1, Math.min(imgW, imgH) / 400);

export const normalizeRect = (a: Point, b: Point): Rect => ({
  x: Math.min(a.x, b.x),
  y: Math.min(a.y, b.y),
  width: Math.abs(a.x - b.x),
  height: Math.abs(a.y - b.y),
});

import type { AspectRatio, CropSettings } from '../types';

export const ASPECTS: { key: AspectRatio; label: string }[] = [
  { key: 'original', label: 'Original' },
  { key: '1:1', label: '1:1' },
  { key: '4:5', label: '4:5' },
  { key: '3:2', label: '3:2' },
  { key: '16:9', label: '16:9' },
  { key: '9:16', label: '9:16' },
];

const aspectValue = (aspect: AspectRatio, fallback: number) => {
  switch (aspect) {
    case '1:1':
      return 1;
    case '4:5':
      return 4 / 5;
    case '3:2':
      return 3 / 2;
    case '16:9':
      return 16 / 9;
    case '9:16':
      return 9 / 16;
    default:
      return fallback;
  }
};

/**
 * Tamaño (en píxeles de la imagen original) del área recortada final,
 * teniendo en cuenta giros, relación de aspecto y enderezado.
 */
export const cropSize = (imgW: number, imgH: number, crop: CropSettings) => {
  const odd = crop.quarterTurns % 2 === 1;
  const rw = odd ? imgH : imgW;
  const rh = odd ? imgW : imgH;
  const ar = aspectValue(crop.aspect, rw / rh);
  let cw = rw;
  let ch = rw / ar;
  if (ch > rh) {
    ch = rh;
    cw = rh * ar;
  }
  const th = (Math.abs(crop.straighten) * Math.PI) / 180;
  const c = Math.cos(th);
  const s = Math.sin(th);
  const f = Math.min(1, rw / (cw * c + ch * s), rh / (cw * s + ch * c));
  return { width: cw * f, height: ch * f };
};

/** Ajusta un rectángulo de relación w/h dentro de un contenedor. */
export const fitInside = (w: number, h: number, maxW: number, maxH: number) => {
  const k = Math.min(maxW / w, maxH / h);
  return { width: Math.max(1, Math.floor(w * k)), height: Math.max(1, Math.floor(h * k)) };
};

/**
 * Transformación que lleva coordenadas de píxel de la imagen al lienzo
 * (de tamaño `outW` × `outH`), para usarla en un ImageShader.
 */
export const imageTransform = (
  imgW: number,
  imgH: number,
  crop: CropSettings,
  outW: number,
  outH: number,
) => {
  const size = cropSize(imgW, imgH, crop);
  const s = outW / size.width;
  const angle = ((crop.quarterTurns * 90 + crop.straighten) * Math.PI) / 180;
  return {
    scale: s,
    transform: [
      { translateX: outW / 2 },
      { translateY: outH / 2 },
      { rotate: angle },
      { scaleX: (crop.flipH ? -1 : 1) * s },
      { scaleY: s },
      { translateX: -imgW / 2 },
      { translateY: -imgH / 2 },
    ],
  };
};

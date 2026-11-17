import {
  AlphaType,
  ColorType,
  drawAsImage,
  ImageFormat,
  Skia,
  type SkImage,
} from '@shopify/react-native-skia';
import React from 'react';
import type { Adjustments } from '../types';
import { DevelopedImage } from './DevelopedImage';
import { cropSize, fitInside } from './geometry';

export const loadSkImage = async (uri: string): Promise<SkImage> => {
  const data = await Skia.Data.fromURI(uri);
  const img = Skia.Image.MakeImageFromEncoded(data);
  if (!img) throw new Error('Formato de imagen no compatible');
  return img;
};

/** Reduce una imagen para la vista previa interactiva. */
export const downscale = (image: SkImage, maxSide: number): SkImage => {
  const w = image.width();
  const h = image.height();
  if (Math.max(w, h) <= maxSide) return image;
  const { width, height } = fitInside(w, h, maxSide, maxSide);
  const surface = Skia.Surface.MakeOffscreen(width, height) ?? Skia.Surface.Make(width, height);
  if (!surface) return image;
  const paint = Skia.Paint();
  paint.setAntiAlias(true);
  surface
    .getCanvas()
    .drawImageRect(image, Skia.XYWHRect(0, 0, w, h), Skia.XYWHRect(0, 0, width, height), paint);
  surface.flush();
  const snap = surface.makeImageSnapshot();
  return snap.makeNonTextureImage() ?? snap;
};

const outputSize = (image: SkImage, adj: Adjustments, maxSide: number) => {
  const size = cropSize(image.width(), image.height(), adj.crop);
  return fitInside(size.width, size.height, Math.min(maxSide, size.width), Math.min(maxSide, size.height));
};

export const renderDeveloped = async (
  image: SkImage,
  adj: Adjustments,
  maxSide: number,
  original = false,
): Promise<SkImage | null> => {
  const { width, height } = outputSize(image, adj, maxSide);
  return drawAsImage(
    <DevelopedImage image={image} adjustments={adj} width={width} height={height} original={original} />,
    { width, height },
  );
};

export const encode = (img: SkImage, format: 'jpg' | 'png', quality = 92): Uint8Array =>
  img.encodeToBytes(format === 'png' ? ImageFormat.PNG : ImageFormat.JPEG, quality);

export interface Analysis {
  r: number[];
  g: number[];
  b: number[];
  l: number[];
  max: number;
  p01: number;
  p50: number;
  p99: number;
  meanR: number;
  meanG: number;
  meanB: number;
  clipLow: number;
  clipHigh: number;
}

const BINS = 64;

/** Histograma y estadísticas de la imagen revelada (o del original). */
export const analyze = async (
  image: SkImage,
  adj: Adjustments,
  original = false,
): Promise<Analysis | null> => {
  const snap = await renderDeveloped(image, adj, 160, original);
  if (!snap) return null;
  const w = snap.width();
  const h = snap.height();
  const px = snap.readPixels(0, 0, {
    width: w,
    height: h,
    colorType: ColorType.RGBA_8888,
    alphaType: AlphaType.Unpremul,
  });
  if (!px) return null;
  const r = new Array<number>(BINS).fill(0);
  const g = new Array<number>(BINS).fill(0);
  const b = new Array<number>(BINS).fill(0);
  const l = new Array<number>(256).fill(0);
  let sr = 0;
  let sg = 0;
  let sb = 0;
  let clipLow = 0;
  let clipHigh = 0;
  const n = w * h;
  const scale = px instanceof Float32Array ? 255 : 1;
  for (let i = 0; i < n; i++) {
    const R = Math.min(255, Math.round(px[i * 4] * scale));
    const G = Math.min(255, Math.round(px[i * 4 + 1] * scale));
    const B = Math.min(255, Math.round(px[i * 4 + 2] * scale));
    r[R >> 2]++;
    g[G >> 2]++;
    b[B >> 2]++;
    const L = Math.round(0.2126 * R + 0.7152 * G + 0.0722 * B);
    l[L]++;
    sr += R;
    sg += G;
    sb += B;
    if (R <= 1 && G <= 1 && B <= 1) clipLow++;
    if (R >= 254 || G >= 254 || B >= 254) clipHigh++;
  }
  const pct = (q: number) => {
    let acc = 0;
    const target = q * n;
    for (let i = 0; i < 256; i++) {
      acc += l[i];
      if (acc >= target) return i / 255;
    }
    return 1;
  };
  // Escala ignorando los extremos para que un pico de recorte no aplane el resto.
  let max = 1;
  for (let i = 1; i < BINS - 1; i++) max = Math.max(max, r[i], g[i], b[i]);
  const lBins = new Array<number>(BINS).fill(0);
  for (let i = 0; i < 256; i++) lBins[i >> 2] += l[i];
  return {
    r,
    g,
    b,
    l: lBins,
    max,
    p01: pct(0.01),
    p50: pct(0.5),
    p99: pct(0.99),
    meanR: sr / n / 255,
    meanG: sg / n / 255,
    meanB: sb / n / 255,
    clipLow: clipLow / n,
    clipHigh: clipHigh / n,
  };
};

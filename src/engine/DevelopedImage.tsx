import { FilterMode, ImageShader, MipmapMode, Rect, Shader, type SkImage } from '@shopify/react-native-skia';
import React from 'react';
import type { Adjustments } from '../types';
import { defaultAdjustments } from './adjustments';
import { imageTransform } from './geometry';
import { buildUniforms, getDevelopEffect } from './shader';

interface Props {
  image: SkImage;
  adjustments: Adjustments;
  width: number;
  height: number;
  /** Muestra el original (sin ajustes de tono), conservando el recorte. */
  original?: boolean;
}

/**
 * Nodo Skia que dibuja la imagen revelada ocupando `width` × `height`.
 * Se usa tanto en la vista previa (dentro de un <Canvas>) como en la
 * exportación fuera de pantalla (drawAsImage).
 */
export function DevelopedImage({ image, adjustments, width, height, original }: Props) {
  const effect = getDevelopEffect();
  const { transform, scale } = imageTransform(
    image.width(),
    image.height(),
    adjustments.crop,
    width,
    height,
  );
  const tone = original ? { ...defaultAdjustments(), crop: adjustments.crop } : adjustments;
  const uniforms = buildUniforms(tone, width, height, scale);
  return (
    <Rect x={0} y={0} width={width} height={height}>
      <Shader source={effect} uniforms={uniforms}>
        <ImageShader
          image={image}
          tx="clamp"
          ty="clamp"
          transform={transform}
          sampling={{ filter: FilterMode.Linear, mipmap: MipmapMode.Linear }}
        />
      </Shader>
    </Rect>
  );
}

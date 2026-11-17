import { Canvas, Path, Skia } from '@shopify/react-native-skia';
import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import type { Analysis } from '../engine/render';

interface Props {
  data: Analysis | null;
  width?: number;
  height?: number;
}

const buildPath = (bins: number[], max: number, w: number, h: number) => {
  const p = Skia.PathBuilder.Make();
  const step = w / (bins.length - 1);
  p.moveTo(0, h);
  bins.forEach((v, i) => {
    const y = h - Math.min(1, v / max) * (h - 2);
    p.lineTo(i * step, y);
  });
  p.lineTo(w, h);
  p.close();
  return p.build();
};

export function Histogram({ data, width = 150, height = 64 }: Props) {
  const paths = useMemo(() => {
    if (!data) return null;
    return {
      r: buildPath(data.r, data.max, width, height),
      g: buildPath(data.g, data.max, width, height),
      b: buildPath(data.b, data.max, width, height),
    };
  }, [data, width, height]);
  return (
    <View style={[styles.box, { width, height }]}>
      {paths ? (
        <Canvas style={{ width, height }}>
          <Path path={paths.r} color="rgba(255,60,60,0.75)" blendMode="screen" />
          <Path path={paths.g} color="rgba(60,255,60,0.75)" blendMode="screen" />
          <Path path={paths.b} color="rgba(70,110,255,0.8)" blendMode="screen" />
        </Canvas>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 6,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.15)',
  },
});

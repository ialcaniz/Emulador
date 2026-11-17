import {
  Group,
  Image,
  Line,
  Path,
  Rect as SkRect,
  Skia,
  Text,
  type SkImage,
  type SkTypeface,
} from '@shopify/react-native-skia';
import React from 'react';
import type { Point, Rect, Shape } from './types';

const freehandPath = (points: Point[]) => {
  const b = Skia.PathBuilder.Make();
  if (points.length === 0) return b.build();
  b.moveTo(points[0].x, points[0].y);
  if (points.length === 1) {
    b.lineTo(points[0].x + 0.01, points[0].y);
  } else {
    // Suavizado: curvas cuadráticas por los puntos medios.
    for (let i = 1; i < points.length - 1; i++) {
      const mx = (points[i].x + points[i + 1].x) / 2;
      const my = (points[i].y + points[i + 1].y) / 2;
      b.quadTo(points[i].x, points[i].y, mx, my);
    }
    const last = points[points.length - 1];
    b.lineTo(last.x, last.y);
  }
  return b.build();
};

const arrowGeometry = (from: Point, to: Point, width: number) => {
  const angle = Math.atan2(to.y - from.y, to.x - from.x);
  const len = Math.hypot(to.x - from.x, to.y - from.y);
  const head = Math.min(len * 0.6, width * 3.5 + 8);
  const spread = Math.PI / 7;
  const left = {
    x: to.x - head * Math.cos(angle - spread),
    y: to.y - head * Math.sin(angle - spread),
  };
  const right = {
    x: to.x - head * Math.cos(angle + spread),
    y: to.y - head * Math.sin(angle + spread),
  };
  const b = Skia.PathBuilder.Make();
  b.moveTo(to.x, to.y);
  b.lineTo(left.x, left.y);
  b.lineTo(right.x, right.y);
  b.close();
  // La línea termina en la base de la punta para que no asome.
  const base = { x: to.x - head * 0.8 * Math.cos(angle), y: to.y - head * 0.8 * Math.sin(angle) };
  return { head: b.build(), lineEnd: base };
};

export function ShapeNode({ shape, typeface }: { shape: Shape; typeface: SkTypeface | null }) {
  switch (shape.kind) {
    case 'pen':
      return (
        <Path
          path={freehandPath(shape.points)}
          color={shape.color}
          style="stroke"
          strokeWidth={shape.width}
          strokeCap="round"
          strokeJoin="round"
        />
      );
    case 'marker':
      return (
        <Path
          path={freehandPath(shape.points)}
          color={shape.color}
          opacity={0.4}
          style="stroke"
          strokeWidth={shape.width * 4}
          strokeCap="round"
          strokeJoin="round"
        />
      );
    case 'line':
      return (
        <Line
          p1={shape.from}
          p2={shape.to}
          color={shape.color}
          style="stroke"
          strokeWidth={shape.width}
          strokeCap="round"
        />
      );
    case 'arrow': {
      const { head, lineEnd } = arrowGeometry(shape.from, shape.to, shape.width);
      return (
        <Group>
          <Line
            p1={shape.from}
            p2={lineEnd}
            color={shape.color}
            style="stroke"
            strokeWidth={shape.width}
            strokeCap="round"
          />
          <Path path={head} color={shape.color} style="fill" />
          <Path path={head} color={shape.color} style="stroke" strokeWidth={shape.width / 2} strokeJoin="round" />
        </Group>
      );
    }
    case 'rect': {
      const x = Math.min(shape.from.x, shape.to.x);
      const y = Math.min(shape.from.y, shape.to.y);
      return (
        <SkRect
          x={x}
          y={y}
          width={Math.abs(shape.to.x - shape.from.x)}
          height={Math.abs(shape.to.y - shape.from.y)}
          color={shape.color}
          style="stroke"
          strokeWidth={shape.width}
          strokeJoin="miter"
        />
      );
    }
    case 'text': {
      if (!typeface) return null;
      const font = Skia.Font(typeface, shape.size);
      const lines = shape.text.split('\n');
      return (
        <Group>
          {lines.map((line, i) => (
            <Text
              key={i}
              x={shape.at.x}
              y={shape.at.y + shape.size * (i + 1) * 1.15}
              font={font}
              text={line}
              color={shape.color}
            />
          ))}
        </Group>
      );
    }
  }
}

interface Props {
  image: SkImage;
  shapes: Shape[];
  /** Zona de la imagen que se muestra/exporta. */
  crop: Rect;
  /** Tamaño de salida en píxeles. */
  width: number;
  height: number;
  typeface: SkTypeface | null;
  /** Forma que se está dibujando ahora mismo. */
  draft?: Shape | null;
}

/** Dibuja la captura recortada con sus anotaciones, escalada a width × height. */
export function AnnotatedImage({ image, shapes, crop, width, height, typeface, draft }: Props) {
  const s = width / crop.width;
  return (
    <Group clip={{ x: 0, y: 0, width, height }}>
      <Group transform={[{ scale: s }, { translateX: -crop.x }, { translateY: -crop.y }]}>
        <Image image={image} x={0} y={0} width={image.width()} height={image.height()} fit="fill" />
        {shapes.map((sh) => (
          <ShapeNode key={sh.id} shape={sh} typeface={typeface} />
        ))}
        {draft ? <ShapeNode shape={draft} typeface={typeface} /> : null}
      </Group>
    </Group>
  );
}

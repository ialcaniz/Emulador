import { Skia } from '@shopify/react-native-skia';
import type { Adjustments } from '../types';

/**
 * Motor de revelado en GPU (SkSL). Recibe la imagen como shader hijo y aplica,
 * en orden: detalle (enfoque/textura/claridad), balance de blancos, exposición,
 * tono (blancos/negros/iluminaciones/sombras/contraste), neblina, mezcla HSL,
 * intensidad/saturación, gradación de color, viñeta y granulado.
 */
export const SKSL = `
uniform shader image;
uniform float2 uSize;
uniform float uPixel;
uniform float uExposure;
uniform float uContrast;
uniform float uHighlights;
uniform float uShadows;
uniform float uWhites;
uniform float uBlacks;
uniform float uTemp;
uniform float uTint;
uniform float uVibrance;
uniform float uSaturation;
uniform float4 uHueA;
uniform float4 uHueB;
uniform float4 uSatA;
uniform float4 uSatB;
uniform float4 uLumA;
uniform float4 uLumB;
uniform float3 uGradeShadow;
uniform float3 uGradeHighlight;
uniform float uGradeBalance;
uniform float uTexture;
uniform float uClarity;
uniform float uDehaze;
uniform float uVignette;
uniform float uGrain;
uniform float uSharpen;

float luma(float3 c) { return dot(c, float3(0.2126, 0.7152, 0.0722)); }
float3 toLin(float3 c) { return pow(max(c, float3(0.0)), float3(2.2)); }
float3 toGam(float3 c) { return pow(max(c, float3(0.0)), float3(1.0 / 2.2)); }

float3 rgb2hsv(float3 c) {
  float4 K = float4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
  float4 p = mix(float4(c.bg, K.wz), float4(c.gb, K.xy), step(c.b, c.g));
  float4 q = mix(float4(p.xyw, c.r), float4(c.r, p.yzx), step(p.x, c.r));
  float d = q.x - min(q.w, q.y);
  float e = 1.0e-6;
  return float3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
}

float3 hsv2rgb(float3 c) {
  float4 K = float4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
  float3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
  return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

float hash(float2 p) {
  return fract(sin(dot(p, float2(12.9898, 78.233))) * 43758.5453);
}

float3 blur4(float2 p, float r) {
  return (image.eval(p + float2(r, 0.0)).rgb + image.eval(p - float2(r, 0.0)).rgb +
          image.eval(p + float2(0.0, r)).rgb + image.eval(p - float2(0.0, r)).rgb) * 0.25;
}

float3 blur8(float2 p, float r) {
  float d = r * 0.7071;
  float3 s = image.eval(p + float2(r, 0.0)).rgb + image.eval(p - float2(r, 0.0)).rgb +
             image.eval(p + float2(0.0, r)).rgb + image.eval(p - float2(0.0, r)).rgb +
             image.eval(p + float2(d, d)).rgb + image.eval(p - float2(d, d)).rgb +
             image.eval(p + float2(d, -d)).rgb + image.eval(p + float2(-d, d)).rgb;
  return s * 0.125;
}

float hueW(float h, float center) {
  float d = abs(h - center);
  d = min(d, 1.0 - d);
  return clamp(1.0 - d / 0.125, 0.0, 1.0);
}

half4 main(float2 p) {
  float4 src = image.eval(p);
  float3 c = src.rgb;
  float minDim = min(uSize.x, uSize.y);

  // --- Detalle -------------------------------------------------------------
  // Los tres deltas se calculan sobre el original y se suman, para que no se
  // amplifiquen entre sí.
  float3 c0 = c;
  if (uSharpen > 0.001) {
    c += (c0 - blur4(p, uPixel)) * uSharpen * 1.2;
  }
  if (abs(uTexture) > 0.001) {
    float3 b = blur8(p, max(uPixel * 2.0, minDim * 0.0025));
    c += (c0 - b) * uTexture * 1.6;
  }
  if (abs(uClarity) > 0.001) {
    float r = minDim * 0.012;
    float3 b = (blur8(p, r) + blur8(p, r * 2.2)) * 0.5;
    float L0 = luma(c0);
    float mid = 1.0 - pow(abs(2.0 * L0 - 1.0), 2.0);
    c += float3(L0 - luma(b)) * uClarity * 1.4 * mid;
  }
  c = max(c, float3(0.0));

  // --- Balance de blancos y exposición (lineal) ----------------------------
  float3 lin = toLin(c);
  float3 wb = float3(1.0 + 0.32 * uTemp + 0.08 * uTint,
                     1.0 - 0.22 * uTint,
                     1.0 - 0.32 * uTemp + 0.08 * uTint);
  lin *= wb / luma(wb);
  lin *= exp2(uExposure);
  c = toGam(lin);

  // --- Tono ----------------------------------------------------------------
  float L = luma(c);
  float Ln = L;
  float wp = 1.0 - uWhites * 0.25;
  float bp = -uBlacks * 0.10;
  Ln = (Ln - bp) / (wp - bp);
  // Curvas en campana: las sombras afectan a los tonos bajos sin mover el negro
  // puro y las iluminaciones a los altos sin mover el blanco; lo que supera 1.0
  // (sobreexposición) se recupera con iluminaciones negativas.
  float xt = clamp(Ln, 0.0, 1.0);
  float over = max(Ln - 1.0, 0.0);
  Ln += uShadows * 1.5 * xt * pow(1.0 - xt, 3.0);
  Ln += uHighlights * 1.5 * pow(xt, 3.0) * (1.0 - xt);
  Ln -= over * max(-uHighlights, 0.0) * 0.8;
  if (uContrast >= 0.0) {
    float x = clamp(Ln, 0.0, 1.0);
    float s = x * x * (3.0 - 2.0 * x);
    s = mix(s, s * s * (3.0 - 2.0 * s), 0.5);
    Ln = mix(Ln, s + (Ln - x), uContrast);
  } else {
    Ln = mix(Ln, 0.5 + (Ln - 0.5) * 0.45, -uContrast);
  }
  if (abs(uDehaze) > 0.001) {
    float k = uDehaze * 0.12;
    Ln = (Ln - k) / (1.0 - k);
  }
  float t = smoothstep(0.0, 0.06, L);
  c = mix(c + float3(Ln - L), c * (Ln / max(L, 0.0001)), t);
  c = clamp(c, 0.0, 1.0);

  // --- Mezcla de color HSL -------------------------------------------------
  float3 hsv = rgb2hsv(c);
  float w0 = hueW(hsv.x, 0.0);
  float w1 = hueW(hsv.x, 30.0 / 360.0);
  float w2 = hueW(hsv.x, 60.0 / 360.0);
  float w3 = hueW(hsv.x, 120.0 / 360.0);
  float w4 = hueW(hsv.x, 180.0 / 360.0);
  float w5 = hueW(hsv.x, 240.0 / 360.0);
  float w6 = hueW(hsv.x, 270.0 / 360.0);
  float w7 = hueW(hsv.x, 300.0 / 360.0);
  float wsum = w0 + w1 + w2 + w3 + w4 + w5 + w6 + w7 + 0.0001;
  float4 wa = float4(w0, w1, w2, w3) / wsum;
  float4 wbv = float4(w4, w5, w6, w7) / wsum;
  float satMask = smoothstep(0.02, 0.25, hsv.y);
  float dh = (dot(wa, uHueA) + dot(wbv, uHueB)) * satMask;
  float ds = (dot(wa, uSatA) + dot(wbv, uSatB)) * satMask;
  float dl = (dot(wa, uLumA) + dot(wbv, uLumB)) * satMask;
  if (abs(dh) + abs(ds) + abs(dl) > 0.0001) {
    hsv.x = fract(hsv.x + dh * (30.0 / 360.0) + 1.0);
    hsv.y = clamp(hsv.y * (1.0 + ds), 0.0, 1.0);
    hsv.z = clamp(hsv.z * (1.0 + dl * 0.5), 0.0, 1.0);
    c = hsv2rgb(hsv);
  }

  // --- Intensidad y saturación --------------------------------------------
  float gray = luma(c);
  float sat = max(c.r, max(c.g, c.b)) - min(c.r, min(c.g, c.b));
  float vib = uVibrance * (1.0 - sat) * 1.2;
  c = mix(float3(gray), c, 1.0 + vib);
  c = mix(float3(gray), c, 1.0 + uSaturation + uDehaze * 0.25);
  c = clamp(c, 0.0, 1.0);

  // --- Gradación de color --------------------------------------------------
  float Lg = luma(c);
  float pivot = 0.5 - uGradeBalance * 0.3;
  float wsh = 1.0 - smoothstep(0.0, pivot + 0.35, Lg);
  float whi = smoothstep(pivot - 0.35, 1.0, Lg);
  c += uGradeShadow * wsh + uGradeHighlight * whi;

  // --- Viñeta --------------------------------------------------------------
  if (abs(uVignette) > 0.001) {
    float2 uv = p / uSize - 0.5;
    float d = length(uv * 2.0) / 1.41421;
    float v = smoothstep(0.3, 1.0, d);
    if (uVignette < 0.0) {
      c *= 1.0 + uVignette * v * 0.95;
    } else {
      c = mix(c, float3(1.0), uVignette * v * 0.85);
    }
  }

  // --- Granulado -----------------------------------------------------------
  if (uGrain > 0.001) {
    float2 cell = floor(p / max(1.0, uPixel * 1.6));
    float n = hash(cell) + hash(cell + float2(17.0, 31.0)) - 1.0;
    float Lq = luma(c);
    c += float3(n * uGrain * 0.16 * (1.0 - abs(Lq * 2.0 - 1.0) * 0.6));
  }

  c = clamp(c, 0.0, 1.0);
  return half4(half3(c * src.a), half(src.a));
}
`;

let cached: ReturnType<typeof Skia.RuntimeEffect.Make> | undefined;

export const getDevelopEffect = () => {
  if (!cached) {
    cached = Skia.RuntimeEffect.Make(SKSL);
    if (!cached) {
      throw new Error('No se pudo compilar el shader de revelado');
    }
  }
  return cached;
};

/** Color de un tono (0..360) al 100 % de saturación, sin luminancia. */
const hueOffset = (hueDeg: number, amount: number): [number, number, number] => {
  const h = (((hueDeg % 360) + 360) % 360) / 60;
  const x = 1 - Math.abs((h % 2) - 1);
  const [r, g, b] =
    h < 1 ? [1, x, 0] : h < 2 ? [x, 1, 0] : h < 3 ? [0, 1, x] : h < 4 ? [0, x, 1] : h < 5 ? [x, 0, 1] : [1, 0, x];
  const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const k = amount * 0.22;
  return [(r - l) * k, (g - l) * k, (b - l) * k];
};

const v4 = (arr: number[], from: number) => [
  arr[from] / 100,
  arr[from + 1] / 100,
  arr[from + 2] / 100,
  arr[from + 3] / 100,
];

/**
 * Construye los uniforms del shader.
 * @param width,height tamaño del lienzo en píxeles
 * @param pixel tamaño de un píxel de la imagen en el lienzo (para enfoque/granulado)
 */
export const buildUniforms = (a: Adjustments, width: number, height: number, pixel: number) => ({
  uSize: [width, height],
  uPixel: Math.max(0.5, pixel),
  uExposure: a.exposure,
  uContrast: a.contrast / 100,
  uHighlights: a.highlights / 100,
  uShadows: a.shadows / 100,
  uWhites: a.whites / 100,
  uBlacks: a.blacks / 100,
  uTemp: a.temp / 100,
  uTint: a.tint / 100,
  uVibrance: a.vibrance / 100,
  uSaturation: a.saturation / 100,
  uHueA: v4(a.hsl.hue, 0),
  uHueB: v4(a.hsl.hue, 4),
  uSatA: v4(a.hsl.sat, 0),
  uSatB: v4(a.hsl.sat, 4),
  uLumA: v4(a.hsl.lum, 0),
  uLumB: v4(a.hsl.lum, 4),
  uGradeShadow: hueOffset(a.gradeShadowHue, a.gradeShadowSat / 100),
  uGradeHighlight: hueOffset(a.gradeHighlightHue, a.gradeHighlightSat / 100),
  uGradeBalance: a.gradeBalance / 100,
  uTexture: a.texture / 100,
  uClarity: a.clarity / 100,
  uDehaze: a.dehaze / 100,
  uVignette: a.vignette / 100,
  uGrain: a.grain / 100,
  uSharpen: a.sharpen / 100,
});

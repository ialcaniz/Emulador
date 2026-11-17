import { drawAsImage, ImageFormat, Skia, type SkImage, type SkTypeface } from '@shopify/react-native-skia';
import * as Clipboard from 'expo-clipboard';
import { File, Paths } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { Album, Asset, AssetField, Query, requestPermissionsAsync } from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import React from 'react';
import { Platform } from 'react-native';
import { AnnotatedImage } from './AnnotatedImage';
import type { Rect, Shape } from './types';

export const SAVE_ALBUM = 'Capturas anotadas';

/** Carga una imagen como SkImage. Si la URI no se puede leer directamente, la copia antes a la caché. */
export const loadImage = async (uri: string): Promise<SkImage> => {
  const decode = async (u: string) => {
    const img = Skia.Image.MakeImageFromEncoded(await Skia.Data.fromURI(u));
    if (!img) throw new Error('Formato de imagen no compatible');
    return img;
  };
  try {
    return await decode(uri);
  } catch (e) {
    if (Platform.OS === 'web') throw e;
    const tmp = new File(Paths.cache, `entrada_${Date.now()}`);
    await new File(uri).copy(tmp);
    try {
      return await decode(tmp.uri);
    } finally {
      tmp.delete();
    }
  }
};

export const pickImage = async (): Promise<string | null> => {
  const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
  if (r.canceled || r.assets.length === 0) return null;
  return r.assets[0].uri;
};

/** Devuelve la URI de la captura de pantalla más reciente del móvil. */
export const latestScreenshot = async (): Promise<string | null> => {
  const perm = await requestPermissionsAsync(false, ['photo']);
  if (!perm.granted) throw new Error('Sin permiso para leer tus fotos.');
  const albums = await Album.getAll();
  const shots: Album[] = [];
  for (const a of albums) {
    const title = (await a.getTitle()).toLowerCase();
    if (title.includes('screenshot') || title.includes('captura')) shots.push(a);
  }
  let best: { asset: Asset; time: number } | null = null;
  for (const a of shots) {
    const [asset] = await new Query()
      .album(a)
      .orderBy({ key: AssetField.CREATION_TIME, ascending: false })
      .limit(1)
      .exe();
    if (!asset) continue;
    const time = (await asset.getCreationTime()) ?? 0;
    if (!best || time > best.time) best = { asset, time };
  }
  return best ? best.asset.getUri() : null;
};

/** Renderiza la captura anotada a resolución completa (tamaño de la zona recortada). */
export const renderFinal = async (
  image: SkImage,
  shapes: Shape[],
  crop: Rect,
  typeface: SkTypeface | null,
): Promise<SkImage> => {
  const width = Math.max(1, Math.round(crop.width));
  const height = Math.max(1, Math.round(crop.height));
  const out = await drawAsImage(
    <AnnotatedImage image={image} shapes={shapes} crop={crop} width={width} height={height} typeface={typeface} />,
    { width, height },
  );
  if (!out) throw new Error('No se pudo generar la imagen');
  return out;
};

const writeTemp = async (img: SkImage) => {
  const f = new File(Paths.cache, `captura_${Date.now()}.png`);
  f.create({ overwrite: true });
  await f.write(img.encodeToBytes(ImageFormat.PNG, 100));
  return f;
};

export const saveToGallery = async (img: SkImage) => {
  const perm = await requestPermissionsAsync(true);
  if (!perm.granted) throw new Error('Concede permiso para guardar en la galería.');
  const f = await writeTemp(img);
  try {
    const asset = await Asset.create(f.uri);
    try {
      const album = await Album.get(SAVE_ALBUM);
      if (album) await album.add(asset);
      else await Album.create(SAVE_ALBUM, [asset]);
    } catch {
      // Si no se puede crear el álbum, la imagen ya está en la galería.
    }
  } finally {
    f.delete();
  }
};

export const shareImage = async (img: SkImage) => {
  if (!(await Sharing.isAvailableAsync())) throw new Error('Compartir no está disponible en este dispositivo.');
  const f = await writeTemp(img);
  await Sharing.shareAsync(f.uri, { mimeType: 'image/png', dialogTitle: 'Compartir captura' });
};

export const copyImage = async (img: SkImage) => {
  await Clipboard.setImageAsync(img.encodeToBase64(ImageFormat.PNG, 100));
};

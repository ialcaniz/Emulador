import { Directory, File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';
import type { Photo } from '../types';
import { normalizeAdjustments } from './adjustments';

const photosDir = () => new Directory(Paths.document, 'photos');
const thumbsDir = () => new Directory(Paths.document, 'thumbs');
const libraryFile = () => new File(Paths.document, 'library.json');

const ensureDir = (d: Directory) => {
  if (!d.exists) d.create({ intermediates: true, idempotent: true });
};

export const newId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

// La versión web solo sirve para previsualizar la interfaz: no persiste nada.
const isWeb = Platform.OS === 'web';

const toDataUri = (bytes: Uint8Array) => {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return `data:image/jpeg;base64,${btoa(bin)}`;
};

export const loadLibrary = async (): Promise<Photo[]> => {
  if (isWeb) return [];
  try {
    const f = libraryFile();
    if (!f.exists) return [];
    const raw = JSON.parse(await f.text()) as Photo[];
    return raw
      .filter((p) => new File(p.uri).exists)
      .map((p) => ({
        ...p,
        rating: p.rating ?? 0,
        flagged: p.flagged ?? false,
        adjustments: normalizeAdjustments(p.adjustments),
      }));
  } catch (e) {
    console.warn('No se pudo leer la biblioteca', e);
    return [];
  }
};

export const saveLibrary = async (photos: Photo[]) => {
  if (isWeb) return;
  try {
    const f = libraryFile();
    if (!f.exists) f.create();
    await f.write(JSON.stringify(photos));
  } catch (e) {
    console.warn('No se pudo guardar la biblioteca', e);
  }
};

const extensionOf = (uri: string) => {
  const m = /\.([a-zA-Z0-9]{2,5})(?:\?|$)/.exec(uri);
  return m ? m[1].toLowerCase() : 'jpg';
};

/** Copia una imagen seleccionada al almacenamiento privado de la app. */
export const importImage = async (uri: string, id: string): Promise<string> => {
  if (isWeb) return uri;
  const dir = photosDir();
  ensureDir(dir);
  const dest = new File(dir, `${id}.${extensionOf(uri)}`);
  await new File(uri).copy(dest);
  return dest.uri;
};

export const writeThumbnail = async (id: string, bytes: Uint8Array): Promise<string> => {
  if (isWeb) return toDataUri(bytes);
  const dir = thumbsDir();
  ensureDir(dir);
  // Nombre único para evitar la caché de imágenes de React Native.
  for (const f of dir.list()) {
    if (f instanceof File && f.name.startsWith(`${id}_`)) f.delete();
  }
  const dest = new File(dir, `${id}_${Date.now()}.jpg`);
  dest.create({ overwrite: true });
  await dest.write(bytes);
  return dest.uri;
};

export const deletePhotoFiles = (photo: Photo) => {
  if (isWeb) return;
  for (const uri of [photo.uri, photo.thumbUri]) {
    if (!uri) continue;
    try {
      const f = new File(uri);
      if (f.exists) f.delete();
    } catch {
      // ignorar
    }
  }
};

export const writeExport = async (bytes: Uint8Array, ext: 'jpg' | 'png'): Promise<File> => {
  const f = new File(Paths.cache, `Revela_${Date.now()}.${ext}`);
  f.create({ overwrite: true });
  await f.write(bytes);
  return f;
};

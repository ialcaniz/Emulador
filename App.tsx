import * as ImagePicker from 'expo-image-picker';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { cloneAdjustments, defaultAdjustments, isEdited } from './src/engine/adjustments';
import { downscale, encode, loadSkImage, renderDeveloped } from './src/engine/render';
import {
  deletePhotoFiles,
  importImage,
  loadLibrary,
  newId,
  saveLibrary,
  writeThumbnail,
} from './src/engine/storage';
import { EditorScreen } from './src/screens/EditorScreen';
import { LibraryScreen } from './src/screens/LibraryScreen';
import type { Adjustments, Photo } from './src/types';

export default function App() {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Photo | null>(null);
  const [clipboard, setClipboard] = useState<Adjustments | null>(null);
  const loaded = useRef(false);

  useEffect(() => {
    loadLibrary().then((p) => {
      setPhotos(p);
      setLoading(false);
      loaded.current = true;
    });
  }, []);

  useEffect(() => {
    if (loaded.current) void saveLibrary(photos);
  }, [photos]);

  const upsert = useCallback((photo: Photo) => {
    setPhotos((list) => list.map((p) => (p.id === photo.id ? photo : p)));
  }, []);

  const onImport = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      quality: 1,
      exif: false,
    });
    if (result.canceled) return;
    const added: Photo[] = [];
    for (const asset of result.assets) {
      try {
        const id = newId();
        const uri = await importImage(asset.uri, id);
        added.push({
          id,
          uri,
          width: asset.width,
          height: asset.height,
          createdAt: Date.now() + added.length,
          edited: false,
          rating: 0,
          flagged: false,
          adjustments: defaultAdjustments(),
        });
      } catch (e) {
        console.warn('Importación fallida', e);
      }
    }
    if (added.length === 0) {
      Alert.alert('No se pudo importar', 'Ninguna de las imágenes seleccionadas se pudo copiar.');
      return;
    }
    setPhotos((list) => [...added, ...list]);
    if (added.length === 1) setEditing(added[0]);
  };

  const onPaste = async (photo: Photo) => {
    if (!clipboard) return;
    const adjustments = { ...cloneAdjustments(clipboard), crop: { ...photo.adjustments.crop } };
    let thumbUri = photo.thumbUri;
    try {
      const img = downscale(await loadSkImage(photo.uri), 1200);
      const out = await renderDeveloped(img, adjustments, 480);
      if (out) thumbUri = await writeThumbnail(photo.id, encode(out, 'jpg', 85));
    } catch (e) {
      console.warn('Miniatura', e);
    }
    upsert({ ...photo, adjustments, edited: isEdited(adjustments), thumbUri });
  };

  const onDelete = (photo: Photo) => {
    deletePhotoFiles(photo);
    setPhotos((list) => list.filter((p) => p.id !== photo.id));
  };

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      {editing ? (
        <EditorScreen
          key={editing.id}
          photo={editing}
          clipboard={clipboard}
          onCopy={setClipboard}
          onSave={upsert}
          onClose={() => setEditing(null)}
        />
      ) : (
        <LibraryScreen
          photos={photos}
          loading={loading}
          clipboard={clipboard}
          onImport={onImport}
          onOpen={setEditing}
          onUpdate={upsert}
          onPaste={onPaste}
          onDelete={onDelete}
        />
      )}
    </SafeAreaProvider>
  );
}

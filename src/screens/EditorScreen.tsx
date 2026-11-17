import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Canvas, type SkImage } from '@shopify/react-native-skia';
import { Album, Asset, requestPermissionsAsync } from 'expo-media-library';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  type LayoutChangeEvent,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Histogram } from '../components/Histogram';
import {
  ColorPanel,
  CropPanel,
  DetailPanel,
  EffectsPanel,
  LightPanel,
  PresetsPanel,
  type Updater,
} from '../components/Panels';
import {
  autoAdjust,
  cloneAdjustments,
  defaultAdjustments,
  isEdited,
  resetTone,
} from '../engine/adjustments';
import { DevelopedImage } from '../engine/DevelopedImage';
import { cropSize, fitInside } from '../engine/geometry';
import { analyze, downscale, encode, loadSkImage, renderDeveloped, type Analysis } from '../engine/render';
import { writeExport, writeThumbnail } from '../engine/storage';
import { colors } from '../theme';
import type { Adjustments, Photo } from '../types';

type Tool = 'presets' | 'crop' | 'light' | 'color' | 'effects' | 'detail';

const TOOLS: { key: Tool | 'auto'; label: string; icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'] }[] = [
  { key: 'presets', label: 'Predefinidos', icon: 'palette-swatch-outline' },
  { key: 'crop', label: 'Recortar', icon: 'crop-rotate' },
  { key: 'auto', label: 'Auto', icon: 'auto-fix' },
  { key: 'light', label: 'Luz', icon: 'white-balance-sunny' },
  { key: 'color', label: 'Color', icon: 'thermometer' },
  { key: 'effects', label: 'Efectos', icon: 'blur' },
  { key: 'detail', label: 'Detalle', icon: 'triangle-outline' },
];

const PREVIEW_MAX = 1600;
const EXPORT_MAX = 4096;
const ALBUM = 'Revela';

interface Props {
  photo: Photo;
  clipboard: Adjustments | null;
  onCopy: (a: Adjustments) => void;
  onSave: (photo: Photo) => void;
  onClose: () => void;
}

export function EditorScreen({ photo, clipboard, onCopy, onSave, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const [full, setFull] = useState<SkImage | null>(null);
  const [preview, setPreview] = useState<SkImage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adj, setAdj] = useState<Adjustments>(() => cloneAdjustments(photo.adjustments));
  const [tool, setTool] = useState<Tool>('light');
  const [showOriginal, setShowOriginal] = useState(false);
  const [showHistogram, setShowHistogram] = useState(true);
  const [hist, setHist] = useState<Analysis | null>(null);
  const [area, setArea] = useState({ width: 0, height: 0 });
  const [menuOpen, setMenuOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const adjRef = useRef(adj);

  // Carga de la imagen ------------------------------------------------------
  useEffect(() => {
    let alive = true;
    loadSkImage(photo.uri)
      .then((img) => {
        if (!alive) return;
        setFull(img);
        setPreview(downscale(img, PREVIEW_MAX));
      })
      .catch((e) => alive && setError(String(e?.message ?? e)));
    return () => {
      alive = false;
    };
  }, [photo.uri]);

  // Historial ---------------------------------------------------------------
  const histRef = useRef({ list: [cloneAdjustments(photo.adjustments)], cursor: 0 });
  const [hstate, setHstate] = useState(histRef.current);
  const cursor = hstate.cursor;
  const historyLength = hstate.list.length;

  const update: Updater = useCallback((fn, commit) => {
    const next = fn(adjRef.current);
    adjRef.current = next;
    setAdj(next);
    if (commit) {
      const h = histRef.current;
      const base = h.list.slice(0, h.cursor + 1);
      if (JSON.stringify(base[base.length - 1]) !== JSON.stringify(next)) {
        const list = [...base, cloneAdjustments(next)].slice(-80);
        histRef.current = { list, cursor: list.length - 1 };
        setHstate(histRef.current);
      }
    }
  }, []);

  const jump = (to: number) => {
    const h = histRef.current;
    if (to < 0 || to >= h.list.length) return;
    histRef.current = { ...h, cursor: to };
    setHstate(histRef.current);
    const a = cloneAdjustments(h.list[to]);
    adjRef.current = a;
    setAdj(a);
  };
  const undo = () => jump(histRef.current.cursor - 1);
  const redo = () => jump(histRef.current.cursor + 1);

  // Histograma (con retardo para no recalcular en cada movimiento) -----------
  useEffect(() => {
    if (!preview || !showHistogram) return;
    const t = setTimeout(() => {
      analyze(preview, adj, showOriginal)
        .then(setHist)
        .catch(() => setHist(null));
    }, 160);
    return () => clearTimeout(t);
  }, [preview, adj, showHistogram, showOriginal]);

  // Guardar y salir ---------------------------------------------------------
  const saveAndClose = useCallback(async () => {
    const current = adjRef.current;
    const edited = isEdited(current);
    let thumbUri = photo.thumbUri;
    if (preview && JSON.stringify(current) !== JSON.stringify(photo.adjustments)) {
      try {
        const img = await renderDeveloped(preview, current, 480);
        if (img) thumbUri = await writeThumbnail(photo.id, encode(img, 'jpg', 85));
      } catch (e) {
        console.warn('Miniatura', e);
      }
    }
    onSave({ ...photo, adjustments: cloneAdjustments(current), edited, thumbUri: edited ? thumbUri : undefined });
    onClose();
  }, [photo, preview, onSave, onClose]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      void saveAndClose();
      return true;
    });
    return () => sub.remove();
  }, [saveAndClose]);

  // Herramientas ------------------------------------------------------------
  const runAuto = async () => {
    if (!preview) return;
    setBusy('Analizando…');
    try {
      const stats = await analyze(preview, adj, true);
      if (stats) update((a) => autoAdjust(a, stats), true);
    } finally {
      setBusy(null);
    }
  };

  const doExport = async (format: 'jpg' | 'png', maxSide: number) => {
    setExportOpen(false);
    if (!full) return;
    setBusy('Exportando…');
    try {
      const perm = await requestPermissionsAsync(true);
      if (!perm.granted) {
        Alert.alert('Permiso necesario', 'Concede acceso a la galería para guardar la foto.');
        return;
      }
      let img: SkImage | null = null;
      try {
        img = await renderDeveloped(full, adj, maxSide);
      } catch {
        img = null;
      }
      if (!img) img = await renderDeveloped(full, adj, 2048);
      if (!img) throw new Error('No se pudo renderizar la imagen');
      const file = await writeExport(encode(img, format, 92), format);
      const asset = await Asset.create(file.uri);
      try {
        const album = await Album.get(ALBUM);
        if (album) await album.add(asset);
        else await Album.create(ALBUM, [asset]);
      } catch {
        // El álbum es opcional: la foto ya está en la galería.
      }
      file.delete();
      Alert.alert('Exportada', `Guardada en la galería (${img.width()}×${img.height()}).`);
    } catch (e: unknown) {
      Alert.alert('Error al exportar', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  // Disposición de la imagen ------------------------------------------------
  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setArea({ width, height });
  };
  const canvasSize = useMemo(() => {
    if (!preview || area.width === 0) return null;
    const s = cropSize(preview.width(), preview.height(), adj.crop);
    return fitInside(s.width, s.height, area.width - 16, area.height - 16);
  }, [preview, area, adj.crop]);

  const panel = (() => {
    const p = { adj, update };
    switch (tool) {
      case 'presets':
        return <PresetsPanel {...p} preview={preview} />;
      case 'crop':
        return <CropPanel {...p} />;
      case 'light':
        return <LightPanel {...p} />;
      case 'color':
        return <ColorPanel {...p} />;
      case 'effects':
        return <EffectsPanel {...p} />;
      case 'detail':
        return <DetailPanel {...p} />;
    }
  })();

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Barra superior */}
      <View style={styles.topBar}>
        <Pressable onPress={saveAndClose} hitSlop={10} style={styles.topBtn}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </Pressable>
        <View style={styles.topCenter}>
          <Pressable onPress={undo} disabled={cursor <= 0} hitSlop={8} style={styles.topBtn}>
            <MaterialCommunityIcons name="undo" size={22} color={cursor > 0 ? colors.text : colors.textMuted} />
          </Pressable>
          <Pressable onPress={redo} disabled={cursor >= historyLength - 1} hitSlop={8} style={styles.topBtn}>
            <MaterialCommunityIcons
              name="redo"
              size={22}
              color={cursor < historyLength - 1 ? colors.text : colors.textMuted}
            />
          </Pressable>
        </View>
        <Pressable onPress={() => setShowHistogram((v) => !v)} hitSlop={8} style={styles.topBtn}>
          <MaterialCommunityIcons
            name="chart-bell-curve"
            size={22}
            color={showHistogram ? colors.accent : colors.text}
          />
        </Pressable>
        <Pressable onPress={() => setExportOpen(true)} hitSlop={8} style={styles.topBtn}>
          <MaterialCommunityIcons name="export-variant" size={22} color={colors.text} />
        </Pressable>
        <Pressable onPress={() => setMenuOpen(true)} hitSlop={8} style={styles.topBtn}>
          <Ionicons name="ellipsis-vertical" size={20} color={colors.text} />
        </Pressable>
      </View>

      {/* Imagen */}
      <Pressable
        style={styles.imageArea}
        onLayout={onLayout}
        delayLongPress={180}
        onLongPress={() => setShowOriginal(true)}
        onPressOut={() => setShowOriginal(false)}
      >
        {error ? (
          <Text style={styles.error}>No se pudo abrir la imagen: {error}</Text>
        ) : preview && canvasSize ? (
          <Canvas style={canvasSize}>
            <DevelopedImage
              image={preview}
              adjustments={adj}
              width={canvasSize.width}
              height={canvasSize.height}
              original={showOriginal}
            />
          </Canvas>
        ) : (
          <ActivityIndicator color={colors.text} />
        )}
        {showHistogram && hist ? (
          <View style={styles.histogram} pointerEvents="none">
            <Histogram data={hist} />
          </View>
        ) : null}
        {showOriginal ? (
          <View style={styles.badge} pointerEvents="none">
            <Text style={styles.badgeText}>Original</Text>
          </View>
        ) : null}
        {busy ? (
          <View style={styles.busy} pointerEvents="none">
            <ActivityIndicator color="#fff" />
            <Text style={styles.busyText}>{busy}</Text>
          </View>
        ) : null}
      </Pressable>

      {/* Panel de ajustes */}
      <View style={styles.panel}>
        <ScrollView style={styles.panelScroll} contentContainerStyle={{ paddingBottom: 8 }}>
          {panel}
        </ScrollView>
      </View>

      {/* Barra de herramientas */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={[styles.toolBar, { paddingBottom: insets.bottom }]}
        contentContainerStyle={styles.toolBarContent}
      >
        {TOOLS.map((t) => {
          const active = t.key === tool;
          return (
            <Pressable
              key={t.key}
              style={styles.tool}
              onPress={() => (t.key === 'auto' ? runAuto() : setTool(t.key))}
            >
              <MaterialCommunityIcons name={t.icon} size={24} color={active ? colors.accent : colors.text} />
              <Text style={[styles.toolText, active && { color: colors.accent }]}>{t.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Menú */}
      <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setMenuOpen(false)}>
          <View style={[styles.menu, { top: insets.top + 48 }]}>
            <MenuItem
              icon="content-copy"
              label="Copiar ajustes"
              onPress={() => {
                onCopy(cloneAdjustments(adj));
                setMenuOpen(false);
              }}
            />
            <MenuItem
              icon="content-paste"
              label="Pegar ajustes"
              disabled={!clipboard}
              onPress={() => {
                if (clipboard) update((a) => ({ ...cloneAdjustments(clipboard), crop: { ...a.crop } }), true);
                setMenuOpen(false);
              }}
            />
            <MenuItem
              icon="restore"
              label="Restablecer ajustes"
              onPress={() => {
                update((a) => resetTone(a), true);
                setMenuOpen(false);
              }}
            />
            <MenuItem
              icon="backup-restore"
              label="Restablecer todo"
              onPress={() => {
                update(() => defaultAdjustments(), true);
                setMenuOpen(false);
              }}
            />
          </View>
        </Pressable>
      </Modal>

      {/* Exportación */}
      <Modal visible={exportOpen} transparent animationType="slide" onRequestClose={() => setExportOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setExportOpen(false)}>
          <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
            <Text style={styles.sheetTitle}>Guardar en el dispositivo</Text>
            <MenuItem icon="image" label="JPG · tamaño completo" onPress={() => doExport('jpg', EXPORT_MAX)} />
            <MenuItem icon="image-size-select-large" label="JPG · 2048 px" onPress={() => doExport('jpg', 2048)} />
            <MenuItem icon="file-image" label="PNG · tamaño completo" onPress={() => doExport('png', EXPORT_MAX)} />
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

function MenuItem({
  icon,
  label,
  onPress,
  disabled,
}: {
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable onPress={onPress} disabled={disabled} style={({ pressed }) => [styles.menuItem, pressed && { backgroundColor: '#333' }]}>
      <MaterialCommunityIcons name={icon} size={20} color={disabled ? colors.textMuted : colors.text} />
      <Text style={[styles.menuText, disabled && { color: colors.textMuted }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  topBar: { height: 48, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6 },
  topCenter: { flex: 1, flexDirection: 'row', justifyContent: 'center', gap: 8 },
  topBtn: { padding: 8 },
  imageArea: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0c0c0c' },
  error: { color: colors.danger, padding: 24, textAlign: 'center' },
  histogram: { position: 'absolute', top: 10, left: 10 },
  badge: {
    position: 'absolute',
    top: 10,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: { color: '#fff', fontSize: 12 },
  busy: {
    position: 'absolute',
    backgroundColor: 'rgba(0,0,0,0.7)',
    padding: 16,
    borderRadius: 10,
    alignItems: 'center',
  },
  busyText: { color: '#fff', marginTop: 8, fontSize: 13 },
  panel: { height: 250, backgroundColor: colors.panel, borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  panelScroll: { flex: 1 },
  toolBar: { flexGrow: 0, backgroundColor: colors.panel, borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  toolBarContent: { paddingHorizontal: 8, paddingVertical: 8 },
  tool: { alignItems: 'center', width: 78, paddingVertical: 2 },
  toolText: { color: colors.textDim, fontSize: 11, marginTop: 4 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  menu: {
    position: 'absolute',
    right: 10,
    backgroundColor: colors.panelAlt,
    borderRadius: 10,
    paddingVertical: 6,
    minWidth: 220,
    elevation: 8,
  },
  menuItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 14 },
  menuText: { color: colors.text, fontSize: 15 },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.panelAlt,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingTop: 16,
  },
  sheetTitle: { color: colors.text, fontSize: 16, fontWeight: '600', paddingHorizontal: 16, paddingBottom: 8 },
});

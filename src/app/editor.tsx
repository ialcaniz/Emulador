import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Canvas, Group, Rect as SkRect, useTypeface, type SkImage } from '@shopify/react-native-skia';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  KeyboardAvoidingView,
  type LayoutChangeEvent,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AnnotatedImage } from '../annotate/AnnotatedImage';
import { copyImage, loadImage, renderFinal, SAVE_ALBUM, saveToGallery, shareImage } from '../annotate/io';
import {
  COLORS,
  normalizeRect,
  type Point,
  type Rect,
  type Shape,
  SIZES,
  sizeUnit,
  type Tool,
} from '../annotate/types';
import { colors } from '../theme';

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

const TOOLS: { key: Tool; label: string; icon: IconName }[] = [
  { key: 'select', label: 'Zona', icon: 'selection-drag' },
  { key: 'pen', label: 'Lápiz', icon: 'pencil' },
  { key: 'line', label: 'Línea', icon: 'vector-line' },
  { key: 'arrow', label: 'Flecha', icon: 'arrow-top-right' },
  { key: 'rect', label: 'Recuadro', icon: 'rectangle-outline' },
  { key: 'marker', label: 'Marcador', icon: 'marker' },
  { key: 'text', label: 'Texto', icon: 'format-text' },
];

const newId = () => Math.random().toString(36).slice(2, 10);

export default function EditorScreen() {
  const { uri } = useLocalSearchParams<{ uri: string }>();
  const insets = useSafeAreaInsets();
  const typeface = useTypeface(require('../../assets/fonts/Roboto_500Medium.ttf'));

  const [image, setImage] = useState<SkImage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [shapes, setShapes] = useState<Shape[]>([]);
  const [redo, setRedo] = useState<Shape[]>([]);
  const [crop, setCrop] = useState<Rect | null>(null);
  const [tool, setTool] = useState<Tool>('rect');
  const [color, setColor] = useState(COLORS[0]);
  const [sizeKey, setSizeKey] = useState(1);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [draft, setDraft] = useState<Shape | null>(null);
  const [selection, setSelection] = useState<Rect | null>(null);
  const [textAt, setTextAt] = useState<Point | null>(null);
  const [textValue, setTextValue] = useState('');
  const [area, setArea] = useState({ width: 0, height: 0 });
  const [busy, setBusy] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!uri) return;
    loadImage(uri)
      .then((img) => {
        setImage(img);
        setCrop({ x: 0, y: 0, width: img.width(), height: img.height() });
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, [uri]);

  const full = useMemo<Rect | null>(
    () => (image ? { x: 0, y: 0, width: image.width(), height: image.height() } : null),
    [image],
  );
  // En modo «Zona» se ve la imagen entera para poder elegir el recorte.
  const viewCrop = tool === 'select' ? full : crop;

  const display = useMemo(() => {
    if (!viewCrop || area.width === 0) return null;
    const k = Math.min((area.width - 16) / viewCrop.width, (area.height - 16) / viewCrop.height);
    return { width: Math.floor(viewCrop.width * k), height: Math.floor(viewCrop.height * k), scale: k };
  }, [viewCrop, area]);

  const unit = image ? sizeUnit(image.width(), image.height()) : 1;
  const size = SIZES[sizeKey];

  // Refs para el gestor de gestos (se crea una vez).
  const st = useRef({ tool, color, size, unit, display, viewCrop, draft: null as Shape | null, start: null as Point | null });
  st.current = { ...st.current, tool, color, size, unit, display, viewCrop };

  const toImage = (x: number, y: number): Point => {
    const { display: d, viewCrop: v } = st.current;
    if (!d || !v) return { x: 0, y: 0 };
    return { x: v.x + x / d.scale, y: v.y + y / d.scale };
  };

  const commitShape = useCallback((s: Shape) => {
    setShapes((list) => [...list, s]);
    setRedo([]);
    setDirty(true);
  }, []);

  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: (e) => {
          const p = toImage(e.nativeEvent.locationX, e.nativeEvent.locationY);
          const s = st.current;
          s.start = p;
          const width = s.size.stroke * s.unit;
          switch (s.tool) {
            case 'pen':
            case 'marker':
              s.draft = { id: newId(), kind: s.tool, color: s.color, width, points: [p] };
              break;
            case 'line':
            case 'arrow':
            case 'rect':
              s.draft = { id: newId(), kind: s.tool, color: s.color, width, from: p, to: p };
              break;
            case 'select':
              s.draft = null;
              setSelection({ x: p.x, y: p.y, width: 0, height: 0 });
              return;
            default:
              s.draft = null;
          }
          setDraft(s.draft);
        },
        onPanResponderMove: (e) => {
          const p = toImage(e.nativeEvent.locationX, e.nativeEvent.locationY);
          const s = st.current;
          if (s.tool === 'select' && s.start) {
            setSelection(normalizeRect(s.start, p));
            return;
          }
          const d = s.draft;
          if (!d) return;
          if (d.kind === 'pen' || d.kind === 'marker') {
            const last = d.points[d.points.length - 1];
            if (Math.hypot(p.x - last.x, p.y - last.y) < s.unit * 1.5) return;
            s.draft = { ...d, points: [...d.points, p] };
          } else if (d.kind === 'line' || d.kind === 'arrow' || d.kind === 'rect') {
            s.draft = { ...d, to: p };
          }
          setDraft(s.draft);
        },
        onPanResponderRelease: (e) => {
          const s = st.current;
          if (s.tool === 'text') {
            setTextAt(toImage(e.nativeEvent.locationX, e.nativeEvent.locationY));
            setTextValue('');
            return;
          }
          const d = s.draft;
          s.draft = null;
          setDraft(null);
          if (!d) return;
          if (d.kind === 'line' || d.kind === 'arrow' || d.kind === 'rect') {
            if (Math.hypot(d.to.x - d.from.x, d.to.y - d.from.y) < s.unit * 3) return;
          }
          commitShape(d);
        },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // Acciones -----------------------------------------------------------------
  const undo = () => {
    if (shapes.length === 0) return;
    setRedo((r) => [...r, shapes[shapes.length - 1]]);
    setShapes((s) => s.slice(0, -1));
  };
  const redoLast = () => {
    if (redo.length === 0) return;
    setShapes((s) => [...s, redo[redo.length - 1]]);
    setRedo((r) => r.slice(0, -1));
  };

  const addText = () => {
    const text = textValue.trim();
    if (textAt && text) {
      commitShape({
        id: newId(),
        kind: 'text',
        color,
        width: 0,
        at: textAt,
        text,
        size: size.text * unit,
      });
    }
    setTextAt(null);
  };

  const applySelection = () => {
    if (selection && full && selection.width > 8 && selection.height > 8) {
      // Ajustar a los límites de la imagen.
      const x = Math.max(0, selection.x);
      const y = Math.max(0, selection.y);
      setCrop({
        x,
        y,
        width: Math.min(full.width, selection.x + selection.width) - x,
        height: Math.min(full.height, selection.y + selection.height) - y,
      });
      setDirty(true);
    }
    setSelection(null);
    setTool('rect');
  };

  const runExport = async (kind: 'save' | 'share' | 'copy') => {
    if (!image || !crop) return;
    setBusy(kind === 'save' ? 'Guardando…' : kind === 'share' ? 'Preparando…' : 'Copiando…');
    try {
      const out = await renderFinal(image, shapes, crop, typeface);
      if (kind === 'save') {
        await saveToGallery(out);
        setDirty(false);
        Alert.alert('Guardada', `La captura está en la galería, álbum «${SAVE_ALBUM}».`);
      } else if (kind === 'share') {
        await shareImage(out);
      } else {
        await copyImage(out);
        Alert.alert('Copiada', 'La imagen está en el portapapeles.');
      }
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  const close = useCallback(() => {
    if (!dirty) {
      router.back();
      return;
    }
    Alert.alert('Descartar cambios', 'No has guardado la captura anotada.', [
      { text: 'Seguir editando', style: 'cancel' },
      { text: 'Descartar', style: 'destructive', onPress: () => router.back() },
    ]);
  }, [dirty]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      close();
      return true;
    });
    return () => sub.remove();
  }, [close]);

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setArea({ width, height });
  };

  // Selección en coordenadas de pantalla
  const selView =
    tool === 'select' && display && viewCrop
      ? (() => {
          const r = selection ?? crop!;
          return {
            x: (r.x - viewCrop.x) * display.scale,
            y: (r.y - viewCrop.y) * display.scale,
            width: r.width * display.scale,
            height: r.height * display.scale,
          };
        })()
      : null;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Barra superior */}
      <View style={styles.topBar}>
        <IconBtn icon="close" onPress={close} label="Cerrar" />
        <IconBtn icon="undo" onPress={undo} disabled={shapes.length === 0} label="Deshacer" />
        <IconBtn icon="redo" onPress={redoLast} disabled={redo.length === 0} label="Rehacer" />
        <View style={{ flex: 1 }} />
        <IconBtn icon="content-copy" onPress={() => runExport('copy')} label="Copiar" />
        <IconBtn icon="share-variant" onPress={() => runExport('share')} label="Compartir" />
        <IconBtn icon="content-save" onPress={() => runExport('save')} label="Guardar" accent />
      </View>

      {/* Lienzo */}
      <View style={styles.canvasArea} onLayout={onLayout}>
        {error ? (
          <Text style={styles.error}>No se pudo abrir la imagen: {error}</Text>
        ) : image && display && viewCrop ? (
          <View style={{ width: display.width, height: display.height }}>
            <Canvas style={{ width: display.width, height: display.height }}>
              <AnnotatedImage
                image={image}
                shapes={shapes}
                crop={viewCrop}
                width={display.width}
                height={display.height}
                typeface={typeface}
                draft={draft}
              />
              {selView ? (
                <Group>
                  <SkRect x={0} y={0} width={display.width} height={selView.y} color="rgba(0,0,0,0.55)" />
                  <SkRect
                    x={0}
                    y={selView.y + selView.height}
                    width={display.width}
                    height={display.height - selView.y - selView.height}
                    color="rgba(0,0,0,0.55)"
                  />
                  <SkRect x={0} y={selView.y} width={selView.x} height={selView.height} color="rgba(0,0,0,0.55)" />
                  <SkRect
                    x={selView.x + selView.width}
                    y={selView.y}
                    width={display.width - selView.x - selView.width}
                    height={selView.height}
                    color="rgba(0,0,0,0.55)"
                  />
                  <SkRect
                    x={selView.x}
                    y={selView.y}
                    width={selView.width}
                    height={selView.height}
                    color="#ffffff"
                    style="stroke"
                    strokeWidth={1.5}
                  />
                </Group>
              ) : null}
            </Canvas>
            <View style={StyleSheet.absoluteFill} {...pan.panHandlers} />
          </View>
        ) : (
          <ActivityIndicator color={colors.text} />
        )}
        {tool === 'select' ? (
          <View style={styles.selectBar}>
            <Text style={styles.selectHint}>Arrastra para elegir la zona</Text>
            <View style={styles.selectButtons}>
              <Pressable
                style={styles.selectBtn}
                onPress={() => {
                  if (full) setCrop(full);
                  setSelection(null);
                  setTool('rect');
                }}
              >
                <Text style={styles.selectBtnText}>Toda la imagen</Text>
              </Pressable>
              <Pressable style={[styles.selectBtn, styles.selectBtnPrimary]} onPress={applySelection}>
                <Text style={[styles.selectBtnText, { color: '#fff' }]}>Usar zona</Text>
              </Pressable>
            </View>
          </View>
        ) : null}
        {busy ? (
          <View style={styles.busy} pointerEvents="none">
            <ActivityIndicator color="#fff" />
            <Text style={styles.busyText}>{busy}</Text>
          </View>
        ) : null}
      </View>

      {/* Paleta de colores y grosor */}
      {paletteOpen ? (
        <View style={styles.palette}>
          <View style={styles.colorsRow}>
            {COLORS.map((c) => (
              <Pressable
                key={c}
                onPress={() => setColor(c)}
                style={[styles.colorRing, color === c && { borderColor: colors.text }]}
              >
                <View style={[styles.colorDot, { backgroundColor: c }]} />
              </Pressable>
            ))}
          </View>
          <View style={styles.sizesRow}>
            {SIZES.map((s) => (
              <Pressable
                key={s.key}
                onPress={() => setSizeKey(s.key)}
                style={[styles.sizeBtn, sizeKey === s.key && styles.sizeBtnActive]}
              >
                <View style={{ width: 22, height: s.stroke + 1, borderRadius: 3, backgroundColor: color }} />
                <Text style={styles.sizeText}>{s.label}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}

      {/* Herramientas */}
      <View style={[styles.toolBar, { paddingBottom: insets.bottom + 6 }]}>
        {TOOLS.map((t) => {
          const active = tool === t.key;
          return (
            <Pressable
              key={t.key}
              style={styles.tool}
              onPress={() => {
                setTool(t.key);
                if (t.key === 'select') setSelection(null);
              }}
            >
              <MaterialCommunityIcons name={t.icon} size={24} color={active ? color : colors.text} />
              <Text style={[styles.toolText, active && { color: colors.text }]}>{t.label}</Text>
            </Pressable>
          );
        })}
        <Pressable style={styles.tool} onPress={() => setPaletteOpen((v) => !v)}>
          <View style={[styles.currentColor, { backgroundColor: color }]} />
          <Text style={styles.toolText}>Color</Text>
        </Pressable>
      </View>

      {/* Texto */}
      <Modal visible={!!textAt} transparent animationType="fade" onRequestClose={() => setTextAt(null)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalBackdrop}
        >
          <View style={styles.textBox}>
            <Text style={styles.textTitle}>Añadir texto</Text>
            <TextInput
              autoFocus
              multiline
              value={textValue}
              onChangeText={setTextValue}
              placeholder="Escribe aquí…"
              placeholderTextColor={colors.textMuted}
              style={[styles.textInput, { color }]}
            />
            <View style={styles.textButtons}>
              <Pressable onPress={() => setTextAt(null)} style={styles.textBtn}>
                <Text style={styles.textBtnText}>Cancelar</Text>
              </Pressable>
              <Pressable onPress={addText} style={[styles.textBtn, styles.selectBtnPrimary]}>
                <Text style={[styles.textBtnText, { color: '#fff' }]}>Añadir</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

function IconBtn({
  icon,
  onPress,
  disabled,
  label,
  accent,
}: {
  icon: IconName;
  onPress: () => void;
  disabled?: boolean;
  label: string;
  accent?: boolean;
}) {
  return (
    <Pressable onPress={onPress} disabled={disabled} hitSlop={6} style={styles.iconBtn} accessibilityLabel={label}>
      <MaterialCommunityIcons
        name={icon}
        size={24}
        color={disabled ? colors.textMuted : accent ? colors.accent : colors.text}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  topBar: { height: 52, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4 },
  iconBtn: { padding: 10 },
  canvasArea: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0c0c0c' },
  error: { color: colors.danger, padding: 24, textAlign: 'center' },
  busy: {
    position: 'absolute',
    backgroundColor: 'rgba(0,0,0,0.75)',
    padding: 16,
    borderRadius: 10,
    alignItems: 'center',
  },
  busyText: { color: '#fff', marginTop: 8 },
  selectBar: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    right: 12,
    backgroundColor: 'rgba(30,30,30,0.95)',
    borderRadius: 12,
    padding: 12,
  },
  selectHint: { color: colors.textDim, textAlign: 'center', marginBottom: 10 },
  selectButtons: { flexDirection: 'row', gap: 10 },
  selectBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: colors.panelAlt,
    alignItems: 'center',
  },
  selectBtnPrimary: { backgroundColor: colors.accent },
  selectBtnText: { color: colors.text, fontWeight: '600' },
  palette: {
    backgroundColor: colors.panel,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    paddingVertical: 10,
  },
  colorsRow: { flexDirection: 'row', justifyContent: 'center', gap: 2, paddingHorizontal: 6 },
  colorRing: { padding: 2, borderRadius: 20, borderWidth: 2, borderColor: 'transparent' },
  colorDot: { width: 26, height: 26, borderRadius: 13, borderWidth: 1, borderColor: '#555' },
  sizesRow: { flexDirection: 'row', justifyContent: 'center', gap: 10, marginTop: 10 },
  sizeBtn: {
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: colors.panelAlt,
    gap: 6,
  },
  sizeBtnActive: { borderWidth: 1, borderColor: colors.text },
  sizeText: { color: colors.textDim, fontSize: 11 },
  toolBar: {
    flexDirection: 'row',
    backgroundColor: colors.panel,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    paddingTop: 8,
  },
  tool: { flex: 1, alignItems: 'center' },
  toolText: { color: colors.textDim, fontSize: 10, marginTop: 3 },
  currentColor: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: '#fff' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 24 },
  textBox: { backgroundColor: colors.panelAlt, borderRadius: 14, padding: 16 },
  textTitle: { color: colors.text, fontSize: 16, fontWeight: '600', marginBottom: 10 },
  textInput: {
    minHeight: 80,
    backgroundColor: '#111',
    borderRadius: 8,
    padding: 10,
    fontSize: 18,
    textAlignVertical: 'top',
  },
  textButtons: { flexDirection: 'row', gap: 10, marginTop: 14 },
  textBtn: { flex: 1, paddingVertical: 10, borderRadius: 8, backgroundColor: '#333', alignItems: 'center' },
  textBtnText: { color: colors.text, fontWeight: '600' },
});

import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme';
import type { Adjustments, Photo } from '../types';

type Filter = 'all' | 'edited' | 'flagged' | 'rated';

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'Todas' },
  { key: 'edited', label: 'Editadas' },
  { key: 'flagged', label: 'Favoritas' },
  { key: 'rated', label: 'Valoradas' },
];

interface Props {
  photos: Photo[];
  loading: boolean;
  clipboard: Adjustments | null;
  onImport: () => void;
  onOpen: (photo: Photo) => void;
  onUpdate: (photo: Photo) => void;
  onPaste: (photo: Photo) => void;
  onDelete: (photo: Photo) => void;
}

export function LibraryScreen({ photos, loading, clipboard, onImport, onOpen, onUpdate, onPaste, onDelete }: Props) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [filter, setFilter] = useState<Filter>('all');
  const [columns, setColumns] = useState(3);
  const [selected, setSelected] = useState<Photo | null>(null);

  const visible = useMemo(() => {
    const sorted = [...photos].sort((a, b) => b.createdAt - a.createdAt);
    switch (filter) {
      case 'edited':
        return sorted.filter((p) => p.edited);
      case 'flagged':
        return sorted.filter((p) => p.flagged);
      case 'rated':
        return sorted.filter((p) => p.rating > 0);
      default:
        return sorted;
    }
  }, [photos, filter]);

  const gap = 2;
  const size = (width - gap * (columns - 1)) / columns;

  const confirmDelete = (p: Photo) => {
    setSelected(null);
    Alert.alert('Eliminar foto', 'Se quitará de Revela (el original de tu galería no se borra).', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: () => onDelete(p) },
    ]);
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <View style={styles.brand}>
          <MaterialCommunityIcons name="camera-iris" size={24} color={colors.accent} />
          <Text style={styles.title}>Revela</Text>
        </View>
        <Pressable
          hitSlop={8}
          onPress={() => setColumns((c) => (c === 3 ? 4 : c === 4 ? 2 : 3))}
          style={styles.headerBtn}
        >
          <MaterialCommunityIcons name="view-grid-outline" size={22} color={colors.text} />
        </Pressable>
      </View>
      <Text style={styles.subtitle}>
        Todas las fotos · {photos.length} {photos.length === 1 ? 'foto' : 'fotos'}
      </Text>
      <View style={styles.filters}>
        {FILTERS.map((f) => (
          <Pressable
            key={f.key}
            onPress={() => setFilter(f.key)}
            style={[styles.filter, filter === f.key && styles.filterActive]}
          >
            <Text style={[styles.filterText, filter === f.key && styles.filterTextActive]}>{f.label}</Text>
          </Pressable>
        ))}
      </View>

      {!loading && photos.length === 0 ? (
        <View style={styles.empty}>
          <MaterialCommunityIcons name="image-multiple-outline" size={64} color={colors.textMuted} />
          <Text style={styles.emptyTitle}>Tu biblioteca está vacía</Text>
          <Text style={styles.emptyText}>Importa fotos de la galería para empezar a revelarlas.</Text>
          <Pressable style={styles.emptyBtn} onPress={onImport}>
            <Text style={styles.emptyBtnText}>Añadir fotos</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          key={columns}
          data={visible}
          numColumns={columns}
          keyExtractor={(p) => p.id}
          columnWrapperStyle={columns > 1 ? { gap } : undefined}
          contentContainerStyle={{ gap, paddingBottom: insets.bottom + 96 }}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => onOpen(item)}
              onLongPress={() => setSelected(item)}
              style={{ width: size, height: size }}
            >
              <Image source={{ uri: item.thumbUri ?? item.uri }} style={styles.thumb} resizeMode="cover" />
              <View style={styles.thumbBadges} pointerEvents="none">
                {item.flagged ? <Ionicons name="flag" size={12} color="#fff" /> : null}
                {item.edited ? <MaterialCommunityIcons name="tune-variant" size={12} color="#fff" /> : null}
              </View>
              {item.rating > 0 ? (
                <View style={styles.thumbStars} pointerEvents="none">
                  <Text style={styles.thumbStarsText}>{'★'.repeat(item.rating)}</Text>
                </View>
              ) : null}
            </Pressable>
          )}
        />
      )}

      <Pressable style={[styles.fab, { bottom: insets.bottom + 24 }]} onPress={onImport}>
        <MaterialCommunityIcons name="image-plus" size={26} color="#fff" />
      </Pressable>

      <Modal visible={!!selected} transparent animationType="slide" onRequestClose={() => setSelected(null)}>
        <Pressable style={styles.backdrop} onPress={() => setSelected(null)}>
          {selected ? (
            <Pressable style={[styles.sheet, { paddingBottom: insets.bottom + 12 }]}>
              <View style={styles.stars}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <Pressable
                    key={n}
                    hitSlop={6}
                    onPress={() => {
                      const rating = selected.rating === n ? 0 : n;
                      onUpdate({ ...selected, rating });
                      setSelected({ ...selected, rating });
                    }}
                  >
                    <Ionicons
                      name={n <= selected.rating ? 'star' : 'star-outline'}
                      size={30}
                      color={n <= selected.rating ? colors.star : colors.textDim}
                    />
                  </Pressable>
                ))}
              </View>
              <SheetItem
                icon={selected.flagged ? 'flag-remove-outline' : 'flag-outline'}
                label={selected.flagged ? 'Quitar de favoritas' : 'Marcar como favorita'}
                onPress={() => {
                  onUpdate({ ...selected, flagged: !selected.flagged });
                  setSelected(null);
                }}
              />
              <SheetItem
                icon="content-paste"
                label="Pegar ajustes"
                disabled={!clipboard}
                onPress={() => {
                  onPaste(selected);
                  setSelected(null);
                }}
              />
              <SheetItem icon="delete-outline" label="Eliminar de Revela" danger onPress={() => confirmDelete(selected)} />
            </Pressable>
          ) : null}
        </Pressable>
      </Modal>
    </View>
  );
}

function SheetItem({
  icon,
  label,
  onPress,
  disabled,
  danger,
}: {
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  label: string;
  onPress: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  const color = disabled ? colors.textMuted : danger ? colors.danger : colors.text;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [styles.sheetItem, pressed && { backgroundColor: '#333' }]}
    >
      <MaterialCommunityIcons name={icon} size={22} color={color} />
      <Text style={[styles.sheetText, { color }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: { height: 52, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16 },
  brand: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { color: colors.text, fontSize: 22, fontWeight: '700' },
  headerBtn: { padding: 6 },
  subtitle: { color: colors.textDim, fontSize: 13, paddingHorizontal: 16, marginBottom: 8 },
  filters: { flexDirection: 'row', paddingHorizontal: 12, gap: 8, marginBottom: 10 },
  filter: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: colors.panelAlt },
  filterActive: { backgroundColor: colors.text },
  filterText: { color: colors.textDim, fontSize: 13 },
  filterTextActive: { color: colors.bg, fontWeight: '600' },
  thumb: { width: '100%', height: '100%', backgroundColor: colors.panelAlt },
  thumbBadges: { position: 'absolute', top: 4, right: 4, flexDirection: 'row', gap: 4 },
  thumbStars: { position: 'absolute', left: 4, bottom: 3 },
  thumbStarsText: { color: colors.star, fontSize: 10, textShadowColor: '#000', textShadowRadius: 3 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyTitle: { color: colors.text, fontSize: 18, fontWeight: '600', marginTop: 16 },
  emptyText: { color: colors.textDim, fontSize: 14, textAlign: 'center', marginTop: 6 },
  emptyBtn: { marginTop: 20, backgroundColor: colors.accent, paddingHorizontal: 22, paddingVertical: 10, borderRadius: 20 },
  emptyBtnText: { color: '#fff', fontWeight: '600' },
  fab: {
    position: 'absolute',
    right: 20,
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
  },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.panelAlt, borderTopLeftRadius: 16, borderTopRightRadius: 16, paddingTop: 16 },
  stars: { flexDirection: 'row', justifyContent: 'center', gap: 14, paddingBottom: 10 },
  sheetItem: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20, paddingVertical: 14 },
  sheetText: { fontSize: 15 },
});

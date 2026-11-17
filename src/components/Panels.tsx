import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Canvas, type SkImage } from '@shopify/react-native-skia';
import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  applyPreset,
  COLOR_SLIDERS,
  DETAIL_SLIDERS,
  EFFECTS_SLIDERS,
  GRADING_SLIDERS,
  HSL_SWATCHES,
  LIGHT_SLIDERS,
  PRESETS,
  type NumericKey,
  type SliderDef,
} from '../engine/adjustments';
import { DevelopedImage } from '../engine/DevelopedImage';
import { ASPECTS, cropSize, fitInside } from '../engine/geometry';
import { colors } from '../theme';
import { HSL_CHANNELS, type Adjustments } from '../types';
import { AdjustSlider } from './AdjustSlider';

export type Updater = (fn: (a: Adjustments) => Adjustments, commit?: boolean) => void;

interface PanelProps {
  adj: Adjustments;
  update: Updater;
}

// ---------------------------------------------------------------------------

export function SliderList({ adj, update, defs }: PanelProps & { defs: SliderDef[] }) {
  return (
    <View>
      {defs.map((d) => (
        <AdjustSlider
          key={d.key}
          label={d.label}
          value={adj[d.key]}
          min={d.min}
          max={d.max}
          step={d.step}
          defaultValue={defaultFor(d.key)}
          track={d.track}
          format={d.format}
          onChange={(v) => update((a) => ({ ...a, [d.key]: v }))}
          onCommit={(v) => update((a) => ({ ...a, [d.key]: v }), true)}
        />
      ))}
    </View>
  );
}

const defaultFor = (key: NumericKey) =>
  key === 'gradeShadowHue' ? 220 : key === 'gradeHighlightHue' ? 40 : 0;

export const LightPanel = (p: PanelProps) => <SliderList {...p} defs={LIGHT_SLIDERS} />;
export const EffectsPanel = (p: PanelProps) => <SliderList {...p} defs={EFFECTS_SLIDERS} />;
export const DetailPanel = (p: PanelProps) => <SliderList {...p} defs={DETAIL_SLIDERS} />;

// ---------------------------------------------------------------------------

function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { key: T; label: string }[];
  value: T;
  onChange: (k: T) => void;
}) {
  return (
    <View style={styles.segmented}>
      {options.map((o) => (
        <Pressable
          key={o.key}
          onPress={() => onChange(o.key)}
          style={[styles.segment, value === o.key && styles.segmentActive]}
        >
          <Text style={[styles.segmentText, value === o.key && styles.segmentTextActive]}>
            {o.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

type ColorTab = 'basic' | 'mix' | 'grade';

export function ColorPanel(p: PanelProps) {
  const [tab, setTab] = useState<ColorTab>('basic');
  return (
    <View>
      <Segmented
        options={[
          { key: 'basic', label: 'Básico' },
          { key: 'mix', label: 'Mezcla' },
          { key: 'grade', label: 'Gradación' },
        ]}
        value={tab}
        onChange={setTab}
      />
      {tab === 'basic' && <SliderList {...p} defs={COLOR_SLIDERS} />}
      {tab === 'mix' && <HslMixer {...p} />}
      {tab === 'grade' && <SliderList {...p} defs={GRADING_SLIDERS} />}
    </View>
  );
}

function HslMixer({ adj, update }: PanelProps) {
  const [ch, setCh] = useState(0);
  const set = (field: 'hue' | 'sat' | 'lum', v: number, commit?: boolean) =>
    update((a) => {
      const arr = [...a.hsl[field]];
      arr[ch] = v;
      return { ...a, hsl: { ...a.hsl, [field]: arr } };
    }, commit);
  const changed = (i: number) => adj.hsl.hue[i] !== 0 || adj.hsl.sat[i] !== 0 || adj.hsl.lum[i] !== 0;
  return (
    <View>
      <View style={styles.swatches}>
        {HSL_SWATCHES.map((c, i) => (
          <Pressable
            key={c}
            onPress={() => setCh(i)}
            accessibilityLabel={HSL_CHANNELS[i]}
            style={[styles.swatchRing, ch === i && styles.swatchRingActive]}
          >
            <View style={[styles.swatch, { backgroundColor: c }]}>
              {changed(i) ? <View style={styles.swatchDot} /> : null}
            </View>
          </Pressable>
        ))}
      </View>
      <Text style={styles.channelName}>{HSL_CHANNELS[ch]}</Text>
      <AdjustSlider
        label="Tono"
        value={adj.hsl.hue[ch]}
        min={-100}
        max={100}
        track={[HSL_SWATCHES[(ch + 7) % 8], HSL_SWATCHES[ch], HSL_SWATCHES[(ch + 1) % 8]]}
        onChange={(v) => set('hue', v)}
        onCommit={(v) => set('hue', v, true)}
      />
      <AdjustSlider
        label="Saturación"
        value={adj.hsl.sat[ch]}
        min={-100}
        max={100}
        track={['#808080', HSL_SWATCHES[ch]]}
        onChange={(v) => set('sat', v)}
        onCommit={(v) => set('sat', v, true)}
      />
      <AdjustSlider
        label="Luminancia"
        value={adj.hsl.lum[ch]}
        min={-100}
        max={100}
        track={['#000000', HSL_SWATCHES[ch], '#ffffff']}
        onChange={(v) => set('lum', v)}
        onCommit={(v) => set('lum', v, true)}
      />
    </View>
  );
}

// ---------------------------------------------------------------------------

export function CropPanel({ adj, update }: PanelProps) {
  const crop = adj.crop;
  const setCrop = (patch: Partial<Adjustments['crop']>, commit = true) =>
    update((a) => ({ ...a, crop: { ...a.crop, ...patch } }), commit);
  return (
    <View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {ASPECTS.map((a) => (
          <Pressable
            key={a.key}
            onPress={() => setCrop({ aspect: a.key })}
            style={[styles.chip, crop.aspect === a.key && styles.chipActive]}
          >
            <Text style={[styles.chipText, crop.aspect === a.key && styles.chipTextActive]}>
              {a.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
      <View style={styles.cropButtons}>
        <IconButton
          icon={<MaterialCommunityIcons name="rotate-left" size={22} color={colors.text} />}
          label="Girar izq."
          onPress={() => setCrop({ quarterTurns: (crop.quarterTurns + 3) % 4 })}
        />
        <IconButton
          icon={<MaterialCommunityIcons name="rotate-right" size={22} color={colors.text} />}
          label="Girar der."
          onPress={() => setCrop({ quarterTurns: (crop.quarterTurns + 1) % 4 })}
        />
        <IconButton
          icon={<MaterialCommunityIcons name="flip-horizontal" size={22} color={colors.text} />}
          label="Voltear"
          onPress={() => setCrop({ flipH: !crop.flipH })}
        />
        <IconButton
          icon={<MaterialCommunityIcons name="restore" size={22} color={colors.text} />}
          label="Restablecer"
          onPress={() => setCrop({ aspect: 'original', quarterTurns: 0, flipH: false, straighten: 0 })}
        />
      </View>
      <AdjustSlider
        label="Enderezar"
        value={crop.straighten}
        min={-45}
        max={45}
        step={0.1}
        format={(v) => `${v.toFixed(1)}°`}
        onChange={(v) => setCrop({ straighten: v }, false)}
        onCommit={(v) => setCrop({ straighten: v }, true)}
      />
    </View>
  );
}

function IconButton({ icon, label, onPress }: { icon: React.ReactNode; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.iconBtn}>
      {icon}
      <Text style={styles.iconBtnText}>{label}</Text>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------

const THUMB = 76;

export function PresetsPanel({ adj, update, preview }: PanelProps & { preview: SkImage | null }) {
  const groups = Array.from(new Set(PRESETS.map((p) => p.group)));
  const [group, setGroup] = useState(groups[0]);
  const thumbSize = preview
    ? (() => {
        const s = cropSize(preview.width(), preview.height(), adj.crop);
        return fitInside(s.width, s.height, THUMB, THUMB);
      })()
    : { width: THUMB, height: THUMB };
  return (
    <View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {groups.map((g) => (
          <Pressable key={g} onPress={() => setGroup(g)} style={[styles.chip, group === g && styles.chipActive]}>
            <Text style={[styles.chipText, group === g && styles.chipTextActive]}>{g}</Text>
          </Pressable>
        ))}
      </ScrollView>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.presetRow}>
        {PRESETS.filter((p) => p.group === group).map((p) => {
          const presetAdj = applyPreset(adj, p);
          return (
            <Pressable key={p.name} onPress={() => update(() => applyPreset(adj, p), true)} style={styles.preset}>
              <View style={styles.presetThumb}>
                {preview ? (
                  <Canvas style={thumbSize}>
                    <DevelopedImage
                      image={preview}
                      adjustments={presetAdj}
                      width={thumbSize.width}
                      height={thumbSize.height}
                    />
                  </Canvas>
                ) : (
                  <Ionicons name="image-outline" size={28} color={colors.textMuted} />
                )}
              </View>
              <Text style={styles.presetName} numberOfLines={1}>
                {p.name}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  segmented: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 4,
    backgroundColor: colors.panelAlt,
    borderRadius: 8,
    padding: 3,
  },
  segment: { flex: 1, paddingVertical: 6, alignItems: 'center', borderRadius: 6 },
  segmentActive: { backgroundColor: '#3a3a3a' },
  segmentText: { color: colors.textDim, fontSize: 13 },
  segmentTextActive: { color: colors.text, fontWeight: '600' },
  swatches: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  swatchRing: { padding: 3, borderRadius: 20, borderWidth: 2, borderColor: 'transparent' },
  swatchRingActive: { borderColor: colors.text },
  swatch: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  swatchDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#fff' },
  channelName: {
    color: colors.text,
    textAlign: 'center',
    marginTop: 6,
    fontSize: 13,
    textTransform: 'capitalize',
  },
  chips: { paddingHorizontal: 12, paddingVertical: 10, gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: colors.panelAlt,
  },
  chipActive: { backgroundColor: colors.accent },
  chipText: { color: colors.textDim, fontSize: 13 },
  chipTextActive: { color: '#fff', fontWeight: '600' },
  cropButtons: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 6 },
  iconBtn: { alignItems: 'center', padding: 6, minWidth: 70 },
  iconBtnText: { color: colors.textDim, fontSize: 11, marginTop: 4 },
  presetRow: { paddingHorizontal: 12, paddingBottom: 12, gap: 10 },
  preset: { width: THUMB, alignItems: 'center' },
  presetThumb: {
    width: THUMB,
    height: THUMB,
    backgroundColor: colors.panelAlt,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  presetName: { color: colors.textDim, fontSize: 11, marginTop: 5 },
});

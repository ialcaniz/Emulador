import Slider from '@react-native-community/slider';
import React, { memo, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';

interface Props {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  defaultValue?: number;
  track?: string[];
  format?: (v: number) => string;
  onChange: (v: number) => void;
  onCommit: (v: number) => void;
}

/** Deslizador de ajuste: doble toque en la etiqueta para restablecer. */
function AdjustSliderBase({
  label,
  value,
  min,
  max,
  step = 1,
  defaultValue = 0,
  track,
  format,
  onChange,
  onCommit,
}: Props) {
  const lastTap = useRef(0);
  const changed = Math.abs(value - defaultValue) > 1e-6;
  const onLabelPress = () => {
    const now = Date.now();
    if (now - lastTap.current < 350) {
      onChange(defaultValue);
      onCommit(defaultValue);
    }
    lastTap.current = now;
  };
  return (
    <View style={styles.row}>
      <Pressable onPress={onLabelPress} style={styles.header} hitSlop={6}>
        <Text style={[styles.label, changed && styles.labelChanged]}>{label}</Text>
        <Text style={[styles.value, changed && styles.labelChanged]}>
          {format ? format(value) : Math.round(value)}
        </Text>
      </Pressable>
      <View style={styles.sliderWrap}>
        {track ? (
          <View style={styles.track} pointerEvents="none">
            {track.map((c, i) => (
              <View key={i} style={[styles.trackSeg, { backgroundColor: c }]} />
            ))}
          </View>
        ) : null}
        <Slider
          style={styles.slider}
          minimumValue={min}
          maximumValue={max}
          step={step}
          value={value}
          onValueChange={onChange}
          onSlidingComplete={onCommit}
          minimumTrackTintColor={track ? 'transparent' : colors.textDim}
          maximumTrackTintColor={track ? 'transparent' : colors.border}
          thumbTintColor="#f2f2f2"
        />
      </View>
    </View>
  );
}

export const AdjustSlider = memo(AdjustSliderBase);

const styles = StyleSheet.create({
  row: { paddingHorizontal: 16, paddingVertical: 2 },
  header: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 6 },
  label: { color: colors.textDim, fontSize: 13 },
  value: { color: colors.textDim, fontSize: 13, fontVariant: ['tabular-nums'] },
  labelChanged: { color: colors.text },
  sliderWrap: { height: 32, justifyContent: 'center' },
  track: {
    position: 'absolute',
    left: 14,
    right: 14,
    height: 3,
    borderRadius: 2,
    flexDirection: 'row',
    overflow: 'hidden',
    opacity: 0.85,
  },
  trackSeg: { flex: 1 },
  slider: { width: '100%', height: 32 },
});

import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { latestScreenshot, pickImage } from '../annotate/io';
import { colors } from '../theme';

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const [busy, setBusy] = useState(false);

  const open = (uri: string) => router.push({ pathname: '/editor', params: { uri } });

  const onLatest = async () => {
    setBusy(true);
    try {
      const uri = await latestScreenshot();
      if (uri) open(uri);
      else Alert.alert('Sin capturas', 'No he encontrado ninguna captura de pantalla en tu galería.');
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const onPick = async () => {
    const uri = await pickImage();
    if (uri) open(uri);
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}>
      <View style={styles.brand}>
        <View style={styles.logo}>
          <MaterialCommunityIcons name="vector-square-edit" size={40} color="#fff" />
        </View>
        <Text style={styles.title}>Anota</Text>
        <Text style={styles.subtitle}>Marca tus capturas de pantalla con líneas, flechas, recuadros y texto.</Text>
      </View>

      <View style={styles.actions}>
        <Pressable style={[styles.btn, styles.btnPrimary]} onPress={onLatest} disabled={busy}>
          {busy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <MaterialCommunityIcons name="cellphone-screenshot" size={26} color="#fff" />
          )}
          <Text style={[styles.btnText, { color: '#fff' }]}>Última captura</Text>
        </Pressable>
        <Pressable style={styles.btn} onPress={onPick}>
          <MaterialCommunityIcons name="image-search-outline" size={26} color={colors.text} />
          <Text style={styles.btnText}>Elegir imagen</Text>
        </Pressable>
        <Text style={styles.tip}>
          Haz una captura (Encendido + Bajar volumen), vuelve aquí y pulsa «Última captura».
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: 24, justifyContent: 'space-between' },
  brand: { alignItems: 'center', marginTop: 48 },
  logo: {
    width: 84,
    height: 84,
    borderRadius: 22,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { color: colors.text, fontSize: 32, fontWeight: '700', marginTop: 16 },
  subtitle: { color: colors.textDim, fontSize: 15, textAlign: 'center', marginTop: 8, lineHeight: 21 },
  actions: { gap: 12 },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingVertical: 16,
    borderRadius: 14,
    backgroundColor: colors.panelAlt,
  },
  btnPrimary: { backgroundColor: colors.brand },
  btnText: { color: colors.text, fontSize: 17, fontWeight: '600' },
  tip: { color: colors.textMuted, fontSize: 13, textAlign: 'center', marginTop: 8, lineHeight: 18 },
});

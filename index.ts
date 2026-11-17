import { Platform } from 'react-native';

// En Android/iOS Skia es nativo. En web (solo para previsualizar la interfaz)
// hay que cargar CanvasKit (wasm) antes de cargar la app.
if (Platform.OS === 'web') {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { LoadSkiaWeb } = require('@shopify/react-native-skia/lib/module/web');
  LoadSkiaWeb({ locateFile: (file: string) => `/${file}` }).then(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('expo-router/entry');
  });
} else {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('expo-router/entry');
}

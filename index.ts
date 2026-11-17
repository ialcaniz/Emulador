import { registerRootComponent } from 'expo';
import { Platform } from 'react-native';

// En Android/iOS Skia es nativo. En web (solo para previsualizar la interfaz)
// hay que cargar antes CanvasKit (wasm).
if (Platform.OS === 'web') {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { LoadSkiaWeb } = require('@shopify/react-native-skia/lib/module/web');
  LoadSkiaWeb({
    locateFile: (file: string) => `/${file}`,
  }).then(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    registerRootComponent(require('./App').default);
  });
} else {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  registerRootComponent(require('./App').default);
}

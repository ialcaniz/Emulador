# Anota — marca tus capturas de pantalla en Android

App Android (React Native + Expo + Skia) para anotar capturas de pantalla al estilo de las
herramientas de captura de Windows: eliges una zona y la marcas con una línea roja, un
recuadro, una flecha o texto.

## Funciones

- **Abrir**: «Última captura» (busca la captura más reciente de la galería) o «Elegir imagen».
- **Zona**: arrastra para quedarte solo con una parte de la captura.
- **Herramientas**: Lápiz, Línea, Flecha, Recuadro, Marcador (resaltador semitransparente) y Texto.
- **Color**: 10 colores (rojo por defecto) y 3 grosores (fino, medio, grueso).
- **Deshacer / rehacer**.
- **Guardar** en la galería (álbum «Capturas anotadas»), **Compartir** y **Copiar** al portapapeles.

## Descargar el APK

https://github.com/ialcaniz/Emulador/releases/download/apk-latest/Anota.apk

Cada push ejecuta el workflow **Android APK** (`.github/workflows/android-apk.yml`), que compila
el APK y lo publica en la Release `apk-latest`.

## Desarrollo

```bash
npm install
npx expo run:android   # build de desarrollo (Skia es nativo: no funciona en Expo Go)
npm run web            # vista previa de la interfaz en el navegador
```

## Estructura

```
src/app/_layout.tsx          navegación (Expo Router)
src/app/index.tsx            inicio: última captura / elegir imagen
src/app/editor.tsx           editor de anotaciones
src/annotate/AnnotatedImage  dibujo de la captura y las formas con Skia
src/annotate/io.tsx          cargar, buscar la última captura, guardar, compartir, copiar
src/annotate/types.ts        tipos de formas, colores y grosores
```

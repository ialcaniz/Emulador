# Revela — editor de fotos para Android

Aplicación Android (React Native + Expo + Skia) inspirada en el flujo de trabajo de los
reveladores fotográficos de escritorio: biblioteca de fotos + módulo de revelado con
ajustes no destructivos procesados en GPU.

## Funciones

**Biblioteca**
- Importar fotos de la galería (selección múltiple); se copian al almacenamiento de la app.
- Cuadrícula de 2/3/4 columnas con miniaturas que muestran las ediciones.
- Filtros: Todas · Editadas · Favoritas · Valoradas.
- Pulsación larga: valoración con estrellas, marcar favorita, pegar ajustes, eliminar.

**Revelado** (todos los ajustes en un shader SkSL en tiempo real)
- **Luz**: Exposición, Contraste, Iluminaciones, Sombras, Blancos, Negros.
- **Color**: Temperatura, Matiz, Intensidad, Saturación.
  - *Mezcla* HSL de 8 canales (tono / saturación / luminancia).
  - *Gradación de color*: tono y saturación de sombras e iluminaciones, equilibrio.
- **Efectos**: Textura, Claridad, Neblina, Viñeta, Granulado.
- **Detalle**: Enfoque.
- **Recortar**: relaciones de aspecto, girar 90°, voltear, enderezar (con autoajuste del encuadre).
- **Predefinidos**: 17 ajustes en 6 grupos, con vista previa en miniatura.
- **Auto**: ajuste automático a partir del histograma.
- Histograma RGB en vivo, mantener pulsada la foto para ver el original.
- Deshacer / rehacer, copiar / pegar ajustes, restablecer.
- Exportar a la galería (JPG completo, JPG 2048 px o PNG) en el álbum «Revela».

## Ejecutar

```bash
npm install
npx expo run:android      # build de desarrollo en un dispositivo/emulador (requiere Android SDK)
```

> Skia es un módulo nativo: la app **no funciona en Expo Go**; necesita una build propia.

### Obtener el APK sin instalar nada

Cada push ejecuta el workflow **Android APK** (`.github/workflows/android-apk.yml`), que genera
el proyecto nativo y compila un APK instalable. Descárgalo desde la pestaña *Actions* del
repositorio → última ejecución → artefacto `revela-apk`.

También puedes usar EAS: `npx eas-cli@latest build -p android --profile preview`.

### Vista previa web (solo interfaz)

```bash
npm run web
```

## Estructura

```
App.tsx                      navegación biblioteca ⇄ editor y persistencia
src/types.ts                 modelo de datos (Photo, Adjustments)
src/engine/shader.ts         motor de revelado en SkSL + uniforms
src/engine/adjustments.ts    valores por defecto, deslizadores, predefinidos, auto
src/engine/geometry.ts       recorte, giro y enderezado
src/engine/render.tsx        carga, exportación fuera de pantalla e histograma
src/engine/storage.ts        biblioteca en disco (expo-file-system)
src/screens/                 LibraryScreen, EditorScreen
src/components/              deslizadores, histograma, paneles
```

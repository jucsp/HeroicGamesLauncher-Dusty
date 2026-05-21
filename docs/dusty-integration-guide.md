# Guía de integración: rama `feature/dusty-select-themes`

## Resumen

Esta rama introduce el **modo Dusty** como tema alternativo del ConsoleMode de Heroic Games Launcher, con un selector de tema en Settings y una arquitectura plug&play que permite agregar nuevos temas sin tocar el código del modo Classic original.

---

## Cambios introducidos

### 1. Arquitectura de temas (plug&play)

**Archivo clave:** `src/frontend/screens/ConsoleMode/index.tsx`

El `index.tsx` original (580 líneas) fue reemplazado por un router de 10 líneas:

```tsx
import DustyMode from './DustyMode'
import ClassicMode from './ClassicMode'
import { configStore } from 'frontend/helpers/electronStores'

export default function ConsoleMode() {
  const consoleTheme =
    (configStore.get_nodefault('consoleTheme') as string) ?? 'dusty'
  if (consoleTheme === 'dusty') return <DustyMode />
  return <ClassicMode />
}
```

El modo Classic se movió íntegro a `ClassicMode.tsx`. El modo Dusty vive en `DustyMode.tsx`. Cada tema es completamente independiente.

> **Deuda técnica:** existe `index.tsx.bak` en la raíz de ConsoleMode — es el original y puede eliminarse cuando el puerto sea estable.

---

### 2. ClassicMode — el modo original refactorizado

**Archivo:** `src/frontend/screens/ConsoleMode/ClassicMode.tsx`

Es el ConsoleMode upstream sin cambios funcionales, excepto:

- Importa `ClassicCard` en lugar del genérico `ConsoleCard`.
- Todas las referencias a `ConsoleCard` en JSX fueron actualizadas.

No tiene dependencias hacia DustyMode.

---

### 3. DustyMode — el tema retro

**Archivos:**
- `src/frontend/screens/ConsoleMode/DustyMode.tsx` (820 líneas)
- `src/frontend/screens/ConsoleMode/DustyMode.scss` (663 líneas)

Layout de tres áreas apiladas verticalmente:

| Área | Clase CSS | Descripción |
|------|-----------|-------------|
| TV / portada | `.dustyTVArea` | Muestra portada grande + metadatos del juego enfocado |
| Disco | `.dustyDiscArea` | Reproductor de disco animado |
| Estantería | `.dustyShelfArea` | Grid horizontal de juegos con imagen de mueble retro |

DustyMode importa `index.scss` para los estilos compartidos y `DustyMode.scss` para los suyos propios.

---

### 4. ConsoleCard — separación por tema

**Archivos:**

| Archivo | Usa | Descripción |
|---------|-----|-------------|
| `components/ConsoleCard/index.tsx` | DustyMode | Card vertical estilo estuche de CD, con spine artwork |
| `components/ConsoleCard/ClassicCard.tsx` | ClassicMode | Card simple con arte cuadrado y badge de actualización |

Ambos comparten la misma interfaz `Props`:

```ts
type Props = {
  game: GameInfo
  focused: boolean
  needsUpdate: boolean
  onClick: () => void
  onMouseEnter: () => void
  onFocus: () => void
}
```

---

### 5. Selector de tema en Settings

**Archivos modificados:**
- `src/frontend/screens/Settings/components/ConsoleModeThemeSelector.tsx` *(nuevo)*
- `src/frontend/screens/Settings/components/index.ts` — exporta el selector
- `src/frontend/screens/Settings/sections/GeneralSettings/index.tsx` — lo monta en el formulario

**Almacenamiento:** `configStore` (electron-store), clave `consoleTheme`. Valores posibles: `'dusty'` (por defecto) | `'classic'`.

**Tipo:** `src/common/types/electron_store.ts` — se agregó `consoleTheme: string` al tipo del store.

---

### 6. Assets Dusty

Carpeta nueva: `src/frontend/assets/dusty/`

Contiene todos los PNG del tema (TV, mueble de madera, fondos neonwave, decoraciones). No dependen de assets del upstream.

---

### 7. Estilos compartidos — `index.scss`

Los estilos de `index.scss` son compartidos entre Classic y Dusty. Los cambios respecto al upstream:

- `.consoleGridScroller` — scroll horizontal en lugar de vertical (DustyMode usa la estantería en horizontal).
- `.consoleStage` — eliminado `overflow: hidden` para que DustyMode pueda desbordarse.
- `.launching` — las clases apagadas durante launch fueron actualizadas a `.dustyDiscArea`, `.dustyTVArea`, `.dustyShelfArea` (específicas de DustyMode).

> **Atención:** el selector `.launching` en `index.scss` solo apaga las áreas de DustyMode. Si Classic también necesita apagarse durante launch, hay que agregar sus clases aquí.

---

### 8. Otros cambios puntuales

| Archivo | Cambio | Razón |
|---------|--------|-------|
| `src/backend/main_window.ts` | `webSecurity: false` | Permite cargar assets locales (PNG del tema) en desarrollo |
| `src/frontend/screens/Game/GamePage/index.tsx` | `throw new Error` → `console.warn + return` | Evita crash cuando DustyMode navega a GamePage sin info completa |
| `public/locales/en/translation.json` | `setting.console_theme`, `console.card.needsUpdate` | Claves i18n de los componentes nuevos |

---

## Integración al traer cambios del upstream

### Archivos sin conflicto esperado

Estos archivos son nuevos o exclusivos de Dusty — el upstream no los toca:

- `DustyMode.tsx`, `DustyMode.scss`
- `ClassicCard.tsx`
- `ConsoleModeThemeSelector.tsx`
- `src/frontend/assets/dusty/`
- `ClassicMode.tsx`

### Archivos con conflicto probable

#### `src/frontend/screens/ConsoleMode/index.tsx`

**Situación:** el upstream lo modificará continuamente (es el ConsoleMode oficial). Nuestra versión lo reemplazó por el router de 10 líneas.

**Estrategia al hacer merge/rebase:**

1. Verificar qué cambió en el upstream (`git diff upstream/main -- src/frontend/screens/ConsoleMode/index.tsx`).
2. Si el upstream solo agrega features al ConsoleMode (nuevas props, nuevos estados, mejoras de UI):
   - Esos cambios van a `ClassicMode.tsx`, no a `index.tsx`.
   - Copiar los cambios del upstream al `ClassicMode.tsx` de nuestra rama.
   - Mantener nuestro `index.tsx` como router puro.
3. Si el upstream cambia la firma del componente raíz (nombre, exports):
   - Actualizar `index.tsx` para reflejar el nuevo nombre/export.
   - Asegurarse de que `ClassicMode.tsx` y `DustyMode.tsx` sean compatibles.

**Comando de referencia:**

```bash
# Ver exactamente qué trajo el upstream en ese archivo
git diff HEAD..upstream/main -- src/frontend/screens/ConsoleMode/index.tsx
```

---

#### `src/frontend/screens/ConsoleMode/index.scss`

**Situación:** el upstream puede cambiar estilos de `.consoleGridScroller`, `.consoleStage`, `.launching`, etc.

**Estrategia:**

- Los cambios de upstream en `.consoleGridScroller` probablemente rompan DustyMode (que usa scroll horizontal). Revisar caso por caso.
- La sección `.launching` del upstream referencia `.consoleTitleBar` y `.consoleStage` — las nuestras referencian `.dustyDiscArea`, `.dustyTVArea`, `.dustyShelfArea`. En conflicto: **mantener ambos selectores** (Classic necesita los de upstream, Dusty los nuestros).

**Plantilla post-merge para `.launching`:**

```scss
&.launching {
  // Classic areas (upstream)
  > .consoleTopBar,
  > .consoleTitleBar,
  > .consoleStage,
  // Dusty areas
  > .dustyDiscArea,
  > .dustyTVArea,
  > .dustyShelfArea,
  > .consoleFooter {
    opacity: 0.2;
    pointer-events: none;
  }
}
```

---

#### `src/frontend/screens/ConsoleMode/components/ConsoleCard/index.tsx`

**Situación:** el upstream puede mejorar la card original. Nuestra `index.tsx` ya diverge (es la card estilo spine para Dusty).

**Estrategia:**

- Los cambios del upstream en `ConsoleCard/index.tsx` corresponden a la `ClassicCard`. Aplicarlos en `ClassicCard.tsx`.
- Nuestra `index.tsx` (la DustyCard) solo se modifica por necesidades propias del tema.

---

#### `src/frontend/screens/Settings/sections/GeneralSettings/index.tsx`

**Situación:** el upstream añade opciones en Settings con frecuencia. Nuestra adición es `<ConsoleModeThemeSelector />` en línea 55.

**Estrategia:** en caso de conflicto, simplemente re-agregar el import y el elemento JSX. Es un cambio aditivo, no destructivo.

---

#### `src/common/types/electron_store.ts`

**Situación:** agregamos `consoleTheme: string`. El upstream puede agregar otras claves.

**Estrategia:** conflicto trivial — mantener todas las claves. Agregar `consoleTheme` si el upstream la eliminó.

---

#### `src/frontend/screens/Game/GamePage/index.tsx`

**Situación:** cambiamos un `throw` por un `console.warn`. Si el upstream cambia esa misma línea, hay conflicto.

**Estrategia:** mantener el `console.warn + return` de nuestra rama. El `throw` original causa crash en DustyMode.

---

#### `src/backend/main_window.ts`

**Situación:** agregamos `webSecurity: false`. El upstream puede modificar las `webPreferences`.

**Estrategia:** evaluar si sigue siendo necesario en producción. Si los assets se sirven correctamente con el build, puede eliminarse. En desarrollo siempre mantenerlo.

---

### Flujo recomendado de rebase sobre upstream

```bash
# 1. Traer cambios del upstream (asumiendo remote 'upstream')
git fetch upstream

# 2. Hacer rebase interactivo sobre main del upstream
git rebase upstream/main

# 3. Por cada conflicto en index.tsx de ConsoleMode:
#    - Aceptar nuestra versión (el router)
#    - Portar los cambios del upstream a ClassicMode.tsx manualmente

# 4. Por cada conflicto en index.scss:
#    - Resolver manteniendo ambos grupos de selectores (Classic + Dusty)

# 5. Por cada conflicto en ConsoleCard/index.tsx:
#    - Aceptar nuestra versión (DustyCard)
#    - Aplicar los cambios del upstream en ClassicCard.tsx

# 6. Verificar que el build pasa
pnpm codecheck && pnpm lint

# 7. Verificar que i18n no dejó claves huérfanas
pnpm i18n --fail-on-update
```

---

## Agregar un nuevo tema

1. Crear `NuevoTema.tsx` + `NuevoTema.scss` en `src/frontend/screens/ConsoleMode/`.
2. Agregar `<MenuItem value="nuevo">` en `ConsoleModeThemeSelector.tsx`.
3. Agregar el branch en `index.tsx`:
   ```tsx
   if (consoleTheme === 'nuevo') return <NuevoTema />
   ```
4. Si necesita una card propia, crear `components/ConsoleCard/NuevoTemaCard.tsx` con la misma interfaz `Props`.

No hay que tocar Classic ni Dusty.

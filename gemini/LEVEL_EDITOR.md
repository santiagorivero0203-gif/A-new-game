# 🛠️ Arquitectura de Creación de Zonas y Mundos ("Forja de Zonas")

> **Propósito:** Documentar la estructura modular, el modelo de **Zonas dentro de un mismo Mundo**, la coherencia con el motor y el soporte multitáctil del sistema de creación de niveles de *Be a Legend: El Legado de la Reliquia*.

---

## 1. Visión General y Principios de Diseño

La **Forja de Zonas** está diseñada para construir y conectar múltiples zonas pertenecientes a un mismo mundo (`worldId`) con paridad visual y física 1:1 respecto al motor:

* **Carga perezosa (*lazy-loading*):** `src/main.js` importa `src/editor/LevelEditor.js` únicamente cuando el jugador abre la Forja (`#btn-level-editor`), manteniendo el editor fuera del arranque inicial del juego (`dist/assets/LevelEditor-*.js`).
* **Render bajo demanda (0 FPS en reposo):** `LevelEditor` programa un único `render()` mediante `markDirty()` solo ante interacción del usuario.
* **Fuente única de verdad de esquema y huellas:** Tanto el motor (`LevelLoader`, `worlds.js`) como el editor consumen `LevelSchema.js` (`SCHEMA_VERSION = 2`), `EntityFootprints.js` y `computePerimeterTrees()`.
* **Coordenadas unificadas con el motor:** Props, entidades, árboles, arbustos, casas y zonas AABB usan `(x, y)` como **esquina superior izquierda** (`anchor: 'top-left'`), coincidiendo con `Entity.pos`. Marcadores puntuales (`playerSpawn`, `arenaCenter`, `lights`) usan anclaje central (`anchor: 'center'`).

---

## 2. Mapa de Módulos

| Módulo / Archivo | Responsabilidad |
| :--- | :--- |
| [LevelSchema.js](file:///c:/Users/user/Desktop/video%20proyectos/Be%20a%20legend/src/data/LevelSchema.js) | Fuente única de verdad del esquema (`SCHEMA_VERSION = 2`): `createBlankLevel()`, `normalizeLevel()` (migra `map.*` y `colliders`), y `computePerimeterTrees()`. |
| [EntityFootprints.js](file:///c:/Users/user/Desktop/video%20proyectos/Be%20a%20legend/src/data/EntityFootprints.js) | Dimensiones y anclaje compartidos (`getObjectFootprint()`, `getObjectBounds()`), consultando `InteractableProp._getDimensions()` y tamaños reales de `Tree` (84×98), `House` (160×144), `FoliageProp` (48×44), `NPC` (32×32) y `Enemy` (32×32). |
| [LevelEditor.js](file:///c:/Users/user/Desktop/video%20proyectos/Be%20a%20legend/src/editor/LevelEditor.js) | Orquestador principal del editor: conecta `Tilemap`, herramienta Mano (`pan`), brochas de terreno, selección, redimensionado de zonas y Playtest. |
| [EditorViewport.js](file:///c:/Users/user/Desktop/video%20proyectos/Be%20a%20legend/src/editor/EditorViewport.js) | Cámara (`cameraX`, `cameraY`, `zoom` 0.35–3.5), conversión `screenToWorld()`, zoom centrado en cursor/pellizco y gestos multitáctiles (Pinch-to-Zoom, Pan a 2 dedos y Pan a 1 dedo). |
| [EditorRenderer.js](file:///c:/Users/user/Desktop/video%20proyectos/Be%20a%20legend/src/editor/EditorRenderer.js) | Renderizado bajo demanda sobre Canvas 2D: `Tilemap`, árboles perimetrales atenuados, props/entidades top-left, `spawnPoints`, asas de redimensionado y previsualización de brocha/rectángulo. |
| [EditorCommands.js](file:///c:/Users/user/Desktop/video%20proyectos/Be%20a%20legend/src/editor/EditorCommands.js) | Patrón Command centralizado (`addItem`, `removeItem`, `moveItem`, `editItem`, `editLevelMeta`) para registrar todas las mutaciones en el historial. |
| [EditorHistory.js](file:///c:/Users/user/Desktop/video%20proyectos/Be%20a%20legend/src/editor/EditorHistory.js) | Pila Undo/Redo por referencia directa al objeto (inmune a desplazamientos de índice tras borrados), con soporte para `tile_stroke`, `item_*`, `spawn_move`, `level_meta` y `level_resize`. |
| [EditorCatalog.js](file:///c:/Users/user/Desktop/video%20proyectos/Be%20a%20legend/src/editor/EditorCatalog.js) | Catálogo declarativo (`TILE_PALETTE`, `BIOME_OPTIONS`, `PROP_CATALOG`, `STRUCTURE_CATALOG`, `ACTOR_CATALOG`, `ZONE_CATALOG`, `LIGHT_CATALOG`) y fábrica unificada `createCatalogItem()`. |
| [EditorInspector.js](file:///c:/Users/user/Desktop/video%20proyectos/Be%20a%20legend/src/editor/EditorInspector.js) | Inspector contextual: edita objetos vía `EditorCommands`, vincula portales (`targetWorld` entre mundos oficiales o zonas guardadas + `targetSpawnId`), gestiona `spawnPoints` y metadatos de zona (`worldId`, `zoneId`, `zoneOrder`, `perimeterConfig`). |
| [EditorLevelsModal.js](file:///c:/Users/user/Desktop/video%20proyectos/Be%20a%20legend/src/editor/EditorLevelsModal.js) | Gestor de Mundos y Zonas: crea zonas dentro de un `worldId`, redimensiona la zona activa, agrupa zonas guardadas por mundo y clona plantillas oficiales preservando su terreno procedural. |
| [LevelRepository.js](file:///c:/Users/user/Desktop/video%20proyectos/Be%20a%20legend/src/editor/LevelRepository.js) | Repositorio de persistencia (`levelRepository`) en `localStorage` con compresión RLE, control de `QuotaExceededError` y sincronización automática con `worlds.js` (`syncAllToEngine()`). |
| [LevelSerializer.js](file:///c:/Users/user/Desktop/video%20proyectos/Be%20a%20legend/src/editor/LevelSerializer.js) | Compresión RLE (`encodeTerrainGrid` / `decodeTerrainGrid`), validación (`validateLevel`) y exportación/importación `.json`. |
| [worlds.js](file:///c:/Users/user/Desktop/video%20proyectos/Be%20a%20legend/src/data/worlds.js) | Registro en memoria de mundos y zonas personalizadas (`registerCustomWorld`, `getZonesByWorld`, `getAllCustomWorlds`) y carga unificada `loadWorldData()`. |
| [LevelLoader.js](file:///c:/Users/user/Desktop/video%20proyectos/Be%20a%20legend/src/world/LevelLoader.js) | Instanciación en juego usando `normalizeLevel()` y `computePerimeterTrees()`. |
| [main.js](file:///c:/Users/user/Desktop/video%20proyectos/Be%20a%20legend/src/main.js) | Sincroniza zonas al arranque (`levelRepository.syncAllToEngine()`), soporta `loadWorld(worldKey, { spawnId })` y mantiene la sesión de Playtest al cruzar portales entre zonas. |

---

## 3. Estructura de Datos de una Zona (`SCHEMA_VERSION = 2`)

```json
{
  "schemaVersion": 2,
  "id": "zone_...",
  "worldId": "cave_exit_intro",
  "zoneId": "zone_...",
  "zoneOrder": 1,
  "isRootZone": false,
  "name": "Nueva Zona",
  "worldTitle": "Nueva Zona",
  "biome": "cave_exit_intro",
  "layoutPreset": "cave_exit_intro",
  "weather": "pollen",
  "cols": 52,
  "rows": 36,
  "tileSize": 32,
  "playerSpawn": { "x": 249, "y": 288 },
  "spawnPoints": [
    { "id": "default", "label": "Entrada Principal", "x": 249, "y": 288 }
  ],
  "arenaCenter": { "x": 832, "y": 576 },
  "ambientColor": "rgba(5, 8, 17, 0.22)",
  "initialObjective": "Explora esta zona forjada por la Reliquia",
  "enableStealth": false,
  "perimeterConfig": null,
  "terrainGrid": [[0, 0, "..."]],
  "solidColliders": [{ "x": 0, "y": 0, "width": 96, "height": 64 }],
  "stealthZones": [{ "x": 0, "y": 0, "width": 96, "height": 64 }],
  "lights": [{ "x": 0, "y": 0, "radius": 180, "color": "#facc15", "intensity": 0.75, "flickerSpeed": 1.5 }],
  "props": [{ "propType": "world_portal", "x": 0, "y": 0, "targetWorld": "marsh_of_spores", "targetSpawnId": "default" }],
  "entities": [{ "type": "enemy", "x": 0, "y": 0, "archetype": "hound", "element": "plantas" }],
  "clearingTrees": [{ "x": 0, "y": 0 }],
  "foliage": [{ "x": 0, "y": 0 }]
}
```

### Conexión entre Zonas del Mismo Mundo
1. Cada zona declara su Mundo Padre (`worldId`) y su identificador de orden (`zoneOrder`).
2. En el nodo **Inicio de Santi** (`playerSpawn`), el Inspector permite añadir puntos de entrada adicionales en `spawnPoints` (por ejemplo `puerta_norte`, `salida_cueva`).
3. En un prop `world_portal`, `targetWorld` apunta al `id` de la zona destino (o mundo oficial) y `targetSpawnId` indica en cuál entrada aparecerá Santi al cruzar el portal (`InteractableProp` invoca `load_world_hook(targetWorld, { spawnId: targetSpawnId })`).

### Objetos de Ambiente Personalizados (`custom_env_prop`) y Plantillas Reutilizables
1. En la categoría **PROPS**, el elemento **`✦ Objeto Personalizado` (`custom_env_prop`)** permite prototipar objetos específicos directamente en el nivel con:
   * `textureUrl`: Textura subida desde archivo local (`PNG/JPG/SVG`, auto-optimizada hasta `160×160 px` en pixel-art nítido) o ruta del proyecto (ej. `/assets/environment/...`).
   * `customKey` y `label`: Identificador técnico y nombre visible en el editor y en el Playtest.
   * `width` y `height` (`16–384 px`): Dimensiones ajustables desde el Inspector o arrastrando el asa azul en el lienzo (`EntityFootprints` y `InteractableProp._getDimensions` sincronizados 1:1).
   * `isSolid` e `isInteractable`: Configuran colisión física en la base para Y-Sorting e interacción con `[E]` en el Playtest.
   * `devDescription` y `loreText`: Especificación detallada de la funcionalidad deseada para su posterior implementación definitiva en el motor, y texto de prueba al interactuar con `[E]`.
2. **Paleta de Plantillas (`be_a_legend_custom_props_v1`):** El botón **★ En Paleta** del Inspector guarda el objeto personalizado configurado en `localStorage` (`saveCustomPropTemplate` en `EditorCatalog.js`) para reutilizarlo con 1 clic en cualquier zona. El botón **📋 Copiar Spec** copia la ficha técnica al portapapeles.

---

## 4. Controles Multitáctiles, Escritorio y UI Responsiva

* **Navegación multitáctil (`EditorViewport`):**
  * **Pellizco (2 dedos):** Zoom continuo centrado en el punto medio entre ambos dedos.
  * **Arrastre con 2 dedos:** Desplazamiento (*pan*) simultáneo del lienzo; si había un trazo de 1 dedo recién iniciado, se cancela y revierte automáticamente.
  * **Modo Mano (`#btn-editor-pan`, tecla `[H]`):** Permite desplazar el lienzo con 1 solo dedo o clic izquierdo.
* **Escritorio:** Rueda de ratón (zoom hacia el cursor), botón central/derecho o `[H]` (pan), `[1]–[4]` (brochas de terreno), `[V]` (seleccionar/mover), `[G]` (cuadrícula), `Ctrl+Z` / `Ctrl+Y` (Undo/Redo), `[Supr]` (eliminar), `[F5]` (probar) y `[F9]` (volver al editor).
* **Layout responsivo (`ui.css`):** `touch-action: none` en lienzo/overlay, scroll táctil horizontal en pestañas y paleta, y breakpoint `@media (max-aspect-ratio: 1/1), (max-width: 820px)` para reacomodar barra superior e inspector en móviles `9:16`.

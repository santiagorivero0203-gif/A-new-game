# 🏛️ Arquitectura del Motor y Flujo de Ejecución

> **Resumen Técnico:** Motor 2D modular desacoplado en 9 capas bajo `src/`, diseñado para 60/120 FPS estables sin pausas de Garbage Collection ni bloqueos síncronos de I/O.

---

## 1. Taxonomía de las 9 Capas del Motor

```mermaid
graph TD
  MAIN["1. main.js (Orquestador y Context Builder)"] --> CORE["2. core/ (Engine, Input, State, Audio, Resources)"]
  MAIN --> WORLD["3. world/ (LevelLoader, Tilemap, FoliageSystem)"]
  MAIN --> ENT["4. entities/ (EntityManager, Player, Enemy, NPC, Props)"]
  MAIN --> SYS["5. systems/ (Physics, Combat, Interaction, SkillTree, Equipment, Wave)"]
  MAIN --> REN["6. render/ (Renderer, Camera, VFXRenderer, LightManager, CelSpriteAtlas)"]
  MAIN --> UI["7. ui/ + cinematics/ (UIManager, CinematicManager)"]
  SYS --> COMBAT["8. combat/ (FireAbility, KineticAbility, EarthAbility)"]
  SYS --> DATA["9. data/ (weapons, shields, PlayerStats, niveles JSON)"]
```

| Capa | Directorio | Archivos Clave | Responsabilidad Primaria |
| :--- | :--- | :--- | :--- |
| **1. Orquestador** | `src/` | `main.js` | Ciclo de vida principal, instanciación de subsistemas, construcción de `gameContext`, enrutamiento de inputs y cambios de escena. |
| **2. Core** | `src/core/` | `Engine.js`, `InputManager.js`, `StateManager.js`, `AudioManager.js`, `ResourceManager.js`, `ObjectPool.js` | Loop `requestAnimationFrame`, HitStop, entradas teclado/ratón/touch, bus reactivo, síntesis Web Audio y precarga de assets. |
| **3. Entidades** | `src/entities/` | `Entity.js`, `EntityManager.js`, `Player.js`, `Enemy.js`, `NPC.js`, `InteractableProp.js`, `House.js`, `Tree.js` | Objetos interactivos en el mundo con física en los pies, FSMs y etiquetas. |
| **4. Sistemas** | `src/systems/` | `CombatManager.js`, `PhysicsSystem.js`, `InteractionSystem.js`, `SkillTreeManager.js`, `EquipmentManager.js`, `WaveManager.js` | Lógica transversal pura: colisión AABB continua, cálculo de daño/parries/sinergias, radio de interacción `[E]`, árboles de progresión y oleadas. |
| **5. Habilidades** | `src/combat/` | `Ability.js`, `FireAbility.js`, `KineticAbility.js`, `EarthAbility.js` | Factorías de ataques elementales que instancian descriptores de ataque en `CombatManager`. |
| **6. Mundo** | `src/world/` | `LevelLoader.js`, `Tilemap.js`, `FoliageSystem.js` | Generación e instanciación de entidades desde JSON, pre-renderizado estático de suelo y arbustos con física de resorte. |
| **7. Render** | `src/render/` | `Renderer.js`, `Camera.js`, `CelSpriteAtlas.js`, `LightManager.js`, `VFXRenderer.js`, `AnimationController.js` | Y-Sorting por base de pies, Frustum Culling, cámara lerp con screen shake, horneado Cel-Shading 2D y partículas. |
| **8. UI & Escenas** | `src/ui/`, `src/cinematics/` | `UIManager.js`, `ui.css`, `CinematicManager.js` | DOM Overlay libre de reflows con dirty-checking, HUD responsivo y secuencias cinemáticas. |
| **9. Datos** | `src/data/` | `weapons.js`, `shields.js`, `PlayerStats.js`, `assets.json`, `levels/*.json` | Catálogos data-driven desacoplados del código fuente de simulación. |

---

## 2. Inyección Unificada: El Patrón `gameContext`

Para evitar importaciones circulares y variables globales descontroladas, todo el flujo de actualización y renderizado se comunica mediante un único objeto inyectado en cada fotograma (`main.js` -> `buildGameContext(deltaTime)`):

```js
// Estructura inyectada en update(context), takeDamage(..., context), interact(..., context):
const context = {
  deltaTime,           // Tiempo transcurrido en segundos acotado (máx 0.1s)
  input,               // Instancia de InputManager
  state,               // Instancia de StateManager (bus global)
  physics,             // Instancia de PhysicsSystem
  player,              // Referencia a la entidad Player
  camera,              // Instancia de Camera (worldToScreen, shake)
  entityManager,       // Gestor de entidades activas
  combatManager,       // Gestor de proyectiles, tajos y daño
  equipmentManager,    // Armas y escudos activos
  skillTreeManager,    // Progresión y talentos desbloqueados
  waveManager,         // Control de rondas y oleadas de combate
  audioManager,        // Síntesis de efectos sonoros Web Audio
  vfxRenderer,         // Emisor de partículas e impactos
  uiManager,           // Gestor del DOM Overlay
  engine,              // Motor (hitStop, pause)
  time,                // Tiempo total transcurrido
  ctx                  // Contexto 2D del canvas principal
};
```

> [!TIP]
> **Regla Defensiva:** Cualquier invocación a subsistemas opcionales debe protegerse defensivamente:
> `if (context && context.audioManager) context.audioManager.playSwordHit();`
> Esto permite testear entidades y sistemas de combate de forma aislada sin requerir el navegador completo.

---

## 3. Patrones de Rendimiento Anti-GC (Zero-Alloc Hot-Paths)

En un Action-RPG a 60/120 FPS, instanciar objetos en bucles críticos genera caídas bruscas de fotogramas por Garbage Collection. El motor impone reglas estrictas en CPU y GPU/Canvas:

1. **Contexto Persistente (`_gameContext`):**
   `buildGameContext(deltaTime)` en `main.js` actualiza en sitio un único objeto persistente prealocado en lugar de crear un diccionario de 17 propiedades en cada fotograma.
2. **Reutilización de Hitbox (`_hitboxCache`):**
   `Entity.getHitbox()` muta y devuelve su propio objeto prealocado `this._hitboxCache`. **Nunca** guardes la referencia devuelta en colecciones permanentes; lee sus campos inmediatamente (`x`, `y`, `width`, `height`).
3. **Buffer Y-Sort Filtrado (`_sortedBuffer` + `_sortY`):**
   `EntityManager.getEntities()` mantiene un buffer persistente que excluye colisionadores invisibles (`terrain_barrier`) mediante `_bufferDirty`, y precalcula `e._sortY` en $O(N)$ antes de ordenar para reducir comparaciones en `.sort()`.
4. **Caché de Sólidos e Invalidation:**
   `EntityManager.getSolids()` mantiene un arreglo `this._solidsCache`. Solo se recalcula cuando se agrega, remueve o destruye una entidad (`this._solidsCache = null`).
5. **Pasada de Suelo Pre-Entidades y Sprites Pre-horneados:**
   `Renderer.drawEnemyGroundDecals()` dibuja los conos de visión enemigos en la capa del suelo con *Frustum Culling* antes de las sombras de dosel y de los cuerpos Y-Sort, evitando solapamientos sobre arbustos y personajes. Cada entidad dibuja su propia sombra pixel-art sin duplicación genérica y `CelSpriteAtlas.prewarm()` pre-hornea todos los sprites de los 4 biomas al iniciar.
6. **Pools de Objetos Dedicados:**
   * Las estelas fantasma del dash del jugador usan `_ghostPool` con técnica *swap-and-pop*.
   * Las partículas de `VFXRenderer` se extraen de pools preinicializados.
   * La deduplicación de impactos usa colecciones reutilizables.

---

## 4. Máquina de Estados y Bus Reactivo (`StateManager`)

`src/core/StateManager.js` actúa como el bus de eventos desacoplado del juego:

### Estados Globales del Juego (`game_state`)
* `'STATE_MENU'`: Menú principal visible; no se actualiza la física del mundo.
* `'STATE_CINEMATIC'`: Cinemáticas de introducción o diálogos de historia activos.
* `'STATE_PLAYING'`: Bucle completo de juego activo.
* `'STATE_PAUSED'`: Menú de pausa o Santuario del Guantelete abierto.

### API del Bus de Eventos
* `stateManager.on(eventName, callback)`: Suscribe un observador.
* `stateManager.off(eventName, callback)`: Desuscribe un observador.
* `stateManager.emit(eventName, data)`: Notifica a todos los escuchas.
* `stateManager.set(key, value)`: Actualiza una propiedad del estado y emite `state_change` y `state_change:${key}`.
* `stateManager.get(key, defaultValue)`: Consulta el estado centralizado.

---

## 5. El Game Loop (`Engine.js` y `main.js`)

En cada fotograma ejecutado por `requestAnimationFrame`:

```mermaid
sequenceDiagram
  participant RAF as Engine.loop(dt)
  participant MAIN as main.js
  participant IN as InputManager
  participant FOL as FoliageSystem
  participant CM as CombatManager
  participant EM as EntityManager
  participant SYS as Wave & Interaction
  participant REN as Renderer & UIManager

  RAF->>MAIN: update(dt)
  MAIN->>IN: input.update()
  alt engine.hitStopTimer > 0
    Note over RAF: HitStop activo: descuenta timer, congela simulación
  else STATE_PLAYING
    MAIN->>FOL: 1. StealthSystem (solo si enabled === true) o física elástica ligera
    MAIN->>CM: 2. combatManager.update(context)
    MAIN->>EM: 3. entityManager.update(context) [Solo dinámicas]
    MAIN->>SYS: 4. wave.update, interaction.update
    MAIN->>REN: 5. camera.update(playerCenter, dt, aimDir, combatFocus)
  end
  RAF->>MAIN: render(dt)
  MAIN->>REN: camera.apply(), tilemap.render(), getVisibleEntities() + InsertionSort
  MAIN->>REN: drawCanopyShadows(trees), drawEntities(), vfxRenderer.render(), lightManager.compositeTo()
  MAIN->>REN: uiManager.render() [Dirty-Checked + Caché RegEx]
```

---

## 6. Actualización Táctica v2.1.0 (Resolución de Feedback y Pulido de Experiencia Móvil/Gameplay)

### 6.1. Desaturación y Escalado Responsivo de UI (`ui.css`, `index.html`)
- **HUD Jugador**: Escalado a `0.72` en modo táctil y `0.70` en pantallas compactas/horizontales (`max-height: 540px`). Ocultamiento automático de atajos de teclado (`.essence-hotkey`, `.st-nav-key`) en móvil.
- **Cluster Táctil de Acciones**: Botón `#touch-btn-skill` (`68x68 px`) reespaciado para evitar solapamiento de los iconos direccionales sobre **`FUEGO`**; `#touch-btn-stealth` oculto por defecto salvo en secciones de sigilo.
- **Joystick Virtual**: Escalado a `0.80` con caché del `DOMRect` en `InputManager.js` (cero reflows en `touchmove`).

### 6.2. Riberas y Colisiones de Agua (`Tilemap.js` y `PhysicsSystem.js`)
- **Visual**: Transición orgánica de 3 capas sin costuras discontinuas en los ríos.
- **Física Estricta**: Bloqueo total de `tile === 3` (agua) y `tile === 2` (acantilados) con broadphase espacial AABB para descartar obstáculos lejanos en `O(1)`.

### 6.3. Calibración Cinemática y Recurso Táctico (`PlayerStats.js`, `Player.js`, `weapons.js`)
- **Velocidad de Movimiento**: Ajustada a `190 px/s` (`dash_speed: 400`) para desplazamiento ágil y sin pesadez.
- **Regeneración de Energía**: Mantenida en `2.2/s` pasivo y `2/4` por golpe para conservar el balance táctico.

### 6.4. Progresión de Inventario y Armas Bloqueadas (`EquipmentManager.js` y `UIManager.js`)
- El jugador inicia únicamente con `training_sword` y `wooden_shield` desbloqueados; el equipamiento superior figura bloqueado (`BLOQUEADA`) hasta su progreso correspondiente.

### 6.5. Localización Adaptativa de Prompts Móvil (`textFormatter.js`, `UIManager.js`, `NPC.js`, `InteractableProp.js`)
- Reglas ordenadas de mayor a menor especificidad (frases `"Pulsa [...]"` antes que `[...]`), soporte de `[Shift]` y `[1][2][3]`, badges del canvas adaptados (`USAR · ...` en móvil) y caché O(1) en `UIManager` para no ejecutar RegEx en cada frame.

---

## 7. Optimizaciones de Rendimiento y Archivo de Sigilo v2.2.0

### 7.1. Módulo Opcional Compacto `StealthSystem.js` (Desactivado por Defecto)
- Toda la lógica de detección por cono de visión, ocultación en grama alta y viñeta de amenaza en esquinas fue extraída a [`StealthSystem.js`](file:///c:/Users/user/Desktop/video%20proyectos/Be%20a%20legend/src/systems/StealthSystem.js) con **`enabled = false` por defecto**.
- Para reactivarlo únicamente en escenas específicas, basta definir `"enableStealth": true` en el JSON del nivel o invocar `stealthSystem.setEnabled(true, stateManager, player)`. Cuando está activo, usa un cono compacto reducido (`112 px`, `60°`) con comprobación dosificada (`~8 Hz`) y sin trazar rayos sobre enemigos fuera de rango.

### 7.2. Pipeline Gráfico de Canvas Único y Bucle O(1)
- **Resolución Pixel-Art Nativa (`Camera.getOptimalCanvasSize`) + Un Solo Canvas Opaco (`{ alpha: false }`)**: `#main-canvas` renderiza en escala entera compacta y `#light-canvas` opera como buffer offscreen ligero (`<= 320x180`) compuesto directamente vía `lightManager.compositeTo()`, eliminando la doble capa GPU del navegador y liberando `~4x–9x` fill-rate.
- **Caché de Entidades y Culling Previo**: `EntityManager` separa estructuras estáticas (`tree`, `house`, `terrain_barrier`), indexa etiquetas invariantes en cubetas persistentes y ordena por Y-Sort **después** del recorte de cámara usando Insertion Sort in-place.
- **Gestión de Memoria Cinemática (`CinematicManager`)**: Pre-carga inicial de solo 2 diapositivas y liberación automática (`releaseCache()`) de imágenes 4K al iniciar el gameplay, además de eliminar `backdrop-filter: blur(18px)` del menú principal.

---

## 8. Compresión de RAM, Streaming por Chunks y Cero Refresco Ocioso v3.0.0

### 8.1. Patrón Flyweight para Texturas Repetidas (`ProceduralAssets`, `ResourceManager`, `Tilemap`, `CelSpriteAtlas`)
- **Canvas Flyweight Directo**: `ProceduralAssets.getSharedCanvas()` hornea y cachea una única vez cada textura repetitiva (`tree_sprite`, `house_sprite`, `bush_sprite`) sin pasar por codificación/decodificación base64 PNG; `ResourceManager` guarda la referencia compartida única para todas las instancias en escena.
- **Sellos de Loseta por Bioma (`Tilemap`)**: Se pre-hornean solo ~14 losetas base de `32x32` por bioma (`turf_0..3`, `dirt_0..3`, `water_0..3`, `cliff_0..1`, `plaza_0..1`) que se estampan con `drawImage()` en lugar de repintar o mantener un lienzo gigante completo de mundo en RAM.
- **Atlas LRU Bajo Demanda (`CelSpriteAtlas`)**: Se elimina el pre-horneado masivo de ~190 sprites en el arranque; cada variante se genera bajo demanda con un tope LRU (`MAX_CACHED_SPRITES = 56`) y `clear()` al cambiar de bioma.

### 8.2. Carga Espacial por Chunks con Memoria Persistente (`ChunkManager.js` + `Tilemap.js`)
- **Terreno por Chunks (`Tilemap` `256x256 px`, LRU máx. 18 chunks)**: Solo los chunks visibles en cámara se hornean y mantienen en memoria gráfica, liberando (`width = height = 0`) los más antiguos.
- **Entidades por Chunks con Persistencia (`ChunkManager`)**: `LevelLoader` registra planos ligeros agrupados en chunks de `256x256 px` e instancia entidades únicamente en la vecindad de la cámara con histéresis de descarga.
- **Memoria de Estado (`serializeChunkState` / `restoreChunkState`)**: Al descargar un chunk frío, `Enemy`, `InteractableProp` y `NPC` guardan un snapshot compacto en `ChunkManager.entityMemory` (enemigos derrotados, tiempo restante de reaparición calculado por reloj, escudos de madera quemados, zarzas/rocas destruidas, espada recogida y progreso de rescate de Valerio).

### 8.3. Campo de Agresividad Enemigo Acotado (`Enemy.js`)
- Radios `aggroRange` reducidos (`hound: 136`, `tank: 128`, `duelist: 148`, `artillery: 164`, `slime: 120`), umbral de reposo en IA (`340 px`) y correa territorial (`200 px`) con pérdida de aggro en `2.0 s` fuera de rango (manteniendo cobertura en arena para `wave_enemy`).

### 8.4. Carga Perezosa de Menús y Cero Bucles Innecesarios (`Engine.js`, `main.js`, `UIManager.js`, `ui.css`)
- **Cero Bucle Ocioso (`Engine.js`)**: `engine.pause()` cancela el `requestAnimationFrame` pendiente en lugar de seguir refrescando 60/120 veces por segundo; en `STATE_CINEMATIC` el bucle se pausa automáticamente al terminar el efecto máquina de escribir hasta la siguiente interacción (`onWake`), y la pestaña oculta (`visibilitychange`) detiene el bucle.
- **Carga Perezosa de Mundo, Cinemáticas y Menús**: Al iniciar en `#main-menu` NO se pre-cargan cinemáticas, entidades, sprites ni el Santuario. Al salir del menú se libera `cover.jpg` (`.menu-cover-active`), `UIManager.unmountSanctuary()` limpia el DOM/texturas del Santuario al cerrarlo (`menu_sanctuary_bg.jpg`, `skill_combat_preview.jpg`), `LightManager` limita re-horneados a `~30 Hz`, y `.hidden *` pausa animaciones CSS.




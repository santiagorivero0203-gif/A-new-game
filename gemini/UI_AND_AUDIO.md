# 🎨 Interfaz Responsiva (HUD), Efectos Visuales y Audio Procedural

> **Resumen Técnico:** Arquitectura de HUD desacoplada de alto rendimiento mediante DOM Overlay con *dirty-checking* (0 reflows innecesarios), síntesis sonora procedimental con Web Audio API (cero dependencias de archivos de sonido) y renderizado de partículas 2D.

---

## 1. Arquitectura de Interfaz: Las 4 Reglas del HUD Responsivo

La interfaz del juego vive en el DOM HTML (`index.html` + `src/ui/ui.css` + `src/ui/UIManager.js`) superpuesta al Canvas. Sigue estrictamente 4 reglas de diseño para pantallas de escritorio (16:9) y móviles táctiles (9:16):

```
┌─────────────────────────────────────────────────────────────┐
│ [TOP-LEFT] Ancla Periférica       [TOP-RIGHT] Notificaciones│
│  • Corazones (Vida)                • Esencia Ancestral (✦)  │
│  • Barra de Postura / Guardia      • Objetivos de Misión    │
│                                                             │
│                    [CENTER] Modales                         │
│                    • Hub del Santuario                      │
│                    • Cuadros de Diálogo                     │
│                                                             │
│ [BOTTOM-LEFT] Habilidades        [BOTTOM-RIGHT] Controles   │
│  • Guantelete Elemental           • Pad Táctil Virtual      │
│  • Barra de Energía Arcana        • Botones de Acción       │
└─────────────────────────────────────────────────────────────┘
```

1. **Anclas Periféricas:** Los indicadores de supervivencia (salud, postura) se anclan a las esquinas superiores; los controles y habilidades activas a las inferiores.
2. **Pivotes Coincidentes (`transform-origin`):** Los contenedores fijados a `top: 0; left: 0` deben usar escalado desde `top left` para no deformar las barras de vida en resoluciones escaladas.
3. **Anclaje Central Separado:** Diálogos narrativos y el modal del Santuario (`#skill-tree-modal`) se anclan al centro exacto mediante `top: 50%; left: 50%; transform: translate(-50%, -50%)`.
4. **Breakpoints 16:9 vs 9:16:** Mediante media queries en `ui.css`, en orientación vertical o pantallas móviles (`@media (max-width: 768px)` o `aspect-ratio < 1`):
   * Se ocultan atajos de teclado y se muestran joysticks virtuales táctiles.
   * Las barras de estado reducen su ancho y padding un 30%.

---

## 2. El Patrón de *Dirty-Checking* en `UIManager.js`

`UIManager.updateHUD(player, state)` se invoca en cada fotograma del motor, pero **NUNCA modifica el DOM directamente sin verificar un cambio real**.

```js
// Patrón de sombras en UIManager:
updateHealth(currentHealth, maxHealth) {
  // Solo muta el DOM si cambió el número de corazones
  if (this._lastHealth === currentHealth && this._lastMaxHealth === maxHealth) {
    return; // 0 REFLOWS
  }
  this._lastHealth = currentHealth;
  this._lastMaxHealth = maxHealth;
  this._renderHearts(currentHealth, maxHealth);
}

updateEnergy(energy, maxEnergy) {
  const pct = (energy / maxEnergy) * 100;
  // Umbral de tolerancia de 0.4% para evitar oscilaciones sub-píxel
  if (Math.abs(pct - this._lastEnergyPct) < 0.4) return;
  this._lastEnergyPct = pct;
  this.energyBarEl.style.width = `${pct}%`;
}
```

---

## 3. Estética Artesanal de la Reliquia (`ui.css`, `UIManager.js`, `CinematicManager.js`)

* **HUD Sin Marco Azul y Animaciones de Curación / Daño / Energía (`#hud-container.rpg-player-hud`):** Se eliminó la pesada tarjeta azul marino y cualquier tono azul en el HUD del jugador en favor de un diseño flotante en obsidiana cálida, rubí carmesí, esmeralda y bronce forjado (`background: transparent; border: none`). Los carriles de Vitalidad y Energía usan canales de obsidiana (`#110c09`) con bisel bronce, rastro dorado de daño con retardo de `130ms` + caída de `480ms` (`#hud-hp-ghost-fill`), rastro de gasto energético (`110ms` en `#hud-energy-ghost-fill`) y destello de carga (`.hud-energy-fill.is-gaining`), destello esmeralda-dorado al curarse tanto en UI (`.hp-chassis.is-healing`, `.hp-fill.is-healing`, `@keyframes hp-heal-surge` y `.relic-heart-svg.heart-restored` con limpieza tras `740ms`) como en el mundo (`heal_pulse` en `VFXRenderer` + número flotante `+1 ♥` / `¡ESCUDO VITAL!` + salto elástico en `Player`), halo pulsante de Escudo de Vitalidad (`.hp-chassis.has-vitality-shield`, `@keyframes hp-shield-aura`), pulso al rotar poder (`.rpg-crest-module.crest-pulse` y `.swipe-hint.is-active` / `.is-locked` en `#touch-btn-skill`) y sacudida de impacto al recibir daño (`.rpg-player-hud.is-damaged` + `.relic-heart-svg.heart-shattered`). La barra del Escudo/Égida (`#hud-posture-wrap`) permanece tenue al `100%` en reposo y se realza en ámbar forjado (`#f59e0b` / `#fde68a`) al bloquear o recibir daño, mientras Resistencia (`#hud-stamina-wrap`) usa esmeralda (`#6ee7b7` / `#34d399`) y se oculta automáticamente al `100%` (`is-idle`). La salud de los enemigos y jefes **no se muestra en el HUD superior (`#boss-threat-bar` permanece oculto)** para no desorientar la vista; se dibuja directamente encima de cada enemigo en coordenadas de mundo (`Enemy.draw`).
* **Línea de Rumbo Minimalista estilo *God of War Ragnarök* (`#objective-hud-tracker.gow-compass-hud` + `_updateCompassBearing`):** Sustituye la caja opaca superior por una regla horizontal fina (`1px`) sin recuadro pesado y con puntos cardinales adaptativos por hemisferio (`O · NO · N · NE · E` cuando el objetivo está al norte o `O · SO · S · SE · E` cuando está al sur vía `#compass-card-nw`, `#compass-card-center`, `#compass-card-ne`), diamante indicador flotante sobre la línea (`#compass-target-marker`) teñido por tipo de objetivo (`story` dorado, `core` color elemental del mundo, `boss` carmesí) con pulso `.is-arrived` al llegar (`<= 2m`), flecha direccional (`#compass-target-dir`: `▲/▼/◄/►/◆`) y distancia exacta en metros con ancho tabular (`#compass-target-dist`) rastreando incluso sellos en chunks no montados (`chunkManager.entityMemory` + `resolvedLinks`), acompañada únicamente del subtítulo limpio (`#objective-hud-text`).
* **Árbol de Habilidades en 2 Pasos (Inspeccionar antes de Desbloquear + Libre Elección):** En `UIManager.renderSkillTree`, tocar o hacer clic sobre cualquier nodo octogonal (`.st-octa-node`) **únicamente selecciona e inspecciona** la habilidad en el panel lateral (`selectAndInspectNode`, protegido contra gestos de desplazamiento móvil `< 12 px` con `touchStartX`/`touchStartY` y flash visual `.inspector-flash`), mostrando su descripción, rango, coste de Esencia y efectos sin comprarla automáticamente. El desbloqueo o mejora ocurre exclusivamente al pulsar `#st-inspector-buy-btn` (`DESPERTAR HABILIDAD` / `MEJORAR RANGO`), disparando la animación `.just-unlocked` sobre el nodo adquirido y corrigiendo los diamantes superiores de disciplina (Escudo en Égida, Espada en Ira del Acero, Llama en Reliquia). Además, `SkillTreeManager.areDependenciesMet(skillId)` permite elegir libremente qué habilidad desbloquear de cualquier rama siempre que se disponga de la Esencia requerida.
* **Tutorial Guiado Interactivo con Pausas, Reflectores Aislados y Repetición (`#tutorial-scrim` + `#tutorial-guide-overlay`):** Durante la apertura del Mundo 1 (`cave_exit_intro`), el juego realiza 3 pausas formativas (`step_1_hud`, `step_2_combat`, `step_3_powers`) con bloqueo de acciones/atajos subyacentes, atenuación por `#tutorial-scrim` (`z-index: 62`) y ruptura limpia de *stacking context* (`body.tutorial-active` + `.tutorial-spotlight-host` en `z-index: 65` sobre `#hud-gameplay-layer` y `#virtual-gamepad`) para que `.tutorial-spotlight-active` ilumine los elementos reales del HUD (barras vitales, brújula, botones de combate/poder, curación y `#btn-quick-talents`) por debajo de la tarjeta (`z-index: 68`) con indicador de pasos (`#tutorial-step-dots`) y opción permanente `#btn-replay-tutorial` (`VER GUÍA`) en Ajustes.
* **Minimapa Periférico DOM (`#hud-minimap-wrap` + `MinimapRenderer.js`):** Anclado en `top-right` (`transform-origin: top right`, `92×92 px` en escritorio y `72×72 px` en `9:16`) con `position: static` explícito en `#hud-minimap-canvas` para permanecer contenido dentro de su marco, preferencia persistente (`be_a_legend_ui_prefs_v1`) y plegado por clic o tecla `[N]`.
* **Controles Táctiles Ergonómicos y Diálogo Bottom-Center (`ui.css`, `UIManager.js`, `index.html`, `InputManager.js`):** `#game-container` usa `100dvw × 100dvh` (con respaldo `100vw × 100vh`) para evitar recortes en barras móviles; los controles táctiles eliminan todo reescalado agresivo (`scale(<0.9)`) y usan tamaños fluidos `clamp()` con mínimo estricto de `44 px` en botones mini, `48–84 px` en acciones principales y `110 px` en base de joystick (3 columnas compactas en horizontal y retrato `9:16` con `--touch-dock-height: 228px`) y etiquetas `>= 9 px` (adaptadas con `9px` en `.skill-btn`, con `.touch-action-btn .swipe-hint svg` explícito en `8 px`). El gamepad simplificado unifica **Dash (1 toque) y Correr/Sprint (doble toque)** en `#touch-btn-dash`, **Agachar/Sigilo/Slide** al tocar el centro del joystick (`.joystick-crouch-dot`), y cambio elemental sincronizado (`setCurrentPowerGetter`) mediante `#touch-btn-switch` (`touchstart` con respaldo seguro en `touchend` sin doble disparo y `click`), swipe o toque directo en los 4 iconos cardinales `.swipe-hint[data-power]` de `#touch-btn-skill` (con respaldo automático al siguiente poder desbloqueado si el cuadrante está sellado o ya activo), toque único (`addTouchClick`) en `#hud-relic-badge`, clic/toque o liberación de `[Tab]` en `.radial-sector` y botones `[data-equip-element]` del Arsenal. En móvil horizontal (`min-aspect-ratio: 1/1`), `#dialogue-card` se posiciona en la franja inferior central entre el joystick y la botonera (`--touch-cluster-reserve: clamp(192px, 50vh, 232px)` en `max-height: 540px`, `max-width: min(460px, 46vw)`, máximo 3 líneas con `-webkit-line-clamp: 3`) mientras `body.dialogue-open` oculta `#combo-hud`; en vertical (`9:16`) se eleva sobre `--touch-dock-height`.
* **Transición de Teletransporte y Epílogo Final (`#world-teleport-overlay`, `#victory-epilogue-overlay`):** Al cruzar un portal desbloqueado entre mundos o viajar desde el Códice, se reproduce una animación de haz vertical sobre Santi y un vórtice cromático (`Z-65`). En la primera visita a Mundos 2, 3 y 4 se ejecuta un paneo breve de cámara hacia el pedestal del Núcleo Elemental correspondiente. Al derrotar al Arconte del Eclipse en la Ciudadela Astral y cruzar el Altar de la Unificación se despliega el Epílogo Final reactivo al Karma (`Z-75`).
* **Ajustes Diferenciados (Menú Principal vs In-Game) y Versión (`vite.config.js`):** Al abrir Ajustes desde `#main-menu`, `#skill-tree-modal` activa `.is-main-menu-settings` (oculta pestañas/recursos de partida y muestra únicamente configuración global, controles, `VOLVER AL TÍTULO` y `BORRAR PROGRESO GUARDADO`); en partida abre el Santuario completo de 4 pestañas con pausa y `REINICIAR CAMPAÑA`. Ambos modos muestran la etiqueta `#st-build-version` inyectada vía `__APP_VERSION__` (`vite.config.js`) junto con cabeceras anti-caché en `index.html`.
* **Cinemáticas "Crónica de la Reliquia" (`CinematicManager.js`):** Reemplaza estilos neón por tablilla tallada en obsidiana cálida y bronce envejecido con franjas *letterbox*, escudo heráldico reactivo por personaje (`data-speaker`), diamantes de progreso de escena (`#cinematic-progress-pips`), detección táctil en `#cinematic-prompt-text` (oculta `[Espacio]` en móvil), compactación responsiva en pantallas móviles/horizontales (`@media (max-height: 540px)` con `max-width: min(620px, 72vw)`, `min-height: 0` y pie reducido únicamente a pastillas de progreso) y carga segura `encodeURI` en `<img id="cinematic-img-el">`.
* **Rastro de Daño en Postura (`#hud-posture-ghost-fill`):** La barra principal responde en `14ms`, mientras que la sub-barra de rastro dorada/blanca decae con `320ms ease-out` tras impactos o bloqueos pesados.
* **Biselado Angular de la Reliquia (`clip-path: polygon(...)`):** Las barras, tarjetas del Atlas (`.st-world-card`) y botones táctiles sustituyen bordes web genéricos por chaflanes angulares simétricos/asimétricos con respuesta háptica en `75ms`.

---

## 4. Sistema de Audio Procedural Reactivo (`AudioManager.js`)

El juego sintetiza sonido en tiempo real mediante **Web Audio API** sin pistas pregrabadas `.mp3`/`.wav`:

### Bus Maestro y Variación Orgánica
* **Filtro Pasa-Bajos Crítico (`BiquadFilterNode` `'lowpass'`):** La cadena maestra opera abierta en `20000 Hz`; `setCriticalAudioState(true)` la cierra suavemente a `380 Hz` cuando el jugador queda en 1 corazón o sufre rotura de guardia (`STATE_STAGGERED`).
* **Aleatorización Acústica:** `_randPitch()` (`±7%`) y `_randGain()` (`±10%`) evitan fatiga repetitiva en combos continuos.

### Catálogo de Efectos y Ambientes
* `playSwordSwing()` / `playDash()` / `playParry()` / `playExplosion()` / `playEnemyAlert()` / `playShieldBreak()` / `playHeal()`.
* `playHitImpact(type, material)`: Superpone capas según material objetivo (`'armor'`, `'wood'`, `'slime'`, `'stone'`, `'flesh'`).
* `playRunicResonance()`: Acorde armónico cristalino al activar altares, portales u obeliscos rúnicos.
* `setBiomeAmbience(biomeKey)` / `stopBiomeAmbience()`: Ambientes procedimentales filtrados continuos para los 4 biomas.

> [!NOTE]
> `AudioManager` inicializa su `AudioContext` en estado `suspended` hasta la primera interacción del usuario, activando automáticamente `_currentBiome` tras desbloquear el contexto.

---

## 5. Iluminación Hue-Shifted, Clima Zero-GC y Renderizado 2D

* **Horneado Hue-Shifted (`CelSpriteAtlas.js` y `ProceduralAssets.js`):** Contornos de tinta oscura `#0b101d`, sombras frías desplazadas hacia índigo/púrpura y luces cálidas hacia ámbar. Incluye sprites dedicados para `slime`, `broken_statue`, `rusted_greatsword`, `runic_obelisk` y `world_portal`.
* **Tilemap Dual-Grid y Acantilados (`Tilemap.js`):** Pre-renderizado estático en capas con transiciones Dual-Grid desplazadas `-tileSize/2` y acantilados en Proyección de Gabinete por bioma.
* **Iluminación Dinámica y Sombras de Dosel (`LightManager.js` + `Renderer.js`):** Tintes atmosféricos por bioma (`setBiomeAtmosphere`), halos de color aditivos, consulta `getNearestLight(...)` Zero-GC para estirar elipses de sombra en los pies, y sombras móviles de copas (`drawCanopyShadows`).
* **Clima Ambiental y Partículas (`VFXRenderer.js`):** Pool Zero-GC para `updateBiomeWeather(dt, camera, weatherKey)` (`pollen`, `spores`, `embers`, `stardust`) junto con impactos y sinergias de combate.


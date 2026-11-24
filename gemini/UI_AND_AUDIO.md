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

* **HUD Sin Marco Azul, Umbrales de Energía y Notificación de Talento (`#hud-container.rpg-player-hud`):** Toda la interfaz en partida (HUD del jugador, minimapa, rueda radial, gamepad táctil y Santuario) comparte la estética unificada de **obsidiana cálida (`#120e0b`) y bronce envejecido**, eliminando cualquier marco o fondo azul frío. Los carriles de Vitalidad y Energía usan canales biselados de obsidiana, rastro dorado de daño (`130ms` + caída de `480ms`), escala real de energía máxima (`player_max_energy`, reflejando bonificaciones como `Catalizador Omega` hasta `135`) y muescas de umbral dinámicas para Curación (`#hud-energy-heal-tick`) y Poder Fuerte (`#hud-energy-strong-tick`). Al curarse se activan animaciones coordinadas (`.hp-chassis.is-healing`, `.hp-fill.is-healing`, `.relic-heart-svg.heart-restored`, VFX `heal_pulse` en mundo), halo de Escudo Vital (`.has-vitality-shield`), pulso de poder en `#hud-relic-badge`, sacudida de impacto (`.is-damaged`) y un punto dorado de aviso (`#hud-talent-badge-dot` + `.can-upgrade`) sobre `#btn-quick-talents` en cuanto hay Esencia suficiente (`SkillTreeManager.hasAffordableSkill()`). La barra de Postura (`#hud-posture-wrap`) permanece tenue en reposo y se realza en ámbar forjado, Resistencia (`#hud-stamina-wrap`) usa esmeralda ocultándose en reposo, y la vida de los enemigos se renderiza únicamente encima de ellos en mundo (`Enemy.draw`).
* **Línea de Rumbo Minimalista estilo *God of War Ragnarök* y Faro Perimetral en Minimapa (`#objective-hud-tracker` + `MinimapRenderer.js`):** La brújula superior sin recuadro proyecta el diamante indicador por hemisferio (`O · NO · N · NE · E` / `SO · S · SE`) con distancia en metros y color por tipo de objetivo (`story`, `core`, `boss`), ahora sincronizada con un **faro perimetral `'objective'`** en `MinimapRenderer` que se sujeta al borde del radar cuando el objetivo queda lejos o en un chunk sin montar.
* **Árbol de Habilidades Progresivo, 36 Iconos Únicos e Inspector Reactivo (`UIManager.js` + `ui.css`):** En `renderSkillTree`, los 3 carriles por disciplina (`ÉGIDA`, `ACERO`, `RELIQUIA`) muestran subtítulos de senda, conductos animados (`conduit-flow` / `conduit-surge` al energizar), ondas de despertar (`node-awakening-shockwave`), barras de progreso por disciplina y barra de meta hacia el próximo desbloqueo (`#st-next-unlock-fill` + `#st-top-mastery`). Cada uno de los 36 nodos posee un icono SVG semántico único en `_getSkillSvgIcon`, el panel de previsualización (`#st-preview-img`) cambia dinámicamente entre ilustraciones obsidiana-bronce por disciplina (`skill_aegis_preview.jpg`, `skill_wrath_preview.jpg`, `skill_relic_preview.jpg`) sobre fondo ambiental cálido (`menu_sanctuary_bg.jpg`), y tocar un nodo inspecciona sus datos (`selectAndInspectNode` con filtro anti-arrastre `< 12 px`) antes de confirmar en `#st-inspector-buy-btn`, con botón `.st-respec-btn` (`REEMBOLSAR` 100%) y resumen en vivo de Arsenal (`.st-arsenal-summary-strip`).
* **Tutorial Guiado Interactivo con Pausas, Reflectores Aislados y Repetición (`#tutorial-scrim` + `#tutorial-guide-overlay`):** Durante la apertura del Mundo 1 (`cave_exit_intro`), el juego realiza 3 pausas formativas (`step_1_hud`, `step_2_combat`, `step_3_powers`) sobre una tablilla con textura tallada en obsidiana y bronce (`/assets/ui/tutorial_tablet_bg.jpg`), con cuerpo deslizable independiente (`.tutorial-guide-body` con `overflow-y: auto`) y pie fijo (`.tutorial-guide-footer` `flex-shrink: 0`) para que `#btn-tutorial-next` permanezca siempre visible en pantallas `16:9` y `9:16`. Permite avanzar pulsando `#btn-tutorial-next`, tocando brevemente la tablilla/fondo (`tutorialGuideOverlay` / `#tutorial-scrim` protegido contra arrastres de scroll `< 12 px` y doble disparo) o con `[Espacio]` / `[Enter]` / `[Esc]`, mientras `InputManager` y las reglas ID-específicas `body.tutorial-active #hud-gameplay-layer, body.tutorial-active #virtual-gamepad` bloquean por completo clics/atajos subyacentes; los elementos iluminados rompen el *stacking context* en `z-index: 65` con `.tutorial-spotlight-host` debajo de la tablilla (`z-index: 68`) y el botón permanente `#btn-replay-tutorial` (`VER GUÍA`) en Ajustes permite repetir la guía.
* **Minimapa Periférico DOM (`#hud-minimap-wrap` + `MinimapRenderer.js`):** Anclado en `top-right` (`transform-origin: top right`, `92×92 px` en escritorio y `72×72 px` en `9:16`) con marco en obsidiana/bronce, preferencia persistente (`be_a_legend_ui_prefs_v1`), faro de objetivo perimetral y plegado por clic o tecla `[N]`.
* **Controles Táctiles Reactivos, Aviso Contextual `[E]` y Diálogo Descartable (`ui.css`, `UIManager.js`, `InteractionSystem.js`, `InputManager.js`):** El gamepad virtual adopta el color del elemento equipado (`--skill-accent`), atenúa botones sin energía suficiente (`.is-insufficient`) o con espada bloqueada (`.is-locked`), cambia la etiqueta de `#touch-btn-heal` entre `CURAR` / `ESCUDO` / `ACTIVO` según salud y buff activo (pulsando `.is-urgent` con 1 corazón), e ilumina `#touch-btn-interact` junto al nuevo aviso flotante `#hud-interact-prompt` (`InteractionSystem.updateProximityState()`) al acercarse a NPCs, Altares, Estelas o Pedestales. `#dialogue-card` muestra barra de duración (`#dialogue-timer-fill`), color heráldico por interlocutor y puede cerrarse al tocarla/clicarla.
* **Transición de Teletransporte y Epílogo Final (`#world-teleport-overlay`, `#victory-epilogue-overlay`):** Al cruzar un portal desbloqueado entre mundos o viajar desde el Códice, se reproduce una animación de haz vertical sobre Santi y un vórtice cromático (`Z-65`). En la primera visita a Mundos 2, 3 y 4 se ejecuta un paneo breve de cámara hacia el pedestal del Núcleo Elemental correspondiente. Al derrotar al Arconte del Eclipse en la Ciudadela Astral y cruzar el Altar de la Unificación se despliega el Epílogo Final reactivo al Karma (`Z-75`).
* **Ajustes Diferenciados, Interruptores Animados y Doble Confirmación (`vite.config.js` + `main.js` + `ui.css`):** Al abrir `#skill-tree-modal` se reproduce `sanctuary-opening` (`st-backdrop-fade` + `st-window-open`) y al cambiar de pestaña `st-pane-enter`. Desde `#main-menu`, `.is-main-menu-settings` oculta pestañas/recursos de partida y deja solo ajustes globales (`VOLVER AL TÍTULO`, `BORRAR PROGRESO GUARDADO`); en partida abre el Santuario completo de 4 pestañas con pausa y `REINICIAR CAMPAÑA`. Audio, Gamepad Táctil y Minimapa usan interruptores deslizantes `.st-switch-btn` con respuesta `.setting-card-pop`, mientras los botones destructivos exigen doble toque de confirmación (`.confirm-armed`, 3.5 s). Ambos modos muestran `#st-build-version` (`__APP_VERSION__`) y cero tonos azul marino residuales.
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
* `playSmashKOFinish(isMajorBoss)` / `playBossIntroRoar(element)` / `playForgeHammer()` / `playPotionBrew()`: Síntesis dramática para remates de Jefe/Subjefe, rugidos de arena y oficios de ciudad.
* `setBiomeAmbience(biomeKey)` / `stopBiomeAmbience()`: Ambientes procedimentales filtrados continuos para los 4 biomas.

> [!NOTE]
> `AudioManager` inicializa su `AudioContext` en estado `suspended` hasta la primera interacción del usuario, activando automáticamente `_currentBiome` tras desbloquear el contexto.

---

## 5. Iluminación Hue-Shifted, Clima Zero-GC y Renderizado 2D

* **Horneado Hue-Shifted y Animación Multi-Frame (`CelSpriteAtlas.js`, `Tilemap.js`, `Tree.js`, `House.js`, `FoliageSystem.js`):** Contornos `#0b101d`, caché extendida (`MAX_CACHED_SPRITES = 360`), sprites de 4 fotogramas para NPCs (`tarak`, `valerio`, `blacksmith`, `alchemist`, `guard`, `villager` con parpadeo), 3 fotogramas para enemigos/subjefes/jefes con Squash & Stretch anclado al suelo y arco de tajo, 16 fachadas únicas por bioma (`4 biomas × cottage/forge/alchemist/civic`) con humo, chispas y banderines animados, copas de árboles y arbustos con balanceo orgánico al viento, más fluidos vivos por bioma en `Tilemap.renderFluidAnimations()` (ondas de agua, esporas cenagosas, chispas de magma y destellos estelares).
* **Tienda RPG de Artesanos (`#artisan-shop-modal` + `UIManager.renderArtisanShop`):** Interfaz modular en obsidiana y bronce que despliega mejoras permanentes de Herrería (`FORJAR`) y destilados de Mago Alquimista (`DESTILAR` / `BEBER`) al interactuar con artesanos en cada ciudad regional.
* **Tilemap Dual-Grid y Acantilados (`Tilemap.js`):** Pre-renderizado estático en capas con transiciones Dual-Grid desplazadas `-tileSize/2` y acantilados en Proyección de Gabinete por bioma.
* **Iluminación Dinámica y Sombras de Dosel (`LightManager.js` + `Renderer.js`):** Tintes atmosféricos por bioma (`setBiomeAtmosphere`), halos de color aditivos, consulta `getNearestLight(...)` Zero-GC para estirar elipses de sombra en los pies, y sombras móviles de copas (`drawCanopyShadows`).
* **Clima Ambiental y Partículas (`VFXRenderer.js`):** Pool Zero-GC para `updateBiomeWeather(dt, camera, weatherKey)` (`pollen`, `spores`, `embers`, `stardust`) junto con impactos y sinergias de combate.


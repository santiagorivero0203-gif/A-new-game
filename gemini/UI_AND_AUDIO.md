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

## 3. Estética Artesanal de la Reliquia (`ui.css` y `UIManager.js`)

* **Rastro de Daño en Postura (`#hud-posture-ghost-fill`):** La barra principal responde en `14ms`, mientras que la sub-barra de rastro dorada/blanca decae con `320ms ease-out` tras impactos o bloqueos pesados.
* **Biselado Angular de la Reliquia (`clip-path: polygon(...)`):** Las barras, tarjetas del Atlas (`.st-world-card`) y botones táctiles sustituyen bordes web genéricos por chaflanes angulares simétricos/asimétricos con respuesta háptica en `75ms` (`scale(1.05)` hover, `scale(0.95)` active).
* **Hub 3×4 Multi-Rango y Atlas de Mundos:** `renderSkillTree` organiza 3 carriles por disciplina con insignias `R{rank}/{maxRank}` y requisitos de rama (`reqTreePoints`); `renderCodexTab` renderiza el Atlas interactivo con los 4 biomas conectados mediante `stateManager.get('load_world_hook')`.

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


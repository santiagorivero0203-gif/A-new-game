---
name: responsive-game-hud
description: >-
  Enforces the 4-rule Responsive Game HUD and UI Architecture (Peripheral Anchors,
  Matching Corner Pivots, Separated Stretch Anchors, and 16:9 vs 9:16 Aspect-Ratio
  Breakpoints) for Canvas, WebGL, DOM Overlay, and Mobile/CapacitorJS interfaces.
  Use this skill whenever designing, auditing, or modifying game HUDs, overlays,
  health bars, menus, or touch controls.
---

# Responsive Game HUD & UI Architecture

Cuando diseñes, audites o ajustes un HUD o interfaz sobre lienzo (**Canvas / WebGL / DOM Overlay / Mobile**), aplica **siempre** estas 4 reglas arquitectónicas para evitar que la interfaz se desborde, recorte o solape al alternar entre formato panorámico **16:9 (horizontal)** y retrato **9:16 (vertical)**:

---

## 1. Anclas (Anchors) por Periferia

- **Prohibido posicionar módulos periféricos respecto al centro de la pantalla** (evita `top: 50%` o `left: 50%` en paneles laterales o esquineros).
- Ancla cada módulo directamente a su esquina o borde periférico correspondiente respetando `env(safe-area-inset-*)`:
  - **`top-left`:** Estado vital del jugador (vida, energía, postura, bufos, medidor de combo).
  - **`top-right`:** Minimapa, recursos globales (esencia/monedas), medidores auxiliares y pausa.
  - **`bottom-left`:** Joystick virtual analógico o pad direccional táctil.
  - **`bottom-right`:** Clúster ergonómico de botones de acción, habilidades y esquiva.

## 2. Alineación Estricta de Pivote (Pivot / `transform-origin`)

- El punto de pivote de cada contenedor **debe coincidir exactamente con su esquina o borde de anclaje**.
- **Nunca** dejes el pivote por defecto en el centro `(0.5, 0.5)` / `50% 50%` en elementos anclados a bordes o esquinas; de lo contrario, cualquier escalado responsivo (`scale()`) o animación empujará el módulo fuera del viewport al reducir la pantalla:
  - Módulo `top-left` → `transform-origin: top left` (`Pivot (0, 0)` / `origin-top-left`)
  - Módulo `top-right` → `transform-origin: top right` (`Pivot (1, 0)` / `origin-top-right`)
  - Módulo `bottom-left` → `transform-origin: bottom left` (`Pivot (0, 1)` / `origin-bottom-left`)
  - Módulo `bottom-right` → `transform-origin: bottom right` (`Pivot (1, 1)` / `origin-bottom-right`)
  - Módulo `top-center` / `bottom-center` → `transform-origin: top center` / `bottom center`

## 3. Anclas Separadas (*Stretch*) para Barras Dinámicas y Contenedores Centrales

- En barras de vida de jefes, subtítulos, tarjetas de diálogo o contenedores centrales largos, **no uses `left: 50%; transform: translateX(-50%)` con anchos rígidos**.
- Separa las anclas izquierda y derecha (`left: var(--safe-left); right: var(--safe-right); width: auto; max-width: <valor>; margin-inline: auto;` o `w-full max-w-* mx-*`) para que el contenedor se estire o contraiga fluidamente según el espacio horizontal disponible sin desbordar jamás en `320px–430px`.

## 4. Breakpoints por Proporción (`16:9` Horizontal vs `9:16` Vertical)

Usa consultas de proporción y anchura (`@media (max-aspect-ratio: 1/1), (max-width: 820px)`) para reorganizar las filas centrales al pasar a formato vertical o pantallas estrechas:

1. **Paneles Superiores Centrales (ej. Misiones / Objetivos):**
   - En **16:9**: centrados en el borde superior (`top-center`).
   - En **9:16 / estrecho**: se desplazan a una **fila debajo del panel de estado superior izquierdo (`top-left`)**, evitando chocar con los botones de `top-right`.
2. **Barras Centrales Inferiores (ej. Inventario rápido / Barra de poderes / Diálogos):**
   - En **16:9 sin controles táctiles**: apoyadas sobre el borde inferior seguro (`bottom-center`).
   - En **9:16 o con controles táctiles activos**: se **elevan a una fila por encima de los controles táctiles** (`bottom: calc(var(--safe-bottom) + var(--touch-dock-height))`) para no solaparse jamás con el joystick (`bottom-left`) ni con los botones de acción (`bottom-right`).

---

## Lista de Verificación Rápida (Pre-Entrega)

- [ ] ¿Ningún módulo periférico usa `top: 50%` o `left: 50%`?
- [ ] ¿Cada esquina define explícitamente su `transform-origin` coincidente (`top left`, `top right`, `bottom left`, `bottom right`)?
- [ ] ¿Las barras de jefes, diálogos y paneles largos usan anclas separadas `left` + `right` + `max-width` en vez de `translateX(-50%)`?
- [ ] ¿Al probar en `9:16` (ej. `390x844`) el panel de misión baja bajo `top-left` y la barra rápida/diálogo sube sobre el joystick y botones táctiles sin solapamientos?

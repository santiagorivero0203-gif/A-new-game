# ⚔️ Be a Legend: El Legado de la Reliquia

> **Action-RPG 2D Top-Down** de ritmo rápido en alta fidelidad Pixel Art, con mecánicas de combate *Push-Forward*, sistema de defensa *Risk/Reward* (Parry perfecto y gestión de postura), sinergias elementales y narrativa cinemática data-driven estilo *The Minish Cap*.

---

## 📜 1. Historia y Lore del Juego

### El Cataclismo del Trono
En el corazón del reino sagrado, la **Reliquia Ancestral** —un artefacto milenario capaz de canalizar y mantener el equilibrio entre las fuerzas del Fuego, la Tierra y la Cinética— custodiaba la paz de las tierras altas. 

Sin embargo, las fuerzas invasoras lideradas por el tirano **Vortigern** y su lugarteniente oscuro **Kragot** rompieron las defensas del bastión real. Durante el asedio al Salón del Trono, el sabio guardián **Tarak** intentó contener la transgresión, pero la reliquia fue violentamente fracturada en fragmentos primordiales. La onda expansiva resultante no solo derribó a los guardianes, sino que rasgó el equilibrio elemental de todo el territorio.

### El Despertar del Héroe
**Santi**, un joven iniciado que sobrevivió milagrosamente a la caída del castillo, hereda el **Guantelete de la Reliquia**: un dispositivo arcano en su muñeca capaz de albergar los fragmentos dispersos y manifestar sus poderes elementales. Guiado por los ecos y recuerdos de Tarak, Santi debe atravesar las ruinas y los bosques corrompidos para recuperar los fragmentos antes de que Kragot consuma su energía.

---

### Las Dos Facciones Enemigas (Consecuencias de la Fractura)

La detonación de la reliquia originó dos amenazas complementarias que obligan al jugador a dominar cada faceta de su arsenal:

```
                          ┌─────────────────────────────┐
                          │ FRACTURA EN SALÓN DEL TRONO │
                          └──────────────┬──────────────┘
                                         │
                 ┌───────────────────────┴───────────────────────┐
                 ▼                                               ▼
   [FAUNA Y FLORA CORROMPIDA]                       [VANGUARDIA DE VORTIGERN]
   • Miasma elemental en bosques                    • Soldados de élite atrincherados
   • La Manada Errática (Sabuesos)                  • El Tanque de Postura (Pavés)
   • El Artillero Ágil (Esporíferos)                • El Duelista Implacable (Esgrima)
```

1. **Fauna y Flora Corrompida (Entorno Silvestre Exterior):**
   * **La Manada Errática:** Pequeñas criaturas y sabuesos de zarzas que atacan en jaurías veloces para flanquear y romper la guardia del héroe.
   * **El Artillero Ágil:** Duendes botánicos y alimañas escurridizas que hostigan a larga distancia pateando proyectiles y semillas explosivas con gran puntería.
2. **Vanguardia Ocupante de Vortigern (Ruinas y Fortalezas):**
   * **El Tanque de Postura:** Centinelas pesados equipados con inmensos escudos de roble y hierro que rechazan cualquier ataque frontal débil.
   * **El Duelista Implacable:** Espadachines rápidos de su misma estatura que ejecutan amagues y estocadas letales, castigando el exceso de confianza.

---

## 🎮 2. Mecánicas Centrales del Juego

### 🗡️ Combate Físico y Game Feel
* **Espada Físico-Sagrada:** Tajos frontales con barrido en abanico (*Sweeping Edge* inspirado en Minecraft). Genera retroceso físico (*knockback*) a múltiples objetivos y cuenta con un retardo de recuperación intencional de 0.38s para evitar el spam descontrolado de botones.
* **Recarga Activa de Energía:** Cada impacto conectado con la espada física restaura automáticamente **+6 puntos de Energía Elemental**, incentivando alternar constantemente entre tajos cuerpo a cuerpo y magia.
* **HitStop y Screen Shake:** Los impactos críticos y parries pausan el tiempo lógico durante 80ms (`engine.hitStop`), mientras la cámara 16:9 reacciona con un temblor visceral (`camera.shake`).

---

### 🔥 Sistema Elemental y Sinergias de la Reliquia

El Guantelete canaliza tres energías primarias con interacciones cruzadas:

| Elemento | Ataque Débil (Clic Der / K) | Ataque Fuerte (KeyL) | Efectividad (x2.0 Daño) | Sinergia Única |
| :--- | :--- | :--- | :--- | :--- |
| **🔥 Fuego** | **Disparo de Ceniza:** Proyectil ígneo de 340 px/s (22 daño). | **Erupción Cíclica:** Onda expansiva de llamas a 360° (46 daño). | Super efectivo contra **Plantas / Tierra**. | **Incineración de Escudos:** Quema y destruye permanentemente los escudos de madera de los Tanques. |
| **⚡ Cinético** | **Embestida Rompedora:** Dash físico de 440 px/s que arrastra enemigos. | **Taladro Supersónico:** Vórtice perforante de 560 px/s (48 daño). | Super efectivo contra **Fuego**. | **Rotura de Armaduras:** Aplica el estado `armor_break` debilitando defensas blindadas. |
| **🌿 Tierra** | **Látigo de Espinas:** Barrido en arco que atrae enemigos hacia el centro. | **Prisión Selvática:** Brote de zarzas AoE que inmoviliza por 3.5s. | Super efectivo contra **Cinético**. | **Explosión de Madera:** Si impactas con Fuego a un enemigo atrapado en raíces, detona un estallido masivo de 50 daño en área. |

---

### 🛡️ Sistema Defensivo "Risk / Reward" (Postura y Parry)
* **Barra de Postura (Guard Meter 0 - 100):** Se recupera pasivamente fuera de guardia. Bloquear ataques consume postura proporcional al daño del impacto. Si el medidor llega a 0, se produce un **Guard Break** (aturdimiento total de 2 segundos con retroceso).
* **Parry Perfecto (Ventana de 150ms):**
  * Si el jugador pulsa la guardia en los primeros 150ms antes de recibir el impacto:
    1. Anula el 100% del daño y no consume postura.
    2. Activa un destello estelar dorado y congela el fotograma (`hitStop`).
    3. Deja al enemigo en estado **Stagger** durante 3.0s, abriendo la ventana para un **Riposte Crítico (Daño x3.0)**.
* **Parry Deportivo de Proyectiles:** Al ejecutar un Parry Perfecto contra cualquier proyectil del Artillero Ágil, el orbe invierte su trayectoria con el doble de velocidad y daño (`x2.0`), impactando a los enemigos que tenga enfrente.

---

### 🏃 Movilidad, Evasión y Cancelación de Animaciones
* **Dash con Invulnerabilidad (Iframes):** Impulso direccional a 420 px/s que otorga 240ms de invencibilidad total y deja una estela fantasma translúcida (*Ghost Afterimage*).
* **Cancelación de Animaciones (Animation Cancel):** El Dash puede ejecutarse en cualquier momento durante el inicio de un ataque débil o fuerte. Si un Duelista Implacable inicia una estocada antes de que termines de cargar tu golpe, puedes cancelar la animación instantáneamente con Dash para salvar la vida.
* **Curación Milenaria del Guante (`Q` / `C` / Botón Verde):**
  * Gasta 30 de energía elemental para canalizar un pulso de luz sacro que regenera 1 corazón de salud.
  * **Escudo de Vitalidad:** Si la salud ya está al máximo (3/3), no desperdicia el comando: genera una barrera rúnica protectora durante 4 segundos.

---

### 🕹️ Mapa de Controles

```
                          ┌───────────────────────────┐
                          │   CONTROLES BE A LEGEND   │
                          └─────────────┬─────────────┘
                                        │
           ┌────────────────────────────┴────────────────────────────┐
           ▼                                                         ▼
     [MODO TECLADO / RATÓN (PC)]                               [MÓVIL / TÁCTIL]
  • WASD / Flechas: Moverse                                 • Joystick Analógico Virtual
  • Clic Izquierdo / J / Z: Espada física                   • Botón Central: ESPADA
  • Clic Derecho / K / X: Habilidad Débil                   • Botón HABILIDAD (Swipe / Tap)
  • KeyL: Habilidad Fuerte Cargada                          • Botón FUERTE
  • Shift / Clic Central: Guardia / Parry                   • Botón GUARDIA (Escudo)
  • Espacio: Dash / Esquiva rápida                          • Botón DASH
  • Q / C: Curación Milenaria / Escudo                      • Botón CURAR (Cruz verde)
  • 1, 2, 3 / Rueda Ratón: Cambiar Elemento                 • Botón CAMBIAR / Swipe
  • Tab: Menú Radial de Reliquia                            • Botón Pausa rápido
  • Escape / P: Pausar partida                              • Modal de Ajustes
```

---

## 🎬 3. Sistema de Cinemáticas Narrativas Data-Driven

El motor cuenta con un sistema cinemático autónomo en el DOM Overlay ([CinematicManager.js](file:///src/cinematics/CinematicManager.js)):
* **Efectos de Cámara Guiados por Datos:** `SlowZoomIn`, `SlowZoomOut`, `PanRight`, `PanUp`, `Shake`, `SlowTiltUp` y `Static`.
* **Transiciones de Pantalla:** `FadeIn`, `FlashBlanco`, `Cut` y `Crossfade`.
* **Efecto Máquina de Escribir (Typewriter):** Letra por letra atado estrictamente al `deltaTime` del motor para evitar desincronizaciones de FPS.
* **Pre-carga en Segundo Plano:** Las 7 escenas ilustradas del prólogo se pre-cargan en la caché del navegador mientras el jugador está en la pantalla de título.

---

## 📜 4. Registro Histórico de Cambios (Changelog)

### Version 3.0.0 (Actual) — *AAA Rhythmic Combat, Modular Enemy AI & Procedural Audio*
* **Combo Rítmico de Espada de 3 Golpes + Onda de Filo:** Secuencia coreografiada (*Corte Diestro $\to$ Revés Cruzado $\to$ Tajo Sacro Circular 225°*) con ventana de **Tempo Perfecto** (+15% daño y destello en empuñadura) y **Onda de Filo Sagrado** a distancia.
* **Dash-Strike & Spell-Weaving (Cancelaciones AAA):** Atacar durante el Dash desata una **Estocada Relámpago** perforante; los tajos pueden cancelarse fluidamente hacia habilidades elementales, Guardia/Parry o Dash con cola de pre-entrada (*Input Queueing*) para cero comandos perdidos.
* **Apuntado Inteligente 360° / 8 Vías:** Apuntado exacto hacia el cursor del ratón en PC y direccional analógico en teclado/gamepad para tajos, proyectiles, látigos, embestidas y escudo hexagonal.
* **Medidor Dinámico de Combo y Rango de Estilo (`D` $\to$ `S`):** Bonificación progresiva de daño (hasta +35% en rango `S`) que premia la variedad elemental y los Parries Perfectos.
* **Simetría de Daño e IA Enemiga de 4 Arquetipos:** Implementado `Player.takeDamage()` (con Iframes, Escudo de Vitalidad y Renacimiento de la Reliquia) junto a las máquinas de estado y telegrafía táctica del **Sabueso de Zarzas**, **Esporífero Artillero**, **Centinela Pavés** (escudo de roble incinerable) y **Duelista Implacable**.
* **Motor de Audio Sintetizado (`AudioManager.js`):** Síntesis multicapa en tiempo real con Web Audio API (escala tonal de combos, campana resonante de Parry estilo *Sekiro*, impactos elementales y alertas de telegrafía) con compresor dinámico maestro.
* **Santuario del Guantelete (UI de Talentos y Esencia Ancestral):** Árbol de habilidades interactivo accesible con `[U]` para invertir la Esencia Ancestral obtenida en combate.

### Version 2.0.0 — *Combat & Narrative Architecture Overhaul*
* **Fix Crítico de Postura:** Reparada la referencia a `context.player` en `CombatManager`, habilitando la regeneración pasiva del medidor de postura fuera de bloqueo.
* **Fix de Game Feel:** Conectado `camera` en `gameContext` para que los impactos de espada y embestidas activen el Screen Shake.
* **Físicas y Colisiones en Combate:** Se integró `physics.moveWithCollisions` en los empujes físicos de `KineticAbility`, `EarthAbility` y `_applyKnockback`, impidiendo que los enemigos atraviesen muros o la cabaña.
* **Parry Deportivo:** Habilidad para devolver proyectiles a los artilleros duplicando su daño y velocidad al acertar una guardia perfecta.
* **Mecánica de Escudo de Madera:** Rebote de tajos físicos débiles y combustión total permanente frente a ataques de fuego.
* **Cancelación de Animaciones:** El jugador puede cancelar cualquier ataque pesado con un dash corto defensivo.
* **Eliminación de Código Duplicado:** Removido el trazado primitivo `_drawSlashEffect` en `Player.js`, unificando todo el renderizado de corte en `VFXRenderer.js`.
* **Consumo de Entradas:** Corregido el autofire continuo en habilidades elemental débil y fuerte en `InputManager.js`.

### Version 1.7.0 — *Engine Performance & 60 FPS Garbage Collection*
* Auditoría técnica completa del bucle principal de renderizado.
* Eliminación de código muerto de canvas y sustitución por DOM Overlay moderno.
* Pre-alocación de objetos de colisión AABB y buffers de Y-Sorting en `EntityManager` para evitar pausas por Garbage Collector.

### Version 1.6.0 — *Cinematic Prologue & Lore Engine*
* Implementación de `CinematicManager.js` data-driven con configuración 100% JSON.
* Integración de las 7 escenas ilustradas del conflicto entre Santi, Tarak y Kragot.
* Pantalla de título tipo Arcade con aviso pulsante *"Presiona Enter para comenzar"*.

### Version 1.5.0 — *Minimalist SVG DOM Overlay & Virtual Gamepad*
* Creación del Gamepad Táctil moderno: clúster de botones con icono vectorial SVG de espada, escudo, dash, curación y botón radial con swipe trigonométrico (`Math.atan2`).
* Menús con diseño Glassmorphism, tipografía moderna sans-serif y micro-animaciones fluidas.

### Version 1.4.0 — *Next-Gen Graphics & Environmental Physics*
* Adopción de formato panorámico 16:9 con resolución nativa 960x540.
* Sistema `FoliageSystem.js` con balanceo por viento y flexión elástica al contacto con el héroe.
* Cámara cinemática con LERP exponencial continuo y zoom 1.45x.

### Version 2.0.0 — *The Sacred Relic & Cel-Shaded Era*
* **Cámara 2D con Zona Muerta Cuadrada (Square Deadzone)**: Permite movimiento libre dentro del marco central y traslada el viewport al cruzar bordes, sin forzar centrado rígido del jugador.
* **Estética Pixel Art / Cel-Shaded Top-Down (`CelSpriteAtlas`)**: Adaptación de estilo y animación manteniendo los personajes con técnica anime cel-shading de alta fidelidad, paletas con hue shifting y cero asignaciones dinámicas.
* **Secuencia de Apertura y Dispersión de Poderes**: Cinemática in-engine en el Umbral de la Cueva Hendida (`cave_exit_intro.json`). Los cuatro orbes elementales se dispersan por el firmamento; el fragmento ígneo impacta en el claro sur atrayendo bestias acechadoras.
* **Progresión Orgánica del Umbral**: La Espada del Alba es el primer elemento visible al salir de la cueva, guiando al jugador hacia la ruptura de la roca agrietada y la recuperación del Núcleo de Fuego.
* **Corrección Táctica de Choque con Escudos**: El impacto con enemigos equipados con escudo de madera no desactiva el poder ígneo; por el contrario, recarga energía elemental y permite incinerar permanentemente sus defensas.
* **Aclaración de Transcripción Fonética**: Se clarifica el apunte transcrito por reconocimiento de voz «*una segunda vez en Guadalajara*», el cual corresponde al diseño del Centinela Pavés («*una segunda fase con guardia*»): al defenderse con escudo frontal, el jugador debe romper su postura o quemar el escudo con Fuego para superarlo permanentemente.

### Version 1.0.0 a 1.3.0 — *Foundation Engine*
* Motor modular en JavaScript nativo (ES Modules) impulsado por Vite.
* Sistema de Tilemap procedural, entidades base, gestión de recursos y ciclo de luces diurnas/interiores.

---

## 🚀 5. Instrucciones de Ejecución

Para iniciar el entorno de desarrollo local:

```bash
# 1. Instalar dependencias
npm install

# 2. Iniciar servidor de desarrollo Vite
npm run dev

# 3. Compilar bundle de producción
npm run build
```

---
*Be a Legend Engine © 2026 — Diseñado con orgullo para experiencias Action-RPG intensas.*

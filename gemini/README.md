# 📖 Gemini Knowledge Base: Be a Legend — El Legado de la Reliquia

> **Propósito:** Base de conocimiento optimizada para modelos LLM (Gemini) y agentes autónomos. Contiene **únicamente** la arquitectura, contratos lógicos, esquemas de datos y reglas de ingeniería necesarios para desarrollar y extender el proyecto sin datos innecesarios, sin archivos binarios pesados ni código heredado obsoleto.

---

## ⚡ 1. Ficha Técnica del Proyecto

* **Nombre:** *Be a Legend: El Legado de la Reliquia*
* **Género:** Action-RPG 2D Top-Down en Pixel Art / Cel-Shaded Anime (*The Minish Cap* meets *Sekiro/Hades*).
* **Stack Tecnológico:**
  * **Lenguaje:** JavaScript moderno (ES Modules nativos, sin TypeScript, sin frameworks pesados).
  * **Simulación & Render:** HTML5 Canvas 2D nativo (doble capa: `mainCanvas` + `lightCanvas`).
  * **Interfaz de Usuario (HUD):** DOM Overlay en HTML5/CSS3 desacoplado mediante *dirty-checking*.
  * **Audio:** Síntesis procedimental y osciladores en tiempo real mediante **Web Audio API** (sin assets `.mp3`/`.wav` obligatorios).
  * **Bundler & Dev Server:** Vite (`npm run dev`, `npm run build`, `npm run preview`).
* **Regla de Oro Arquitectónica:** **Separación estricta entre Simulación (Canvas/JS) y Presentación (DOM Overlay/CSS)**. Las entidades de juego nunca tocan el DOM; los botones de la UI nunca modifican entidades sin pasar por el contexto o el bus de estado.

---

## 🗺️ 2. Mapa de Lectura Rápida (Módulos de esta Carpeta)

Consulta el archivo específico según la tarea a realizar:

| Archivo | Contenido Clave | Cuándo Consultarlo |
| :--- | :--- | :--- |
| [ARCHITECTURE.md](file:///c:/Users/user/Desktop/video%20proyectos/Be%20a%20legend/gemini/ARCHITECTURE.md) | Las 9 capas desacopladas, Game Loop, contrato de `gameContext`, sistema de etiquetas `hasTag` y optimización Anti-GC (Zero-Alloc). | Al modificar el flujo principal, crear nuevos sistemas o coordinar comunicación entre capas. |
| [COMBAT_AND_ENTITIES.md](file:///c:/Users/user/Desktop/video%20proyectos/Be%20a%20legend/gemini/COMBAT_AND_ENTITIES.md) | Ciclo de vida de entidades, FSM del Jugador (combos, parry, dash), FSM y 5 arquetipos de IA Enemiga, descriptores `addAttack` y sinergias elementales. | Al crear/modificar enemigos, pulir mecánicas de combate, armas o habilidades elementales. |
| [DATA_SCHEMAS.md](file:///c:/Users/user/Desktop/video%20proyectos/Be%20a%20legend/gemini/DATA_SCHEMAS.md) | Esquemas exactos de `weapons.js`, `shields.js`, `PlayerStats.js`, niveles JSON, árbol de talentos y llaves de persistencia `localStorage`. | Al crear nuevo contenido data-driven, equilibrar estadísticas o añadir niveles. |
| [LEVEL_EDITOR.md](file:///c:/Users/user/Desktop/video%20proyectos/Be%20a%20legend/gemini/LEVEL_EDITOR.md) | Estructura de la Forja de Mundos: módulos, formato de borrador, herramientas, historial RLE/Undo y flujo de Playtest en vivo. | Al modificar o extender el creador y editor de niveles. |
| [UI_AND_AUDIO.md](file:///c:/Users/user/Desktop/video%20proyectos/Be%20a%20legend/gemini/UI_AND_AUDIO.md) | Reglas del HUD responsivo (16:9 vs 9:16, 4 reglas de anclaje), dirty-checking en `UIManager.js`, catálogo de SFX procedimentales y partículas `VFXRenderer`. | Al diseñar interfaz, menús, ventanas modales, controles táctiles o efectos audiovisuales. |
| [DEVELOPER_RULES.md](file:///c:/Users/user/Desktop/video%20proyectos/Be%20a%20legend/gemini/DEVELOPER_RULES.md) | Reglas obligatorias del usuario, recetas paso a paso para añadir features y lista estricta de anti-patrones prohibidos. | **Lectura obligatoria** antes de escribir o editar cualquier línea de código. |

---

## 🚫 3. Datos Innecesarios Filtrados (Ignorar por Completo)

Para ahorrar tokens y evitar confusiones, **NO** leas ni uses los siguientes directorios y archivos:
1. `Cinematics/`: Imágenes JPG de alta resolución (2-3 MB c/u) para cortes narrativos. Solo el código en `src/cinematics/CinematicManager.js` las referencia.
2. `revision_esencial/` y `revision_esencial.zip`: Copias de seguridad históricas antiguas.
3. `dist/` y `node_modules/`: Artefactos generados de compilación y dependencias.
4. Archivos sueltos `.jpg` en la raíz (ej. `Gemini_Generated_Image_*.jpg`).


# 📜 Reglas de Desarrollo, Recetas y Anti-Patrones

> **Resumen Técnico:** Guía práctica para extender el juego de manera escalable, limpia y coherente, respetando estrictamente las directrices del proyecto y optimizando la productividad del agente.

---

## 1. Directrices Obligatorias del Proyecto

1. **Documenta todo el código:** Todo método, clase o módulo nuevo debe incluir comentarios JSDoc detallando tipos `@param`, `@return` y el propósito lógico exacto.
2. **Coherencia arquitectónica:** No crees sistemas paralelos ni uses variables globales sueltas. Respeta la separación Canvas (Simulación) vs DOM (Presentación).
3. **Uso inteligente del código existente:**
   * Utiliza `hasTag(tag)` para verificar estados y tipos.
   * Utiliza `combatManager.addAttack(...)` para cualquier interacción que aplique daño.
   * Emite eventos a través de `stateManager.emit(...)`.
   * Reproduce sonido a través de `context.audioManager.playX(...)`.
4. **Cero basura en tiempo de ejecución (Anti-GC):**
   * Reutiliza vectores y rectángulos de prueba en bucles `update(dt)` y `render(dt)`.
   * No uses `new` indiscriminado dentro de funciones que corran en cada fotograma.

---

## 2. Recetas Paso a Paso para Extender el Juego

### Receta A: Añadir una Nueva Arma
1. Abre [weapons.js](file:///c:/Users/user/Desktop/video%20proyectos/Be%20a%20legend/src/data/weapons.js).
2. Agrega la clave con su ID único y parámetros calibrados:
   ```js
   heavy_claymore: {
     id: 'heavy_claymore',
     name: 'Espadón Rúnico',
     damage: 45,
     recoveryTime: 0.32,
     duration: 0.28,
     knockback: 65,
     lungeForce: 6,
     energyOnHit: 12,
     element: 'physical',
     description: 'Hoja colosal forjada para aplastar defensas con inercia arrolladora.'
   }
   ```
3. `EquipmentManager.js` y el Santuario la detectarán automáticamente sin tocar código de bajo nivel.

---

### Receta B: Añadir un Nuevo Arquetipo de Enemigo
1. Abre [Enemy.js](file:///c:/Users/user/Desktop/video%20proyectos/Be%20a%20legend/src/entities/Enemy.js).
2. Añade la configuración en `ENEMY_ARCHETYPES`:
   ```js
   berserker: {
     maxHealth: 160,
     speed: 120,
     aggroRange: 240,
     attackRange: 70,
     telegraphTime: 0.35,
     attackDuration: 0.22,
     cooldownTime: 1.10,
     lungeSpeed: 380,
     postureDamage: 50,
     essenceReward: 6
   }
   ```
3. En el método `updateBehavior(dt, context)` o `executeAttack(context)`, añade variantes específicas si requiere proyectiles o cargas especiales.
4. Para ubicarlo en un mapa, añade `{ "type": "enemy", "archetype": "berserker", "x": 500, "y": 400 }` en el JSON del nivel.

---

### Receta C: Añadir una Nueva Habilidad Elemental
1. Crea tu archivo en `src/combat/NuevaAbility.js` extendiendo de `Ability.js`:
   * Implementa `executeWeak(owner, context)` (Ataque débil / Clic Secundario).
   * Implementa `executeStrong(owner, context)` (Ataque fuerte / Tecla L).
2. Cada método debe verificar el coste de energía (`owner.energy >= cost`) y llamar a `context.combatManager.addAttack({...})`.
3. Registra la nueva habilidad en `Player.js` dentro del diccionario `this.abilities`.

---

### Receta D: Diseñar un Nuevo Nivel
1. Crea `src/data/levels/nuevo_nivel.json` siguiendo el esquema de [DATA_SCHEMAS.md](file:///c:/Users/user/Desktop/video%20proyectos/Be%20a%20legend/gemini/DATA_SCHEMAS.md).
2. Define dimensiones `cols` y `rows`, posición inicial `playerSpawn`, y el arreglo `entities` con sus coordenadas de mundo.
3. Carga el nivel llamando a `LevelLoader.loadLevel(levelData, context)`.

---

## 3. Lista de Anti-Patrones Prohibidos

| ❌ Anti-Patrón Prohibido | ✅ Solución Correcta |
| :--- | :--- |
| `document.getElementById('...')` dentro de `Player.js` o `Enemy.js`. | Notifica a `StateManager` o usa `context.uiManager` mediante dirty-checking. |
| `new Vector2(x, y)` o `return { x, y }` dentro de `getHitbox()` o `update(dt)`. | Reutiliza propiedades de instancia `this._hitboxCache` o vectores prealocados. |
| Consultar `this.tags.includes(t)` ignorando estados alterados. | Usa siempre `this.hasTag(tag)`, que contempla tanto `tags` como `activeEffects`. |
| Guardar en `localStorage` de forma síncrona en cada golpe recibido. | Usa un sistema de guardado diferido con debounce (como `_scheduleSave` en `SkillTreeManager`). |
| Crear proyectiles con bucles independientes fuera de `CombatManager`. | Registra el ataque en `combatManager.addAttack()` para centralizar colisiones y sinergias. |


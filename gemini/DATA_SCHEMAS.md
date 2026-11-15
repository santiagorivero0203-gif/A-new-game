# 📊 Esquemas de Datos y Persistencia Data-Driven

> **Resumen Técnico:** Contratos JSON y objetos JavaScript que definen el balance, equipamiento, diseño de niveles y persistencia en disco del juego.

---

## 1. Catálogo de Armas (`src/data/weapons.js`)

Cada arma en el objeto `WEAPONS` implementa la siguiente estructura:

```js
export const WEAPONS = {
  [weaponId]: {
    id: 'string',            // Identificador único (ej: 'training_sword')
    name: 'string',          // Nombre en pantalla para el Santuario
    damage: number,          // Daño base infligido por tajo
    recoveryTime: number,    // Tiempo de enfriamiento post-ataque en segundos (ej: 0.16)
    duration: number,        // Duración de la ventana de daño del swing (ej: 0.20)
    knockback: number,       // Fuerza de retroceso en píxeles (ej: 32)
    lungeForce: number,      // Desplazamiento 'Push-Forward' hacia el enemigo (ej: 10)
    energyOnHit: number,     // Energía Elemental restaurada por impacto conectado (ej: 6)
    element: 'string',       // Elemento base (usualmente 'physical')
    description: 'string'    // Descripción para el Códice / Santuario
  }
};
```

---

## 2. Catálogo de Escudos (`src/data/shields.js`)

Cada escudo en el objeto `SHIELDS` implementa:

```js
export const SHIELDS = {
  [shieldId]: {
    id: 'string',                    // Identificador único (ej: 'wooden_shield')
    name: 'string',                  // Nombre visible
    posture_drain_rate: number,      // Multiplicador de consumo de postura (1.0 = normal, 0.65 = 35% mitigación)
    can_reflect_projectiles: boolean,// Si permite desviar proyectiles en Parry Deportivo
    elemental_weakness: string|null, // Debilidad elemental reactiva ('fuego' o null)
    description: 'string'            // Descripción para la UI
  }
};
```

---

## 3. Estadísticas Base del Jugador (`src/data/PlayerStats.js`)

```js
export const PLAYER_STATS = {
  health: 3,                   // Corazones actuales
  max_health: 3,               // Corazones máximos
  energy: 100,                 // Energía Elemental actual (0 - 100)
  max_energy: 100,             // Energía máxima
  energy_regen_rate: 6,        // Regeneración pasiva de energía por segundo
  guard_meter: 100,            // Medidor de postura/guardia (0 - 100)
  max_guard: 100,              // Postura máxima
  speed: 195,                  // Velocidad de movimiento a pie (px/s)
  
  // Utilidad & Combate
  dash_cost: 10,               // Coste de energía por esquiva
  dash_cooldown_base: 0.40,    // Enfriamiento entre esquivas (s)
  dash_cooldown_upgraded: 0.25,// Enfriamiento con talento 'lightning_step'
  dash_speed: 420,             // Velocidad durante la esquiva (px/s)
  dash_duration: 0.22,         // Duración del desplazamiento y iframes (s)
  heal_cost: 30,               // Coste de Esencia para cura
  heal_cooldown: 1.2,          // Enfriamiento de sanación
  sword_cooldown: 0.08,        // Cooldown base de la espada
  guard_break_duration: 1.8,   // Segundos aturdido si te rompen la postura
  parry_window_base: 0.16,     // Ventana activa de Parry Perfecto (160ms)
  parry_window_upgraded: 0.26  // Ventana activa con talento 'parry_window' (260ms)
};
```

---

## 4. Esquema de Niveles JSON y Catálogo de 4 Mundos (`src/data/worlds.js` y `levels/*.json`)

Los niveles se agrupan en `src/data/worlds.js` (`WORLDS_CATALOG`, `WORLDS_LIST`) con 4 biomas jugables (`cave_exit_intro`, `marsh_of_spores`, `ash_caldera`, `astral_citadel`) y son cargados por `LevelLoader.js` + `Tilemap.js` (Dual-Grid `-16px` y acantilados en Proyección de Gabinete):

```json
{
  "id": "marsh_of_spores",
  "name": "Mundo 2 · Pantano de Esporas",
  "worldTitle": "Mundo 2 · Pantano de Esporas Bioluminiscentes",
  "biome": "marsh_of_spores",
  "layoutPreset": "marsh_of_spores",
  "weather": "spores",
  "ambientColor": "rgba(13, 38, 52, 0.34)",
  "map": {
    "cols": 54,
    "rows": 36,
    "tileSize": 32
  },
  "playerSpawn": { "x": 220, "y": 628 },
  "arenaCenter": { "x": 1344, "y": 384 },
  "lights": [
    { "x": 512, "y": 448, "radius": 190, "color": "#2dd4bf", "intensity": 0.72, "flickerSpeed": 1.6 }
  ],
  "solidColliders": [
    { "x": 0, "y": 0, "width": 1728, "height": 118 }
  ],
  "props": [
    { "propType": "world_portal", "x": 1520, "y": 608, "portalColor": "#fb923c", "targetWorld": "ash_caldera", "worldLabel": "Caldera de Ceniza" },
    { "propType": "broken_statue", "x": 448, "y": 684, "biomeTint": "marsh", "loreTitle": "...", "loreText": "...", "essenceReward": 22 },
    { "propType": "rusted_greatsword", "x": 790, "y": 340, "loreTitle": "...", "loreText": "...", "essenceReward": 18 },
    { "propType": "runic_obelisk", "x": 830, "y": 530, "runeColor": "#2dd4bf", "loreTitle": "...", "loreText": "...", "essenceReward": 30 },
    { "propType": "brambles_barrier", "x": 580, "y": 480, "weakness": "fuego" }
  ],
  "entities": [
    { "type": "enemy", "archetype": "slime", "element": "plantas", "x": 540, "y": 640 },
    { "type": "npc", "variant": "tarak", "name": "Tarak", "x": 310, "y": 605 },
    { "type": "house", "x": 560, "y": 230 }
  ],
  "foliage": [{ "x": 530, "y": 560 }],
  "clearingTrees": [{ "x": 360, "y": 490 }],
  "perimeterConfig": {
    "step": 75,
    "hasOpenRoad": true,
    "roadGapY": [560, 700]
  }
}
```

> [!NOTE]
> Tanto `Tilemap.reconfigureFromLevel()` como `LevelLoader.loadLevel()` normalizan dimensiones desde `levelData.map` o desde la raíz (`cols`, `rows`, `tileSize`), y aceptan tanto `solidColliders` como `colliders`.

---

## 5. Esquema de Habilidades Multi-Rango v3 (`SkillTreeManager.js`)

El Santuario expande el árbol a **36 nodos multi-rango** organizados en **3 Disciplinas × 3 Carriles (`lane: 0..2`) × 4 Niveles (`tier: 0..3`)**:
1. `aegis`: Égida y Parry (`parry_window`, `vital_surge`, `guardian_stride` y sus derivaciones).
2. `wrath`: Ira del Acero y Cinética (`blade_tempo`, `dash_cooldown`, `swift_recovery` y derivaciones).
3. `relic`: Dominio de la Reliquia (`ember_fan`, `thorn_leech`, `energy_regen` y derivaciones).

```js
// Estructura canónica de un nodo en SkillTreeManager.skills (v3):
{
  id: 'parry_window',         // ID único (mantiene los 18 IDs heredados + 18 nuevos)
  name: 'Reflejos de Duelista',
  tree: 'aegis',              // 'aegis' | 'wrath' | 'relic'
  lane: 0,                    // 0 | 1 | 2 (3 carriles por disciplina)
  tier: 0,                    // 0..3 (nivel vertical)
  maxRank: 3,                 // Rangos invertibles (1..3); getSkillRank(id) y isMaxRank(id)
  reqTreePoints: 0,           // Puntos totales requeridos en su disciplina (0, 2, 5, 8)
  isMastery: false,           // true en nodos Tier 4 de maestría
  svgType: 'shield',          // Tipo de vector para _getSkillSvgIcon
  badge: 'Shift · +25 ms/Rango',
  description: 'Descripción narrativa para el inspector.',
  mechanicsText: '+25 ms de ventana de Parry por rango.',
  cost: [12, 22, 35],         // Escalar o arreglo por rango leído vía getSkillCost(id)
  dependsOn: []               // IDs de nodos previos con rango >= 1 requerido
}
```

---

## 6. Llaves de Persistencia Local (`localStorage`)

Para evitar migraciones rotas o conflictos de guardado, el motor utiliza llaves versionadas con migración automática de `v2` ➔ `v3`:

| Llave en `localStorage` | Contenido | Gestor Encargado |
| :--- | :--- | :--- |
| `'be_a_legend_skill_ranks_v3'` | Mapa de rangos por ID (`Record<string, number>`). Migra desde `'be_a_legend_skills_v2'` automáticamente. | `SkillTreeManager.js` (debounce 450ms). |
| `'be_a_legend_essence_v2'` | Saldo entero de Esencia Ancestral (`number`). | `SkillTreeManager.js` |
| `'be_a_legend_audio_config'` | Preferencias de volumen y mute (`{ muted: boolean }`). | `AudioManager.js` |
| `'be_a_legend_equipment'` | Armas y escudos equipados (`{ weaponId, shieldId }`). | `EquipmentManager.js` |


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
  "corridorZones": [
    { "id": "m2_root_corridor", "x": 1248, "y": 592, "width": 176, "height": 96, "label": "Paso de Raíces Oscuras" }
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
    { "type": "enemy", "archetype": "miniboss_weaver", "isMiniBoss": true, "bossId": "miniboss_m2", "element": "plantas", "x": 1560, "y": 616 },
    { "type": "npc", "variant": "blacksmith", "role": "blacksmith", "biome": "marsh_of_spores", "name": "Herrero Kael", "shopTitle": "Forja Palafito", "x": 960, "y": 556 },
    { "type": "npc", "variant": "guard", "role": "guard", "patrolPoints": [{ "x": 800, "y": 656 }, { "x": 864, "y": 656 }], "x": 800, "y": 656 },
    { "type": "house", "biome": "marsh_of_spores", "buildingType": "forge", "label": "Forja del Pantano", "x": 888, "y": 396 }
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

## 5. Esquema de Habilidades Multi-Rango v4 (`SkillTreeManager.js`)

El Santuario organiza el árbol simétrico en **36 nodos multi-rango**: **3 Disciplinas × 3 Carriles (`lane: 0..2`) × 4 Tiers (`tier: 0..3`)** con economía calibrada (`essence: 0` al iniciar campaña nueva y curva de coste base `30 → 55 → 90 → 145` con `costScale: 1.5` en Tiers 0–2 y `1.0` en Maestría Tier 3):
1. `aegis`: Égida y Parry (`parry_window`, `vital_surge`, `guardian_stride` y sus derivaciones verticales).
2. `wrath`: Ira del Acero y Cinética (`blade_tempo`, `dash_cooldown`, `stamina_mastery` —con alias compatible `swift_recovery`— y derivaciones verticales).
3. `relic`: Dominio de la Reliquia (`ember_fan`, `thorn_leech`, `energy_regen` y derivaciones verticales).

Cada disciplina exige acumular inversión en su rama (`TIER_POINT_REQUIREMENTS = { 0: 0, 1: 1, 2: 3, 3: 6 }`) además del rango 1 del nodo padre (`dependsOn`), manteniendo los 9 nodos iniciales (`tier: 0`) abiertos a libre elección desde el comienzo.

```js
// Estructura canónica de un nodo en SkillTreeManager.skills (v4):
{
  id: 'parry_window',         // ID único (36 nodos simétricos)
  name: 'Reflejos del Guardián',
  tree: 'aegis',              // 'aegis' | 'wrath' | 'relic'
  lane: 0,                    // 0 | 1 | 2 (3 carriles por disciplina)
  laneTitle: 'GUARDIA',       // Etiqueta superior del carril en el Árbol
  tier: 0,                    // 0..3 (nivel vertical)
  maxRank: 3,                 // Rangos invertibles (1..3); getSkillRank(id) y isMaxRank(id)
  reqTreePoints: 0,           // Puntos totales requeridos en su disciplina (0, 1, 3, 6)
  isMastery: false,           // true en nodos Tier 3 de maestría
  svgType: 'shield_parry',    // 36 claves únicas renderizadas por UIManager._getSkillSvgIcon
  badge: 'PARRY',
  inputHint: 'Pulsa [Shift] justo antes del impacto',
  description: 'Descripción narrativa para el inspector.',
  mechanicsText: 'Ventana base 0.16s ➔ hasta 0.28s según rango.',
  cost: 30,                   // Coste base + escalado dinámico costScale / Karma
  costScale: 1.5,
  dependsOn: []               // IDs de nodos previos con rango >= 1 requerido
}
```

---

## 6. Llaves de Persistencia Local (`localStorage`)

Para evitar migraciones rotas o balances inflados de versiones antiguas, el motor utiliza llaves versionadas limpias en `v4`:

| Llave en `localStorage` | Contenido | Gestor Encargado |
| :--- | :--- | :--- |
| `'be_a_legend_campaign_v1'` | Núcleos despertados, mundos visitados/completados, `karmaLevel`, `karmaEvents` idempotentes y `resolvedLinks` (`sealedBy`). | `ProgressionManager.js` (debounce 400ms). |
| `'be_a_legend_skill_ranks_v4'` | Mapa de rangos por ID (`Record<string, number>`). | `SkillTreeManager.js` (debounce 450ms). |
| `'be_a_legend_essence_v3'` | Saldo entero de Esencia Ancestral (`0` al iniciar campaña nueva). | `SkillTreeManager.js` |
| `'be_a_legend_audio_config'` | Preferencias de volumen y mute (`{ muted: boolean }`). | `AudioManager.js` |
| `'be_a_legend_equipment'` | Armas/escudos desbloqueados y equipo activo (`{ unlockedWeapons, unlockedShields, weaponId, shieldId }`). | `EquipmentManager.js` |

---

## 7. Campaña Progresiva de 4 Mundos, Props Lógicos y Arsenal v4.0

### Catálogo de Arsenal Progresivo
* **Armas (`WEAPONS`)**: `training_sword` (16 dmg, base), `thorn_saber` (22 dmg, `finisherEffect: sangrado_espinas`, Mundo 2 Karma), `forge_claymore` (30 dmg, `finisherEffect: armor_break`, Mundo 3 santuario secreto) y `relic_blade` (34 dmg, 0.11s recovery, +6 energía/golpe, Mundo 4 santuario).
* **Escudos (`SHIELDS`)**: `wooden_shield` (1.0x drenaje, débil a `fuego`), `iron_pavise` (0.65x drenaje, ignífugo, Mundo 1 Karma) y `obsidian_aegis` (0.50x drenaje, ignífugo, Mundo 3 Karma).

### Props Sistémicos y Enlaces Lógicos (`InteractableProp.js` + `ProgressionManager.js`)
* **Pedestales Elementales (`relic_pedestal`)**: Desbloquean 1 núcleo por mundo (`Fuego` ➔ `Raíces` ➔ `Embestida` ➔ `Éter`), disparando la animación `core_awakening` y aumentando el *World-State Tiering* (`1..4`).
* **Interruptores y Barreras**: `elemental_brazier` (`Fuego`), `root_totem` (`Raíces`/`Plantas`), `kinetic_barrier` (rompible con `Embestida`/`Éter`), `kinetic_pillar` (`Embestida`), `ether_pylon` (`Éter`), `runic_gate` (abierta al cumplirse su arreglo `sealedBy` mediante haz `logic_beam`), `weapon_shrine` y `hazard_vent` (`spore_pool`, `magma_geyser`, `storm_coil`).
* **Orden Canónico de Campaña (`CAMPAIGN_WORLD_ORDER`)**:
  1. `cave_exit_intro` (`56×38`) — Núcleo: `Fuego` | Jefe: `boss_bramble` (`boss_m1`)
  2. `marsh_of_spores` (`58×40`) — Núcleo: `Raíces` | Jefe: `boss_spore` (`boss_m2`)
  3. `ash_caldera` (`58×40`) — Núcleo: `Embestida` | Jefe: `boss_forge` (`boss_m3`)
  4. `astral_citadel` (`60×40`) — Núcleo: `Éter` | Jefe: `boss_astral` (`boss_m4`)



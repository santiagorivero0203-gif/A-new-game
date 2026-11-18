/**
 * @file main.js
 * @description Punto de entrada principal y orquestador de 'Be a Legend'.
 * Integra el Nivel Introductorio "Umbral de la Cueva Hendida" (`cave_exit_intro.json`) con:
 * - Estética 2D Cel-Shaded Cartoon/Anime cohesiva entre cinemáticas, sprites (`CelSpriteAtlas`) e interfaz.
 * - Progresión sistémica sin disonancia ludonarrativa (Guantelete inicialmente dormido -> Pedestal de Fuego ->
 *   Zarzas del Puente -> Encuentro de Karma Invisible con Valerio -> Altar del Santuario y Prueba de Hordas).
 * - Hub Unificado del Santuario de 4 pestañas (Habilidades, Arsenal, Crónica & Códice, Sistema) libre de solapamientos.
 * @author Be a Legend Team
 * @version 3.0.0
 */

// Bandera de depuración global (false en producción)
window.DEBUG_MODE = false;

import { Engine } from './core/Engine.js';
import { InputManager } from './core/InputManager.js';
import { StateManager } from './core/StateManager.js';
import { ResourceManager } from './core/ResourceManager.js';
import { AudioManager } from './core/AudioManager.js';
import { EntityManager } from './entities/EntityManager.js';
import { Player } from './entities/Player.js';
import { PhysicsSystem } from './systems/PhysicsSystem.js';
import { InteractionSystem } from './systems/InteractionSystem.js';
import { CombatManager } from './systems/CombatManager.js';
import { EquipmentManager } from './systems/EquipmentManager.js';
import { SkillTreeManager } from './systems/SkillTreeManager.js';
import { StealthSystem } from './systems/StealthSystem.js';
import { Renderer } from './render/Renderer.js';
import { LightManager } from './render/LightManager.js';
import { Camera } from './render/Camera.js';
import { UIManager } from './ui/UIManager.js';
import { Tilemap } from './world/Tilemap.js';
import { FoliageSystem } from './world/FoliageSystem.js';
import { CinematicManager, PROLOGUE_CUTSCENE } from './cinematics/CinematicManager.js';
import { VFXRenderer } from './render/VFXRenderer.js';
import { WaveManager } from './systems/WaveManager.js';
import { LevelLoader } from './world/LevelLoader.js';
import { ChunkManager } from './world/ChunkManager.js';
import { WorldMemoryStore } from './world/WorldMemoryStore.js';
import { ProjectileSystem } from './systems/ProjectileSystem.js';
import { CelSpriteAtlas } from './render/CelSpriteAtlas.js';
import { PerfOverlay } from './render/PerfOverlay.js';
import { WORLDS_CATALOG, loadWorldData, releaseWorldData, getCustomWorld } from './data/worlds.js';
import { levelRepository } from './editor/LevelRepository.js';
import assetsManifest from './data/assets.json';

// Sincroniza en memoria cualquier zona personalizada guardada localmente para habilitar portales entre zonas
levelRepository.syncAllToEngine();

// Capas de renderizado del Motor
const mainCanvas = document.getElementById('main-canvas');
const lightCanvas = document.getElementById('light-canvas');

// Elementos DOM de Menú de Título y Hub Unificado del Santuario
const mainMenuEl = document.getElementById('main-menu');
const sanctuaryModalEl = document.getElementById('skill-tree-modal');

const btnPlay = document.getElementById('btn-play');
const btnSettings = document.getElementById('btn-settings');
const btnLevelEditor = document.getElementById('btn-level-editor');
const btnEditorReturn = document.getElementById('btn-editor-return');
const btnQuickTalents = document.getElementById('btn-quick-talents');
const btnQuickArsenal = document.getElementById('btn-quick-arsenal');
const btnQuickPause = document.getElementById('btn-quick-pause');
const btnResume = document.getElementById('btn-resume');
const btnToMainMenu = document.getElementById('btn-to-main-menu');
const btnCloseTalents = document.getElementById('btn-close-talents');
const btnCloseTalentsX = document.getElementById('btn-close-talents-x');
const btnNavPrev = document.getElementById('st-nav-prev');
const btnNavNext = document.getElementById('st-nav-next');
const btnToggleAudio = document.getElementById('btn-toggle-audio');
const btnToggleTouchHud = document.getElementById('btn-toggle-touch-hud');
const btnTouchInteract = document.getElementById('touch-btn-interact');
const pressEnterMsg = document.getElementById('press-enter-msg');

// 1. Instanciación de Sistemas Centrales
const resourceManager = new ResourceManager();
const audioManager = new AudioManager();
const inputManager = new InputManager(mainCanvas);
const stateManager = new StateManager();
const entityManager = new EntityManager();

const physicsSystem = new PhysicsSystem(entityManager);
const interactionSystem = new InteractionSystem(entityManager, inputManager, stateManager);
const equipmentManager = new EquipmentManager();
const combatManager = new CombatManager(equipmentManager);
const skillTreeManager = new SkillTreeManager(stateManager);
const waveManager = new WaveManager(entityManager, stateManager);
// Mecánica modular de detección/sigilo guardada e inactiva por defecto salvo secciones específicas
const stealthSystem = new StealthSystem({ enabled: false });
const projectileSystem = new ProjectileSystem(192);
combatManager.projectileSystem = projectileSystem;
const worldMemoryStore = new WorldMemoryStore();

const renderer = new Renderer(mainCanvas);
const vfxRenderer = new VFXRenderer();
const lightManager = new LightManager(lightCanvas, false);
const uiManager = new UIManager();
const cinematicManager = new CinematicManager(stateManager);
const camera = new Camera(mainCanvas.width, mainCanvas.height);
const foliageSystem = new FoliageSystem(entityManager);
const perfOverlay = new PerfOverlay();
const chunkManager = new ChunkManager({
  entityManager,
  foliageSystem,
  resourceManager,
  chunkSize: 256
});
let engine = null;

// 2. Estado Lazy del Mundo (cero análisis JSON hasta pulsar Jugar)
let currentWorldKey = 'cave_exit_intro';
let currentWorldMeta = WORLDS_CATALOG[currentWorldKey];
let currentLevelData = null;
let _pendingInitialLoad = null;
let _isTransitioningWorld = false;
let worldInitialized = false;
let assetsInitialized = false;
let levelInfo = null;
let tilemap = null;
let player = null;

/** Fuente luminosa dinámica adherida al portador de la Reliquia */
const playerLight = {
  x: 0,
  y: 0,
  radius: 175,
  color: '#38bdf8',
  intensity: 0.72,
  flickerSpeed: 1.8
};

const POWER_LIGHT_COLORS = {
  Fuego: '#fb923c',
  Plantas: '#4ade80',
  Raíces: '#4ade80',
  Embestida: '#38bdf8',
  Kinetic: '#38bdf8'
};

/** Caches Zero-GC compartidos por cámara e iluminación */
const _playerCenterCache = { x: 0, y: 0 };
const _combatFocusCache = { x: 0, y: 0 };

/**
 * Configura la atmósfera del bioma actual y registra sus focos de luz sin pérdidas.
 * @param {Object} levelData
 * @param {string} biomeKey
 */
function syncWorldLights(levelData, biomeKey) {
  lightManager.clearLights();
  lightManager.setBiomeAtmosphere(levelData.biome || biomeKey, levelData.ambientColor || null);
  lightManager.addLight(playerLight);

  if (Array.isArray(levelData.lights) && levelData.lights.length > 0) {
    for (let i = 0; i < levelData.lights.length; i++) {
      lightManager.addLight(levelData.lights[i]);
    }
  } else if (biomeKey === 'cave_exit_intro') {
    lightManager.addLight({ x: 185, y: 120, radius: 195, color: '#38bdf8', intensity: 0.78, flickerSpeed: 1.7 });
    lightManager.addLight({ x: 452, y: 816, radius: 175, color: '#fb923c', intensity: 0.76, flickerSpeed: 2.3 });
    lightManager.addLight({ x: 1340, y: 830, radius: 245, color: '#facc15', intensity: 0.74, flickerSpeed: 1.9 });
  }
}

/**
 * Carga las texturas Flyweight compartidas una sola vez cuando arranca el juego.
 * @returns {Promise<void>}
 */
function ensureSharedWorldAssets() {
  if (assetsInitialized) return Promise.resolve();
  assetsInitialized = true;
  return resourceManager.loadBatch(assetsManifest).then(() => {
    chunkManager.syncFlyweightSprites();
  });
}

/** Buffers Zero-GC compartidos por colisiones de proyectiles y sigilo */
const _projQueryBuf = [];
const _noiseQueryBuf = [];

stealthSystem.setNoiseQueryFn((minX, minY, maxX, maxY) => (
  (typeof entityManager.queryNearby === 'function' && entityManager.entities.length >= 48)
    ? entityManager.queryNearby(minX, minY, maxX, maxY, _noiseQueryBuf)
    : entityManager.getByTag('enemy')
));

/**
 * Estima la intensidad lumínica en `(px, py)` reciclando las luces ya cargadas en `lightManager`.
 * Evita acoplar StealthSystem con LightManager.
 * @returns {number} Escalar normalizado `[0.42..1.0]`
 */
function samplePlayerLightFactor(px, py) {
  let lightSum = 0.44;
  const lights = lightManager.lights;
  for (let i = 0; i < lights.length; i++) {
    const l = lights[i];
    if (!l || l === playerLight) continue;
    const r = l._currentRadius || l.radius || 140;
    const dx = px - l.x;
    const dy = py - l.y;
    const dSq = dx * dx + dy * dy;
    if (dSq >= r * r) continue;
    const falloff = 1 - Math.sqrt(dSq) / Math.max(1, r);
    lightSum += falloff * (l.intensity ?? 0.75) * 0.75;
    if (lightSum >= 1.0) return 1.0;
  }
  return Math.min(1.0, lightSum);
}

/**
 * Configura de forma unificada iluminación y zonas de sigilo al entrar o cambiar de escenario.
 */
function _configureActiveWorldSystems(levelData, worldMeta) {
  const hasStealthZones = Array.isArray(levelData.stealthZones) && levelData.stealthZones.length > 0;
  stealthSystem.setZones(levelData.stealthZones || [], Boolean(levelData.enableStealth || hasStealthZones), stateManager, player);
  inputManager.setStealthEnabled(stealthSystem.enabled);
  syncWorldLights(levelData, worldMeta.biome);
}

/**
 * Descarga bajo demanda el JSON del escenario inicial solo al arrancar la partida.
 * @returns {Promise<Object|null>}
 */
async function ensureInitialWorldData() {
  if (currentLevelData) return currentLevelData;
  if (!_pendingInitialLoad) {
    _pendingInitialLoad = loadWorldData(currentWorldKey, true)
      .then((data) => {
        currentLevelData = data;
        return data;
      })
      .catch((err) => {
        _pendingInitialLoad = null;
        throw err;
      });
  }
  return _pendingInitialLoad;
}

/**
 * Inicializa el mundo, chunks iniciales, tilemap y jugador de forma perezosa
 * únicamente cuando el usuario inicia partida (cero pre-carga innecesaria en pantalla de título).
 */
function ensureWorldInitialized() {
  if (worldInitialized || !currentLevelData) return;
  worldInitialized = true;

  const initialMapCfg = currentLevelData.map || currentLevelData;
  tilemap = new Tilemap(
    initialMapCfg.cols || 56,
    initialMapCfg.rows || 38,
    initialMapCfg.tileSize || 32,
    currentLevelData.layoutPreset || currentWorldKey
  );
  tilemap.build(resourceManager);
  physicsSystem.setTilemap(tilemap);

  const spawnRef = currentLevelData.playerSpawn || { x: 224, y: 218 };
  player = new Player(spawnRef.x, spawnRef.y);

  // Encuadrar cámara antes de cargar chunks iniciales para activar únicamente el sector visible
  camera.setRoomBounds({ x: 0, y: 0, width: tilemap.width, height: tilemap.height });
  camera.snapTo({ x: player.pos.x + player.width / 2, y: player.pos.y + player.height / 2 });

  levelInfo = LevelLoader.loadLevel(currentLevelData, {
    entityManager,
    foliageSystem,
    camera,
    physicsSystem,
    chunkManager
  });

  if (levelInfo.arenaCenter) {
    waveManager.setArenaCenter(levelInfo.arenaCenter.x, levelInfo.arenaCenter.y);
  }

  if (levelInfo.startDormant) {
    player.configureDormantStart();
    stateManager.set('gauntlet_tier', 0);
  } else {
    stateManager.set('gauntlet_tier', 1);
  }

  const initialMaxHp = 3 + skillTreeManager.getSkillRank('max_health_up');
  player.max_health = initialMaxHp;
  player.health = initialMaxHp;

  playerLight.x = player.pos.x + player.width / 2;
  playerLight.y = player.pos.y + player.height / 2;

  entityManager.addEntity(player);
  stateManager.set('player', player);
  stateManager.set('player_health', player.health);
  stateManager.set('player_max_health', player.max_health);
  stateManager.set('player_energy', player.energy);
  stateManager.set('player_posture', 100);
  stateManager.set('player_stamina', player.stamina || 100);
  stateManager.set('player_max_stamina', player.max_stamina || 100);
  stateManager.set('player_stamina_exhausted', false);
  stateManager.set('threat_level', 'calm');
  stateManager.set('intro_stage', 0);
  stateManager.set('current_world', currentWorldKey);
  _configureActiveWorldSystems(currentLevelData, currentWorldMeta);
  stateManager.set(
    'level_objective',
    levelInfo.initialObjective || 'Sal de la cueva de cristales y rompe el derrumbe con tu espada'
  );

  // Cargar sprites Flyweight compartidos (árboles, casas, arbustos) y sincronizar con los chunks montados
  ensureSharedWorldAssets();
  chunkManager.update(camera.getVisibleWorldBounds(64), 0, true);
  camera.snapTo({ x: player.pos.x + player.width / 2, y: player.pos.y + player.height / 2 });
}

/**
 * Viaja de forma asíncrona y persistente entre los 4 Mundos del Atlas de la Reliquia:
 * guarda deltas compactos + Niebla de Guerra en `WorldMemoryStore`, libera JSON/sprites
 * del escenario previo y carga bajo demanda el nuevo JSON sin retener múltiples mundos en RAM.
 * @param {string} worldKey
 */
async function loadWorld(worldKey, options = {}) {
  const custom = getCustomWorld(worldKey);
  const worldMeta = WORLDS_CATALOG[worldKey] || (custom ? {
    id: worldKey,
    name: custom.name || 'Zona Personalizada',
    subtitle: custom.worldId && WORLDS_CATALOG[custom.worldId]
      ? `${WORLDS_CATALOG[custom.worldId].name} · Zona`
      : 'Zona Personalizada',
    description: custom.initialObjective || 'Zona forjada con la Reliquia.',
    biome: custom.biome || 'cave_exit_intro',
    weather: custom.weather || 'pollen',
    accentColor: WORLDS_CATALOG[custom.worldId]?.accentColor || '#38bdf8'
  } : null);

  if (!worldMeta || _isTransitioningWorld) return;
  _isTransitioningWorld = true;

  try {
    await ensureInitialWorldData();
    if (!worldInitialized) ensureWorldInitialized();

    const isPlaytestSession = _isPlaytestingLevel || worldKey === '__editor_playtest__';
    if (isPlaytestSession && btnEditorReturn) {
      btnEditorReturn.classList.remove('hidden');
    }

    const prevWorldKey = currentWorldKey;
    if (prevWorldKey && !isPlaytestSession) {
      worldMemoryStore.save(prevWorldKey, chunkManager.exportMemory());
    }

    const nextLevelData = await loadWorldData(worldKey, true);
    if (!nextLevelData) return;

    currentWorldKey = worldKey;
    currentWorldMeta = worldMeta;
    currentLevelData = nextLevelData;

    combatManager.clearAllCombatState();
    projectileSystem.clear();
    chunkManager.clearAll();
    foliageSystem.clear();
    entityManager.clearExceptPlayer(player);
    CelSpriteAtlas.clear();
    introSequenceState.active = false;
    vfxRenderer.setIntroOrbs([]);
    camera.cinematicTarget = null;
    if (prevWorldKey && prevWorldKey !== worldKey) {
      releaseWorldData(prevWorldKey);
    }

    const savedMem = isPlaytestSession ? null : worldMemoryStore.restore(worldKey);
    if (savedMem) {
      chunkManager.importMemory(savedMem);
    }

    levelInfo = LevelLoader.loadLevel(currentLevelData, {
      entityManager,
      foliageSystem,
      camera,
      physicsSystem,
      chunkManager
    });

    tilemap.reconfigureFromLevel(currentLevelData, resourceManager);
    waveManager.resetForWorld(levelInfo.arenaCenter || null);

    // Resolver punto de aparición específico por spawnId (transiciones entre zonas)
    let targetSpawn = levelInfo.playerSpawn;
    if (options && options.spawnId && Array.isArray(levelInfo.spawnPoints)) {
      const matchedSpawn = levelInfo.spawnPoints.find(sp => sp.id === options.spawnId);
      if (matchedSpawn) {
        targetSpawn = { x: matchedSpawn.x, y: matchedSpawn.y };
      }
    }

    player.pos.set(targetSpawn.x, targetSpawn.y);
    player.velocity.set(0, 0);

    if (worldKey !== 'cave_exit_intro') {
      if (typeof player.unlockSword === 'function') player.unlockSword();
      if (typeof player.unlockAllElements === 'function') player.unlockAllElements();
      stateManager.set('gauntlet_tier', Math.max(2, stateManager.get('gauntlet_tier') || 2));
      stateManager.set('unlocked_powers', ['Fuego', 'Embestida', 'Raíces']);
      if (!player.currentAbility || !player.hasElement(player.currentAbility)) {
        player.equipAbility('Fuego');
      }
    }

    _playerCenterCache.x = Math.round(player.pos.x) + player.width * 0.5;
    _playerCenterCache.y = Math.round(player.pos.y) + player.height * 0.5;
    playerLight.x = _playerCenterCache.x;
    playerLight.y = _playerCenterCache.y;

    _configureActiveWorldSystems(currentLevelData, worldMeta);
    audioManager.setBiomeAmbience(worldMeta.biome);

    stateManager.set('current_world', currentWorldKey);
    stateManager.set(
      'level_objective',
      levelInfo.initialObjective || currentLevelData.worldTitle || worldMeta.description
    );
    stateManager.set('active_dialogue', {
      speaker: (worldMeta.subtitle || worldMeta.name || 'ZONA').toUpperCase(),
      text: `Has cruzado el umbral hacia ${worldMeta.name}. ${worldMeta.description || ''}`.trim(),
      timer: 4.5
    });

    camera.snapTo(_playerCenterCache);
    chunkManager.update(camera.getVisibleWorldBounds(64), 0, true);
    chunkManager.syncFlyweightSprites();
  } finally {
    _isTransitioningWorld = false;
  }
}

stateManager.set('load_world_hook', (targetWorld, opts = {}) => loadWorld(targetWorld, opts));

// 4. Redimensionado Full-Screen Responsivo Optimizado (Pixel-Art nativo y Compositor Único)
function resizeCanvases() {
  const width = window.innerWidth;
  const height = window.innerHeight;

  camera.setViewportSize(width, height, 1);
  const canvasSize = camera.getOptimalCanvasSize();

  mainCanvas.width = canvasSize.width;
  mainCanvas.height = canvasSize.height;

  // Lienzo auxiliar de iluminación de baja resolución (compuesto internamente sobre #main-canvas)
  lightCanvas.width = Math.max(160, Math.min(320, Math.round(canvasSize.width * 0.4)));
  lightCanvas.height = Math.max(90, Math.min(180, Math.round(canvasSize.height * 0.4)));

  renderer.resize();
  lightManager.resize();
  if (typeof engine !== 'undefined' && engine && engine.isPaused && stateManager.get('game_state') === 'STATE_PAUSED') {
    engine.renderOnce();
  }
}
window.addEventListener('resize', resizeCanvases);
window.addEventListener('orientationchange', resizeCanvases);
resizeCanvases();

/** Objeto de contexto reutilizable Zero-GC para sistemas, entidades e interacciones */
const _gameContext = {
  deltaTime: 0.016,
  input: inputManager,
  state: stateManager,
  physics: physicsSystem,
  player: null,
  camera,
  entityManager,
  chunkManager,
  combatManager,
  projectileSystem,
  equipmentManager,
  skillTreeManager,
  waveManager,
  stealthSystem,
  audioManager,
  vfxRenderer,
  uiManager,
  engine: null,
  tilemap: null,
  surfaceSlideFactor: 1.0,
  time: 0,
  ctx: null
};

/** Hooks planos Zero-GC reutilizados por `ProjectileSystem.update()` sin alocar closures por frame */
const _projectileHooks = {
  isTileBlockedFn: (wx, wy) => {
    if (!tilemap) return false;
    if (wx < 0 || wy < 0 || wx >= tilemap.width || wy >= tilemap.height) return true;
    const ts = tilemap.tileSize || 32;
    return tilemap.getTile(Math.floor(wx / ts), Math.floor(wy / ts)) === 2;
  },
  queryTargetsFn: (minX, minY, maxX, maxY) => (
    typeof entityManager.queryNearby === 'function'
      ? entityManager.queryNearby(minX, minY, maxX, maxY, _projQueryBuf)
      : entityManager.entities
  ),
  playerTarget: null,
  onHitFn: (slot, target) => combatManager.handleHit(slot, target, _gameContext),
  onHitPropFn: (slot, prop) => {
    if (typeof prop.takeEnvironmentalHit === 'function') {
      prop.takeEnvironmentalHit(slot.damage || 16, slot, _gameContext);
    }
  },
  onLowEvadeFn: (target, slot) => {
    if (slot.altitude === 'high') {
      combatManager.registerComboAction('low_evade', 12, _gameContext, false);
      if (uiManager && camera) {
        uiManager.spawnDamageNumber(target.pos.x + 16, target.pos.y - 10, '¡ESQUIVA BAJA!', '#38bdf8');
      }
    }
  }
};

/**
 * Actualiza y retorna el objeto de contexto unificado (Zero-GC) para sistemas, props e interacciones.
 * @param {number} [deltaTime=0.016]
 */
function buildGameContext(deltaTime = 0.016) {
  _gameContext.deltaTime = deltaTime;
  _gameContext.player = player;
  _gameContext.engine = engine || null;
  _gameContext.tilemap = tilemap || null;
  _gameContext.time = engine ? engine.lastTime : 0;
  _gameContext.ctx = null;
  return _gameContext;
}

let simClockSec = 0;
let _lastUpdateMs = 0;

// 6. Ciclo de Actualización (Update)
function update(deltaTime) {
  const _tUpdStart = window.DEBUG_MODE ? performance.now() : 0;
  const gameState = stateManager.get('game_state');
  if (gameState === 'STATE_CINEMATIC') {
    cinematicManager.update(deltaTime);
    // Evitar refrescos rAF constantes mientras el usuario lee el cuadro ya escrito
    if (!cinematicManager.isTyping && !cinematicManager._transitionPending) {
      engine.pause(false);
    }
    return;
  }
  if (gameState !== 'STATE_PLAYING' || !worldInitialized || !player) {
    return;
  }

  inputManager.update();
  simClockSec += deltaTime;

  // Cálculos únicos reciclados por Jugador, Sigilo, Chunks y Proyectiles
  _playerCenterCache.x = Math.round(player.pos.x) + player.width * 0.5;
  _playerCenterCache.y = Math.round(player.pos.y) + player.height * 0.5;
  const gameContext = buildGameContext(deltaTime);
  if (tilemap) {
    const ts = tilemap.tileSize || 32;
    const pTileId = tilemap.getTile(
      Math.floor(_playerCenterCache.x / ts),
      Math.floor(_playerCenterCache.y / ts)
    );
    gameContext.surfaceSlideFactor = Tilemap.getSurfaceSlideFactor(pTileId, currentWorldMeta.biome);
  } else {
    gameContext.surfaceSlideFactor = 1.0;
  }

  stealthSystem.evaluateZoneAt(_playerCenterCache.x, _playerCenterCache.y, stateManager, player, deltaTime);
  if (stealthSystem.enabled) {
    stealthSystem.setPlayerLightLevel(samplePlayerLightFactor(_playerCenterCache.x, _playerCenterCache.y));
  }

  // Sincronización reactiva de Vitalidad máxima con rangos de 'max_health_up' sin emitir si no cambió
  const targetMaxHp = 3 + skillTreeManager.getSkillRank('max_health_up');
  if (player.max_health !== targetMaxHp) {
    const gain = targetMaxHp - player.max_health;
    player.max_health = targetMaxHp;
    player.health = Math.min(targetMaxHp, gain > 0 ? player.health + gain : player.health);
    stateManager.set('player_health', player.health);
    stateManager.set('player_max_health', player.max_health);
  }

  // Ocultación de sigilo solo evaluada si StealthSystem está activo; arbustos conservan su física reactiva ligera
  if (player && !player.isDead) {
    if (stealthSystem.enabled) {
      stealthSystem.syncPlayerConcealment(player, foliageSystem, stateManager);
    } else if (foliageSystem) {
      foliageSystem.updateInteraction(player, false);
    }
  }

  const updateBounds = camera.getVisibleWorldBounds(64);
  combatManager.update(gameContext);
  _projectileHooks.playerTarget = player;
  projectileSystem.update(deltaTime, _projectileHooks);
  chunkManager.update(updateBounds, deltaTime);
  entityManager.update(gameContext);
  waveManager.update(gameContext);
  interactionSystem.update(deltaTime, gameContext);
  updateCaveOrbIntroSequence(deltaTime);
  vfxRenderer.update(deltaTime, combatManager.activeAttacks);
  vfxRenderer.updateBiomeWeather(deltaTime, camera, currentWorldMeta.weather || 'pollen');

  _playerCenterCache.x = Math.round(player.pos.x) + player.width * 0.5;
  _playerCenterCache.y = Math.round(player.pos.y) + player.height * 0.5;
  playerLight.x = _playerCenterCache.x;
  playerLight.y = _playerCenterCache.y;
  const equippedPower = stateManager.get('equipped_power') || 'Fuego';
  playerLight.color = POWER_LIGHT_COLORS[equippedPower] || '#38bdf8';

  // Pasada única sobre cubeta O(1) de enemigos: recicla `ent._lastPlayerDistSq` de `Enemy.update()`
  // para Cámara (combatFocus) y Sigilo (threat_level) sin recalcular distancias.
  let combatFocus = null;
  const enemies = entityManager.getByTag('enemy');
  let focusX = 0;
  let focusY = 0;
  let enemyCount = 0;
  let hasAggroEnemy = false;
  let hasAlertEnemy = false;
  const focusRangeSq = 340 * 340;
  const alertRangeSq = 270 * 270;

  for (let i = 0; i < enemies.length; i++) {
    const ent = enemies[i];
    if (!ent || ent.active === false || ent.isDead) continue;
    const ex = ent.pos.x + ent.width * 0.5;
    const ey = ent.pos.y + ent.height * 0.5;
    let distSq = ent._lastPlayerDistSq;
    if (!Number.isFinite(distSq)) {
      const dx = ex - _playerCenterCache.x;
      const dy = ey - _playerCenterCache.y;
      distSq = dx * dx + dy * dy;
    }

    if (distSq <= focusRangeSq) {
      focusX += ex;
      focusY += ey;
      enemyCount++;
    }

    if (stealthSystem.enabled) {
      if (ent.aiState === 'CHASE' || ent.aiState === 'TELEGRAPH' || ent.aiState === 'ATTACK') {
        hasAggroEnemy = true;
      } else if (distSq <= alertRangeSq) {
        hasAlertEnemy = true;
      }
    }
  }

  if (enemyCount > 0) {
    _combatFocusCache.x = focusX / enemyCount;
    _combatFocusCache.y = focusY / enemyCount;
    combatFocus = _combatFocusCache;
  }

  // Viñeta de amenaza solo activa cuando StealthSystem está habilitado
  const currentThreat = stealthSystem.enabled
    ? ((waveManager && waveManager.isWaveActive) || hasAggroEnemy
        ? 'danger'
        : hasAlertEnemy
          ? 'alert'
          : player.isStealthHidden
            ? 'stealth'
            : 'calm')
    : 'calm';
  if (stateManager.get('threat_level') !== currentThreat) {
    stateManager.set('threat_level', currentThreat);
  }

  camera.update(_playerCenterCache, deltaTime, player.aimDir, combatFocus);

  const isCriticalAudio = Boolean(stateManager.get('health_critical'))
    || player.health <= 1
    || player.currentState === 'STATE_STAGGERED';
  audioManager.setCriticalAudioState(isCriticalAudio);
  if (window.DEBUG_MODE) {
    _lastUpdateMs = performance.now() - _tUpdStart;
  }
}

// 7. Ciclo de Dibujado Unificado (Single-Canvas Opaque Buffer + Frustum Culling previo al Y-Sort)
function render(deltaTime) {
  const gameState = stateManager.get('game_state');
  if (gameState !== 'STATE_PLAYING' && gameState !== 'STATE_PAUSED') {
    return;
  }
  if (!worldInitialized || !tilemap || !player) {
    return;
  }

  const _tRndStart = window.DEBUG_MODE ? performance.now() : 0;
  renderer.begin(camera);
  tilemap.render(renderer.ctx, camera);

  const visibleBounds = camera.getVisibleWorldBounds(128);
  const visibleEntities = entityManager.getVisibleEntities(visibleBounds);

  renderer.drawEnemyGroundDecals(visibleEntities, stealthSystem, CelSpriteAtlas.getProjectileSprite);
  renderer.drawCanopyShadows(entityManager.getByTag('tree'), camera, simClockSec);
  renderer.drawEntities(visibleEntities, camera, true);
  vfxRenderer.render(renderer.ctx, combatManager.activeAttacks, player);
  projectileSystem.render(renderer.ctx, visibleBounds, CelSpriteAtlas.getProjectileSprite);
  renderer.end(camera);

  lightManager.update(deltaTime);
  lightManager.render(camera);
  lightManager.compositeTo(renderer.ctx, mainCanvas.width, mainCanvas.height);

  if (gameState === 'STATE_PLAYING') {
    uiManager.render(inputManager, stateManager, deltaTime, camera);
  } else {
    uiManager.setGameState(gameState);
  }

  if (window.DEBUG_MODE) {
    const _rndMs = performance.now() - _tRndStart;
    const stats = chunkManager.getStats();
    perfOverlay.recordFrame(deltaTime, _lastUpdateMs, _rndMs, {
      loadedChunks: stats.loadedChunks,
      rememberedStates: stats.rememberedStates,
      mountedEntities: entityManager.entities.length,
      tileChunks: tilemap._chunkCache.size,
      atlasSprites: CelSpriteAtlas._cache.size
    });
  } else if (perfOverlay.el) {
    perfOverlay.hide();
  }
}

// 8. Inicialización del Motor en Pantalla de Título (STATE_MENU) con CERO bucles activos y CERO pre-carga
engine = new Engine(update, render);
cinematicManager.onWake = () => {
  if (typeof engine !== 'undefined' && engine) engine.resume();
};
stateManager.set('game_state', 'STATE_MENU');
stateManager.set('health_critical', false);
uiManager.setGameState('STATE_MENU');
engine.start();
engine.pause(false);

if (typeof document !== 'undefined') {
  let _wasPlayingOnHide = false;
  document.addEventListener('visibilitychange', () => {
    const st = stateManager.get('game_state');
    if (document.hidden) {
      _wasPlayingOnHide = (st === 'STATE_PLAYING' || st === 'STATE_CINEMATIC');
      engine.pause(false);
    } else if (_wasPlayingOnHide && (st === 'STATE_PLAYING' || st === 'STATE_CINEMATIC')) {
      _wasPlayingOnHide = false;
      engine.resume();
    }
  });
}

// 9. Helper de Eventos Híbridos (Click + Touch robusto con debounce de 250ms)
function addTouchClick(el, fn) {
  if (!el) return;
  let lastTrigger = -Infinity;
  const execute = (e) => {
    if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
    const now = performance.now();
    if (now - lastTrigger < 250) return;
    lastTrigger = now;
    fn(e);
  };

  el.addEventListener('click', (e) => {
    execute(e);
  });

  el.addEventListener('touchend', (e) => {
    if (e.cancelable) e.preventDefault();
    execute(e);
  }, { passive: false });
}

// 10. Inicio de Partida -> Cinemática de Prólogo -> Secuencia In-Engine de los 4 Orbes
let hasShownCaveOpeningLine = false;

/** Estado de la secuencia cinemática en vivo al salir de la cueva */
const introSequenceState = {
  active: false,
  elapsed: 0,
  fireImpacted: false,
  returnedPrompt: false,
  orbs: []
};

/**
 * Inicia la dispersión en vivo de los 4 Orbes Elementales desde la boca de la cueva,
 * enfocando el choque del Orbe de Fuego en el pedestal suroeste y el acecho de las bestias.
 */
function startCaveOrbIntroSequence() {
  introSequenceState.active = true;
  introSequenceState.elapsed = 0;
  introSequenceState.fireImpacted = false;
  introSequenceState.returnedPrompt = false;

  const originX = 264;
  const originY = 172;
  introSequenceState.orbs = [
    { id: 'fuego', color: '#fb923c', radius: 9, sx: originX, sy: originY, tx: 464, ty: 868, arc: 72, x: originX, y: originY, trail: [] },
    { id: 'kinetic', color: '#38bdf8', radius: 7, sx: originX, sy: originY, tx: 1950, ty: 180, arc: -90, x: originX, y: originY, trail: [] },
    { id: 'plantas', color: '#4ade80', radius: 7, sx: originX, sy: originY, tx: 1980, ty: 780, arc: -40, x: originX, y: originY, trail: [] },
    { id: 'eter', color: '#a855f7', radius: 7, sx: originX, sy: originY, tx: 1650, ty: 1220, arc: 65, x: originX, y: originY, trail: [] }
  ];
  vfxRenderer.setIntroOrbs(introSequenceState.orbs);
  camera.cinematicTarget = { x: originX, y: originY + 60 };
  if (audioManager && typeof audioManager.playRunicResonance === 'function') {
    audioManager.playRunicResonance();
  }
}

/**
 * Actualiza por fotograma la secuencia in-engine de salida de la cueva (0s -> 3.35s).
 * @param {number} dt
 */
function updateCaveOrbIntroSequence(dt) {
  if (!introSequenceState.active) return;
  introSequenceState.elapsed += dt;
  const t = introSequenceState.elapsed;

  if (t < 1.15) {
    const p = Math.min(1, t / 1.15);
    const ease = 1 - Math.pow(1 - p, 2);
    for (let i = 0; i < introSequenceState.orbs.length; i++) {
      const orb = introSequenceState.orbs[i];
      orb.trail.push({ x: orb.x, y: orb.y });
      if (orb.trail.length > 7) orb.trail.shift();
      orb.x = orb.sx + (orb.tx - orb.sx) * ease;
      orb.y = orb.sy + (orb.ty - orb.sy) * ease - Math.sin(p * Math.PI) * orb.arc;
    }
    const fireOrb = introSequenceState.orbs[0];
    camera.cinematicTarget = { x: Math.round(fireOrb.x), y: Math.round(fireOrb.y) };
    return;
  }

  if (!introSequenceState.fireImpacted) {
    introSequenceState.fireImpacted = true;
    chunkManager.update({ x: 464, y: 800 }, 0, true);
    vfxRenderer.setIntroOrbs([]);
    vfxRenderer.spawnImpact('fire_burst', 464, 868, { radius: 54, duration: 0.55, color: '#fb923c' });
    vfxRenderer.spawnImpact('wood_explosion', 464, 868, { radius: 44, duration: 0.45 });
    camera.addTrauma(0.45);
    audioManager.playExplosion();

    // Atraer visiblemente a los sabuesos cercanos al pedestal del Orbe de Fuego caído
    const enemies = entityManager.getByTag('enemy');
    let attractedCount = 0;
    for (let i = 0; i < enemies.length; i++) {
      const e = enemies[i];
      if (!e || e.isDead || e.archetype !== 'hound') continue;
      if (Math.hypot(e.pos.x - 450, e.pos.y - 720) < 360) {
        const tx = attractedCount % 2 === 0 ? 416 : 512;
        e.aiState = 'PATROL';
        e.aiTimer = 3.2;
        if (e.patrolTarget && typeof e.patrolTarget.set === 'function') {
          e.patrolTarget.set(tx, 842);
        }
        attractedCount++;
      }
    }

    stateManager.set('active_dialogue', {
      speaker: 'ECO DE LA RELIQUIA',
      text: '¡Los cuatro Orbes se dispersan por el mundo! El Núcleo de Fuego ha caído al suroeste, atrayendo a las bestias...',
      timer: 3.4
    });
  }

  if (t < 2.45) {
    camera.cinematicTarget = { x: 464, y: 820 };
    return;
  }

  if (t < 3.35) {
    camera.cinematicTarget = { x: 264, y: 238 };
    return;
  }

  // Fin de secuencia: ceder control total a la Cámara con Zona Muerta Cuadrada frente a la espada
  introSequenceState.active = false;
  camera.cinematicTarget = null;
  vfxRenderer.setIntroOrbs([]);

  if (!introSequenceState.returnedPrompt) {
    introSequenceState.returnedPrompt = true;
    stateManager.set('active_dialogue', {
      speaker: 'SANTI',
      text: '¡La Espada del Alba aguarda justo frente a mí! Debo empuñarla [E / Clic Izq] y seguir el rastro de brasas hacia el Núcleo de Fuego.',
      timer: 5.5
    });
  }
}

async function enterCaveExitGameplay() {
  try {
    await ensureInitialWorldData();
    ensureWorldInitialized();
    if (!worldInitialized) {
      throw new Error('No se pudo inicializar el escenario inicial');
    }
  } catch (err) {
    console.error('[Main] Error cargando el escenario inicial:', err);
    stateManager.set('game_state', 'STATE_MENU');
    uiManager.setGameState('STATE_MENU');
    if (mainMenuEl) {
      mainMenuEl.classList.add('menu-cover-active');
      mainMenuEl.classList.remove('hidden');
    }
    engine.pause(false);
    return;
  }
  CelSpriteAtlas.prewarm();

  stateManager.set('game_state', 'STATE_PLAYING');
  uiManager.setGameState('STATE_PLAYING');
  cinematicManager.releaseCache();
  if (mainMenuEl) mainMenuEl.classList.remove('menu-cover-active');
  engine.resume();
  audioManager.setBiomeAmbience(currentWorldMeta.biome);

  if (!hasShownCaveOpeningLine) {
    hasShownCaveOpeningLine = true;
    camera.snapTo({ x: player.pos.x + player.width / 2, y: player.pos.y + player.height / 2 });
    chunkManager.update(camera.getVisibleWorldBounds(64), 0, true);
    if (currentWorldKey === 'cave_exit_intro') {
      startCaveOrbIntroSequence();
    } else {
      stateManager.set('active_dialogue', {
        speaker: 'SANTI',
        text: 'El aire fresco del bosque... Tarak dijo que su santuario está cruzando el arroyo al este.',
        timer: 5.5
      });
    }
  }
}

function startGame() {
  if (stateManager.get('game_state') !== 'STATE_MENU') return;
  // Inicia la carga dinámica del JSON del Mundo 1 en paralelo con el prólogo para evitar demora al omitir
  void ensureInitialWorldData();
  uiManager.unmountSanctuary();
  if (sanctuaryModalEl) sanctuaryModalEl.classList.add('hidden');
  if (mainMenuEl) {
    mainMenuEl.classList.add('hidden');
    mainMenuEl.classList.remove('menu-cover-active');
  }

  engine.resume();
  audioManager.setBiomeAmbience(currentWorldMeta.biome);

  cinematicManager.play(PROLOGUE_CUTSCENE, () => {
    void enterCaveExitGameplay();
  });
}

// Tocar o hacer clic en cualquier parte de la pantalla principal para iniciar (estilo clásico arcade)
if (mainMenuEl) {
  const onTitleScreenBackgroundTap = (e) => {
    if (stateManager.get('game_state') !== 'STATE_MENU') return;
    if (e.target && typeof e.target.closest === 'function') {
      if (e.target.closest('#btn-settings') || e.target.closest('#btn-level-editor') || e.target.closest('#skill-tree-modal')) return;
    }
    startGame();
  };
  mainMenuEl.addEventListener('click', onTitleScreenBackgroundTap);
  mainMenuEl.addEventListener('touchend', (e) => {
    if (e.target && typeof e.target.closest === 'function') {
      if (e.target.closest('#btn-settings') || e.target.closest('#btn-level-editor') || e.target.closest('#skill-tree-modal')) return;
    }
    if (e.cancelable) e.preventDefault();
    onTitleScreenBackgroundTap(e);
  }, { passive: false });
}

const isTouchDevice = (
  ('ontouchstart' in window) ||
  (navigator.maxTouchPoints > 0) ||
  /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
  (navigator.userAgentData && navigator.userAgentData.mobile === true)
);

if (pressEnterMsg) {
  pressEnterMsg.innerHTML = isTouchDevice
    ? '<span id="press-start-label">TOCA LA PANTALLA O COMENZAR PARA INICIAR</span>'
    : '<span id="press-start-label">PRESIONA ENTER O HAZ CLIC PARA COMENZAR</span>';
}

// 11. Hub Unificado del Santuario (4 Pestañas: Habilidades | Arsenal | Códice | Sistema)
let sanctuaryOriginState = 'STATE_PLAYING';

function getSanctuaryDeps() {
  return {
    skillTreeManager,
    equipmentManager,
    stateManager,
    inputManager,
    waveManager,
    audioManager,
    player,
    onTriggerHorde: () => {
      closeSanctuary();
      if (stateManager.get('game_state') === 'STATE_PLAYING' && player && levelInfo) {
        // Teletransportar suavemente a Santi a la plaza del Santuario si estaba lejos para probar la horda de inmediato
        if (levelInfo.arenaCenter && Math.hypot(player.pos.x - levelInfo.arenaCenter.x, player.pos.y - levelInfo.arenaCenter.y) > 420) {
          player.pos.set(levelInfo.arenaCenter.x - 40, levelInfo.arenaCenter.y);
          camera.snapTo({ x: player.pos.x + player.width * 0.5, y: player.pos.y + player.height * 0.5 });
          chunkManager.update(camera.getVisibleWorldBounds(64), 0, true);
        }
        player.unlockAllElements();
        stateManager.set('gauntlet_tier', 3);
        stateManager.set('equipped_power', player.currentAbility || 'Fuego');
        stateManager.set('level_objective', '¡Sobrevive a las 5 Oleadas del Eclipse en el Santuario!');
        waveManager.startHorde(buildGameContext(0.016));
      }
    }
  };
}

function isSanctuaryOpen() {
  return !!(sanctuaryModalEl && !sanctuaryModalEl.classList.contains('hidden'));
}

function openSanctuary(initialTab = 'skills') {
  if (!sanctuaryModalEl) return;
  const current = stateManager.get('game_state');

  if (current === 'STATE_CINEMATIC') return;

  if (!isSanctuaryOpen()) {
    sanctuaryOriginState = current === 'STATE_MENU' ? 'STATE_MENU' : 'STATE_PLAYING';
    if (current === 'STATE_PLAYING') {
      stateManager.set('game_state', 'STATE_PAUSED');
      uiManager.setGameState('STATE_PAUSED');
      engine.pause(true);
    } else if (current === 'STATE_MENU') {
      if (mainMenuEl) mainMenuEl.classList.add('hidden');
    }
    sanctuaryModalEl.classList.remove('hidden');
  }

  // Adaptar botones de Sistema según si se abrió desde el Título o desde la Partida
  if (btnToMainMenu) {
    btnToMainMenu.classList.toggle('hidden', sanctuaryOriginState === 'STATE_MENU');
  }
  if (btnResume) {
    const span = btnResume.querySelector('span');
    if (span) span.textContent = sanctuaryOriginState === 'STATE_MENU' ? 'VOLVER AL TÍTULO' : 'REANUDAR AVENTURA';
  }
  if (btnCloseTalents) {
    btnCloseTalents.textContent = sanctuaryOriginState === 'STATE_MENU' ? 'VOLVER AL TÍTULO' : 'VOLVER AL JUEGO';
  }

  uiManager.setSanctuaryTab(initialTab, getSanctuaryDeps());
}

function closeSanctuary() {
  if (!isSanctuaryOpen()) return;
  sanctuaryModalEl.classList.add('hidden');
  uiManager.unmountSanctuary();

  if (sanctuaryOriginState === 'STATE_MENU') {
    stateManager.set('game_state', 'STATE_MENU');
    uiManager.setGameState('STATE_MENU');
    if (mainMenuEl) {
      mainMenuEl.classList.add('menu-cover-active');
      mainMenuEl.classList.remove('hidden');
    }
  } else {
    stateManager.set('game_state', 'STATE_PLAYING');
    uiManager.setGameState('STATE_PLAYING');
    engine.resume();
  }
}

function toggleSanctuaryTab(tabName) {
  if (isSanctuaryOpen()) {
    if (uiManager.activeSanctuaryTab === tabName) {
      closeSanctuary();
    } else {
      uiManager.setSanctuaryTab(tabName, getSanctuaryDeps());
    }
  } else {
    openSanctuary(tabName);
  }
}

// Registrar hook para que el Altar del Santuario ([E]) abra directamente el Árbol de Habilidades
stateManager.set('open_sanctuary_hook', (tab = 'skills') => {
  openSanctuary(tab);
});

// Enlazar botones de navegación del Santuario y HUD
const hudRelicBadge = document.getElementById('hud-relic-badge');
addTouchClick(hudRelicBadge, () => {
  if (stateManager.get('game_state') === 'STATE_PLAYING') {
    inputManager.cyclePower(1);
  }
});
addTouchClick(btnSettings, () => openSanctuary('system'));
addTouchClick(btnQuickTalents, () => toggleSanctuaryTab('skills'));
addTouchClick(btnQuickArsenal, () => toggleSanctuaryTab('arsenal'));
addTouchClick(btnQuickPause, () => toggleSanctuaryTab('system'));
addTouchClick(btnResume, () => closeSanctuary());
addTouchClick(btnCloseTalents, () => closeSanctuary());
addTouchClick(btnCloseTalentsX, () => closeSanctuary());

addTouchClick(btnNavPrev, () => {
  if (isSanctuaryOpen()) uiManager.cycleSanctuaryTab(-1, getSanctuaryDeps());
});
addTouchClick(btnNavNext, () => {
  if (isSanctuaryOpen()) uiManager.cycleSanctuaryTab(1, getSanctuaryDeps());
});

document.querySelectorAll('[data-sanctuary-tab]').forEach((tabBtn) => {
  addTouchClick(tabBtn, () => {
    uiManager.setSanctuaryTab(tabBtn.dataset.sanctuaryTab, getSanctuaryDeps());
  });
});

addTouchClick(btnToMainMenu, () => {
  if (sanctuaryModalEl) sanctuaryModalEl.classList.add('hidden');
  uiManager.unmountSanctuary();
  if (mainMenuEl) {
    mainMenuEl.classList.add('menu-cover-active');
    mainMenuEl.classList.remove('hidden');
  }
  stateManager.set('game_state', 'STATE_MENU');
  uiManager.setGameState('STATE_MENU');
  projectileSystem.clear();
  if (tilemap) tilemap.clearChunks();
  CelSpriteAtlas.clear();
  engine.pause(false);
});

// 11.B Integración de la Forja de Niveles (Carga Perezosa e Inyección Bajo Demanda)
let _activeEditorInstance = null;
let _isPlaytestingLevel = false;

async function launchLevelEditor() {
  if (mainMenuEl) {
    mainMenuEl.classList.add('hidden');
  }
  if (sanctuaryModalEl) {
    sanctuaryModalEl.classList.add('hidden');
    uiManager.unmountSanctuary();
  }

  const { openLevelEditor } = await import('./editor/LevelEditor.js');
  _activeEditorInstance = openLevelEditor({
    container: document.getElementById('game-container'),
    onExit: () => {
      engine.pause(false);
      if (mainMenuEl) {
        mainMenuEl.classList.remove('hidden');
        mainMenuEl.classList.add('menu-cover-active');
      }
      stateManager.set('game_state', 'STATE_MENU');
      uiManager.setGameState('STATE_MENU');
    },
    onPlaytest: async (worldKey) => {
      _isPlaytestingLevel = true;
      if (btnEditorReturn) btnEditorReturn.classList.remove('hidden');

      engine.resume();
      if (stateManager.get('game_state') !== 'STATE_PLAYING') {
        stateManager.set('game_state', 'STATE_PLAYING');
        uiManager.setGameState('STATE_PLAYING');
      }
      await loadWorld(worldKey);
    }
  });
}

if (btnLevelEditor) {
  addTouchClick(btnLevelEditor, (e) => {
    if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
    launchLevelEditor();
  });
}

if (btnEditorReturn) {
  addTouchClick(btnEditorReturn, async () => {
    _isPlaytestingLevel = false;
    btnEditorReturn.classList.add('hidden');
    engine.pause(false);
    stateManager.set('active_dialogue', null);
    stateManager.set('game_state', 'STATE_MENU');
    uiManager.setGameState('STATE_MENU');
    combatManager.clearAllCombatState();
    projectileSystem.clear();
    chunkManager.clearAll();
    if (_activeEditorInstance) {
      _activeEditorInstance.resumeFromPlaytest();
    }
  });
}

// Botón táctil móvil para interactuar con Pedestales, NPCs y Altares
if (btnTouchInteract) {
  addTouchClick(btnTouchInteract, () => {
    if (stateManager.get('game_state') === 'STATE_PLAYING') {
      interactionSystem.tryInteract(buildGameContext(0.016));
    }
  });
}

// 12. Controles de Audio SFX y Visibilidad del Gamepad Táctil
function syncAudioBtnLabel() {
  if (!btnToggleAudio) return;
  btnToggleAudio.textContent = audioManager.muted ? 'SILENCIADO' : 'ACTIVO';
  btnToggleAudio.classList.toggle('primary', !audioManager.muted);
  btnToggleAudio.classList.toggle('secondary', audioManager.muted);
}
syncAudioBtnLabel();

addTouchClick(btnToggleAudio, () => {
  audioManager.toggleMute();
  syncAudioBtnLabel();
  if (!audioManager.muted) audioManager.playHeal();
});

function syncTouchHudBtnLabel() {
  if (!btnToggleTouchHud) return;
  btnToggleTouchHud.textContent = inputManager.forceTouchControls ? 'VISIBLE (FORZADO)' : 'AUTOMÁTICO';
  btnToggleTouchHud.classList.toggle('primary', inputManager.forceTouchControls);
  btnToggleTouchHud.classList.toggle('secondary', !inputManager.forceTouchControls);
}
syncTouchHudBtnLabel();

addTouchClick(btnToggleTouchHud, () => {
  inputManager.toggleTouchControls();
  syncTouchHudBtnLabel();
});

// 13. Callbacks de Entrada (Talentos [U], Pausa [Esc], Selección Elemental Validada)
inputManager.onTalents(() => {
  if (stateManager.get('game_state') === 'STATE_MENU' || stateManager.get('game_state') === 'STATE_CINEMATIC') return;
  toggleSanctuaryTab('skills');
});

inputManager.onPause(() => {
  if (stateManager.get('game_state') === 'STATE_CINEMATIC') return;
  if (isSanctuaryOpen()) {
    closeSanctuary();
    return;
  }
  if (stateManager.get('game_state') === 'STATE_PLAYING') {
    openSanctuary('system');
  }
});

inputManager.onSkillEquipped((newPower) => {
  if (!player) return;
  if (!player.hasElement(newPower)) {
    // Impedir disonancia ludonarrativa si el engarce aún no ha sido despertado y conservar el poder activo
    const fallbackPower = player.currentAbility || 'Fuego';
    inputManager.currentPower = fallbackPower;
    if (player.hasElement(fallbackPower)) {
      stateManager.set('equipped_power', fallbackPower);
    }
    if (stateManager.get('game_state') === 'STATE_PLAYING') {
      const tier = stateManager.get('gauntlet_tier') || 0;
      stateManager.set('active_dialogue', {
        speaker: 'SANTI',
        text: tier === 0
          ? 'El Guantelete aún está frío... Debo buscar el Orbe de Fuego que cayó hacia el suroeste.'
          : `El engarce de ${newPower} sigue dormido. El Sabio Tarak podrá armonizarlo en su Santuario.`,
        timer: 3.0
      });
    }
    return;
  }
  stateManager.set('equipped_power', newPower);
  player.equipAbility(newPower);
});

window.addEventListener('keydown', (e) => {
  // Atajo F9 para retornar inmediatamente del Playtest a la Forja de Niveles
  if (e.key === 'F9' && _isPlaytestingLevel && btnEditorReturn) {
    e.preventDefault();
    btnEditorReturn.click();
    return;
  }

  // Si el editor de niveles está en pantalla, no interferir con sus atajos ni iniciar juego
  if (document.getElementById('level-editor-overlay')) return;

  const currentState = stateManager.get('game_state');

  // Avance desde Pantalla de Título con Enter o Espacio (si el modal de ajustes no está abierto)
  if (currentState === 'STATE_MENU' && !isSanctuaryOpen()) {
    if (e.code === 'Enter' || e.code === 'Space') {
      e.preventDefault();
      startGame();
      return;
    }
  }

  // Navegación por teclado dentro del Hub Unificado del Santuario ([Q] / [E])
  if (isSanctuaryOpen() && !e.repeat) {
    if (e.code === 'KeyQ') {
      e.preventDefault();
      uiManager.cycleSanctuaryTab(-1, getSanctuaryDeps());
      return;
    }
    if (e.code === 'KeyE') {
      e.preventDefault();
      uiManager.cycleSanctuaryTab(1, getSanctuaryDeps());
      return;
    }
  }

  // Accesos rápidos a Arsenal [I] y Crónica/Códice [M] durante la partida
  if ((currentState === 'STATE_PLAYING' || isSanctuaryOpen()) && !e.repeat) {
    if (e.code === 'KeyI') {
      e.preventDefault();
      toggleSanctuaryTab('arsenal');
      return;
    }
    if (e.code === 'KeyM') {
      e.preventDefault();
      toggleSanctuaryTab('codex');
      return;
    }
  }

  if (window.DEBUG_MODE) {
    if (e.code === 'KeyH') {
      stateManager.set('health_critical', !stateManager.get('health_critical'));
    }
    if (e.code === 'KeyT') {
      inputManager.toggleTouchControls();
      syncTouchHudBtnLabel();
    }
  }
});

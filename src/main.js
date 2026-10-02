/**
 * @file main.js
 * @description Punto de entrada principal y orquestador del nivel "El Bosque" en formato
 * Next-Gen Pixel Art (estética The Minish Cap / Eastward de 32-bit de alta fidelidad).
 * Integra resolución 16:9 panorámica (960x540), cámara cinemática cercana con LERP exponencial
 * continuo y Screen Shake por impacto, físicas ambientales de vegetación reactiva (FoliageSystem)
 * y una interfaz UI minimalista y cute cuyo Virtual Gamepad táctil se muestra ÚNICAMENTE en móvil.
 * @author Be a Legend Team
 * @version 1.6.0
 */

// Bandera de depuración global (false en producción)
window.DEBUG_MODE = false;

import { Engine } from './core/Engine.js';
import { InputManager } from './core/InputManager.js';
import { StateManager } from './core/StateManager.js';
import { ResourceManager } from './core/ResourceManager.js';
import { EntityManager } from './entities/EntityManager.js';
import { Player } from './entities/Player.js';
import { NPC } from './entities/NPC.js';
import { Enemy } from './entities/Enemy.js';
import { Tree } from './entities/Tree.js';
import { House } from './entities/House.js';
import { PhysicsSystem } from './systems/PhysicsSystem.js';
import { InteractionSystem } from './systems/InteractionSystem.js';
import { CombatManager } from './systems/CombatManager.js';
import { EquipmentManager } from './systems/EquipmentManager.js';
import { SkillTreeManager } from './systems/SkillTreeManager.js';
import { Renderer } from './render/Renderer.js';
import { LightManager } from './render/LightManager.js';
import { Camera } from './render/Camera.js';
import { UIManager } from './ui/UIManager.js';
import { Tilemap } from './world/Tilemap.js';
import { FoliageSystem } from './world/FoliageSystem.js';
import { CinematicManager, PROLOGUE_CUTSCENE } from './cinematics/CinematicManager.js';
import { VFXRenderer } from './render/VFXRenderer.js';
import { LevelLoader } from './world/LevelLoader.js';
import startingClearingLevel from './data/levels/starting_clearing.json';

/**
 * @typedef {Object} AssetManifestItem
 * @property {string} key - Identificador único del asset
 * @property {string} url - Ruta bajo /assets/...
 * @property {string} type - Tipo ('image' | 'json')
 * @property {number} tileSize - Tamaño nominal en píxeles (32x32)
 * @property {boolean} required - Si es estrictamente requerido
 * 
 * ESPECIFICACIÓN DEL FORMATO DE ASSETS (Pixel-Perfect):
 * - Formato: PNG con canal alfa nativo RGBA (32-bit), sin color key ni thresholding.
 * - Tiles de terreno: 32x32 px exactos sin bordes transparentes para ensamble seamless.
 * - Sprites de entidades: proporciones alineadas a cuadrícula modular de 32x32 px.
 * - Spritesheets: alineación estricta en celdas de cuadrícula de 32x32 px.
 */
import assetsManifest from './data/assets.json';

// Capas de renderizado del Motor (Nativo 960x540 - Panorámico 16:9)
const mainCanvas = document.getElementById('main-canvas');
const lightCanvas = document.getElementById('light-canvas');

// Overlays HTML de Menús
const mainMenuEl = document.getElementById('main-menu');
const pauseMenuEl = document.getElementById('pause-menu');
const settingsModalEl = document.getElementById('settings-modal');

const btnPlay = document.getElementById('btn-play');
const btnSettings = document.getElementById('btn-settings');
const btnResume = document.getElementById('btn-resume');
const btnPauseSettings = document.getElementById('btn-pause-settings');
const btnToMainMenu = document.getElementById('btn-to-main-menu');
const btnCloseSettings = document.getElementById('btn-close-settings');
const btnCloseSettingsX = document.getElementById('btn-close-settings-x');

// Elementos de la Pantalla de Título
const pressEnterMsg = document.getElementById('press-enter-msg');
const menuCard = document.getElementById('menu-card');

// 1. Instanciación de Sistemas Centrales
const resourceManager = new ResourceManager();
const inputManager = new InputManager(mainCanvas);
const stateManager = new StateManager();
const entityManager = new EntityManager();

const physicsSystem = new PhysicsSystem(entityManager);
const interactionSystem = new InteractionSystem(entityManager, inputManager, stateManager);
const equipmentManager = new EquipmentManager();
const combatManager = new CombatManager(equipmentManager);
const skillTreeManager = new SkillTreeManager(stateManager);

const renderer = new Renderer(mainCanvas);
const vfxRenderer = new VFXRenderer(); // Renderizado de VFX procedimentales y partículas
const lightManager = new LightManager(lightCanvas, false); // isInterior = false (Luz de día clara)
const uiManager = new UIManager(); // Gestiona el DOM Overlay moderno
const cinematicManager = new CinematicManager(stateManager); // Sistema de cinemáticas narrativas
const camera = new Camera(mainCanvas.width, mainCanvas.height);

// Sistema de físicas ambientales de vegetación reactiva
const foliageSystem = new FoliageSystem(entityManager);

// 2. Carga Data-Driven del Nivel "El Claro Sagrado"
const levelInfo = LevelLoader.loadLevel(startingClearingLevel, {
  entityManager,
  foliageSystem,
  camera
});

const tilemap = new Tilemap(
  startingClearingLevel.map.cols,
  startingClearingLevel.map.rows,
  startingClearingLevel.map.tileSize
);

// 3. Jugador ubicado en el punto de spawn del nivel
const player = new Player(levelInfo.playerSpawn.x, levelInfo.playerSpawn.y);
entityManager.addEntity(player);
stateManager.set('player', player);
stateManager.set('player_health', player.health);
stateManager.set('player_energy', player.energy);
stateManager.set('player_posture', 100);

// 4. Adaptabilidad y Redimensionado Reactivo Full-Screen (Pixel-Perfect sin barras negras)
function resizeCanvases() {
  const dpr = window.devicePixelRatio || 1;
  const width = window.innerWidth;
  const height = window.innerHeight;

  // Ambos canvas ocupan la resolución física completa con escalado de Device Pixel Ratio
  mainCanvas.width = Math.round(width * dpr);
  mainCanvas.height = Math.round(height * dpr);
  lightCanvas.width = Math.round(width * dpr);
  lightCanvas.height = Math.round(height * dpr);

  // Reaplicar imageSmoothingEnabled = false tras cualquier cambio de dimensiones del canvas
  renderer.resize();
  lightManager.resize();

  // Actualizar viewport de la cámara con cálculo de zoom pixel-perfect
  camera.setViewportSize(width, height, dpr);
}
window.addEventListener('resize', resizeCanvases);
window.addEventListener('orientationchange', resizeCanvases);
resizeCanvases();

// 7. Carga Asíncrona de Assets Next-Gen Pixel Art desde Manifiesto
async function initAssets() {
  await resourceManager.loadBatch(assetsManifest);

  // Árboles
  const treeImg = resourceManager.getImage('tree_sprite');
  if (treeImg) {
    const trees = entityManager.getByTag('tree');
    trees.forEach(t => {
      if (typeof t.setSprite === 'function') t.setSprite(treeImg);
    });
  }

  // Cabaña / Casas
  const houseImg = resourceManager.getImage('house_sprite');
  if (houseImg) {
    const houses = entityManager.getByTag('house');
    houses.forEach(h => {
      if (typeof h.setSprite === 'function') h.setSprite(houseImg);
    });
  }

  // Follaje / Arbustos reactivos
  const bushImg = resourceManager.getImage('bush_sprite');
  if (bushImg) {
    foliageSystem.setGlobalSprite(bushImg);
  }

  // Terreno: combina imágenes cargadas con fallback procedimental por tile
  tilemap.build(resourceManager);

  if (typeof window !== 'undefined' && window.DEBUG_MODE) {
    console.log('[Be a Legend] Assets procesados desde el manifiesto.');
  }
}
tilemap.build(null);
initAssets();

// 8. Ciclo de Actualización (Update)
function update(deltaTime) {
  inputManager.update();

  const gameState = stateManager.get('game_state');
  if (gameState === 'STATE_CINEMATIC') {
    cinematicManager.update(deltaTime);
    return;
  }
  if (gameState !== 'STATE_PLAYING') {
    return;
  }

  const gameContext = {
    deltaTime,
    input: inputManager,
    state: stateManager,
    physics: physicsSystem,
    player,
    camera,
    entityManager,
    combatManager,
    equipmentManager,
    skillTreeManager,
    vfxRenderer,
    uiManager,
    engine,
    time: engine.lastTime,
    ctx: null
  };
  combatManager.update(gameContext);
  entityManager.update(gameContext);
  interactionSystem.update(deltaTime);
  vfxRenderer.update(deltaTime, combatManager.activeAttacks);

  // Físicas ambientales de vegetación reactiva al paso del jugador
  foliageSystem.updateInteraction(player);

  // Cámara cinemática suave siguiendo al jugador (LERP exponencial)
  const playerCenter = {
    x: player.pos.x + player.width / 2,
    y: player.pos.y + player.height / 2
  };
  camera.update(playerCenter, deltaTime);
}

// 9. Ciclo de Dibujado (Render)
function render(deltaTime) {
  renderer.begin(camera);

  // Terreno pre-renderizado O(1)
  tilemap.render(renderer.ctx, camera);

  // Entidades del mundo ordenadas con Y-Sorting estricto
  renderer.drawEntities(entityManager.getEntities());

  // Efectos visuales procedimentales, proyectiles y partículas luminosas
  vfxRenderer.render(renderer.ctx, combatManager.activeAttacks, player);

  renderer.end(camera);

  // Capa de Iluminación
  lightManager.update(deltaTime);
  lightManager.render(camera);

  // Capa de Interfaz y Virtual Gamepad
  const gameState = stateManager.get('game_state');
  if (gameState === 'STATE_PLAYING') {
    uiManager.render(inputManager, stateManager, deltaTime, camera);
  } else {
    uiManager.clear();
  }
}

// 10. Inicialización del Motor en Estado STATE_MENU
const engine = new Engine(update, render);
stateManager.set('game_state', 'STATE_MENU');
stateManager.set('health_critical', false); // Estado de salud para la viñeta roja
engine.start();
engine.pause();

// Pre-cargar cinemáticas en segundo plano mientras el usuario está en el menú
if (cinematicManager && PROLOGUE_CUTSCENE) {
  cinematicManager.preloadSequence(PROLOGUE_CUTSCENE).catch(err => {
    console.warn('[Be a Legend] Aviso en pre-carga de cinemáticas:', err);
  });
}

// 11. Conexión de la Lógica de Estados y UI HTML
function startGame() {
  if (stateManager.get('game_state') !== 'STATE_MENU') return;
  mainMenuEl.classList.add('hidden');

  // Iniciar la cinemática del prólogo narrativo o entrar a jugar
  engine.resume();
  cinematicManager.play(PROLOGUE_CUTSCENE, () => {
    stateManager.set('game_state', 'STATE_PLAYING');
    if (typeof window !== 'undefined' && window.DEBUG_MODE) {
      console.log('[Game State] PLAYING tras prólogo cinemático.');
    }
  });
}

btnPlay.addEventListener('click', (e) => {
  e.stopPropagation();
  startGame();
});

function handleTitleScreenAdvance() {
  if (stateManager.get('game_state') !== 'STATE_MENU') return;

  if (pressEnterMsg && !pressEnterMsg.classList.contains('hidden')) {
    // Si está en el prompt inicial, pasar al menú
    pressEnterMsg.classList.add('hidden');
    if (menuCard) {
      menuCard.classList.remove('hidden');
      if (btnPlay) btnPlay.focus();
    }
  } else {
    // Si el menú ya está desplegado, iniciar la partida directamente
    startGame();
  }
}

// Clic global en cualquier zona de la portada para avanzar
if (mainMenuEl) {
  mainMenuEl.addEventListener('click', (e) => {
    if (e.target.closest('#btn-settings') || e.target.closest('#btn-play')) return;
    handleTitleScreenAdvance();
  });
}

function openPauseMenu() {
  if (stateManager.get('game_state') === 'STATE_PLAYING') {
    stateManager.set('game_state', 'STATE_PAUSED');
    engine.pause();
    pauseMenuEl.classList.remove('hidden');
  }
}

function resumeGame() {
  if (stateManager.get('game_state') === 'STATE_PAUSED') {
    pauseMenuEl.classList.add('hidden');
    stateManager.set('game_state', 'STATE_PLAYING');
    engine.resume();
  }
}

btnResume.addEventListener('click', resumeGame);

btnToMainMenu.addEventListener('click', () => {
  pauseMenuEl.classList.add('hidden');
  mainMenuEl.classList.remove('hidden');
  // Resetear la pantalla de título al volver al menú
  if (pressEnterMsg) pressEnterMsg.classList.remove('hidden');
  if (menuCard) menuCard.classList.add('hidden');
  stateManager.set('game_state', 'STATE_MENU');
  engine.pause();
});

inputManager.onPause(() => {
  const current = stateManager.get('game_state');
  if (current === 'STATE_PLAYING') openPauseMenu();
  else if (current === 'STATE_PAUSED') resumeGame();
});

inputManager.onSkillEquipped((newPower) => {
  stateManager.set('equipped_power', newPower);
  player.equipAbility(newPower);
  if (typeof window !== 'undefined' && window.DEBUG_MODE) {
    console.log(`[Reliquia] Poder equipado: ${newPower}`);
  }
});

btnSettings.addEventListener('click', () => settingsModalEl.classList.remove('hidden'));
btnPauseSettings.addEventListener('click', () => settingsModalEl.classList.remove('hidden'));
btnCloseSettings.addEventListener('click', () => settingsModalEl.classList.add('hidden'));
if (btnCloseSettingsX) {
  btnCloseSettingsX.addEventListener('click', () => settingsModalEl.classList.add('hidden'));
}

window.addEventListener('keydown', (e) => {
  // Transición del título al menú o inicio inmediato de partida
  if (stateManager.get('game_state') === 'STATE_MENU') {
    if (e.code === 'Enter' || e.code === 'Space') {
      e.preventDefault();
      handleTitleScreenAdvance();
      return;
    }
  }

  // Comandos de Debug (Solo activos bajo DEBUG_MODE = true)
  if (window.DEBUG_MODE) {
    if (e.code === 'KeyH') {
      const current = !!stateManager.get('health_critical');
      stateManager.set('health_critical', !current);
      console.log(`[Health] Crítico: ${!current}`);
    }
    if (e.code === 'KeyM') {
      const active = inputManager.toggleTouchControls();
      console.log(`[Gamepad Táctil] Forzado: ${active}`);
    }
  }
});

// 12. Herramientas de Depuración Internas (Protegidas bajo DEBUG_MODE)
if (window.DEBUG_MODE) {
  window.setKarma = (val) => stateManager.set('karma_level', val);
  window.triggerShake = (intensity = 0.5) => camera.shake(intensity, 0.25);
  window.toggleCritical = () => {
    const c = !stateManager.get('health_critical');
    stateManager.set('health_critical', c);
    return c;
  };
  window.toggleMobileControls = () => inputManager.toggleTouchControls();
  window.playIntroCinematic = () => {
    cinematicManager.play(PROLOGUE_CUTSCENE, () => {
      stateManager.set('game_state', 'STATE_PLAYING');
      engine.resume();
    });
  };
}

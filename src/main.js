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

import { Engine } from './core/Engine.js';
import { InputManager } from './core/InputManager.js';
import { StateManager } from './core/StateManager.js';
import { ResourceManager } from './core/ResourceManager.js';
import { EntityManager } from './entities/EntityManager.js';
import { Player } from './entities/Player.js';
import { NPC } from './entities/NPC.js';
import { Tree } from './entities/Tree.js';
import { House } from './entities/House.js';
import { PhysicsSystem } from './systems/PhysicsSystem.js';
import { InteractionSystem } from './systems/InteractionSystem.js';
import { Renderer } from './render/Renderer.js';
import { LightManager } from './render/LightManager.js';
import { Camera } from './render/Camera.js';
import { UIManager } from './ui/UIManager.js';
import { Tilemap } from './world/Tilemap.js';
import { FoliageSystem } from './world/FoliageSystem.js';

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

// 1. Instanciación de Sistemas Centrales
const resourceManager = new ResourceManager();
const inputManager = new InputManager(mainCanvas);
const stateManager = new StateManager();
const entityManager = new EntityManager();

const physicsSystem = new PhysicsSystem(entityManager);
const interactionSystem = new InteractionSystem(entityManager, inputManager, stateManager);

const renderer = new Renderer(mainCanvas);
const lightManager = new LightManager(lightCanvas, false); // isInterior = false (Luz de día clara)
const uiManager = new UIManager(); // Gestiona el DOM Overlay moderno
const camera = new Camera(mainCanvas.width, mainCanvas.height);

// Sistema de físicas ambientales de vegetación reactiva
const foliageSystem = new FoliageSystem(entityManager);

// 2. Nivel "El Bosque" de 40x40 Casillas (1280x1280 px)
const MAP_COLS = 40;
const MAP_ROWS = 40;
const TILE_SIZE = 32;
const MAP_WIDTH = MAP_COLS * TILE_SIZE;   // 1280 px
const MAP_HEIGHT = MAP_ROWS * TILE_SIZE; // 1280 px

camera.setRoomBounds({ x: 0, y: 0, width: MAP_WIDTH, height: MAP_HEIGHT });
const tilemap = new Tilemap(MAP_COLS, MAP_ROWS, TILE_SIZE);

// 3. Jugador ubicado en el centro del claro
const player = new Player(624, 624);
entityManager.addEntity(player);

// 4. Cabaña de madera estilo Minish Cap
const cabin = new House(560, 260);
entityManager.addEntity(cabin);

// Guardián sabio cerca de la cabaña
const elderNPC = new NPC(640, 410);
entityManager.addEntity(elderNPC);

// 5. Vegetación Reactiva con Físicas de Viento y Contacto
foliageSystem.addFoliage(530, 560);
foliageSystem.addFoliage(570, 680);
foliageSystem.addFoliage(690, 580);
foliageSystem.addFoliage(740, 660);
foliageSystem.addFoliage(450, 490);
foliageSystem.addFoliage(810, 470);
foliageSystem.addFoliage(510, 360);
foliageSystem.addFoliage(680, 350);

// 6. Generación de Árboles Frondosos con Y-Sorting Estricto
const trees = [];
function spawnTree(x, y) {
  const tree = new Tree(x, y);
  entityManager.addEntity(tree);
  trees.push(tree);
}

// Árboles en el claro para pruebas de profundidad en 360°
spawnTree(400, 520);
spawnTree(480, 710);
spawnTree(800, 540);
spawnTree(890, 710);
spawnTree(380, 360);
spawnTree(780, 320);
spawnTree(310, 600);
spawnTree(960, 600);

// Perímetro denso de bosque
for (let x = 0; x < MAP_WIDTH; x += 75) {
  spawnTree(x, 0);
  spawnTree(x + 35, 60);
  spawnTree(x, MAP_HEIGHT - 110);
  spawnTree(x + 35, MAP_HEIGHT - 70);
}
for (let y = 100; y < MAP_HEIGHT - 120; y += 75) {
  if (y > 560 && y < 700) continue; // Camino central
  spawnTree(0, y);
  spawnTree(55, y + 35);
  spawnTree(MAP_WIDTH - 85, y);
  spawnTree(MAP_WIDTH - 140, y + 35);
}

// 7. Carga Asíncrona de Assets Next-Gen Pixel Art
async function initAssets() {
  try {
    await resourceManager.loadBatch([
      { type: 'image', key: 'grass_tile', url: '/assets/tiles/grass.jpg' },
      { type: 'image', key: 'dirt_tile', url: '/assets/tiles/dirt.jpg' },
      { type: 'image', key: 'tree_sprite', url: '/assets/sprites/tree.jpg', transparent: true, threshold: 242 },
      { type: 'image', key: 'house_sprite', url: '/assets/sprites/house.jpg', transparent: true, threshold: 242 },
      { type: 'image', key: 'bush_sprite', url: '/assets/sprites/bush.jpg', transparent: true, threshold: 242 }
    ]);

    const treeImg = resourceManager.getImage('tree_sprite');
    if (treeImg) trees.forEach(t => t.setSprite(treeImg));

    const houseImg = resourceManager.getImage('house_sprite');
    if (houseImg) cabin.setSprite(houseImg);

    const bushImg = resourceManager.getImage('bush_sprite');
    if (bushImg) foliageSystem.setGlobalSprite(bushImg);

    tilemap.build(resourceManager);
    if (DEBUG_MODE) console.log('[Be a Legend] Assets inicializados.');
  } catch (err) {
    console.warn('[Be a Legend] Fallback procedural activo:', err);
    tilemap.build(null);
  }
}
tilemap.build(null);
initAssets();

// 8. Ciclo de Actualización (Update)
let wasAttackPressed = false;

function update(deltaTime) {
  inputManager.update();

  const gameState = stateManager.get('game_state');
  if (gameState !== 'STATE_PLAYING') {
    return;
  }

  const gameContext = {
    deltaTime,
    input: inputManager,
    physics: physicsSystem,
    state: stateManager
  };
  entityManager.update(gameContext);
  interactionSystem.update(deltaTime);

  // Físicas ambientales de vegetación reactiva al paso del jugador
  foliageSystem.updateInteraction(player);

  // Game Feel: Screen Shake en impactos de espada
  if (inputManager.isAttackPressed && !wasAttackPressed) {
    camera.shake(0.38, 0.22); // Temblor visceral
  }
  wasAttackPressed = inputManager.isAttackPressed;

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

  renderer.end(camera);

  // Capa de Iluminación
  lightManager.update(deltaTime);
  lightManager.render(camera);

  // Capa de Interfaz y Virtual Gamepad
  const gameState = stateManager.get('game_state');
  if (gameState === 'STATE_PLAYING') {
    uiManager.render(inputManager, stateManager, deltaTime);
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

// Bandera de depuración global (false en producción)
const DEBUG_MODE = false;

// 11. Conexión de la Lógica de Estados y UI HTML
btnPlay.addEventListener('click', () => {
  mainMenuEl.classList.add('hidden');
  stateManager.set('game_state', 'STATE_PLAYING');
  engine.resume();
  if (DEBUG_MODE) console.log('[Game State] PLAYING');
});

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
  if (DEBUG_MODE) console.log(`[Reliquia] Poder equipado: ${newPower}`);
});

btnSettings.addEventListener('click', () => settingsModalEl.classList.remove('hidden'));
btnPauseSettings.addEventListener('click', () => settingsModalEl.classList.remove('hidden'));
btnCloseSettings.addEventListener('click', () => settingsModalEl.classList.add('hidden'));
if (btnCloseSettingsX) {
  btnCloseSettingsX.addEventListener('click', () => settingsModalEl.classList.add('hidden'));
}

// Atajos de desarrollo para pruebas internas (Detrás de DEBUG_MODE)
window.addEventListener('keydown', (e) => {
  if (e.code === 'KeyH') {
    const current = !!stateManager.get('health_critical');
    stateManager.set('health_critical', !current);
    if (DEBUG_MODE) console.log(`[Health] Crítico: ${!current}`);
  }
  if (e.code === 'KeyM') {
    const active = inputManager.toggleTouchControls();
    if (DEBUG_MODE) console.log(`[Gamepad Táctil] Forzado: ${active}`);
  }
});

// 12. Herramientas de Depuración Internas (Under the Hood)
window.DEBUG_MODE = DEBUG_MODE;
window.setKarma = (val) => stateManager.set('karma_level', val);
window.triggerShake = (intensity = 0.5) => camera.shake(intensity, 0.25);
window.toggleCritical = () => {
  const c = !stateManager.get('health_critical');
  stateManager.set('health_critical', c);
  return c;
};
window.toggleMobileControls = () => inputManager.toggleTouchControls();

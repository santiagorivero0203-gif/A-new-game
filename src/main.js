/**
 * @file main.js
 * @description Punto de entrada principal y orquestador del juego "Be a Legend".
 * Ensambla el nivel de prueba "El Bosque" en estilo 32-bit moderno, el Virtual Gamepad táctil
 * móvil (Joystick, botón de ataque, botón swipe de Reliquia y pausa) y el Mini Menú Principal
 * HTML/CSS gobernado por la máquina de estados del StateManager.
 * @author Be a Legend Team
 * @version 1.4.0
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

// Capas de renderizado del DOM
const mainCanvas = document.getElementById('main-canvas');
const lightCanvas = document.getElementById('light-canvas');
const uiCanvas = document.getElementById('ui-canvas');

// Elementos HTML de Menús
const mainMenuEl = document.getElementById('main-menu');
const pauseMenuEl = document.getElementById('pause-menu');
const settingsModalEl = document.getElementById('settings-modal');

const btnPlay = document.getElementById('btn-play');
const btnSettings = document.getElementById('btn-settings');
const btnResume = document.getElementById('btn-resume');
const btnPauseSettings = document.getElementById('btn-pause-settings');
const btnToMainMenu = document.getElementById('btn-to-main-menu');
const btnCloseSettings = document.getElementById('btn-close-settings');

// 1. Instanciación de Sistemas Centrales
const resourceManager = new ResourceManager();
const inputManager = new InputManager(uiCanvas);
const stateManager = new StateManager();
const entityManager = new EntityManager();

const physicsSystem = new PhysicsSystem(entityManager);
const interactionSystem = new InteractionSystem(entityManager, inputManager, stateManager);

const renderer = new Renderer(mainCanvas);
const lightManager = new LightManager(lightCanvas, false); // isInterior = false (Luz de día diurna)
const uiManager = new UIManager(uiCanvas);
const camera = new Camera(mainCanvas.width, mainCanvas.height);

// 2. Nivel "El Bosque" de 40x40 Casillas (1280x1280 px)
const MAP_COLS = 40;
const MAP_ROWS = 40;
const TILE_SIZE = 32;
const MAP_WIDTH = MAP_COLS * TILE_SIZE;   // 1280 px
const MAP_HEIGHT = MAP_ROWS * TILE_SIZE; // 1280 px

// Room Clamping de Cámara
camera.setRoomBounds({ x: 0, y: 0, width: MAP_WIDTH, height: MAP_HEIGHT });
const tilemap = new Tilemap(MAP_COLS, MAP_ROWS, TILE_SIZE);

// 3. Jugador ubicado en el camino de tierra
const player = new Player(624, 624);
entityManager.addEntity(player);

// 4. Cabaña de madera moderna al norte
const cabin = new House(560, 260);
entityManager.addEntity(cabin);

// Guardián sabio cerca de la cabaña
const elderNPC = new NPC(640, 410);
entityManager.addEntity(elderNPC);

// 5. Generación de Árboles con Y-Sorting Estricto
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

// Perímetro de bosque
for (let x = 0; x < MAP_WIDTH; x += 75) {
  spawnTree(x, 0);
  spawnTree(x + 35, 60);
  spawnTree(x, MAP_HEIGHT - 110);
  spawnTree(x + 35, MAP_HEIGHT - 70);
}
for (let y = 100; y < MAP_HEIGHT - 120; y += 75) {
  if (y > 560 && y < 700) continue; // Paso del camino
  spawnTree(0, y);
  spawnTree(55, y + 35);
  spawnTree(MAP_WIDTH - 85, y);
  spawnTree(MAP_WIDTH - 140, y + 35);
}

// 6. Carga Asíncrona de Assets
async function initAssets() {
  try {
    await resourceManager.loadBatch([
      { type: 'image', key: 'grass_tile', url: '/assets/tiles/grass.jpg' },
      { type: 'image', key: 'dirt_tile', url: '/assets/tiles/dirt.jpg' },
      { type: 'image', key: 'tree_sprite', url: '/assets/sprites/tree.jpg', transparent: true, threshold: 240 },
      { type: 'image', key: 'house_sprite', url: '/assets/sprites/house.jpg', transparent: true, threshold: 240 }
    ]);

    const treeImg = resourceManager.getImage('tree_sprite');
    if (treeImg) trees.forEach(t => t.setSprite(treeImg));

    const houseImg = resourceManager.getImage('house_sprite');
    if (houseImg) cabin.setSprite(houseImg);

    tilemap.build(resourceManager);
    console.log('[Be a Legend] Assets de 32-bit modernos cargados.');
  } catch (err) {
    console.warn('[Be a Legend] Fallback procedural activo:', err);
    tilemap.build(null);
  }
}
tilemap.build(null);
initAssets();

// 7. Ciclo de Actualización (Update)
function update(deltaTime) {
  inputManager.update();

  const gameState = stateManager.get('game_state');
  if (gameState !== 'STATE_PLAYING') {
    return; // En menú o pausa no se actualiza la física ni las entidades
  }

  const gameContext = {
    deltaTime,
    input: inputManager,
    physics: physicsSystem,
    state: stateManager
  };
  entityManager.update(gameContext);
  interactionSystem.update(deltaTime);

  // Cámara centrada en el jugador
  const playerCenter = {
    x: player.pos.x + player.width / 2,
    y: player.pos.y + player.height / 2
  };
  camera.update(playerCenter, deltaTime);
}

// 8. Ciclo de Dibujado (Render)
function render(deltaTime) {
  renderer.begin(camera);

  // Terreno pre-renderizado O(1)
  tilemap.render(renderer.ctx, camera);

  // Entidades ordenadas por Y-Sort
  renderer.drawEntities(entityManager.getEntities());

  renderer.end(camera);

  // Capa de Iluminación diurna
  lightManager.update(deltaTime);
  lightManager.render(camera);

  // Capa de Interfaz y Virtual Gamepad táctil
  const gameState = stateManager.get('game_state');
  if (gameState === 'STATE_PLAYING') {
    uiManager.render(inputManager, stateManager);
  } else {
    uiManager.clear();
  }
}

// 9. Inicialización del Motor en Estado Inicial STATE_MENU
const engine = new Engine(update, render);
stateManager.set('game_state', 'STATE_MENU');
engine.start();
engine.pause(); // Pausar ciclo lógico en el menú inicial (se sigue renderizando el fondo)

// 10. Conexión de la Lógica de Estados y UI (HTML / StateManager)

// A. Al pulsar Jugar
btnPlay.addEventListener('click', () => {
  mainMenuEl.classList.add('hidden');
  stateManager.set('game_state', 'STATE_PLAYING');
  engine.resume();
  console.log('[Game State] Cambiado a STATE_PLAYING. ¡Partida iniciada!');
});

// B. Control de Pausa
function openPauseMenu() {
  if (stateManager.get('game_state') === 'STATE_PLAYING') {
    stateManager.set('game_state', 'STATE_PAUSED');
    engine.pause();
    pauseMenuEl.classList.remove('hidden');
    console.log('[Game State] Cambiado a STATE_PAUSED.');
  }
}

function resumeGame() {
  if (stateManager.get('game_state') === 'STATE_PAUSED') {
    pauseMenuEl.classList.add('hidden');
    stateManager.set('game_state', 'STATE_PLAYING');
    engine.resume();
    console.log('[Game State] Reanudado a STATE_PLAYING.');
  }
}

btnResume.addEventListener('click', resumeGame);

btnToMainMenu.addEventListener('click', () => {
  pauseMenuEl.classList.add('hidden');
  mainMenuEl.classList.remove('hidden');
  stateManager.set('game_state', 'STATE_MENU');
  engine.pause();
  console.log('[Game State] Retornado a STATE_MENU.');
});

// Conectar botón de pausa táctil del InputManager (icono engranaje ⚙️) y tecla Escape
inputManager.onPause(() => {
  const current = stateManager.get('game_state');
  if (current === 'STATE_PLAYING') {
    openPauseMenu();
  } else if (current === 'STATE_PAUSED') {
    resumeGame();
  }
});

// C. Conectar Swipe de Habilidad de la Reliquia
inputManager.onSkillEquipped((newPower) => {
  stateManager.set('equipped_power', newPower);
  console.log(`[Reliquia] ¡Poder equipado mediante Swipe: ${newPower}!`);
});

// D. Modal de Ajustes
btnSettings.addEventListener('click', () => settingsModalEl.classList.remove('hidden'));
btnPauseSettings.addEventListener('click', () => settingsModalEl.classList.remove('hidden'));
btnCloseSettings.addEventListener('click', () => settingsModalEl.classList.add('hidden'));

// 11. Herramientas de Depuración en Consola
window.setKarma = (val) => {
  stateManager.set('karma_level', val);
  console.log(`[Karma] Nivel actualizado a: ${val}`);
};
window.equipPower = (name) => {
  stateManager.set('equipped_power', name);
  console.log(`[Reliquia] Poder forzado a: ${name}`);
};

console.log('[Be a Legend] Sistema listo. Estado actual: STATE_MENU.');

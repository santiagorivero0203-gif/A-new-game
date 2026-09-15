/**
 * @file main.js
 * @description Punto de entrada y orquestador del nivel de prueba "El Bosque".
 * Inicializa un mapa abierto de 40x40 casillas (1280x1280 px), pre-renderiza el terreno
 * con pasto y camino de tierra, configura el Room Clamping en la cámara para evitar vacíos negros,
 * y puebla la escena con árboles y cabaña de madera con Y-Sorting estricto.
 * @author Be a Legend Team
 * @version 1.2.0
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

// 1. Instanciación de Sistemas Centrales
const resourceManager = new ResourceManager();
const inputManager = new InputManager();
const stateManager = new StateManager();
const entityManager = new EntityManager();

const physicsSystem = new PhysicsSystem(entityManager);
const interactionSystem = new InteractionSystem(entityManager, inputManager, stateManager);

const renderer = new Renderer(mainCanvas);
const lightManager = new LightManager(lightCanvas);
const uiManager = new UIManager(uiCanvas);
const camera = new Camera(mainCanvas.width, mainCanvas.height);

// Atmósfera de bosque crepuscular / arboleda mágica
lightManager.ambientLight = 'rgba(10, 20, 28, 0.42)';

// 2. Nivel de 40x40 Casillas (1280x1280 px)
const MAP_COLS = 40;
const MAP_ROWS = 40;
const TILE_SIZE = 32;
const MAP_WIDTH = MAP_COLS * TILE_SIZE;   // 1280 px
const MAP_HEIGHT = MAP_ROWS * TILE_SIZE; // 1280 px

// Regla Técnica 2: Room Clamping de Cámara en bordes exactos del mapa 40x40
camera.setRoomBounds({ x: 0, y: 0, width: MAP_WIDTH, height: MAP_HEIGHT });

const tilemap = new Tilemap(MAP_COLS, MAP_ROWS, TILE_SIZE);

// 3. Jugador ubicado en el camino de tierra en el centro del claro
const player = new Player(624, 624);
entityManager.addEntity(player);

// Luz dinámica de la Reliquia Milenaria del jugador
const playerLight = {
  x: player.pos.x + player.width / 2,
  y: player.pos.y + player.height / 2,
  radius: 140,
  intensity: 0.88,
  color: 'white',
  flicker: false,
  isPlayerLight: true
};
lightManager.addLight(playerLight);

// 4. Cabaña de madera al norte del claro junto al sendero
const cabin = new House(560, 260);
entityManager.addEntity(cabin);

// Antorchas de bienvenida a los lados de la entrada de la cabaña
lightManager.addLight({
  x: 600,
  y: 380,
  radius: 95,
  intensity: 0.85,
  color: '#ff9933',
  flicker: true
});
lightManager.addLight({
  x: 685,
  y: 380,
  radius: 95,
  intensity: 0.85,
  color: '#ff9933',
  flicker: true
});

// Guardián sabio cerca de la cabaña
const elderNPC = new NPC(640, 410);
entityManager.addEntity(elderNPC);

// 5. Generación de Árboles con Y-Sorting Estricto
const trees = [];

/**
 * Función auxiliar para añadir un árbol al mundo.
 * @param {number} x
 * @param {number} y
 */
function spawnTree(x, y) {
  const tree = new Tree(x, y);
  entityManager.addEntity(tree);
  trees.push(tree);
}

// A. Árboles clave dispersos dentro del claro para probar Y-Sorting en 360°
spawnTree(400, 520);
spawnTree(480, 710);
spawnTree(800, 540);
spawnTree(890, 710);
spawnTree(380, 360);
spawnTree(780, 320);
spawnTree(310, 600);
spawnTree(960, 600);

// B. Perímetro denso de bosque (borde norte, sur, este y oeste)
// Borde Norte
for (let x = 0; x < MAP_WIDTH; x += 75) {
  spawnTree(x, 0);
  spawnTree(x + 35, 60);
}
// Borde Sur
for (let x = 0; x < MAP_WIDTH; x += 75) {
  spawnTree(x, MAP_HEIGHT - 110);
  spawnTree(x + 35, MAP_HEIGHT - 70);
}
// Borde Oeste
for (let y = 100; y < MAP_HEIGHT - 120; y += 75) {
  // Dejar paso abierto para el camino central (y ≈ 580..680)
  if (y > 560 && y < 700) continue;
  spawnTree(0, y);
  spawnTree(55, y + 35);
}
// Borde Este
for (let y = 100; y < MAP_HEIGHT - 120; y += 75) {
  if (y > 560 && y < 700) continue;
  spawnTree(MAP_WIDTH - 85, y);
  spawnTree(MAP_WIDTH - 140, y + 35);
}

// 6. Carga Asíncrona de Assets (Sprites y Tiles)
async function initAssets() {
  try {
    await resourceManager.loadBatch([
      { type: 'image', key: 'grass_tile', url: '/assets/tiles/grass.jpg' },
      { type: 'image', key: 'dirt_tile', url: '/assets/tiles/dirt.jpg' },
      { type: 'image', key: 'tree_sprite', url: '/assets/sprites/tree.jpg', transparent: true, threshold: 238 },
      { type: 'image', key: 'house_sprite', url: '/assets/sprites/house.jpg', transparent: true, threshold: 238 }
    ]);

    // Asignar texturas cargadas a las entidades del nivel
    const treeImg = resourceManager.getImage('tree_sprite');
    if (treeImg) {
      trees.forEach(t => t.setSprite(treeImg));
    }

    const houseImg = resourceManager.getImage('house_sprite');
    if (houseImg) {
      cabin.setSprite(houseImg);
    }

    // Reconstruir el buffer del mapa con las texturas de alta resolución
    tilemap.build(resourceManager);
    console.log('[Be a Legend] Assets de "El Bosque" cargados e integrados exitosamente.');
  } catch (err) {
    console.warn('[Be a Legend] Usando texturas procedurales de respaldo:', err);
    tilemap.build(null);
  }
}

// Construcción inicial con patrones procedurales de inmediato
tilemap.build(null);
initAssets();

// 7. Ciclo de Actualización (Update)
function update(deltaTime) {
  inputManager.update();

  const gameContext = {
    deltaTime,
    input: inputManager,
    physics: physicsSystem,
    state: stateManager
  };
  entityManager.update(gameContext);

  interactionSystem.update(deltaTime);

  // Cámara sigue suavemente al jugador con clamping dentro del mapa de 40x40
  const playerCenter = {
    x: player.pos.x + player.width / 2,
    y: player.pos.y + player.height / 2
  };
  camera.update(playerCenter, deltaTime);

  // Sincronizar luz de la reliquia con la posición del jugador
  playerLight.x = playerCenter.x;
  playerLight.y = playerCenter.y;
}

// 8. Ciclo de Dibujado (Render)
function render(deltaTime) {
  renderer.begin(camera);

  // Terreno: Claro de bosque con camino de tierra pre-renderizado (O(1))
  tilemap.render(renderer.ctx, camera);

  // Entidades del mundo ordenadas con Y-Sorting estricto
  renderer.drawEntities(entityManager.getEntities());

  renderer.end(camera);

  // Capa de Iluminación
  lightManager.update(deltaTime);
  lightManager.render(camera);

  // Capa de Interfaz y Menú Radial
  uiManager.render(inputManager, stateManager);
}

// 9. Arranque del Motor
const engine = new Engine(update, render);
engine.start();

// Herramientas de depuración en consola
window.setKarma = (val) => {
  stateManager.set('karma_level', val);
  console.log(`[Karma] Nivel actualizado a: ${val}`);
};

console.log('[Be a Legend] Nivel "El Bosque" inicializado. Usa [WASD] para explorar el claro y probar el Y-Sorting.');

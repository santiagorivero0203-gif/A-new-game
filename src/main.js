/**
 * @file main.js
 * @description Punto de entrada principal y bootstrap del juego Action-RPG "Be a Legend".
 * Inicializa los sistemas centrales (Engine, EntityManager, Physics, Lighting, Camera, UI),
 * ensambla el contexto de ejecución unificado y arranca el Game Loop a 60 FPS estables.
 * @author Be a Legend Team
 * @version 1.1.0
 */

import { Engine } from './core/Engine.js';
import { InputManager } from './core/InputManager.js';
import { StateManager } from './core/StateManager.js';
import { EntityManager } from './entities/EntityManager.js';
import { Player } from './entities/Player.js';
import { NPC } from './entities/NPC.js';
import { Entity } from './entities/Entity.js';
import { PhysicsSystem } from './systems/PhysicsSystem.js';
import { InteractionSystem } from './systems/InteractionSystem.js';
import { Renderer } from './render/Renderer.js';
import { LightManager } from './render/LightManager.js';
import { Camera } from './render/Camera.js';
import { UIManager } from './ui/UIManager.js';

// Elementos del DOM (Capas de Canvas)
const mainCanvas = document.getElementById('main-canvas');
const lightCanvas = document.getElementById('light-canvas');
const uiCanvas = document.getElementById('ui-canvas');

// 1. Inicialización de Gestores Core
const inputManager = new InputManager();
const stateManager = new StateManager();
const entityManager = new EntityManager();

// 2. Inicialización de Sistemas de Lógica y Física
const physicsSystem = new PhysicsSystem(entityManager);
const interactionSystem = new InteractionSystem(entityManager, inputManager, stateManager);

// 3. Inicialización de Pipeline de Renderizado y UI
const renderer = new Renderer(mainCanvas);
const lightManager = new LightManager(lightCanvas);
const uiManager = new UIManager(uiCanvas);
const camera = new Camera(mainCanvas.width, mainCanvas.height);

// Configurar dimensiones de la sala (1600x1200 px)
camera.setRoomBounds({ x: 0, y: 0, width: 1600, height: 1200 });

// 4. Población Inicial de la Escena (Prototipo Fase 1)
const player = new Player(400, 300);
entityManager.addEntity(player);

const npc = new NPC(600, 300);
entityManager.addEntity(npc);

// Muros y obstáculos sólidos
const wall1 = new Entity(200, 200, 100, 200);
wall1.color = '#444';
wall1.tags.push('solid');
entityManager.addEntity(wall1);

const wall2 = new Entity(800, 400, 300, 100);
wall2.color = '#444';
wall2.tags.push('solid');
entityManager.addEntity(wall2);

// Fuentes de iluminación estática (Antorcha de mazmorra)
lightManager.addLight({
  x: 500,
  y: 300,
  radius: 130,
  intensity: 0.85,
  color: 'orange',
  flicker: true
});

// BUG-03 FIX: Luz persistente del jugador pre-alocada en memoria
const playerLight = {
  x: player.pos.x + player.width / 2,
  y: player.pos.y + player.height / 2,
  radius: 150,
  intensity: 0.9,
  color: 'white',
  flicker: false,
  isPlayerLight: true
};
lightManager.addLight(playerLight);

/**
 * Bucle de actualización lógica a timestep variable/fijo.
 * @param {number} deltaTime - Tiempo del frame en segundos
 */
function update(deltaTime) {
  inputManager.update();

  // ARCH-01 FIX: Contexto unificado GameContext
  const gameContext = {
    deltaTime,
    input: inputManager,
    physics: physicsSystem,
    state: stateManager
  };
  entityManager.update(gameContext);

  interactionSystem.update(deltaTime);

  // Cámara centrada suavemente en el jugador
  const playerCenter = {
    x: player.pos.x + player.width / 2,
    y: player.pos.y + player.height / 2
  };
  camera.update(playerCenter, deltaTime);

  // BUG-03 FIX: Actualizar coordenadas de la luz existente sin instanciar objetos
  playerLight.x = playerCenter.x;
  playerLight.y = playerCenter.y;
}

/**
 * BUG-01 FIX: Bucle de renderizado. Ahora recibe formalmente deltaTime desde el Engine.
 * @param {number} deltaTime - Tiempo del frame en segundos
 */
function render(deltaTime) {
  renderer.begin(camera);

  // Fondo / suelo de la mazmorra
  renderer.ctx.fillStyle = '#18181f';
  renderer.ctx.fillRect(0, 0, 1600, 1200);

  // Cuadrícula sutil de suelo (estilo pixel art)
  renderer.ctx.strokeStyle = '#22222c';
  renderer.ctx.lineWidth = 1;
  for (let x = 0; x <= 1600; x += 64) {
    renderer.ctx.beginPath();
    renderer.ctx.moveTo(x, 0);
    renderer.ctx.lineTo(x, 1200);
    renderer.ctx.stroke();
  }
  for (let y = 0; y <= 1200; y += 64) {
    renderer.ctx.beginPath();
    renderer.ctx.moveTo(0, y);
    renderer.ctx.lineTo(1600, y);
    renderer.ctx.stroke();
  }

  // Dibujado de entidades con Y-Sorting
  renderer.drawEntities(entityManager.getEntities());

  renderer.end(camera);

  // Capa de Iluminación
  lightManager.update(deltaTime);
  lightManager.render(camera);

  // Capa de Interfaz de Usuario (HUD + Menú Radial)
  uiManager.render(inputManager, stateManager);
}

// Inicialización limpia del motor sin hacks ni monkey-patching
const engine = new Engine(update, render);
engine.start();

// Herramienta de pruebas de Karma desde la consola de desarrollo
window.setKarma = (val) => {
  stateManager.set('karma_level', val);
  console.log(`[Karma] Nivel actualizado a: ${val}`);
};

console.log('[Be a Legend] Motor iniciado con éxito. Controles: [WASD] Movimiento | [Espacio] Interactuar | [Tab / R] Reliquia.');

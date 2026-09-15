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

const mainCanvas = document.getElementById('main-canvas');
const lightCanvas = document.getElementById('light-canvas');
const uiCanvas = document.getElementById('ui-canvas');

// Init Managers
const inputManager = new InputManager();
const stateManager = new StateManager();
const entityManager = new EntityManager();

// Init Systems
const physicsSystem = new PhysicsSystem(entityManager);
const interactionSystem = new InteractionSystem(entityManager, inputManager, stateManager);

// Init Rendering
const renderer = new Renderer(mainCanvas);
const lightManager = new LightManager(lightCanvas);
const uiManager = new UIManager(uiCanvas);
const camera = new Camera(mainCanvas.width, mainCanvas.height);

// Setup Room (e.g. 1600x1200)
camera.setRoomBounds({ x: 0, y: 0, width: 1600, height: 1200 });

// Add test entities
const player = new Player(400, 300);
entityManager.addEntity(player);

const npc = new NPC(600, 300);
entityManager.addEntity(npc);

// Add some walls
const wall1 = new Entity(200, 200, 100, 200);
wall1.color = '#555';
wall1.tags.push('solid');
entityManager.addEntity(wall1);

const wall2 = new Entity(800, 400, 300, 100);
wall2.color = '#555';
wall2.tags.push('solid');
entityManager.addEntity(wall2);

// Add light sources
// A static torch
lightManager.addLight({
  x: 500,
  y: 300,
  radius: 120,
  intensity: 0.8,
  color: 'orange',
  flicker: true
});

// Update loop
function update(deltaTime) {
  inputManager.update(); // for gamepad in the future
  
  entityManager.update(deltaTime, inputManager, physicsSystem, stateManager);
  interactionSystem.update(deltaTime);
  
  // Camera follows player
  const playerCenter = {
    x: player.pos.x + player.width / 2,
    y: player.pos.y + player.height / 2
  };
  camera.update(playerCenter, deltaTime);

  // Player light follows player
  // Update or set a dynamic light for the player
  // We'll manage it by finding/setting a specific light or just clearing and re-adding
}

// Render loop
function render() {
  renderer.begin(camera);
  
  // Draw floor/background placeholder
  renderer.ctx.fillStyle = '#222';
  renderer.ctx.fillRect(0, 0, 1600, 1200);

  renderer.drawEntities(entityManager.getEntities());
  
  // Optional debug colliders
  // renderer.drawColliders(entityManager.getEntities());

  renderer.end(camera);

  // Dynamic light for player
  // Clear and reconstruct lights if needed or update them
  // For now, let's just make the player emit light directly here
  // by updating a light object
  lightManager.lights = lightManager.lights.filter(l => !l.isPlayerLight);
  lightManager.addLight({
    x: player.pos.x + player.width / 2,
    y: player.pos.y + player.height / 2,
    radius: 150,
    intensity: 0.9,
    color: 'white',
    flicker: false,
    isPlayerLight: true
  });
  
  lightManager.update(deltaTime);
  lightManager.render(camera);

  // Render UI (Radial Menu, etc)
  uiManager.render(inputManager, stateManager);
}

const engine = new Engine(update, render);

// Small hack to expose deltaTime to render for flicker
let deltaTime = 0;
const originalUpdate = engine.update;
engine.update = (dt) => {
  deltaTime = dt;
  originalUpdate.call(engine, dt);
}

engine.start();

// Expose to window for testing karma
window.setKarma = (val) => {
  stateManager.set('karma_level', val);
  console.log('Karma level set to:', val);
};
console.log('Juego inicializado. Usa WASD para moverte. Acércate al cuadrado naranja (NPC) y pulsa ESPACIO. Usa window.setKarma(1) o -1 para probar las reacciones.');

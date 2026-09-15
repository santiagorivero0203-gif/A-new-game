import { Entity } from './Entity.js';

export class NPC extends Entity {
  constructor(x, y) {
    super(x, y, 32, 32);
    this.color = '#FF9800'; // Placeholder color
    this.tags.push('npc');
    this.tags.push('solid'); // Make NPC solid
    this.interacted = false;
  }

  update(deltaTime, inputManager, physicsSystem, stateManager) {
    // Basic interaction check (distance based, triggered by spacebar)
    // We will let the InteractionSystem handle this to keep it clean,
    // but here is where NPC specific logic would go (like FSM for wandering).
  }

  interact(stateManager) {
    const karma = stateManager.get('karma_level');
    if (karma >= 0) {
      console.log("NPC: ¡Hola, héroe de la luz!");
    } else {
      console.log("NPC: Aléjate de mí, ser oscuro...");
    }
  }
}

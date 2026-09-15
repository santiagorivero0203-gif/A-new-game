export class InteractionSystem {
  constructor(entityManager, inputManager, stateManager) {
    this.entityManager = entityManager;
    this.inputManager = inputManager;
    this.stateManager = stateManager;
    this.interactionDistance = 40; // Pixels
    
    // Simple cooldown to prevent spamming
    this.cooldown = 0;
  }

  update(deltaTime) {
    if (this.cooldown > 0) {
      this.cooldown -= deltaTime;
    }

    if (this.inputManager.isKeyPressed('Space') && this.cooldown <= 0) {
      this.cooldown = 0.5; // half a second cooldown
      this.tryInteract();
    }
  }

  tryInteract() {
    const player = this.entityManager.getEntities().find(e => e.hasTag('player'));
    if (!player) return;

    const npcs = this.entityManager.getEntities().filter(e => e.hasTag('npc'));
    
    const playerCenter = {
      x: player.pos.x + player.width / 2,
      y: player.pos.y + player.height / 2
    };

    // Find closest NPC within interaction distance
    for (const npc of npcs) {
      const npcCenter = {
        x: npc.pos.x + npc.width / 2,
        y: npc.pos.y + npc.height / 2
      };

      const dist = Math.hypot(npcCenter.x - playerCenter.x, npcCenter.y - playerCenter.y);
      if (dist < this.interactionDistance) {
        if (typeof npc.interact === 'function') {
          npc.interact(this.stateManager);
          break; // interact with only one
        }
      }
    }
  }
}

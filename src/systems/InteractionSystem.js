/**
 * @module InteractionSystem
 * @description Sistema encargado de detectar y disparar interacciones por proximidad
 * entre el jugador y entidades interactivas (NPCs, cofres, interruptores, reliquias).
 * @author Be a Legend Team
 * @version 1.1.0
 */
export class InteractionSystem {
  /**
   * @param {import('../entities/EntityManager.js').EntityManager} entityManager
   * @param {import('../core/InputManager.js').InputManager} inputManager
   * @param {import('../core/StateManager.js').StateManager} stateManager
   */
  constructor(entityManager, inputManager, stateManager) {
    this.entityManager = entityManager;
    this.inputManager = inputManager;
    this.stateManager = stateManager;

    /** @type {number} Distancia máxima en píxeles para gatillar una interacción */
    this.interactionDistance = 45;

    /** @type {number} Temporizador para evitar ejecuciones repetidas de un solo click */
    this.cooldown = 0;
  }

  /**
   * Actualiza el temporizador de enfriamiento y procesa el comando de interacción.
   * @param {number} deltaTime - Tiempo del frame en segundos
   */
  update(deltaTime) {
    if (this.cooldown > 0) {
      this.cooldown -= deltaTime;
    }

    if (this.inputManager.isKeyPressed('Space') && this.cooldown <= 0) {
      this.cooldown = 0.4; // 400ms de cooldown
      this.tryInteract();
    }
  }

  /**
   * ARCH-02 FIX: Busca el jugador y NPCs interactivos usando getByTag()
   * sin ejecutar el pipeline costoso de ordenamiento Y-Sort.
   */
  tryInteract() {
    const players = this.entityManager.getByTag('player');
    if (players.length === 0) return;
    const player = players[0];

    const npcs = this.entityManager.getByTag('npc');
    if (npcs.length === 0) return;

    const playerCenterX = player.pos.x + player.width / 2;
    const playerCenterY = player.pos.y + player.height / 2;

    // Buscar el NPC más cercano dentro del radio de interacción
    let closestNPC = null;
    let minDistanceSq = this.interactionDistance * this.interactionDistance;

    for (let i = 0; i < npcs.length; i++) {
      const npc = npcs[i];
      const npcCenterX = npc.pos.x + npc.width / 2;
      const npcCenterY = npc.pos.y + npc.height / 2;

      const dx = npcCenterX - playerCenterX;
      const dy = npcCenterY - playerCenterY;
      const distSq = dx * dx + dy * dy;

      if (distSq <= minDistanceSq) {
        minDistanceSq = distSq;
        closestNPC = npc;
      }
    }

    if (closestNPC && typeof closestNPC.interact === 'function') {
      const dialogueText = closestNPC.interact(this.stateManager);
      if (dialogueText && this.stateManager) {
        this.stateManager.set('active_dialogue', {
          speaker: 'Anciano del Claro',
          text: dialogueText,
          timer: 4.5
        });
      }
    }
  }
}

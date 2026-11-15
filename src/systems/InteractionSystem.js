/**
 * @module InteractionSystem
 * @description Sistema encargado de detectar y disparar interacciones contextuales por proximidad
 * entre el jugador y entidades interactivas (NPCs como Tarak/Valerio, Pedestales de Reliquia,
 * Altares del Santuario y Estelas de Desafío).
 * @author Be a Legend Team
 * @version 2.0.0
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

    /** @type {number} Distancia máxima en píxeles para gatillar una interacción contextual */
    this.interactionDistance = 68;

    /** @type {number} Temporizador para evitar ejecuciones repetidas de una misma pulsación */
    this.cooldown = 0;
  }

  /**
   * Actualiza el temporizador de enfriamiento y procesa el comando de interacción ([E] / [Enter]).
   * @param {number} deltaTime - Tiempo del frame en segundos
   * @param {Object} [context=null] - Contexto unificado del motor
   */
  update(deltaTime, context = null) {
    if (this.cooldown > 0) {
      this.cooldown -= deltaTime;
    }

    const isInteractPressed = this.inputManager.isKeyPressed('KeyE') ||
                              this.inputManager.isKeyPressed('Enter');

    if (isInteractPressed && this.cooldown <= 0) {
      this.cooldown = 0.42;
      this.tryInteract(context);
    }
  }

  /**
   * Busca el objetivo interactivo más cercano ('npc' o 'interactable') dentro de `interactionDistance`
   * usando índices `getByTag()` sin ordenar todo el arreglo de entidades.
   * @param {Object} [context=null]
   */
  tryInteract(context = null) {
    const players = this.entityManager.getByTag('player');
    if (players.length === 0) return;
    const player = players[0];

    const npcs = this.entityManager.getByTag('npc');
    const props = this.entityManager.getByTag('interactable');
    if (npcs.length === 0 && props.length === 0) return;

    const playerCenterX = player.pos.x + player.width / 2;
    const playerCenterY = player.pos.y + player.height / 2;

    let closestTarget = null;
    let minDistanceSq = this.interactionDistance * this.interactionDistance;

    const candidates = npcs.concat(props);
    for (let i = 0; i < candidates.length; i++) {
      const target = candidates[i];
      if (!target || target.isDead) continue;

      const tx = target.pos.x + target.width / 2;
      const ty = target.pos.y + target.height / 2;
      const dx = tx - playerCenterX;
      const dy = ty - playerCenterY;
      const distSq = dx * dx + dy * dy;

      if (distSq <= minDistanceSq) {
        minDistanceSq = distSq;
        closestTarget = target;
      }
    }

    if (closestTarget && typeof closestTarget.interact === 'function') {
      const dialogueText = closestTarget.interact(this.stateManager, context);
      if (dialogueText && this.stateManager) {
        const speakerName = closestTarget.name || closestTarget.label || 'SANTUARIO ANCESTRAL';
        this.stateManager.set('active_dialogue', {
          speaker: speakerName.toUpperCase(),
          text: dialogueText,
          timer: 4.5
        });
      }
    }
  }
}

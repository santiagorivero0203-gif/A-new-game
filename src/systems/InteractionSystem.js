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

    /** @type {string|null} Clave en caché para evitar escrituras redundantes en StateManager */
    this._lastPromptKey = null;
  }

  /**
   * Evalúa en Zero-GC si hay una entidad interactiva o NPC al alcance y publica
   * su verbo contextual en `StateManager` para mostrar avisos en HUD PC/Móvil.
   */
  updateProximityState() {
    if (!this.stateManager || !this.entityManager) return;

    const players = this.entityManager.getByTag('player');
    if (players.length === 0 || players[0].isDead) {
      if (this._lastPromptKey !== 'NONE') {
        this._lastPromptKey = 'NONE';
        this.stateManager.set('interact_available', false);
        this.stateManager.set('interact_verb', 'USAR');
        this.stateManager.set('interact_target_name', '');
      }
      return;
    }

    const player = players[0];
    const npcs = this.entityManager.getByTag('npc');
    const props = this.entityManager.getByTag('interactable');
    const playerCenterX = player.pos.x + player.width / 2;
    const playerCenterY = player.pos.y + player.height / 2;

    let closestTarget = null;
    let minDistanceSq = this.interactionDistance * this.interactionDistance;

    for (let pass = 0; pass < 2; pass++) {
      const list = pass === 0 ? npcs : props;
      for (let i = 0; i < list.length; i++) {
        const target = list[i];
        if (!target || target.isDead || target.isConsumed) continue;

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
    }

    if (!closestTarget) {
      if (this._lastPromptKey !== 'NONE') {
        this._lastPromptKey = 'NONE';
        this.stateManager.set('interact_available', false);
        this.stateManager.set('interact_verb', 'USAR');
        this.stateManager.set('interact_target_name', '');
      }
      return;
    }

    const isNpc = Boolean(
      (typeof closestTarget.hasTag === 'function' && closestTarget.hasTag('npc')) ||
      (Array.isArray(closestTarget.tags) && closestTarget.tags.includes('npc'))
    );
    let verb = 'EXAMINAR';
    if (isNpc) {
      if (closestTarget.role === 'blacksmith') verb = 'FORJAR';
      else if (closestTarget.role === 'alchemist') verb = 'POCIONES';
      else verb = 'HABLAR';
    }
    else if (closestTarget.propType === 'sanctuary_altar') verb = 'SANTUARIO';
    else if (closestTarget.propType === 'horde_stela') verb = 'DESAFÍO';
    else if (closestTarget.propType === 'relic_pedestal') verb = 'DESPERTAR';

    const name = closestTarget.name || closestTarget.label || 'Objeto Ancestral';
    const key = `${verb}:${name}`;
    if (this._lastPromptKey !== key) {
      this._lastPromptKey = key;
      this.stateManager.set('interact_available', true);
      this.stateManager.set('interact_verb', verb);
      this.stateManager.set('interact_target_name', name);
    }
  }

  /**
   * Actualiza el temporizador de enfriamiento, detecta proximidad contextual
   * y procesa el comando de interacción ([E] / [Enter]).
   * @param {number} deltaTime - Tiempo del frame en segundos
   * @param {Object} [context=null] - Contexto unificado del motor
   */
  update(deltaTime, context = null) {
    if (this.cooldown > 0) {
      this.cooldown -= deltaTime;
    }

    this.updateProximityState();

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

    // Recorrer ambas cubetas directamente sin alocar arreglos temporales con concat()
    for (let pass = 0; pass < 2; pass++) {
      const list = pass === 0 ? npcs : props;
      for (let i = 0; i < list.length; i++) {
        const target = list[i];
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

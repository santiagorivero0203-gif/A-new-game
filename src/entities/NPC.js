import { Entity } from './Entity.js';

/**
 * @module NPC
 * @description Entidad no jugable con soporte para interacción y respuestas dinámicas basadas en Karma.
 * @author Be a Legend Team
 * @version 1.1.0
 */
export class NPC extends Entity {
  /**
   * @param {number} x - Posición X inicial
   * @param {number} y - Posición Y inicial
   */
  constructor(x, y) {
    super(x, y, 32, 32);
    this.color = '#FF9800'; // Color distintivo para prototipado
    this.tags.push('npc');
    this.tags.push('solid'); // Los NPCs bloquean el paso por defecto
    this.interacted = false;
  }

  /**
   * ARCH-01 FIX: Actualización lógica con contexto unificado.
   * Permite incorporar IA, rutas de patrulla o máquinas de estado en futuras iteraciones.
   * @param {Object|number} contextOrDt - Contexto de juego ({ deltaTime, state, ... }) o deltaTime
   */
  update(contextOrDt) {
    // Espacio para lógica de patrulla/IA del NPC
  }

  /**
   * Ejecuta la lógica de diálogo/interacción reaccionando al sistema de karma.
   * @param {import('../core/StateManager.js').StateManager} stateManager - Estado global para consultar karma
   * @returns {string} Mensaje de diálogo emitido
   */
  interact(stateManager) {
    const karma = stateManager ? stateManager.get('karma_level') : 0;
    let dialogue = '';

    if (karma >= 0) {
      dialogue = "¡Hola, portador de la reliquia! Que la luz guíe tu camino.";
    } else {
      dialogue = "Percibo oscuridad en tu reliquia... aléjate de aquí.";
    }

    if (typeof window !== 'undefined' && window.DEBUG_MODE) {
      console.log(`[NPC]: ${dialogue}`);
    }
    return dialogue;
  }
}

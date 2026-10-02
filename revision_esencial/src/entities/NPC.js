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
    this.color = '#6366f1';
    this.tags.push('npc');
    this.tags.push('solid');
    this.interacted = false;

    // Hitbox precisa para la base de los pies del NPC (Y-Sorting perfecto con el héroe)
    this.hitbox = {
      offsetX: 6,
      offsetY: 18,
      width: 20,
      height: 14
    };
    this._hitboxCache.width = this.hitbox.width;
    this._hitboxCache.height = this.hitbox.height;
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
   * Renderizado vectorial estilizado del Sabio / Anciano del Claro.
   * @param {CanvasRenderingContext2D} ctx
   */
  draw(ctx) {
    const { x, y } = this.pos;

    // 1. Sombra elíptica en el suelo
    ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
    ctx.beginPath();
    ctx.ellipse(x + 16, y + 29, 11, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    // 2. Túnica larga de sabio (morado índigo profundo)
    ctx.fillStyle = '#4338ca';
    ctx.fillRect(x + 7, y + 14, 18, 14);

    // Ribete dorado de la túnica
    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(x + 15, y + 14, 2, 14);
    ctx.fillRect(x + 7, y + 26, 18, 2);

    // 3. Cabeza / Rostro
    ctx.fillStyle = '#fde68a';
    ctx.fillRect(x + 9, y + 6, 14, 9);

    // 4. Capucha / Cabello de anciano
    ctx.fillStyle = '#312e81';
    ctx.fillRect(x + 8, y + 3, 16, 5);
    ctx.fillRect(x + 7, y + 5, 3, 8);
    ctx.fillRect(x + 22, y + 5, 3, 8);

    // 5. Ojos serenos
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(x + 11, y + 9, 2, 2);
    ctx.fillRect(x + 19, y + 9, 2, 2);

    // 6. Barba blanca prominente de sabio
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(x + 10, y + 12, 12, 6);
    ctx.fillRect(x + 12, y + 18, 8, 4);

    // 7. Bastón de madera con gema mística
    ctx.fillStyle = '#78350f';
    ctx.fillRect(x + 25, y + 10, 2, 18);
    ctx.fillStyle = '#38bdf8'; // Gema celeste brillante
    ctx.fillRect(x + 24, y + 8, 4, 4);
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

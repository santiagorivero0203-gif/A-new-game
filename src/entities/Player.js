import { Entity } from './Entity.js';
import { Vector2 } from '../utils/Vector2.js';

/**
 * @module Player
 * @description Entidad controlada por el usuario.
 * Maneja traslación con normalización diagonal, resolución de colisiones y movimiento Top-Down.
 * @author Be a Legend Team
 * @version 1.1.0
 */
export class Player extends Entity {
  /**
   * @param {number} x - Posición X inicial
   * @param {number} y - Posición Y inicial
   */
  constructor(x, y) {
    super(x, y, 32, 32); // Proporciones chibi / pixel art
    this.color = '#4CAF50';
    this.tags.push('player');

    /** @type {number} Velocidad de movimiento en píxeles por segundo */
    this.speed = 150;

    /** @type {Vector2} Vector de velocidad del frame actual */
    this.velocity = new Vector2(0, 0);
  }

  /**
   * ARCH-01 FIX: Actualización lógica usando contexto unificado.
   * Soporta tanto `{ deltaTime, input, physics }` como argumentos individuales para retrocompatibilidad.
   * @param {Object|number} contextOrDt - Objeto de contexto o deltaTime
   * @param {import('../core/InputManager.js').InputManager} [legacyInput]
   * @param {import('../systems/PhysicsSystem.js').PhysicsSystem} [legacyPhysics]
   */
  update(contextOrDt, legacyInput, legacyPhysics) {
    const isContext = typeof contextOrDt === 'object' && contextOrDt !== null;
    const deltaTime = isContext ? contextOrDt.deltaTime : contextOrDt;
    const input = isContext ? contextOrDt.input : legacyInput;
    const physics = isContext ? contextOrDt.physics : legacyPhysics;

    this.velocity.set(0, 0);

    if (input) {
      if (input.isKeyPressed('KeyW') || input.isKeyPressed('ArrowUp')) this.velocity.y -= 1;
      if (input.isKeyPressed('KeyS') || input.isKeyPressed('ArrowDown')) this.velocity.y += 1;
      if (input.isKeyPressed('KeyA') || input.isKeyPressed('ArrowLeft')) this.velocity.x -= 1;
      if (input.isKeyPressed('KeyD') || input.isKeyPressed('ArrowRight')) this.velocity.x += 1;
    }

    // Normalizar vector para evitar velocidad aumentada en diagonales
    this.velocity.normalize();
    this.velocity.multiplyScalar(this.speed * deltaTime);

    // Posición tentativa
    const nextX = this.pos.x + this.velocity.x;
    const nextY = this.pos.y + this.velocity.y;

    // Resolver colisiones con el entorno si el sistema de física está presente
    if (physics) {
      const finalPos = physics.moveWithCollisions(this, nextX, nextY);
      this.pos.set(finalPos.x, finalPos.y);
    } else {
      this.pos.set(nextX, nextY);
    }
  }
}

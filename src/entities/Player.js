import { Entity } from './Entity.js';
import { Vector2 } from '../utils/Vector2.js';

/**
 * @module Player
 * @description Entidad controlada por el usuario con diseño visual de héroe Action-RPG.
 * Maneja traslación con normalización diagonal, resolución de colisiones y movimiento Top-Down.
 * @author Be a Legend Team
 * @version 1.2.0
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
    this.speed = 160;

    /** @type {Vector2} Vector de velocidad del frame actual */
    this.velocity = new Vector2(0, 0);

    // Hitbox precisa para la base del personaje (pies)
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

  /**
   * Renderizado visual estilizado en pixel-art del héroe con túnica y la Reliquia.
   * @param {CanvasRenderingContext2D} ctx
   */
  draw(ctx) {
    const { x, y } = this.pos;

    // 1. Sombra suave en el suelo
    ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
    ctx.beginPath();
    ctx.ellipse(x + 16, y + 29, 11, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    // 2. Capa trasera
    ctx.fillStyle = '#1d4ed8'; // Capa azul heroica
    ctx.fillRect(x + 7, y + 14, 18, 14);

    // 3. Túnica del héroe
    ctx.fillStyle = '#16a34a'; // Verde clásico de aventura
    ctx.fillRect(x + 9, y + 14, 14, 12);

    // 4. Cinturón y Reliquia Milenaria (emite destellos dorados)
    ctx.fillStyle = '#78350f';
    ctx.fillRect(x + 9, y + 21, 14, 3);
    ctx.fillStyle = '#facc15'; // Reliquia de poder
    ctx.fillRect(x + 14, y + 20, 4, 5);

    // 5. Cabeza / Rostro
    ctx.fillStyle = '#fed7aa'; // Piel
    ctx.fillRect(x + 9, y + 6, 14, 10);

    // 6. Cabello / Capucha
    ctx.fillStyle = '#b45309'; // Cabello castaño / dorado
    ctx.fillRect(x + 8, y + 3, 16, 5);
    ctx.fillRect(x + 7, y + 5, 3, 7);

    // 7. Ojos pixel art
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(x + 12, y + 10, 2, 3);
    ctx.fillRect(x + 18, y + 10, 2, 3);
  }
}

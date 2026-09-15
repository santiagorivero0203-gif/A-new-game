import { Entity } from './Entity.js';
import { Vector2 } from '../utils/Vector2.js';

/**
 * @module Player
 * @description Entidad controlada por el usuario con diseño visual de héroe Action-RPG.
 * Maneja traslación combinando teclado físico y joystick virtual táctil, resolución de colisiones,
 * animación de ataque con espada y profundidad Top-Down.
 * @author Be a Legend Team
 * @version 1.3.0
 */
export class Player extends Entity {
  /**
   * @param {number} x - Posición X inicial
   * @param {number} y - Posición Y inicial
   */
  constructor(x, y) {
    super(x, y, 32, 32);
    this.color = '#4CAF50';
    this.tags.push('player');

    /** @type {number} Velocidad de movimiento en píxeles por segundo */
    this.speed = 160;

    /** @type {Vector2} Vector de velocidad del frame actual */
    this.velocity = new Vector2(0, 0);

    /** @type {string} Dirección a la que mira el jugador ('up', 'down', 'left', 'right') */
    this.facing = 'down';

    /** @type {number} Temporizador del ataque con espada */
    this.attackTimer = 0;

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
   * Actualización lógica combinando teclado físico y Joystick Virtual.
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

    if (this.attackTimer > 0) {
      this.attackTimer -= deltaTime;
    }

    if (input) {
      // 1. Entradas de teclado físico
      if (input.isKeyPressed('KeyW') || input.isKeyPressed('ArrowUp')) {
        this.velocity.y -= 1;
        this.facing = 'up';
      }
      if (input.isKeyPressed('KeyS') || input.isKeyPressed('ArrowDown')) {
        this.velocity.y += 1;
        this.facing = 'down';
      }
      if (input.isKeyPressed('KeyA') || input.isKeyPressed('ArrowLeft')) {
        this.velocity.x -= 1;
        this.facing = 'left';
      }
      if (input.isKeyPressed('KeyD') || input.isKeyPressed('ArrowRight')) {
        this.velocity.x += 1;
        this.facing = 'right';
      }

      // 2. Entrada de Joystick Táctil Virtual
      if (input.joystickVector && input.joystickVector.lengthSquared() > 0.02) {
        this.velocity.x += input.joystickVector.x;
        this.velocity.y += input.joystickVector.y;

        // Actualizar dirección según el joystick
        if (Math.abs(input.joystickVector.x) > Math.abs(input.joystickVector.y)) {
          this.facing = input.joystickVector.x > 0 ? 'right' : 'left';
        } else {
          this.facing = input.joystickVector.y > 0 ? 'down' : 'up';
        }
      }

      // 3. Botón de Ataque
      if (input.isAttackPressed && this.attackTimer <= 0) {
        this.attackTimer = 0.25; // 250ms de animación de tajo
        if (typeof window !== 'undefined' && window.DEBUG_MODE) {
          console.log(`[Player] Ataque disparado hacia: ${this.facing}`);
        }
      }
    }

    // Normalizar vector si la magnitud excede 1
    if (this.velocity.lengthSquared() > 1) {
      this.velocity.normalize();
    }
    this.velocity.multiplyScalar(this.speed * deltaTime);

    // Posición tentativa
    const nextX = this.pos.x + this.velocity.x;
    const nextY = this.pos.y + this.velocity.y;

    // Resolver colisiones
    if (physics) {
      const finalPos = physics.moveWithCollisions(this, nextX, nextY);
      this.pos.set(finalPos.x, finalPos.y);
    } else {
      this.pos.set(nextX, nextY);
    }
  }

  /**
   * Renderizado visual estilizado del héroe y su tajo de espada.
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
    ctx.fillStyle = '#1d4ed8'; // Azul
    ctx.fillRect(x + 7, y + 14, 18, 14);

    // 3. Túnica del héroe
    ctx.fillStyle = '#16a34a'; // Verde
    ctx.fillRect(x + 9, y + 14, 14, 12);

    // 4. Cinturón y Reliquia Milenaria
    ctx.fillStyle = '#78350f';
    ctx.fillRect(x + 9, y + 21, 14, 3);
    ctx.fillStyle = '#facc15';
    ctx.fillRect(x + 14, y + 20, 4, 5);

    // 5. Cabeza / Rostro
    ctx.fillStyle = '#fed7aa';
    ctx.fillRect(x + 9, y + 6, 14, 10);

    // 6. Cabello
    ctx.fillStyle = '#b45309';
    ctx.fillRect(x + 8, y + 3, 16, 5);
    ctx.fillRect(x + 7, y + 5, 3, 7);

    // 7. Ojos pixel art según la dirección
    ctx.fillStyle = '#0f172a';
    if (this.facing === 'left') {
      ctx.fillRect(x + 10, y + 10, 2, 3);
    } else if (this.facing === 'right') {
      ctx.fillRect(x + 20, y + 10, 2, 3);
    } else {
      ctx.fillRect(x + 12, y + 10, 2, 3);
      ctx.fillRect(x + 18, y + 10, 2, 3);
    }

    // 8. Efecto visual de Tajo de Espada si está atacando
    if (this.attackTimer > 0) {
      this._drawSlashEffect(ctx, x, y);
    }
  }

  /**
   * Dibuja un arco de energía cortante frente al héroe.
   * @private
   */
  _drawSlashEffect(ctx, px, py) {
    ctx.save();
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 3;
    ctx.beginPath();

    const cx = px + 16;
    const cy = py + 16;

    if (this.facing === 'right') {
      ctx.arc(cx + 10, cy, 22, -Math.PI / 3, Math.PI / 3);
    } else if (this.facing === 'left') {
      ctx.arc(cx - 10, cy, 22, (2 * Math.PI) / 3, (4 * Math.PI) / 3);
    } else if (this.facing === 'up') {
      ctx.arc(cx, cy - 10, 22, (7 * Math.PI) / 6, (11 * Math.PI) / 6);
    } else {
      ctx.arc(cx, cy + 10, 22, Math.PI / 6, (5 * Math.PI) / 6);
    }

    ctx.stroke();

    // Brillo blanco en el filo
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();
  }
}

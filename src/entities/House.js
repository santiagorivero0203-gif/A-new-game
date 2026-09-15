import { Entity } from './Entity.js';

/**
 * @module House
 * @description Entidad de cabaña/casa de madera con Y-Sorting estricto.
 * Posee tejado con chimenea y cimientos de piedra.
 * La hitbox sólida está configurada ÚNICAMENTE en la base/cimientos, permitiendo al
 * jugador caminar por la parte trasera (quedando tapado por el tejado) o por el frente
 * (quedando visible sobre los cimientos y puerta).
 * @author Be a Legend Team
 * @version 1.0.0
 */
export class House extends Entity {
  /**
   * @param {number} x - Posición X de la esquina superior izquierda
   * @param {number} y - Posición Y de la esquina superior izquierda
   * @param {HTMLImageElement|HTMLCanvasElement} [sprite] - Sprite de la casa
   */
  constructor(x, y, sprite = null) {
    // Dimensiones totales del sprite: 160x144 px
    super(x, y, 160, 144);
    this.sprite = sprite;

    this.tags.push('solid');
    this.tags.push('prop');
    this.tags.push('house');

    /**
     * Hitbox restringida ÚNICAMENTE a los cimientos y muros de la base.
     * Deja libre el tejado superior para permitir caminar por detrás.
     */
    this.hitbox = {
      offsetX: 12,
      offsetY: 86,
      width: 136,
      height: 54
    };

    // Actualizar cache pre-alocado de la entidad base
    this._hitboxCache.width = this.hitbox.width;
    this._hitboxCache.height = this.hitbox.height;
  }

  /**
   * Asigna la textura del sprite si se cargó de forma asíncrona.
   * @param {HTMLImageElement|HTMLCanvasElement} sprite
   */
  setSprite(sprite) {
    this.sprite = sprite;
  }

  /**
   * Renderiza el sprite de la casa o un fallback pixel art detallado.
   * @param {CanvasRenderingContext2D} ctx
   */
  draw(ctx) {
    if (this.sprite) {
      ctx.drawImage(this.sprite, this.pos.x, this.pos.y, this.width, this.height);
      return;
    }

    // Fallback visual procedural en caso de demora
    const { x, y } = this.pos;

    // 1. Sombra base
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.fillRect(x + 8, y + 134, 144, 14);

    // 2. Cimientos de piedra
    ctx.fillStyle = '#555562';
    ctx.fillRect(x + 12, y + 116, 136, 24);

    // 3. Paredes de troncos de madera
    ctx.fillStyle = '#8b5a2b';
    ctx.fillRect(x + 16, y + 68, 128, 50);

    // Líneas de troncos
    ctx.strokeStyle = '#5c3a1e';
    ctx.lineWidth = 2;
    for (let ly = y + 78; ly < y + 116; ly += 10) {
      ctx.beginPath();
      ctx.moveTo(x + 16, ly);
      ctx.lineTo(x + 144, ly);
      ctx.stroke();
    }

    // 4. Puerta de madera
    ctx.fillStyle = '#3e2410';
    ctx.fillRect(x + 70, y + 84, 24, 40);

    // Ventana iluminada
    ctx.fillStyle = '#ffec99';
    ctx.fillRect(x + 110, y + 84, 20, 20);

    // 5. Chimenea
    ctx.fillStyle = '#737373';
    ctx.fillRect(x + 116, y + 12, 20, 36);

    // 6. Tejado a dos aguas
    ctx.fillStyle = '#a0522d';
    ctx.beginPath();
    ctx.moveTo(x + 6, y + 70);
    ctx.lineTo(x + 80, y + 18);
    ctx.lineTo(x + 154, y + 70);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#6e3519';
    ctx.lineWidth = 3;
    ctx.stroke();
  }
}

import { Entity } from './Entity.js';

/**
 * @module House
 * @description Entidad de cabaña/casa de madera estilo 32-bit indie moderno con Y-Sorting estricto.
 * Tejado a dos aguas naranja vibrante, paredes de madera pastel y cimientos de piedra.
 * La hitbox sólida está configurada ÚNICAMENTE en los cimientos, permitiendo al
 * jugador caminar por la parte trasera (quedando tapado por el tejado) o por el frente.
 * @author Be a Legend Team
 * @version 1.2.0
 */
export class House extends Entity {
  /**
   * @param {number} x - Posición X de la esquina superior izquierda
   * @param {number} y - Posición Y de la esquina superior izquierda
   * @param {HTMLImageElement|HTMLCanvasElement} [sprite] - Sprite de la casa
   */
  constructor(x, y, sprite = null) {
    super(x, y, 160, 144);
    this.sprite = sprite;

    this.tags.push('solid');
    this.tags.push('prop');
    this.tags.push('house');

    /**
     * Hitbox restringida ÚNICAMENTE a los cimientos y muros de la base.
     */
    this.hitbox = {
      offsetX: 12,
      offsetY: 86,
      width: 136,
      height: 54
    };

    this._hitboxCache.width = this.hitbox.width;
    this._hitboxCache.height = this.hitbox.height;
  }

  /**
   * Asigna la textura del sprite.
   * @param {HTMLImageElement|HTMLCanvasElement} sprite
   */
  setSprite(sprite) {
    this.sprite = sprite;
  }

  /**
   * Renderiza el sprite de la casa moderna o el fallback vectorial pastel.
   * @param {CanvasRenderingContext2D} ctx
   */
  draw(ctx) {
    if (this.sprite) {
      ctx.drawImage(this.sprite, this.pos.x, this.pos.y, this.width, this.height);
      return;
    }

    const { x, y } = this.pos;

    // 1. Sombra suave
    ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
    ctx.fillRect(x + 10, y + 132, 140, 12);

    // 2. Cimientos de piedra redondeada
    ctx.fillStyle = '#64748b';
    ctx.fillRect(x + 12, y + 116, 136, 24);

    // 3. Paredes de madera pastel celeste / cyan (estilo Animal Crossing / Eastward)
    ctx.fillStyle = '#7dd3fc';
    ctx.fillRect(x + 16, y + 68, 128, 50);

    // Líneas de tablones suaves
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2;
    for (let ly = y + 80; ly < y + 116; ly += 12) {
      ctx.beginPath();
      ctx.moveTo(x + 16, ly);
      ctx.lineTo(x + 144, ly);
      ctx.stroke();
    }

    // 4. Puerta redondeada de madera
    ctx.fillStyle = '#78350f';
    ctx.fillRect(x + 36, y + 82, 28, 42);
    ctx.fillStyle = '#fbbf24';
    ctx.fillRect(x + 56, y + 102, 4, 4); // Pomo dorado

    // Ventana luminosa
    ctx.fillStyle = '#fef08a';
    ctx.fillRect(x + 88, y + 82, 28, 24);
    ctx.strokeStyle = '#ca8a04';
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 88, y + 82, 28, 24);

    // 5. Chimenea de ladrillos
    ctx.fillStyle = '#b45309';
    ctx.fillRect(x + 112, y + 14, 22, 38);

    // 6. Tejado a dos aguas naranja teja vibrante
    ctx.fillStyle = '#f97316';
    ctx.beginPath();
    ctx.moveTo(x + 6, y + 70);
    ctx.lineTo(x + 80, y + 18);
    ctx.lineTo(x + 154, y + 70);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = '#ea580c';
    ctx.lineWidth = 3;
    ctx.stroke();
  }
}

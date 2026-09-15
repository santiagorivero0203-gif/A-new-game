import { Entity } from './Entity.js';

/**
 * @module Tree
 * @description Entidad de árbol frondoso estilo 32-bit indie moderno con Y-Sorting estricto.
 * Posee una gran copa redonda chibi (cabeza grande) y un tronco pequeño en la base.
 * La hitbox sólida se ubica exclusivamente en el tronco inferior, permitiendo al jugador
 * caminar libremente detrás del follaje o delante de la base.
 * @author Be a Legend Team
 * @version 1.2.0
 */
export class Tree extends Entity {
  /**
   * @param {number} x - Posición X de la esquina superior izquierda del sprite
   * @param {number} y - Posición Y de la esquina superior izquierda del sprite
   * @param {HTMLImageElement|HTMLCanvasElement} [sprite] - Sprite de árbol cargado
   */
  constructor(x, y, sprite = null) {
    super(x, y, 84, 98);
    this.sprite = sprite;

    this.tags.push('solid');
    this.tags.push('prop');
    this.tags.push('tree');

    /**
     * Hitbox restringida ÚNICAMENTE a la base del tronco inferior.
     * Tronco de 24x18 px centrado horizontalmente en la base del sprite.
     */
    this.hitbox = {
      offsetX: 30,
      offsetY: 78,
      width: 24,
      height: 18
    };

    this._hitboxCache.width = this.hitbox.width;
    this._hitboxCache.height = this.hitbox.height;
  }

  /**
   * Asigna la textura del sprite 32-bit.
   * @param {HTMLImageElement|HTMLCanvasElement} sprite
   */
  setSprite(sprite) {
    this.sprite = sprite;
  }

  /**
   * Renderiza el sprite del árbol moderno o el fallback vectorial chibi.
   * @param {CanvasRenderingContext2D} ctx
   */
  draw(ctx) {
    if (this.sprite) {
      ctx.drawImage(this.sprite, this.pos.x, this.pos.y, this.width, this.height);
      return;
    }

    const { x, y } = this.pos;

    // 1. Sombra suave en el suelo
    ctx.fillStyle = 'rgba(0, 0, 0, 0.18)';
    ctx.beginPath();
    ctx.ellipse(x + 42, y + 90, 26, 7, 0, 0, Math.PI * 2);
    ctx.fill();

    // 2. Tronco pequeño chibi (marrón cálido)
    ctx.fillStyle = '#92400e';
    ctx.fillRect(x + 34, y + 68, 16, 24);

    // 3. Copa redonda grande estilo chibi / Eastward (verde brillante uniforme)
    ctx.fillStyle = '#15803d';
    ctx.beginPath();
    ctx.arc(x + 42, y + 42, 36, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#22c55e';
    ctx.beginPath();
    ctx.arc(x + 40, y + 38, 32, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#4ade80';
    ctx.beginPath();
    ctx.arc(x + 36, y + 32, 22, 0, Math.PI * 2);
    ctx.fill();
  }
}

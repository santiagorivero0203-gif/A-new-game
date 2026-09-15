import { Entity } from './Entity.js';

/**
 * @module Tree
 * @description Entidad de árbol frondoso para el bosque con Y-Sorting estricto.
 * Posee una copa grande de follaje y un tronco pequeño en la base.
 * La hitbox sólida se ubica exclusivamente en el tronco inferior, permitiendo al jugador
 * caminar por detrás de la copa (quedando oculto) o por delante de la base (quedando en primer plano).
 * @author Be a Legend Team
 * @version 1.0.0
 */
export class Tree extends Entity {
  /**
   * @param {number} x - Posición X de la esquina superior izquierda del sprite
   * @param {number} y - Posición Y de la esquina superior izquierda del sprite
   * @param {HTMLImageElement|HTMLCanvasElement} [sprite] - Sprite de árbol cargado
   */
  constructor(x, y, sprite = null) {
    // Dimensiones del sprite completo: 80x96 px
    super(x, y, 80, 96);
    this.sprite = sprite;

    this.tags.push('solid');
    this.tags.push('prop');
    this.tags.push('tree');

    /**
     * Hitbox restringida ÚNICAMENTE a la base del tronco inferior.
     * Tronco de 24x18 px centrado horizontalmente en la base del sprite.
     */
    this.hitbox = {
      offsetX: 28,
      offsetY: 78,
      width: 24,
      height: 18
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
   * Renderiza el sprite del árbol o una representación pixel art vectorial de respaldo.
   * @param {CanvasRenderingContext2D} ctx
   */
  draw(ctx) {
    if (this.sprite) {
      ctx.drawImage(this.sprite, this.pos.x, this.pos.y, this.width, this.height);
      return;
    }

    // Fallback visual procedural estilizado (en caso de demora en carga)
    const { x, y } = this.pos;

    // 1. Sombra en el suelo
    ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
    ctx.beginPath();
    ctx.ellipse(x + 40, y + 88, 30, 10, 0, 0, Math.PI * 2);
    ctx.fill();

    // 2. Tronco de madera
    ctx.fillStyle = '#5c3a21';
    ctx.fillRect(x + 30, y + 60, 20, 32);
    ctx.fillStyle = '#422814';
    ctx.fillRect(x + 30, y + 60, 6, 32);

    // 3. Copa frondosa grande (círculos compuestos)
    ctx.fillStyle = '#1e5e18';
    ctx.beginPath();
    ctx.arc(x + 40, y + 36, 38, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#2d8223';
    ctx.beginPath();
    ctx.arc(x + 36, y + 32, 34, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#42a832';
    ctx.beginPath();
    ctx.arc(x + 32, y + 26, 26, 0, Math.PI * 2);
    ctx.fill();
  }
}

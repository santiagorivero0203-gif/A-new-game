import { Entity } from './Entity.js';
import { CelSpriteAtlas } from '../render/CelSpriteAtlas.js';

/**
 * @module Tree
 * @description Entidad arbórea regional con 4 estilos por bioma, separación tronco/copa para
 * balanceo orgánico independiente del viento en las hojas sin mover las raíces y motas vivas.
 * La hitbox sólida permanece estrictamente en el tronco inferior.
 * @author Be a Legend Team
 * @version 2.0.0
 */
export class Tree extends Entity {
  /**
   * @param {number} x - Posición X de la esquina superior izquierda del sprite
   * @param {number} y - Posición Y de la esquina superior izquierda del sprite
   * @param {HTMLImageElement|HTMLCanvasElement|Object|null} [spriteOrConfig=null]
   */
  constructor(x, y, spriteOrConfig = null) {
    super(x, y, 84, 98);
    const isCfg = spriteOrConfig && typeof spriteOrConfig === 'object'
      && typeof spriteOrConfig.getContext !== 'function'
      && !('naturalWidth' in spriteOrConfig);

    this.sprite = isCfg ? (spriteOrConfig.sprite || null) : spriteOrConfig;
    this.biome = isCfg ? (spriteOrConfig.biome || 'cave_exit_intro') : 'cave_exit_intro';
    this.variant = isCfg && typeof spriteOrConfig.variant === 'number'
      ? spriteOrConfig.variant
      : (Math.abs(Math.round(x / 32) + Math.round(y / 32)) & 1);
    this._windSeed = ((Math.abs(x) * 0.037) + (Math.abs(y) * 0.023)) % (Math.PI * 2);

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
   * Asigna textura externa opcional o configuración regional de bioma/variante.
   * @param {HTMLImageElement|HTMLCanvasElement|Object|null} spriteOrConfig
   */
  setSprite(spriteOrConfig) {
    if (
      spriteOrConfig &&
      typeof spriteOrConfig === 'object' &&
      typeof spriteOrConfig.getContext !== 'function' &&
      !('naturalWidth' in spriteOrConfig)
    ) {
      if (spriteOrConfig.biome) this.biome = spriteOrConfig.biome;
      if (typeof spriteOrConfig.variant === 'number') this.variant = spriteOrConfig.variant;
      this.sprite = spriteOrConfig.sprite || null;
      return;
    }
    this.sprite = spriteOrConfig;
  }

  /**
   * Renderiza el árbol con tronco estático y copa oscilando suavemente al viento del bioma.
   * @param {CanvasRenderingContext2D} ctx
   */
  draw(ctx) {
    const x = Math.round(this.pos.x);
    const y = Math.round(this.pos.y);
    const t = (typeof performance !== 'undefined' ? performance.now() : 0) * 0.001 + this._windSeed;
    const swayX = Math.round(Math.sin(t * 1.45) * 1.7);
    const swayY = Math.round(Math.cos(t * 2.15) * 0.6);

    if (this.sprite) {
      ctx.drawImage(this.sprite, x, y, this.width, this.height);
      return;
    }

    const trunk = CelSpriteAtlas.getTreeTrunkSprite(this.biome, this.variant);
    const canopy = CelSpriteAtlas.getTreeCanopySprite(this.biome, this.variant);
    if (trunk) ctx.drawImage(trunk, x, y, this.width, this.height);
    if (canopy) ctx.drawImage(canopy, x + swayX, y + swayY, this.width, this.height);

    // Partícula viva ocasional desprendiéndose suavemente desde la copa
    const dropCycle = (t * 0.34) % 1;
    const dropColor = this.biome === 'ash_caldera'
      ? '#fb923c'
      : this.biome === 'marsh_of_spores'
        ? '#5eead4'
        : this.biome === 'astral_citadel'
          ? '#e879f9'
          : (this.variant === 1 ? '#fbbf24' : '#94db4f');
    const px = Math.round(x + 28 + Math.sin(dropCycle * 6.28 + this._windSeed) * 11);
    const py = Math.round(y + 42 + dropCycle * 44);
    ctx.fillStyle = dropColor;
    ctx.globalAlpha = 0.72 * (1 - dropCycle);
    ctx.fillRect(px, py, 2, 2);
    ctx.globalAlpha = 1;
  }
}

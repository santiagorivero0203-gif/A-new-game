import { Entity } from './Entity.js';
import { CelSpriteAtlas } from '../render/CelSpriteAtlas.js';

/**
 * @module House
 * @description Entidad arquitectónica regional con 4 estilos por bioma × 4 oficios
 * (`cottage`, `forge`, `alchemist`, `civic`), animaciones ambientales vivas Zero-GC
 * (humo ascendente de chimeneas, brasas de herrería, burbujas alquímicas, estandartes
 * y cristales estelares) y Y-Sorting estricto restringido a los cimientos.
 * @author Be a Legend Team
 * @version 2.0.0
 */
export class House extends Entity {
  /**
   * @param {number} x - Posición X de la esquina superior izquierda
   * @param {number} y - Posición Y de la esquina superior izquierda
   * @param {HTMLImageElement|HTMLCanvasElement|Object|null} [spriteOrConfig=null]
   */
  constructor(x, y, spriteOrConfig = null) {
    super(x, y, 168, 152);
    const isCfg = spriteOrConfig && typeof spriteOrConfig === 'object'
      && typeof spriteOrConfig.getContext !== 'function'
      && !('naturalWidth' in spriteOrConfig);

    this.sprite = isCfg ? (spriteOrConfig.sprite || null) : spriteOrConfig;
    this.biome = isCfg ? (spriteOrConfig.biome || 'cave_exit_intro') : 'cave_exit_intro';
    this.buildingType = isCfg ? (spriteOrConfig.buildingType || 'cottage') : 'cottage';
    this.label = isCfg ? (spriteOrConfig.label || null) : null;
    this._phase = ((Math.abs(x) * 13 + Math.abs(y) * 7) % 100) * 0.0628;

    this.tags.push('solid');
    this.tags.push('prop');
    this.tags.push('house');

    /**
     * Hitbox restringida ÚNICAMENTE a los cimientos y muros de la base.
     */
    this.hitbox = {
      offsetX: 14,
      offsetY: 92,
      width: 140,
      height: 54
    };

    this._hitboxCache.width = this.hitbox.width;
    this._hitboxCache.height = this.hitbox.height;
  }

  /**
   * Asigna textura o configuración de bioma/tipo arquitectónico.
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
      if (spriteOrConfig.buildingType) this.buildingType = spriteOrConfig.buildingType;
      this.sprite = spriteOrConfig.sprite || null;
      return;
    }
    this.sprite = spriteOrConfig;
  }

  /**
   * Renderiza el edificio regional horneado y anima chimeneas, fraguas, calderos y estandartes.
   * @param {CanvasRenderingContext2D} ctx
   */
  draw(ctx) {
    const x = Math.round(this.pos.x);
    const y = Math.round(this.pos.y);
    const nowSec = (typeof performance !== 'undefined' ? performance.now() : 0) * 0.001;
    const t = nowSec + this._phase;

    const img = this.sprite || CelSpriteAtlas.getHouseSprite(this.biome, this.buildingType);
    if (img) {
      ctx.drawImage(img, x, y, this.width, this.height);
    }

    // 1. Calidez pulsante en ventanas y cristales interiores (Zero-GC hex + globalAlpha)
    const winAlpha = 0.14 + Math.sin(t * 2.6) * 0.08;
    ctx.fillStyle = this.biome === 'marsh_of_spores'
      ? '#5eead4'
      : this.biome === 'astral_citadel'
        ? '#e879f9'
        : '#fde047';
    ctx.globalAlpha = winAlpha;
    ctx.fillRect(x + 98, y + 82, 28, 22);

    // 2. Volutas de humo o vapor alquímico desde chimeneas / torres
    if (this.buildingType === 'cottage' || this.buildingType === 'forge' || this.buildingType === 'alchemist') {
      const chimX = this.buildingType === 'forge' ? x + 124 : x + 125;
      const chimY = this.buildingType === 'forge' ? y + 6 : y + 11;
      for (let i = 0; i < 3; i++) {
        const cycle = (t * 0.55 + i * 0.33) % 1;
        const px = Math.round(chimX + Math.sin(cycle * 6.28 + i) * 3.2);
        const py = Math.round(chimY - cycle * 18);
        const size = cycle < 0.4 ? 4 : cycle < 0.75 ? 5 : 3;
        ctx.globalAlpha = (1 - cycle) * 0.52;
        if (this.buildingType === 'alchemist') {
          ctx.fillStyle = this.biome === 'ash_caldera' ? '#fb923c' : '#5eead4';
        } else {
          ctx.fillStyle = '#e2e8f0';
        }
        ctx.fillRect(px, py, size, size);
      }
    }

    // 3. Animaciones vivas específicas de oficio o bioma
    if (this.buildingType === 'forge') {
      const sparkOn = Math.floor(t * 5) % 2 === 0;
      ctx.globalAlpha = 1;
      ctx.fillStyle = sparkOn ? '#fde047' : '#f97316';
      ctx.fillRect(x + 123, y + 10, 8, 3);
      for (let s = 0; s < 2; s++) {
        const sc = (t * 1.4 + s * 0.5) % 1;
        const sx = Math.round(x + 135 + Math.cos(s * 2 + sc * 3) * 7 * sc);
        const sy = Math.round(y + 112 - sc * 11);
        ctx.globalAlpha = 1 - sc;
        ctx.fillStyle = '#fde047';
        ctx.fillRect(sx, sy, 2, 2);
      }
    } else if (this.buildingType === 'alchemist') {
      const swing = Math.round(Math.sin(t * 3.1) * 1.5);
      ctx.globalAlpha = 1;
      ctx.fillStyle = this.biome === 'astral_citadel' ? '#e879f9' : '#4ade80';
      ctx.fillRect(x + 81 + swing, y + 83, 6, 4);
      const bub = (t * 0.9) % 1;
      ctx.globalAlpha = 1 - bub;
      ctx.fillStyle = '#a855f7';
      ctx.fillRect(x + 83, Math.round(y + 76 - bub * 10), 2, 2);
    } else if (this.buildingType === 'civic') {
      const wave = Math.round(Math.sin(t * 3.6) * 1.5);
      const bannerColor = this.biome === 'ash_caldera' ? '#f97316'
        : this.biome === 'marsh_of_spores' ? '#2dd4bf'
          : this.biome === 'astral_citadel' ? '#a855f7' : '#b45309';
      ctx.globalAlpha = 1;
      ctx.fillStyle = bannerColor;
      ctx.fillRect(x + 30 + wave, y + 72, 6, 16);
      ctx.fillRect(x + 132 + wave, y + 72, 6, 16);
      ctx.fillStyle = '#fde047';
      ctx.fillRect(x + 31 + wave, y + 86, 4, 2);
      ctx.fillRect(x + 133 + wave, y + 86, 4, 2);
    }

    if (this.biome === 'astral_citadel') {
      const floatY = Math.round(Math.sin(t * 2.4) * 2.2);
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#e879f9';
      ctx.fillRect(x + 82, y + 8 + floatY, 4, 7);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x + 83, y + 10 + floatY, 2, 3);
    }

    ctx.globalAlpha = 1;
  }
}

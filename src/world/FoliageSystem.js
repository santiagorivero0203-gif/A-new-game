import { Entity } from '../entities/Entity.js';
import { CelSpriteAtlas } from '../render/CelSpriteAtlas.js';

/**
 * @module Foliage
 * @description Entidad de vegetación interactiva (arbusto o mata de flores) con físicas elásticas
 * y brisa suave ambiental adaptada a cada bioma.
 * @author Be a Legend Team
 * @version 2.0.0
 */
export class FoliageProp extends Entity {
  /**
   * @param {number} x - Coordenada X
   * @param {number} y - Coordenada Y
   * @param {HTMLImageElement|HTMLCanvasElement|Object|null} [spriteOrConfig=null]
   */
  constructor(x, y, spriteOrConfig = null) {
    // Dimensiones visuales del arbusto: 48x44 px
    super(x, y, 48, 44);
    const isCfg = spriteOrConfig && typeof spriteOrConfig === 'object'
      && typeof spriteOrConfig.getContext !== 'function'
      && !('naturalWidth' in spriteOrConfig);
    this.sprite = isCfg ? (spriteOrConfig.sprite || null) : spriteOrConfig;
    this.biome = isCfg ? (spriteOrConfig.biome || 'cave_exit_intro') : 'cave_exit_intro';
    this.variant = (Math.abs(Math.round(x / 32) + Math.round(y / 32)) & 1);

    this.tags.push('foliage');
    this.tags.push('prop');
    // NO es sólido: el jugador puede caminar a través de él para que reaccione físicamente

    /**
     * Hitbox de interacción sensible para detectar el paso del jugador
     */
    this.hitbox = {
      offsetX: 4,
      offsetY: 8,
      width: 40,
      height: 32
    };

    this._hitboxCache.width = this.hitbox.width;
    this._hitboxCache.height = this.hitbox.height;

    // --- Parámetros de Físicas de Balanceo y Resorte ---
    /** @type {number} Ángulo de inclinación actual en radianes */
    this.angle = 0;

    /** @type {number} Velocidad angular */
    this.angularVelocity = 0;

    /** @type {number} Rigidez del resorte (Spring Constant k) */
    this.springK = 48.0;

    /** @type {number} Coeficiente de amortiguamiento (Damping d) */
    this.damping = 6.5;

    /** @type {number} Fase aleatoria para desfase de viento orgánico */
    this.windPhase = Math.random() * Math.PI * 2;

    /** @type {number} Acumulador de tiempo */
    this.time = Math.random() * 10;
  }

  /**
   * Asigna la textura del sprite.
   * @param {HTMLImageElement|HTMLCanvasElement} sprite
   */
  setSprite(sprite) {
    this.sprite = sprite;
  }

  /**
   * Actualiza la simulación de resorte reactivo únicamente cuando el arbusto fue empujado.
   * Permanece en O(1) mientras está en reposo para no consumir CPU ni deformar píxeles.
   * @param {Object} context - GameContext ({ deltaTime, input, physics, state })
   */
  update(context) {
    if (Math.abs(this.angle) < 0.002 && Math.abs(this.angularVelocity) < 0.002) {
      this.angle = 0;
      this.angularVelocity = 0;
      return;
    }

    const deltaTime = context.deltaTime || 0.016;

    // Resorte amortiguado hacia el reposo (sin balanceo perpetuo por viento)
    const springForce = -this.springK * this.angle;
    const dampingForce = -this.damping * this.angularVelocity;
    const angularAcceleration = springForce + dampingForce;

    this.angularVelocity += angularAcceleration * deltaTime;
    this.angle += this.angularVelocity * deltaTime;

    const maxAngle = 0.45;
    if (this.angle > maxAngle) this.angle = maxAngle;
    if (this.angle < -maxAngle) this.angle = -maxAngle;
  }

  /**
   * Aplica un impulso físico cuando una entidad (ej: el jugador) colisiona o pasa rozándolo.
   * @param {number} pushX - Fuerza horizontal del empuje
   * @param {number} pushY - Fuerza vertical del empuje
   */
  applyPush(pushX, pushY) {
    // El empuje horizontal induce rotación sobre la raíz
    const impulse = (pushX * 0.04) + (Math.sign(pushX || 1) * 0.15);
    this.angularVelocity += impulse;
  }

  /**
   * Renderiza el arbusto con desplazamiento entero en X sin rotación fraccionaria
   * para preservar el pixel-art nítido a 60/120 FPS.
   * @param {CanvasRenderingContext2D} ctx
   */
  draw(ctx) {
    const x = Math.round(this.pos.x);
    const y = Math.round(this.pos.y);
    const t = (typeof performance !== 'undefined' ? performance.now() : 0) * 0.001 + this.windPhase;
    const windShift = Math.round(Math.sin(t * 2.15) * 1.15);
    const shiftX = Math.round(this.angle * 10) + windShift;

    const img = this.sprite || CelSpriteAtlas.getBiomeBushSprite(this.biome, this.variant);
    if (img) {
      ctx.drawImage(img, x + shiftX, y, this.width, this.height);
      return;
    }

    const pivotX = Math.round(x + this.width / 2) + shiftX;
    const pivotY = Math.round(y + this.height - 4);
    ctx.save();
    ctx.translate(pivotX, pivotY);
    this._drawFallbackBush(ctx);
    ctx.restore();
  }

  /**
   * Dibujado vectorial procedural de alta fidelidad estilo Minish Cap de respaldo.
   * @private
   */
  _drawFallbackBush(ctx) {
    const halfW = this.width / 2;
    const topH = -this.height + 4;

    // 1. Sombra suave en el suelo
    ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
    ctx.beginPath();
    ctx.ellipse(0, 0, 20, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    // 2. Copa esponjosa de arbusto en racimos de hojas
    ctx.fillStyle = '#15803d'; // Verde base oscuro
    ctx.beginPath();
    ctx.arc(0, topH + 20, 18, 0, Math.PI * 2);
    ctx.arc(-10, topH + 24, 13, 0, Math.PI * 2);
    ctx.arc(10, topH + 24, 13, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#22c55e'; // Verde medio vibrante
    ctx.beginPath();
    ctx.arc(-2, topH + 18, 15, 0, Math.PI * 2);
    ctx.arc(-10, topH + 22, 10, 0, Math.PI * 2);
    ctx.arc(8, topH + 22, 10, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#86efac'; // Puntos de luz en las hojas
    ctx.beginPath();
    ctx.arc(-4, topH + 12, 6, 0, Math.PI * 2);
    ctx.arc(6, topH + 14, 5, 0, Math.PI * 2);
    ctx.fill();

    // 3. Flores silvestres coloridas
    ctx.fillStyle = '#fde047'; // Flor amarilla
    ctx.beginPath();
    ctx.arc(-8, topH + 16, 3, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#f43f5e'; // Flor rosa/roja
    ctx.beginPath();
    ctx.arc(7, topH + 19, 3, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#38bdf8'; // Flor azul
    ctx.beginPath();
    ctx.arc(0, topH + 27, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

/**
 * @module FoliageSystem
 * @description Administrador del sistema de vegetación y físicas de contacto.
 * Detecta cuando el jugador cruza sobre un arbusto o planta y transfiere energía cinética
 * para activar la deformación elástica.
 */
export class FoliageSystem {
  /**
   * @param {import('../entities/EntityManager.js').EntityManager} entityManager
   */
  constructor(entityManager) {
    this.entityManager = entityManager;
    /** @type {Array<FoliageProp>} */
    this.foliageList = [];
    /** @type {HTMLImageElement|HTMLCanvasElement|null} Textura Flyweight única para arbustos montados por chunks */
    this._sharedSprite = null;
  }

  /**
   * Registra un nuevo arbusto en el sistema y en el EntityManager para Y-Sorting.
   * @param {number} x
   * @param {number} y
   * @param {HTMLImageElement|HTMLCanvasElement} [sprite]
   * @returns {FoliageProp}
   */
  addFoliage(x, y, sprite = null) {
    const prop = new FoliageProp(x, y, sprite || this._sharedSprite);
    this.foliageList.push(prop);
    this.entityManager.addEntity(prop);
    return prop;
  }

  /**
   * Desmonta un arbusto específico al descargar su chunk del mundo activo.
   * @param {FoliageProp} prop
   */
  removeFoliage(prop) {
    if (!prop) return;
    const idx = this.foliageList.indexOf(prop);
    if (idx > -1) {
      const last = this.foliageList.length - 1;
      if (idx !== last) this.foliageList[idx] = this.foliageList[last];
      this.foliageList.pop();
    }
    this.entityManager.removeEntity(prop);
  }

  /**
   * Evalúa la interacción elástica al rozar arbustos y, solo si el sigilo está activo,
   * actualiza la ocultación en grama alta.
   * Utiliza rechazo rápido AABB para descartar arbustos lejanos sin alocar ni leer hitboxes.
   * @param {import('../entities/Player.js').Player} player
   * @param {boolean} [stealthEnabled=false] - Solo evalúa sigilo cuando la mecánica está habilitada
   */
  updateInteraction(player, stealthEnabled = false) {
    if (!player) return;

    const playerHitbox = player.getHitbox();
    const playerCenterX = playerHitbox.x + playerHitbox.width * 0.5;
    const playerCenterY = playerHitbox.y + playerHitbox.height * 0.5;

    const contactRadius = 34;
    const contactRadiusSq = contactRadius * contactRadius;
    let inGrass = false;

    for (let i = 0; i < this.foliageList.length; i++) {
      const foliage = this.foliageList[i];
      const fx = foliage.pos.x + foliage.width * 0.5;
      const fy = foliage.pos.y + foliage.height * 0.5;
      const dx = fx - playerCenterX;
      if (dx > 52 || dx < -52) continue;
      const dy = fy - playerCenterY;
      if (dy > 52 || dy < -52) continue;

      const foliageHitbox = foliage.getHitbox();
      const foliageCenterX = foliageHitbox.x + foliageHitbox.width * 0.5;
      const foliageCenterY = foliageHitbox.y + foliageHitbox.height * 0.5;
      const hdx = foliageCenterX - playerCenterX;
      const hdy = foliageCenterY - playerCenterY;

      if (hdx * hdx + hdy * hdy < contactRadiusSq) {
        inGrass = true;
        const pushX = (player.velocity.x !== 0) ? player.velocity.x : (hdx !== 0 ? Math.sign(hdx) * 20 : 0);
        const pushY = (player.velocity.y !== 0) ? player.velocity.y : 0;
        foliage.applyPush(pushX, pushY);
      }
    }

    if (stealthEnabled) {
      player.inTallGrass = inGrass;
      player.isStealthHidden = inGrass && !!player.isProne;
    } else {
      player.inTallGrass = false;
      player.isStealthHidden = false;
    }
  }

  /**
   * Asigna una textura Flyweight única a todos los arbustos presentes y futuros.
   * @param {HTMLImageElement|HTMLCanvasElement} sprite
   */
  setGlobalSprite(sprite) {
    this._sharedSprite = sprite;
    for (let i = 0; i < this.foliageList.length; i++) {
      this.foliageList[i].setSprite(sprite);
    }
  }

  /**
   * Limpia las referencias a la vegetación acumulada antes de cargar un nuevo mundo/bioma.
   */
  clear() {
    this.foliageList.length = 0;
  }
}

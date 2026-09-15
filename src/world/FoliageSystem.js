import { Entity } from '../entities/Entity.js';

/**
 * @module Foliage
 * @description Entidad de vegetación interactiva (arbusto o mata de flores) con físicas elásticas.
 * Posee balanceo armónico continuo por el viento ambiental y reacciona doblándose elásticamente
 * con un sistema de resorte-amortiguador (Damped Spring) cuando el jugador pasa sobre ella.
 * Se integra al Y-Sorting del EntityManager utilizando la raíz en el suelo como pivote.
 * @author Be a Legend Team
 * @version 1.0.0
 */
export class FoliageProp extends Entity {
  /**
   * @param {number} x - Coordenada X
   * @param {number} y - Coordenada Y
   * @param {HTMLImageElement|HTMLCanvasElement} [sprite] - Textura del arbusto
   */
  constructor(x, y, sprite = null) {
    // Dimensiones visuales del arbusto: 48x44 px
    super(x, y, 48, 44);
    this.sprite = sprite;

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
   * Actualiza la simulación de físicas ambientales de balanceo y flexión.
   * @param {Object} context - GameContext ({ deltaTime, input, physics, state })
   */
  update(context) {
    const deltaTime = context.deltaTime || 0.016;
    this.time += deltaTime;

    // 1. Balanceo de viento natural suave (oscilación senoidal compuesta)
    const windTarget = Math.sin(this.time * 2.5 + this.windPhase) * 0.07 +
                       Math.sin(this.time * 5.1 + this.windPhase) * 0.02;

    // 2. Fuerzas del resorte amortiguado (Hooke + Damping)
    const displacement = this.angle - windTarget;
    const springForce = -this.springK * displacement;
    const dampingForce = -this.damping * this.angularVelocity;
    const angularAcceleration = springForce + dampingForce;

    this.angularVelocity += angularAcceleration * deltaTime;
    this.angle += this.angularVelocity * deltaTime;

    // Limitar ángulo máximo para mantener estética limpia
    const maxAngle = 0.45; // ~25 grados
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
   * Renderiza el arbusto aplicando la inclinación física con pivote en la raíz inferior.
   * @param {CanvasRenderingContext2D} ctx
   */
  draw(ctx) {
    const { x, y } = this.pos;
    const pivotX = x + this.width / 2;
    const pivotY = y + this.height - 4; // Pivote en la base del suelo

    ctx.save();
    // Trasladar al pivote, rotar según las físicas, y dibujar
    ctx.translate(pivotX, pivotY);
    ctx.rotate(this.angle);

    if (this.sprite) {
      ctx.drawImage(this.sprite, -this.width / 2, -this.height + 4, this.width, this.height);
    } else {
      this._drawFallbackBush(ctx);
    }

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
  }

  /**
   * Registra un nuevo arbusto en el sistema y en el EntityManager para Y-Sorting.
   * @param {number} x
   * @param {number} y
   * @param {HTMLImageElement|HTMLCanvasElement} [sprite]
   * @returns {FoliageProp}
   */
  addFoliage(x, y, sprite = null) {
    const prop = new FoliageProp(x, y, sprite);
    this.foliageList.push(prop);
    this.entityManager.addEntity(prop);
    return prop;
  }

  /**
   * Evalúa la interacción y el choque con el jugador para aplicar físicas elásticas.
   * @param {import('../entities/Player.js').Player} player
   */
  updateInteraction(player) {
    if (!player) return;

    const playerHitbox = player.getHitbox();
    const playerCenterX = playerHitbox.x + playerHitbox.width / 2;
    const playerCenterY = playerHitbox.y + playerHitbox.height / 2;

    for (let i = 0; i < this.foliageList.length; i++) {
      const foliage = this.foliageList[i];
      const foliageHitbox = foliage.getHitbox();
      const foliageCenterX = foliageHitbox.x + foliageHitbox.width / 2;
      const foliageCenterY = foliageHitbox.y + foliageHitbox.height / 2;

      const dx = foliageCenterX - playerCenterX;
      const dy = foliageCenterY - playerCenterY;
      const distSq = dx * dx + dy * dy;

      // Radio de contacto efectivo (~34px)
      const contactRadius = 34;
      if (distSq < contactRadius * contactRadius) {
        const pushX = (player.velocity.x !== 0) ? player.velocity.x : (dx !== 0 ? Math.sign(dx) * 20 : 0);
        const pushY = (player.velocity.y !== 0) ? player.velocity.y : 0;
        foliage.applyPush(pushX, pushY);
      }
    }
  }

  /**
   * Asigna texturas masivamente una vez cargadas.
   * @param {HTMLImageElement|HTMLCanvasElement} sprite
   */
  setGlobalSprite(sprite) {
    for (let i = 0; i < this.foliageList.length; i++) {
      this.foliageList[i].setSprite(sprite);
    }
  }
}

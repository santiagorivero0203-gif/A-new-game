import { Vector2 } from '../utils/Vector2.js';

/**
 * @module Entity
 * @description Clase base para todos los objetos vivos, interactivos o estáticos del mundo.
 * Provee posición, dimensiones, tags de identificación, hitbox desacoplada del sprite
 * y un cache pre-alocado para evitar presión sobre el Garbage Collector.
 * @author Be a Legend Team
 * @version 1.1.0
 */
export class Entity {
  /**
   * @param {number} x - Posición inicial en el eje X
   * @param {number} y - Posición inicial en el eje Y
   * @param {number} width - Ancho visual del sprite
   * @param {number} height - Alto visual del sprite
   */
  constructor(x, y, width, height) {
    /** @type {Vector2} Posición espacial en coordenadas del mundo */
    this.pos = new Vector2(x, y);

    /** @type {number} */
    this.width = width;

    /** @type {number} */
    this.height = height;

    /** @type {boolean} Indica si la entidad participa activamente en la simulación y evaluación táctica */
    this.active = true;

    /** @type {string} Color de placeholder para renderizado base */
    this.color = 'gray';

    /** @type {Array<string>} Tags estáticos para identificación (ej: 'solid', 'player') */
    this.tags = [];

    /** @type {Set<string>} Índice O(1) sincronizado automáticamente con `this.tags` */
    this._tagSet = new Set();
    this._syncedTagLen = 0;
    this._syncedTagsRef = this.tags;

    /** @type {Map<string, number>} Efectos temporales (etiqueta -> tiempo restante) */
    this.activeEffects = new Map();

    /**
     * Hitbox ajustada para perspectiva Top-Down.
     * Por convención, ocupa la mitad inferior para dar sensación de volumen y profundidad.
     * @type {{offsetX: number, offsetY: number, width: number, height: number}}
     */
    this.hitbox = {
      offsetX: 0,
      offsetY: height / 2,
      width: width,
      height: height / 2
    };

    /**
     * STD-02 FIX: Objeto de hitbox pre-alocado para reutilizar en cada frame.
     * Evita crear miles de objetos temporales en memoria durante la detección de colisiones.
     * @private
     */
    this._hitboxCache = {
      x: 0,
      y: 0,
      width: width,
      height: height / 2
    };
  }

  /**
   * ARCH-01 FIX: Actualización lógica con contexto unificado.
   * Las subclases pueden desestructurar las dependencias que necesiten:
   * `update({ deltaTime, input, physics, state })`
   * @param {Object} context - Contenedor de dependencias del frame
   * @param {number} context.deltaTime - Tiempo transcurrido en segundos
   * @param {import('../core/InputManager.js').InputManager} [context.input] - Gestor de inputs
   * @param {import('../systems/PhysicsSystem.js').PhysicsSystem} [context.physics] - Sistema de colisiones
   * @param {import('../core/StateManager.js').StateManager} [context.state] - Estado global del juego
   */
  update(context) {
    const dt = context.deltaTime || (typeof context === 'number' ? context : 0);
    
    // Decrementar efectos temporales
    if (this.activeEffects.size > 0 && dt > 0) {
      for (const [effect, timeLeft] of this.activeEffects.entries()) {
        const newTime = timeLeft - dt;
        if (newTime <= 0) {
          this.activeEffects.delete(effect);
        } else {
          this.activeEffects.set(effect, newTime);
        }
      }
    }
    // Sobrescribir lógica específica en subclases
  }

  /**
   * Renderizado en el canvas.
   * @param {CanvasRenderingContext2D} ctx - Contexto 2D del canvas
   */
  draw(ctx) {
    ctx.fillStyle = this.color;
    ctx.fillRect(this.pos.x, this.pos.y, this.width, this.height);
  }

  /**
   * STD-02 FIX: Obtiene la caja de colisión reutilizando el objeto en memoria.
   * @returns {{x: number, y: number, width: number, height: number}}
   */
  getHitbox() {
    this._hitboxCache.x = this.pos.x + this.hitbox.offsetX;
    this._hitboxCache.y = this.pos.y + this.hitbox.offsetY;
    this._hitboxCache.width = this.hitbox.width;
    this._hitboxCache.height = this.hitbox.height;
    return this._hitboxCache;
  }

  /**
   * Añade una etiqueta sin duplicados manteniendo el índice O(1).
   * @param {string} tag
   */
  addTag(tag) {
    if (!this.hasTag(tag)) {
      this.tags.push(tag);
      this._tagSet.add(tag);
      this._syncedTagLen = this.tags.length;
      this._syncedTagsRef = this.tags;
    }
  }

  /**
   * Comprueba si la entidad posee una etiqueta estática o efecto temporal activo.
   * Emplea escaneo lineal directo en colecciones pequeñas (`<= 8` etiquetas) y Set O(1) si crece.
   * @param {string} tag
   * @returns {boolean}
   */
  hasTag(tag) {
    const tags = this.tags;
    const len = tags.length;
    if (len <= 8) {
      for (let i = 0; i < len; i++) {
        if (tags[i] === tag) return true;
      }
      return this.activeEffects.size > 0 && this.activeEffects.has(tag);
    }

    if (this._syncedTagsRef !== tags || this._syncedTagLen !== len) {
      this._tagSet.clear();
      for (let i = 0; i < len; i++) {
        this._tagSet.add(tags[i]);
      }
      this._syncedTagLen = len;
      this._syncedTagsRef = tags;
    }
    return this._tagSet.has(tag) || (this.activeEffects.size > 0 && this.activeEffects.has(tag));
  }

  /**
   * Aplica un efecto (etiqueta temporal) a la entidad.
   * @param {string} effectTag - Nombre del efecto (ej. 'inmovilizado_raices')
   * @param {number} duration - Duración en segundos
   */
  applyEffect(effectTag, duration) {
    this.activeEffects.set(effectTag, duration);
  }
}

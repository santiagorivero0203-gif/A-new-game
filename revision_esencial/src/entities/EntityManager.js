/**
 * @module EntityManager
 * @description Contenedor central y orquestador de ciclo de vida de todas las entidades.
 * Provee ordenamiento Y-Sort para profundidad isométrica/top-down, filtrado optimizado
 * por etiquetas con caché persistente para eliminar la presión sobre el Garbage Collector (O(1)),
 * y distribución unificada del contexto de ejecución.
 * @author Be a Legend Team
 * @version 1.2.0
 */
export class EntityManager {
  constructor() {
    /** @type {Array<import('./Entity.js').Entity>} Lista plana interna de entidades */
    this.entities = [];

    /** @type {Array<import('./Entity.js').Entity>} Buffer reutilizable para Y-Sorting sin instanciaciones dinámicas */
    this._sortedBuffer = [];

    /** @type {Array<import('./Entity.js').Entity>|null} Caché persistente de sólidos para físicas O(1) */
    this._solidsCache = null;
  }

  /**
   * Registra una nueva entidad en el gestor e invalida la caché de sólidos.
   * @param {import('./Entity.js').Entity} entity
   */
  addEntity(entity) {
    this.entities.push(entity);
    this._sortedBuffer.push(entity);
    this._solidsCache = null;
  }

  /**
   * Remueve una entidad del gestor e invalida la caché de sólidos.
   * @param {import('./Entity.js').Entity} entity
   */
  removeEntity(entity) {
    const index = this.entities.indexOf(entity);
    if (index > -1) {
      this.entities.splice(index, 1);
      const bufIdx = this._sortedBuffer.indexOf(entity);
      if (bufIdx > -1) this._sortedBuffer.splice(bufIdx, 1);
      this._solidsCache = null;
    }
  }

  /**
   * Actualiza todas las entidades usando un objeto de contexto unificado.
   * Admite tanto un objeto `context` ({ deltaTime, input, physics, state }) como
   * argumentos separados para total retrocompatibilidad.
   * @param {Object|number} contextOrDt
   * @param {import('../core/InputManager.js').InputManager} [legacyInput]
   * @param {import('../systems/PhysicsSystem.js').PhysicsSystem} [legacyPhysics]
   * @param {import('../core/StateManager.js').StateManager} [legacyState]
   */
  update(contextOrDt, legacyInput, legacyPhysics, legacyState) {
    const context = (typeof contextOrDt === 'object' && contextOrDt !== null)
      ? contextOrDt
      : {
          deltaTime: contextOrDt,
          input: legacyInput,
          physics: legacyPhysics,
          state: legacyState
        };

    for (let i = 0; i < this.entities.length; i++) {
      this.entities[i].update(context);
    }
  }

  /**
   * Retorna las entidades ordenadas por profundidad (Y-Sorting) reutilizando el buffer interno.
   * Utiliza la base de la hitbox (los pies del personaje) para determinar el orden de dibujo
   * sin generar objetos temporales en el Garbage Collector.
   * @returns {Array<import('./Entity.js').Entity>}
   */
  getEntities() {
    // Sincronizar el buffer si cambia la cantidad de entidades
    if (this._sortedBuffer.length !== this.entities.length) {
      this._sortedBuffer = this.entities.slice();
    }

    return this._sortedBuffer.sort((a, b) => {
      const aBottom = a.pos.y + a.hitbox.offsetY + a.hitbox.height;
      const bBottom = b.pos.y + b.hitbox.offsetY + b.hitbox.height;
      return aBottom - bBottom;
    });
  }

  /**
   * Obtiene entidades con una etiqueta dada directamente sin aplicar Y-Sort.
   * @param {string} tag
   * @returns {Array<import('./Entity.js').Entity>}
   */
  getByTag(tag) {
    return this.entities.filter(e => e.hasTag(tag));
  }

  /**
   * Retorna todas las entidades sólidas para chequeos de colisión.
   * Utiliza caché persistente para acceso O(1) sin asignaciones de memoria en cada frame.
   * @returns {Array<import('./Entity.js').Entity>}
   */
  getSolids() {
    if (!this._solidsCache) {
      this._solidsCache = this.entities.filter(e => e.hasTag('solid'));
    }
    return this._solidsCache;
  }

  /**
   * Retorna la lista cruda de entidades sin clonar (acceso directo de solo lectura).
   * @returns {Array<import('./Entity.js').Entity>}
   */
  get rawEntities() {
    return this.entities;
  }
}

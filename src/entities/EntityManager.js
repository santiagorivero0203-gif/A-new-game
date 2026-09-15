/**
 * @module EntityManager
 * @description Contenedor central y orquestador de ciclo de vida de todas las entidades.
 * Provee ordenamiento Y-Sort para profundidad isométrica/top-down, filtrado optimizado
 * por etiquetas sin overhead de sorting, y distribución del contexto de ejecución.
 * @author Be a Legend Team
 * @version 1.1.0
 */
export class EntityManager {
  constructor() {
    /** @type {Array<import('./Entity.js').Entity>} Lista plana interna de entidades */
    this.entities = [];
  }

  /**
   * Registra una nueva entidad en el gestor.
   * @param {import('./Entity.js').Entity} entity
   */
  addEntity(entity) {
    this.entities.push(entity);
  }

  /**
   * Remueve una entidad del gestor.
   * @param {import('./Entity.js').Entity} entity
   */
  removeEntity(entity) {
    const index = this.entities.indexOf(entity);
    if (index > -1) {
      this.entities.splice(index, 1);
    }
  }

  /**
   * ARCH-01 FIX: Actualiza todas las entidades usando un objeto de contexto unificado.
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
   * Retorna las entidades ordenadas por profundidad (Y-Sorting).
   * Utiliza la base de la hitbox (los pies del personaje) para determinar el orden de dibujo.
   * @returns {Array<import('./Entity.js').Entity>}
   */
  getEntities() {
    return this.entities.slice().sort((a, b) => {
      const aBottom = a.pos.y + a.hitbox.offsetY + a.hitbox.height;
      const bBottom = b.pos.y + b.hitbox.offsetY + b.hitbox.height;
      return aBottom - bBottom;
    });
  }

  /**
   * ARCH-02 FIX: Obtiene entidades con una etiqueta dada directamente sin aplicar Y-Sort.
   * Evita clones y ordenamientos O(n log n) innecesarios en sistemas de lógica o física.
   * @param {string} tag
   * @returns {Array<import('./Entity.js').Entity>}
   */
  getByTag(tag) {
    return this.entities.filter(e => e.hasTag(tag));
  }

  /**
   * Retorna todas las entidades sólidas para chequeos de colisión (sin Y-Sort).
   * @returns {Array<import('./Entity.js').Entity>}
   */
  getSolids() {
    return this.getByTag('solid');
  }

  /**
   * Retorna la lista cruda de entidades sin clonar (acceso directo de solo lectura).
   * @returns {Array<import('./Entity.js').Entity>}
   */
  get rawEntities() {
    return this.entities;
  }
}

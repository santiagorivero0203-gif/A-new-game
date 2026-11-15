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

    /** @type {Map<string, Array<import('./Entity.js').Entity>>} Caché O(1) por etiqueta por fotograma */
    this._tagCache = new Map();

    /** @type {boolean} Bandera de reordenamiento Y-Sort bajo demanda */
    this._sortedDirty = true;

    /** @type {boolean} Bandera de reconstrucción del buffer visible cuando cambia la colección */
    this._bufferDirty = true;
  }

  /**
   * Indica si la entidad es un colisionador invisible puramente físico (sin representación gráfica).
   * @param {import('./Entity.js').Entity} entity
   * @returns {boolean}
   */
  _isRenderHidden(entity) {
    return Boolean(entity && entity.tags && entity.tags.includes('terrain_barrier'));
  }

  /**
   * Registra una nueva entidad en el gestor e invalida las cachés.
   * @param {import('./Entity.js').Entity} entity
   */
  addEntity(entity) {
    this.entities.push(entity);
    if (!this._isRenderHidden(entity)) {
      this._sortedBuffer.push(entity);
    }
    this._solidsCache = null;
    this._tagCache.clear();
    this._sortedDirty = true;
    this._bufferDirty = true;
  }

  /**
   * Remueve una entidad del gestor e invalida las cachés.
   * @param {import('./Entity.js').Entity} entity
   */
  removeEntity(entity) {
    const index = this.entities.indexOf(entity);
    if (index > -1) {
      this.entities.splice(index, 1);
      const bufIdx = this._sortedBuffer.indexOf(entity);
      if (bufIdx > -1) this._sortedBuffer.splice(bufIdx, 1);
      this._solidsCache = null;
      this._tagCache.clear();
      this._sortedDirty = true;
      this._bufferDirty = true;
    }
  }

  /**
   * Actualiza entidades dinámicas usando un objeto de contexto unificado,
   * omitiendo obstáculos/estructuras puramente estáticas para sostener 60/120 FPS.
   * @param {Object|number} contextOrDt
   * @param {import('../core/InputManager.js').InputManager} [legacyInput]
   * @param {import('../systems/PhysicsSystem.js').PhysicsSystem} [legacyPhysics]
   * @param {import('../core/StateManager.js').StateManager} [legacyState]
   */
  update(contextOrDt, legacyInput, legacyPhysics, legacyState) {
    this._sortedDirty = true;
    this._tagCache.clear();

    const context = (typeof contextOrDt === 'object' && contextOrDt !== null)
      ? contextOrDt
      : {
          deltaTime: contextOrDt,
          input: legacyInput,
          physics: legacyPhysics,
          state: legacyState
        };

    for (let i = 0; i < this.entities.length; i++) {
      const ent = this.entities[i];
      const tags = ent.tags;
      if (tags && (tags.includes('tree') || tags.includes('terrain_barrier') || tags.includes('house'))) {
        continue;
      }
      ent.update(context);
    }
  }

  /**
   * Retorna las entidades visibles ordenadas por profundidad (Y-Sorting) reutilizando el buffer interno.
   * Excluye barreras invisibles (`terrain_barrier`) y precalcula `_sortY` en O(N) para acelerar `.sort()`.
   * @returns {Array<import('./Entity.js').Entity>}
   */
  getEntities() {
    if (this._bufferDirty) {
      this._sortedBuffer.length = 0;
      for (let i = 0; i < this.entities.length; i++) {
        const ent = this.entities[i];
        if (!this._isRenderHidden(ent)) {
          this._sortedBuffer.push(ent);
        }
      }
      this._bufferDirty = false;
      this._sortedDirty = true;
    }

    if (this._sortedDirty) {
      for (let i = 0; i < this._sortedBuffer.length; i++) {
        const e = this._sortedBuffer[i];
        e._sortY = e.pos.y + e.hitbox.offsetY + e.hitbox.height;
      }
      this._sortedBuffer.sort((a, b) => a._sortY - b._sortY);
      this._sortedDirty = false;
    }

    return this._sortedBuffer;
  }

  /**
   * Obtiene entidades con una etiqueta dada mediante caché O(1) sin re-filtrar en cada llamada.
   * @param {string} tag
   * @returns {Array<import('./Entity.js').Entity>}
   */
  getByTag(tag) {
    if (this._tagCache.has(tag)) {
      return this._tagCache.get(tag);
    }
    const list = this.entities.filter(e => e.hasTag(tag));
    this._tagCache.set(tag, list);
    return list;
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

  /**
   * Elimina todas las entidades del mapa actual excepto el jugador principal (útil al viajar entre biomas/mundos).
   * Mantiene reutilizados los buffers internos sin recrear arrays innecesarios.
   * @param {import('./Entity.js').Entity|null} [player=null]
   */
  clearExceptPlayer(player = null) {
    this.entities.length = 0;
    if (player) {
      this.entities.push(player);
    }
    this._sortedBuffer.length = 0;
    this._solidsCache = null;
    this._tagCache.clear();
    this._sortedDirty = true;
    this._bufferDirty = true;
  }
}

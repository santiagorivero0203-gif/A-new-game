import { SpatialGrid } from '../world/SpatialGrid.js';

/**
 * @module EntityManager
 * @description Contenedor central y orquestador de ciclo de vida de todas las entidades.
 * Optimizado para 60/120 FPS estables:
 * - Separa entidades dinámicas (`_dynamicEntities`) de estructuras estáticas (`tree`, `house`, `terrain_barrier`).
 * - Indexa en O(1) etiquetas estructurales invariantes y mantiene rejillas espaciales `SpatialGrid` (128 px).
 * - Elimina entidades con swap-and-pop O(1) sin desplazamientos `Array.splice`.
 * - Aplica Frustum Culling previo al Y-Sorting con Insertion Sort in-place de coste casi lineal O(N).
 * @author Be a Legend Team
 * @version 1.4.0
 */
const INVARIANT_BUCKET_TAGS = ['tree', 'house', 'npc', 'interactable', 'enemy', 'player', 'foliage'];

/**
 * Remueve un elemento de un arreglo mediante swap-and-pop O(1) sin desplazar memoria.
 * @param {Array<*>} arr
 * @param {*} item
 */
function swapPopRemove(arr, item) {
  const idx = arr.indexOf(item);
  if (idx > -1) {
    const last = arr.length - 1;
    if (idx !== last) arr[idx] = arr[last];
    arr.pop();
    return true;
  }
  return false;
}

export class EntityManager {
  constructor() {
    /** @type {Array<import('./Entity.js').Entity>} Lista plana interna de entidades */
    this.entities = [];

    /** @type {Array<import('./Entity.js').Entity>} Solo entidades que requieren update() cada frame */
    this._dynamicEntities = [];

    /** @type {Array<import('./Entity.js').Entity>} Buffer reutilizable para Y-Sorting completo */
    this._sortedBuffer = [];

    /** @type {Array<import('./Entity.js').Entity>} Buffer reutilizable de entidades dentro de cámara */
    this._visibleBuffer = [];

    /** @type {Array<import('./Entity.js').Entity>|null} Caché persistente de sólidos para físicas O(1) */
    this._solidsCache = null;

    /** @type {Map<string, Array<import('./Entity.js').Entity>>} Caché temporal por etiqueta */
    this._tagCache = new Map();

    /** @type {Record<string, Array<import('./Entity.js').Entity>>} Cubetas persistentes para etiquetas fijas */
    this._buckets = {
      tree: [],
      house: [],
      npc: [],
      interactable: [],
      enemy: [],
      player: [],
      foliage: []
    };

    /** @type {boolean} Bandera de reordenamiento Y-Sort bajo demanda */
    this._sortedDirty = true;

    /** @type {boolean} Bandera de reconstrucción del buffer visible cuando cambia la colección */
    this._bufferDirty = true;

    /** @type {SpatialGrid} Rejilla espacial general (128 px) para combate y separación O(1) */
    this.spatialGrid = new SpatialGrid(128, 0);

    /** @type {SpatialGrid} Rejilla espacial exclusiva de sólidos para PhysicsSystem O(1) */
    this.solidGrid = new SpatialGrid(128, 1);

    /** @type {number} Umbral a partir del cual las consultas cambian de arreglo plano a SpatialGrid */
    this._spatialThreshold = 48;
    /** @type {boolean} Indica si la posición dinámica en SpatialGrid quedó pendiente mientras `< 48` */
    this._spatialPositionsStale = false;
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
   * Indica si una entidad es estática y no necesita invocarse en `update()`.
   * @private
   */
  _isStaticStructural(entity) {
    const tags = entity && entity.tags;
    if (!tags) return false;
    for (let i = 0; i < tags.length; i++) {
      const t = tags[i];
      if (t === 'tree' || t === 'house' || t === 'terrain_barrier') return true;
    }
    return false;
  }

  /**
   * Registra una nueva entidad en el gestor e indexa sus cubetas estructurales.
   * @param {import('./Entity.js').Entity} entity
   */
  addEntity(entity) {
    this.entities.push(entity);
    if (!this._isRenderHidden(entity)) {
      this._sortedBuffer.push(entity);
    }
    if (!this._isStaticStructural(entity)) {
      this._dynamicEntities.push(entity);
    }
    if (entity && Array.isArray(entity.tags)) {
      for (let i = 0; i < INVARIANT_BUCKET_TAGS.length; i++) {
        const tag = INVARIANT_BUCKET_TAGS[i];
        if (entity.tags.includes(tag)) {
          this._buckets[tag].push(entity);
        }
      }
    }
    this.spatialGrid.insert(entity);
    if (entity && typeof entity.hasTag === 'function' && entity.hasTag('solid')) {
      this.solidGrid.insert(entity);
    }
    this._solidsCache = null;
    this._tagCache.clear();
    this._sortedDirty = true;
    this._bufferDirty = true;
  }

  /**
   * Remueve una entidad del gestor en O(1) (swap-and-pop) y limpia sus rejillas espaciales.
   * @param {import('./Entity.js').Entity} entity
   */
  removeEntity(entity) {
    if (swapPopRemove(this.entities, entity)) {
      swapPopRemove(this._sortedBuffer, entity);
      swapPopRemove(this._dynamicEntities, entity);
      for (let i = 0; i < INVARIANT_BUCKET_TAGS.length; i++) {
        swapPopRemove(this._buckets[INVARIANT_BUCKET_TAGS[i]], entity);
      }
      this.spatialGrid.remove(entity);
      this.solidGrid.remove(entity);
      this._solidsCache = null;
      this._tagCache.clear();
      this._sortedDirty = true;
      this._bufferDirty = true;
    }
  }

  /**
   * Actualiza exclusivamente las entidades dinámicas y sincroniza sus celdas espaciales.
   * @param {Object|number} contextOrDt
   * @param {import('../core/InputManager.js').InputManager} [legacyInput]
   * @param {import('../systems/PhysicsSystem.js').PhysicsSystem} [legacyPhysics]
   * @param {import('../core/StateManager.js').StateManager} [legacyState]
   */
  update(contextOrDt, legacyInput, legacyPhysics, legacyState) {
    this._sortedDirty = true;
    if (this._tagCache.size > 0) this._tagCache.clear();

    const context = (typeof contextOrDt === 'object' && contextOrDt !== null)
      ? contextOrDt
      : {
        deltaTime: contextOrDt,
        input: legacyInput,
        physics: legacyPhysics,
        state: legacyState
      };

    const dyn = this._dynamicEntities;
    if (this.entities.length < this._spatialThreshold) {
      this._spatialPositionsStale = true;
      for (let i = 0; i < dyn.length; i++) {
        dyn[i].update(context);
      }
      return;
    }

    const needFullSync = this._spatialPositionsStale;
    this._spatialPositionsStale = false;
    for (let i = 0; i < dyn.length; i++) {
      const ent = dyn[i];
      if (needFullSync) {
        this.spatialGrid.updateEntity(ent);
        if (ent.hasTag('solid')) {
          this.solidGrid.updateEntity(ent);
        }
      }
      ent.update(context);
      this.spatialGrid.updateEntity(ent);
      if (ent.hasTag('solid')) {
        this.solidGrid.updateEntity(ent);
      }
    }
  }

  /**
   * Sincroniza posiciones dinámicas si estuvieron en modo plano antes de consultar SpatialGrid.
   * @private
   */
  _flushDynamicSpatialSync() {
    if (!this._spatialPositionsStale) return;
    this._spatialPositionsStale = false;
    const dyn = this._dynamicEntities;
    for (let i = 0; i < dyn.length; i++) {
      const ent = dyn[i];
      this.spatialGrid.updateEntity(ent);
      if (ent && typeof ent.hasTag === 'function' && ent.hasTag('solid')) {
        this.solidGrid.updateEntity(ent);
      }
    }
  }

  /**
   * Consulta entidades cercanas de forma adaptativa: arreglo plano si `< _spatialThreshold`,
   * o `SpatialGrid` O(1) cuando hay multitudes/hordas densas.
   * @param {number} minX
   * @param {number} minY
   * @param {number} maxX
   * @param {number} maxY
   * @param {Array<Object>} outBuffer
   * @returns {Array<import('./Entity.js').Entity>}
   */
  queryNearby(minX, minY, maxX, maxY, outBuffer) {
    if (this.entities.length < this._spatialThreshold) {
      return this.entities;
    }
    this._flushDynamicSpatialSync();
    return this.spatialGrid.queryBounds(minX, minY, maxX, maxY, outBuffer);
  }

  /**
   * Consulta sólidos cercanos de forma adaptativa para físicas sin overhead de hashing en mapas pequeños.
   * @param {number} minX
   * @param {number} minY
   * @param {number} maxX
   * @param {number} maxY
   * @param {Array<Object>} outBuffer
   * @returns {Array<import('./Entity.js').Entity>}
   */
  queryNearbySolids(minX, minY, maxX, maxY, outBuffer) {
    const solids = this.getSolids();
    if (solids.length < 36) {
      return solids;
    }
    this._flushDynamicSpatialSync();
    return this.solidGrid.queryBounds(minX, minY, maxX, maxY, outBuffer);
  }

  /**
   * Ordena in-place un buffer mediante Insertion Sort (óptimo O(N) para arreglos pequeños y casi ordenados).
   * @private
   */
  _insertionSortByY(arr) {
    for (let i = 1; i < arr.length; i++) {
      const current = arr[i];
      const key = current._sortY;
      let j = i - 1;
      while (j >= 0 && arr[j]._sortY > key) {
        arr[j + 1] = arr[j];
        j--;
      }
      arr[j + 1] = current;
    }
  }

  /**
   * Filtra primero por Frustum de cámara y ordena únicamente las entidades visibles por Y-Sort.
   * Reduce en ~80% el coste de ordenación y pintado respecto a ordenar todo el mapa.
   * @param {{minX: number, minY: number, maxX: number, maxY: number}|null} [bounds=null]
   * @returns {Array<import('./Entity.js').Entity>}
   */
  getVisibleEntities(bounds = null) {
    if (!bounds) return this.getEntities();

    if (this._bufferDirty) {
      this._sortedBuffer.length = 0;
      for (let i = 0; i < this.entities.length; i++) {
        const ent = this.entities[i];
        if (!this._isRenderHidden(ent)) {
          this._sortedBuffer.push(ent);
        }
      }
      this._bufferDirty = false;
    }

    const vis = this._visibleBuffer;
    vis.length = 0;
    const minX = bounds.minX;
    const minY = bounds.minY;
    const maxX = bounds.maxX;
    const maxY = bounds.maxY;

    const src = this._sortedBuffer;
    for (let i = 0; i < src.length; i++) {
      const e = src[i];
      if (!e || e.active === false) continue;
      if (
        e.pos.x + e.width < minX ||
        e.pos.x > maxX ||
        e.pos.y + e.height < minY ||
        e.pos.y > maxY
      ) {
        continue;
      }
      e._sortY = e.pos.y + e.hitbox.offsetY + e.hitbox.height;
      vis.push(e);
    }

    this._insertionSortByY(vis);
    return vis;
  }

  /**
   * Retorna todas las entidades visibles ordenadas por profundidad (Y-Sorting).
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
      this._insertionSortByY(this._sortedBuffer);
      this._sortedDirty = false;
    }

    return this._sortedBuffer;
  }

  /**
   * Obtiene entidades con una etiqueta dada en O(1) para cubetas estructurales sin alocar arrays nuevos.
   * @param {string} tag
   * @returns {Array<import('./Entity.js').Entity>}
   */
  getByTag(tag) {
    const bucket = this._buckets[tag];
    if (bucket !== undefined) {
      return bucket;
    }
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
    this._dynamicEntities.length = 0;
    this._visibleBuffer.length = 0;
    for (let i = 0; i < INVARIANT_BUCKET_TAGS.length; i++) {
      this._buckets[INVARIANT_BUCKET_TAGS[i]].length = 0;
    }
    this.spatialGrid.clear();
    this.solidGrid.clear();
    this._spatialPositionsStale = false;
    if (player) {
      this.entities.push(player);
      this._dynamicEntities.push(player);
      this._buckets.player.push(player);
      this.spatialGrid.insert(player);
    }
    this._sortedBuffer.length = 0;
    this._solidsCache = null;
    this._tagCache.clear();
    this._sortedDirty = true;
    this._bufferDirty = true;
  }
}

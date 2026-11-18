/**
 * @module SpatialGrid
 * @description Rejilla espacial hash uniforme (celdas de 128 px) Zero-GC para consultas
 * locales O(1) de colisiones sólidas, combates y separación táctica de enemigos.
 * Evita recorrer todas las entidades del mapa o realizar comparaciones O(n²) en hordas.
 * @author Be a Legend Team
 * @version 1.0.0
 */
export class SpatialGrid {
  /**
   * @param {number} [cellSize=128] - Lado de cada celda en píxeles de mundo
   * @param {number} [slotId=0] - Identificador de ranura (0: general, 1: sólidos) para evitar colisión de metadatos
   */
  constructor(cellSize = 128, slotId = 0) {
    this.cellSize = cellSize;
    this._invCellSize = 1 / cellSize;
    /** @type {Map<number, Array<Object>>} Celdas indexadas por entero empaquetado */
    this.cells = new Map();
    this._queryStamp = 0;
    this._boundsProp = `_sgBounds${slotId}`;
    this._stampProp = `_sgStamp${slotId}`;
    this._lxProp = `_sgLx${slotId}`;
    this._lyProp = `_sgLy${slotId}`;
  }

  /**
   * Empaqueta coordenadas enteras de celda `(cx, cy)` en un entero único sin crear strings.
   * @private
   */
  _packKey(cx, cy) {
    return (cy + 2048) * 4096 + (cx + 2048);
  }

  /**
   * Calcula las celdas cubiertas por la caja AABB de la entidad (hitbox o dimensiones).
   * @private
   */
  _computeBounds(entity, out) {
    const hb = typeof entity.getHitbox === 'function' ? entity.getHitbox() : null;
    const x = hb ? hb.x : entity.pos.x;
    const y = hb ? hb.y : entity.pos.y;
    const w = hb ? hb.width : (entity.width || 32);
    const h = hb ? hb.height : (entity.height || 32);

    out.minCx = Math.floor(x * this._invCellSize);
    out.maxCx = Math.floor((x + w) * this._invCellSize);
    out.minCy = Math.floor(y * this._invCellSize);
    out.maxCy = Math.floor((y + h) * this._invCellSize);
  }

  /**
   * Inserta una entidad en las celdas que solapa su hitbox.
   * @param {Object} entity
   */
  insert(entity) {
    if (!entity || !entity.pos) return;
    let b = entity[this._boundsProp];
    if (!b) {
      b = { minCx: 0, maxCx: -1, minCy: 0, maxCy: -1 };
      entity[this._boundsProp] = b;
    } else if (b.minCx <= b.maxCx) {
      this.remove(entity);
    }

    this._computeBounds(entity, b);
    entity[this._lxProp] = entity.pos.x;
    entity[this._lyProp] = entity.pos.y;
    for (let cy = b.minCy; cy <= b.maxCy; cy++) {
      for (let cx = b.minCx; cx <= b.maxCx; cx++) {
        const key = this._packKey(cx, cy);
        let bucket = this.cells.get(key);
        if (!bucket) {
          bucket = [];
          this.cells.set(key, bucket);
        }
        bucket.push(entity);
      }
    }
  }

  /**
   * Actualiza las celdas de una entidad únicamente si cruzó una frontera de celda (O(1) en el 99% de frames).
   * @param {Object} entity
   */
  updateEntity(entity) {
    if (!entity || !entity.pos) return;
    const b = entity[this._boundsProp];
    if (!b || b.minCx > b.maxCx) {
      this.insert(entity);
      return;
    }

    // Retorno O(1) instantáneo para props/arbustos/enemigos estacionarios (evita getHitbox y Math.floor)
    if (entity[this._lxProp] === entity.pos.x && entity[this._lyProp] === entity.pos.y) {
      return;
    }
    entity[this._lxProp] = entity.pos.x;
    entity[this._lyProp] = entity.pos.y;

    const hb = typeof entity.getHitbox === 'function' ? entity.getHitbox() : null;
    const x = hb ? hb.x : entity.pos.x;
    const y = hb ? hb.y : entity.pos.y;
    const w = hb ? hb.width : (entity.width || 32);
    const h = hb ? hb.height : (entity.height || 32);

    const minCx = Math.floor(x * this._invCellSize);
    const maxCx = Math.floor((x + w) * this._invCellSize);
    const minCy = Math.floor(y * this._invCellSize);
    const maxCy = Math.floor((y + h) * this._invCellSize);

    if (minCx === b.minCx && maxCx === b.maxCx && minCy === b.minCy && maxCy === b.maxCy) {
      return;
    }

    this.remove(entity);
    b.minCx = minCx;
    b.maxCx = maxCx;
    b.minCy = minCy;
    b.maxCy = maxCy;

    for (let cy = minCy; cy <= maxCy; cy++) {
      for (let cx = minCx; cx <= maxCx; cx++) {
        const key = this._packKey(cx, cy);
        let bucket = this.cells.get(key);
        if (!bucket) {
          bucket = [];
          this.cells.set(key, bucket);
        }
        bucket.push(entity);
      }
    }
  }

  /**
   * Elimina una entidad de todas sus celdas en O(1) mediante swap-and-pop.
   * @param {Object} entity
   */
  remove(entity) {
    const b = entity && entity[this._boundsProp];
    if (!b || b.minCx > b.maxCx) return;

    for (let cy = b.minCy; cy <= b.maxCy; cy++) {
      for (let cx = b.minCx; cx <= b.maxCx; cx++) {
        const key = this._packKey(cx, cy);
        const bucket = this.cells.get(key);
        if (!bucket) continue;
        const idx = bucket.indexOf(entity);
        if (idx > -1) {
          const last = bucket.length - 1;
          if (idx !== last) bucket[idx] = bucket[last];
          bucket.pop();
        }
      }
    }
    b.minCx = 0;
    b.maxCx = -1;
    b.minCy = 0;
    b.maxCy = -1;
  }

  /**
   * Consulta entidades dentro del rectángulo `[minX, minY, maxX, maxY]` sin alocar arreglos ni Sets.
   * @param {number} minX
   * @param {number} minY
   * @param {number} maxX
   * @param {number} maxY
   * @param {Array<Object>} outBuffer - Buffer reutilizable de salida
   * @returns {Array<Object>} Referencia a `outBuffer`
   */
  queryBounds(minX, minY, maxX, maxY, outBuffer) {
    outBuffer.length = 0;
    const stamp = ++this._queryStamp;
    const stampProp = this._stampProp;

    const minCx = Math.floor(minX * this._invCellSize);
    const maxCx = Math.floor(maxX * this._invCellSize);
    const minCy = Math.floor(minY * this._invCellSize);
    const maxCy = Math.floor(maxY * this._invCellSize);

    for (let cy = minCy; cy <= maxCy; cy++) {
      for (let cx = minCx; cx <= maxCx; cx++) {
        const bucket = this.cells.get(this._packKey(cx, cy));
        if (!bucket || bucket.length === 0) continue;
        for (let i = 0; i < bucket.length; i++) {
          const ent = bucket[i];
          if (ent[stampProp] !== stamp) {
            ent[stampProp] = stamp;
            outBuffer.push(ent);
          }
        }
      }
    }
    return outBuffer;
  }

  /**
   * Limpia todas las celdas de la rejilla espacial.
   */
  clear() {
    this.cells.clear();
  }
}


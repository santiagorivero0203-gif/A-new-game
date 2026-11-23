import { Vector2 } from '../utils/Vector2.js';

/**
 * @module PhysicsSystem
 * @description Sistema de física y colisiones 2D basado en AABB (Axis-Aligned Bounding Box).
 * Resuelve el deslizamiento en paredes evaluando los ejes X e Y de forma desacoplada
 * y reutiliza estructuras de memoria internas para no generar basura en el Garbage Collector.
 * @author Be a Legend Team
 * @version 1.1.0
 */
/** Radios (px) y 8 vectores unitarios para depenetración radial Zero-GC si una entidad queda solapada */
const UNSTICK_RADII = [2, 4, 8, 12, 18, 24, 32];
const UNSTICK_DIRS = [
  1, 0, -1, 0, 0, 1, 0, -1,
  0.7071, 0.7071, -0.7071, 0.7071, 0.7071, -0.7071, -0.7071, -0.7071
];

export class PhysicsSystem {
  /**
   * @param {import('../entities/EntityManager.js').EntityManager} entityManager
   */
  constructor(entityManager) {
    this.entityManager = entityManager;

    /** @private Objeto reutilizable para pruebas de colisión AABB sin asignaciones dinámicas */
    this._testBox = { x: 0, y: 0, width: 0, height: 0 };
    /** @private Vector de retorno reutilizable */
    this._resultPos = new Vector2();
    /** @private Coordenadas reutilizables para clampeo y depenetración Zero-GC */
    this._depenPos = { x: 0, y: 0 };
    this._boundPos = { x: 0, y: 0 };
    /** @private Buffer reutilizable Zero-GC para consultas a SpatialGrid */
    this._solidQueryBuf = [];
    /** @type {{x: number, y: number, width: number, height: number}|null} Límites físicos del nivel */
    this.worldBounds = null;
    /** @type {import('../world/Tilemap.js').Tilemap|null} Mapa lógico para colisiones automáticas con agua, magma y acantilados */
    this.tilemap = null;
  }

  /**
   * Asocia el mapa de losetas activo para bloquear automáticamente el acceso
   * a celdas de agua, magma, vacío astral (`tile === 3`) y acantilados (`tile === 2`).
   * @param {import('../world/Tilemap.js').Tilemap|null} tilemap
   */
  setTilemap(tilemap) {
    this.tilemap = tilemap;
  }

  /**
   * Comprueba si un rectángulo AABB solapa alguna loseta sólida o letal del Tilemap
   * (`tile === 2` acantilado o `tile === 3` agua/lava/vacío), excluyendo puentes (`tile === 4`).
   * @param {{x: number, y: number, width: number, height: number}} rect
   * @returns {boolean}
   */
  isRectBlockedByTilemap(rect) {
    if (!this.tilemap || !Array.isArray(this.tilemap.grid) || this.tilemap.grid.length === 0) {
      return false;
    }

    const ts = this.tilemap.tileSize || 32;
    const inset = Math.min(2, Math.floor(Math.min(rect.width, rect.height) * 0.25));
    const minCol = Math.max(0, Math.floor((rect.x + inset) / ts));
    const maxCol = Math.min(this.tilemap.cols - 1, Math.floor((rect.x + rect.width - inset) / ts));
    const minRow = Math.max(0, Math.floor((rect.y + inset) / ts));
    const maxRow = Math.min(this.tilemap.rows - 1, Math.floor((rect.y + rect.height - inset) / ts));

    for (let r = minRow; r <= maxRow; r++) {
      const row = this.tilemap.grid[r];
      if (!row) continue;
      for (let c = minCol; c <= maxCol; c++) {
        const tile = row[c];
        if (tile === 2 || tile === 3) {
          return true;
        }
      }
    }
    return false;
  }

  /**
   * Define los límites perimetrales absolutos del nivel para impedir fugas fuera del mapa (Out-of-Bounds).
   * @param {{x: number, y: number, width: number, height: number}|null} bounds
   */
  setWorldBounds(bounds) {
    this.worldBounds = bounds;
  }

  /**
   * Detección de colisión entre dos rectángulos AABB.
   * @param {{x: number, y: number, width: number, height: number}} rect1
   * @param {{x: number, y: number, width: number, height: number}} rect2
   * @returns {boolean}
   */
  checkCollision(rect1, rect2) {
    return (
      rect1.x < rect2.x + rect2.width &&
      rect1.x + rect1.width > rect2.x &&
      rect1.y < rect2.y + rect2.height &&
      rect1.y + rect1.height > rect2.y
    );
  }

  /**
   * Determina si existe Línea de Visión (Line of Sight) directa entre dos puntos del mundo
   * sin obstáculos sólidos ni acantilados interpuestos.
   * @param {number} x1 Coordenada X origen
   * @param {number} y1 Coordenada Y origen
   * @param {number} x2 Coordenada X destino
   * @param {number} y2 Coordenada Y destino
   * @returns {boolean} True si no hay muros, pilares o acantilados bloqueando la vista
   */
  hasLineOfSight(x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const dist = Math.hypot(dx, dy);
    if (dist <= 18) return true;

    const minSegX = Math.min(x1, x2) - 8;
    const maxSegX = Math.max(x1, x2) + 8;
    const minSegY = Math.min(y1, y2) - 8;
    const maxSegY = Math.max(y1, y2) + 8;

    const solids = this.entityManager
      ? (typeof this.entityManager.queryNearbySolids === 'function'
          ? this.entityManager.queryNearbySolids(minSegX, minSegY, maxSegX, maxSegY, this._solidQueryBuf)
          : (this.entityManager.solidGrid
              ? this.entityManager.solidGrid.queryBounds(minSegX, minSegY, maxSegX, maxSegY, this._solidQueryBuf)
              : this.entityManager.getSolids()))
      : null;
    const hasTilemap = Boolean(this.tilemap && typeof this.tilemap.getTile === 'function');
    if ((!solids || solids.length === 0) && !hasTilemap) return true;

    const tileSize = hasTilemap ? (this.tilemap.tileSize || 32) : 32;

    const steps = Math.ceil(dist / 16);
    const stepX = dx / steps;
    const stepY = dy / steps;

    for (let i = 1; i < steps; i++) {
      const cx = x1 + stepX * i;
      const cy = y1 + stepY * i;

      // Los acantilados elevados (tile === 2) bloquean la visión, mientras el agua/puentes no
      if (hasTilemap) {
        const col = Math.floor(cx / tileSize);
        const row = Math.floor(cy / tileSize);
        if (this.tilemap.getTile(col, row) === 2) {
          return false;
        }
      }

      if (solids && solids.length > 0) {
        for (let s = 0; s < solids.length; s++) {
          const b = solids[s];
          if (!b || b.isDead || b.isConsumed) continue;
          if (b.pos && (b.pos.x + b.width < minSegX || b.pos.x > maxSegX || b.pos.y + b.height < minSegY || b.pos.y > maxSegY)) {
            continue;
          }
          if (typeof b.hasTag === 'function' && (b.hasTag('enemy') || b.hasTag('player'))) {
            continue;
          }
          const hb = typeof b.getHitbox === 'function' ? b.getHitbox() : b;
          if (hb && cx >= hb.x && cx <= hb.x + hb.width && cy >= hb.y && cy <= hb.y + hb.height) {
            return false;
          }
        }
      }
    }
    return true;
  }

  /**
   * Limita una posición propuesta de entidad a `worldBounds` sin asignaciones de memoria.
   * @private
   */
  _clampToWorldBounds(entity, x, y, hbWidth, hbHeight, out) {
    let cx = x;
    let cy = y;
    if (this.worldBounds) {
      const minX = this.worldBounds.x - entity.hitbox.offsetX;
      const maxX = this.worldBounds.x + this.worldBounds.width - entity.hitbox.offsetX - hbWidth;
      const minY = this.worldBounds.y - entity.hitbox.offsetY;
      const maxY = this.worldBounds.y + this.worldBounds.height - entity.hitbox.offsetY - hbHeight;
      if (cx < minX) cx = minX;
      if (cx > maxX) cx = maxX;
      if (cy < minY) cy = minY;
      if (cy > maxY) cy = maxY;
    }
    out.x = cx;
    out.y = cy;
    return out;
  }

  /**
   * Consulta los sólidos cercanos en la banda AABB especificada reutilizando `_solidQueryBuf`.
   * @private
   */
  _querySolidsInRect(minX, minY, maxX, maxY) {
    if (!this.entityManager) return [];
    if (typeof this.entityManager.queryNearbySolids === 'function') {
      return this.entityManager.queryNearbySolids(minX, minY, maxX, maxY, this._solidQueryBuf);
    }
    if (this.entityManager.solidGrid) {
      return this.entityManager.solidGrid.queryBounds(minX, minY, maxX, maxY, this._solidQueryBuf);
    }
    return this.entityManager.getSolids();
  }

  /**
   * Evalúa si el hitbox de `entity` ubicado en `(candX, candY)` choca contra sólidos o losetas 2/3.
   * @private
   */
  _isBoxBlocked(entity, candX, candY, hbWidth, hbHeight, solids, minSweepX, minSweepY, maxSweepX, maxSweepY) {
    const testBox = this._testBox;
    testBox.x = candX + entity.hitbox.offsetX;
    testBox.y = candY + entity.hitbox.offsetY;
    testBox.width = hbWidth;
    testBox.height = hbHeight;

    for (let i = 0; i < solids.length; i++) {
      const solid = solids[i];
      if (!solid || solid === entity || solid.isDead || !solid.hasTag('solid')) continue;
      if (
        solid.pos.x + solid.width < minSweepX ||
        solid.pos.x > maxSweepX ||
        solid.pos.y + solid.height < minSweepY ||
        solid.pos.y > maxSweepY
      ) {
        continue;
      }
      if (this.checkCollision(testBox, solid.getHitbox())) {
        return true;
      }
    }
    return this.isRectBlockedByTilemap(testBox);
  }

  /**
   * Resuelve atrapamientos si `entity` quedó mínimamente incrustada en un muro, roca o borde:
   * primero comprueba si `(targetX, targetY)` ya está libre y si no busca un escape radial cercano.
   * @private
   */
  _tryDepenetrate(entity, curX, curY, targetX, targetY, hbWidth, hbHeight) {
    const depenPad = 36;
    const minQx = Math.min(curX, targetX) + entity.hitbox.offsetX - depenPad;
    const maxQx = Math.max(curX, targetX) + entity.hitbox.offsetX + hbWidth + depenPad;
    const minQy = Math.min(curY, targetY) + entity.hitbox.offsetY - depenPad;
    const maxQy = Math.max(curY, targetY) + entity.hitbox.offsetY + hbHeight + depenPad;
    const nearSolids = this._querySolidsInRect(minQx, minQy, maxQx, maxQy);

    if (!this._isBoxBlocked(entity, targetX, targetY, hbWidth, hbHeight, nearSolids, minQx, minQy, maxQx, maxQy)) {
      this._depenPos.x = targetX;
      this._depenPos.y = targetY;
      return this._depenPos;
    }

    const boundOut = this._boundPos;
    for (let r = 0; r < UNSTICK_RADII.length; r++) {
      const rad = UNSTICK_RADII[r];
      for (let d = 0; d < UNSTICK_DIRS.length; d += 2) {
        const rawX = curX + UNSTICK_DIRS[d] * rad;
        const rawY = curY + UNSTICK_DIRS[d + 1] * rad;
        this._clampToWorldBounds(entity, rawX, rawY, hbWidth, hbHeight, boundOut);
        if (!this._isBoxBlocked(entity, boundOut.x, boundOut.y, hbWidth, hbHeight, nearSolids, minQx, minQy, maxQx, maxQy)) {
          this._depenPos.x = boundOut.x;
          this._depenPos.y = boundOut.y;
          return this._depenPos;
        }
      }
    }

    this._depenPos.x = curX;
    this._depenPos.y = curY;
    return this._depenPos;
  }

  /**
   * Resuelve el movimiento continuo de una entidad mediante sub-pasos (<= 8 px) para prevenir tunneling
   * en esquivas/embestidas y depenetración automática para evitar atrapamientos permanentes.
   * Evalúa los ejes X e Y por separado con intento de medio-paso para deslizamiento fluido contra muros.
   * @param {import('../entities/Entity.js').Entity} entity - Entidad que se desplaza
   * @param {number} targetX - Coordenada X destino
   * @param {number} targetY - Coordenada Y destino
   * @returns {Vector2} Coordenadas finales seguras (referencia reutilizable Zero-GC)
   */
  moveWithCollisions(entity, targetX, targetY) {
    const originalHitbox = entity.getHitbox();
    const hbWidth = originalHitbox.width;
    const hbHeight = originalHitbox.height;

    // 0. Clamping estricto a los límites del mundo (impide colarse entre árboles perimetrales)
    const clampedTarget = this._clampToWorldBounds(entity, targetX, targetY, hbWidth, hbHeight, this._boundPos);
    const goalX = clampedTarget.x;
    const goalY = clampedTarget.y;

    let curX = entity.pos.x;
    let curY = entity.pos.y;
    const curHbX = curX + entity.hitbox.offsetX;
    const curHbY = curY + entity.hitbox.offsetY;
    const goalHbX = goalX + entity.hitbox.offsetX;
    const goalHbY = goalY + entity.hitbox.offsetY;

    const minSweepX = (goalHbX < curHbX ? goalHbX : curHbX) - 6;
    const maxSweepX = (goalHbX > curHbX ? goalHbX : curHbX) + hbWidth + 6;
    const minSweepY = (goalHbY < curHbY ? goalHbY : curHbY) - 6;
    const maxSweepY = (goalHbY > curHbY ? goalHbY : curHbY) + hbHeight + 6;
    const solids = this._querySolidsInRect(minSweepX, minSweepY, maxSweepX, maxSweepY);

    // 1. Recuperación anti-atrapamiento si la posición inicial ya solapa un obstáculo/losa sólida
    if (this._isBoxBlocked(entity, curX, curY, hbWidth, hbHeight, solids, minSweepX, minSweepY, maxSweepX, maxSweepY)) {
      const escaped = this._tryDepenetrate(entity, curX, curY, goalX, goalY, hbWidth, hbHeight);
      this._resultPos.x = escaped.x;
      this._resultPos.y = escaped.y;
      return this._resultPos;
    }

    // 2. Sub-pasos seguros (<= 8 px por segmento, máx 16) para evitar tunneling en dashes, dives o embestidas
    const totalDx = goalX - curX;
    const totalDy = goalY - curY;
    const maxDelta = Math.max(Math.abs(totalDx), Math.abs(totalDy));
    if (maxDelta === 0) {
      this._resultPos.x = curX;
      this._resultPos.y = curY;
      return this._resultPos;
    }

    const steps = maxDelta > 8 ? Math.min(16, Math.ceil(maxDelta / 8)) : 1;
    const stepX = totalDx / steps;
    const stepY = totalDy / steps;

    for (let s = 0; s < steps; s++) {
      let collidedX = false;
      if (stepX !== 0) {
        const candX = curX + stepX;
        if (!this._isBoxBlocked(entity, candX, curY, hbWidth, hbHeight, solids, minSweepX, minSweepY, maxSweepX, maxSweepY)) {
          curX = candX;
        } else if (Math.abs(stepX) > 2 && !this._isBoxBlocked(entity, curX + stepX * 0.5, curY, hbWidth, hbHeight, solids, minSweepX, minSweepY, maxSweepX, maxSweepY)) {
          curX += stepX * 0.5;
        } else {
          collidedX = true;
        }
      }

      let collidedY = false;
      if (stepY !== 0) {
        const candY = curY + stepY;
        if (!this._isBoxBlocked(entity, curX, candY, hbWidth, hbHeight, solids, minSweepX, minSweepY, maxSweepX, maxSweepY)) {
          curY = candY;
        } else if (Math.abs(stepY) > 2 && !this._isBoxBlocked(entity, curX, curY + stepY * 0.5, hbWidth, hbHeight, solids, minSweepX, minSweepY, maxSweepX, maxSweepY)) {
          curY += stepY * 0.5;
        } else {
          collidedY = true;
        }
      }

      if (collidedX && collidedY) break;
    }

    this._resultPos.x = curX;
    this._resultPos.y = curY;
    return this._resultPos;
  }
}

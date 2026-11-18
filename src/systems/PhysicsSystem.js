import { Vector2 } from '../utils/Vector2.js';

/**
 * @module PhysicsSystem
 * @description Sistema de física y colisiones 2D basado en AABB (Axis-Aligned Bounding Box).
 * Resuelve el deslizamiento en paredes evaluando los ejes X e Y de forma desacoplada
 * y reutiliza estructuras de memoria internas para no generar basura en el Garbage Collector.
 * @author Be a Legend Team
 * @version 1.1.0
 */
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
   * Resuelve el movimiento de una entidad permitiendo deslizarse contra muros.
   * Incluye broadphase espacial por proximidad AABB para descartar obstáculos lejanos en O(1).
   * Evalúa el eje X primero; si colisiona, cancela solo el movimiento en X.
   * Luego evalúa el eje Y; si colisiona, cancela solo el movimiento en Y.
   * @param {import('../entities/Entity.js').Entity} entity - Entidad que se desplaza
   * @param {number} targetX - Coordenada X destino
   * @param {number} targetY - Coordenada Y destino
   * @returns {Vector2} Coordenadas finales seguras
   */
  moveWithCollisions(entity, targetX, targetY) {
    let finalX = targetX;
    let finalY = targetY;

    const originalHitbox = entity.getHitbox();
    const testBox = this._testBox;
    testBox.width = originalHitbox.width;
    testBox.height = originalHitbox.height;

    // 0. Clamping estricto a los límites del mundo (impide colarse entre árboles perimetrales)
    if (this.worldBounds) {
      const minX = this.worldBounds.x - entity.hitbox.offsetX;
      const maxX = this.worldBounds.x + this.worldBounds.width - entity.hitbox.offsetX - originalHitbox.width;
      const minY = this.worldBounds.y - entity.hitbox.offsetY;
      const maxY = this.worldBounds.y + this.worldBounds.height - entity.hitbox.offsetY - originalHitbox.height;
      if (finalX < minX) finalX = minX;
      if (finalX > maxX) finalX = maxX;
      if (finalY < minY) finalY = minY;
      if (finalY > maxY) finalY = maxY;
    }

    // Límites amplios del desplazamiento actual para consulta espacial local O(1) en SpatialGrid
    const curHbX = entity.pos.x + entity.hitbox.offsetX;
    const curHbY = entity.pos.y + entity.hitbox.offsetY;
    const minSweepX = (finalX + entity.hitbox.offsetX < curHbX ? finalX + entity.hitbox.offsetX : curHbX) - 4;
    const maxSweepX = (finalX + entity.hitbox.offsetX > curHbX ? finalX + entity.hitbox.offsetX : curHbX) + originalHitbox.width + 4;
    const minSweepY = (finalY + entity.hitbox.offsetY < curHbY ? finalY + entity.hitbox.offsetY : curHbY) - 4;
    const maxSweepY = (finalY + entity.hitbox.offsetY > curHbY ? finalY + entity.hitbox.offsetY : curHbY) + originalHitbox.height + 4;

    const solids = (typeof this.entityManager.queryNearbySolids === 'function')
      ? this.entityManager.queryNearbySolids(minSweepX, minSweepY, maxSweepX, maxSweepY, this._solidQueryBuf)
      : (this.entityManager.solidGrid
          ? this.entityManager.solidGrid.queryBounds(minSweepX, minSweepY, maxSweepX, maxSweepY, this._solidQueryBuf)
          : this.entityManager.getSolids());

    // 1. Probar colisión en el eje X
    testBox.x = finalX + entity.hitbox.offsetX;
    testBox.y = curHbY;

    let collidedX = false;
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
        collidedX = true;
        break;
      }
    }
    // Bloquear estricto contra agua (3) y acantilados (2): impide cruzar ríos fuera de puentes
    if (!collidedX && this.isRectBlockedByTilemap(testBox)) {
      collidedX = true;
    }

    if (collidedX) {
      finalX = entity.pos.x; // Revertir avance en X
    }

    // 2. Probar colisión en el eje Y (con la posición X ya resuelta)
    testBox.x = finalX + entity.hitbox.offsetX;
    testBox.y = finalY + entity.hitbox.offsetY;

    let collidedY = false;
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
        collidedY = true;
        break;
      }
    }
    // Bloquear estricto contra agua (3) y acantilados (2): impide caerse de puentes o penetrar riberas
    if (!collidedY && this.isRectBlockedByTilemap(testBox)) {
      collidedY = true;
    }

    if (collidedY) {
      finalY = entity.pos.y; // Revertir avance en Y
    }

    this._resultPos.x = finalX;
    this._resultPos.y = finalY;
    return this._resultPos;
  }
}

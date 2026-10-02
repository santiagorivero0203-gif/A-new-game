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
   * Resuelve el movimiento de una entidad permitiendo deslizarse contra muros.
   * Evalúa el eje X primero; si colisiona, cancela solo el movimiento en X.
   * Luego evalúa el eje Y; si colisiona, cancela solo el movimiento en Y.
   * @param {import('../entities/Entity.js').Entity} entity - Entidad que se desplaza
   * @param {number} targetX - Coordenada X destino
   * @param {number} targetY - Coordenada Y destino
   * @returns {Vector2} Coordenadas finales seguras
   */
  moveWithCollisions(entity, targetX, targetY) {
    const solids = this.entityManager.getSolids();
    let finalX = targetX;
    let finalY = targetY;

    const originalHitbox = entity.getHitbox();
    const testBox = this._testBox;
    testBox.width = originalHitbox.width;
    testBox.height = originalHitbox.height;

    // 1. Probar colisión en el eje X
    testBox.x = finalX + entity.hitbox.offsetX;
    testBox.y = entity.pos.y + entity.hitbox.offsetY;

    let collidedX = false;
    for (let i = 0; i < solids.length; i++) {
      const solid = solids[i];
      if (solid === entity) continue;

      if (this.checkCollision(testBox, solid.getHitbox())) {
        collidedX = true;
        break;
      }
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
      if (solid === entity) continue;

      if (this.checkCollision(testBox, solid.getHitbox())) {
        collidedY = true;
        break;
      }
    }

    if (collidedY) {
      finalY = entity.pos.y; // Revertir avance en Y
    }

    this._resultPos.x = finalX;
    this._resultPos.y = finalY;
    return this._resultPos;
  }
}

import { Vector2 } from '../utils/Vector2.js';

export class PhysicsSystem {
  constructor(entityManager) {
    this.entityManager = entityManager;
  }

  // AABB Collision Detection
  checkCollision(rect1, rect2) {
    return (
      rect1.x < rect2.x + rect2.width &&
      rect1.x + rect1.width > rect2.x &&
      rect1.y < rect2.y + rect2.height &&
      rect1.y + rect1.height > rect2.y
    );
  }

  moveWithCollisions(entity, targetX, targetY) {
    const solids = this.entityManager.getSolids().filter(e => e !== entity);
    let finalX = targetX;
    let finalY = targetY;

    const originalHitbox = entity.getHitbox();

    // Check X axis
    const testHitboxX = { ...originalHitbox, x: finalX + entity.hitbox.offsetX };
    let collidedX = false;
    for (const solid of solids) {
      if (this.checkCollision(testHitboxX, solid.getHitbox())) {
        collidedX = true;
        break;
      }
    }

    if (collidedX) {
      finalX = entity.pos.x; // Revert X
    }

    // Check Y axis
    const testHitboxY = { 
      ...originalHitbox, 
      x: finalX + entity.hitbox.offsetX, // Use updated X 
      y: finalY + entity.hitbox.offsetY 
    };
    
    let collidedY = false;
    for (const solid of solids) {
      if (this.checkCollision(testHitboxY, solid.getHitbox())) {
        collidedY = true;
        break;
      }
    }

    if (collidedY) {
      finalY = entity.pos.y; // Revert Y
    }

    return new Vector2(finalX, finalY);
  }
}

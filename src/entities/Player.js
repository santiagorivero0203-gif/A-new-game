import { Entity } from './Entity.js';
import { Vector2 } from '../utils/Vector2.js';

export class Player extends Entity {
  constructor(x, y) {
    super(x, y, 32, 32); // "Chibi" proportions placeholder
    this.color = '#4CAF50';
    this.tags.push('player');
    
    this.speed = 150; // pixels per second
    this.velocity = new Vector2(0, 0);
  }

  update(deltaTime, inputManager, physicsSystem) {
    this.velocity.set(0, 0);

    if (inputManager.isKeyPressed('KeyW')) this.velocity.y -= 1;
    if (inputManager.isKeyPressed('KeyS')) this.velocity.y += 1;
    if (inputManager.isKeyPressed('KeyA')) this.velocity.x -= 1;
    if (inputManager.isKeyPressed('KeyD')) this.velocity.x += 1;

    // Normalize to prevent faster diagonal movement
    this.velocity.normalize();
    this.velocity.multiplyScalar(this.speed * deltaTime);

    // Tentative new position
    const nextX = this.pos.x + this.velocity.x;
    const nextY = this.pos.y + this.velocity.y;

    // Resolve Collisions
    const finalPos = physicsSystem.moveWithCollisions(this, nextX, nextY);
    this.pos.set(finalPos.x, finalPos.y);
  }
}

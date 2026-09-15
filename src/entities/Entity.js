import { Vector2 } from '../utils/Vector2.js';

export class Entity {
  constructor(x, y, width, height) {
    this.pos = new Vector2(x, y);
    this.width = width;
    this.height = height;
    
    this.color = 'gray'; // Placeholder
    
    this.tags = []; // e.g. 'solid', 'player', 'npc'

    // Adjusted Hitbox for Top-Down (only lower half)
    this.hitbox = {
      offsetX: 0,
      offsetY: height / 2,
      width: width,
      height: height / 2
    };
  }

  update(deltaTime) {
    // Override in subclasses
  }

  draw(ctx) {
    // Placeholder rectangle
    ctx.fillStyle = this.color;
    ctx.fillRect(this.pos.x, this.pos.y, this.width, this.height);
  }

  getHitbox() {
    return {
      x: this.pos.x + this.hitbox.offsetX,
      y: this.pos.y + this.hitbox.offsetY,
      width: this.hitbox.width,
      height: this.hitbox.height
    };
  }

  hasTag(tag) {
    return this.tags.includes(tag);
  }
}

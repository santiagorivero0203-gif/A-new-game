import { Vector2 } from '../utils/Vector2.js';

export class Camera {
  constructor(viewportWidth, viewportHeight) {
    this.pos = new Vector2(0, 0);
    this.viewportWidth = viewportWidth;
    this.viewportHeight = viewportHeight;
    this.lerpFactor = 5.0; // Lerp speed
    this.roomBounds = null; // { x, y, width, height }
  }

  setRoomBounds(bounds) {
    this.roomBounds = bounds;
  }

  update(targetPos, deltaTime) {
    // Target position is centered on the viewport
    const targetX = targetPos.x - this.viewportWidth / 2;
    const targetY = targetPos.y - this.viewportHeight / 2;

    // LERP
    this.pos.x += (targetX - this.pos.x) * this.lerpFactor * deltaTime;
    this.pos.y += (targetY - this.pos.y) * this.lerpFactor * deltaTime;

    // Room clamping
    if (this.roomBounds) {
      const minX = this.roomBounds.x;
      const minY = this.roomBounds.y;
      const maxX = this.roomBounds.x + this.roomBounds.width - this.viewportWidth;
      const maxY = this.roomBounds.y + this.roomBounds.height - this.viewportHeight;

      if (this.pos.x < minX) this.pos.x = minX;
      if (this.pos.y < minY) this.pos.y = minY;
      if (maxX >= minX && this.pos.x > maxX) this.pos.x = maxX;
      if (maxY >= minY && this.pos.y > maxY) this.pos.y = maxY;
    }
  }

  applyTransform(ctx) {
    ctx.save();
    ctx.translate(-Math.floor(this.pos.x), -Math.floor(this.pos.y));
  }

  restoreTransform(ctx) {
    ctx.restore();
  }
}

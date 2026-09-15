export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
  }

  clear() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  begin(camera) {
    this.clear();
    camera.applyTransform(this.ctx);
  }

  end(camera) {
    camera.restoreTransform(this.ctx);
  }

  drawEntities(entities) {
    // Entities should already be Y-Sorted by the EntityManager
    entities.forEach(entity => {
      entity.draw(this.ctx);
    });
  }

  // Debug drawing for colliders
  drawColliders(entities) {
    entities.forEach(entity => {
      if (entity.hitbox) {
        this.ctx.strokeStyle = 'red';
        this.ctx.strokeRect(
          entity.pos.x + entity.hitbox.offsetX,
          entity.pos.y + entity.hitbox.offsetY,
          entity.hitbox.width,
          entity.hitbox.height
        );
      }
    });
  }
}

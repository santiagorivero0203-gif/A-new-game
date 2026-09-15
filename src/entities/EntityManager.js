export class EntityManager {
  constructor() {
    this.entities = [];
  }

  addEntity(entity) {
    this.entities.push(entity);
  }

  removeEntity(entity) {
    const index = this.entities.indexOf(entity);
    if (index > -1) {
      this.entities.splice(index, 1);
    }
  }

  update(deltaTime, inputManager, physicsSystem, stateManager) {
    this.entities.forEach(entity => {
      entity.update(deltaTime, inputManager, physicsSystem, stateManager);
    });
  }

  getEntities() {
    // Y-Sorting: Order entities by their Y coordinate (plus their height so it sorts by feet)
    // Using hitbox bottom for more accurate depth sorting
    return this.entities.slice().sort((a, b) => {
      const aBottom = a.pos.y + a.hitbox.offsetY + a.hitbox.height;
      const bBottom = b.pos.y + b.hitbox.offsetY + b.hitbox.height;
      return aBottom - bBottom;
    });
  }

  getSolids() {
    return this.entities.filter(e => e.hasTag('solid'));
  }
}

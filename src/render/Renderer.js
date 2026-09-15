/**
 * @module Renderer
 * @description Administrador del contexto gráfico principal para el dibujo de la escena.
 * Controla el ciclo begin/end de la cámara, el pintado de entidades ordenadas por profundidad
 * y utilidades de depuración visual de hitboxes (cajas de colisión).
 * @author Be a Legend Team
 * @version 1.1.0
 */
export class Renderer {
  /**
   * @param {HTMLCanvasElement} canvas
   */
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
  }

  /**
   * Limpia el canvas principal antes de iniciar el nuevo fotograma.
   */
  clear() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  /**
   * Prepara el canvas y aplica la matriz de transformación de la cámara.
   * @param {import('./Camera.js').Camera} camera
   */
  begin(camera) {
    this.clear();
    camera.applyTransform(this.ctx);
  }

  /**
   * Restaura la transformación de la cámara al finalizar el dibujado de elementos del mundo.
   * @param {import('./Camera.js').Camera} camera
   */
  end(camera) {
    camera.restoreTransform(this.ctx);
  }

  /**
   * Dibuja la lista de entidades en pantalla.
   * Se asume que vienen ordenadas por Y-Sort desde el EntityManager.
   * @param {Array<import('../entities/Entity.js').Entity>} entities
   */
  drawEntities(entities) {
    for (let i = 0; i < entities.length; i++) {
      entities[i].draw(this.ctx);
    }
  }

  /**
   * Dibuja los límites de colisión de las entidades para depuración.
   * @param {Array<import('../entities/Entity.js').Entity>} entities
   */
  drawColliders(entities) {
    this.ctx.save();
    this.ctx.strokeStyle = '#FF3B30';
    this.ctx.lineWidth = 1;

    for (let i = 0; i < entities.length; i++) {
      const entity = entities[i];
      const hitbox = entity.getHitbox();
      this.ctx.strokeRect(hitbox.x, hitbox.y, hitbox.width, hitbox.height);
    }

    this.ctx.restore();
  }
}

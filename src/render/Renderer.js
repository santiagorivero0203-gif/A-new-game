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
    this.ctx.imageSmoothingEnabled = false;
  }

  /**
   * Reestablece el suavizado de imagen en false tras cualquier cambio de dimensiones del canvas.
   */
  resize() {
    this.ctx.imageSmoothingEnabled = false;
  }

  /**
   * Limpia el canvas principal antes de iniciar el nuevo fotograma.
   * Utiliza las dimensiones reales del canvas.
   */
  clear() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  /**
   * Prepara el canvas y aplica la matriz de transformación de la cámara.
   * Asegura que el modo pixel-perfect (imageSmoothingEnabled = false) permanezca activo.
   * @param {import('./Camera.js').Camera} camera
   */
  begin(camera) {
    this.clear();
    this.ctx.imageSmoothingEnabled = false;
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
   * Dibuja la lista de entidades en pantalla aplicando Frustum Culling de cámara
   * para descartar entidades fuera del campo visual y sostener 60/120 FPS estables.
   * Se asume que vienen ordenadas por Y-Sort desde el EntityManager.
   * @param {Array<import('../entities/Entity.js').Entity>} entities
   * @param {import('./Camera.js').Camera|null} [camera=null]
   */
  /**
   * Renderiza entidades ordenadas por Y aplicando Frustum Culling de cámara.
   * @param {Array<Object>} entities
   * @param {import('./Camera.js').Camera|null} [camera=null]
   * @param {import('./LightManager.js').LightManager|null} [lightManager=null]
   */
  drawEntities(entities, camera = null, lightManager = null) {
    const bounds = (camera && typeof camera.getVisibleWorldBounds === 'function')
      ? camera.getVisibleWorldBounds(112)
      : null;

    const ctx = this.ctx;
    for (let i = 0; i < entities.length; i++) {
      const ent = entities[i];
      if (bounds) {
        if (
          ent.pos.x + ent.width < bounds.minX ||
          ent.pos.x > bounds.maxX ||
          ent.pos.y + ent.height < bounds.minY ||
          ent.pos.y > bounds.maxY
        ) {
          continue;
        }
      }

      const tags = ent.tags || [];
      let skipShadow = ent.propType === 'cave_mouth' || ent.propType === 'world_portal';
      if (!skipShadow) {
        for (let t = 0; t < tags.length; t++) {
          const tag = tags[t];
          if (tag === 'tree' || tag === 'house' || tag === 'terrain_barrier') {
            skipShadow = true;
            break;
          }
        }
      }

      if (!skipShadow) {
        const sw = Math.min(34, Math.max(16, Math.round(ent.width * 0.56)));
        const sx = Math.round(ent.pos.x + ent.width * 0.5 - sw * 0.5);
        const sy = Math.round(ent.pos.y + ent.height - 3);
        ctx.fillStyle = 'rgba(11, 16, 35, 0.28)';
        ctx.fillRect(sx, sy, sw, 2);
        ctx.fillRect(sx + 2, sy + 2, Math.max(8, sw - 4), 1);
      }

      ent.draw(ctx);
    }
  }

  /**
   * Proyecta sombras pixel-art suaves de dosel vegetal en dos tonos bajo cada árbol visible.
   * @param {Array<Object>} entities
   * @param {import('./Camera.js').Camera|null} [camera=null]
   * @param {number} [time=0] - Reloj continuo en segundos.
   */
  drawCanopyShadows(entities, camera = null, time = 0) {
    const bounds = (camera && typeof camera.getVisibleWorldBounds === 'function')
      ? camera.getVisibleWorldBounds(140)
      : null;

    const ctx = this.ctx;
    const sway = Math.round(Math.sin(time * 0.75) * 2);

    for (let i = 0; i < entities.length; i++) {
      const ent = entities[i];
      if (!ent || !ent.tags) continue;
      let isTree = false;
      for (let t = 0; t < ent.tags.length; t++) {
        if (ent.tags[t] === 'tree') {
          isTree = true;
          break;
        }
      }
      if (!isTree) continue;

      if (bounds) {
        if (
          ent.pos.x + ent.width < bounds.minX ||
          ent.pos.x > bounds.maxX ||
          ent.pos.y + ent.height < bounds.minY ||
          ent.pos.y > bounds.maxY
        ) {
          continue;
        }
      }

      const cx = Math.round(ent.pos.x + ent.width * 0.5 + sway);
      const cy = Math.round(ent.pos.y + ent.height - 10);

      // Óvalo pixel-art escalonado exterior (64x14 + 56x18)
      ctx.fillStyle = 'rgba(12, 20, 48, 0.22)';
      ctx.fillRect(cx - 32, cy - 7, 64, 14);
      ctx.fillRect(cx - 28, cy - 9, 56, 18);

      // Núcleo de sombra interior densa
      ctx.fillStyle = 'rgba(12, 20, 48, 0.14)';
      ctx.fillRect(cx - 22, cy - 5, 44, 10);
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

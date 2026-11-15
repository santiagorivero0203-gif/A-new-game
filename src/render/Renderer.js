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
   * Renderiza los conos de visión y telégrafos terrestres de enemigos visibles en la capa de suelo,
   * ANTES de dibujar cuerpos Y-Sort, asegurando que queden bajo arbustos, props y personajes.
   * @param {Array<Object>} entities
   * @param {import('./Camera.js').Camera|null} [camera=null]
   */
  drawEnemyGroundDecals(entities, camera = null) {
    const bounds = (camera && typeof camera.getVisibleWorldBounds === 'function')
      ? camera.getVisibleWorldBounds(240)
      : null;

    const ctx = this.ctx;
    for (let i = 0; i < entities.length; i++) {
      const ent = entities[i];
      if (!ent || ent.active === false || ent.isDead || typeof ent.drawVisionCone !== 'function') {
        continue;
      }
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
      ent.drawVisionCone(ctx);
    }
  }

  /**
   * Renderiza entidades ordenadas por Y aplicando Frustum Culling de cámara.
   * Cada entidad dibuja su propia sombra a medida, eliminando sombras genéricas duplicadas.
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
      if (!ent || ent.active === false) continue;

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

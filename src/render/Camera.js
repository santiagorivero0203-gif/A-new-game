import { Vector2 } from '../utils/Vector2.js';

/**
 * @module Camera
 * @description Sistema de cámara 2D con suavizado LERP, delimitación por salas (clamping)
 * y transformaciones bidireccionales entre coordenadas del mundo y coordenadas de pantalla.
 * @author Be a Legend Team
 * @version 1.1.0
 */
export class Camera {
  /**
   * @param {number} viewportWidth - Ancho del viewport en píxeles
   * @param {number} viewportHeight - Alto del viewport en píxeles
   */
  constructor(viewportWidth, viewportHeight) {
    /** @type {Vector2} Posición de la esquina superior izquierda del viewport en el mundo */
    this.pos = new Vector2(0, 0);

    this.viewportWidth = viewportWidth;
    this.viewportHeight = viewportHeight;

    /** @type {number} Velocidad del suavizado LERP */
    this.lerpFactor = 5.0;

    /** @type {{x: number, y: number, width: number, height: number}|null} */
    this.roomBounds = null;

    /** @private Reutilización de vectores para transformaciones de coordenadas */
    this._screenCache = new Vector2();
    this._worldCache = new Vector2();
  }

  /**
   * Define los límites de la sala o mapa actual para evitar mostrar vacíos fuera del nivel.
   * @param {{x: number, y: number, width: number, height: number}|null} bounds
   */
  setRoomBounds(bounds) {
    this.roomBounds = bounds;
  }

  /**
   * Actualiza las dimensiones del viewport en caso de redimensionamiento de ventana.
   * @param {number} width
   * @param {number} height
   */
  setViewportSize(width, height) {
    this.viewportWidth = width;
    this.viewportHeight = height;
  }

  /**
   * Desplaza la cámara suavemente siguiendo al objetivo centrado en el viewport.
   * @param {Vector2|{x: number, y: number}} targetPos - Posición en el mundo del objetivo
   * @param {number} deltaTime - Tiempo del frame en segundos
   */
  update(targetPos, deltaTime) {
    const targetX = targetPos.x - this.viewportWidth / 2;
    const targetY = targetPos.y - this.viewportHeight / 2;

    // LERP exponencial dependiente de deltaTime
    const factor = Math.min(1, this.lerpFactor * deltaTime);
    this.pos.x += (targetX - this.pos.x) * factor;
    this.pos.y += (targetY - this.pos.y) * factor;

    // Clamping de límites de sala
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

  /**
   * STD-04 FIX: Convierte coordenadas del mundo a coordenadas del viewport (pantalla).
   * @param {{x: number, y: number}} worldPos
   * @returns {Vector2} Coordenadas en pantalla
   */
  worldToScreen(worldPos) {
    this._screenCache.x = worldPos.x - Math.floor(this.pos.x);
    this._screenCache.y = worldPos.y - Math.floor(this.pos.y);
    return this._screenCache;
  }

  /**
   * STD-04 FIX: Convierte coordenadas de pantalla (ej. clicks de ratón) a coordenadas del mundo.
   * @param {{x: number, y: number}} screenPos
   * @returns {Vector2} Coordenadas en el mundo
   */
  screenToWorld(screenPos) {
    this._worldCache.x = screenPos.x + Math.floor(this.pos.x);
    this._worldCache.y = screenPos.y + Math.floor(this.pos.y);
    return this._worldCache;
  }

  /**
   * Aplica la traslación de la cámara sobre el contexto 2D antes del render.
   * Utiliza Math.floor para evitar sub-pixel sampling borroso en pixel art.
   * @param {CanvasRenderingContext2D} ctx
   */
  applyTransform(ctx) {
    ctx.save();
    ctx.translate(-Math.floor(this.pos.x), -Math.floor(this.pos.y));
  }

  /**
   * Restaura el estado previo del contexto tras completar el render de la escena.
   * @param {CanvasRenderingContext2D} ctx
   */
  restoreTransform(ctx) {
    ctx.restore();
  }
}

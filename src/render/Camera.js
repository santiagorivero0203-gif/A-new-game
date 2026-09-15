import { Vector2 } from '../utils/Vector2.js';

/**
 * @module Camera
 * @description Sistema de cámara 2D cinemática con zoom dinámico, suavizado LERP exponencial,
 * Screen Shake basado en trauma cuadrático para impactos fuertes, y Room Clamping
 * que previene visualización de vacíos exteriores sin importar la escala de zoom.
 * @author Be a Legend Team
 * @version 1.4.0
 */
export class Camera {
  /**
   * @param {number} viewportWidth - Ancho del viewport en píxeles
   * @param {number} viewportHeight - Alto del viewport en píxeles
   */
  constructor(viewportWidth, viewportHeight) {
    /** @type {Vector2} Coordenada mundial del centro de atención de la cámara */
    this.pos = new Vector2(0, 0);

    this.viewportWidth = viewportWidth;
    this.viewportHeight = viewportHeight;

    /** @type {number} Nivel de zoom cinemático (1.45x para encuadre cercano y detalle chibi) */
    this.zoom = 1.45;

    /** @type {number} Constante de velocidad para el decaimiento exponencial (LERP suave) */
    this.lerpSpeed = 7.0;

    /** @type {{x: number, y: number, width: number, height: number}|null} Límites del mapa */
    this.roomBounds = null;

    // --- Sistema de Screen Shake (Temblor de Cámara) ---
    /** @type {number} Nivel de trauma actual [0..1] */
    this.trauma = 0;
    /** @type {number} Duración base del temblor en segundos */
    this.shakeDuration = 0.3;
    /** @type {Vector2} Desplazamiento reactivo del temblor */
    this.shakeOffset = new Vector2(0, 0);

    /** @private Reutilización de vectores en conversiones de coordenadas */
    this._screenCache = new Vector2();
    this._worldCache = new Vector2();
  }

  /**
   * Define los límites del mapa para Room Clamping.
   * @param {{x: number, y: number, width: number, height: number}|null} bounds
   */
  setRoomBounds(bounds) {
    this.roomBounds = bounds;
  }

  /**
   * Actualiza las dimensiones del viewport.
   * @param {number} width
   * @param {number} height
   */
  setViewportSize(width, height) {
    this.viewportWidth = width;
    this.viewportHeight = height;
  }

  /**
   * Activa un impacto de Screen Shake.
   * Utiliza trauma cuadrático (trauma^2) para una respuesta no lineal muy visceral.
   * @param {number} [intensity=0.5] - Cantidad de trauma a sumar (0..1)
   * @param {number} [duration=0.25] - Duración estimada en segundos
   */
  shake(intensity = 0.5, duration = 0.25) {
    this.trauma = Math.min(1.0, this.trauma + intensity);
    this.shakeDuration = Math.max(0.1, duration);
  }

  /**
   * Desplaza la cámara suavemente siguiendo al objetivo centrado en el viewport.
   * Emplea interpolación de decaimiento exponencial continuo para eliminar movimientos robóticos.
   * @param {Vector2|{x: number, y: number}} targetPos - Posición en el mundo del objetivo
   * @param {number} deltaTime - Tiempo del frame en segundos
   */
  update(targetPos, deltaTime) {
    const targetX = targetPos.x;
    const targetY = targetPos.y;

    // LERP exponencial continuo: factor = 1 - e^(-k * dt)
    const factor = 1 - Math.exp(-this.lerpSpeed * deltaTime);
    this.pos.x += (targetX - this.pos.x) * factor;
    this.pos.y += (targetY - this.pos.y) * factor;

    // Room Clamping adaptado al nivel de zoom
    if (this.roomBounds) {
      const visibleWidth = this.viewportWidth / this.zoom;
      const visibleHeight = this.viewportHeight / this.zoom;

      const halfW = visibleWidth / 2;
      const halfH = visibleHeight / 2;

      const minX = this.roomBounds.x + halfW;
      const maxX = this.roomBounds.x + this.roomBounds.width - halfW;
      const minY = this.roomBounds.y + halfH;
      const maxY = this.roomBounds.y + this.roomBounds.height - halfH;

      if (maxX >= minX) {
        if (this.pos.x < minX) this.pos.x = minX;
        if (this.pos.x > maxX) this.pos.x = maxX;
      } else {
        this.pos.x = this.roomBounds.x + this.roomBounds.width / 2;
      }

      if (maxY >= minY) {
        if (this.pos.y < minY) this.pos.y = minY;
        if (this.pos.y > maxY) this.pos.y = maxY;
      } else {
        this.pos.y = this.roomBounds.y + this.roomBounds.height / 2;
      }
    }

    // Actualización y decaimiento del Screen Shake
    if (this.trauma > 0) {
      this.trauma -= (1 / this.shakeDuration) * deltaTime;
      if (this.trauma < 0) this.trauma = 0;

      // Trauma cuadrático para atenuación orgánica
      const shakeFactor = this.trauma * this.trauma;
      const maxOffset = 18; // Píxeles máximos de vibración
      this.shakeOffset.x = (Math.random() * 2 - 1) * maxOffset * shakeFactor;
      this.shakeOffset.y = (Math.random() * 2 - 1) * maxOffset * shakeFactor;
    } else {
      this.shakeOffset.set(0, 0);
    }
  }

  /**
   * Convierte coordenadas del mundo a coordenadas de la pantalla (con zoom y centrado).
   * @param {{x: number, y: number}} worldPos
   * @returns {Vector2} Coordenadas en pantalla
   */
  worldToScreen(worldPos) {
    this._screenCache.x = this.viewportWidth / 2 + (worldPos.x - this.pos.x) * this.zoom;
    this._screenCache.y = this.viewportHeight / 2 + (worldPos.y - this.pos.y) * this.zoom;
    return this._screenCache;
  }

  /**
   * Convierte coordenadas de pantalla a coordenadas del mundo.
   * @param {{x: number, y: number}} screenPos
   * @returns {Vector2} Coordenadas en el mundo
   */
  screenToWorld(screenPos) {
    this._worldCache.x = this.pos.x + (screenPos.x - this.viewportWidth / 2) / this.zoom;
    this._worldCache.y = this.pos.y + (screenPos.y - this.viewportHeight / 2) / this.zoom;
    return this._worldCache;
  }

  /**
   * Aplica la matriz de transformación: Centrado + Zoom + Posición del Mundo + Shake.
   * @param {CanvasRenderingContext2D} ctx
   */
  applyTransform(ctx) {
    ctx.save();
    // 1. Mover al centro del viewport
    ctx.translate(Math.floor(this.viewportWidth / 2), Math.floor(this.viewportHeight / 2));
    // 2. Aplicar escala de Zoom cinemático
    ctx.scale(this.zoom, this.zoom);
    // 3. Trasladar al objetivo mundial con Screen Shake
    ctx.translate(
      -Math.floor(this.pos.x) - Math.floor(this.shakeOffset.x),
      -Math.floor(this.pos.y) - Math.floor(this.shakeOffset.y)
    );
  }

  /**
   * Restaura el estado del contexto.
   * @param {CanvasRenderingContext2D} ctx
   */
  restoreTransform(ctx) {
    ctx.restore();
  }
}

import { Vector2 } from '../utils/Vector2.js';

/**
 * @module Camera
 * @description Sistema de cámara 2D con Zona Muerta Cuadrada (Square Deadzone), foco cinemático,
 * zoom entero pixel-perfect, Screen Shake basado en trauma cuadrático y Room Clamping
 * que previene visualización de vacíos exteriores sin importar la escala de zoom.
 * @author Be a Legend Team
 * @version 2.0.0
 */
export class Camera {
  /**
   * @param {number} viewportWidth - Ancho del viewport en píxeles
   * @param {number} viewportHeight - Alto del viewport en píxeles
   */
  constructor(viewportWidth, viewportHeight) {
    /** @type {Vector2} Coordenada mundial final del centro de atención de la cámara */
    this.pos = new Vector2(0, 0);

    /** @type {Vector2} Centro lógico de la Zona Muerta Cuadrada respecto al jugador */
    this.focusPos = new Vector2(0, 0);

    /** @type {number} Semi-ancho de la zona muerta cuadrada (caja central libre sin mover cámara) */
    this.deadzoneHalfWidth = 42;

    /** @type {number} Semi-alto de la zona muerta cuadrada (caja central libre sin mover cámara) */
    this.deadzoneHalfHeight = 32;

    /** @type {boolean} Indica si la zona muerta ya fue alineada al objetivo inicial */
    this._initializedFocus = false;

    /** @type {{x: number, y: number}|null} Objetivo temporal para paneos cinemáticos in-engine */
    this.cinematicTarget = null;

    /** @type {number} Velocidad de interpolación hacia el foco cinemático */
    this.cinematicLerpSpeed = 5.5;

    /** @private Ancla sin clamping para transiciones cinemáticas suaves sin sesgos de borde */
    this._camAnchorPos = new Vector2(0, 0);
    /** @private Bandera activa mientras se regresa desde un paneo cinemático */
    this._inCinematic = false;

    this.viewportWidth = viewportWidth;
    this.viewportHeight = viewportHeight;

    /** @type {number} Escala de píxeles del dispositivo (Device Pixel Ratio) */
    this.dpr = (typeof window !== 'undefined' && window.devicePixelRatio) ? window.devicePixelRatio : 1;

    /** @type {number} Multiplicador de zoom efectivo entero (calculado dinámicamente) */
    this.zoom = 2;

    /** @type {number} Ancho lógico nativo del lienzo pixel-art */
    this.logicalWidth = 480;

    /** @type {number} Alto lógico nativo del lienzo pixel-art */
    this.logicalHeight = 270;

    /** @type {number} Constante de velocidad para el decaimiento exponencial (LERP suave) */
    this.lerpSpeed = 10.5;

    /** @type {{x: number, y: number, width: number, height: number}|null} Límites del mapa */
    this.roomBounds = null;

    // Calcular zoom pixel-perfect inicial
    this.updatePixelPerfectZoom();

    // --- Sistema de Screen Shake (Temblor de Cámara) ---
    /** @type {number} Nivel de trauma actual [0..1] */
    this.trauma = 0;
    /** @type {number} Duración base del temblor en segundos */
    this.shakeDuration = 0.3;
    /** @type {Vector2} Desplazamiento reactivo del temblor */
    this.shakeOffset = new Vector2(0, 0);

    /** @type {Vector2} Desplazamiento auxiliar en caché */
    this.lookaheadOffset = new Vector2(0, 0);
    /** @type {Vector2} Desplazamiento táctico suavizado hacia foco de combate (Zero-GC) */
    this._combatLeadOffset = new Vector2(0, 0);
    /** @type {number} Reloj determinista para oscilación pseudo-Perlin del shake */
    this._noiseClock = 0;

    /** @private Reutilización de vectores y rectángulos en conversiones de coordenadas (Cero GC) */
    this._screenCache = new Vector2();
    this._worldCache = new Vector2();
    this._boundsCache = { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  }

  /**
   * Define los límites del mapa para Room Clamping.
   * @param {{x: number, y: number, width: number, height: number}|null} bounds
   */
  setRoomBounds(bounds) {
    this.roomBounds = bounds;
  }

  /**
   * Actualiza las dimensiones del viewport y recalcula el zoom pixel-perfect.
   * @param {number} width - Ancho en píxeles CSS
   * @param {number} height - Alto en píxeles CSS
   * @param {number} [dpr] - Escala de píxeles del dispositivo
   */
  setViewportSize(width, height, dpr = undefined) {
    this.viewportWidth = width;
    this.viewportHeight = height;
    if (dpr !== undefined) {
      this.dpr = dpr;
    }
    this.updatePixelPerfectZoom();
  }

  /**
   * Calcula el zoom entero y las dimensiones lógicas nativas pixel-art (`logicalWidth` x `logicalHeight`)
   * adaptándose tanto a 16:9 como a 9:16 frente a la base de 270 px para obtener cuadrícula 1:1 sin borrosidad.
   */
  updatePixelPerfectZoom() {
    const baseMinAxis = 320;
    const minViewportAxis = Math.min(this.viewportWidth || 960, this.viewportHeight || 540);
    this.zoom = Math.max(2, Math.round(minViewportAxis / baseMinAxis));
    this.logicalWidth = Math.ceil((this.viewportWidth || 960) / this.zoom);
    this.logicalHeight = Math.ceil((this.viewportHeight || 540) / this.zoom);
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
   * Alias semántico para acumular trauma de cámara desde secuencias de VFX.
   * @param {number} [intensity=0.45]
   * @param {number} [duration=0.28]
   */
  addTrauma(intensity = 0.45, duration = 0.28) {
    this.shake(intensity, duration);
  }

  /**
   * Alinea de forma instantánea el foco de la Zona Muerta y la posición de la cámara sobre `pos`.
   * @param {{x: number, y: number}} pos
   */
  snapTo(pos) {
    if (!pos) return;
    this.focusPos.set(pos.x, pos.y);
    this._camAnchorPos.set(pos.x, pos.y);
    this._combatLeadOffset.set(0, 0);
    this.pos.set(pos.x, pos.y);
    this._initializedFocus = true;
    this._inCinematic = false;
    this._applyRoomBounds();
  }

  /**
   * Aplica Room Clamping a `this.pos` adaptado al nivel de zoom activo.
   * @private
   */
  _applyRoomBounds() {
    if (!this.roomBounds) return;
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

  /**
   * Actualiza la cámara mediante **Zona Muerta Cuadrada (Square Deadzone)** y foco cinemático:
   * - Dentro de la caja central (`±deadzoneHalfWidth`, `±deadzoneHalfHeight`) la cámara no se desplaza.
   * - Al cruzar los bordes, `focusPos` se desliza acompañando al jugador con exactitud.
   * - Si `cinematicTarget` está activo, interpola el encuadre suavemente hacia ese punto.
   * @param {Vector2|{x: number, y: number}} targetPos - Posición en el mundo del objetivo
   * @param {number} deltaTime - Tiempo del frame en segundos
   * @param {{x: number, y: number}|null} [lookDir=null] - Dirección de mira opcional
   * @param {{x: number, y: number}|null} [combatFocusPos=null] - Objetivo táctico opcional
   */
  update(targetPos, deltaTime, lookDir = null, combatFocusPos = null) {
    const dt = deltaTime || 0.016;
    this._noiseClock += dt * 42;

    if (!this._initializedFocus) {
      this.snapTo(targetPos);
    }

    // 1. Actualizar foco de Zona Muerta Cuadrada
    const dx = targetPos.x - this.focusPos.x;
    const dy = targetPos.y - this.focusPos.y;
    if (dx > this.deadzoneHalfWidth) {
      this.focusPos.x = targetPos.x - this.deadzoneHalfWidth;
    } else if (dx < -this.deadzoneHalfWidth) {
      this.focusPos.x = targetPos.x + this.deadzoneHalfWidth;
    }

    if (dy > this.deadzoneHalfHeight) {
      this.focusPos.y = targetPos.y - this.deadzoneHalfHeight;
    } else if (dy < -this.deadzoneHalfHeight) {
      this.focusPos.y = targetPos.y + this.deadzoneHalfHeight;
    }

    // 2. Calcular desplazamiento táctico acotado hacia el centroide de combate (si aplica)
    if (!this.cinematicTarget && combatFocusPos) {
      const rawLeadX = (combatFocusPos.x - targetPos.x) * 0.18;
      const rawLeadY = (combatFocusPos.y - targetPos.y) * 0.18;
      const clampedX = Math.max(-24, Math.min(24, rawLeadX));
      const clampedY = Math.max(-18, Math.min(18, rawLeadY));
      const leadBlend = 1 - Math.exp(-6.5 * dt);
      this._combatLeadOffset.x += (clampedX - this._combatLeadOffset.x) * leadBlend;
      this._combatLeadOffset.y += (clampedY - this._combatLeadOffset.y) * leadBlend;
    } else if (Math.abs(this._combatLeadOffset.x) > 0.05 || Math.abs(this._combatLeadOffset.y) > 0.05) {
      const decayBlend = 1 - Math.exp(-8.0 * dt);
      this._combatLeadOffset.x *= (1 - decayBlend);
      this._combatLeadOffset.y *= (1 - decayBlend);
    } else {
      this._combatLeadOffset.set(0, 0);
    }

    // 3. Resolver foco cinemático vs retorno suave / seguimiento directo de zona muerta
    if (this.cinematicTarget) {
      const f = 1 - Math.exp(-this.cinematicLerpSpeed * dt);
      this._camAnchorPos.x += (this.cinematicTarget.x - this._camAnchorPos.x) * f;
      this._camAnchorPos.y += (this.cinematicTarget.y - this._camAnchorPos.y) * f;
      this._inCinematic = true;
    } else if (this._inCinematic) {
      const targetAnchorX = this.focusPos.x + this._combatLeadOffset.x;
      const targetAnchorY = this.focusPos.y + this._combatLeadOffset.y;
      const dist = Math.hypot(this._camAnchorPos.x - targetAnchorX, this._camAnchorPos.y - targetAnchorY);
      if (dist > 2) {
        const retF = 1 - Math.exp(-14 * dt);
        this._camAnchorPos.x += (targetAnchorX - this._camAnchorPos.x) * retF;
        this._camAnchorPos.y += (targetAnchorY - this._camAnchorPos.y) * retF;
      } else {
        this._camAnchorPos.set(targetAnchorX, targetAnchorY);
        this._inCinematic = false;
      }
    } else {
      this._camAnchorPos.set(
        this.focusPos.x + this._combatLeadOffset.x,
        this.focusPos.y + this._combatLeadOffset.y
      );
    }

    this.pos.set(this._camAnchorPos.x, this._camAnchorPos.y);
    this._applyRoomBounds();

    // Actualización y decaimiento del Screen Shake
    if (this.trauma > 0) {
      this.trauma -= (1 / this.shakeDuration) * deltaTime;
      if (this.trauma < 0) this.trauma = 0;

      // Trauma cuadrático para atenuación orgánica + onda pseudo-Perlin determinista
      const shakeFactor = this.trauma * this.trauma;
      const maxOffset = 18; // Píxeles máximos de vibración
      const t = this._noiseClock;
      const waveX = Math.sin(t) * 0.62 + Math.cos(t * 2.13) * 0.38;
      const waveY = Math.cos(t * 1.37) * 0.65 + Math.sin(t * 2.71) * 0.35;
      this.shakeOffset.x = waveX * maxOffset * shakeFactor;
      this.shakeOffset.y = waveY * maxOffset * shakeFactor;
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
   * Aplica traslación alineada a píxeles reales del viewport más escalado Pixel-Art entero.
   * Mantiene movimiento sedoso en pantalla y píxeles perfectamente nítidos sin borrosidad.
   * @param {CanvasRenderingContext2D} ctx
   */
  applyTransform(ctx) {
    ctx.save();
    const cw = (ctx.canvas && ctx.canvas.width) ? ctx.canvas.width : this.viewportWidth;
    const ch = (ctx.canvas && ctx.canvas.height) ? ctx.canvas.height : this.viewportHeight;
    const tx = Math.round(cw * 0.5 - (this.pos.x + this.shakeOffset.x) * this.zoom);
    const ty = Math.round(ch * 0.5 - (this.pos.y + this.shakeOffset.y) * this.zoom);
    ctx.translate(tx, ty);
    ctx.scale(this.zoom, this.zoom);
  }

  /**
   * Calcula el rectángulo de mundo actualmente visible en cámara con margen de seguridad
   * para aplicar Frustum Culling O(1) en el renderizado de entidades sin recortar copas ni sombras.
   * @param {number} [margin=96] - Margen extra en píxeles de mundo
   * @returns {{minX: number, minY: number, maxX: number, maxY: number}}
   */
  getVisibleWorldBounds(margin = 96) {
    const halfW = (this.viewportWidth / (this.zoom || 1)) * 0.5 + margin;
    const halfH = (this.viewportHeight / (this.zoom || 1)) * 0.5 + margin;
    const cx = this.pos.x + this.shakeOffset.x;
    const cy = this.pos.y + this.shakeOffset.y;
    const b = this._boundsCache;
    b.minX = cx - halfW;
    b.minY = cy - halfH;
    b.maxX = cx + halfW;
    b.maxY = cy + halfH;
    return b;
  }

  /**
   * Restaura el estado del contexto.
   * @param {CanvasRenderingContext2D} ctx
   */
  restoreTransform(ctx) {
    ctx.restore();
  }
}

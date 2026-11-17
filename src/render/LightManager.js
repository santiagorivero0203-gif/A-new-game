/**
 * @module LightManager
 * @description Gestor de iluminación atmosférica y halos de color sobre lienzo secundario (`#light-canvas`).
 *
 * Soporta dos modos complementarios sobre HTML5 Canvas 2D:
 * - **Modo Interior (`isInterior = true`)**: Penumbra densa con recorte suave (`destination-out`).
 * - **Modo Exterior por Bioma (`setBiomeAtmosphere`)**: Tinte atmosférico Hue-Shifted índigo/violáceo/cálido
 *   no destructivo (`0.14–0.38` alpha) combinado con halo de color aditivo (`lighter`) sobre
 *   fuentes de luz dinámicas (antorchas, grietas de magma, esporas bioluminiscentes y portales).
 * - **Consulta Zero-GC (`getNearestLight`)**: Expone la fuente luminosa más cercana a una entidad
 *   sin reservar objetos por frame, permitiendo a `Renderer.js` inclinar las sombras de los pies.
 *
 * @author Be a Legend Team
 * @version 2.0.0
 */

/**
 * Tintes atmosféricos preconfigurados por bioma con desplazamiento cromático frío/cálido.
 * @constant {Record<string, string>}
 */
export const BIOME_AMBIENT_TINTS = {
  cave_exit_intro: 'rgba(14, 22, 52, 0.22)',
  starting_clearing: 'rgba(14, 22, 52, 0.22)',
  marsh_of_spores: 'rgba(13, 38, 52, 0.34)',
  ash_caldera: 'rgba(38, 18, 28, 0.36)',
  astral_citadel: 'rgba(19, 14, 48, 0.34)'
};

export class LightManager {
  /**
   * @param {HTMLCanvasElement} canvas - Lienzo dedicado (`#light-canvas`) superpuesto al mundo.
   * @param {boolean} [isInterior=false] - Si inicia en modo interior oscuro o exterior atmosférico.
   */
  constructor(canvas, isInterior = false) {
    this.canvas = canvas;
    this.ctx = canvas ? canvas.getContext('2d') : null;
    if (this.ctx) {
      this.ctx.imageSmoothingEnabled = false;
    }

    this.isInterior = isInterior;
    this.biomeKey = 'cave_exit_intro';
    this.ambientLight = isInterior
      ? 'rgba(8, 10, 24, 0.86)'
      : BIOME_AMBIENT_TINTS.cave_exit_intro;

    /** @type {Array<{x: number, y: number, radius: number, color?: string, intensity?: number, flickerSpeed?: number, _currentRadius?: number, _phase?: number}>} */
    this.lights = [];
    this._isCanvasCleared = false;
    this._renderCooldown = 0;
    this._dirty = true;
    this._lastCamX = NaN;
    this._lastCamY = NaN;
    this._lastZoom = NaN;

    // Cachés Zero-GC para consultas de sombra direccional y proyección de cámara
    this._nearestCache = { found: false, distSq: Infinity, dx: 0, dy: 0, light: null };
    this._screenOut = { x: 0, y: 0 };

    // Máscaras radiales pre-horneadas para evitar createRadialGradient en cada frame
    this._cutoutMask = this._createRadialMask('rgba(255,255,255,1)', 'rgba(255,255,255,0.45)', 'rgba(255,255,255,0)');
    this._colorMasks = new Map();

    this._syncCanvasVisibility();
  }

  /**
   * Pre-hornea una máscara radial reutilizable de 128x128 px (cero alocaciones por frame).
   * @private
   */
  _createRadialMask(c0, cMid, cEnd) {
    if (typeof document === 'undefined') return null;
    const c = document.createElement('canvas');
    c.width = 128;
    c.height = 128;
    const gctx = c.getContext('2d');
    if (gctx) {
      const grad = gctx.createRadialGradient(64, 64, 6, 64, 64, 64);
      grad.addColorStop(0, c0);
      if (cMid) grad.addColorStop(0.55, cMid);
      grad.addColorStop(1, cEnd);
      gctx.fillStyle = grad;
      gctx.fillRect(0, 0, 128, 128);
    }
    return c;
  }

  /**
   * Obtiene o pre-hornea una máscara de halo cromático para un color dado.
   * @private
   */
  _getColorMask(color) {
    const key = color || '#fbbf24';
    let mask = this._colorMasks.get(key);
    if (!mask) {
      mask = this._createRadialMask(key, null, 'rgba(0, 0, 0, 0)');
      this._colorMasks.set(key, mask);
    }
    return mask;
  }

  /**
   * Reestablece el suavizado de imagen y fuerza la limpieza en el siguiente fotograma
   * tras cualquier cambio de dimensiones del `#light-canvas`.
   */
  resize() {
    if (this.ctx) {
      this.ctx.imageSmoothingEnabled = false;
    }
    this._isCanvasCleared = false;
    this._dirty = true;
  }

  /**
   * Mantiene oculto en el DOM el lienzo de iluminación porque se composta directamente
   * sobre el canvas principal (`compositeTo`) en una sola capa GPU para 60/120 FPS estables.
   * @private
   */
  _syncCanvasVisibility() {
    if (this.canvas) {
      this.canvas.style.display = 'none';
    }
  }

  /**
   * Activa o desactiva la penumbra profunda de interiores (cuevas, sótanos, casas).
   * @param {boolean} isInterior
   */
  setInterior(isInterior) {
    this.isInterior = Boolean(isInterior);
    this.ambientLight = this.isInterior
      ? 'rgba(8, 10, 24, 0.86)'
      : (BIOME_AMBIENT_TINTS[this.biomeKey] || BIOME_AMBIENT_TINTS.cave_exit_intro);
    this._isCanvasCleared = false;
    this._dirty = true;
    this._syncCanvasVisibility();
  }

  /**
   * Ajusta la atmósfera luminosa según el Bioma / Mundo activo.
   * @param {string} biomeKey - Identificador del bioma (`cave_exit_intro`, `marsh_of_spores`, `ash_caldera`, `astral_citadel`).
   * @param {string|null} [customAmbient=null] - Tinte RGBA opcional definido en el JSON del nivel.
   */
  setBiomeAtmosphere(biomeKey, customAmbient = null) {
    this.biomeKey = biomeKey || 'cave_exit_intro';
    if (!this.isInterior) {
      this.ambientLight = customAmbient || BIOME_AMBIENT_TINTS[this.biomeKey] || BIOME_AMBIENT_TINTS.cave_exit_intro;
    }
    this._isCanvasCleared = false;
    this._dirty = true;
    this._syncCanvasVisibility();
  }

  /**
   * Registra una fuente de luz dinámica/estática con parpadeo orgánico opcional.
   * @param {Object} light
   */
  addLight(light) {
    if (!light) return;
    const entry = {
      x: light.x || 0,
      y: light.y || 0,
      radius: light.radius || 140,
      color: light.color || '#fbbf24',
      intensity: light.intensity !== undefined ? light.intensity : 0.75,
      flickerSpeed: light.flickerSpeed !== undefined ? light.flickerSpeed : 1.5,
      _currentRadius: light.radius || 140,
      _phase: Math.random() * Math.PI * 2
    };
    this.lights.push(entry);
    return entry;
  }

  /**
   * Elimina una fuente de luz específica del mapa activo.
   * @param {Object} light
   */
  removeLight(light) {
    const idx = this.lights.indexOf(light);
    if (idx !== -1) {
      this.lights.splice(idx, 1);
    }
  }

  /**
   * Limpia todas las luces registradas (al cambiar de mundo o escena).
   */
  clearLights() {
    this.lights.length = 0;
  }

  /**
   * Consulta Zero-GC que determina la fuente de luz más cercana a unas coordenadas de mundo.
   * Útil para estirar ligeramente la elipse de sombra a los pies en dirección opuesta a la luz.
   * @param {number} worldX
   * @param {number} worldY
   * @param {number} [maxRange=360]
   * @returns {{found: boolean, distSq: number, dx: number, dy: number, light: Object|null}}
   */
  getNearestLight(worldX, worldY, maxRange = 360) {
    const cache = this._nearestCache;
    cache.found = false;
    cache.distSq = maxRange * maxRange;
    cache.dx = 0;
    cache.dy = 0;
    cache.light = null;

    for (let i = 0; i < this.lights.length; i++) {
      const l = this.lights[i];
      const dx = worldX - l.x;
      const dy = worldY - l.y;
      const dSq = dx * dx + dy * dy;
      if (dSq < cache.distSq) {
        cache.found = true;
        cache.distSq = dSq;
        cache.dx = dx;
        cache.dy = dy;
        cache.light = l;
      }
    }
    return cache;
  }

  /**
   * Actualiza la oscilación orgánica de radio para antorchas, magma y halos arcanos.
   * @param {number} deltaTime
   */
  update(deltaTime) {
    const dt = deltaTime || 0.016;
    if (this._renderCooldown > 0) {
      this._renderCooldown -= dt;
    }
    for (let i = 0; i < this.lights.length; i++) {
      const l = this.lights[i];
      l._phase += dt * (l.flickerSpeed || 1.5);
      const pulse = Math.sin(l._phase) * 0.055 + Math.cos(l._phase * 1.7) * 0.025;
      l._currentRadius = Math.max(24, l.radius * (1 + pulse));
    }
  }

  /**
   * Dibuja el manto atmosférico, recorta halos de visibilidad y proyecta brillo cromático suave.
   * Re-hornea a ~30 Hz salvo desplazamiento de cámara significativo o cambio atmosférico,
   * reduciendo a la mitad las reconstrucciones de `#light-canvas` en pantallas de 60/120 Hz.
   * @param {import('./Camera.js').Camera} camera
   */
  render(camera) {
    if (!this.ctx || !this.canvas) return;
    const w = this.canvas.width;
    const h = this.canvas.height;
    if (w <= 0 || h <= 0) return;

    const camX = camera && camera.position ? camera.position.x : 0;
    const camY = camera && camera.position ? camera.position.y : 0;
    const zoom = (camera && camera.zoom) ? camera.zoom : 1;
    const cameraMoved =
      Math.abs(camX - this._lastCamX) >= 1.5 ||
      Math.abs(camY - this._lastCamY) >= 1.5 ||
      zoom !== this._lastZoom;

    if (!this._dirty && !cameraMoved && this._renderCooldown > 0) {
      return;
    }

    this._dirty = false;
    this._renderCooldown = 0.033;
    this._lastCamX = camX;
    this._lastCamY = camY;
    this._lastZoom = zoom;

    const ctx = this.ctx;
    this._isCanvasCleared = false;
    ctx.clearRect(0, 0, w, h);

    // 1. Capa de tinte atmosférico Hue-Shifted
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = this.ambientLight;
    ctx.fillRect(0, 0, w, h);

    const scaleX = (camera && camera.viewportWidth > 0) ? (w / camera.viewportWidth) : 1;
    const scaleY = (camera && camera.viewportHeight > 0) ? (h / camera.viewportHeight) : 1;

    // 2. Recortar el tinte en torno a cada fuente de luz (`destination-out`) usando máscara pre-horneada
    if (this.lights.length > 0 && this._cutoutMask) {
      ctx.globalCompositeOperation = 'destination-out';
      for (let i = 0; i < this.lights.length; i++) {
        const l = this.lights[i];
        const scr = camera ? camera.worldToScreen(l) : l;
        const sx = scr.x * scaleX;
        const sy = scr.y * scaleY;
        const screenR = (l._currentRadius || l.radius) * zoom * scaleX;

        if (sx + screenR < 0 || sx - screenR > w || sy + screenR < 0 || sy - screenR > h) {
          continue;
        }

        ctx.globalAlpha = Math.max(0, Math.min(1, l.intensity));
        ctx.drawImage(this._cutoutMask, sx - screenR, sy - screenR, screenR * 2, screenR * 2);
      }

      // 3. Halo cromático sutil (`lighter`) sobre luces elementales / magma / esporas
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = this.isInterior ? 0.24 : 0.19;
      for (let i = 0; i < this.lights.length; i++) {
        const l = this.lights[i];
        const scr = camera ? camera.worldToScreen(l) : l;
        const sx = scr.x * scaleX;
        const sy = scr.y * scaleY;
        const screenR = (l._currentRadius || l.radius) * zoom * 0.85 * scaleX;

        if (sx + screenR < 0 || sx - screenR > w || sy + screenR < 0 || sy - screenR > h) {
          continue;
        }

        const colorMask = this._getColorMask(l.color);
        if (colorMask) {
          ctx.drawImage(colorMask, sx - screenR, sy - screenR, screenR * 2, screenR * 2);
        }
      }
      ctx.globalAlpha = 1;
    }

    ctx.globalCompositeOperation = 'source-over';
  }

  /**
   * Compone el mapa de iluminación ya horneado sobre el canvas principal en una sola copia GPU,
   * eliminando la necesidad de mantener un segundo `<canvas>` superpuesto en el DOM.
   * @param {CanvasRenderingContext2D} targetCtx
   * @param {number} targetWidth
   * @param {number} targetHeight
   */
  compositeTo(targetCtx, targetWidth, targetHeight) {
    if (!targetCtx || !this.canvas || targetWidth <= 0 || targetHeight <= 0) return;
    const prevSmooth = targetCtx.imageSmoothingEnabled;
    targetCtx.imageSmoothingEnabled = true;
    targetCtx.drawImage(this.canvas, 0, 0, targetWidth, targetHeight);
    targetCtx.imageSmoothingEnabled = prevSmooth;
  }
}

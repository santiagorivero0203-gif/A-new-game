/**
 * @module PerfOverlay
 * @description Overlay ligero de telemetría de rendimiento (Fase 0) activo únicamente
 * cuando `window.DEBUG_MODE === true`. Mide FPS, tiempos de `update`/`render`,
 * chunks montados, caché de Tilemap y sprites en `CelSpriteAtlas` sin generar
 * trabajo DOM en producción ni saturar el hilo principal (refresco a ~4 Hz).
 * @author Be a Legend Team
 * @version 1.0.0
 */
export class PerfOverlay {
  constructor() {
    /** @type {HTMLElement|null} */
    this.el = null;
    this._accumSec = 0;
    this._frames = 0;
    this._updateMsSum = 0;
    this._renderMsSum = 0;
    this._fps = 0;
  }

  /**
   * Crea perezosamente el nodo DOM del overlay únicamente si `DEBUG_MODE` se activa.
   * @private
   */
  _ensureMounted() {
    if (this.el || typeof document === 'undefined' || !document.body) return;
    const box = document.createElement('div');
    box.id = 'perf-debug-overlay';
    box.style.cssText = [
      'position:fixed',
      'left:8px',
      'bottom:8px',
      'z-index:9999',
      'padding:6px 10px',
      'background:rgba(5,8,17,0.86)',
      'border:1px solid rgba(56,189,248,0.45)',
      'border-radius:6px',
      'color:#e2e8f0',
      'font:700 11px/1.35 monospace',
      'pointer-events:none',
      'white-space:pre'
    ].join(';');
    document.body.appendChild(box);
    this.el = box;
  }

  /**
   * Desmonta el overlay si `DEBUG_MODE` vuelve a `false`.
   */
  hide() {
    if (this.el && this.el.parentNode) {
      this.el.parentNode.removeChild(this.el);
      this.el = null;
    }
  }

  /**
   * Acumula muestras de frame y actualiza el texto a ~4 Hz mientras `window.DEBUG_MODE === true`.
   * @param {number} dt
   * @param {number} updateMs
   * @param {number} renderMs
   * @param {Object} [metrics]
   */
  recordFrame(dt, updateMs, renderMs, metrics = {}) {
    if (typeof window === 'undefined' || !window.DEBUG_MODE) {
      if (this.el) this.hide();
      return;
    }

    this._ensureMounted();
    if (!this.el) return;

    this._frames++;
    this._accumSec += dt;
    this._updateMsSum += updateMs;
    this._renderMsSum += renderMs;

    if (this._accumSec >= 0.25) {
      this._fps = Math.round(this._frames / this._accumSec);
      const avgUpd = (this._updateMsSum / this._frames).toFixed(2);
      const avgRnd = (this._renderMsSum / this._frames).toFixed(2);
      const chunks = metrics.loadedChunks ?? 0;
      const entities = metrics.mountedEntities ?? 0;
      const tileChunks = metrics.tileChunks ?? 0;
      const atlasSprites = metrics.atlasSprites ?? 0;
      const remembered = metrics.rememberedStates ?? 0;

      this.el.textContent =
        `FPS: ${this._fps} | upd: ${avgUpd}ms | rnd: ${avgRnd}ms\n` +
        `Ent: ${entities} | Chunks: ${chunks} (mem: ${remembered})\n` +
        `TileChunks: ${tileChunks} | Atlas: ${atlasSprites}`;

      this._frames = 0;
      this._accumSec = 0;
      this._updateMsSum = 0;
      this._renderMsSum = 0;
    }
  }
}


/**
 * @module EditorViewport
 * @description Controlador de cámara, conversión de coordenadas y gestos multitáctiles
 * (Pinch-to-Zoom, Pan a 2 dedos y Pan a 1 dedo con herramienta Mano) para la Forja de Mundos.
 * Desacopla toda la gestión de viewport y punteros del orquestador `LevelEditor`.
 * @author Be a Legend Team
 * @version 1.0.0
 */

export class EditorViewport {
  /**
   * @param {Object} options
   * @param {HTMLCanvasElement} options.canvas
   * @param {number} [options.cameraX=0]
   * @param {number} [options.cameraY=0]
   * @param {number} [options.zoom=1.0]
   * @param {Function} [options.isPanToolActive] - Retorna true si la herramienta Mano (1 dedo) está activa
   * @param {Function} [options.onCameraChange] - Invocado cuando cambia posición o zoom `(zoomPct)`
   * @param {Function} [options.onCancelSingleStroke] - Cancela trazo de 1 dedo al detectar 2 dedos
   * @param {Function} [options.onSingleDown]
   * @param {Function} [options.onSingleMove]
   * @param {Function} [options.onSingleUp]
   */
  constructor(options) {
    this.canvas = options.canvas;
    this.cameraX = options.cameraX || 0;
    this.cameraY = options.cameraY || 0;
    this.zoom = options.zoom || 1.0;
    this.minZoom = 0.35;
    this.maxZoom = 3.5;

    this.isPanToolActive = options.isPanToolActive || (() => false);
    this.onCameraChange = options.onCameraChange || (() => {});
    this.onCancelSingleStroke = options.onCancelSingleStroke || (() => {});
    this.onSingleDown = options.onSingleDown || (() => {});
    this.onSingleMove = options.onSingleMove || (() => {});
    this.onSingleUp = options.onSingleUp || (() => {});

    /** @type {Map<number, { x: number, y: number }>} Punteros activos para gestos multitáctiles */
    this._activePointers = new Map();
    this.isMultiTouchGesture = false;
    this._prevPinchDist = 0;
    this._prevPinchMid = { x: 0, y: 0 };

    this._isSinglePanning = false;
    this._panStart = { x: 0, y: 0 };
    this._camStart = { x: 0, y: 0 };

    this._boundPointerDown = this._handlePointerDown.bind(this);
    this._boundPointerMove = this._handlePointerMove.bind(this);
    this._boundPointerUp = this._handlePointerUp.bind(this);
    this._boundWheel = this._handleWheel.bind(this);
    this._boundContextMenu = (e) => e.preventDefault();

    this.attach();
  }

  /**
   * Conecta los escuchadores de puntero y rueda al lienzo.
   */
  attach() {
    if (!this.canvas) return;
    this.canvas.addEventListener('pointerdown', this._boundPointerDown);
    this.canvas.addEventListener('pointermove', this._boundPointerMove);
    this.canvas.addEventListener('pointerup', this._boundPointerUp);
    this.canvas.addEventListener('pointercancel', this._boundPointerUp);
    this.canvas.addEventListener('wheel', this._boundWheel, { passive: false });
    this.canvas.addEventListener('contextmenu', this._boundContextMenu);
  }

  /**
   * Libera los escuchadores del lienzo al cerrar el editor.
   */
  detach() {
    if (!this.canvas) return;
    this.canvas.removeEventListener('pointerdown', this._boundPointerDown);
    this.canvas.removeEventListener('pointermove', this._boundPointerMove);
    this.canvas.removeEventListener('pointerup', this._boundPointerUp);
    this.canvas.removeEventListener('pointercancel', this._boundPointerUp);
    this.canvas.removeEventListener('wheel', this._boundWheel);
    this.canvas.removeEventListener('contextmenu', this._boundContextMenu);
    this._activePointers.clear();
  }

  /**
   * Centra la cámara en coordenadas concretas del mundo.
   * @param {number} x
   * @param {number} y
   */
  centerAt(x, y) {
    this.cameraX = x;
    this.cameraY = y;
    this.onCameraChange(Math.round(this.zoom * 100));
  }

  /**
   * Convierte coordenadas de pantalla (`clientX`, `clientY`) a coordenadas continuas del mundo.
   * @param {number} clientX
   * @param {number} clientY
   * @returns {{ x: number, y: number }}
   */
  screenToWorld(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    const cx = (clientX - rect.left) - (rect.width / 2);
    const cy = (clientY - rect.top) - (rect.height / 2);
    return {
      x: (cx / this.zoom) + this.cameraX,
      y: (cy / this.zoom) + this.cameraY
    };
  }

  /**
   * Ajusta el zoom multiplicando por `factor`, opcionalmente anclado a un punto de pantalla.
   * @param {number} factor
   * @param {number|null} [clientX=null]
   * @param {number|null} [clientY=null]
   */
  adjustZoomAt(factor, clientX = null, clientY = null) {
    const prevZoom = this.zoom;
    const newZoom = Math.min(this.maxZoom, Math.max(this.minZoom, prevZoom * factor));
    if (newZoom === prevZoom) return;

    if (typeof clientX === 'number' && typeof clientY === 'number') {
      const worldBefore = this.screenToWorld(clientX, clientY);
      this.zoom = newZoom;
      const worldAfter = this.screenToWorld(clientX, clientY);
      this.cameraX += worldBefore.x - worldAfter.x;
      this.cameraY += worldBefore.y - worldAfter.y;
    } else {
      this.zoom = newZoom;
    }

    this.onCameraChange(Math.round(this.zoom * 100));
  }

  /**
   * Calcula los límites visibles actuales del mundo para `Tilemap.render`.
   * @param {number} cssWidth
   * @param {number} cssHeight
   * @param {number} [margin=0]
   * @returns {{ minX: number, maxX: number, minY: number, maxY: number }}
   */
  getVisibleWorldBounds(cssWidth, cssHeight, margin = 0) {
    const halfVw = cssWidth / (2 * this.zoom);
    const halfVh = cssHeight / (2 * this.zoom);
    return {
      minX: this.cameraX - halfVw - margin,
      maxX: this.cameraX + halfVw + margin,
      minY: this.cameraY - halfVh - margin,
      maxY: this.cameraY + halfVh + margin
    };
  }

  /** @private */
  _getTwoPointerMetrics() {
    const pts = Array.from(this._activePointers.values());
    const p0 = pts[0];
    const p1 = pts[1];
    const dx = p1.x - p0.x;
    const dy = p1.y - p0.y;
    return {
      dist: Math.hypot(dx, dy) || 1,
      midX: (p0.x + p1.x) / 2,
      midY: (p0.y + p1.y) / 2
    };
  }

  /** @private */
  _handlePointerDown(e) {
    this._activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (typeof this.canvas.setPointerCapture === 'function') {
      try {
        this.canvas.setPointerCapture(e.pointerId);
      } catch (_) {
        // Ignorar si el navegador rechaza captura en punteros sintéticos
      }
    }

    if (this._activePointers.size === 2) {
      // Transición inmediata a gesto multitáctil (Pinch + Pan a 2 dedos)
      this.isMultiTouchGesture = true;
      this._isSinglePanning = false;
      this.onCancelSingleStroke();
      const m = this._getTwoPointerMetrics();
      this._prevPinchDist = m.dist;
      this._prevPinchMid = { x: m.midX, y: m.midY };
      return;
    }

    if (this._activePointers.size > 2 || this.isMultiTouchGesture) {
      return;
    }

    if (e.button === 1 || e.button === 2 || e.spaceKey || this.isPanToolActive()) {
      this._isSinglePanning = true;
      this._panStart = { x: e.clientX, y: e.clientY };
      this._camStart = { x: this.cameraX, y: this.cameraY };
      this.canvas.style.cursor = 'grabbing';
      return;
    }

    this.onSingleDown(e);
  }

  /** @private */
  _handlePointerMove(e) {
    if (this._activePointers.has(e.pointerId)) {
      this._activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    }

    if (this.isMultiTouchGesture && this._activePointers.size >= 2) {
      const m = this._getTwoPointerMetrics();
      const dx = m.midX - this._prevPinchMid.x;
      const dy = m.midY - this._prevPinchMid.y;

      this.cameraX -= dx / this.zoom;
      this.cameraY -= dy / this.zoom;

      const scaleFactor = m.dist / (this._prevPinchDist || m.dist);
      if (Math.abs(scaleFactor - 1) > 0.004) {
        this.adjustZoomAt(scaleFactor, m.midX, m.midY);
      } else {
        this.onCameraChange(Math.round(this.zoom * 100));
      }

      this._prevPinchDist = m.dist;
      this._prevPinchMid = { x: m.midX, y: m.midY };
      return;
    }

    if (this.isMultiTouchGesture) return;

    if (this._isSinglePanning) {
      const dx = (e.clientX - this._panStart.x) / this.zoom;
      const dy = (e.clientY - this._panStart.y) / this.zoom;
      this.cameraX = this._camStart.x - dx;
      this.cameraY = this._camStart.y - dy;
      this.onCameraChange(Math.round(this.zoom * 100));
      return;
    }

    this.onSingleMove(e);
  }

  /** @private */
  _handlePointerUp(e) {
    this._activePointers.delete(e.pointerId);

    if (this.isMultiTouchGesture) {
      if (this._activePointers.size === 0) {
        this.isMultiTouchGesture = false;
      }
      return;
    }

    if (this._isSinglePanning) {
      this._isSinglePanning = false;
      this.canvas.style.cursor = this.isPanToolActive() ? 'grab' : 'crosshair';
      return;
    }

    this.onSingleUp(e);
  }

  /** @private */
  _handleWheel(e) {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.15 : 0.87;
    this.adjustZoomAt(factor, e.clientX, e.clientY);
  }
}


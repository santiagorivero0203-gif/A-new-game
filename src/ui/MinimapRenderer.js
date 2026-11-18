/**
 * @module MinimapRenderer
 * @description Renderizador de Minimapa táctico autónomo (Zero-Coupling) con horneado estático
 * 1px/tile, Niebla de Guerra comprimida en Bitset `Uint32Array` y actualización dosificada (~12 Hz).
 *
 * Principios de arquitectura:
 * - No importa Tilemap, Player, Enemy, ChunkManager ni WorldMemoryStore.
 * - Recibe datos planos (`grid`, dimensiones, paleta opcional) y una lista reciclada de marcadores.
 * - Soporta colapso por toque/clic (`toggleCollapsed`) para pantallas móviles reducidas.
 *
 * @author Be a Legend Team
 * @version 1.0.0
 */
export class MinimapRenderer {
  /**
   * @param {HTMLCanvasElement|null} [canvas=null] - Elemento `<canvas>` del HUD
   * @param {HTMLElement|null} [wrapperEl=null] - Contenedor DOM interactivo para colapsar
   * @param {Object} [options]
   * @param {number} [options.refreshInterval=0.082] - Intervalo de refresco (~12 Hz)
   * @param {number} [options.chunkSize=8] - Tiles por chunk de Niebla de Guerra
   * @param {number} [options.viewRadiusTiles=26] - Radio de tiles visibles alrededor del jugador
   */
  constructor(canvas = null, wrapperEl = null, options = {}) {
    this.canvas = canvas;
    this.ctx = (canvas && typeof canvas.getContext === 'function') ? canvas.getContext('2d') : null;
    this.wrapperEl = wrapperEl;
    this.refreshInterval = options.refreshInterval ?? 0.165;
    this.chunkSize = options.chunkSize ?? 8;
    this.viewRadiusTiles = options.viewRadiusTiles ?? 26;

    this.cols = 0;
    this.rows = 0;
    this.tileSize = 32;
    this.chunkCols = 0;
    this.chunkRows = 0;
    /** @type {Uint32Array|null} Bitset comprimido de chunks explorados */
    this.exploredBitset = null;

    this._terrainCanvas = null;
    this._terrainCtx = null;
    this._renderAccum = 0;
    this._dirty = true;
    this._lastRevealTileX = -9999;
    this._lastRevealTileY = -9999;
    this.collapsed = false;

    if (this.wrapperEl && typeof this.wrapperEl.addEventListener === 'function') {
      this._onToggleClick = (e) => {
        e.stopPropagation();
        this.toggleCollapsed();
      };
      this.wrapperEl.addEventListener('click', this._onToggleClick);
      this.wrapperEl.addEventListener('touchstart', (e) => e.stopPropagation(), { passive: true });
    }
  }

  /**
   * Alterna entre modo expandido (radar visual) y modo compacto en móvil.
   * @param {boolean} [forceState]
   */
  toggleCollapsed(forceState) {
    this.collapsed = forceState !== undefined ? Boolean(forceState) : !this.collapsed;
    if (this.wrapperEl && this.wrapperEl.classList) {
      this.wrapperEl.classList.toggle('is-collapsed', this.collapsed);
    }
    if (!this.collapsed) {
      this._dirty = true;
    }
  }

  /**
   * Convierte un color `#rrggbb` en tupla `[r, g, b]` sin asignaciones en bucle.
   * @private
   */
  _hexToRgb(hex, fallback) {
    if (typeof hex !== 'string' || hex[0] !== '#' || (hex.length !== 7 && hex.length !== 4)) {
      return fallback;
    }
    if (hex.length === 4) {
      return [
        parseInt(hex[1] + hex[1], 16),
        parseInt(hex[2] + hex[2], 16),
        parseInt(hex[3] + hex[3], 16)
      ];
    }
    return [
      parseInt(hex.slice(1, 3), 16),
      parseInt(hex.slice(3, 5), 16),
      parseInt(hex.slice(5, 7), 16)
    ];
  }

  /**
   * Construye una tabla LUT plana de colores (tiles 0..5) reciclando la paleta activa del bioma.
   * @private
   */
  _buildPaletteLut(palette = null) {
    const pal = palette || {};
    return [
      this._hexToRgb(pal.grassBase, [46, 138, 66]),   // 0: Césped / Suelo bioma
      this._hexToRgb(pal.dirtBase, [154, 102, 66]),   // 1: Sendero / Tierra / Ceniza
      this._hexToRgb(pal.cliffFace, [51, 65, 85]),    // 2: Acantilado / Muro sólido
      this._hexToRgb(pal.waterBase, [14, 116, 194]),  // 3: Agua / Magma / Vacío
      this._hexToRgb(pal.bridgeBase, [146, 64, 14]),  // 4: Puente / Pasarela
      this._hexToRgb(pal.plazaBase, [148, 163, 184])  // 5: Plaza / Cristal
    ];
  }

  /**
   * Hornea una sola vez el bitmap estático del terreno (1 píxel por tile) e inicializa Niebla de Guerra.
   * @param {Array<Array<number>>} grid - Matriz 2D de tiles
   * @param {number} cols
   * @param {number} rows
   * @param {number} [tileSize=32]
   * @param {Object|null} [palette=null] - Paleta plana reciclada (`Tilemap.getActivePalette()`)
   * @param {Uint32Array|Array<number>|null} [restoredMask=null]
   */
  setMapData(grid, cols, rows, tileSize = 32, palette = null, restoredMask = null) {
    this.cols = Math.max(1, cols | 0);
    this.rows = Math.max(1, rows | 0);
    this.tileSize = Math.max(8, tileSize || 32);

    this.chunkCols = Math.ceil(this.cols / this.chunkSize);
    this.chunkRows = Math.ceil(this.rows / this.chunkSize);
    const totalChunks = this.chunkCols * this.chunkRows;
    const neededWords = Math.max(1, Math.ceil(totalChunks / 32));
    this.exploredBitset = new Uint32Array(neededWords);

    if (restoredMask && restoredMask.length === neededWords) {
      this.exploredBitset.set(restoredMask);
    }

    if (typeof document !== 'undefined') {
      if (!this._terrainCanvas) {
        this._terrainCanvas = document.createElement('canvas');
        this._terrainCtx = this._terrainCanvas.getContext('2d');
      }
      this._terrainCanvas.width = this.cols;
      this._terrainCanvas.height = this.rows;

      if (this._terrainCtx && Array.isArray(grid) && typeof this._terrainCtx.createImageData === 'function') {
        const lut = this._buildPaletteLut(palette);
        const img = this._terrainCtx.createImageData(this.cols, this.rows);
        const data = img.data;
        for (let r = 0; r < this.rows; r++) {
          const rowArr = grid[r];
          for (let c = 0; c < this.cols; c++) {
            const tileId = rowArr ? (rowArr[c] ?? 0) : 0;
            const rgb = lut[tileId] || lut[0];
            const idx = (r * this.cols + c) * 4;
            data[idx] = rgb[0];
            data[idx + 1] = rgb[1];
            data[idx + 2] = rgb[2];
            data[idx + 3] = 255;
          }
        }
        this._terrainCtx.putImageData(img, 0, 0);
      }
    }

    this._renderAccum = this.refreshInterval;
    this._dirty = true;
    this._lastRevealTileX = -9999;
    this._lastRevealTileY = -9999;
  }

  /**
   * Comprueba en O(1) si este frame toca actualizar el buffer del minimapa sin escanear marcadores antes de tiempo.
   * @param {number} dt
   * @returns {boolean}
   */
  shouldUpdate(dt = 0) {
    if (this.collapsed || !this.canvas || !this.ctx || this.cols <= 0 || this.rows <= 0) return false;
    return this._dirty || (this._renderAccum + dt >= this.refreshInterval);
  }

  /**
   * Solo actualiza la Niebla de Guerra cuando el jugador cambia de loseta (descarte instantáneo en 98% de frames).
   * @param {number} worldX
   * @param {number} worldY
   * @param {number} [radiusTiles=6]
   * @returns {boolean}
   */
  revealIfMovedTile(worldX, worldY, radiusTiles = 6) {
    if (this.cols <= 0 || this.tileSize <= 0) return false;
    const tx = Math.floor(worldX / this.tileSize);
    const ty = Math.floor(worldY / this.tileSize);
    if (tx === this._lastRevealTileX && ty === this._lastRevealTileY) {
      return false;
    }
    this._lastRevealTileX = tx;
    this._lastRevealTileY = ty;
    return this.revealAroundWorldPos(worldX, worldY, radiusTiles);
  }

  /**
   * Compone el minimapa offscreen directamente sobre `#main-canvas` en una sola copia GPU
   * evitando mantener un segundo `<canvas>` visible en el DOM Overlay.
   * @param {CanvasRenderingContext2D} targetCtx
   * @param {number} rightEdgeX
   * @param {number} topY
   * @param {number} [drawSize=64]
   */
  compositeTo(targetCtx, rightEdgeX, topY, drawSize = 64) {
    if (this.collapsed || !targetCtx || !this.canvas || this.cols <= 0 || this.rows <= 0) return;
    const dx = Math.round(rightEdgeX - drawSize);
    const dy = Math.round(topY);
    targetCtx.fillStyle = '#050811';
    targetCtx.fillRect(dx - 2, dy - 2, drawSize + 4, drawSize + 4);
    targetCtx.fillStyle = '#334155';
    targetCtx.fillRect(dx - 1, dy - 1, drawSize + 2, drawSize + 2);
    targetCtx.drawImage(this.canvas, dx, dy, drawSize, drawSize);
  }

  /**
   * Exporta una copia compacta de los bits de Niebla de Guerra explorados para `WorldMemoryStore`.
   * @returns {Uint32Array|null}
   */
  exportExploredMask() {
    return this.exploredBitset ? new Uint32Array(this.exploredBitset) : null;
  }

  /**
   * Marca como explorados los chunks de Niebla de Guerra alrededor de `(worldX, worldY)`.
   * @param {number} worldX
   * @param {number} worldY
   * @param {number} [radiusTiles=6]
   * @returns {boolean} True si se reveló al menos un chunk nuevo
   */
  revealAroundWorldPos(worldX, worldY, radiusTiles = 6) {
    if (!this.exploredBitset || this.chunkCols <= 0 || this.chunkRows <= 0) return false;

    const tx = Math.floor(worldX / this.tileSize);
    const ty = Math.floor(worldY / this.tileSize);
    const minC = Math.max(0, Math.floor((tx - radiusTiles) / this.chunkSize));
    const maxC = Math.min(this.chunkCols - 1, Math.floor((tx + radiusTiles) / this.chunkSize));
    const minR = Math.max(0, Math.floor((ty - radiusTiles) / this.chunkSize));
    const maxR = Math.min(this.chunkRows - 1, Math.floor((ty + radiusTiles) / this.chunkSize));

    let changed = false;
    for (let cr = minR; cr <= maxR; cr++) {
      for (let cc = minC; cc <= maxC; cc++) {
        const bitIdx = cr * this.chunkCols + cc;
        const wordIdx = bitIdx >>> 5;
        const mask = 1 << (bitIdx & 31);
        if ((this.exploredBitset[wordIdx] & mask) === 0) {
          this.exploredBitset[wordIdx] |= mask;
          changed = true;
        }
      }
    }
    if (changed) this._dirty = true;
    return changed;
  }

  /**
   * Indica si un chunk `(cc, cr)` ya ha sido explorado.
   * @param {number} cc
   * @param {number} cr
   * @returns {boolean}
   */
  isChunkExplored(cc, cr) {
    if (!this.exploredBitset) return true;
    if (cc < 0 || cr < 0 || cc >= this.chunkCols || cr >= this.chunkRows) return false;
    const bitIdx = cr * this.chunkCols + cc;
    return (this.exploredBitset[bitIdx >>> 5] & (1 << (bitIdx & 31))) !== 0;
  }

  /**
   * Renderiza el minimapa con limitador de frecuencia (~12 Hz).
   * @param {number} dt
   * @param {number} playerX - Posición X en mundo del jugador
   * @param {number} playerY - Posición Y en mundo del jugador
   * @param {Array<{x: number, y: number, kind: string}>} [markers=[]] - Lista reciclada de marcadores
   * @param {boolean} [force=false]
   * @returns {boolean} True si redibujó este frame
   */
  render(dt, playerX, playerY, markers = [], force = false) {
    if (this.collapsed || !this.canvas || !this.ctx || this.cols <= 0 || this.rows <= 0) {
      return false;
    }

    this._renderAccum += dt;
    if (!force && !this._dirty && this._renderAccum < this.refreshInterval) {
      return false;
    }
    this._renderAccum = 0;
    this._dirty = false;

    const ctx = this.ctx;
    const cw = this.canvas.width;
    const ch = this.canvas.height;
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#070b14';
    ctx.fillRect(0, 0, cw, ch);

    const pTileX = playerX / this.tileSize;
    const pTileY = playerY / this.tileSize;
    const spanTiles = this.viewRadiusTiles * 2;
    const srcW = Math.min(this.cols, spanTiles);
    const srcH = Math.min(this.rows, spanTiles);

    const camMinTileX = Math.max(0, Math.min(this.cols - srcW, pTileX - srcW * 0.5));
    const camMinTileY = Math.max(0, Math.min(this.rows - srcH, pTileY - srcH * 0.5));
    const scaleX = cw / srcW;
    const scaleY = ch / srcH;

    // 1. Terreno pre-horneado 1px/tile escalado en una sola llamada
    if (this._terrainCanvas) {
      ctx.drawImage(this._terrainCanvas, camMinTileX, camMinTileY, srcW, srcH, 0, 0, cw, ch);
    }

    // 2. Ocultar chunks no explorados (Niebla de Guerra por Bitset)
    if (this.exploredBitset) {
      const startCC = Math.max(0, Math.floor(camMinTileX / this.chunkSize));
      const endCC = Math.min(this.chunkCols - 1, Math.floor((camMinTileX + srcW) / this.chunkSize));
      const startCR = Math.max(0, Math.floor(camMinTileY / this.chunkSize));
      const endCR = Math.min(this.chunkRows - 1, Math.floor((camMinTileY + srcH) / this.chunkSize));

      ctx.fillStyle = 'rgba(6, 10, 18, 0.88)';
      for (let cr = startCR; cr <= endCR; cr++) {
        for (let cc = startCC; cc <= endCC; cc++) {
          if (this.isChunkExplored(cc, cr)) continue;
          const rx = Math.floor((cc * this.chunkSize - camMinTileX) * scaleX);
          const ry = Math.floor((cr * this.chunkSize - camMinTileY) * scaleY);
          const rw = Math.ceil(this.chunkSize * scaleX) + 1;
          const rh = Math.ceil(this.chunkSize * scaleY) + 1;
          ctx.fillRect(rx, ry, rw, rh);
        }
      }
    }

    // 3. Marcadores dinámicos reciclados
    const invTile = 1 / this.tileSize;
    for (let i = 0; i < markers.length; i++) {
      const m = markers[i];
      if (!m) continue;
      const mx = (m.x * invTile - camMinTileX) * scaleX;
      const my = (m.y * invTile - camMinTileY) * scaleY;
      if (mx < -2 || mx > cw + 2 || my < -2 || my > ch + 2) continue;

      if (m.kind === 'boss') {
        ctx.fillStyle = '#f97316';
        ctx.fillRect(Math.round(mx - 2.5), Math.round(my - 2.5), 5, 5);
      } else if (m.kind === 'alerted') {
        ctx.fillStyle = '#facc15';
        ctx.fillRect(Math.round(mx - 1.5), Math.round(my - 1.5), 3, 3);
      } else if (m.kind === 'enemy') {
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(Math.round(mx - 1.5), Math.round(my - 1.5), 3, 3);
      } else if (m.kind === 'portal') {
        ctx.fillStyle = '#38bdf8';
        ctx.fillRect(Math.round(mx - 2), Math.round(my - 2), 4, 4);
      } else if (m.kind === 'altar' || m.kind === 'rel_sanctuary') {
        ctx.fillStyle = '#fde047';
        ctx.fillRect(Math.round(mx - 1.5), Math.round(my - 1.5), 3, 3);
      } else if (m.kind === 'npc') {
        ctx.fillStyle = '#4ade80';
        ctx.fillRect(Math.round(mx - 1.5), Math.round(my - 1.5), 3, 3);
      }
    }

    // 4. Jugador centrado encima de todo
    const px = Math.round((pTileX - camMinTileX) * scaleX);
    const py = Math.round((pTileY - camMinTileY) * scaleY);
    ctx.fillStyle = '#0b101d';
    ctx.fillRect(px - 3, py - 3, 6, 6);
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(px - 2, py - 2, 4, 4);

    return true;
  }
}

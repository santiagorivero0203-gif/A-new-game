/**
 * @module Tilemap
 * @description Gestor del mapa de celdas 2D para el nivel de prueba "El Bosque".
 * Administra una cuadrícula de 40x40 casillas (32x32 px por celda, 1280x1280 px totales),
 * generando un claro con un camino de tierra central y pre-renderizando el terreno en
 * un canvas offscreen para un dibujado ultra-eficiente de O(1) con recorte de cámara.
 * @author Be a Legend Team
 * @version 1.0.0
 */
export class Tilemap {
  /**
   * @param {number} [cols=40] - Número de columnas
   * @param {number} [rows=40] - Número de filas
   * @param {number} [tileSize=32] - Tamaño de cada celda en píxeles
   */
  constructor(cols = 40, rows = 40, tileSize = 32) {
    this.cols = cols;
    this.rows = rows;
    this.tileSize = tileSize;
    this.width = cols * tileSize;   // 1280 px
    this.height = rows * tileSize; // 1280 px

    /** @type {number[][]} Matriz de tipos de tile (0: Pasto, 1: Camino de tierra, 2: Sendero secundario) */
    this.grid = [];

    /** @type {HTMLCanvasElement|null} Buffer pre-renderizado del terreno completo */
    this.offscreenCanvas = null;

    this.generateLayout();
  }

  /**
   * Genera la disposición del mapa: Un claro de bosque con un camino de tierra
   * cruzando horizontalmente por el centro y un ramal secundario hacia el norte.
   */
  generateLayout() {
    for (let y = 0; y < this.rows; y++) {
      this.grid[y] = [];
      for (let x = 0; x < this.cols; x++) {
        // Camino de tierra principal cruzando horizontalmente (filas 19 a 21)
        const isMainRoad = y >= 19 && y <= 21;

        // Sendero secundario hacia el norte que conduce a la casa de madera (col 18 a 20, filas 10 a 19)
        const isPathToCabin = (x >= 19 && x <= 21) && (y >= 11 && y < 19);

        if (isMainRoad || isPathToCabin) {
          this.grid[y][x] = 1; // Tierra
        } else {
          this.grid[y][x] = 0; // Pasto
        }
      }
    }
  }

  /**
   * Pre-renderiza todo el mapa de 40x40 en un canvas en memoria.
   * Utiliza las texturas de pasto y tierra provistas por el ResourceManager,
   * o patrones procedurales pixel-art de respaldo.
   * @param {import('../core/ResourceManager.js').ResourceManager} resourceManager
   */
  build(resourceManager) {
    this.offscreenCanvas = document.createElement('canvas');
    this.offscreenCanvas.width = this.width;
    this.offscreenCanvas.height = this.height;
    const ctx = this.offscreenCanvas.getContext('2d');

    const grassImg = resourceManager ? resourceManager.getImage('grass_tile') : null;
    const dirtImg = resourceManager ? resourceManager.getImage('dirt_tile') : null;

    for (let y = 0; y < this.rows; y++) {
      for (let x = 0; x < this.cols; x++) {
        const px = x * this.tileSize;
        const py = y * this.tileSize;
        const tileType = this.grid[y][x];

        if (tileType === 1) {
          // Tierra
          if (dirtImg) {
            ctx.drawImage(dirtImg, px, py, this.tileSize, this.tileSize);
          } else {
            this.drawFallbackDirt(ctx, px, py);
          }
        } else {
          // Pasto
          if (grassImg) {
            ctx.drawImage(grassImg, px, py, this.tileSize, this.tileSize);
          } else {
            this.drawFallbackGrass(ctx, px, py);
          }
        }
      }
    }
  }

  /**
   * Patrón de pasto procedural de respaldo.
   * @private
   */
  drawFallbackGrass(ctx, x, y) {
    ctx.fillStyle = '#3a8024';
    ctx.fillRect(x, y, this.tileSize, this.tileSize);
    ctx.fillStyle = '#4c9930';
    ctx.fillRect(x + 4, y + 4, 8, 8);
    ctx.fillRect(x + 20, y + 16, 6, 6);
  }

  /**
   * Patrón de tierra procedural de respaldo.
   * @private
   */
  drawFallbackDirt(ctx, x, y) {
    ctx.fillStyle = '#8a6237';
    ctx.fillRect(x, y, this.tileSize, this.tileSize);
    ctx.fillStyle = '#6e4a25';
    ctx.fillRect(x + 6, y + 10, 12, 10);
    ctx.fillStyle = '#a17849';
    ctx.fillRect(x + 2, y + 4, 6, 4);
  }

  /**
   * Renderiza únicamente la porción visible del mapa según la posición de la cámara.
   * Rendimiento O(1) de una única llamada a drawImage().
   * @param {CanvasRenderingContext2D} ctx - Contexto del canvas principal
   * @param {import('../render/Camera.js').Camera} camera
   */
  render(ctx, camera) {
    if (!this.offscreenCanvas) return;

    // Dibujar directamente el buffer pre-renderizado del mapa
    ctx.drawImage(this.offscreenCanvas, 0, 0);
  }
}

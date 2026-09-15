/**
 * @module Tilemap
 * @description Gestor del mapa de celdas 2D para el nivel de prueba "El Bosque".
 * Administra una cuadrícula de 40x40 casillas (32x32 px por celda, 1280x1280 px totales),
 * con pasto verde brillante uniforme y un camino de tierra suave al estilo indie 32-bit moderno.
 * Pre-renderiza el terreno en un canvas offscreen para un dibujado ultra-eficiente de O(1).
 * @author Be a Legend Team
 * @version 1.1.0
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

    /** @type {number[][]} Matriz de tipos de tile (0: Pasto, 1: Camino de tierra, 2: Borde suave) */
    this.grid = [];

    /** @type {HTMLCanvasElement|null} Buffer pre-renderizado del terreno completo */
    this.offscreenCanvas = null;

    this.generateLayout();
  }

  /**
   * Genera la disposición del claro: camino de tierra suave cruzando el centro
   * y ramal norte conectando con la cabaña.
   */
  generateLayout() {
    for (let y = 0; y < this.rows; y++) {
      this.grid[y] = [];
      for (let x = 0; x < this.cols; x++) {
        // Camino de tierra principal cruzando horizontalmente (filas 19 a 21)
        const isMainRoad = y >= 19 && y <= 21;

        // Sendero hacia la cabaña al norte (columnas 19 a 21, filas 10 a 19)
        const isPathToCabin = (x >= 19 && x <= 21) && (y >= 10 && y < 19);

        if (isMainRoad || isPathToCabin) {
          this.grid[y][x] = 1; // Tierra
        } else {
          this.grid[y][x] = 0; // Pasto uniforme
        }
      }
    }
  }

  /**
   * Pre-renderiza todo el mapa de 40x40 en un canvas offscreen.
   * Emplea los nuevos assets limpios de 32-bit sin ruido.
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
          // Camino de tierra cálido y limpio
          if (dirtImg) {
            ctx.drawImage(dirtImg, px, py, this.tileSize, this.tileSize);
          } else {
            this.drawModernDirt(ctx, px, py);
          }
        } else {
          // Pasto verde brillante y uniforme (estilo 32-bit moderno sin ruido)
          if (grassImg) {
            ctx.drawImage(grassImg, px, py, this.tileSize, this.tileSize);
          } else {
            this.drawModernGrass(ctx, px, py);
          }
        }
      }
    }
  }

  /**
   * Pasto limpio, verde brillante uniforme estilo indie moderno (32-bit).
   * @private
   */
  drawModernGrass(ctx, x, y) {
    ctx.fillStyle = '#4ade80'; // Verde esmeralda brillante uniforme
    ctx.fillRect(x, y, this.tileSize, this.tileSize);

    // Toque sutil de brizna plana estilizada
    ctx.fillStyle = '#22c55e';
    ctx.fillRect(x + 10, y + 12, 3, 5);
    ctx.fillRect(x + 22, y + 20, 4, 4);
  }

  /**
   * Sendero limpio en tonos beige y terracota suave (32-bit).
   * @private
   */
  drawModernDirt(ctx, x, y) {
    ctx.fillStyle = '#fde68a'; // Arena/tierra beige suave
    ctx.fillRect(x, y, this.tileSize, this.tileSize);

    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(x + 8, y + 14, 10, 6);
  }

  /**
   * Renderiza el terreno en el canvas principal con coste O(1).
   * @param {CanvasRenderingContext2D} ctx
   * @param {import('../render/Camera.js').Camera} camera
   */
  render(ctx, camera) {
    if (!this.offscreenCanvas) return;
    ctx.drawImage(this.offscreenCanvas, 0, 0);
  }
}

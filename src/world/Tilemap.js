/**
 * @module Tilemap
 * @description Motor de terreno pre-horneado de alto rendimiento para mundos Top-Down.
 *
 * Implementa tres mejoras arquitectónicas clave sobre Canvas 2D:
 * 1. **Pre-horneado offscreen O(1)**: Toda la geometría estática del mapa se renderiza una vez
 *    en `offscreenCanvas` y se copia por frame mediante recorte de frustum en `render()`.
 * 2. **Sistema Dual-Grid (-16 px en X/Y)**: Tras pintar la malla lógica, una segunda pasada
 *    desplazada `-tileSize/2` evalúa las 4 esquinas entre losetas vecinas para suavizar
 *    senderos, orillas de ríos y lindes con curvas orgánicas y sin costuras cuadradas.
 * 3. **Proyección de Gabinete (Elevación y Acantilados)**: Los bordes de mesetas (`tile === 2`)
 *    proyectan caras frontales de acantilado y sombra índigo hacia la fila inferior, dotando
 *    al plano cenital de volumen estilo *Eastward* / *The Minish Cap*.
 *
 * @author Be a Legend Team
 * @version 2.0.0
 */

/**
 * Definición cromática Hue-Shifted por bioma para los 4 Mundos de *Be a Legend*.
 * @constant {Record<string, Object>}
 */
export const BIOME_PALETTES = {
  cave_exit_intro: {
    name: 'Claro de las Reliquias',
    grassBase: '#48a842',
    grassMid: '#3b923f',
    grassLight: '#76cf4b',
    grassShadow: '#1f5e42',
    dirtBase: '#b77b4b',
    dirtDark: '#7d4638',
    dirtLight: '#dfab6f',
    cliffTop: '#475569',
    cliffFace: '#334155',
    cliffShadow: '#1e1b4b',
    cliffRim: '#94a3b8',
    waterBase: '#0284c7',
    waterDeep: '#1e3a8a',
    waterFoam: '#bae6fd',
    bridgeBase: '#92400e',
    bridgeGrain: '#581c3a',
    bridgeRim: '#fbbf24',
    plazaBase: '#94a3b8',
    plazaTrim: '#64748b',
    plazaGold: '#eab308',
    flowerA: '#fef08a',
    flowerB: '#fb7185'
  },
  starting_clearing: null, // Alias asignado debajo
  marsh_of_spores: {
    name: 'Pantano de Esporas',
    grassBase: '#134e4a',
    grassMid: '#0f3d3e',
    grassLight: '#2dd4bf',
    grassShadow: '#1e1b4b',
    dirtBase: '#583148',
    dirtDark: '#3b1636',
    dirtLight: '#8e4b66',
    cliffTop: '#312e81',
    cliffFace: '#1e1b4b',
    cliffShadow: '#0f172a',
    cliffRim: '#6366f1',
    waterBase: '#0d9488',
    waterDeep: '#164e63',
    waterFoam: '#5eead4',
    bridgeBase: '#5c2d3a',
    bridgeGrain: '#3b1124',
    bridgeRim: '#2dd4bf',
    plazaBase: '#475569',
    plazaTrim: '#312e81',
    plazaGold: '#5eead4',
    flowerA: '#a855f7',
    flowerB: '#5eead4'
  },
  ash_caldera: {
    name: 'Caldera de Ceniza',
    grassBase: '#292524',
    grassMid: '#1c1917',
    grassLight: '#57534e',
    grassShadow: '#18181b',
    dirtBase: '#5c2818',
    dirtDark: '#3f1518',
    dirtLight: '#9a3412',
    cliffTop: '#3f3f46',
    cliffFace: '#27272a',
    cliffShadow: '#09090b',
    cliffRim: '#fb923c',
    waterBase: '#ea580c',   // Ríos de magma incandescente
    waterDeep: '#991b1b',
    waterFoam: '#fde047',
    bridgeBase: '#475569',  // Puentes de hierro forjado
    bridgeGrain: '#1e293b',
    bridgeRim: '#f97316',
    plazaBase: '#44403c',
    plazaTrim: '#292524',
    plazaGold: '#f97316',
    flowerA: '#fb923c',
    flowerB: '#facc15'
  },
  astral_citadel: {
    name: 'Ciudadela Astral',
    grassBase: '#312e81',
    grassMid: '#1e1b4b',
    grassLight: '#6366f1',
    grassShadow: '#0f172a',
    dirtBase: '#94a3b8',
    dirtDark: '#475569',
    dirtLight: '#e2e8f0',
    cliffTop: '#4338ca',
    cliffFace: '#1e1b4b',
    cliffShadow: '#090919',
    cliffRim: '#a5b4fc',
    waterBase: '#7c3aed',   // Cauces de éter cósmico
    waterDeep: '#2e1065',
    waterFoam: '#f5d0fe',
    bridgeBase: '#0ea5e9',  // Pasarelas de cristal rúnico
    bridgeGrain: '#1e3a8a',
    bridgeRim: '#e0f2fe',
    plazaBase: '#cbd5e1',
    plazaTrim: '#64748b',
    plazaGold: '#facc15',
    flowerA: '#e879f9',
    flowerB: '#38bdf8'
  }
};
BIOME_PALETTES.starting_clearing = BIOME_PALETTES.cave_exit_intro;

export class Tilemap {
  /**
   * @param {number} [cols=40] - Columnas de la cuadrícula lógica.
   * @param {number} [rows=40] - Filas de la cuadrícula lógica.
   * @param {number} [tileSize=32] - Tamaño en px por loseta lógica.
   * @param {string} [layoutPreset='starting_clearing'] - Bioma o preset de disposición.
   * @param {number[][]|null} [customGrid=null] - Matriz explícita `[row][col]` opcional desde JSON.
   */
  constructor(cols = 40, rows = 40, tileSize = 32, layoutPreset = 'starting_clearing', customGrid = null) {
    this.cols = cols;
    this.rows = rows;
    this.tileSize = tileSize;
    this.layoutPreset = layoutPreset;
    this.biomeKey = BIOME_PALETTES[layoutPreset] ? layoutPreset : 'cave_exit_intro';
    this.width = cols * tileSize;
    this.height = rows * tileSize;

    /** @type {number[][]} Matriz 2D [row][col] de IDs de terreno (0..5) */
    this.grid = [];
    /** @type {HTMLCanvasElement|null} Lienzo pre-horneado del nivel completo */
    this.offscreenCanvas = null;

    if (Array.isArray(customGrid) && customGrid.length === rows) {
      this.grid = customGrid.map(row => row.slice());
    } else {
      this.generateLayout();
    }
  }

  /**
   * Reconfigura dimensiones, bioma y grilla del tilemap al cambiar de Mundo y lo reconstruye.
   * @param {Object} levelData - Metadatos del nivel JSON.
   * @param {import('../core/ResourceManager.js').ResourceManager|null} [resourceManager=null]
   */
  reconfigureFromLevel(levelData, resourceManager = null) {
    const mapCfg = levelData.map || levelData;
    this.cols = mapCfg.cols || levelData.cols || 40;
    this.rows = mapCfg.rows || levelData.rows || 40;
    this.tileSize = mapCfg.tileSize || levelData.tileSize || 32;
    this.layoutPreset = levelData.layoutPreset || levelData.biome || 'cave_exit_intro';
    this.biomeKey = BIOME_PALETTES[levelData.biome || this.layoutPreset]
      ? (levelData.biome || this.layoutPreset)
      : 'cave_exit_intro';
    this.width = this.cols * this.tileSize;
    this.height = this.rows * this.tileSize;

    if (Array.isArray(levelData.terrainGrid) && levelData.terrainGrid.length === this.rows) {
      this.grid = levelData.terrainGrid.map(row => row.slice());
    } else {
      this.generateLayout();
    }

    this.build(resourceManager);
  }

  /**
   * Obtiene el valor seguro de una celda o retorna el terreno base del borde.
   * @param {number} col
   * @param {number} row
   * @returns {number}
   */
  getTile(col, row) {
    if (row < 0 || row >= this.rows || col < 0 || col >= this.cols) {
      return 0;
    }
    return this.grid[row][col];
  }

  /**
   * Genera el plano lógico del terreno acorde al `layoutPreset` / bioma activo.
   */
  generateLayout() {
    this.grid = [];
    for (let y = 0; y < this.rows; y++) {
      const row = new Array(this.cols).fill(0);
      this.grid.push(row);
    }

    if (this.layoutPreset === 'cave_exit_intro') {
      this._generateCaveExitLayout();
    } else if (this.layoutPreset === 'marsh_of_spores') {
      this._generateMarshLayout();
    } else if (this.layoutPreset === 'ash_caldera') {
      this._generateAshCalderaLayout();
    } else if (this.layoutPreset === 'astral_citadel') {
      this._generateAstralCitadelLayout();
    } else {
      this._generateDefaultClearingLayout();
    }
  }

  /**
   * Diseño de Prólogo: Mundo 1 — Claro de las Reliquias (`cave_exit_intro`).
   * @private
   */
  /**
   * Diseña el nivel inicial ("cave_exit_intro") como un mundo cohesivo de 5 zonas:
   * - Zona 1 (NO): Acantilado norte, boca de cueva y patio empedrado inicial.
   * - Zona 2 (SO): Ruina anfiteatro en piedra tallada con contrafuertes de acantilado y Acantilado Sur.
   * - Zona 3 (Centro): Río sereno recto en el vado y puente de madera unificado 5x3 (x=22..26, y=17..19).
   * - Zona 4 (NE): Acantilado norte, memorial de la gran espada, sendero y claro de emboscada de Valerio.
   * - Zona 5 (Este): Gran Plaza del Santuario y terraza oriental del portal.
   * @private
   */
  _generateCaveExitLayout() {
    for (let y = 0; y < this.rows; y++) {
      for (let x = 0; x < this.cols; x++) {
        // 1. Caminos de tierra batida (capa base vial antes de plazas, acantilados y río)
        if (y >= 6 && y <= 8 && x >= 11 && x <= 14) {
          this.grid[y][x] = 1;
        }
        if (x >= 13 && x <= 15 && y >= 8 && y <= 24) {
          this.grid[y][x] = 1;
        }
        if (y >= 17 && y <= 19 && x >= 14 && x <= 38) {
          this.grid[y][x] = 1;
        }
        // Ramal norte hacia la emboscada de Valerio y claro norte
        if (x >= 33 && x <= 35 && y >= 8 && y <= 17) {
          this.grid[y][x] = 1;
        }
        if (x >= 32 && x <= 39 && y >= 7 && y <= 11) {
          this.grid[y][x] = 1;
        }

        // 2. Plazas de losas talladas del Santuario (tile = 5)
        // Zona 1: Patio exterior de la cueva (NO)
        if (x >= 5 && x <= 10 && y >= 5 && y <= 9) {
          this.grid[y][x] = 5;
        }
        // Zona 2: Ruina anfiteatro (SO) centrada en (14, 27), r <= 3.5
        const dxSw = x - 14;
        const dySw = y - 27;
        if (dxSw * dxSw + dySw * dySw <= 12.25) {
          this.grid[y][x] = 5;
        }
        // Zona 4: Memorial de la gran espada al cruzar el puente (x=28..30, y=15..17)
        if (x >= 28 && x <= 30 && y >= 15 && y <= 17) {
          this.grid[y][x] = 5;
        }
        // Zona 5: Gran Plaza del Santuario (42, 21), r <= 6.5 y terraza del portal oriental
        const dxPlaza = x - 42;
        const dyPlaza = y - 21;
        if (dxPlaza * dxPlaza + dyPlaza * dyPlaza <= 42.25) {
          this.grid[y][x] = 5;
        }
        if (x >= 48 && x <= 51 && y >= 17 && y <= 20) {
          this.grid[y][x] = 5;
        }

        // 3. Mesetas y acantilados en Proyección de Gabinete (tile = 2)
        // Acantilado norte sobre la salida de la cueva
        if (y <= 3 && x <= 21) {
          this.grid[y][x] = 2;
        }
        // Contrafuertes de acantilado flanqueando el acceso a la ruina SO y reborde sur lejano
        if (y >= 22 && y <= 23 && ((x >= 8 && x <= 11) || (x >= 17 && x <= 20))) {
          this.grid[y][x] = 2;
        }
        if (y >= 34 && x <= 20) {
          this.grid[y][x] = 2;
        }
        // Meseta norte del valle este (sobre el claro de Valerio)
        if (y <= 5 && x >= 28 && x <= 52) {
          this.grid[y][x] = 2;
        }

        // 4. Río cristalino: recto en y=15..21 sobre col 24 (x=23..25) y curvo en extremos
        let streamCenterX = 24;
        if (y < 15) {
          streamCenterX = 24 - Math.sin((15 - y) * 0.22) * 1.8;
        } else if (y > 21) {
          streamCenterX = 24 + Math.sin((y - 21) * 0.22) * 1.8;
        }
        if (Math.abs(x - streamCenterX) < 1.55) {
          this.grid[y][x] = 3;
        }

        // 5. Puente de madera unificado 5x3 (x=22..26, y=17..19) encima del cauce
        if (y >= 17 && y <= 19 && x >= 22 && x <= 26) {
          this.grid[y][x] = 4;
        }
      }
    }
  }

  /**
   * Mundo 2: Pantano de Esporas Bioluminiscentes (`marsh_of_spores`).
   * @private
   */
  _generateMarshLayout() {
    for (let y = 0; y < this.rows; y++) {
      for (let x = 0; x < this.cols; x++) {
        // Borde norte elevado con acantilados musgosos
        if (y <= 3 || (x <= 4 && y <= 12)) {
          this.grid[y][x] = 2;
        }

        // Dos lagunas y canales pantanosos interconectados
        const lagoonA = Math.hypot(x - 16, y - 14) < 4.8;
        const lagoonB = Math.hypot(x - 35, y - 22) < 5.5;
        const channel = Math.abs(y - (15 + Math.sin(x * 0.22) * 3.2)) < 1.5 && x >= 14 && x <= 38;
        if (lagoonA || lagoonB || channel) {
          this.grid[y][x] = 3;
        }

        // Camino de barro elevado
        if (y >= 19 && y <= 21 && x >= 5 && x <= 48) {
          if (this.grid[y][x] === 3) {
            this.grid[y][x] = 4; // Puente de madera podrida/reforzada sobre canales
          } else {
            this.grid[y][x] = 1;
          }
        }

        // Cruce vertical puente norte-sur sobre canal
        if (x >= 25 && x <= 27 && y >= 7 && y <= 28) {
          this.grid[y][x] = this.grid[y][x] === 3 ? 4 : 1;
        }

        // Ruinas inundadas del Santuario
        if (Math.hypot(x - 42, y - 12) <= 4.5) {
          this.grid[y][x] = 5;
        }
      }
    }
  }

  /**
   * Mundo 3: Caldera de Ceniza (`ash_caldera`).
   * @private
   */
  _generateAshCalderaLayout() {
    for (let y = 0; y < this.rows; y++) {
      for (let x = 0; x < this.cols; x++) {
        // Mesetas volcánicas norte y esquinas
        if (y <= 4 || (y >= 5 && y <= 9 && (x <= 8 || x >= 44))) {
          this.grid[y][x] = 2;
        }

        // Río bifurcado de magma incandescente
        const lavaX = 27 + Math.sin(y * 0.19) * 3.5;
        if (Math.abs(x - lavaX) < 1.8) {
          this.grid[y][x] = 3;
        }
        if (y >= 26 && y <= 29 && Math.abs(x - 14) < 6) {
          this.grid[y][x] = 3;
        }

        // Sendero de obsidiana hacia la Forja
        if (y >= 17 && y <= 20 && x >= 5 && x <= 48) {
          this.grid[y][x] = Math.abs(x - lavaX) < 2.6 ? 4 : 1;
        }

        // Crisol / Arena central de Forja
        if (Math.hypot(x - 41, y - 20) <= 6.2) {
          this.grid[y][x] = 5;
        }
      }
    }
  }

  /**
   * Mundo 4: Ciudadela Astral (`astral_citadel`).
   * @private
   */
  _generateAstralCitadelLayout() {
    for (let y = 0; y < this.rows; y++) {
      for (let x = 0; x < this.cols; x++) {
        // Fosos de éter que enmarcan la ciudadela flotante
        if (x <= 2 || x >= this.cols - 3 || y <= 2 || y >= this.rows - 3) {
          this.grid[y][x] = 3;
          continue;
        }

        // Terrazas superiores de cuarzo celestial
        if (y >= 3 && y <= 7 && x >= 10 && x <= this.cols - 11) {
          this.grid[y][x] = 2;
        }

        // Canal estelar vertical
        if ((x === 18 || x === 19) && y >= 8 && y <= this.rows - 5) {
          this.grid[y][x] = 3;
        }

        // Calzada ceremonial + puente cristalino
        if (y >= 17 && y <= 20 && x >= 5 && x <= this.cols - 6) {
          this.grid[y][x] = (x === 18 || x === 19) ? 4 : 1;
        }

        // Gran Granate / Corazón del Santuario Astral
        if (Math.hypot(x - 36, y - 19) <= 8) {
          this.grid[y][x] = 5;
        }
      }
    }
  }

  /**
   * Layout base de claro inicial clásico.
   * @private
   */
  _generateDefaultClearingLayout() {
    for (let y = 0; y < this.rows; y++) {
      for (let x = 0; x < this.cols; x++) {
        if ((x === 18 || x === 19) && y >= 5 && y <= 34) this.grid[y][x] = 1;
        if ((y === 19 || y === 20) && x >= 5 && x <= 34) this.grid[y][x] = 1;
        if (x >= 16 && x <= 21 && y >= 17 && y <= 22) this.grid[y][x] = 1;
        if ((x === 3 || x === 4) && y < 12) this.grid[y][x] = 2;
      }
    }
  }

  /**
   * Pre-hornea todo el terreno sobre `this.offscreenCanvas` ejecutando:
   * - Pasada 1: Base por celda (o tiles PNG procedurales en el claro clásico).
   * - Pasada 2: **Sistema Dual-Grid** desplazado `-tileSize / 2` (-16 px) para curvas orgánicas.
   * - Pasada 3: **Proyección de Gabinete** en frentes de acantilado (`tile === 2`).
   * @param {import('../core/ResourceManager.js').ResourceManager|null} [resourceManager=null]
   */
  build(resourceManager = null) {
    this.offscreenCanvas = document.createElement('canvas');
    this.offscreenCanvas.width = this.width;
    this.offscreenCanvas.height = this.height;
    const ctx = this.offscreenCanvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    const pal = BIOME_PALETTES[this.biomeKey] || BIOME_PALETTES.cave_exit_intro;

    // -----------------------------------------------------------------------
    // PASADA 1: Malla lógica de losetas base con variación procedural orgánica
    // (sin repetir texturas estáticas en cuadrícula)
    // -----------------------------------------------------------------------
    for (let y = 0; y < this.rows; y++) {
      for (let x = 0; x < this.cols; x++) {
        const tileId = this.grid[y][x];
        const px = x * this.tileSize;
        const py = y * this.tileSize;

        if (tileId === 0) {
          this._drawBiomeTurf(ctx, px, py, x, y, pal);
        } else if (tileId === 1) {
          this._drawBiomeDirt(ctx, px, py, x, y, pal);
        } else if (tileId === 2) {
          this._drawBiomeCliffTop(ctx, px, py, x, y, pal);
        } else if (tileId === 3) {
          this._drawBiomeWater(ctx, px, py, x, y, pal);
        } else if (tileId === 4) {
          this._drawBiomeBridge(ctx, px, py, x, y, pal);
        } else if (tileId === 5) {
          this._drawBiomePlaza(ctx, px, py, x, y, pal);
        }
      }
    }

    // -----------------------------------------------------------------------
    // PASADA 2: Autotiling pixel-art de bordes con rectángulos enteros
    // (cubre riberas, voladizos de hierba sobre caminos y bordes de plazas)
    // -----------------------------------------------------------------------
    this._renderDualGridPass(ctx, pal);

    // -----------------------------------------------------------------------
    // PASADA 3: Proyección de Gabinete (Muros frontales de acantilados)
    // -----------------------------------------------------------------------
    this._renderCabinetCliffs(ctx, pal);
  }

  /**
   * Hash determinista 2D para evitar repeticiones visuales en hierba, tierra y agua.
   * @param {number} x - Coordenada X en losetas.
   * @param {number} y - Coordenada Y en losetas.
   * @param {number} [salt=0] - Semilla adicional por capa.
   * @returns {number} Entero de 32 bits sin signo.
   * @private
   */
  _hash2D(x, y, salt = 0) {
    let h = (Math.imul(x + 11, 374761393) ^ Math.imul(y + 17, 668265263) ^ Math.imul(salt + 31, 1442695041)) >>> 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
    return (h ^ (h >>> 16)) >>> 0;
  }

  /**
   * Dibuja transiciones orgánicas pixel-art en bordes usando exclusivamente `fillRect` enteros.
   * Elimina cualquier artefacto de círculos flotantes y limpia el encuentro entre agua, puente,
   * senderos y plazas talladas.
   * @private
   * @param {CanvasRenderingContext2D} ctx
   * @param {Object} pal
   */
  _renderDualGridPass(ctx, pal) {
    const ts = this.tileSize;
    const isLand = (id) => id === 0 || id === 1 || id === 5;

    for (let y = 0; y < this.rows; y++) {
      for (let x = 0; x < this.cols; x++) {
        const tileId = this.grid[y][x];
        const px = x * ts;
        const py = y * ts;
        const top = y > 0 ? this.grid[y - 1][x] : tileId;
        const bot = y < this.rows - 1 ? this.grid[y + 1][x] : tileId;
        const left = x > 0 ? this.grid[y][x - 1] : tileId;
        const right = x < this.cols - 1 ? this.grid[y][x + 1] : tileId;
        const h = this._hash2D(x, y, 7);

        // 1. Voladizos escalonados de hierba sobre caminos de tierra batida (tile === 1)
        if (tileId === 1) {
          if (top === 0) {
            ctx.fillStyle = pal.grassShadow;
            ctx.fillRect(px, py, ts, 2);
            ctx.fillStyle = pal.grassBase;
            ctx.fillRect(px + (h & 3), py, 9, 3);
            ctx.fillRect(px + 13, py, 10, 2);
            ctx.fillRect(px + 25, py, 6, 3);
            ctx.fillStyle = pal.grassLight;
            ctx.fillRect(px + 4, py, 4, 2);
            ctx.fillRect(px + 18, py, 3, 1);
          }
          if (bot === 0) {
            ctx.fillStyle = pal.grassShadow;
            ctx.fillRect(px, py + ts - 3, ts, 3);
            ctx.fillStyle = pal.grassBase;
            ctx.fillRect(px + 2, py + ts - 2, 11, 2);
            ctx.fillRect(px + 17, py + ts - 3, 9, 3);
          }
          if (left === 0) {
            ctx.fillStyle = pal.grassShadow;
            ctx.fillRect(px, py, 2, ts);
            ctx.fillStyle = pal.grassBase;
            ctx.fillRect(px, py + 3 + ((h >> 2) & 3), 3, 10);
            ctx.fillRect(px, py + 18, 3, 9);
            ctx.fillStyle = pal.grassLight;
            ctx.fillRect(px, py + 6, 2, 5);
          }
          if (right === 0) {
            ctx.fillStyle = pal.grassShadow;
            ctx.fillRect(px + ts - 2, py, 2, ts);
            ctx.fillStyle = pal.grassBase;
            ctx.fillRect(px + ts - 3, py + 2, 3, 11);
            ctx.fillRect(px + ts - 3, py + 17, 3, 10);
          }
          if (top === 0 && left === 0) {
            ctx.fillStyle = pal.grassBase;
            ctx.fillRect(px, py, 6, 4);
            ctx.fillRect(px, py, 4, 6);
          }
          if (top === 0 && right === 0) {
            ctx.fillStyle = pal.grassBase;
            ctx.fillRect(px + ts - 6, py, 6, 4);
            ctx.fillRect(px + ts - 4, py, 4, 6);
          }
          if (bot === 0 && left === 0) {
            ctx.fillStyle = pal.grassShadow;
            ctx.fillRect(px, py + ts - 5, 5, 5);
          }
          if (bot === 0 && right === 0) {
            ctx.fillStyle = pal.grassShadow;
            ctx.fillRect(px + ts - 5, py + ts - 5, 5, 5);
          }
        }

        // 2. Riberas limpias y continuas pixel-art en bordes de agua (tile === 3)
        // Se eliminan franjas discontinuas o guiones blancos que creaban artefactos de líneas cortadas
        if (tileId === 3) {
          if (isLand(top)) {
            ctx.fillStyle = '#182130';
            ctx.fillRect(px, py, ts, 2);
            ctx.fillStyle = pal.dirtDark;
            ctx.fillRect(px, py + 2, ts, 2);
            ctx.fillStyle = pal.waterDeep;
            ctx.fillRect(px, py + 4, ts, 2);
          }
          if (isLand(bot)) {
            ctx.fillStyle = '#182130';
            ctx.fillRect(px, py + ts - 2, ts, 2);
            ctx.fillStyle = pal.dirtDark;
            ctx.fillRect(px, py + ts - 4, ts, 2);
            ctx.fillStyle = pal.waterDeep;
            ctx.fillRect(px, py + ts - 6, ts, 2);
          }
          if (isLand(left)) {
            ctx.fillStyle = '#182130';
            ctx.fillRect(px, py, 2, ts);
            ctx.fillStyle = pal.dirtDark;
            ctx.fillRect(px + 2, py, 2, ts);
            ctx.fillStyle = pal.waterDeep;
            ctx.fillRect(px + 4, py, 2, ts);
          }
          if (isLand(right)) {
            ctx.fillStyle = '#182130';
            ctx.fillRect(px + ts - 2, py, 2, ts);
            ctx.fillStyle = pal.dirtDark;
            ctx.fillRect(px + ts - 4, py, 2, ts);
            ctx.fillStyle = pal.waterDeep;
            ctx.fillRect(px + ts - 6, py, 2, ts);
          }
          if (isLand(top) && isLand(left)) {
            ctx.fillStyle = '#182130';
            ctx.fillRect(px, py, 4, 4);
            ctx.fillStyle = pal.dirtDark;
            ctx.fillRect(px + 2, py + 2, 3, 3);
          }
          if (isLand(top) && isLand(right)) {
            ctx.fillStyle = '#182130';
            ctx.fillRect(px + ts - 4, py, 4, 4);
            ctx.fillStyle = pal.dirtDark;
            ctx.fillRect(px + ts - 5, py + 2, 3, 3);
          }
          if (isLand(bot) && isLand(left)) {
            ctx.fillStyle = '#182130';
            ctx.fillRect(px, py + ts - 4, 4, 4);
            ctx.fillStyle = pal.dirtDark;
            ctx.fillRect(px + 2, py + ts - 5, 3, 3);
          }
          if (isLand(bot) && isLand(right)) {
            ctx.fillStyle = '#182130';
            ctx.fillRect(px + ts - 4, py + ts - 4, 4, 4);
            ctx.fillStyle = pal.dirtDark;
            ctx.fillRect(px + ts - 5, py + ts - 5, 3, 3);
          }
          // Sombra del puente proyectada sobre el agua inmediatamente al sur (top === 4)
          if (top === 4) {
            ctx.fillStyle = pal.waterDeep;
            ctx.fillRect(px, py, ts, 5);
            ctx.fillStyle = '#182130';
            ctx.fillRect(px, py, ts, 2);
          }
        }

        // 3. Bordillos tallados de piedra alrededor de Plazas del Santuario (tile === 5)
        if (tileId === 5) {
          if (top !== 5 && top !== 2) {
            ctx.fillStyle = '#19202e';
            ctx.fillRect(px, py, ts, 1);
            ctx.fillStyle = pal.plazaTrim;
            ctx.fillRect(px, py + 1, ts, 3);
            ctx.fillStyle = '#475368';
            ctx.fillRect(px, py + 4, ts, 1);
          }
          if (bot !== 5 && bot !== 2) {
            ctx.fillStyle = pal.plazaTrim;
            ctx.fillRect(px, py + ts - 4, ts, 3);
            ctx.fillStyle = '#19202e';
            ctx.fillRect(px, py + ts - 1, ts, 1);
          }
          if (left !== 5 && left !== 2) {
            ctx.fillStyle = '#19202e';
            ctx.fillRect(px, py, 1, ts);
            ctx.fillStyle = pal.plazaTrim;
            ctx.fillRect(px + 1, py, 3, ts);
          }
          if (right !== 5 && right !== 2) {
            ctx.fillStyle = pal.plazaTrim;
            ctx.fillRect(px + ts - 4, py, 3, ts);
            ctx.fillStyle = '#19202e';
            ctx.fillRect(px + ts - 1, py, 1, ts);
          }
        }

        // 4. Rastro diegético de brasas y ceniza calcinada hacia el Pedestal Suroeste (cave_exit_intro)
        if (
          (this.layoutPreset === 'cave_exit_intro' || this.biomeKey === 'cave_exit_intro') &&
          tileId === 1 &&
          (
            (y >= 6 && y <= 8 && x >= 11 && x <= 14) ||
            (x >= 13 && x <= 15 && y >= 8 && y <= 24)
          )
        ) {
          if ((h & 3) !== 0) {
            const sx = px + 6 + ((h >> 2) % 16);
            const sy = py + 6 + ((h >> 6) % 16);
            // Mancha oscura calcinada sobre la tierra
            ctx.fillStyle = '#7c2d12';
            ctx.fillRect(sx - 1, sy - 1, 6, 4);
            // Brasa incandescente pequeña
            ctx.fillStyle = (h & 8) ? '#fb923c' : '#ea580c';
            ctx.fillRect(sx + 1, sy, 3, 2);
            if ((h & 16) === 0) {
              ctx.fillStyle = '#fde047';
              ctx.fillRect(sx + 2, sy, 1, 1);
            }
          }
        }
      }
    }
  }

  /**
   * Dibuja frentes de acantilado con Proyección de Gabinete donde una celda de meseta (`2`)
   * linda por debajo con terreno más bajo (`!= 2`).
   * @private
   * @param {CanvasRenderingContext2D} ctx
   * @param {Object} pal
   */
  _renderCabinetCliffs(ctx, pal) {
    const ts = this.tileSize;
    for (let y = 0; y < this.rows - 1; y++) {
      for (let x = 0; x < this.cols; x++) {
        if (this.grid[y][x] === 2 && this.grid[y + 1][x] !== 2) {
          const px = x * ts;
          const faceTop = (y + 1) * ts - 12;
          const wallHeight = 20;

          // Sombra índigo proyectada sobre la loseta inferior
          ctx.fillStyle = 'rgba(15, 18, 46, 0.36)';
          ctx.fillRect(px, faceTop + wallHeight, ts, 7);

          // Cara vertical del acantilado
          ctx.fillStyle = pal.cliffFace;
          ctx.fillRect(px, faceTop, ts, wallHeight);

          // Estratos oscuros en base del muro
          ctx.fillStyle = pal.cliffShadow;
          ctx.fillRect(px, faceTop + 12, ts, 8);

          // Grietas de estratificación vertical
          ctx.fillStyle = '#0b101d';
          ctx.fillRect(px + ((x * 7) % 14) + 5, faceTop + 3, 2, 13);
          ctx.fillRect(px + ((x * 13) % 12) + 16, faceTop + 5, 2, 11);

          // Cornisa iluminada superior + línea de tinta anime
          ctx.fillStyle = pal.cliffRim;
          ctx.fillRect(px, faceTop - 2, ts, 3);
          ctx.fillStyle = '#0b101d';
          ctx.fillRect(px, faceTop + wallHeight - 1.5, ts, 1.8);
        }
      }
    }
  }

  /** @private */
  /** @private */
  _drawBiomeTurf(ctx, px, py, x, y, pal) {
    const ts = this.tileSize;
    const h = this._hash2D(x, y, 1);

    ctx.fillStyle = pal.grassBase;
    ctx.fillRect(px, py, ts, ts);

    // Manchas orgánicas de hierba de distinta escala con desplazamiento pseudoaleatorio
    const ox1 = h & 15;
    const oy1 = (h >> 4) & 15;
    const ox2 = (h >> 8) & 15;
    const oy2 = (h >> 12) & 15;

    ctx.fillStyle = pal.grassMid;
    ctx.fillRect(px + ox1, py + oy1, 10 + ((h >> 16) & 5), 6 + ((h >> 18) & 3));
    if ((h & 3) !== 0) {
      ctx.fillRect(px + ((ox2 + 8) % 20), py + ((oy2 + 10) % 20), 8, 5);
    }
    if (((h >> 2) & 3) === 0) {
      ctx.fillStyle = pal.grassLight;
      ctx.fillRect(px + ((ox1 + 4) % 22), py + ((oy2 + 3) % 22), 7 + ((h >> 20) & 3), 4);
    }

    // Matas de césped pixel-art en posiciones variadas por hash
    if ((h & 3) <= 1) {
      const gx = px + 3 + ((h >> 6) % 22);
      const gy = py + 5 + ((h >> 10) % 20);
      ctx.fillStyle = pal.grassShadow;
      ctx.fillRect(gx, gy + 2, 5, 2);
      ctx.fillStyle = pal.grassLight;
      ctx.fillRect(gx, gy, 2, 2);
      ctx.fillRect(gx + 3, gy - 1, 2, 3);
    }

    // Flores silvestres poco frecuentes (para evitar patrón de cuadrícula)
    if ((h & 31) === 5) {
      const fx = px + 5 + ((h >> 14) % 20);
      const fy = py + 5 + ((h >> 18) % 20);
      ctx.fillStyle = pal.grassShadow;
      ctx.fillRect(fx, fy + 2, 3, 1);
      ctx.fillStyle = pal.flowerA;
      ctx.fillRect(fx, fy, 3, 2);
      ctx.fillRect(fx + 1, fy - 1, 1, 1);
    } else if ((h & 63) === 23) {
      const fx = px + 6 + ((h >> 16) % 18);
      const fy = py + 6 + ((h >> 20) % 18);
      ctx.fillStyle = pal.grassShadow;
      ctx.fillRect(fx, fy + 2, 3, 1);
      ctx.fillStyle = pal.flowerB;
      ctx.fillRect(fx, fy, 3, 2);
    }
  }

  /** @private */
  _drawBiomeDirt(ctx, px, py, x, y, pal) {
    const ts = this.tileSize;
    const h = this._hash2D(x, y, 2);
    ctx.fillStyle = pal.dirtBase;
    ctx.fillRect(px, py, ts, ts);

    // Parches irregulares de tierra pisoteada con dispersión 2D
    const dx1 = h & 15;
    const dy1 = (h >> 4) & 15;
    const dx2 = (h >> 8) & 15;
    const dy2 = (h >> 12) & 15;

    ctx.fillStyle = pal.dirtDark;
    ctx.fillRect(px + dx1, py + dy1, 8 + ((h >> 16) & 5), 5 + ((h >> 19) & 3));

    ctx.fillStyle = pal.dirtLight;
    ctx.fillRect(px + ((dx2 + 6) % 21), py + ((dy2 + 5) % 21), 6 + ((h >> 21) & 4), 4);

    // Guijarros esporádicos pixel-art (no uno idéntico por loseta)
    if ((h & 7) <= 2) {
      const sx = px + 4 + ((h >> 14) % 22);
      const sy = py + 4 + ((h >> 18) % 22);
      ctx.fillStyle = pal.dirtDark;
      ctx.fillRect(sx, sy + 2, 4, 2);
      ctx.fillStyle = pal.dirtLight;
      ctx.fillRect(sx, sy, 4, 2);
    }
    if ((h & 15) === 9) {
      const sx2 = px + 3 + ((h >> 20) % 24);
      const sy2 = py + 4 + ((h >> 24) % 22);
      ctx.fillStyle = pal.dirtDark;
      ctx.fillRect(sx2, sy2, 2, 2);
    }
  }

  /** @private */
  _drawBiomeCliffTop(ctx, px, py, x, y, pal) {
    const ts = this.tileSize;
    ctx.fillStyle = pal.cliffTop;
    ctx.fillRect(px, py, ts, ts);

    ctx.fillStyle = pal.cliffFace;
    ctx.fillRect(px + 2, py + 2, ts - 4, ts - 4);
    ctx.fillStyle = pal.cliffRim;
    ctx.fillRect(px + 4, py + 4, 14, 3);
    if ((x + y) % 3 === 0) {
      ctx.fillStyle = pal.cliffShadow;
      ctx.fillRect(px + 16, py + 18, 10, 4);
    }
  }

  /** @private */
  _drawBiomeWater(ctx, px, py, x, y, pal) {
    const ts = this.tileSize;
    const h = this._hash2D(x, y, 3);
    ctx.fillStyle = pal.waterBase;
    ctx.fillRect(px, py, ts, ts);

    // Bandas de profundidad variadas por hash (sin rayas repetidas por loseta)
    if ((h & 3) !== 0) {
      ctx.fillStyle = pal.waterDeep;
      ctx.fillRect(px + (h & 7), py + 4 + ((h >> 3) & 7), 16 + ((h >> 6) & 11), 6 + ((h >> 10) & 3));
    }
    if ((h & 7) <= 3) {
      ctx.fillStyle = pal.waterDeep;
      ctx.fillRect(px + ((h >> 8) % 14), py + 20, 12 + (h & 7), 5);
    }

    // Destellos de corriente horizontales en pixel art
    if ((h & 3) === 1 || (h & 7) === 6) {
      ctx.fillStyle = pal.waterFoam;
      ctx.fillRect(px + 4 + ((h >> 12) % 16), py + 8 + ((h >> 16) % 16), 7 + (h & 3), 2);
    }
    if ((h & 15) === 11) {
      ctx.fillStyle = '#d4f6ff';
      ctx.fillRect(px + 6 + ((h >> 18) % 16), py + 12 + ((h >> 22) % 12), 4, 1);
    }
  }

  /**
   * Dibuja un segmento del puente de madera de manera arquitectónica y consciente de sus vecinos:
   * - Fila superior (`!topB`): baranda continua norte con postes y contorno.
   * - Fila inferior (`!botB`): baranda continua sur con espesor visible y sombra.
   * - Fila central (`topB && botB`): cubierta continua de tablones sin cortes ni agua interior.
   * - Extremos oeste/este (`!leftB` / `!rightB`): estribos de piedra anclados al camino.
   * @private
   */
  _drawBiomeBridge(ctx, px, py, x, y, pal) {
    const ts = this.tileSize;
    const topB = y > 0 && this.grid[y - 1][x] === 4;
    const botB = y < this.rows - 1 && this.grid[y + 1][x] === 4;
    const leftB = x > 0 && this.grid[y][x - 1] === 4;
    const rightB = x < this.cols - 1 && this.grid[y][x + 1] === 4;
    const h = this._hash2D(x, y, 4);

    // 1. Cubierta sólida completa de tablones verticales (32x32 px) sin agua filtrada
    ctx.fillStyle = pal.bridgeBase;
    ctx.fillRect(px, py, ts, ts);

    // Alternancia sutil entre tablones de roble + juntas oscuras cada 8 px
    for (let i = 0; i < 4; i++) {
      const tx = px + i * 8;
      if (((x + i + (h & 1)) & 1) === 0) {
        ctx.fillStyle = pal.bridgeRim;
        ctx.globalAlpha = 0.22;
        ctx.fillRect(tx + 1, py, 6, ts);
        ctx.globalAlpha = 1;
      }
      // Junta vertical oscura entre tablones (1 px limpio)
      ctx.fillStyle = '#2d1a11';
      ctx.fillRect(tx, py, 1, ts);
      // Clavos de hierro en tablones (variación orgánica)
      ctx.fillStyle = '#18141a';
      ctx.fillRect(tx + 3, py + 7, 1, 1);
      ctx.fillRect(tx + 5, py + 24, 1, 1);
    }

    // Veta horizontal ligera de vigas transversales
    ctx.fillStyle = pal.bridgeGrain;
    ctx.fillRect(px, py + 15, ts, 2);

    // 2. Baranda Norte continua (solo en la fila superior del puente)
    if (!topB) {
      ctx.fillStyle = '#140c08';
      ctx.fillRect(px, py, ts, 1);
      ctx.fillStyle = pal.bridgeRim;
      ctx.fillRect(px, py + 1, ts, 2);
      ctx.fillStyle = pal.bridgeGrain;
      ctx.fillRect(px, py + 3, ts, 1);
      ctx.fillStyle = '#24140d';
      ctx.fillRect(px, py + 4, ts, 2);

      // Postes de madera cada 16 px
      for (const ox of [2, 18]) {
        ctx.fillStyle = '#140c08';
        ctx.fillRect(px + ox, py, 5, 6);
        ctx.fillStyle = pal.bridgeRim;
        ctx.fillRect(px + ox + 1, py + 1, 3, 2);
        ctx.fillStyle = pal.bridgeBase;
        ctx.fillRect(px + ox + 1, py + 3, 3, 2);
      }
    }

    // 3. Baranda Sur continua (solo en la fila inferior del puente)
    if (!botB) {
      ctx.fillStyle = pal.bridgeRim;
      ctx.fillRect(px, py + ts - 6, ts, 2);
      ctx.fillStyle = pal.bridgeGrain;
      ctx.fillRect(px, py + ts - 4, ts, 2);
      ctx.fillStyle = '#140c08';
      ctx.fillRect(px, py + ts - 2, ts, 2);

      for (const ox of [2, 18]) {
        ctx.fillStyle = '#140c08';
        ctx.fillRect(px + ox, py + ts - 7, 5, 7);
        ctx.fillStyle = pal.bridgeRim;
        ctx.fillRect(px + ox + 1, py + ts - 6, 3, 2);
        ctx.fillStyle = pal.bridgeBase;
        ctx.fillRect(px + ox + 1, py + ts - 4, 3, 2);
      }
    }

    // 4. Estribos de piedra tallada en ambos anclajes de tierra (!leftB / !rightB)
    if (!leftB) {
      ctx.fillStyle = '#19202e';
      ctx.fillRect(px, py, 6, ts);
      ctx.fillStyle = pal.plazaTrim;
      ctx.fillRect(px + 1, py + 1, 4, ts - 2);
      ctx.fillStyle = '#6f7c91';
      ctx.fillRect(px + 1, py + 2, 2, 12);
      ctx.fillRect(px + 1, py + 18, 2, 12);
    }
    if (!rightB) {
      ctx.fillStyle = '#19202e';
      ctx.fillRect(px + ts - 6, py, 6, ts);
      ctx.fillStyle = pal.plazaTrim;
      ctx.fillRect(px + ts - 5, py + 1, 4, ts - 2);
      ctx.fillStyle = '#6f7c91';
      ctx.fillRect(px + ts - 5, py + 2, 2, 12);
      ctx.fillRect(px + ts - 5, py + 18, 2, 12);
    }
  }

  /** @private */
  _drawBiomePlaza(ctx, px, py, x, y, pal) {
    const ts = this.tileSize;
    ctx.fillStyle = pal.plazaBase;
    ctx.fillRect(px, py, ts, ts);

    ctx.strokeStyle = pal.plazaTrim;
    ctx.lineWidth = 1.6;
    ctx.strokeRect(px + 1, py + 1, ts - 2, ts - 2);

    ctx.fillStyle = pal.plazaGold;
    if ((x + y) % 4 === 0) {
      ctx.fillRect(px + 13, py + 13, 6, 6);
    }
  }

  /**
   * Renderiza exclusivamente el rectángulo visible del mapa mediante recorte directo O(1).
   * @param {CanvasRenderingContext2D} ctx
   * @param {import('../render/Camera.js').Camera} camera
   */
  render(ctx, camera) {
    if (!this.offscreenCanvas) return;

    const bounds = camera.getVisibleWorldBounds(this.tileSize * 2);
    const sx = Math.max(0, Math.floor(bounds.minX));
    const sy = Math.max(0, Math.floor(bounds.minY));
    const maxW = Math.min(this.width, Math.ceil(bounds.maxX)) - sx;
    const maxH = Math.min(this.height, Math.ceil(bounds.maxY)) - sy;

    if (maxW <= 0 || maxH <= 0) return;

    ctx.drawImage(
      this.offscreenCanvas,
      sx, sy, maxW, maxH,
      sx, sy, maxW, maxH
    );
  }
}

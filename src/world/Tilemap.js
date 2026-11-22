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
    grassBase: '#52a549',
    grassMid: '#3d8b40',
    grassLight: '#88d459',
    grassShadow: '#1f5647',
    dirtBase: '#b57c4e',
    dirtDark: '#7e4938',
    dirtLight: '#d8a46f',
    cliffTop: '#64748b',
    cliffFace: '#475569',
    cliffShadow: '#283548',
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
    flowerA: '#f8fafc',
    flowerB: '#fde047'
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

    /** @type {number} Tamaño espacial de cada chunk lógico en losetas (8x8 = 256x256 px) */
    this.chunkTiles = 8;
    this.chunkPx = this.chunkTiles * this.tileSize;
    this.chunkCols = Math.ceil(this.cols / this.chunkTiles);
    this.chunkRows = Math.ceil(this.rows / this.chunkTiles);

    /** @type {Map<string, HTMLCanvasElement>} Paleta Flyweight de variantes únicas de loseta (compartidas por todo el bioma) */
    this._tileStamps = new Map();
    /** @type {Map<string, HTMLCanvasElement>} Caché LRU de chunks visibles renderizados bajo demanda */
    this._chunkCache = new Map();
    /** @type {number} Tope de chunks de terreno cacheados simultáneamente en RAM */
    this.maxCachedChunks = 18;
    /** @type {string|null} Bioma asociado actualmente a la paleta Flyweight horneada */
    this._stampsBiomeKey = null;

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
    this.chunkPx = this.chunkTiles * this.tileSize;
    this.chunkCols = Math.ceil(this.cols / this.chunkTiles);
    this.chunkRows = Math.ceil(this.rows / this.chunkTiles);

    if (Array.isArray(levelData.terrainGrid) && levelData.terrainGrid.length === this.rows) {
      this.grid = levelData.terrainGrid.map(row => row.slice());
    } else {
      this.generateLayout();
    }

    this.build(resourceManager);
  }

  /**
   * Retorna la paleta cromática activa del bioma para que consumidores externos (ej. minimapa)
   * reutilicen colores sin acoplarse a `BIOME_PALETTES`.
   * @returns {Object}
   */
  getActivePalette() {
    return BIOME_PALETTES[this.biomeKey] || BIOME_PALETTES.cave_exit_intro;
  }

  /**
   * Calcula un factor de inercia/fricción superficial según el `tileId` bajo los pies (para Slide/Dive).
   * @param {number} tileId
   * @param {string} [biomeKey='cave_exit_intro']
   * @returns {number} Multiplicador de alcance/deslizamiento (`0.88` ceniza -> `1.24` losas/musgo húmedo)
   */
  static getSurfaceSlideFactor(tileId, biomeKey = 'cave_exit_intro') {
    if (tileId === 5) return 1.22; // Plazas de piedra pulida o cristal astral
    if (tileId === 4) return 1.12; // Puentes de madera / pasarela
    if (tileId === 1) return biomeKey === 'ash_caldera' ? 0.88 : 0.96; // Tierra o ceniza densa
    if (biomeKey === 'marsh_of_spores') return 1.16; // Musgo húmedo resbaladizo
    return 1.0;
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
        // Muralla natural del umbral de la cueva: obliga a romper la Roca Agrietada del paso (x=13..15)
        if (y >= 10 && y <= 11 && ((x >= 0 && x <= 12) || (x >= 16 && x <= 22))) {
          this.grid[y][x] = 2;
        }
        // Contrafuertes de acantilado flanqueando el acceso a la ruina SO (x=12..16) y reborde sur lejano
        if (y >= 22 && y <= 23 && ((x >= 0 && x <= 11) || (x >= 17 && x <= 23))) {
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
   * Mundo 2: Pantano de Esporas Bioluminiscentes (`marsh_of_spores`, 58x40).
   * Arquitectura de 5 islas/zonas interconectadas por puentes de madera y canales cenagosos:
   * - Entrada Oeste (x=3..13, y=14..26) + Puente 1 (x=13..16, y=18..21)
   * - Encrucijada Central (x=16..33, y=16..23)
   * - Isla Druídica Norte (x=16..33, y=5..13) vía Puente Norte (x=23..26, y=13..16)
   * - Isla Sur de Rescate y Tótems (x=16..33, y=26..36) vía Puente Sur (x=23..26, y=23..26)
   * - Santuario Inundado Este (x=38..55, y=10..30) vía Puente Sellado (x=33..38, y=19..20)
   * @private
   */
  _generateMarshLayout() {
    for (let y = 0; y < this.rows; y++) {
      for (let x = 0; x < this.cols; x++) {
        // 1. Acantilados musgosos al norte
        if (y <= 3) {
          this.grid[y][x] = 2;
          continue;
        }

        // 2. Canales y lagunas divisorias del pantano
        const inWestCanal = x >= 14 && x <= 15;
        const inEastCanal = x >= 34 && x <= 37;
        const inNorthCanal = (y === 14 || y === 15) && x >= 15 && x <= 35;
        const inSouthCanal = (y === 24 || y === 25) && x >= 15 && x <= 35;
        const decorPondA = Math.hypot(x - 8, y - 8) < 3.2;
        const decorPondB = Math.hypot(x - 8, y - 31) < 3.4;
        const decorPondC = Math.hypot(x - 49, y - 7) < 3.4;
        const decorPondD = Math.hypot(x - 49, y - 33) < 3.4;

        if (inWestCanal || inEastCanal || inNorthCanal || inSouthCanal || decorPondA || decorPondB || decorPondC || decorPondD) {
          this.grid[y][x] = 3;
        }

        // 3. Senderos de barro y plazas druídicas transitables
        if (y >= 18 && y <= 21 && x >= 5 && x <= 33) {
          this.grid[y][x] = 1;
        }
        if (x >= 23 && x <= 26 && y >= 8 && y <= 32) {
          this.grid[y][x] = 1;
        }
        if (y >= 19 && y <= 20 && x >= 33 && x <= 46) {
          this.grid[y][x] = 1;
        }

        // Plazas de piedra antigua (tile = 5)
        if (x >= 5 && x <= 9 && y >= 17 && y <= 22) this.grid[y][x] = 5;
        if (Math.hypot(x - 24.5, y - 8) <= 3.5) this.grid[y][x] = 5;
        if (Math.hypot(x - 24.5, y - 31) <= 3.2) this.grid[y][x] = 5;
        if (Math.hypot(x - 46, y - 20) <= 6.5) this.grid[y][x] = 5;

        // 4. Puentes de madera sobre canales (tile = 4)
        if (x >= 13 && x <= 16 && y >= 18 && y <= 21) this.grid[y][x] = 4;
        if (x >= 23 && x <= 26 && y >= 13 && y <= 16) this.grid[y][x] = 4;
        if (x >= 23 && x <= 26 && y >= 23 && y <= 26) this.grid[y][x] = 4;
        if (x >= 33 && x <= 38 && y >= 19 && y <= 20) this.grid[y][x] = 4;
      }
    }
  }

  /**
   * Mundo 3: Caldera de Ceniza (`ash_caldera`, 58x40).
   * Arquitectura de Forja Volcánica en bucle (Shortcut Loop) con ríos de magma y puentes de hierro:
   * - Entrada Oeste (x=3..13, y=13..26) + Puente Norte abierto (x=13..16, y=9..11) + Atajo Central sellado (x=13..16, y=19..20)
   * - Paso Norte de Géiseres (x=16..34, y=5..13) -> Yunque NE del Núcleo Cinético (x=39..54, y=5..13)
   * - Caldera Central (x=16..34, y=16..22) + Fragua Sur y Cámara Secreta (x=4..34, y=25..36)
   * - Gran Crisol del Titán Este (x=39..55, y=15..30) vía Puente Sellado (x=34..39, y=19..20)
   * @private
   */
  _generateAshCalderaLayout() {
    for (let y = 0; y < this.rows; y++) {
      for (let x = 0; x < this.cols; x++) {
        // 1. Mesetas volcánicas norte
        if (y <= 3) {
          this.grid[y][x] = 2;
          continue;
        }

        // 2. Ríos de magma incandescente (tile = 3)
        const westMagma = x >= 14 && x <= 15 && y >= 4;
        const eastMagma = x >= 35 && x <= 38 && y >= 4;
        const northLavaTrench = (y === 14 || y === 15) && x >= 15;
        const southLavaTrench = (y === 23 || y === 24) && x >= 15 && x <= 35;
        const swCornerLava = (y === 25 || y === 26) && x <= 14;
        const eastCornerLava = Math.hypot(x - 51, y - 34) < 3.2;

        if (westMagma || eastMagma || northLavaTrench || southLavaTrench || swCornerLava || eastCornerLava) {
          this.grid[y][x] = 3;
        }

        // 3. Calzadas de obsidiana y ceniza compactada (tile = 1), respetando la grieta oeste de magma (x=14..15)
        if (x >= 6 && x <= 13 && y >= 9 && y <= 21) this.grid[y][x] = 1;
        if (y >= 9 && y <= 11 && x >= 11 && x <= 46) this.grid[y][x] = 1;
        if (y >= 18 && y <= 21 && x >= 5 && x <= 33 && (x < 14 || x > 15)) this.grid[y][x] = 1;
        if (x >= 24 && x <= 26 && y >= 13 && y <= 32) this.grid[y][x] = 1;
        if (y >= 29 && y <= 31 && x >= 7 && x <= 31) this.grid[y][x] = 1;
        if (y >= 19 && y <= 20 && x >= 33 && x <= 48) this.grid[y][x] = 1;

        // Plazas de piedra forjada (tile = 5)
        if (x >= 5 && x <= 9 && y >= 17 && y <= 22) this.grid[y][x] = 5;
        if (Math.hypot(x - 46, y - 9) <= 3.6) this.grid[y][x] = 5;
        if (Math.hypot(x - 24, y - 30) <= 3.2) this.grid[y][x] = 5;
        if (x >= 5 && x <= 10 && y >= 28 && y <= 33) this.grid[y][x] = 5;
        if (Math.hypot(x - 47, y - 22) <= 6.5) this.grid[y][x] = 5;

        // 4. Puentes de hierro forjado sobre magma (tile = 4)
        if (x >= 13 && x <= 16 && y >= 9 && y <= 11) this.grid[y][x] = 4;   // Desvío Norte
        if (x >= 34 && x <= 39 && y >= 9 && y <= 11) this.grid[y][x] = 4;   // Hacia Yunque NE
        if (x >= 13 && x <= 16 && y >= 19 && y <= 20) this.grid[y][x] = 4;  // Atajo Central (sellado con Basalto)
        if (x >= 24 && x <= 26 && y >= 13 && y <= 16) this.grid[y][x] = 4;  // Conexión Norte -> Central
        if (x >= 24 && x <= 26 && y >= 22 && y <= 25) this.grid[y][x] = 4;  // Conexión Central -> Fragua Sur
        if (x >= 11 && x <= 16 && y >= 29 && y <= 31) this.grid[y][x] = 4;  // Puente hacia Cámara Secreta SO
        if (x >= 34 && x <= 39 && y >= 19 && y <= 20) this.grid[y][x] = 4;  // Puente Sellado al Gran Crisol
      }
    }
  }

  /**
   * Mundo 4: Ciudadela Astral (`astral_citadel`, 60x40).
   * Cinco terrazas flotantes de cuarzo suspendidas sobre éter cósmico conectadas por pasarelas de cristal:
   * - Plataforma 1: Terraza Oeste (x=3..13, y=14..25)
   * - Plataforma 2: Vestíbulo de los 3 Elementos (x=16..31, y=14..25)
   * - Plataforma 3: Observatorio Norte — Núcleo de Éter (x=16..33, y=4..12)
   * - Plataforma 4: Galería Sur — Filo Sagrado y Pilón B (x=16..33, y=27..36)
   * - Plataforma 5: Gran Plaza del Cenit — Heraldo de Obsidiana (x=38..57, y=8..31)
   * @private
   */
  _generateAstralCitadelLayout() {
    for (let y = 0; y < this.rows; y++) {
      for (let x = 0; x < this.cols; x++) {
        // Base absoluta: vacío estelar (tile = 3)
        this.grid[y][x] = 3;

        // Plataforma 1: Terraza de Llegada Oeste
        if (x >= 3 && x <= 13 && y >= 14 && y <= 25) this.grid[y][x] = 0;
        // Plataforma 2: Vestíbulo de los 3 Elementos
        if (x >= 16 && x <= 31 && y >= 14 && y <= 25) this.grid[y][x] = 0;
        // Plataforma 3: Observatorio Norte (con acantilado astral ornamental arriba)
        if (x >= 16 && x <= 33 && y >= 4 && y <= 12) this.grid[y][x] = y <= 4 ? 2 : 0;
        // Plataforma 4: Galería Sur
        if (x >= 16 && x <= 33 && y >= 27 && y <= 36) this.grid[y][x] = 0;
        // Plataforma 5: Gran Plaza del Cenit Este
        if (x >= 38 && x <= 57 && y >= 8 && y <= 31) this.grid[y][x] = y <= 8 ? 2 : 0;

        // Calzadas ceremoniales (tile = 1)
        if (y >= 19 && y <= 20 && x >= 5 && x <= 31) this.grid[y][x] = 1;
        if (x >= 23 && x <= 24 && y >= 8 && y <= 32) this.grid[y][x] = 1;
        if (y >= 19 && y <= 20 && x >= 38 && x <= 54) this.grid[y][x] = 1;

        // Plazas de cuarzo celestial (tile = 5)
        if (x >= 5 && x <= 10 && y >= 17 && y <= 22) this.grid[y][x] = 5;
        if (Math.hypot(x - 23.5, y - 19.5) <= 3.2) this.grid[y][x] = 5;
        if (Math.hypot(x - 24.5, y - 8.5) <= 3.2) this.grid[y][x] = 5;
        if (Math.hypot(x - 24.5, y - 31.5) <= 3.2) this.grid[y][x] = 5;
        if (Math.hypot(x - 47.5, y - 19.5) <= 7.5) this.grid[y][x] = 5;

        // Pasarelas de cristal rúnico sobre el éter (tile = 4)
        if (x >= 13 && x <= 16 && y >= 19 && y <= 20) this.grid[y][x] = 4; // P1 -> P2
        if (x >= 22 && x <= 25 && y >= 12 && y <= 14) this.grid[y][x] = 4; // P2 -> P3 Norte
        if (x >= 22 && x <= 25 && y >= 25 && y <= 27) this.grid[y][x] = 4; // P2 -> P4 Sur
        if (x >= 31 && x <= 38 && y >= 19 && y <= 20) this.grid[y][x] = 4; // P2 -> P5 Cenit
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
   * Libera todos los chunks cacheados en memoria gráfica y limpia sus buffers `<canvas>`.
   */
  clearChunks() {
    for (const c of this._chunkCache.values()) {
      if (c) {
        c.width = 0;
        c.height = 0;
      }
    }
    this._chunkCache.clear();
  }

  /**
   * Invalida un chunk específico del caché gráfico y destruye su buffer canvas.
   * @param {number} cx - Coordenada X del chunk
   * @param {number} cy - Coordenada Y del chunk
   * @returns {boolean} True si el chunk estaba en caché y fue desalojado
   */
  invalidateChunk(cx, cy) {
    const key = `${cx}_${cy}`;
    const canvas = this._chunkCache.get(key);
    if (canvas) {
      canvas.width = 0;
      canvas.height = 0;
      this._chunkCache.delete(key);
      return true;
    }
    return false;
  }

  /**
   * Modifica una loseta de la cuadrícula lógica e invalida únicamente el chunk correspondiente
   * y sus vecinos inmediatos (afectados por Dual-Grid y voladizos de gabinete).
   * Cero reconstrucción del mapa completo: renderizado incremental instantáneo para el editor.
   * @param {number} col - Columna de la loseta
   * @param {number} row - Fila de la loseta
   * @param {number} tileId - Nuevo ID de terreno (0..5)
   * @returns {boolean} True si la loseta cambió de valor
   */
  setTileAndInvalidate(col, row, tileId) {
    if (row < 0 || row >= this.rows || col < 0 || col >= this.cols) {
      return false;
    }
    if (this.grid[row][col] === tileId) {
      return false;
    }

    this.grid[row][col] = tileId;

    const cx = Math.floor(col / this.chunkTiles);
    const cy = Math.floor(row / this.chunkTiles);

    // Desalojar el chunk central y su vecindad 3x3 por si bordea o proyecta sombras/voladizos
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        this.invalidateChunk(cx + dx, cy + dy);
      }
    }

    return true;
  }

  /**
   * Libera la paleta Flyweight de variantes de losetas del bioma anterior.
   */
  clearTileStamps() {
    for (const c of this._tileStamps.values()) {
      if (c) {
        c.width = 0;
        c.height = 0;
      }
    }
    this._tileStamps.clear();
    this._stampsBiomeKey = null;
  }

  /**
   * Prepara la paleta Flyweight de texturas únicas repetibles del bioma activo
   * (4 variantes de hierba, 4 tierra, 4 agua, 4 roca y 2 losa = ~18 mini-canvases de 32x32)
   * y purga los chunks viejos para que los nuevos se horneen bajo demanda en `render()`.
   * @param {import('../core/ResourceManager.js').ResourceManager|null} [_resourceManager=null]
   */
  build(_resourceManager = null) {
    this.clearChunks();
    this._ensureBiomeTileStamps();
  }

  /**
   * Construye una única vez por bioma los sellos Flyweight reutilizables de cada loseta.
   * Una textura repetida 1,000 veces ocupa exactamente 1 objeto en RAM.
   * @private
   */
  _ensureBiomeTileStamps() {
    if (typeof document === 'undefined') return;
    if (this._stampsBiomeKey === this.biomeKey && this._tileStamps.size > 0) return;

    this.clearTileStamps();
    this._stampsBiomeKey = this.biomeKey;

    const pal = BIOME_PALETTES[this.biomeKey] || BIOME_PALETTES.cave_exit_intro;
    const ts = this.tileSize;

    const bakeVariant = (stampKey, seedX, seedY, drawFn) => {
      const canvas = document.createElement('canvas');
      canvas.width = ts;
      canvas.height = ts;
      const sctx = canvas.getContext('2d');
      if (sctx) {
        sctx.imageSmoothingEnabled = false;
        drawFn.call(this, sctx, 0, 0, seedX, seedY, pal);
      }
      this._tileStamps.set(stampKey, canvas);
    };

    for (let v = 0; v < 8; v++) {
      bakeVariant(`turf_${v}`, v * 3 + 1, v * 5 + 2, this._drawBiomeTurf);
    }
    for (let v = 0; v < 4; v++) {
      bakeVariant(`dirt_${v}`, v * 7 + 3, v * 11 + 1, this._drawBiomeDirt);
      bakeVariant(`water_${v}`, v * 5 + 2, v * 9 + 4, this._drawBiomeWater);
      bakeVariant(`cliff_${v}`, v * 2 + 1, v * 3 + 1, this._drawBiomeCliffTop);
    }
    for (let v = 0; v < 2; v++) {
      bakeVariant(`plaza_${v}`, v * 2, v * 2, this._drawBiomePlaza);
    }
  }

  /**
   * Obtiene o hornea bajo demanda el chunk de terreno `(cx, cy)` combinando:
   * 1. Estampado O(1) de texturas Flyweight compartidas.
   * 2. Autotiling Dual-Grid solo dentro de las celdas del chunk.
   * 3. Proyección de Gabinete de acantilados con solapamiento limpio de 1 fila superior.
   * @private
   * @param {number} cx
   * @param {number} cy
   * @returns {HTMLCanvasElement|null}
   */
  _getOrBakeChunk(cx, cy) {
    if (typeof document === 'undefined') return null;
    if (cx < 0 || cy < 0 || cx >= this.chunkCols || cy >= this.chunkRows) return null;

    this._ensureBiomeTileStamps();

    const key = `${cx}_${cy}`;
    const cached = this._chunkCache.get(key);
    if (cached) {
      this._chunkCache.delete(key);
      this._chunkCache.set(key, cached);
      return cached;
    }

    const ts = this.tileSize;
    const startCol = cx * this.chunkTiles;
    const endCol = Math.min(this.cols, startCol + this.chunkTiles);
    const startRow = cy * this.chunkTiles;
    const endRow = Math.min(this.rows, startRow + this.chunkTiles);
    const w = (endCol - startCol) * ts;
    const h = (endRow - startRow) * ts;
    if (w <= 0 || h <= 0) return null;

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.imageSmoothingEnabled = false;

    const pal = BIOME_PALETTES[this.biomeKey] || BIOME_PALETTES.cave_exit_intro;
    const originX = startCol * ts;
    const originY = startRow * ts;

    // Pasada 1: Estampado con sellos Flyweight compartidos (y puentes dinámicos por vecinos)
    for (let y = startRow; y < endRow; y++) {
      const py = y * ts - originY;
      for (let x = startCol; x < endCol; x++) {
        const tileId = this.grid[y][x];
        const px = x * ts - originX;
        const variantHash = this._hash2D(x, y, tileId + 1);

        if (tileId === 4) {
          this._drawBiomeBridge(ctx, px, py, x, y, pal);
        } else {
          let stampName = null;
          if (tileId === 0) stampName = `turf_${variantHash & 7}`;
          else if (tileId === 1) stampName = `dirt_${variantHash & 3}`;
          else if (tileId === 2) stampName = `cliff_${variantHash & 3}`;
          else if (tileId === 3) stampName = `water_${variantHash & 3}`;
          else if (tileId === 5) stampName = `plaza_${variantHash & 1}`;

          const stamp = stampName ? this._tileStamps.get(stampName) : null;
          if (stamp) {
            ctx.drawImage(stamp, px, py);
          }
        }
      }
    }

    // Pasada 2: Autotiling de bordes en el rango del chunk
    this._renderDualGridPass(ctx, pal, startCol, endCol, startRow, endRow, originX, originY);

    // Pasada 3: Acantilados de Gabinete (incluyendo fila superior inmediata por voladizo de pared)
    this._renderCabinetCliffs(
      ctx,
      pal,
      startCol,
      endCol,
      Math.max(0, startRow - 1),
      Math.min(this.rows - 1, endRow),
      originX,
      originY
    );

    this._chunkCache.set(key, canvas);
    while (this._chunkCache.size > this.maxCachedChunks) {
      const oldestKey = this._chunkCache.keys().next().value;
      const oldCanvas = this._chunkCache.get(oldestKey);
      if (oldCanvas) {
        oldCanvas.width = 0;
        oldCanvas.height = 0;
      }
      this._chunkCache.delete(oldestKey);
    }

    return canvas;
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
   * Dibuja un rectángulo dentro de una loseta `ts x ts` envolviendo de forma toroidal
   * cualquier desbordamiento en X o Y hacia el borde opuesto, garantizando texturas 100% concatenables.
   * @private
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} px - Origen X de la loseta en el canvas
   * @param {number} py - Origen Y de la loseta en el canvas
   * @param {number} ox - Desplazamiento X relativo a la loseta
   * @param {number} oy - Desplazamiento Y relativo a la loseta
   * @param {number} w - Ancho del rectángulo
   * @param {number} h - Alto del rectángulo
   */
  _fillWrapRect(ctx, px, py, ox, oy, w, h) {
    const ts = this.tileSize;
    const sx = ((Math.round(ox) % ts) + ts) % ts;
    const sy = ((Math.round(oy) % ts) + ts) % ts;
    const rw = Math.min(ts, Math.max(0, Math.round(w)));
    const rh = Math.min(ts, Math.max(0, Math.round(h)));
    if (rw <= 0 || rh <= 0) return;

    const w1 = Math.min(rw, ts - sx);
    const w2 = rw - w1;
    const h1 = Math.min(rh, ts - sy);
    const h2 = rh - h1;

    ctx.fillRect(px + sx, py + sy, w1, h1);
    if (w2 > 0) ctx.fillRect(px, py + sy, w2, h1);
    if (h2 > 0) ctx.fillRect(px + sx, py, w1, h2);
    if (w2 > 0 && h2 > 0) ctx.fillRect(px, py, w2, h2);
  }

  /**
   * Dibuja transiciones orgánicas pixel-art en bordes usando exclusivamente `fillRect` enteros.
   * Opera sobre un sub-rectángulo de chunk para evitar recorrer mapas enteros.
   * @private
   */
  _renderDualGridPass(
    ctx,
    pal,
    startCol = 0,
    endCol = this.cols,
    startRow = 0,
    endRow = this.rows,
    originX = 0,
    originY = 0
  ) {
    const ts = this.tileSize;
    const isLand = (id) => id === 0 || id === 1 || id === 5;

    for (let y = startRow; y < endRow; y++) {
      for (let x = startCol; x < endCol; x++) {
        const tileId = this.grid[y][x];
        const px = x * ts - originX;
        const py = y * ts - originY;
        const top = y > 0 ? this.grid[y - 1][x] : tileId;
        const bot = y < this.rows - 1 ? this.grid[y + 1][x] : tileId;
        const left = x > 0 ? this.grid[y][x - 1] : tileId;
        const right = x < this.cols - 1 ? this.grid[y][x + 1] : tileId;
        const h = this._hash2D(x, y, 7);

        // 1. Voladizos orgánicos de racimos foliares sobre caminos de tierra batida (tile === 1)
        if (tileId === 1) {
          if (top === 0) {
            ctx.fillStyle = pal.grassShadow;
            ctx.fillRect(px, py, ts, 2);
            ctx.fillRect(px + 2, py + 2, 7, 2);
            ctx.fillRect(px + 13, py + 2, 9, 2);
            ctx.fillRect(px + 25, py + 2, 6, 1);

            ctx.fillStyle = pal.grassMid;
            ctx.fillRect(px, py, ts, 1);
            ctx.fillRect(px + 3, py + 1, 5, 2);
            ctx.fillRect(px + 14, py + 1, 7, 2);
            ctx.fillRect(px + 26, py + 1, 4, 1);

            ctx.fillStyle = pal.grassBase;
            ctx.fillRect(px + (h & 3), py, 6, 2);
            ctx.fillRect(px + 15, py, 5, 2);
            ctx.fillRect(px + 25, py, 5, 1);

            ctx.fillStyle = pal.grassLight;
            ctx.fillRect(px + 4, py, 3, 1);
            ctx.fillRect(px + 16, py, 3, 1);
          }
          if (bot === 0) {
            ctx.fillStyle = pal.grassShadow;
            ctx.fillRect(px, py + ts - 3, ts, 3);
            ctx.fillRect(px + 4, py + ts - 4, 6, 1);
            ctx.fillRect(px + 19, py + ts - 4, 7, 1);

            ctx.fillStyle = pal.grassMid;
            ctx.fillRect(px + 1, py + ts - 2, 10, 2);
            ctx.fillRect(px + 17, py + ts - 2, 11, 2);
            ctx.fillStyle = pal.grassBase;
            ctx.fillRect(px + 4, py + ts - 3, 5, 2);
            ctx.fillRect(px + 20, py + ts - 3, 5, 2);
          }
          if (left === 0) {
            ctx.fillStyle = pal.grassShadow;
            ctx.fillRect(px, py, 2, ts);
            ctx.fillRect(px + 2, py + 4 + ((h >>> 2) & 3), 2, 7);
            ctx.fillRect(px + 2, py + 19, 2, 8);

            ctx.fillStyle = pal.grassMid;
            ctx.fillRect(px, py + 2, 2, 10);
            ctx.fillRect(px, py + 17, 2, 11);
            ctx.fillStyle = pal.grassBase;
            ctx.fillRect(px + 1, py + 5, 2, 5);
            ctx.fillRect(px + 1, py + 20, 2, 6);
            ctx.fillStyle = pal.grassLight;
            ctx.fillRect(px, py + 6, 1, 3);
          }
          if (right === 0) {
            ctx.fillStyle = pal.grassShadow;
            ctx.fillRect(px + ts - 2, py, 2, ts);
            ctx.fillRect(px + ts - 4, py + 5, 2, 7);
            ctx.fillRect(px + ts - 4, py + 18, 2, 8);

            ctx.fillStyle = pal.grassMid;
            ctx.fillRect(px + ts - 3, py + 4, 3, 8);
            ctx.fillRect(px + ts - 3, py + 17, 3, 9);
            ctx.fillStyle = pal.grassBase;
            ctx.fillRect(px + ts - 2, py + 6, 2, 5);
          }
          if (top === 0 && left === 0) {
            ctx.fillStyle = pal.grassShadow;
            ctx.fillRect(px, py, 6, 6);
            ctx.fillStyle = pal.grassBase;
            ctx.fillRect(px, py, 5, 4);
            ctx.fillRect(px, py, 4, 5);
            ctx.fillStyle = pal.grassLight;
            ctx.fillRect(px + 1, py + 1, 2, 2);
          }
          if (top === 0 && right === 0) {
            ctx.fillStyle = pal.grassShadow;
            ctx.fillRect(px + ts - 6, py, 6, 6);
            ctx.fillStyle = pal.grassBase;
            ctx.fillRect(px + ts - 5, py, 5, 4);
            ctx.fillRect(px + ts - 4, py, 4, 5);
          }
          if (bot === 0 && left === 0) {
            ctx.fillStyle = pal.grassShadow;
            ctx.fillRect(px, py + ts - 6, 6, 6);
            ctx.fillStyle = pal.grassMid;
            ctx.fillRect(px, py + ts - 4, 4, 4);
          }
          if (bot === 0 && right === 0) {
            ctx.fillStyle = pal.grassShadow;
            ctx.fillRect(px + ts - 6, py + ts - 6, 6, 6);
            ctx.fillStyle = pal.grassMid;
            ctx.fillRect(px + ts - 4, py + ts - 4, 4, 4);
          }
        }

        // 1B. Cornisas superiores y laterales biseladas de mesetas de risco (tile === 2)
        if (tileId === 2) {
          if (top !== 2) {
            ctx.fillStyle = '#0b101d';
            ctx.fillRect(px, py, ts, 1);
            ctx.fillStyle = pal.cliffRim;
            ctx.fillRect(px, py + 1, ts, 2);
            ctx.fillStyle = pal.cliffFace;
            ctx.fillRect(px, py + 3, ts, 2);
            // Muescas de unión entre rocas de la cornisa
            ctx.fillStyle = '#0b101d';
            ctx.fillRect(px + 10 + (h & 3), py + 1, 1, 3);
            ctx.fillRect(px + 23 + ((h >>> 2) & 3), py + 1, 1, 2);
          }
          if (left !== 2) {
            ctx.fillStyle = '#0b101d';
            ctx.fillRect(px, py, 1, ts);
            ctx.fillStyle = pal.cliffRim;
            ctx.fillRect(px + 1, py, 2, ts);
            ctx.fillStyle = pal.cliffFace;
            ctx.fillRect(px + 3, py, 1, ts);
            ctx.fillStyle = '#0b101d';
            ctx.fillRect(px + 1, py + 9 + (h & 3), 2, 1);
            ctx.fillRect(px + 1, py + 22, 2, 1);
          }
          if (right !== 2) {
            ctx.fillStyle = '#0b101d';
            ctx.fillRect(px + ts - 1, py, 1, ts);
            ctx.fillStyle = pal.cliffShadow;
            ctx.fillRect(px + ts - 3, py, 2, ts);
            ctx.fillStyle = '#0b101d';
            ctx.fillRect(px + ts - 3, py + 11, 2, 1);
            ctx.fillRect(px + ts - 3, py + 24, 2, 1);
          }
          if (top !== 2 && left !== 2) {
            ctx.fillStyle = '#0b101d';
            ctx.fillRect(px, py, 3, 3);
            ctx.fillStyle = pal.cliffRim;
            ctx.fillRect(px + 1, py + 1, 3, 3);
          }
          if (top !== 2 && right !== 2) {
            ctx.fillStyle = '#0b101d';
            ctx.fillRect(px + ts - 3, py, 3, 3);
            ctx.fillStyle = pal.cliffFace;
            ctx.fillRect(px + ts - 4, py + 1, 2, 2);
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
            const sx = px + 6 + ((h >>> 2) % 16);
            const sy = py + 6 + ((h >>> 6) % 16);
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
   * linda por debajo con terreno más bajo (`!= 2`), acotado al chunk activo.
   * Presenta bloques facetados concatenables, musgo colgante y rocas basales.
   * @private
   */
  _renderCabinetCliffs(
    ctx,
    pal,
    startCol = 0,
    endCol = this.cols,
    startRow = 0,
    endRow = this.rows - 1,
    originX = 0,
    originY = 0
  ) {
    const ts = this.tileSize;
    const maxY = Math.min(this.rows - 1, endRow);
    for (let y = startRow; y < maxY; y++) {
      for (let x = startCol; x < endCol; x++) {
        if (this.grid[y][x] === 2 && this.grid[y + 1][x] !== 2) {
          const px = x * ts - originX;
          const faceTop = (y + 1) * ts - 12 - originY;
          const wallHeight = 20;
          const h = this._hash2D(x, y, 19);
          const leftSame = x > 0 && this.grid[y][x - 1] === 2 && this.grid[y + 1][x - 1] !== 2;
          const rightSame = x < this.cols - 1 && this.grid[y][x + 1] === 2 && this.grid[y + 1][x + 1] !== 2;
          const splitX = 14 + (h % 5);

          // 1. Sombra proyectada índigo + cojín basal de hierba para anclar el risco
          ctx.fillStyle = 'rgba(15, 18, 46, 0.34)';
          ctx.fillRect(px, faceTop + wallHeight, ts, 7);

          ctx.fillStyle = pal.grassShadow;
          ctx.fillRect(px + 1, faceTop + wallHeight, ts - 2, 3);
          ctx.fillStyle = pal.grassMid;
          ctx.fillRect(px + 4, faceTop + wallHeight, 8, 2);
          ctx.fillRect(px + 18, faceTop + wallHeight, 9, 2);

          // 2. Cara vertical facetada del risco en bloques de piedra pizarra
          ctx.fillStyle = pal.cliffFace;
          ctx.fillRect(px, faceTop, ts, wallHeight);

          // Estratos oscuros en base del muro
          ctx.fillStyle = pal.cliffShadow;
          ctx.fillRect(px, faceTop + 12, splitX, 8);
          ctx.fillRect(px + splitX, faceTop + 10, ts - splitX, 10);

          // Facetas iluminadas en esquina superior izquierda de cada bloque pétreo
          ctx.fillStyle = pal.cliffTop;
          ctx.fillRect(px + 2, faceTop + 2, splitX - 4, 8);
          ctx.fillRect(px + splitX + 2, faceTop + 2, ts - splitX - 5, 6);
          ctx.fillStyle = pal.cliffRim;
          ctx.fillRect(px + 2, faceTop + 2, Math.max(4, splitX - 6), 2);
          ctx.fillRect(px + splitX + 2, faceTop + 2, Math.max(4, ts - splitX - 8), 1);

          // 3. Grietas escalonadas entre bloques y contornos laterales en los extremos
          ctx.fillStyle = '#0b101d';
          ctx.fillRect(px + splitX, faceTop + 2, 1, 9);
          ctx.fillRect(px + splitX - 1, faceTop + 11, 1, 7);
          ctx.fillRect(px + splitX + 1, faceTop + 8, 2, 1);

          if (!leftSame) {
            ctx.fillStyle = '#0b101d';
            ctx.fillRect(px, faceTop, 1, wallHeight);
          } else {
            ctx.fillStyle = pal.cliffShadow;
            ctx.fillRect(px, faceTop + 4, 1, 13);
          }
          if (!rightSame) {
            ctx.fillStyle = '#0b101d';
            ctx.fillRect(px + ts - 1, faceTop, 1, wallHeight);
          }

          // 4. Cornisa superior biselada y contorno inferior de tinta anime
          ctx.fillStyle = '#0b101d';
          ctx.fillRect(px, faceTop - 3, ts, 1);
          ctx.fillStyle = pal.cliffRim;
          ctx.fillRect(px, faceTop - 2, ts, 3);
          ctx.fillStyle = '#0b101d';
          ctx.fillRect(px, faceTop + wallHeight - 1, ts, 2);

          // 5. Piedras redondeadas discretas al pie del risco
          if ((h & 3) !== 0) {
            const rx = px + 3 + ((h >>> 3) % 20);
            ctx.fillStyle = '#0b101d';
            ctx.fillRect(rx, faceTop + wallHeight - 3, 6, 4);
            ctx.fillStyle = pal.cliffFace;
            ctx.fillRect(rx + 1, faceTop + wallHeight - 2, 4, 2);
            ctx.fillStyle = pal.cliffRim;
            ctx.fillRect(rx + 1, faceTop + wallHeight - 2, 3, 1);
          }

          // 6. Mantos sutiles de musgo colgando de la cornisa en segmentos alternados
          if ((h & 3) <= 1) {
            const mx = px + 4 + ((h >>> 4) % 14);
            ctx.fillStyle = pal.grassShadow;
            ctx.fillRect(mx, faceTop - 1, 9, 4);
            ctx.fillRect(mx + 2, faceTop + 3, 5, 2);
            ctx.fillStyle = pal.grassBase;
            ctx.fillRect(mx + 1, faceTop - 1, 7, 3);
            ctx.fillStyle = pal.grassLight;
            ctx.fillRect(mx + 2, faceTop - 1, 4, 1);

            if ((h & 15) === 4) {
              ctx.fillStyle = pal.flowerA;
              ctx.fillRect(mx + 3, faceTop + 1, 2, 2);
              ctx.fillStyle = pal.flowerB;
              ctx.fillRect(mx + 4, faceTop + 1, 1, 1);
            }
          }
        }
      }
    }
  }

  /**
   * Dibuja un pequeño racimo foliar pixel-art (5x3 px) en tonos medios y claros sin bloques oscuros.
   * @private
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} lx - Coordenada X
   * @param {number} ly - Coordenada Y
   * @param {Object} pal - Paleta cromática del bioma
   */
  _drawTurfLeafCluster(ctx, lx, ly, pal) {
    ctx.fillStyle = pal.grassMid;
    ctx.fillRect(lx, ly + 1, 4, 1);
    ctx.fillRect(lx + 1, ly + 2, 3, 1);
    ctx.fillStyle = pal.grassLight;
    ctx.fillRect(lx, ly, 2, 1);
    ctx.fillRect(lx + 3, ly, 2, 1);
  }

  /**
   * Dibuja una loseta de grama concatenable (seamless) sin marcas fijas en los bordes,
   * variando manchas escalonadas suaves y micro-racimos foliares internos por hash.
   * @private
   */
  _drawBiomeTurf(ctx, px, py, x, y, pal) {
    const ts = this.tileSize;
    const h = this._hash2D(x, y, 1);

    ctx.fillStyle = pal.grassBase;
    ctx.fillRect(px, py, ts, ts);

    // Manchas escalonadas suaves cuya posición varía por hash (cero rejilla fija cada 32px)
    const ox1 = 4 + (h % 18);
    const oy1 = 4 + ((h >>> 4) % 18);
    ctx.fillStyle = pal.grassMid;
    ctx.fillRect(px + ox1, py + oy1, 5, 2);
    ctx.fillRect(px + ox1 + 2, py + oy1 + 2, 4, 1);

    if ((h & 3) !== 1) {
      const ox2 = 5 + ((h >>> 12) % 17);
      const oy2 = 5 + ((h >>> 16) % 18);
      ctx.fillRect(px + ox2, py + oy2, 4, 2);
    }

    if ((h & 3) === 0 || (h & 3) === 2) {
      ctx.fillStyle = pal.grassLight;
      ctx.fillRect(px + 6 + ((h >>> 8) % 16), py + 5 + ((h >>> 14) % 16), 3, 1);
    }

    // 2 racimos de hojitas suaves en márgenes seguros [4..23]
    const clusterA_X = px + 4 + ((h >>> 6) % 9);
    const clusterA_Y = py + 6 + ((h >>> 10) % 9);
    this._drawTurfLeafCluster(ctx, clusterA_X, clusterA_Y, pal);

    const clusterB_X = px + 15 + ((h >>> 14) % 9);
    const clusterB_Y = py + 17 + ((h >>> 18) % 8);
    this._drawTurfLeafCluster(ctx, clusterB_X, clusterB_Y, pal);

    // Briznas sutiles puntuales en variantes pares
    if ((h & 1) === 0) {
      const bx = px + 16 + ((h >>> 5) % 9);
      const by = py + 6 + ((h >>> 9) % 7);
      ctx.fillStyle = pal.grassLight;
      ctx.fillRect(bx, by, 2, 1);
      ctx.fillRect(bx + 2, by + 1, 1, 1);
    }

    // Flor silvestre muy esporádica (solo 1 de cada 8 variantes: v=7 -> seedX=22, seedY=37)
    const isFlowerTile = (x === 22 && y === 37) || ((h & 31) === 11);
    if (isFlowerTile) {
      const fx = px + 18;
      const fy = py + 11;
      ctx.fillStyle = pal.grassMid;
      ctx.fillRect(fx, fy + 2, 3, 1);
      ctx.fillStyle = pal.flowerA;
      ctx.fillRect(fx, fy, 3, 1);
      ctx.fillRect(fx + 1, fy - 1, 1, 3);
      ctx.fillStyle = pal.flowerB;
      ctx.fillRect(fx + 1, fy, 1, 1);
    }
  }

  /**
   * Dibuja una loseta de sendero de tierra concatenable (seamless) sin marcas fijas repetidas,
   * con ondas suaves por hash y pequeños guijarros discretos.
   * @private
   */
  _drawBiomeDirt(ctx, px, py, x, y, pal) {
    const ts = this.tileSize;
    const h = this._hash2D(x, y, 2);

    ctx.fillStyle = pal.dirtBase;
    ctx.fillRect(px, py, ts, ts);

    // Manchas escalonadas orgánicas desplazadas por hash (cero patrón repetitivo cada 32px)
    const dx1 = 4 + (h % 17);
    const dy1 = 5 + ((h >>> 4) % 18);
    ctx.fillStyle = pal.dirtDark;
    ctx.fillRect(px + dx1, py + dy1, 5, 2);
    ctx.fillRect(px + dx1 + 2, py + dy1 + 2, 4, 1);

    const dx2 = 5 + ((h >>> 16) % 16);
    const dy2 = 6 + ((h >>> 20) % 17);
    ctx.fillRect(px + dx2, py + dy2, 4, 2);

    ctx.fillStyle = pal.dirtLight;
    const lx = 6 + ((h >>> 8) % 16);
    const ly = 7 + ((h >>> 12) % 16);
    ctx.fillRect(px + lx, py + ly, 4, 1);
    ctx.fillRect(px + lx + 1, py + ly + 1, 3, 1);

    // Guijarro pequeño facetado y granos sutiles en el interior
    const sx = px + 6 + ((h >>> 14) % 16);
    const sy = py + 8 + ((h >>> 18) % 14);
    ctx.fillStyle = pal.dirtDark;
    ctx.fillRect(sx, sy + 1, 3, 2);
    ctx.fillStyle = pal.dirtLight;
    ctx.fillRect(sx, sy, 2, 1);

    if ((h & 3) <= 1) {
      const sx2 = px + 5 + ((h >>> 20) % 18);
      const sy2 = py + 18 + ((h >>> 24) % 8);
      ctx.fillStyle = pal.dirtDark;
      ctx.fillRect(sx2, sy2, 2, 1);
      ctx.fillRect(sx2 + 4, sy2 - 3, 1, 1);
    }
  }

  /**
   * Dibuja la cima de meseta/risco concatenable (seamless) sin rejilla ni marcas fijas,
   * variando vetas pétreas suaves y fisuras minerales discretas por hash.
   * @private
   */
  _drawBiomeCliffTop(ctx, px, py, x, y, pal) {
    const ts = this.tileSize;
    const h = this._hash2D(x, y, 5);

    ctx.fillStyle = pal.cliffTop;
    ctx.fillRect(px, py, ts, ts);

    // Veta pétrea sutil desplazada por hash (cero marcas fijas en los bordes)
    const fx = 5 + (h % 16);
    const fy = 6 + ((h >>> 4) % 16);
    ctx.fillStyle = pal.cliffFace;
    ctx.fillRect(px + fx, py + fy, 6, 2);
    ctx.fillRect(px + fx + 2, py + fy + 2, 4, 1);

    const fx2 = 6 + ((h >>> 14) % 15);
    const fy2 = 7 + ((h >>> 18) % 15);
    ctx.fillRect(px + fx2, py + fy2, 4, 2);

    if ((h & 1) === 0) {
      const gx = px + 8 + ((h >>> 8) % 13);
      const gy = py + 12 + ((h >>> 12) % 11);
      ctx.fillStyle = pal.cliffShadow;
      ctx.fillRect(gx, gy, 3, 1);
      ctx.fillRect(gx + 2, gy + 1, 3, 1);
    } else {
      ctx.fillStyle = pal.cliffRim;
      ctx.fillRect(px + fx, py + fy - 1, 3, 1);
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
      ctx.fillRect(px + (h & 7), py + 4 + ((h >>> 3) & 7), 16 + ((h >>> 6) & 11), 6 + ((h >>> 10) & 3));
    }
    if ((h & 7) <= 3) {
      ctx.fillStyle = pal.waterDeep;
      ctx.fillRect(px + ((h >>> 8) % 14), py + 20, 12 + (h & 7), 5);
    }

    // Destellos de corriente horizontales en pixel art
    if ((h & 3) === 1 || (h & 7) === 6) {
      ctx.fillStyle = pal.waterFoam;
      ctx.fillRect(px + 4 + ((h >>> 12) % 16), py + 8 + ((h >>> 16) % 16), 7 + (h & 3), 2);
    }
    if ((h & 15) === 11) {
      ctx.fillStyle = '#d4f6ff';
      ctx.fillRect(px + 6 + ((h >>> 18) % 16), py + 12 + ((h >>> 22) % 12), 4, 1);
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

  /**
   * Dibuja losas de plaza talladas en aparejo trabado concatenable con biseles pixel-art
   * y discretos brotes de musgo en las juntas.
   * @private
   */
  _drawBiomePlaza(ctx, px, py, x, y, pal) {
    const ts = this.tileSize;
    const half = Math.floor(ts * 0.5);

    ctx.fillStyle = pal.plazaBase;
    ctx.fillRect(px, py, ts, ts);

    // Biseles claros superiores e izquierdos en cada sillar
    ctx.fillStyle = pal.cliffRim;
    ctx.fillRect(px + 1, py + 1, ts - 2, 1);
    ctx.fillRect(px + 1, py + half + 1, half - 2, 1);
    ctx.fillRect(px + half + 1, py + half + 1, half - 2, 1);
    ctx.fillRect(px + 1, py + 1, 1, half - 2);
    ctx.fillRect(px + half + 1, py + half + 1, 1, half - 2);

    // Juntas de sillares trabados (alineadas a 0 y half para concatenación exacta)
    ctx.fillStyle = pal.plazaTrim;
    ctx.fillRect(px, py, ts, 1);
    ctx.fillRect(px, py + half, ts, 1);
    ctx.fillRect(px, py + 1, 1, half - 1);
    ctx.fillRect(px + half, py + half + 1, 1, half - 1);

    // Variante alterna con sutil acento dorado rúnico o musgo en junta
    if ((x + y) % 4 === 0) {
      ctx.fillStyle = pal.plazaGold;
      ctx.fillRect(px + half - 1, py + half - 1, 3, 3);
      ctx.fillStyle = pal.plazaTrim;
      ctx.fillRect(px + half, py + half, 1, 1);
    } else if (x !== 0) {
      ctx.fillStyle = pal.grassShadow;
      ctx.fillRect(px + half - 2, py + half, 4, 2);
      ctx.fillStyle = pal.grassMid;
      ctx.fillRect(px + half - 1, py + half, 2, 1);
    }
  }

  /**
   * Renderiza exclusivamente los chunks de terreno visibles dentro de cámara bajo demanda.
   * @param {CanvasRenderingContext2D} ctx
   * @param {import('../render/Camera.js').Camera} camera
   */
  render(ctx, camera) {
    if (!ctx || !camera) return;

    const bounds = camera.getVisibleWorldBounds(this.tileSize);
    const minCx = Math.max(0, Math.floor(bounds.minX / this.chunkPx));
    const maxCx = Math.min(this.chunkCols - 1, Math.floor(bounds.maxX / this.chunkPx));
    const minCy = Math.max(0, Math.floor(bounds.minY / this.chunkPx));
    const maxCy = Math.min(this.chunkRows - 1, Math.floor(bounds.maxY / this.chunkPx));

    for (let cy = minCy; cy <= maxCy; cy++) {
      const worldY = cy * this.chunkPx;
      for (let cx = minCx; cx <= maxCx; cx++) {
        const chunkCanvas = this._getOrBakeChunk(cx, cy);
        if (chunkCanvas) {
          ctx.drawImage(chunkCanvas, cx * this.chunkPx, worldY);
        }
      }
    }
  }
}

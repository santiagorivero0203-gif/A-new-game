/**
 * @module LevelSchema
 * @description Fuente única de verdad para el esquema de Zonas y Mundos de
 * *Be a Legend: El Legado de la Reliquia*.
 * Define migración, normalización, creación de borradores y cálculo determinista
 * de árboles perimetrales compartido entre el Motor (`LevelLoader`) y el Editor (`LevelEditor`).
 * @author Be a Legend Team
 * @version 2.0.0
 */

/** Versión actual del esquema de datos de zona/nivel */
export const SCHEMA_VERSION = 2;

/**
 * Calcula las coordenadas exactas de los árboles perimetrales a partir de `perimeterConfig`.
 * Reutilizado 1:1 por `LevelLoader` (instanciación) y `LevelEditor` (previsualización)
 * para garantizar paridad visual y física absoluta. Cuando se dispone de `terrainGrid`,
 * descarta automáticamente cualquier árbol cuyo tronco caiga sobre acantilados (`2`) o fluidos (`3`).
 * @param {Object} levelData - Nivel o borrador normalizado
 * @param {Array<Array<number>>|null} [terrainGrid=null] - Matriz opcional de terreno `[rows][cols]`
 * @returns {Array<{ x: number, y: number }>} Posiciones top-left de cada árbol del perímetro
 */
export function computePerimeterTrees(levelData, terrainGrid = null) {
  if (!levelData || !levelData.perimeterConfig || levelData.perimeterConfig.enabled === false) {
    return [];
  }

  const cfg = levelData.perimeterConfig;
  const mapCfg = levelData.map || levelData;
  const cols = mapCfg.cols || levelData.cols || 52;
  const rows = mapCfg.rows || levelData.rows || 36;
  const tileSize = mapCfg.tileSize || levelData.tileSize || 32;
  const mapWidth = cols * tileSize;
  const mapHeight = rows * tileSize;

  const grid = Array.isArray(terrainGrid) && terrainGrid.length === rows
    ? terrainGrid
    : (Array.isArray(levelData.terrainGrid) && levelData.terrainGrid.length === rows ? levelData.terrainGrid : null);

  const step = Math.max(108, cfg.step || 108);
  const roadGap = Array.isArray(cfg.roadGapY) ? cfg.roadGapY : [560, 700];
  const streamGapX = Array.isArray(cfg.streamGapX) ? cfg.streamGapX : null;
  const caveSafeZone = cfg.caveSafeZone || null;

  const isInsideCaveSafeZone = (tx, ty) => {
    if (!caveSafeZone) return false;
    // Evaluar contra el contorno de tronco/copa del árbol para no superponerse con la boca de cueva
    const ax1 = tx + 12;
    const ay1 = ty + 16;
    const ax2 = tx + 72;
    const ay2 = ty + 96;
    return (
      ax1 <= caveSafeZone.x + caveSafeZone.width &&
      ax2 >= caveSafeZone.x &&
      ay1 <= caveSafeZone.y + caveSafeZone.height &&
      ay2 >= caveSafeZone.y
    );
  };

  const isTrunkOnBlockedTile = (tx, ty) => {
    if (!grid) return false;
    // Hitbox canónica del tronco de Tree.js (offsetX: 30, offsetY: 78, w: 24, h: 18)
    const minC = Math.floor((tx + 30) / tileSize);
    const maxC = Math.floor((tx + 53.9) / tileSize);
    const minR = Math.floor((ty + 78) / tileSize);
    const maxR = Math.floor((ty + 95.9) / tileSize);
    for (let r = minR; r <= maxR; r++) {
      for (let c = minC; c <= maxC; c++) {
        if (r < 0 || c < 0 || r >= rows || c >= cols) return true;
        const tileId = grid[r]?.[c] ?? 0;
        if (tileId === 2 || tileId === 3) return true;
      }
    }
    return false;
  };

  const trees = [];
  const tryPushTree = (tx, ty) => {
    if (isInsideCaveSafeZone(tx, ty)) return;
    if (isTrunkOnBlockedTile(tx, ty)) return;
    trees.push({ x: tx, y: ty });
  };

  // Linderos Norte y Sur
  let colIdx = 0;
  for (let x = 0; x < mapWidth - 40; x += step) {
    const staggerY = (colIdx % 2) * 24;
    colIdx++;
    if (streamGapX && x + 64 > streamGapX[0] && x < streamGapX[1]) {
      continue;
    }
    tryPushTree(x, staggerY);
    tryPushTree(x, mapHeight - 96 - staggerY);
  }

  // Linderos Oeste y Este
  let rowIdx = 0;
  for (let y = 96; y < mapHeight - 120; y += step) {
    const staggerX = (rowIdx % 2) * 24;
    rowIdx++;
    if (cfg.hasOpenRoad && y > roadGap[0] && y < roadGap[1]) {
      continue;
    }
    tryPushTree(staggerX, y);
    tryPushTree(mapWidth - 96 - staggerX, y);
  }

  return trees;
}

/**
 * Crea un borrador de Zona vacío con valores canónicos conformes al esquema `SCHEMA_VERSION`.
 * @param {Object} [options={}]
 * @returns {Object} Documento plano de Zona
 */
export function createBlankLevel(options = {}) {
  const cols = Math.max(16, Math.min(160, parseInt(options.cols, 10) || 52));
  const rows = Math.max(16, Math.min(120, parseInt(options.rows, 10) || 36));
  const tileSize = 32;
  const biome = options.biome || options.worldId || 'cave_exit_intro';
  const worldId = options.worldId || biome;
  const id = options.id || `zone_${Date.now().toString(36)}`;
  const zoneId = options.zoneId || id;
  const name = options.name || 'Nueva Zona';

  const defaultSpawnX = Math.floor(cols * tileSize * 0.15);
  const defaultSpawnY = Math.floor(rows * tileSize * 0.25);

  const terrainGrid = Array.from({ length: rows }, () => new Array(cols).fill(0));

  return {
    schemaVersion: SCHEMA_VERSION,
    id,
    worldId,
    zoneId,
    zoneOrder: typeof options.zoneOrder === 'number' ? options.zoneOrder : 1,
    isRootZone: Boolean(options.isRootZone),
    name,
    worldTitle: options.worldTitle || name,
    biome,
    layoutPreset: options.layoutPreset || biome,
    weather: options.weather || 'pollen',
    cols,
    rows,
    tileSize,
    playerSpawn: { x: defaultSpawnX, y: defaultSpawnY },
    spawnPoints: [
      { id: 'default', label: 'Entrada Principal', x: defaultSpawnX, y: defaultSpawnY }
    ],
    arenaCenter: {
      x: Math.floor(cols * tileSize * 0.5),
      y: Math.floor(rows * tileSize * 0.5)
    },
    ambientColor: options.ambientColor || 'rgba(5, 8, 17, 0.22)',
    initialObjective: options.initialObjective || 'Explora esta zona forjada por la Reliquia',
    enableStealth: Boolean(options.enableStealth),
    perimeterConfig: options.perimeterConfig ? { ...options.perimeterConfig } : null,
    terrainGrid,
    solidColliders: [],
    stealthZones: [],
    corridorZones: [],
    lights: [],
    props: [],
    entities: [],
    clearingTrees: [],
    foliage: []
  };
}

/**
 * Normaliza y migra un objeto de nivel/zona (oficial, importado o guardado)
 * garantizando consistencia estructural, copias seguras y compatibilidad retroactiva.
 * @param {Object} raw - JSON crudo o borrador parcial
 * @param {Object} [opts={}]
 * @param {Function|null} [opts.generateMissingGrid=null] - Callback `(cols, rows, tileSize, layoutPreset, biome) => number[][]`
 * @returns {Object} Documento de Zona normalizado conforme a `SCHEMA_VERSION`
 */
export function normalizeLevel(raw, { generateMissingGrid = null } = {}) {
  if (!raw || typeof raw !== 'object') {
    return createBlankLevel();
  }

  const mapCfg = raw.map || raw;
  const cols = Math.max(16, Math.min(160, parseInt(raw.cols || mapCfg.cols, 10) || 52));
  const rows = Math.max(16, Math.min(120, parseInt(raw.rows || mapCfg.rows, 10) || 36));
  const tileSize = parseInt(raw.tileSize || mapCfg.tileSize, 10) || 32;

  const worldId = raw.worldId || raw.biome || raw.layoutPreset || 'cave_exit_intro';
  const biome = raw.biome || worldId;
  const layoutPreset = raw.layoutPreset || biome;
  const id = raw.id || `zone_${Date.now().toString(36)}`;
  const zoneId = raw.zoneId || id;
  const name = raw.name || raw.worldTitle || 'Zona Sin Título';

  const fallbackSpawn = {
    x: Math.floor(cols * tileSize * 0.15),
    y: Math.floor(rows * tileSize * 0.25)
  };
  const playerSpawn = (raw.playerSpawn && typeof raw.playerSpawn.x === 'number' && typeof raw.playerSpawn.y === 'number')
    ? { x: raw.playerSpawn.x, y: raw.playerSpawn.y }
    : fallbackSpawn;

  const rawSpawns = Array.isArray(raw.spawnPoints) ? raw.spawnPoints : [];
  const spawnPoints = rawSpawns
    .filter(sp => sp && typeof sp.id === 'string' && typeof sp.x === 'number' && typeof sp.y === 'number')
    .map(sp => ({ id: sp.id, label: sp.label || sp.id, x: sp.x, y: sp.y }));

  if (!spawnPoints.some(sp => sp.id === 'default')) {
    spawnPoints.unshift({ id: 'default', label: 'Entrada Principal', x: playerSpawn.x, y: playerSpawn.y });
  }

  const arenaCenter = (raw.arenaCenter && typeof raw.arenaCenter.x === 'number' && typeof raw.arenaCenter.y === 'number')
    ? { x: raw.arenaCenter.x, y: raw.arenaCenter.y }
    : { x: Math.floor(cols * tileSize * 0.5), y: Math.floor(rows * tileSize * 0.5) };

  const rawColliders = Array.isArray(raw.solidColliders)
    ? raw.solidColliders
    : (Array.isArray(raw.colliders) ? raw.colliders : []);
  const solidColliders = rawColliders.map(c => ({ ...c }));

  const stealthZones = Array.isArray(raw.stealthZones) ? raw.stealthZones.map(z => ({ ...z })) : [];
  const corridorZones = Array.isArray(raw.corridorZones) ? raw.corridorZones.map(z => ({ ...z })) : [];
  const lights = Array.isArray(raw.lights) ? raw.lights.map(l => ({ ...l })) : [];
  const props = Array.isArray(raw.props)
    ? raw.props.map((p) => ({
      ...p,
      sealedBy: Array.isArray(p.sealedBy) ? [...p.sealedBy] : undefined
    }))
    : [];
  const entities = Array.isArray(raw.entities)
    ? raw.entities.map((e) => ({
      ...e,
      customTags: Array.isArray(e.customTags) ? [...e.customTags] : []
    }))
    : [];
  const clearingTrees = Array.isArray(raw.clearingTrees) ? raw.clearingTrees.map(t => ({ ...t })) : [];
  const foliage = Array.isArray(raw.foliage) ? raw.foliage.map(f => ({ ...f })) : [];

  // Validar o regenerar terrainGrid de tamaño [rows][cols]
  let terrainGrid;
  const hasFullGrid = Array.isArray(raw.terrainGrid)
    && raw.terrainGrid.length === rows
    && Array.isArray(raw.terrainGrid[0])
    && raw.terrainGrid[0].length === cols;

  if (hasFullGrid) {
    terrainGrid = raw.terrainGrid.map(row => row.slice(0, cols));
  } else if (typeof generateMissingGrid === 'function' && (!Array.isArray(raw.terrainGrid) || raw.terrainGrid.length === 0)) {
    const generated = generateMissingGrid(cols, rows, tileSize, layoutPreset, biome);
    terrainGrid = Array.isArray(generated)
      ? generated.map(row => row.slice(0, cols))
      : Array.from({ length: rows }, () => new Array(cols).fill(0));
  } else {
    terrainGrid = Array.from({ length: rows }, (_, r) =>
      Array.from({ length: cols }, (_, c) => (raw.terrainGrid?.[r]?.[c] ?? 0))
    );
  }

  let perimeterConfig = null;
  if (raw.perimeterConfig && typeof raw.perimeterConfig === 'object') {
    perimeterConfig = {
      ...raw.perimeterConfig,
      enabled: raw.perimeterConfig.enabled !== false,
      roadGapY: Array.isArray(raw.perimeterConfig.roadGapY) ? [...raw.perimeterConfig.roadGapY] : undefined,
      streamGapX: Array.isArray(raw.perimeterConfig.streamGapX) ? [...raw.perimeterConfig.streamGapX] : undefined,
      caveSafeZone: raw.perimeterConfig.caveSafeZone ? { ...raw.perimeterConfig.caveSafeZone } : undefined
    };
  }

  return {
    schemaVersion: SCHEMA_VERSION,
    id,
    worldId,
    zoneId,
    zoneOrder: typeof raw.zoneOrder === 'number' ? raw.zoneOrder : 1,
    isRootZone: Boolean(raw.isRootZone),
    name,
    worldTitle: raw.worldTitle || name,
    biome,
    layoutPreset,
    weather: raw.weather || 'pollen',
    cols,
    rows,
    tileSize,
    startDormant: Boolean(raw.startDormant),
    playerSpawn,
    spawnPoints,
    arenaCenter,
    ambientColor: raw.ambientColor || 'rgba(5, 8, 17, 0.22)',
    initialObjective: raw.initialObjective || null,
    enableStealth: Boolean(raw.enableStealth || stealthZones.length > 0),
    perimeterConfig,
    terrainGrid,
    solidColliders,
    stealthZones,
    corridorZones,
    lights,
    props,
    entities,
    clearingTrees,
    foliage
  };
}


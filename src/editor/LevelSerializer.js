/**
 * @module LevelSerializer
 * @description Módulo de serialización, compresión RLE, validación pre-vuelo y
 * exportación/importación `.json` para la Forja de Mundos.
 * Delega la normalización estructural y creación de borradores a `LevelSchema.js`.
 * @author Be a Legend Team
 * @version 2.0.0
 */

import {
  SCHEMA_VERSION,
  createBlankLevel as schemaCreateBlankLevel,
  normalizeLevel
} from '../data/LevelSchema.js';

export const STORAGE_KEY = 'be_a_legend_custom_levels_v1';

/** Re-export de creación canónica desde `LevelSchema` */
export const createBlankLevel = schemaCreateBlankLevel;

/**
 * Codifica una matriz 2D de losetas (`terrainGrid`) con Run-Length Encoding (RLE) en una cadena compacta.
 * Ejemplo: una hilera de 12 ceros y 4 unos -> "0x12,1x4".
 * Reduce el almacenamiento en localStorage de ~25 KB a ~250 bytes.
 * @param {number[][]} grid - Matriz [rows][cols] de enteros (0..5)
 * @returns {string} Cadena comprimida RLE
 */
export function encodeTerrainGrid(grid) {
  if (!Array.isArray(grid) || grid.length === 0) return '';
  const rows = grid.length;
  const cols = grid[0].length;
  const runs = [];

  let currentTile = grid[0][0];
  let currentCount = 0;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const tile = grid[r][c] ?? 0;
      if (tile === currentTile) {
        currentCount++;
      } else {
        runs.push(`${currentTile}x${currentCount}`);
        currentTile = tile;
        currentCount = 1;
      }
    }
  }
  if (currentCount > 0) {
    runs.push(`${currentTile}x${currentCount}`);
  }

  return runs.join(',');
}

/**
 * Decodifica una cadena RLE de vuelta a una matriz 2D [rows][cols].
 * Si ya es una matriz 2D, retorna una copia plana segura.
 * @param {string|number[][]} encoded - Cadena RLE o matriz 2D
 * @param {number} cols - Cantidad esperada de columnas
 * @param {number} rows - Cantidad esperada de filas
 * @param {number} [defaultTile=0] - Terreno de relleno
 * @returns {number[][]}
 */
export function decodeTerrainGrid(encoded, cols, rows, defaultTile = 0) {
  if (Array.isArray(encoded) && Array.isArray(encoded[0])) {
    return encoded.map(row => row.slice(0, cols));
  }

  const grid = Array.from({ length: rows }, () => new Array(cols).fill(defaultTile));
  if (typeof encoded !== 'string' || !encoded.trim()) {
    return grid;
  }

  const tokens = encoded.split(',');
  let r = 0;
  let c = 0;

  for (const token of tokens) {
    const parts = token.split('x');
    const tileId = parseInt(parts[0], 10) || 0;
    const count = parseInt(parts[1], 10) || 1;

    for (let i = 0; i < count; i++) {
      if (r < rows && c < cols) {
        grid[r][c] = tileId;
      }
      c++;
      if (c >= cols) {
        c = 0;
        r++;
        if (r >= rows) break;
      }
    }
    if (r >= rows) break;
  }

  return grid;
}

/**
 * Realiza un clon profundo normalizado de un borrador de nivel/zona.
 * @param {Object} draft
 * @returns {Object|null}
 */
export function cloneLevelDraft(draft) {
  if (!draft) return null;
  const cloned = normalizeLevel(draft);
  if (typeof draft.updatedAt === 'number') {
    cloned.updatedAt = draft.updatedAt;
  }
  return cloned;
}

/**
 * Valida un borrador antes de Playtest o Exportación.
 * Distingue entre errores bloqueantes (hacen injugable la zona) y advertencias de diseño.
 * @param {Object} draft
 * @returns {{ valid: boolean, errors: string[], warnings: string[] }}
 */
export function validateLevel(draft) {
  const errors = [];
  const warnings = [];

  if (!draft) {
    return { valid: false, errors: ['El borrador de la zona es nulo o indefinido.'], warnings };
  }

  const cols = draft.cols || (draft.map && draft.map.cols) || 52;
  const rows = draft.rows || (draft.map && draft.map.rows) || 36;
  const tileSize = draft.tileSize || (draft.map && draft.map.tileSize) || 32;
  const mapWidth = cols * tileSize;
  const mapHeight = rows * tileSize;

  // 1. Verificación del Spawn de Santi
  if (!draft.playerSpawn || typeof draft.playerSpawn.x !== 'number' || typeof draft.playerSpawn.y !== 'number') {
    errors.push('Falta el punto de inicio del jugador (playerSpawn).');
  } else {
    const { x, y } = draft.playerSpawn;
    if (x < 16 || x > mapWidth - 16 || y < 16 || y > mapHeight - 16) {
      errors.push(`El inicio del jugador (${Math.round(x)}, ${Math.round(y)}) está fuera de los límites del mapa (${mapWidth}x${mapHeight}).`);
    } else if (Array.isArray(draft.terrainGrid)) {
      const tileCol = Math.floor(x / tileSize);
      const tileRow = Math.floor(y / tileSize);
      const tileId = draft.terrainGrid[tileRow]?.[tileCol];
      if (tileId === 2) {
        errors.push(`El jugador inicia sobre un Acantilado Sólido (col ${tileCol}, fila ${tileRow}). Muévelo a terreno plano.`);
      } else if (tileId === 3) {
        errors.push(`El jugador inicia sobre Agua o Magma (col ${tileCol}, fila ${tileRow}). Muévelo a terreno plano.`);
      }
    }
  }

  // 2. Verificaciones de Entidades y Props
  const hasPortal = Array.isArray(draft.props) && draft.props.some(p => p.propType === 'world_portal');
  if (!hasPortal) {
    warnings.push('La zona no tiene un Portal de Conexión (world_portal) para transicionar a otra zona o mundo.');
  }

  const enemyCount = Array.isArray(draft.entities) ? draft.entities.filter(e => e.type === 'enemy').length : 0;
  if (enemyCount === 0) {
    warnings.push('No hay enemigos colocados en la zona. El escenario será solo de exploración pacífica.');
  }

  const customPropsWithoutSpec = Array.isArray(draft.props)
    ? draft.props.filter(p => p.propType === 'custom_env_prop' && (!p.devDescription || !String(p.devDescription).trim())).length
    : 0;
  if (customPropsWithoutSpec > 0) {
    warnings.push(`Hay ${customPropsWithoutSpec} objeto(s) personalizado(s) sin descripción funcional (devDescription).`);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Exporta un borrador normalizado como archivo descargable `.json` estándar compatible con `LevelLoader.loadLevel()`.
 * @param {Object} draft
 */
export function exportLevelToFile(draft) {
  if (!draft) return;
  const normalized = normalizeLevel(draft);
  const exportData = {
    schemaVersion: SCHEMA_VERSION,
    id: normalized.id,
    worldId: normalized.worldId,
    zoneId: normalized.zoneId,
    zoneOrder: normalized.zoneOrder,
    isRootZone: normalized.isRootZone,
    name: normalized.name,
    worldTitle: normalized.worldTitle,
    biome: normalized.biome,
    layoutPreset: normalized.layoutPreset,
    weather: normalized.weather,
    cols: normalized.cols,
    rows: normalized.rows,
    tileSize: normalized.tileSize,
    playerSpawn: normalized.playerSpawn,
    spawnPoints: normalized.spawnPoints,
    arenaCenter: normalized.arenaCenter,
    ambientColor: normalized.ambientColor,
    initialObjective: normalized.initialObjective,
    enableStealth: normalized.enableStealth,
    perimeterConfig: normalized.perimeterConfig,
    solidColliders: normalized.solidColliders,
    stealthZones: normalized.stealthZones,
    lights: normalized.lights,
    props: normalized.props,
    entities: normalized.entities,
    clearingTrees: normalized.clearingTrees,
    foliage: normalized.foliage,
    terrainGrid: normalized.terrainGrid
  };

  const jsonStr = JSON.stringify(exportData, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${exportData.id}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Procesa y normaliza un archivo o texto JSON subido por el usuario utilizando `LevelSchema.normalizeLevel`.
 * @param {string} jsonString
 * @param {Object} [opts={}]
 * @returns {Object} Borrador normalizado
 */
export function parseLevelFromJSON(jsonString, opts = {}) {
  const parsed = JSON.parse(jsonString);
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('El archivo no contiene un objeto JSON válido.');
  }

  const cols = parsed.cols || (parsed.map && parsed.map.cols) || 52;
  const rows = parsed.rows || (parsed.map && parsed.map.rows) || 36;

  const working = { ...parsed };
  if (!Array.isArray(working.terrainGrid) && working.terrainGridRLE) {
    working.terrainGrid = decodeTerrainGrid(working.terrainGridRLE, cols, rows);
  }

  return normalizeLevel(working, opts);
}

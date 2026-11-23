/**
 * @module worlds
 * @description Catálogo ligero de los 4 Mundos / Biomas de *Be a Legend: El Legado de la Reliquia*
 * con carga dinámica bajo demanda (`import()`) para no analizar ni retener en RAM los JSONs de
 * escenarios que el jugador no está visitando actualmente.
 * @author Be a Legend Team
 * @version 2.0.0
 */

import { normalizeLevel } from './LevelSchema.js';

const LEVEL_IMPORTERS = {
  cave_exit_intro: () => import('./levels/cave_exit_intro.json'),
  marsh_of_spores: () => import('./levels/marsh_of_spores.json'),
  ash_caldera: () => import('./levels/ash_caldera.json'),
  astral_citadel: () => import('./levels/astral_citadel.json')
};

/** @type {Map<string, Object>} Caché acotada solo al nivel activo o solicitado */
const _loadedLevelsCache = new Map();

/** @type {Map<string, Object>} Registro dinámico de mundos/zonas personalizadas y borradores del editor */
const _customWorlds = new Map();

/**
 * Registra un mundo o zona personalizada en memoria para ser cargado por el motor como un nivel estándar.
 * @param {Object} worldData - Objeto plano que cumple el contrato de nivel/zona JSON
 */
export function registerCustomWorld(worldData) {
  if (!worldData || !worldData.id) return;
  // Proteger los 4 mundos oficiales de la campaña contra sobreescrituras accidentales en localStorage
  if (LEVEL_IMPORTERS[worldData.id]) return;
  const normalized = normalizeLevel(worldData);
  normalized.id = worldData.id;
  _customWorlds.set(normalized.id, normalized);
  _loadedLevelsCache.set(normalized.id, normalized);
}

/**
 * Desregistra un mundo o zona personalizada liberando sus referencias.
 * @param {string} worldId
 */
export function unregisterCustomWorld(worldId) {
  if (!worldId) return;
  _customWorlds.delete(worldId);
  _loadedLevelsCache.delete(worldId);
}

/**
 * Obtiene la definición de un mundo o zona personalizada si existe.
 * @param {string} worldId
 * @returns {Object|null}
 */
export function getCustomWorld(worldId) {
  return _customWorlds.get(worldId) || null;
}

/**
 * Retorna todas las zonas/mundos personalizados registrados actualmente en memoria.
 * @returns {Object[]}
 */
export function getAllCustomWorlds() {
  return Array.from(_customWorlds.values());
}

/**
 * Retorna todas las zonas registradas pertenecientes a un mismo `worldId`, ordenadas por `zoneOrder`.
 * @param {string} worldId - Identificador del Mundo padre
 * @returns {Object[]}
 */
export function getZonesByWorld(worldId) {
  if (!worldId) return [];
  return Array.from(_customWorlds.values())
    .filter(z => z.worldId === worldId && z.id !== '__editor_playtest__')
    .sort((a, b) => (a.zoneOrder || 1) - (b.zoneOrder || 1));
}

/**
 * Carga bajo demanda el JSON de un escenario específico sin incluirlo en el bloque inicial.
 * Soporta tanto mundos oficiales (import dinámico) como mundos creados en el editor (registro en memoria).
 * @param {string} worldKey
 * @param {boolean} [evictOthers=true] - Si true, libera referencias de otros escenarios para comprimir RAM
 * @returns {Promise<Object|null>}
 */
export async function loadWorldData(worldKey, evictOthers = true) {
  if (!worldKey) return null;

  if (_customWorlds.has(worldKey)) {
    const data = _customWorlds.get(worldKey);
    if (evictOthers) {
      _loadedLevelsCache.clear();
      _loadedLevelsCache.set(worldKey, data);
    }
    return data;
  }

  if (!LEVEL_IMPORTERS[worldKey]) return null;
  if (_loadedLevelsCache.has(worldKey)) {
    return _loadedLevelsCache.get(worldKey);
  }
  const mod = await LEVEL_IMPORTERS[worldKey]();
  const data = (mod && mod.default) ? mod.default : mod;
  if (evictOthers) {
    _loadedLevelsCache.clear();
  }
  _loadedLevelsCache.set(worldKey, data);
  return data;
}

/**
 * Libera explícitamente la referencia cacheada de un escenario.
 * @param {string} [worldKey]
 */
export function releaseWorldData(worldKey) {
  if (worldKey) {
    _loadedLevelsCache.delete(worldKey);
  } else {
    _loadedLevelsCache.clear();
  }
}

/**
 * Metadatos ligeros de los 4 mundos explorables (sin incrustar matrices JSON).
 * @constant {Record<string, Object>}
 */
export const WORLDS_CATALOG = {
  cave_exit_intro: {
    id: 'cave_exit_intro',
    index: 1,
    coreElement: 'Fuego',
    name: 'Claro de las Reliquias',
    subtitle: 'Mundo 1 · Valle del Despertar',
    biome: 'cave_exit_intro',
    weather: 'pollen',
    accentColor: '#4ade80',
    description: 'Praderas musgosas y la Cueva Hendida donde Santi empuña la Espada del Alba y despierta el Núcleo de Fuego.'
  },
  marsh_of_spores: {
    id: 'marsh_of_spores',
    index: 2,
    coreElement: 'Raíces',
    name: 'Pantano de Esporas',
    subtitle: 'Mundo 2 · Marismas Bioluminiscentes',
    biome: 'marsh_of_spores',
    weather: 'spores',
    accentColor: '#2dd4bf',
    description: 'Islas cenagosas con charcos tóxicos, tótems druídicos y el Núcleo de Raíces custodiado por la Matriarca.'
  },
  ash_caldera: {
    id: 'ash_caldera',
    index: 3,
    coreElement: 'Embestida',
    name: 'Caldera de Ceniza',
    subtitle: 'Mundo 3 · Forja Volcánica',
    biome: 'ash_caldera',
    weather: 'embers',
    accentColor: '#fb923c',
    description: 'Ríos de magma, géiseres ardientes, colosos acorazados y el Yunque del Núcleo Cinético.'
  },
  astral_citadel: {
    id: 'astral_citadel',
    index: 4,
    coreElement: 'Éter',
    name: 'Ciudadela Astral',
    subtitle: 'Mundo 4 · Santuario del Cenit',
    biome: 'astral_citadel',
    weather: 'stardust',
    accentColor: '#c084fc',
    description: 'Terrazas suspendidas sobre el vacío estelar donde aguarda el Éter Magnético y el Heraldo de Obsidiana.'
  }
};

/** Lista ordenada de los mundos para itinerarios del Atlas */
export const WORLDS_LIST = [
  WORLDS_CATALOG.cave_exit_intro,
  WORLDS_CATALOG.marsh_of_spores,
  WORLDS_CATALOG.ash_caldera,
  WORLDS_CATALOG.astral_citadel
];

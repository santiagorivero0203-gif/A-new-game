/**
 * @module LevelRepository
 * @description Repositorio de persistencia para Zonas personalizadas ("Forja de Mundos").
 * Abstrae el almacenamiento (`localStorage` con compresión RLE hoy, extensible a Capacitor
 * Filesystem/Preferences mañana), captura `QuotaExceededError` y mantiene sincronizado
 * el registro en memoria de `worlds.js` para permitir transiciones por portales entre zonas.
 * @author Be a Legend Team
 * @version 1.0.0
 */

import { normalizeLevel } from '../data/LevelSchema.js';
import { registerCustomWorld, unregisterCustomWorld } from '../data/worlds.js';
import { STORAGE_KEY, encodeTerrainGrid, decodeTerrainGrid } from './LevelSerializer.js';

/**
 * Repositorio unificado para guardar, listar, agrupar por mundo y sincronizar zonas.
 */
class LevelRepository {
  /**
   * @param {string} [storageKey=STORAGE_KEY]
   */
  constructor(storageKey = STORAGE_KEY) {
    this.storageKey = storageKey;
  }

  /**
   * Lista todas las zonas guardadas en almacenamiento local, decodificadas y normalizadas.
   * @returns {Object[]}
   */
  list() {
    try {
      if (typeof localStorage === 'undefined') return [];
      const raw = localStorage.getItem(this.storageKey);
      if (!raw) return [];
      const list = JSON.parse(raw);
      if (!Array.isArray(list)) return [];

      return list.map(item => {
        const cols = item.cols || (item.map && item.map.cols) || 52;
        const rows = item.rows || (item.map && item.map.rows) || 36;
        const expanded = { ...item };
        if (expanded.terrainGridRLE) {
          expanded.terrainGrid = decodeTerrainGrid(expanded.terrainGridRLE, cols, rows);
          delete expanded.terrainGridRLE;
        }
        const normalized = normalizeLevel(expanded);
        normalized.updatedAt = item.updatedAt || 0;
        return normalized;
      });
    } catch (err) {
      console.error('[LevelRepository] Error cargando zonas de localStorage:', err);
      return [];
    }
  }

  /**
   * Lista todas las zonas guardadas pertenecientes a un mismo `worldId`, ordenadas por `zoneOrder`.
   * @param {string} worldId
   * @returns {Object[]}
   */
  listByWorld(worldId) {
    if (!worldId) return [];
    return this.list()
      .filter(zone => zone.worldId === worldId)
      .sort((a, b) => (a.zoneOrder || 1) - (b.zoneOrder || 1));
  }

  /**
   * Obtiene una zona guardada por su `id`.
   * @param {string} id
   * @returns {Object|null}
   */
  get(id) {
    if (!id) return null;
    return this.list().find(item => item.id === id) || null;
  }

  /**
   * Guarda o actualiza una zona en almacenamiento local con compresión RLE
   * y la registra inmediatamente en `worlds.js` para habilitar viajes desde portales.
   * @param {Object} draft
   * @returns {{ ok: boolean, level?: Object, error?: string }}
   */
  save(draft) {
    if (!draft || !draft.id) {
      return { ok: false, error: 'La zona no tiene un identificador válido.' };
    }

    try {
      const normalized = normalizeLevel(draft);
      const list = this.list();

      const compressedList = list.map(existing => this._compressEntry(existing));
      const newEntry = this._compressEntry(normalized);

      const existingIdx = compressedList.findIndex(item => item.id === normalized.id);
      if (existingIdx >= 0) {
        compressedList[existingIdx] = newEntry;
      } else {
        compressedList.push(newEntry);
      }

      localStorage.setItem(this.storageKey, JSON.stringify(compressedList));

      // Sincronizar en memoria con el motor para transiciones por portales en vivo
      registerCustomWorld(normalized);

      return { ok: true, level: normalized };
    } catch (err) {
      const isQuota = err && (err.name === 'QuotaExceededError' || err.code === 22 || err.code === 1014);
      console.error('[LevelRepository] Error guardando zona:', err);
      return {
        ok: false,
        error: isQuota
          ? 'Espacio de almacenamiento local lleno. Exporta o elimina zonas antiguas.'
          : 'No se pudo guardar la zona en el almacenamiento local.'
      };
    }
  }

  /**
   * Elimina una zona del almacenamiento local y la desregistra del motor.
   * @param {string} id
   * @returns {boolean}
   */
  remove(id) {
    if (!id) return false;
    try {
      const list = this.list().filter(item => item.id !== id);
      const compressedList = list.map(item => this._compressEntry(item));
      localStorage.setItem(this.storageKey, JSON.stringify(compressedList));
      unregisterCustomWorld(id);
      return true;
    } catch (err) {
      console.error('[LevelRepository] Error eliminando zona:', err);
      return false;
    }
  }

  /**
   * Registra en `worlds.js` todas las zonas guardadas en `localStorage` para que puedan
   * cargarse directamente mediante `loadWorld()` o desde un `world_portal`.
   * @returns {number} Cantidad de zonas sincronizadas
   */
  syncAllToEngine() {
    const levels = this.list();
    for (const lvl of levels) {
      registerCustomWorld(lvl);
    }
    return levels.length;
  }

  /**
   * Comprime `terrainGrid` con RLE antes de persistir en `localStorage`.
   * @param {Object} normalized
   * @returns {Object}
   * @private
   */
  _compressEntry(normalized) {
    const compressed = {
      ...normalized,
      terrainGridRLE: encodeTerrainGrid(normalized.terrainGrid),
      updatedAt: Date.now()
    };
    delete compressed.terrainGrid;
    return compressed;
  }
}

/** Instancia única del repositorio de zonas personalizadas */
export const levelRepository = new LevelRepository();


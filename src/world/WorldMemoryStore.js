/**
 * @module WorldMemoryStore
 * @description Almacén ligero desacoplado de memoria persistente entre escenarios/biomas.
 * Conserva únicamente los registros compactos de entidades mutadas (`[uid, state]`)
 * por cada `worldId` para que al viajar entre mundos y regresar se recuerde todo lo ocurrido
 * sin mantener objetos vivos ni chunks del escenario previo en RAM.
 * Cero dependencias con otras clases del motor.
 * @author Be a Legend Team
 * @version 1.0.0
 */
export class WorldMemoryStore {
  constructor() {
    /** @type {Map<string, Array<[string, Object]>>} */
    this._worlds = new Map();
    /** @type {Map<string, Uint32Array>} */
    this._minimapMasks = new Map();
  }

  /**
   * Guarda una copia compacta de estados mutados para un escenario concreto.
   * @param {string} worldId
   * @param {Array<[string, Object]>} entries
   */
  save(worldId, entries) {
    if (!worldId || !Array.isArray(entries)) return;
    this._worlds.set(worldId, entries);
  }

  /**
   * Recupera los estados recordados de un escenario si ya fue visitado antes.
   * @param {string} worldId
   * @returns {Array<[string, Object]>|null}
   */
  restore(worldId) {
    return this._worlds.get(worldId) || null;
  }

  /**
   * Guarda la máscara binaria de chunks explorados del minimapa (~64 bytes).
   * @param {string} worldId
   * @param {Uint32Array|null} mask
   */
  saveMinimapMask(worldId, mask) {
    if (!worldId || !mask) return;
    this._minimapMasks.set(worldId, mask);
  }

  /**
   * Recupera la máscara de exploración de Niebla de Guerra del minimapa para `worldId`.
   * @param {string} worldId
   * @returns {Uint32Array|null}
   */
  restoreMinimapMask(worldId) {
    return this._minimapMasks.get(worldId) || null;
  }

  /**
   * Limpia toda la memoria entre mundos (ej. nueva partida).
   */
  clear() {
    this._worlds.clear();
    this._minimapMasks.clear();
  }
}

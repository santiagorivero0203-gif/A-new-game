/**
 * @module ObjectPool
 * @description Gestor de reutilización de objetos para minimizar la presión sobre el Garbage Collector.
 * Esencial para entidades de ciclo de vida corto como proyectiles, partículas y efectos visuales.
 * Utiliza un Set para el tracking de objetos activos logrando liberaciones en O(1).
 * @author Be a Legend Team
 * @version 1.1.0
 */
export class ObjectPool {
  /**
   * @param {Function} factory - Función factoría que retorna una nueva instancia del objeto.
   * @param {number} [initialSize=10] - Tamaño inicial de reserva del pool.
   */
  constructor(factory, initialSize = 10) {
    /** @type {Function} */
    this.factory = factory;

    /** @type {Array<Object>} Reserva de objetos inactivos listos para reutilizar */
    this.pool = [];

    /** @type {Set<Object>} ARCH-05 FIX: Set para seguimiento activo en O(1) */
    this.active = new Set();

    // Pre-alojar los objetos iniciales en memoria
    for (let i = 0; i < initialSize; i++) {
      this.pool.push(this.factory());
    }
  }

  /**
   * Obtiene un objeto libre del pool.
   * Si el pool está agotado, instancia uno nuevo y emite una advertencia de dimensionamiento.
   * Invoca el método `init()` del objeto si está disponible.
   * @param {...*} args - Argumentos opcionales para pasar al método init()
   * @returns {Object} Instancia lista para usar
   */
  get(...args) {
    let obj;
    if (this.pool.length > 0) {
      obj = this.pool.pop();
    } else {
      console.warn('[ObjectPool] Expansión dinámica del pool más allá del tamaño inicial reservado.');
      obj = this.factory();
    }

    // Reinicializar el objeto si implementa la interfaz
    if (typeof obj.init === 'function') {
      obj.init(...args);
    }

    this.active.add(obj);
    return obj;
  }

  /**
   * ARCH-05 FIX: Retorna el objeto al pool en O(1).
   * Invoca el método `reset()` del objeto si está implementado.
   * @param {Object} obj - Objeto a devolver a la reserva
   */
  release(obj) {
    if (this.active.has(obj)) {
      this.active.delete(obj);

      // Limpiar referencias o estado del objeto
      if (typeof obj.reset === 'function') {
        obj.reset();
      }

      this.pool.push(obj);
    }
  }

  /**
   * Libera todos los objetos activos actualmente.
   * Útil para transiciones entre salas, niveles o reinicios de estado.
   */
  releaseAll() {
    for (const obj of this.active) {
      if (typeof obj.reset === 'function') {
        obj.reset();
      }
      this.pool.push(obj);
    }
    this.active.clear();
  }

  /**
   * Cantidad de objetos activos actualmente en uso.
   * @returns {number}
   */
  get activeCount() {
    return this.active.size;
  }

  /**
   * Cantidad de objetos en reserva disponibles.
   * @returns {number}
   */
  get availableCount() {
    return this.pool.length;
  }
}

export class ObjectPool {
  /**
   * @param {Function} factory - Función que retorna una nueva instancia del objeto.
   * @param {number} initialSize - Tamaño inicial del pool.
   */
  constructor(factory, initialSize = 10) {
    this.factory = factory;
    this.pool = [];
    this.active = [];

    for (let i = 0; i < initialSize; i++) {
      this.pool.push(this.factory());
    }
  }

  /**
   * Obtiene un objeto libre del pool.
   * Si no hay, instancia uno nuevo, evitando bloquearse, pero idealmente
   * el initialSize debería ser suficientemente grande.
   */
  get() {
    let obj;
    if (this.pool.length > 0) {
      obj = this.pool.pop();
    } else {
      console.warn('ObjectPool: Expanding beyond initial size.');
      obj = this.factory();
    }
    
    // Suponemos que el objeto tiene un método init() para reiniciar su estado
    if (typeof obj.init === 'function') {
      obj.init();
    }
    
    this.active.push(obj);
    return obj;
  }

  /**
   * Retorna el objeto al pool.
   * @param {Object} obj 
   */
  release(obj) {
    const index = this.active.indexOf(obj);
    if (index > -1) {
      this.active.splice(index, 1);
      
      // Limpiamos referencias internas si el objeto tiene método reset()
      if (typeof obj.reset === 'function') {
        obj.reset();
      }
      
      this.pool.push(obj);
    }
  }

  /**
   * Libera todos los objetos activos (útil al cambiar de nivel)
   */
  releaseAll() {
    while (this.active.length > 0) {
      this.release(this.active[0]);
    }
  }
}

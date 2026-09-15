/**
 * @module StateManager
 * @description Gestor de estado global del juego.
 * Almacena datos persistentes (karma, poderes desbloqueados) y actúa como
 * un bus de eventos reactivo para comunicación desacoplada entre sistemas.
 * @author Be a Legend Team
 * @version 1.1.0
 */
export class StateManager {
  constructor() {
    /** @type {Object} Estado global del juego */
    this.state = {
      karma_level: 0,
      unlocked_powers: []
    };

    /** @type {Object.<string, Function[]>} Mapa de listeners por evento */
    this.listeners = {};
  }

  /**
   * Suscribe un callback a un evento.
   * @param {string} event - Nombre del evento
   * @param {Function} callback - Función a ejecutar
   */
  on(event, callback) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);
  }

  /**
   * ARCH-03 FIX: Desuscribe un callback de un evento.
   * Previene memory leaks cuando entidades se destruyen o cambia el nivel.
   * @param {string} event - Nombre del evento
   * @param {Function} callback - Referencia exacta al callback registrado
   */
  off(event, callback) {
    if (this.listeners[event]) {
      this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
    }
  }

  /**
   * Emite un evento, ejecutando todos los callbacks suscritos.
   * @param {string} event - Nombre del evento
   * @param {*} data - Datos a pasar a los callbacks
   */
  emit(event, data) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(cb => cb(data));
    }
  }

  /**
   * Obtiene un valor del estado global.
   * @param {string} key
   * @returns {*}
   */
  get(key) {
    return this.state[key];
  }

  /**
   * Establece un valor del estado global y emite un evento de cambio.
   * El evento emitido sigue el patrón: `${key}_changed`
   * @param {string} key
   * @param {*} value
   */
  set(key, value) {
    this.state[key] = value;
    this.emit(`${key}_changed`, value);
  }

  /**
   * Elimina todos los listeners (útil al cambiar de escena/nivel).
   */
  clearAllListeners() {
    this.listeners = {};
  }
}

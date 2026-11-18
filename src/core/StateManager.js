/**
 * @module StateManager
 * @description Gestor de estado global del juego.
 * Almacena datos persistentes (karma, poderes desbloqueados, estado del juego)
 * y actúa como un bus de eventos reactivo para comunicación desacoplada entre sistemas.
 * @author Be a Legend Team
 * @version 1.2.0
 */
export class StateManager {
  constructor() {
    /** @type {Object} Estado global centralizado del juego */
    this.state = {
      game_state: 'STATE_MENU', // 'STATE_MENU' | 'STATE_PLAYING' | 'STATE_PAUSED'
      karma_level: 0,
      equipped_power: 'Fuego',
      unlocked_powers: ['Fuego', 'Embestida', 'Raíces'],
      player_energy: 100,
      player_health: 3,
      health_critical: false
    };

    /** @type {Object.<string, Function[]>} Mapa de listeners por evento */
    this.listeners = {};

    /** @type {Map<string, string>} Caché de nombres de evento `${key}_changed` para evitar concatenaciones por frame */
    this._changedEventKeys = new Map();
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
   * Desuscribe un callback de un evento.
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
   * Establece un valor del estado global y emite un evento de cambio solo si cambió
   * y existen suscriptores registrados (Zero-GC en llamadas repetidas por frame).
   * @param {string} key
   * @param {*} value
   */
  set(key, value) {
    if (this.state[key] === value) return;
    this.state[key] = value;

    let evtKey = this._changedEventKeys.get(key);
    if (!evtKey) {
      evtKey = `${key}_changed`;
      this._changedEventKeys.set(key, evtKey);
    }
    const subs = this.listeners[evtKey];
    if (subs && subs.length > 0) {
      for (let i = 0; i < subs.length; i++) {
        subs[i](value);
      }
    }
  }

  /**
   * Elimina todos los listeners (útil al cambiar de escena/nivel).
   */
  clearAllListeners() {
    this.listeners = {};
  }
}

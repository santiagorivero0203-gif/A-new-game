export class StateManager {
  constructor() {
    this.state = {
      karma_level: 0,
      unlocked_powers: []
    };
    
    // Simple event bus
    this.listeners = {};
  }

  on(event, callback) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);
  }

  emit(event, data) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(cb => cb(data));
    }
  }

  get(key) {
    return this.state[key];
  }

  set(key, value) {
    this.state[key] = value;
    this.emit(`${key}_changed`, value);
  }
}

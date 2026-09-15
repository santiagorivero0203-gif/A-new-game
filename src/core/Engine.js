/**
 * @module Engine
 * @description Bucle principal del juego (Game Loop).
 * Usa requestAnimationFrame con deltaTime acotado para evitar espirales de tiempo.
 * Orquesta la separación estricta entre update (lógica) y render (dibujo).
 * Incluye soporte para pausar el tiempo lógico sin detener el bucle de dibujado.
 * @author Be a Legend Team
 * @version 1.2.0
 */
export class Engine {
  /**
   * @param {Function} updateFn - Callback de actualización de lógica. Recibe (deltaTime).
   * @param {Function} renderFn - Callback de renderizado. Recibe (deltaTime).
   */
  constructor(updateFn, renderFn) {
    this.updateFn = updateFn;
    this.renderFn = renderFn;

    this.lastTime = 0;
    this.deltaTime = 0;
    this.isRunning = false;

    /** @type {boolean} Estado de pausa del ciclo de físicas y lógica */
    this.isPaused = false;

    /** Límite máximo de deltaTime para evitar espirales (ej. pestaña inactiva) */
    this.maxDelta = 0.1;

    // BUG-02 FIX: Pre-cachear el bind para no crear un closure nuevo cada frame
    this._boundLoop = this.loop.bind(this);
  }

  /** Inicia el bucle de juego */
  start() {
    this.isRunning = true;
    this.lastTime = performance.now();
    requestAnimationFrame(this._boundLoop);
  }

  /** Detiene por completo el bucle de juego */
  stop() {
    this.isRunning = false;
  }

  /**
   * Pausa la actualización lógica del juego.
   * El renderizado continúa para permitir efectos visuales en menús o pausas.
   */
  pause() {
    this.isPaused = true;
    this.deltaTime = 0;
  }

  /**
   * Reanuda la lógica del juego.
   * Reinicia lastTime para evitar picos abruptos de deltaTime tras la pausa.
   */
  resume() {
    this.isPaused = false;
    this.lastTime = performance.now();
  }

  /**
   * Alterna entre pausa y reanudación.
   * @returns {boolean} Nuevo estado isPaused
   */
  togglePause() {
    if (this.isPaused) {
      this.resume();
    } else {
      this.pause();
    }
    return this.isPaused;
  }

  /**
   * Ciclo principal. Se ejecuta una vez por frame.
   * @param {DOMHighResTimeStamp} currentTime - Timestamp del frame actual
   */
  loop(currentTime) {
    if (!this.isRunning) return;

    let dt = (currentTime - this.lastTime) / 1000;
    if (dt > this.maxDelta) {
      dt = this.maxDelta;
    }
    this.deltaTime = dt;
    this.lastTime = currentTime;

    if (this.isPaused) {
      // En pausa no se actualiza la física ni el estado de las entidades,
      // pero se renderiza el último fotograma con dt = 0.
      this.renderFn(0);
    } else {
      // Orquestar: lógica primero, luego renderizado
      this.updateFn(this.deltaTime);
      this.renderFn(this.deltaTime);
    }

    requestAnimationFrame(this._boundLoop);
  }
}

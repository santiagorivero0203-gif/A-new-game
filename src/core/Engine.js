/**
 * @module Engine
 * @description Bucle principal del juego (Game Loop).
 * Usa requestAnimationFrame con deltaTime acotado para evitar espirales de tiempo.
 * Orquesta la separación estricta entre update (lógica) y render (dibujo).
 * @author Be a Legend Team
 * @version 1.1.0
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

  /** Detiene el bucle de juego */
  stop() {
    this.isRunning = false;
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

    // Orquestar: lógica primero, luego renderizado
    // BUG-01 FIX: Pasar deltaTime a AMBAS funciones
    this.updateFn(this.deltaTime);
    this.renderFn(this.deltaTime);

    requestAnimationFrame(this._boundLoop);
  }
}

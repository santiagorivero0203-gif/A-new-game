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

    /** @type {number} Límite máximo de deltaTime para evitar saltos locos al cambiar de pestaña */
    this.maxDelta = 0.1;

    /** @type {number} Temporizador interno para pausar la lógica durante impactos críticos (Game Feel) */
    this.hitStopTimer = 0;

    /** @type {number} Cooldown mínimo entre HitStops para impedir tirones encadenados al golpear grupos */
    this.hitStopCooldown = 0;

    /** @type {number|null} Identificador del rAF programado para evitar bucles duplicados o en reposo */
    this._rafId = null;

    /** @type {number} Escala temporal dinámica para cámara lenta dramática y KO estilo Smash Bros */
    this.timeScale = 1.0;

    // BUG-02 FIX: Pre-cachear el bind para no crear un closure nuevo cada frame
    this._boundLoop = this.loop.bind(this);
  }

  /**
   * Ajusta la escala temporal de simulación lógica conservando dt positivo.
   * @param {number} [scale=1.0]
   */
  setTimeScale(scale = 1.0) {
    const num = Number(scale);
    this.timeScale = Number.isFinite(num) ? Math.max(0.02, Math.min(2.0, num)) : 1.0;
  }

  /** Inicia el bucle de juego si no estaba ya activo */
  start() {
    this.isRunning = true;
    this.lastTime = performance.now();
    if (!this.isPaused && this._rafId === null) {
      this._rafId = requestAnimationFrame(this._boundLoop);
    }
  }

  /** Detiene por completo el bucle de juego y cancela cualquier refresco pendiente */
  stop() {
    this.isRunning = false;
    if (this._rafId !== null && typeof cancelAnimationFrame === 'function') {
      cancelAnimationFrame(this._rafId);
    }
    this._rafId = null;
  }

  /**
   * Pausa el bucle lógico y detiene el refresco continuo de `requestAnimationFrame`
   * para ahorrar 100% de CPU/GPU en menús y pausas.
   * @param {boolean} [drawFinalFrame=false] - Si true, dibuja un último frame estático al pausar
   */
  pause(drawFinalFrame = false) {
    this.isPaused = true;
    this.deltaTime = 0;
    if (this._rafId !== null && typeof cancelAnimationFrame === 'function') {
      cancelAnimationFrame(this._rafId);
    }
    this._rafId = null;
    if (drawFinalFrame && this.renderFn) {
      this.renderFn(0);
    }
  }

  /**
   * Dibuja un único fotograma estático bajo demanda mientras el motor está en pausa (ej. al redimensionar).
   */
  renderOnce() {
    if (this.isPaused && this.renderFn) {
      this.renderFn(0);
    }
  }

  /**
   * Reanuda la lógica y reactiva el bucle `requestAnimationFrame`.
   * Reinicia lastTime para evitar picos abruptos de deltaTime tras la pausa.
   */
  resume() {
    this.isPaused = false;
    this.lastTime = performance.now();
    if (this.isRunning && this._rafId === null) {
      this._rafId = requestAnimationFrame(this._boundLoop);
    }
  }

  /**
   * Alterna entre pausa y reanudación.
   * @returns {boolean} Nuevo estado isPaused
   */
  togglePause() {
    if (this.isPaused) {
      this.resume();
    } else {
      this.pause(true);
    }
    return this.isPaused;
  }

  /**
   * Congela el tiempo lógico brevemente para dar peso únicamente a impactos de alto valor
   * (Parry Perfecto, Finisher, Riposte Crítico, Explosión de Sinergia o Daño recibido).
   * Aplica un cooldown anti-ráfaga para que golpear hordas nunca produzca tirones de frames.
   * @param {number} duration - Segundos de pausa lógica
   */
  hitStop(duration) {
    if (this.hitStopCooldown > 0 && duration <= this.hitStopTimer + 0.02) {
      return;
    }
    this.hitStopTimer = Math.max(this.hitStopTimer, Math.min(0.075, duration));
    this.hitStopCooldown = 0.22;
  }

  /**
   * Ciclo principal. Se ejecuta una vez por frame únicamente mientras el motor está activo y sin pausa.
   * @param {DOMHighResTimeStamp} currentTime - Timestamp del frame actual
   */
  loop(currentTime) {
    this._rafId = null;
    if (!this.isRunning || this.isPaused) return;

    let dt = (currentTime - this.lastTime) / 1000;
    if (dt < 0) dt = 0;
    if (dt > this.maxDelta) {
      dt = this.maxDelta;
    }
    this.deltaTime = dt;
    this.lastTime = currentTime;

    if (this.hitStopCooldown > 0) {
      this.hitStopCooldown = Math.max(0, this.hitStopCooldown - dt);
    }

    if (this.hitStopTimer > 0) {
      // HitStop activo: resta tiempo usando el reloj monotónico de rAF sin desincronizar lastTime
      this.hitStopTimer -= dt;
      if (this.hitStopTimer <= 0) {
        this.hitStopTimer = 0;
      }
      this.renderFn(0);
    } else {
      // Orquestar: lógica escalada por timeScale + dt real como 2do argumento para directores cinemáticos
      const scaledDt = this.deltaTime * Math.max(0.02, this.timeScale || 1.0);
      this.updateFn(scaledDt, this.deltaTime);
      this.renderFn(this.deltaTime);
    }

    if (this.isRunning && !this.isPaused && this._rafId === null) {
      this._rafId = requestAnimationFrame(this._boundLoop);
    }
  }
}

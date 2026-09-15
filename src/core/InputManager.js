/**
 * @module InputManager
 * @description Gestiona inputs híbridos: teclado (WASD), ratón, táctil y gamepad.
 * Incluye lógica trigonométrica para la rueda de selección radial de poderes
 * y base para controles virtuales móviles.
 * @author Be a Legend Team
 * @version 1.1.0
 */
import { Vector2 } from '../utils/Vector2.js';

export class InputManager {
  constructor() {
    /** @type {Object.<string, boolean>} Estado de teclas presionadas */
    this.keys = {};

    /** @type {Vector2} Posición actual del ratón en coordenadas de pantalla */
    this.mouse = new Vector2(0, 0);

    /** @type {boolean} Indica si la rueda radial está visible */
    this.isRadialMenuOpen = false;

    /** @type {number} Índice del slot seleccionado (-1 = ninguno) */
    this.radialSelectionIndex = -1;

    /** @type {number} Total de slots en la rueda (Fuego, Embestida, Raíces, Curación) */
    this.totalRadialSlots = 4;

    // --- Touch Support ---
    /** @type {Touch[]} Toques activos actuales */
    this.touches = [];

    /** @type {Vector2} Vector de arrastre para detección de swipe en móvil */
    this.swipeVector = new Vector2(0, 0);

    /** @private Coordenadas de inicio del toque para cálculo de swipe */
    this._touchStartX = 0;
    this._touchStartY = 0;

    this._bindEvents();
  }

  /** @private Registra todos los event listeners del DOM */
  _bindEvents() {
    // --- Teclado ---
    window.addEventListener('keydown', (e) => {
      this.keys[e.code] = true;
      if (e.code === 'Tab') {
        e.preventDefault();
        this.isRadialMenuOpen = true;
      }
    });

    window.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
      if (e.code === 'Tab') {
        this.isRadialMenuOpen = false;
      }
    });

    // --- Ratón ---
    window.addEventListener('mousemove', (e) => {
      this.mouse.set(e.clientX, e.clientY);
      if (this.isRadialMenuOpen) {
        this._calculateRadialSelection();
      }
    });

    // --- Táctil ---
    window.addEventListener('touchstart', (e) => {
      this.touches = Array.from(e.touches);
      if (e.touches.length > 0) {
        this._touchStartX = e.touches[0].clientX;
        this._touchStartY = e.touches[0].clientY;
      }
    });

    window.addEventListener('touchmove', (e) => {
      this.touches = Array.from(e.touches);
      // STD-06 FIX: Verificar que haya toques antes de acceder al índice 0
      if (e.touches.length > 0) {
        this.swipeVector.set(
          e.touches[0].clientX - this._touchStartX,
          e.touches[0].clientY - this._touchStartY
        );
      }
    });

    window.addEventListener('touchend', (e) => {
      // STD-06 FIX: En touchend, e.touches contiene los toques RESTANTES.
      // Si se soltaron todos los dedos, el array está vacío — no acceder a [0].
      this.touches = Array.from(e.touches);
      this.swipeVector.set(0, 0);
    });
  }

  /**
   * Calcula el ángulo del ratón respecto al centro de la pantalla
   * y determina qué slot radial está seleccionado usando trigonometría.
   *
   * Algoritmo:
   * 1. Calcular vector dirección desde centro de pantalla al ratón
   * 2. Aplicar zona muerta (deadzone) para evitar selección accidental
   * 3. Usar atan2 para obtener ángulo, rotar -90° para que slot 0 = arriba
   * 4. Dividir el círculo completo en N slices y mapear al índice
   *
   * @private
   */
  _calculateRadialSelection() {
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;

    const dx = this.mouse.x - centerX;
    const dy = this.mouse.y - centerY;

    // Zona muerta: evitar selección cuando el cursor está demasiado cerca del centro
    const deadZone = 50;
    if (Math.hypot(dx, dy) < deadZone) {
      this.radialSelectionIndex = -1;
      return;
    }

    // Ángulo en radianes (-PI a PI), rotado para que 0 = arriba
    let angle = Math.atan2(dy, dx) + Math.PI / 2;
    if (angle < 0) {
      angle += 2 * Math.PI;
    }

    // Dividir el círculo en N ranuras iguales
    const sliceSize = (2 * Math.PI) / this.totalRadialSlots;

    // Desplazar medio slice para centrar cada ranura sobre su eje
    const offsetAngle = (angle + sliceSize / 2) % (2 * Math.PI);

    this.radialSelectionIndex = Math.floor(offsetAngle / sliceSize);
  }

  /**
   * Verifica si una tecla está presionada.
   * @param {string} code - KeyboardEvent.code (ej: 'KeyW', 'Space')
   * @returns {boolean}
   */
  isKeyPressed(code) {
    return !!this.keys[code];
  }

  /**
   * Se ejecuta cada frame. Preparado para polling de Gamepad API.
   */
  update() {
    // Futuro: navigator.getGamepads() polling aquí
  }
}

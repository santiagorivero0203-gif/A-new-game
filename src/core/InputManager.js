import { Vector2 } from '../utils/Vector2.js';

/**
 * @module InputManager
 * @description Gestor integral y unificado de entradas híbridas para 'Be a Legend'.
 * - PC: Teclado físico (WASD, flechas, Tab, Escape, Espacio) y ratón para selección radial.
 * - Móvil: Gamepad virtual táctil moderno (DOM Overlay) con Joystick analógico,
 *   botón de ataque con espada y botón dinámico de Reliquia con swipe direccional.
 * - Arquitectura 100% libre de código muerto de canvas y optimizada para 60 FPS sin asignaciones de memoria.
 * @author Be a Legend Team
 * @version 2.1.0
 */
export class InputManager {
  constructor() {
    /** @type {Object.<string, boolean>} Estado de teclas físicas presionadas */
    this.keys = {};

    /** @type {Vector2} Posición actual del ratón en coordenadas de pantalla */
    this.mouse = new Vector2(0, 0);

    /** @type {boolean} Indica si la rueda radial está visible en PC */
    this.isRadialMenuOpen = false;

    /** @type {number} Índice del slot seleccionado (-1 = ninguno) */
    this.radialSelectionIndex = -1;

    /** @type {number} Total de slots en la rueda */
    this.totalRadialSlots = 4;

    // --- Detección Estricta de Dispositivo Móvil / Táctil ---
    /**
     * Detección de dispositivo móvil real mediante User Agent.
     * En PC de escritorio permanece false para mantener la vista cinematográfica limpia,
     * y se activa dinámicamente si se recibe un evento touchstart real.
     * @type {boolean}
     */
    const isMobileUA = (
      /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
      (navigator.userAgentData && navigator.userAgentData.mobile === true)
    );
    this.isTouchDevice = isMobileUA;

    /** @type {boolean} Forzar visualización de controles móviles para pruebas en escritorio */
    this.forceTouchControls = false;

    // --- Estado de Controles Táctiles (DOM Overlay) ---
    /** @type {Vector2} Vector de movimiento normalizado [-1..1] del joystick virtual */
    this.joystickVector = new Vector2(0, 0);

    /** @type {boolean} Si el botón de ataque está activo en este fotograma */
    this.isAttackPressed = false;

    /** @type {string|null} Poder pre-visualizado durante el swipe actual */
    this.hoveredSwipePower = null;

    // Callbacks
    this._onSkillEquippedCallback = null;
    this._onPauseCallback = null;

    this._bindEvents();

    if (typeof document !== 'undefined') {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => this._bindDOMElements());
      } else {
        this._bindDOMElements();
      }
    }
  }

  /**
   * Determina si se deben mostrar los controles táctiles en pantalla.
   * Regla de diseño: En PC permanece oculto; en móviles o al tocar la pantalla se activa.
   * @returns {boolean}
   */
  get shouldShowTouchControls() {
    return this.isTouchDevice || this.forceTouchControls;
  }

  /**
   * Alterna la visualización forzada de controles táctiles en escritorio.
   * @param {boolean} [force]
   * @returns {boolean}
   */
  toggleTouchControls(force = undefined) {
    this.forceTouchControls = (force !== undefined) ? force : !this.forceTouchControls;
    return this.forceTouchControls;
  }

  /**
   * Registra un callback a ejecutar cuando se completa un swipe sobre el botón de habilidad.
   * @param {Function} cb - Recibe el nombre del poder ('Fuego', 'Embestida', 'Raíces', 'Curación')
   */
  onSkillEquipped(cb) {
    this._onSkillEquippedCallback = cb;
  }

  /**
   * Registra un callback a ejecutar al pulsar el botón de pausa.
   * @param {Function} cb
   */
  onPause(cb) {
    this._onPauseCallback = cb;
  }

  /**
   * Enlaza los manejadores de eventos globales (Teclado físico y ratón).
   * @private
   */
  _bindEvents() {
    // --- 1. Teclado Físico ---
    window.addEventListener('keydown', (e) => {
      this.keys[e.code] = true;
      if (e.code === 'Tab') {
        e.preventDefault();
        this.isRadialMenuOpen = true;
      }
      if (e.code === 'Escape' || e.code === 'KeyP') {
        if (this._onPauseCallback) this._onPauseCallback();
      }
    });

    window.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
      if (e.code === 'Tab') {
        this.isRadialMenuOpen = false;
      }
    });

    // --- 2. Ratón para Selección Radial en PC ---
    window.addEventListener('mousemove', (e) => {
      this.mouse.set(e.clientX, e.clientY);
      if (this.isRadialMenuOpen) {
        this._calculateRadialSelection();
      }
    });

    // Activar soporte táctil si el dispositivo emite un toque real
    window.addEventListener('touchstart', () => {
      this.isTouchDevice = true;
    }, { passive: true });
  }

  /**
   * Conecta eventos interactivos de alta precisión directamente a los elementos del DOM Overlay.
   * Elimina por completo los chequeos manuales por distancia de píxeles y colisiones obsoletas.
   * @private
   */
  _bindDOMElements() {
    // 1. Botón de Pausa Flotante
    const btnQuickPause = document.getElementById('btn-quick-pause');
    if (btnQuickPause) {
      btnQuickPause.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this._onPauseCallback) this._onPauseCallback();
      });
    }

    // 2. Sectores de la Rueda Radial de Poderes en DOM
    const sectors = document.querySelectorAll('.radial-sector');
    sectors.forEach((sec) => {
      sec.addEventListener('mouseenter', () => {
        const idx = parseInt(sec.dataset.index, 10);
        if (!isNaN(idx)) this.radialSelectionIndex = idx;
      });
      sec.addEventListener('click', (e) => {
        e.stopPropagation();
        const power = sec.dataset.power;
        if (power && this._onSkillEquippedCallback) {
          this._onSkillEquippedCallback(power);
        }
        this.isRadialMenuOpen = false;
      });
    });

    // 3. Botón de Ataque Táctil en DOM
    const btnAttack = document.getElementById('touch-btn-attack');
    if (btnAttack) {
      const startAttack = (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.isAttackPressed = true;
      };
      const stopAttack = (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.isAttackPressed = false;
      };
      btnAttack.addEventListener('touchstart', startAttack, { passive: false });
      btnAttack.addEventListener('touchend', stopAttack, { passive: false });
      btnAttack.addEventListener('mousedown', startAttack);
      btnAttack.addEventListener('mouseup', stopAttack);
      btnAttack.addEventListener('mouseleave', stopAttack);
    }

    // 4. Joystick Táctil en DOM
    const joyZone = document.getElementById('touch-joystick-zone');
    const joyBase = document.getElementById('touch-joystick-base');
    if (joyZone && joyBase) {
      let activeTouchId = null;

      const handleJoy = (clientX, clientY) => {
        const rect = joyBase.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const dx = clientX - centerX;
        const dy = clientY - centerY;
        const dist = Math.hypot(dx, dy);
        const maxDist = rect.width / 2;

        if (dist === 0) {
          this.joystickVector.set(0, 0);
          return;
        }

        const clamped = Math.min(dist, maxDist);
        const normX = dx / dist;
        const normY = dy / dist;
        this.joystickVector.set(normX * (clamped / maxDist), normY * (clamped / maxDist));
      };

      const startJoy = (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.isTouchDevice = true;
        const touch = e.touches ? e.touches[0] : e;
        activeTouchId = e.touches ? touch.identifier : 'mouse';
        handleJoy(touch.clientX, touch.clientY);
      };

      const moveJoy = (e) => {
        if (activeTouchId === null) return;
        e.preventDefault();
        e.stopPropagation();
        let touch = null;
        if (e.touches) {
          for (let i = 0; i < e.touches.length; i++) {
            if (e.touches[i].identifier === activeTouchId) {
              touch = e.touches[i];
              break;
            }
          }
        } else {
          touch = e;
        }
        if (touch) handleJoy(touch.clientX, touch.clientY);
      };

      const endJoy = (e) => {
        e.preventDefault();
        e.stopPropagation();
        activeTouchId = null;
        this.joystickVector.set(0, 0);
      };

      joyZone.addEventListener('touchstart', startJoy, { passive: false });
      window.addEventListener('touchmove', moveJoy, { passive: false });
      window.addEventListener('touchend', endJoy, { passive: false });
      window.addEventListener('touchcancel', endJoy, { passive: false });

      joyZone.addEventListener('mousedown', startJoy);
      window.addEventListener('mousemove', (e) => {
        if (activeTouchId === 'mouse') moveJoy(e);
      });
      window.addEventListener('mouseup', (e) => {
        if (activeTouchId === 'mouse') endJoy(e);
      });
    }

    // 5. Botón de Habilidad Táctil en DOM (Swipe)
    const btnSkill = document.getElementById('touch-btn-skill');
    if (btnSkill) {
      let startX = 0;
      let startY = 0;
      let isSwiping = false;

      const startSkill = (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.isTouchDevice = true;
        isSwiping = true;
        const touch = e.touches ? e.touches[0] : e;
        startX = touch.clientX;
        startY = touch.clientY;
        this.hoveredSwipePower = null;
      };

      const moveSkill = (e) => {
        if (!isSwiping) return;
        e.preventDefault();
        e.stopPropagation();
        const touch = e.touches ? e.touches[0] : e;
        const dx = touch.clientX - startX;
        const dy = touch.clientY - startY;
        if (Math.hypot(dx, dy) > 15) {
          this.hoveredSwipePower = this._calculateSwipePower(dx, dy);
        } else {
          this.hoveredSwipePower = null;
        }
      };

      const endSkill = (e) => {
        if (!isSwiping) return;
        e.preventDefault();
        e.stopPropagation();
        isSwiping = false;
        if (this.hoveredSwipePower && this._onSkillEquippedCallback) {
          this._onSkillEquippedCallback(this.hoveredSwipePower);
        }
        this.hoveredSwipePower = null;
      };

      btnSkill.addEventListener('touchstart', startSkill, { passive: false });
      window.addEventListener('touchmove', moveSkill, { passive: false });
      window.addEventListener('touchend', endSkill, { passive: false });
      window.addEventListener('touchcancel', endSkill, { passive: false });

      btnSkill.addEventListener('mousedown', startSkill);
      window.addEventListener('mousemove', (e) => {
        if (isSwiping) moveSkill(e);
      });
      window.addEventListener('mouseup', (e) => {
        if (isSwiping) endSkill(e);
      });
    }
  }

  /**
   * Calcula el cuadrante de swipe para habilidades basándose en el ángulo del vector.
   * @private
   * @param {number} dx
   * @param {number} dy
   * @returns {string}
   */
  _calculateSwipePower(dx, dy) {
    const angleRad = Math.atan2(dy, dx);
    const angleDeg = (angleRad * 180) / Math.PI;

    if (angleDeg >= -135 && angleDeg < -45) return 'Fuego';
    if (angleDeg >= -45 && angleDeg < 45) return 'Embestida';
    if (angleDeg >= 45 && angleDeg < 135) return 'Raíces';
    return 'Curación';
  }

  /**
   * Calcula el slot de la rueda radial de PC según la posición del cursor respecto al centro.
   * @private
   */
  _calculateRadialSelection() {
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;

    const dx = this.mouse.x - centerX;
    const dy = this.mouse.y - centerY;

    const deadZone = 40;
    if (Math.hypot(dx, dy) < deadZone) {
      this.radialSelectionIndex = -1;
      return;
    }

    let angle = Math.atan2(dy, dx) + Math.PI / 2;
    if (angle < 0) angle += 2 * Math.PI;

    const sliceSize = (2 * Math.PI) / this.totalRadialSlots;
    const offsetAngle = (angle + sliceSize / 2) % (2 * Math.PI);
    this.radialSelectionIndex = Math.floor(offsetAngle / sliceSize);
  }

  /**
   * Consulta si una tecla física está actualmente presionada.
   * @param {string} code - Código de la tecla (ej: 'KeyW', 'Space')
   * @returns {boolean}
   */
  isKeyPressed(code) {
    return !!this.keys[code];
  }

  /**
   * Actualización por fotograma (mantenida por uniformidad de interfaz).
   */
  update() {}
}

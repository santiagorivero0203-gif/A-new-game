import { Vector2 } from '../utils/Vector2.js';

/**
 * @module InputManager
 * @description Gestor integral de entradas híbridas: teclado (WASD / flechas), ratón y
 * gamepad virtual táctil (Joystick izquierdo, botón de ataque, botón dinámico de swipe
 * para habilidades de la Reliquia y botón de pausa).
 * Optimizado para formato panorámico 16:9 (960x540) con multi-touch real y emulación con ratón.
 * @author Be a Legend Team
 * @version 1.4.0
 */
export class InputManager {
  /**
   * @param {HTMLCanvasElement} [uiCanvas] - Canvas sobre el cual se proyectan los controles
   */
  constructor(uiCanvas = null) {
    this.uiCanvas = uiCanvas;

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

    // --- Configuración Geométrica Adaptada al Formato Panorámico 16:9 (960x540) ---
    this.joystickConfig = {
      baseX: 115,
      baseY: 435,
      radius: 65,
      maxDistance: 45
    };

    this.attackButtonConfig = {
      x: 855,
      y: 445,
      radius: 40
    };

    this.skillButtonConfig = {
      x: 855,
      y: 345,
      radius: 34
    };

    this.pauseButtonConfig = {
      x: 915,
      y: 42,
      radius: 22
    };

    // --- Estado de Controles Táctiles ---
    /** @type {Vector2} Vector de movimiento normalizado [-1..1] del joystick virtual */
    this.joystickVector = new Vector2(0, 0);

    /** @type {Vector2} Posición visual del pulgar del joystick */
    this.joystickThumb = new Vector2(this.joystickConfig.baseX, this.joystickConfig.baseY);

    /** @type {boolean} Si el botón de ataque está activo en este fotograma */
    this.isAttackPressed = false;

    /** @type {boolean} Si el botón de habilidad está siendo arrastrado (swipe) */
    this.isSkillSwiping = false;

    /** @type {Vector2} Vector del arrastre de habilidad desde el centro del botón */
    this.skillSwipeVector = new Vector2(0, 0);

    /** @type {string|null} Poder pre-visualizado durante el swipe actual */
    this.hoveredSwipePower = null;

    /** @type {boolean} Si se ha accionado el botón de pausa */
    this.isPauseTriggered = false;

    // Identificadores de dedos para multi-touch
    this._joystickTouchId = null;
    this._attackTouchId = null;
    this._skillTouchId = null;

    // Callbacks
    this._onSkillEquippedCallback = null;
    this._onPauseCallback = null;

    this._bindEvents();
  }

  /**
   * Conecta el canvas de la UI para calcular con precisión las coordenadas táctiles.
   * @param {HTMLCanvasElement} canvas
   */
  setCanvas(canvas) {
    this.uiCanvas = canvas;
  }

  /**
   * Convierte coordenadas del navegador (clientX, clientY)
   * a coordenadas internas del Canvas virtual (960x540).
   * @param {number} clientX
   * @param {number} clientY
   * @returns {{x: number, y: number}}
   */
  getCanvasCoords(clientX, clientY) {
    if (!this.uiCanvas) {
      return { x: clientX, y: clientY };
    }
    const rect = this.uiCanvas.getBoundingClientRect();
    const scaleX = this.uiCanvas.width / rect.width;
    const scaleY = this.uiCanvas.height / rect.height;

    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY
    };
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

  /** @private Enlaza todos los manejadores de eventos */
  _bindEvents() {
    // --- Teclado Físico ---
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

    // --- Ratón ---
    window.addEventListener('mousemove', (e) => {
      this.mouse.set(e.clientX, e.clientY);
      if (this.isRadialMenuOpen) {
        this._calculateRadialSelection();
      }

      if (this._mouseIsDown) {
        const coords = this.getCanvasCoords(e.clientX, e.clientY);
        this._handlePointerMove(null, coords.x, coords.y);
      }
    });

    window.addEventListener('mousedown', (e) => {
      this._mouseIsDown = true;
      const coords = this.getCanvasCoords(e.clientX, e.clientY);
      this._handlePointerDown('mouse', coords.x, coords.y);
    });

    window.addEventListener('mouseup', (e) => {
      this._mouseIsDown = false;
      const coords = this.getCanvasCoords(e.clientX, e.clientY);
      this._handlePointerUp('mouse', coords.x, coords.y);
    });

    // --- Eventos Táctiles (Multi-Touch) ---
    window.addEventListener('touchstart', (e) => {
      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        const coords = this.getCanvasCoords(touch.clientX, touch.clientY);
        this._handlePointerDown(touch.identifier, coords.x, coords.y);
      }
    }, { passive: false });

    window.addEventListener('touchmove', (e) => {
      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        const coords = this.getCanvasCoords(touch.clientX, touch.clientY);
        this._handlePointerMove(touch.identifier, coords.x, coords.y);
      }
    }, { passive: false });

    window.addEventListener('touchend', (e) => {
      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        const coords = this.getCanvasCoords(touch.clientX, touch.clientY);
        this._handlePointerUp(touch.identifier, coords.x, coords.y);
      }
    }, { passive: false });

    window.addEventListener('touchcancel', (e) => {
      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        const coords = this.getCanvasCoords(touch.clientX, touch.clientY);
        this._handlePointerUp(touch.identifier, coords.x, coords.y);
      }
    }, { passive: false });
  }

  /**
   * @private
   */
  _handlePointerDown(id, x, y) {
    // 1. Botón de Pausa (Engranaje)
    const distPause = Math.hypot(x - this.pauseButtonConfig.x, y - this.pauseButtonConfig.y);
    if (distPause <= this.pauseButtonConfig.radius * 1.5) {
      if (this._onPauseCallback) this._onPauseCallback();
      return;
    }

    // 2. Joystick Izquierdo
    const distJoy = Math.hypot(x - this.joystickConfig.baseX, y - this.joystickConfig.baseY);
    if (distJoy <= this.joystickConfig.radius * 1.6 && this._joystickTouchId === null) {
      this._joystickTouchId = id;
      this._updateJoystick(x, y);
      return;
    }

    // 3. Botón de Ataque
    const distAttack = Math.hypot(x - this.attackButtonConfig.x, y - this.attackButtonConfig.y);
    if (distAttack <= this.attackButtonConfig.radius * 1.3 && this._attackTouchId === null) {
      this._attackTouchId = id;
      this.isAttackPressed = true;
      return;
    }

    // 4. Botón de Habilidad (Swipe)
    const distSkill = Math.hypot(x - this.skillButtonConfig.x, y - this.skillButtonConfig.y);
    if (distSkill <= this.skillButtonConfig.radius * 1.4 && this._skillTouchId === null) {
      this._skillTouchId = id;
      this.isSkillSwiping = true;
      this.skillSwipeVector.set(0, 0);
      this.hoveredSwipePower = null;
      return;
    }
  }

  /**
   * @private
   */
  _handlePointerMove(id, x, y) {
    if (this._joystickTouchId === id || (id === null && this._joystickTouchId === 'mouse')) {
      this._updateJoystick(x, y);
    }

    if (this._skillTouchId === id || (id === null && this._skillTouchId === 'mouse')) {
      const dx = x - this.skillButtonConfig.x;
      const dy = y - this.skillButtonConfig.y;
      this.skillSwipeVector.set(dx, dy);

      if (this.skillSwipeVector.length() > 20) {
        this.hoveredSwipePower = this._calculateSwipePower(dx, dy);
      } else {
        this.hoveredSwipePower = null;
      }
    }
  }

  /**
   * @private
   */
  _handlePointerUp(id, x, y) {
    if (this._joystickTouchId === id) {
      this._joystickTouchId = null;
      this.joystickVector.set(0, 0);
      this.joystickThumb.set(this.joystickConfig.baseX, this.joystickConfig.baseY);
    }

    if (this._attackTouchId === id) {
      this._attackTouchId = null;
      this.isAttackPressed = false;
    }

    if (this._skillTouchId === id) {
      this._skillTouchId = null;
      this.isSkillSwiping = false;

      if (this.skillSwipeVector.length() > 20) {
        const selectedPower = this._calculateSwipePower(
          this.skillSwipeVector.x,
          this.skillSwipeVector.y
        );

        if (selectedPower && this._onSkillEquippedCallback) {
          this._onSkillEquippedCallback(selectedPower);
        }
      }

      this.skillSwipeVector.set(0, 0);
      this.hoveredSwipePower = null;
    }
  }

  /**
   * @private
   */
  _updateJoystick(touchX, touchY) {
    const dx = touchX - this.joystickConfig.baseX;
    const dy = touchY - this.joystickConfig.baseY;
    const dist = Math.hypot(dx, dy);

    if (dist === 0) {
      this.joystickVector.set(0, 0);
      this.joystickThumb.set(this.joystickConfig.baseX, this.joystickConfig.baseY);
      return;
    }

    const clampedDist = Math.min(dist, this.joystickConfig.maxDistance);
    const normX = dx / dist;
    const normY = dy / dist;

    this.joystickVector.set(normX * (clampedDist / this.joystickConfig.maxDistance), normY * (clampedDist / this.joystickConfig.maxDistance));
    this.joystickThumb.set(
      this.joystickConfig.baseX + normX * clampedDist,
      this.joystickConfig.baseY + normY * clampedDist
    );
  }

  /**
   * @private
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
   * @private
   */
  _calculateRadialSelection() {
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;

    const dx = this.mouse.x - centerX;
    const dy = this.mouse.y - centerY;

    const deadZone = 50;
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
   * @param {string} code
   * @returns {boolean}
   */
  isKeyPressed(code) {
    return !!this.keys[code];
  }

  update() {}
}

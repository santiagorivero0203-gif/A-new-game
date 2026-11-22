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
export const KEYBINDINGS = {
  ATTACK: ['KeyJ', 'KeyZ'],
  ABILITY: ['KeyK', 'KeyX'],
  STRONG_ATTACK: ['KeyL'],
  HEAL: ['KeyQ', 'KeyH'],
  DASH: ['Space'],
  SPRINT: ['KeyF', 'KeyV'],
  STEALTH: ['KeyC', 'ControlLeft', 'ControlRight'],
  DEFEND: ['ShiftLeft', 'ShiftRight'],
  POWER_1: ['Digit1'],
  POWER_2: ['Digit2'],
  POWER_3: ['Digit3'],
  POWER_4: ['Digit4'],
  POWER_CYCLE: ['KeyR'],
  RADIAL_MENU: ['Tab'],
  TALENTS: ['KeyU', 'KeyB'],
  PAUSE: ['Escape', 'KeyP'],
  UP: ['KeyW', 'ArrowUp'],
  DOWN: ['KeyS', 'ArrowDown'],
  LEFT: ['KeyA', 'ArrowLeft'],
  RIGHT: ['KeyD', 'ArrowRight']
};

export class InputManager {
  /**
   * @param {HTMLCanvasElement} [canvas] - Elemento de canvas principal opcional
   */
  constructor(canvas = null) {
    /** @type {HTMLCanvasElement|null} Referencia al canvas principal para rects de precisión */
    this.canvas = canvas || (typeof document !== 'undefined' ? document.getElementById('main-canvas') : null);

    /** @type {Object.<string, boolean>} Estado de teclas físicas presionadas */
    this.keys = {};

    /** @type {Vector2} Posición actual del ratón en coordenadas relativas al canvas */
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

    /** @type {boolean} Si el botón de ataque básico (espada) está activo en este fotograma */
    this.isAttackPressed = false;

    /** @type {boolean} Si el uso de habilidad elemental equipada está activo en este fotograma */
    this.isAbilityPressed = false;

    /** @type {boolean} Si el ataque fuerte/secundario está activo en este fotograma */
    this.isStrongAttackPressed = false;

    /** @type {boolean} Si la acción de curación milenaria del guante está activa */
    this.isHealPressed = false;

    /** @type {boolean} Si el comando de dash/esquiva rápida está activo */
    this.isDashPressed = false;

    /** @type {boolean} Si la acción de sprint/correr con resistencia está activa */
    this.isSprintPressed = false;

    /** @type {boolean} Si el comando de sigilo/agacharse al suelo está activo */
    this.isStealthPressed = false;

    /** @type {boolean} Estado de sprint activado por doble toque en el botón Dash móvil */
    this.isTouchSprintActive = false;

    /** @private Marca de tiempo del último toque en el botón Dash para detectar doble toque */
    this._lastDashTapMs = -Infinity;

    /** @private Indica si el usuario mantiene pulsado físicamente el botón táctil Dash/Correr */
    this._isTouchDashHeld = false;

    /** @private Acumulador de inactividad del joystick para desactivar sprint táctil al detenerse */
    this._joyIdleTimer = null;

    /** @private Marca de tiempo del último cambio de poder para impedir doble disparo touch+click */
    this._lastSwitchTriggerMs = -Infinity;

    /** @type {string} Poder elemental actualmente equipado ('Fuego', 'Embestida', 'Raíces') */
    this.currentPower = 'Fuego';

    /** @type {number} Timestamp del último evento de rueda del ratón para throttling */
    this._lastWheelTime = 0;

    /** @type {boolean} Si la acción de defensa (escudo/parry) está activa */
    this.isDefendPressed = false;

    /** @type {string|null} Poder pre-visualizado durante el swipe actual */
    this.hoveredSwipePower = null;

    /** @type {'mouse'|'keyboard'|'touch'} Origen del último comando ofensivo/defensivo para apuntado inteligente */
    this.lastActionSource = 'keyboard';

    /** @type {Vector2} Último vector direccional no nulo ingresado por teclado o joystick */
    this.lastMoveDir = new Vector2(0, 1);

    /** @type {boolean} Si el cursor del ratón está apuntando activamente en este momento */
    this.isMouseAiming = false;

    /** @type {number} Timestamp del último movimiento físico del ratón */
    this.lastMouseMoveTime = 0;

    /** @private Posición anterior del ratón para filtrar micro-vibraciones */
    this._prevMouseX = 0;
    this._prevMouseY = 0;

    /** @type {boolean} Indica si la mecánica de sigilo está habilitada en la escena actual */
    this.stealthEnabled = false;

    /** @private Caché del rectángulo del joystick táctil para evitar reflows en touchmove */
    this._joyRectCache = null;
    this._joyThumbEl = null;

    /** @private Caché del rectángulo del canvas principal para evitar reflows en cada mousemove */
    this._cachedRect = null;
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', () => { this._cachedRect = null; this._joyRectCache = null; }, { passive: true });
      window.addEventListener('orientationchange', () => { this._cachedRect = null; this._joyRectCache = null; }, { passive: true });
    }

    // Callbacks
    this._onSkillEquippedCallback = null;
    this._onSinglePowerHintCallback = null;
    this._onPauseCallback = null;
    this._onTalentsCallback = null;
    /** @type {((powerName: string) => boolean)|null} Filtro opcional para ciclar solo poderes desbloqueados */
    this._canSelectPowerFn = null;

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
   * Registra un callback a ejecutar cuando se equipa un nuevo poder.
   * @param {Function} cb - Recibe el nombre del poder ('Fuego', 'Embestida', 'Raíces')
   */
  onSkillEquipped(cb) {
    this._onSkillEquippedCallback = cb;
  }

  /**
   * Registra un callback a ejecutar cuando el usuario pulsa cambiar poder pero solo tiene 1 elemento.
   * @param {Function} cb - Recibe el nombre visible del único poder desbloqueado
   */
  onSinglePowerHint(cb) {
    this._onSinglePowerHintCallback = cb;
  }

  /**
   * Registra un callback a ejecutar al pulsar el botón de pausa.
   * @param {Function} cb
   */
  onPause(cb) {
    this._onPauseCallback = cb;
  }

  /**
   * Registra un callback a ejecutar al abrir/cerrar el Santuario de Talentos (Tecla U / B).
   * @param {Function} cb
   */
  onTalents(cb) {
    this._onTalentsCallback = cb;
  }

  /**
   * Registra un predicado opcional que filtra qué poderes pueden seleccionarse al ciclar.
   * @param {((powerName: string) => boolean)|null} fn
   */
  setPowerFilter(fn) {
    this._canSelectPowerFn = typeof fn === 'function' ? fn : null;
  }

  /**
   * Normaliza alias elementales al nombre visible usado en la rueda radial y ciclo rápido.
   * @private
   * @param {string} powerName
   * @returns {string}
   */
  _normalizeDisplayPower(powerName) {
    if (!powerName) return '';
    const key = String(powerName).trim().toLowerCase();
    if (key === 'fuego' || key === 'fire') return 'Fuego';
    if (key === 'plantas' || key === 'raices' || key === 'raíces' || key === 'tierra' || key === 'earth') return 'Raíces';
    if (key === 'embestida' || key === 'kinetic' || key === 'cinetico' || key === 'cinético') return 'Embestida';
    if (key === 'eter' || key === 'éter' || key === 'astral' || key === 'ether') return 'Éter';
    return powerName;
  }

  /**
   * Establece directamente el poder elemental activo y dispara el callback.
   * @param {string} powerName - 'Fuego' | 'Embestida' | 'Raíces' | 'Éter'
   */
  setPower(powerName) {
    if (!powerName || powerName === 'Sellado') return;
    const displayPower = this._normalizeDisplayPower(powerName);
    this.currentPower = displayPower;
    if (this._onSkillEquippedCallback) {
      this._onSkillEquippedCallback(displayPower);
    }
  }

  /**
   * Cicla de forma circular entre los poderes elementales disponibles (respetando filtro si existe).
   * Ideal para la rueda del ratón y botones de cambio rápido.
   * @param {number} [direction=1] - 1 para avanzar, -1 para retroceder
   * @returns {string} Poder recién equipado
   */
  cyclePower(direction = 1) {
    const allPowers = ['Fuego', 'Raíces', 'Embestida', 'Éter'];
    const filtered = this._canSelectPowerFn
      ? allPowers.filter((p) => this._canSelectPowerFn(p))
      : allPowers;

    if (this._canSelectPowerFn && filtered.length === 0) {
      if (this._onSkillEquippedCallback) {
        this._onSkillEquippedCallback(allPowers[0]);
      }
      return this.currentPower;
    }

    if (filtered.length === 1) {
      const onlyPower = filtered[0];
      this.setPower(onlyPower);
      if (this._onSinglePowerHintCallback) {
        this._onSinglePowerHintCallback(onlyPower);
      }
      return onlyPower;
    }

    const pool = filtered.length > 0 ? filtered : allPowers;
    const normalizedCurrent = this._normalizeDisplayPower(this.currentPower || pool[0]);
    let idx = pool.indexOf(normalizedCurrent);
    if (idx === -1) idx = 0;
    idx = (idx + direction + pool.length) % pool.length;
    const nextPower = pool[idx];
    this.setPower(nextPower);
    return nextPower;
  }

  /**
   * Desactiva el modo sprint táctil por doble toque de forma segura.
   */
  resetTouchSprint() {
    this.isTouchSprintActive = false;
    if (!this.isActionPressed('SPRINT')) {
      this.isSprintPressed = false;
    }
    if (this._joyIdleTimer) {
      clearTimeout(this._joyIdleTimer);
      this._joyIdleTimer = null;
    }
  }

  /**
   * Dispara una acción con persistencia mínima de fotograma (latching).
   * Garantiza que toques rápidos en pantallas táctiles se procesen sin ser borrados antes del tick del motor.
   * @param {string} actionName - 'attack' | 'heal' | 'dash' | 'ability' | 'strong'
   * @param {number} [durationMs=140]
   */
  triggerAction(actionName, durationMs = 140) {
    switch (actionName) {
      case 'attack':
        this.isAttackPressed = true;
        clearTimeout(this._timerAttack);
        this._timerAttack = setTimeout(() => { this.isAttackPressed = false; }, durationMs);
        break;
      case 'heal':
        this.isHealPressed = true;
        clearTimeout(this._timerHeal);
        this._timerHeal = setTimeout(() => { this.isHealPressed = false; }, durationMs);
        break;
      case 'dash':
        this.isDashPressed = true;
        clearTimeout(this._timerDash);
        this._timerDash = setTimeout(() => { this.isDashPressed = false; }, durationMs);
        break;
      case 'ability':
        this.isAbilityPressed = true;
        clearTimeout(this._timerAbility);
        this._timerAbility = setTimeout(() => { this.isAbilityPressed = false; }, durationMs);
        break;
      case 'strong':
        this.isStrongAttackPressed = true;
        clearTimeout(this._timerStrong);
        this._timerStrong = setTimeout(() => { this.isStrongAttackPressed = false; }, durationMs);
        break;
      case 'stealth':
        this.isStealthPressed = true;
        clearTimeout(this._timerStealth);
        this._timerStealth = setTimeout(() => { this.isStealthPressed = false; }, durationMs);
        break;
    }
  }

  /**
   * Consume la acción de ataque ejecutada en este fotograma.
   */
  consumeAttack() {
    this.isAttackPressed = false;
    clearTimeout(this._timerAttack);
  }

  /**
   * Consume la acción de curación ejecutada en este fotograma.
   */
  consumeHeal() {
    this.isHealPressed = false;
    clearTimeout(this._timerHeal);
  }

  /**
   * Consume la acción de dash ejecutada en este fotograma.
   */
  consumeDash() {
    this.isDashPressed = false;
    clearTimeout(this._timerDash);
  }

  /**
   * Consume la acción de habilidad elemental ejecutada en este fotograma.
   */
  consumeAbility() {
    this.isAbilityPressed = false;
    clearTimeout(this._timerAbility);
  }

  /**
   * Consume la acción de ataque fuerte ejecutada en este fotograma.
   */
  consumeStrongAttack() {
    this.isStrongAttackPressed = false;
  }

  /**
   * Consume la acción de alternar sigilo en este fotograma.
   */
  consumeStealth() {
    this.isStealthPressed = false;
    clearTimeout(this._timerStealth);
  }

  /**
   * Enlaza los manejadores de eventos globales (Teclado físico, ratón y rueda).
   * @private
   */
  _bindEvents() {
    // --- 1. Teclado Físico (Estándar de la Industria + Hotkeys Rápidos) ---
    window.addEventListener('keydown', (e) => {
      this.keys[e.code] = true;
      // Cualquier interacción con el teclado desactiva el apuntado pasivo del ratón
      this.lastActionSource = 'keyboard';
      this.isMouseAiming = false;

      // Actualizar inmediatamente la última dirección deseada si se pulsa WASD o Flechas (cero closures)
      let dirX = 0;
      let dirY = 0;
      if (this.isActionPressed('UP')) dirY -= 1;
      if (this.isActionPressed('DOWN')) dirY += 1;
      if (this.isActionPressed('LEFT')) dirX -= 1;
      if (this.isActionPressed('RIGHT')) dirX += 1;
      if (dirX !== 0 || dirY !== 0) {
        const len = Math.hypot(dirX, dirY) || 1;
        this.lastMoveDir.set(dirX / len, dirY / len);
      }

      // Acciones con Buffer de Entrada Responsivo (200ms para encadenar combos rítmicos con cero inputs perdidos)
      if (KEYBINDINGS.ATTACK.includes(e.code)) {
        this.triggerAction('attack', 200);
      }
      if (KEYBINDINGS.ABILITY.includes(e.code)) {
        this.triggerAction('ability', 200);
      }
      if (KEYBINDINGS.STRONG_ATTACK.includes(e.code)) {
        this.triggerAction('strong', 200);
      }
      if (KEYBINDINGS.HEAL.includes(e.code)) this.triggerAction('heal', 200);
      if (KEYBINDINGS.DASH.includes(e.code)) this.triggerAction('dash', 200);
      if (KEYBINDINGS.STEALTH.includes(e.code) && !e.repeat) {
        this.triggerAction('stealth', 200);
      }

      // Acciones continuas sin buffer
      if (KEYBINDINGS.DEFEND.includes(e.code)) {
        this.isDefendPressed = true;
      }
      if (KEYBINDINGS.SPRINT.includes(e.code)) {
        this.isSprintPressed = true;
      }

      if (KEYBINDINGS.POWER_1.includes(e.code)) this.setPower('Fuego');
      if (KEYBINDINGS.POWER_2.includes(e.code)) this.setPower('Embestida');
      if (KEYBINDINGS.POWER_3.includes(e.code)) this.setPower('Raíces');
      if (KEYBINDINGS.POWER_4.includes(e.code)) this.setPower('Éter');

      if (KEYBINDINGS.POWER_CYCLE.includes(e.code)) {
        this.cyclePower(1);
      }

      if (KEYBINDINGS.RADIAL_MENU.includes(e.code)) {
        e.preventDefault();
        this.isRadialMenuOpen = true;
      }

      if (KEYBINDINGS.TALENTS.includes(e.code) && !e.repeat) {
        if (this._onTalentsCallback) this._onTalentsCallback();
      }

      if (KEYBINDINGS.PAUSE.includes(e.code) && !e.repeat) {
        if (this._onPauseCallback) this._onPauseCallback();
      }
    });

    window.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;

      // No forzamos = false para las acciones cacheadas con triggerAction (permitiendo que el buffer de 100ms persista hasta que el timeout lo limpie).
      // Solo limpiamos acciones continuas como defensa
      if (KEYBINDINGS.DEFEND.includes(e.code)) this.isDefendPressed = false;
      if (KEYBINDINGS.SPRINT.includes(e.code)) this.isSprintPressed = false;

      if (KEYBINDINGS.RADIAL_MENU.includes(e.code)) {
        this.isRadialMenuOpen = false;
      }
    });

    // --- 2. Rueda del Ratón (Mouse Wheel) para Ciclar Poderes al Vuelo ---
    window.addEventListener('wheel', (e) => {
      const now = performance.now();
      // Throttling de 130ms para evitar saltos múltiples por muesca
      if (now - this._lastWheelTime < 130) return;
      this._lastWheelTime = now;

      if (e.deltaY > 0) {
        this.cyclePower(1);
      } else if (e.deltaY < 0) {
        this.cyclePower(-1);
      }
    }, { passive: true });

    // --- 3. Ratón para Selección Radial y Apuntado 360° Activo en PC ---
    window.addEventListener('mousemove', (e) => {
      const dx = Math.abs(e.clientX - this._prevMouseX);
      const dy = Math.abs(e.clientY - this._prevMouseY);
      if (dx > 3 || dy > 3) {
        this.isMouseAiming = true;
        this.lastMouseMoveTime = performance.now();
        this._prevMouseX = e.clientX;
        this._prevMouseY = e.clientY;
      }

      this._updateMousePosition(e.clientX, e.clientY);
      if (this.isRadialMenuOpen) {
        this._calculateRadialSelection();
      }
    });

    // Activar soporte táctil si el dispositivo emite un toque real
    window.addEventListener('touchstart', () => {
      this.isTouchDevice = true;
      this.lastActionSource = 'touch';
      this.isMouseAiming = false;
    }, { passive: true });

    // --- 4. Ratón para Combate (Estándar Hades / Diablo / ARPG) ---
    window.addEventListener('contextmenu', (e) => {
      e.preventDefault(); // Prevenir menú contextual de Windows
    });

    window.addEventListener('mousedown', (e) => {
      // Ignorar clics sobre botones, tarjetas, medallón del HUD o modales de la interfaz DOM
      if (e.target && typeof e.target.closest === 'function') {
        if (e.target.closest('button, .modal-box, .menu-card, .radial-sector, .cinematic-overlay, .rpg-crest-module')) {
          return;
        }
      }

      this._updateMousePosition(e.clientX, e.clientY);
      // No sobreescribir la orientación direccional WASD/Facing al hacer clic para evitar que el cursor estacionado fuerce ataques a la derecha
      this.isMouseAiming = false;
      this.lastMouseMoveTime = performance.now();

      // Clic Izquierdo (Botón 0): Ataque rítmico de Espada con buffer de 200ms
      if (e.button === 0) {
        this.triggerAction('attack', 200);
      }
      // Botón Central (Botón 1): Guardia / Escudo direccional
      if (e.button === 1) {
        e.preventDefault();
        this.isDefendPressed = true;
      }
      // Clic Derecho (Botón 2): Habilidad Elemental Equipada con buffer de 200ms
      if (e.button === 2) {
        this.triggerAction('ability', 200);
      }
    });

    window.addEventListener('mouseup', (e) => {
      // Solo liberamos guardia continua; los ataques y habilidades son consumidos por Player.js o el timeout del buffer
      if (e.button === 1) {
        this.isDefendPressed = false;
      }
    });
  }

  /**
   * Conecta eventos interactivos de alta precisión directamente a los elementos del DOM Overlay.
   * Elimina por completo los chequeos manuales por distancia de píxeles y colisiones obsoletas.
   * @private
   */
  _bindDOMElements() {
    // NOTA ARQUITECTÓNICA: Los botones superiores del HUD (#btn-quick-pause, #btn-quick-talents,
    // #btn-quick-arsenal y #hud-relic-badge) son gestionados de forma unificada en main.js mediante
    // `addTouchClick` para impedir doble disparo simultáneo (abrir+cerrar en 0ms o salto doble de poder).

    // 1. Sectores de la Rueda Radial de Poderes en DOM
    const sectors = document.querySelectorAll('.radial-sector');
    sectors.forEach((sec) => {
      sec.addEventListener('mouseenter', () => {
        const idx = parseInt(sec.dataset.index, 10);
        if (!isNaN(idx)) this.radialSelectionIndex = idx;
      });
      sec.addEventListener('click', (e) => {
        e.stopPropagation();
        const power = sec.dataset.power;
        if (sec.classList.contains('locked') || power === 'Sellado') {
          return; // No se puede equipar el slot sellado
        }
        if (power && this._onSkillEquippedCallback) {
          this._onSkillEquippedCallback(power);
        }
        this.isRadialMenuOpen = false;
      });
    });

    // 3. Botones Táctiles del Virtual Gamepad (Botonera Completa Ergonómica con Latching)
    const bindBtn = (id, onDown, onUp, triggerActionName = null) => {
      const btn = document.getElementById(id);
      if (!btn) return;
      let pressStartTime = 0;

      const start = (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.isTouchDevice = true;
        this.lastActionSource = 'touch';
        pressStartTime = performance.now();
        if (triggerActionName) {
          this.triggerAction(triggerActionName, 200);
        } else {
          onDown();
        }
        btn.classList.add('touch-pressed');
      };

      const stop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        btn.classList.remove('touch-pressed');
        const elapsed = performance.now() - pressStartTime;
        if (triggerActionName) {
          if (elapsed >= 180) {
            onUp();
          }
        } else {
          onUp();
        }
      };

      btn.addEventListener('touchstart', start, { passive: false });
      btn.addEventListener('touchend', stop, { passive: false });
      btn.addEventListener('touchcancel', stop, { passive: false });
      btn.addEventListener('mousedown', start);
      btn.addEventListener('mouseup', stop);
      btn.addEventListener('mouseleave', stop);
    };

    // 3.1 Botón Central de Espada
    bindBtn('touch-btn-attack', () => { this.isAttackPressed = true; }, () => { this.isAttackPressed = false; }, 'attack');

    // 3.2 Botón de Habilidad Elemental Débil / Rápida
    bindBtn('touch-btn-skill-weak', () => { this.isAbilityPressed = true; }, () => { this.isAbilityPressed = false; }, 'ability');

    // 3.3 Botón de Habilidad Elemental Fuerte / Cargada
    bindBtn('touch-btn-skill-strong', () => { this.isStrongAttackPressed = true; }, () => { this.isStrongAttackPressed = false; }, 'strong');

    // 3.4 Botón Híbrido Dash (1 toque) / Correr-Sprint (doble toque)
    const btnDash = document.getElementById('touch-btn-dash');
    if (btnDash) {
      let lastTouchEventMs = -Infinity;
      const startDashOrSprint = (e, isTouch) => {
        e.preventDefault();
        e.stopPropagation();
        const now = performance.now();
        if (!isTouch && now - lastTouchEventMs < 450) return;
        if (isTouch) lastTouchEventMs = now;

        this.isTouchDevice = true;
        this.lastActionSource = 'touch';
        this._isTouchDashHeld = true;
        btnDash.classList.add('touch-pressed');

        if (this._joyIdleTimer) {
          clearTimeout(this._joyIdleTimer);
          this._joyIdleTimer = null;
        }

        if (now - this._lastDashTapMs <= 340) {
          // Doble toque: activa Correr / Sprint sostenido mientras el stick esté activo
          this._lastDashTapMs = -Infinity;
          this.isTouchSprintActive = true;
          this.isSprintPressed = true;
          btnDash.classList.add('sprint-active');
        } else {
          this._lastDashTapMs = now;
          if (this.isTouchSprintActive) {
            this.resetTouchSprint();
            btnDash.classList.remove('sprint-active');
          }
          this.triggerAction('dash', 200);
        }
      };

      const stopDashOrSprint = (e, isTouch) => {
        if (e) {
          e.preventDefault();
          e.stopPropagation();
        }
        if (!isTouch && performance.now() - lastTouchEventMs < 450) return;
        this._isTouchDashHeld = false;
        btnDash.classList.remove('touch-pressed');

        // Si se activó Sprint por doble toque y el joystick está quieto, dar ventana de 450ms para empezar a moverse
        if (this.isTouchSprintActive && this.joystickVector.lengthSquared() <= 0.02) {
          clearTimeout(this._joyIdleTimer);
          this._joyIdleTimer = setTimeout(() => {
            if (!this._isTouchDashHeld && this.joystickVector.lengthSquared() <= 0.02) {
              this.resetTouchSprint();
              btnDash.classList.remove('sprint-active');
            }
          }, 450);
        }
      };

      btnDash.addEventListener('touchstart', (e) => startDashOrSprint(e, true), { passive: false });
      btnDash.addEventListener('touchend', (e) => stopDashOrSprint(e, true), { passive: false });
      btnDash.addEventListener('touchcancel', (e) => stopDashOrSprint(e, true), { passive: false });
      btnDash.addEventListener('mousedown', (e) => startDashOrSprint(e, false));
      btnDash.addEventListener('mouseup', (e) => stopDashOrSprint(e, false));
      btnDash.addEventListener('mouseleave', () => {
        if (this._isTouchDashHeld) stopDashOrSprint(null, false);
      });
    }

    // 3.5 Botón de Guardia y Defensa con Escudo / Parry
    bindBtn('touch-btn-defend', () => { this.isDefendPressed = true; }, () => { 
      setTimeout(() => { this.isDefendPressed = false; }, 140);
    });

    // 3.6 Botón de Curación Milenaria del Guante
    bindBtn('touch-btn-heal', () => { this.isHealPressed = true; }, () => { this.isHealPressed = false; }, 'heal');

    // 3.7 Selector Rápido de Elemento (Cicla entre poderes desbloqueados con debounce estricto touch/click)
    const btnSwitch = document.getElementById('touch-btn-switch');
    if (btnSwitch) {
      let lastTouchSwitchMs = -Infinity;
      const triggerSwitch = (e, isTouch) => {
        e.preventDefault();
        e.stopPropagation();
        const now = performance.now();
        if (!isTouch && now - lastTouchSwitchMs < 450) return;
        if (now - this._lastSwitchTriggerMs < 220) return;
        if (isTouch) lastTouchSwitchMs = now;
        this._lastSwitchTriggerMs = now;

        this.isTouchDevice = true;
        this.lastActionSource = 'touch';
        btnSwitch.classList.add('touch-pressed');
        setTimeout(() => btnSwitch.classList.remove('touch-pressed'), 120);
        this.cyclePower(1);
      };
      btnSwitch.addEventListener('touchstart', (e) => triggerSwitch(e, true), { passive: false });
      btnSwitch.addEventListener('click', (e) => triggerSwitch(e, false));
    }

    // 4. Joystick Táctil en DOM (incluye toque en el centro del stick para agacharse / sigilo)
    const joyZone = document.getElementById('touch-joystick-zone');
    const joyBase = document.getElementById('touch-joystick-base');
    this._joyThumbEl = document.getElementById('touch-joystick-thumb');
    if (joyZone && joyBase) {
      let activeTouchId = null;
      let joyStartMs = 0;
      let joyStayedInCenter = false;

      const handleJoy = (clientX, clientY, isStart = false) => {
        const rect = this._joyRectCache || joyBase.getBoundingClientRect();
        if (!this._joyRectCache && rect.width > 0) this._joyRectCache = rect;
        const centerX = rect.left + rect.width * 0.5;
        const centerY = rect.top + rect.height * 0.5;
        const dx = clientX - centerX;
        const dy = clientY - centerY;
        const distSq = dx * dx + dy * dy;
        const maxDist = rect.width * 0.5;
        const centerTapRadius = maxDist * 0.44;

        if (maxDist <= 0) {
          this.joystickVector.set(0, 0);
          if (this._joyThumbEl) this._joyThumbEl.style.transform = 'translate(0px, 0px)';
          return;
        }

        const dist = Math.sqrt(distSq);
        if (isStart) {
          joyStartMs = performance.now();
          joyStayedInCenter = dist <= centerTapRadius;
        } else if (dist > centerTapRadius) {
          joyStayedInCenter = false;
        }

        // Pequeña zona muerta central para evitar micro-giros al tocar el centro para agacharse
        if (dist <= maxDist * 0.22 && joyStayedInCenter) {
          this.joystickVector.set(0, 0);
          if (this._joyThumbEl) this._joyThumbEl.style.transform = 'translate(0px, 0px)';
          return;
        }

        const clamped = dist < maxDist ? dist : maxDist;
        const normX = dist > 0 ? dx / dist : 0;
        const normY = dist > 0 ? dy / dist : 0;
        this.joystickVector.set(normX * (clamped / maxDist), normY * (clamped / maxDist));
        if (this.joystickVector.lengthSquared() > 0.02) {
          this.lastMoveDir.set(normX, normY);
          if (this._joyIdleTimer) {
            clearTimeout(this._joyIdleTimer);
            this._joyIdleTimer = null;
          }
        }

        if (this._joyThumbEl) {
          this._joyThumbEl.style.transform = `translate(${Math.round(normX * clamped)}px, ${Math.round(normY * clamped)}px)`;
        }
      };

      const startJoy = (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.isTouchDevice = true;
        this.lastActionSource = 'touch';
        this.isMouseAiming = false;
        this._joyRectCache = joyBase.getBoundingClientRect();
        const touch = e.touches ? e.touches[0] : e;
        activeTouchId = e.touches ? touch.identifier : 'mouse';
        handleJoy(touch.clientX, touch.clientY, true);
      };

      const moveJoy = (e) => {
        if (activeTouchId === null) return;
        let touch = null;
        if (e.touches) {
          for (let i = 0; i < e.touches.length; i++) {
            if (e.touches[i].identifier === activeTouchId) {
              touch = e.touches[i];
              break;
            }
          }
        } else if (activeTouchId === 'mouse') {
          touch = e;
        }
        if (touch) {
          e.preventDefault();
          handleJoy(touch.clientX, touch.clientY, false);
        }
      };

      const endJoy = (e) => {
        if (activeTouchId === null) return;
        if (e.changedTouches) {
          let matched = false;
          for (let i = 0; i < e.changedTouches.length; i++) {
            if (e.changedTouches[i].identifier === activeTouchId) {
              matched = true;
              break;
            }
          }
          if (!matched) return;
        }
        activeTouchId = null;

        // Toque corto en el centro del stick => alternar agacharse / sigilo / slide
        if (joyStayedInCenter && (performance.now() - joyStartMs) <= 340) {
          this.triggerAction('stealth', 200);
        }
        joyStayedInCenter = false;

        this.joystickVector.set(0, 0);
        if (this._joyThumbEl) {
          this._joyThumbEl.style.transform = 'translate(0px, 0px)';
        }

        if (this.isTouchSprintActive && !this._isTouchDashHeld) {
          clearTimeout(this._joyIdleTimer);
          this._joyIdleTimer = setTimeout(() => {
            if (!this._isTouchDashHeld && this.joystickVector.lengthSquared() <= 0.02) {
              this.resetTouchSprint();
              const dashBtnEl = document.getElementById('touch-btn-dash');
              if (dashBtnEl) dashBtnEl.classList.remove('sprint-active');
            }
          }, 240);
        }
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
        this.lastActionSource = 'touch';
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
        
        // Si no hubo swipe direccional, fue un tap -> Disparar con latching seguro la habilidad equipada
        if (!this.hoveredSwipePower) {
          this.triggerAction('ability', 180);
        } else if (this.hoveredSwipePower !== null) {
          this.setPower(this.hoveredSwipePower);
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
   * Norte: Fuego | Este: Embestida | Sur: Raíces | Oeste: Éter
   * @private
   * @param {number} dx
   * @param {number} dy
   * @returns {string|null}
   */
  _calculateSwipePower(dx, dy) {
    const angleRad = Math.atan2(dy, dx);
    const angleDeg = (angleRad * 180) / Math.PI;

    if (angleDeg >= -135 && angleDeg < -45) return 'Fuego';
    if (angleDeg >= -45 && angleDeg < 45) return 'Embestida';
    if (angleDeg >= 45 && angleDeg < 135) return 'Raíces';
    return 'Éter';
  }

  /**
   * Obtiene el rectángulo delimitador del canvas principal o dimensiones de viewport seguras.
   * @returns {DOMRect|{left: number, top: number, width: number, height: number}}
   */
  getCanvasRect() {
    if (this._cachedRect && this._cachedRect.width > 0) {
      return this._cachedRect;
    }
    if (!this.canvas && typeof document !== 'undefined') {
      this.canvas = document.getElementById('main-canvas');
    }
    if (this.canvas && typeof this.canvas.getBoundingClientRect === 'function') {
      const r = this.canvas.getBoundingClientRect();
      if (r && r.width > 0) {
        this._cachedRect = r;
      }
      return r;
    }
    return {
      left: 0,
      top: 0,
      width: (typeof window !== 'undefined' ? window.innerWidth : 960),
      height: (typeof window !== 'undefined' ? window.innerHeight : 540)
    };
  }

  /**
   * Actualiza las coordenadas del ratón respecto al origen del canvas principal.
   * @private
   * @param {number} clientX
   * @param {number} clientY
   */
  _updateMousePosition(clientX, clientY) {
    const rect = this.getCanvasRect();
    this.mouse.set(clientX - rect.left, clientY - rect.top);
  }

  /**
   * Calcula el slot de la rueda radial de PC según la posición del cursor respecto al centro real del canvas.
   * @private
   */
  _calculateRadialSelection() {
    const rect = this.getCanvasRect();
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

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
   * Evalúa sin crear closures si alguna tecla asignada a la acción está activa.
   * @param {keyof typeof KEYBINDINGS} actionName
   * @returns {boolean}
   */
  isActionPressed(actionName) {
    const codes = KEYBINDINGS[actionName];
    if (!codes) return false;
    for (let i = 0; i < codes.length; i++) {
      if (this.keys[codes[i]]) return true;
    }
    return false;
  }

  /**
   * Habilita o deshabilita el indicador visual de zona de sigilo según la escena actual.
   * Mantiene [C] / botón de agacharse disponible para Slide y Dive táctico.
   * @param {boolean} enabled
   */
  setStealthEnabled(enabled) {
    this.stealthEnabled = Boolean(enabled);
  }

  /**
   * Actualización por fotograma (mantenida por uniformidad de interfaz).
   */
  update() {}
}

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
  HEAL: ['KeyQ', 'KeyC'],
  DASH: ['Space'],
  DEFEND: ['ShiftLeft', 'ShiftRight'],
  POWER_1: ['Digit1'],
  POWER_2: ['Digit2'],
  POWER_3: ['Digit3'],
  POWER_CYCLE: ['KeyR', 'KeyE'],
  RADIAL_MENU: ['Tab'],
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

    /** @type {string} Poder elemental actualmente equipado ('Fuego', 'Embestida', 'Raíces') */
    this.currentPower = 'Fuego';

    /** @type {number} Timestamp del último evento de rueda del ratón para throttling */
    this._lastWheelTime = 0;

    /** @type {boolean} Si la acción de defensa (escudo/parry) está activa */
    this.isDefendPressed = false;

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
   * Registra un callback a ejecutar cuando se equipa un nuevo poder.
   * @param {Function} cb - Recibe el nombre del poder ('Fuego', 'Embestida', 'Raíces')
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
   * Establece directamente el poder elemental activo y dispara el callback.
   * @param {string} powerName - 'Fuego' | 'Embestida' | 'Raíces'
   */
  setPower(powerName) {
    if (!powerName || powerName === 'Sellado') return;
    this.currentPower = powerName;
    if (this._onSkillEquippedCallback) {
      this._onSkillEquippedCallback(powerName);
    }
  }

  /**
   * Cicla de forma circular entre los poderes elementales disponibles.
   * Ideal para la rueda del ratón y botones de cambio rápido.
   * @param {number} [direction=1] - 1 para avanzar, -1 para retroceder
   * @returns {string} Poder recién equipado
   */
  cyclePower(direction = 1) {
    const availablePowers = ['Fuego', 'Embestida', 'Raíces'];
    let idx = availablePowers.indexOf(this.currentPower || 'Fuego');
    if (idx === -1) idx = 0;
    idx = (idx + direction + availablePowers.length) % availablePowers.length;
    const nextPower = availablePowers[idx];
    this.setPower(nextPower);
    return nextPower;
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
   * Enlaza los manejadores de eventos globales (Teclado físico, ratón y rueda).
   * @private
   */
  _bindEvents() {
    // --- 1. Teclado Físico (Estándar de la Industria + Hotkeys Rápidos) ---
    window.addEventListener('keydown', (e) => {
      this.keys[e.code] = true;

      // Acciones con Buffer de Entrada Responsivo (180ms para encadenar combos y absorber cooldowns)
      if (KEYBINDINGS.ATTACK.includes(e.code)) this.triggerAction('attack', 180);
      if (KEYBINDINGS.ABILITY.includes(e.code)) this.triggerAction('ability', 180);
      if (KEYBINDINGS.STRONG_ATTACK.includes(e.code)) this.triggerAction('strong', 180);
      if (KEYBINDINGS.HEAL.includes(e.code)) this.triggerAction('heal', 180);
      if (KEYBINDINGS.DASH.includes(e.code)) this.triggerAction('dash', 180);

      // Acciones continuas sin buffer
      if (KEYBINDINGS.DEFEND.includes(e.code)) this.isDefendPressed = true;

      if (KEYBINDINGS.POWER_1.includes(e.code)) this.setPower('Fuego');
      if (KEYBINDINGS.POWER_2.includes(e.code)) this.setPower('Embestida');
      if (KEYBINDINGS.POWER_3.includes(e.code)) this.setPower('Raíces');

      if (KEYBINDINGS.POWER_CYCLE.includes(e.code)) {
        this.cyclePower(1);
      }

      if (KEYBINDINGS.RADIAL_MENU.includes(e.code)) {
        e.preventDefault();
        this.isRadialMenuOpen = true;
      }

      if (KEYBINDINGS.PAUSE.includes(e.code)) {
        if (this._onPauseCallback) this._onPauseCallback();
      }
    });

    window.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;

      // No forzamos = false para las acciones cacheadas con triggerAction (permitiendo que el buffer de 100ms persista hasta que el timeout lo limpie).
      // Solo limpiamos acciones continuas como defensa
      if (KEYBINDINGS.DEFEND.includes(e.code)) this.isDefendPressed = false;

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

    // --- 3. Ratón para Selección Radial en PC ---
    window.addEventListener('mousemove', (e) => {
      this._updateMousePosition(e.clientX, e.clientY);
      if (this.isRadialMenuOpen) {
        this._calculateRadialSelection();
      }
    });

    // Activar soporte táctil si el dispositivo emite un toque real
    window.addEventListener('touchstart', () => {
      this.isTouchDevice = true;
    }, { passive: true });

    // --- 4. Ratón para Combate (Estándar Hades / Diablo / ARPG) ---
    window.addEventListener('contextmenu', (e) => {
      e.preventDefault(); // Prevenir menú contextual de Windows
    });

    window.addEventListener('mousedown', (e) => {
      this._updateMousePosition(e.clientX, e.clientY);

      // Clic Izquierdo (Botón 0): Ataque básico de Espada canalizado con buffer de 180ms
      if (e.button === 0) {
        this.triggerAction('attack', 180);
      }
      // Botón Central (Botón 1): Guardia / Escudo
      if (e.button === 1) {
        this.isDefendPressed = true;
      }
      // Clic Derecho (Botón 2): Habilidad Elemental Equipada con buffer de 180ms
      if (e.button === 2) {
        this.triggerAction('ability', 180);
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
        pressStartTime = performance.now();
        if (triggerActionName) {
          this.triggerAction(triggerActionName, 180);
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

    // 3.4 Botón de Esquiva / Dash con Iframes
    bindBtn('touch-btn-dash', () => { this.isDashPressed = true; }, () => { this.isDashPressed = false; }, 'dash');

    // 3.5 Botón de Guardia y Defensa con Escudo / Parry
    bindBtn('touch-btn-defend', () => { this.isDefendPressed = true; }, () => { 
      setTimeout(() => { this.isDefendPressed = false; }, 140);
    });

    // 3.6 Botón de Curación Milenaria del Guante
    bindBtn('touch-btn-heal', () => { this.isHealPressed = true; }, () => { this.isHealPressed = false; }, 'heal');

    // 3.7 Selector Rápido de Elemento (Cicla entre Fuego, Embestida y Raíces)
    const btnSwitch = document.getElementById('touch-btn-switch');
    if (btnSwitch) {
      const handleSwitch = (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.isTouchDevice = true;
        this.cyclePower(1);
      };
      btnSwitch.addEventListener('touchstart', handleSwitch, { passive: false });
      btnSwitch.addEventListener('click', handleSwitch);
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
          const thumb = document.getElementById('touch-joystick-thumb');
          if (thumb) thumb.style.transform = 'translate(0px, 0px)';
          return;
        }

        const clamped = Math.min(dist, maxDist);
        const normX = dx / dist;
        const normY = dy / dist;
        this.joystickVector.set(normX * (clamped / maxDist), normY * (clamped / maxDist));

        const thumb = document.getElementById('touch-joystick-thumb');
        if (thumb) {
          thumb.style.transform = `translate(${normX * clamped}px, ${normY * clamped}px)`;
        }
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
        const thumb = document.getElementById('touch-joystick-thumb');
        if (thumb) {
          thumb.style.transform = 'translate(0px, 0px)';
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
        
        // Si no hubo swipe direccional, fue un tap -> Disparar la habilidad elemental equipada
        if (!this.hoveredSwipePower) {
          this.isAbilityPressed = true;
          setTimeout(() => { this.isAbilityPressed = false; }, 80);
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
   * Norte: Fuego | Este: Embestida | Sur: Raíces | Oeste: Sellado (4to elemento por descubrir)
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
    // Oeste está reservado para el 4to elemento futuro aún sin despertar
    return null;
  }

  /**
   * Obtiene el rectángulo delimitador del canvas principal o dimensiones de viewport seguras.
   * @returns {DOMRect|{left: number, top: number, width: number, height: number}}
   */
  getCanvasRect() {
    if (!this.canvas && typeof document !== 'undefined') {
      this.canvas = document.getElementById('main-canvas');
    }
    if (this.canvas) {
      return this.canvas.getBoundingClientRect();
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
   * Actualización por fotograma (mantenida por uniformidad de interfaz).
   */
  update() {}
}
